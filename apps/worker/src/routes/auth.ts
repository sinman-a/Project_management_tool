import { Hono } from 'hono'
import { SignJWT } from 'jose'
import { z } from 'zod'
import type { D1Database } from '@cloudflare/workers-types'
import type { HonoContext } from '../types'
import { authMiddleware, verifyToken } from '../middleware/auth'
import { requireAny } from '../middleware/rbac'
import { hashPassword, verifyPassword } from '../utils/password'
import { generateSecret, verifyTotp, otpauthUri, genBackupCodes, sha256Hex } from '../utils/totp'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  totpCode: z.string().max(20).optional(),
})

interface AuthEvent {
  orgId?: string | null
  userId?: string | null
  email?: string | null
  eventType: string
  ip: string
  userAgent: string
}

async function logAuthEvent(db: D1Database, e: AuthEvent): Promise<void> {
  try {
    await db.prepare(
      'INSERT INTO auth_events (id, org_id, user_id, email, event_type, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), e.orgId ?? null, e.userId ?? null, e.email ?? null, e.eventType, e.ip, e.userAgent).run()
  } catch {
    // never let audit logging break the auth flow
  }
}

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(100),
  orgName: z.string().min(2).max(200).optional(),
})

export const authRoutes = new Hono<HonoContext>()

async function issueToken(
  jwtSecret: string,
  jwtExpiry: string,
  userId: string,
  email: string,
  role: string,
  orgId: string,
  tokenVersion: number,
): Promise<string> {
  const secret = new TextEncoder().encode(jwtSecret)
  const expiry = parseInt(jwtExpiry, 10)
  return new SignJWT({ sub: userId, email, role, orgId, tv: tokenVersion, jti: crypto.randomUUID() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiry}s`)
    .sign(secret)
}

function setCookieHeader(token: string, expiry: number, isProduction: boolean): string {
  if (isProduction) {
    return `ppm_token=${token}; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=${expiry}`
  }
  return `ppm_token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${expiry}`
}

/**
 * Mint a fresh session cookie for the given user. Used after the caller bumps
 * their own token_version (e.g. password change) so the current session stays
 * valid while all other sessions are revoked.
 */
export async function setSessionCookie(
  c: { env: { JWT_SECRET: string; JWT_EXPIRY: string; ENVIRONMENT: string }; header: (k: string, v: string) => void },
  user: { id: string; email: string; role: string; orgId: string; tokenVersion: number },
): Promise<void> {
  const expiry = parseInt(c.env.JWT_EXPIRY, 10)
  const token = await issueToken(c.env.JWT_SECRET, c.env.JWT_EXPIRY, user.id, user.email, user.role, user.orgId, user.tokenVersion)
  c.header('Set-Cookie', setCookieHeader(token, expiry, c.env.ENVIRONMENT === 'production'))
}

// ── Brute-force rate limiting (KV-backed) ────────────────────────────────────
const MAX_ATTEMPTS = 10
const WINDOW_SECONDS = 15 * 60
// Account-creation endpoints (register/setup) are unauthenticated — keep a tighter cap.
const MAX_SIGNUPS = 5

function clientIp(c: { req: { header: (k: string) => string | undefined } }): string {
  return c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown'
}

function userAgent(c: { req: { header: (k: string) => string | undefined } }): string {
  return (c.req.header('User-Agent') ?? 'unknown').slice(0, 300)
}

/** Returns true if the caller is over the given attempt limit. */
async function isRateLimited(kv: KVNamespace, key: string, max = MAX_ATTEMPTS): Promise<boolean> {
  const raw = await kv.get(key)
  return raw !== null && parseInt(raw, 10) >= max
}

async function recordFailure(kv: KVNamespace, key: string): Promise<void> {
  const raw = await kv.get(key)
  const next = (raw ? parseInt(raw, 10) : 0) + 1
  await kv.put(key, String(next), { expirationTtl: WINDOW_SECONDS })
}

async function clearFailures(kv: KVNamespace, key: string): Promise<void> {
  await kv.delete(key)
}

authRoutes.post('/login', async (c) => {
  const rlKey = `login_attempts:${clientIp(c)}`
  if (await isRateLimited(c.env.KV_CACHE, rlKey)) {
    return c.json({ message: 'Too many login attempts. Please try again later.' }, 429)
  }

  const body = await c.req.json()
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ message: 'Invalid input' }, 400)
  }

  const { email, password, totpCode } = parsed.data
  const ip = clientIp(c)
  const ua = userAgent(c)
  const user = await c.env.DB.prepare(
    `SELECT id, email, full_name, role, org_id, password_hash, token_version,
            totp_enabled, totp_secret, totp_backup_codes
     FROM users WHERE email = ? AND is_active = 1`,
  )
    .bind(email)
    .first<{
      id: string; email: string; full_name: string; role: string; org_id: string; password_hash: string
      token_version: number; totp_enabled: number; totp_secret: string | null; totp_backup_codes: string | null
    }>()

  if (!user) {
    await recordFailure(c.env.KV_CACHE, rlKey)
    await logAuthEvent(c.env.DB, { email, eventType: 'login_failure', ip, userAgent: ua })
    return c.json({ message: 'Invalid email or password' }, 401)
  }

  if (user.password_hash === 'CHANGE_ME_BEFORE_DEPLOY') {
    return c.json({ message: 'SETUP_REQUIRED' }, 403)
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    await recordFailure(c.env.KV_CACHE, rlKey)
    await logAuthEvent(c.env.DB, { orgId: user.org_id, userId: user.id, email, eventType: 'login_failure', ip, userAgent: ua })
    return c.json({ message: 'Invalid email or password' }, 401)
  }

  // Second factor (if enabled): require a valid TOTP code or a one-time backup code.
  if (user.totp_enabled === 1 && user.totp_secret) {
    if (!totpCode) {
      await logAuthEvent(c.env.DB, { orgId: user.org_id, userId: user.id, email, eventType: 'login_2fa_required', ip, userAgent: ua })
      return c.json({ message: 'TWO_FACTOR_REQUIRED' }, 401)
    }
    let factorOk = await verifyTotp(user.totp_secret, totpCode)
    if (!factorOk) {
      // Try a backup code (consume on success).
      const codes: string[] = user.totp_backup_codes ? JSON.parse(user.totp_backup_codes) : []
      const hash = await sha256Hex(totpCode.trim().toLowerCase())
      const idx = codes.indexOf(hash)
      if (idx !== -1) {
        codes.splice(idx, 1)
        await c.env.DB.prepare('UPDATE users SET totp_backup_codes = ? WHERE id = ?').bind(JSON.stringify(codes), user.id).run()
        factorOk = true
      }
    }
    if (!factorOk) {
      await recordFailure(c.env.KV_CACHE, rlKey)
      await logAuthEvent(c.env.DB, { orgId: user.org_id, userId: user.id, email, eventType: 'login_2fa_failure', ip, userAgent: ua })
      return c.json({ message: 'TWO_FACTOR_REQUIRED' }, 401)
    }
  }

  // Successful login — clear the attempt counter
  await clearFailures(c.env.KV_CACHE, rlKey)
  await logAuthEvent(c.env.DB, { orgId: user.org_id, userId: user.id, email, eventType: 'login_success', ip, userAgent: ua })

  const expiry = parseInt(c.env.JWT_EXPIRY, 10)
  const token = await issueToken(c.env.JWT_SECRET, c.env.JWT_EXPIRY, user.id, user.email, user.role, user.org_id, user.token_version)

  c.header('Set-Cookie', setCookieHeader(token, expiry, c.env.ENVIRONMENT === 'production'))

  return c.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    orgId: user.org_id,
    twoFactorEnabled: user.totp_enabled === 1,
  })
})

function clearCookieHeader(isProduction: boolean): string {
  const sameSite = isProduction ? 'SameSite=None; Secure;' : 'SameSite=Lax;'
  return `ppm_token=; HttpOnly; ${sameSite} Path=/; Max-Age=0`
}

authRoutes.post('/logout', async (c) => {
  // Best-effort audit (token may be valid or expired); always clear the cookie.
  const cookie = c.req.header('Cookie') ?? ''
  const token = cookie.split(';').find((s) => s.trim().startsWith('ppm_token='))?.split('=')[1]?.trim()
  if (token) {
    const payload = await verifyToken(token, c.env)
    if (payload) {
      await logAuthEvent(c.env.DB, { orgId: payload.orgId, userId: payload.sub, email: payload.email, eventType: 'logout', ip: clientIp(c), userAgent: userAgent(c) })
    }
  }
  c.header('Set-Cookie', clearCookieHeader(c.env.ENVIRONMENT === 'production'))
  return c.json({ ok: true })
})

// Revoke ALL of the caller's sessions (bump token_version) and clear this cookie.
authRoutes.post('/logout-all', authMiddleware, async (c) => {
  const u = c.get('user')
  await c.env.DB.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').bind(u.sub).run()
  await logAuthEvent(c.env.DB, { orgId: u.orgId, userId: u.sub, email: u.email, eventType: 'logout_all', ip: clientIp(c), userAgent: userAgent(c) })
  c.header('Set-Cookie', clearCookieHeader(c.env.ENVIRONMENT === 'production'))
  return c.json({ ok: true })
})

// ── Two-factor authentication (TOTP) ─────────────────────────────────────────

// Begin enrollment — generate a pending secret (not yet enabled).
authRoutes.post('/2fa/setup', authMiddleware, async (c) => {
  const u = c.get('user')
  const secret = generateSecret()
  await c.env.DB.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').bind(secret, u.sub).run()
  return c.json({ secret, otpauthUri: otpauthUri(secret, u.email) })
})

// Confirm enrollment — verify a code against the pending secret, then enable + issue backup codes.
authRoutes.post('/2fa/enable', authMiddleware, async (c) => {
  const u = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const code = (body as { code?: string }).code ?? ''

  const row = await c.env.DB.prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ?')
    .bind(u.sub).first<{ totp_secret: string | null; totp_enabled: number }>()
  if (!row?.totp_secret) return c.json({ message: 'Start 2FA setup first' }, 400)
  if (!(await verifyTotp(row.totp_secret, code))) return c.json({ message: 'Invalid code' }, 400)

  const { plain, hashed } = await genBackupCodes()
  // Enabling 2FA revokes other existing sessions for safety.
  await c.env.DB.prepare(
    'UPDATE users SET totp_enabled = 1, totp_backup_codes = ?, token_version = token_version + 1 WHERE id = ?',
  ).bind(JSON.stringify(hashed), u.sub).run()
  await logAuthEvent(c.env.DB, { orgId: u.orgId, userId: u.sub, email: u.email, eventType: '2fa_enabled', ip: clientIp(c), userAgent: userAgent(c) })
  return c.json({ backupCodes: plain })
})

// Disable 2FA (requires a valid current code).
authRoutes.post('/2fa/disable', authMiddleware, async (c) => {
  const u = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const code = (body as { code?: string }).code ?? ''

  const row = await c.env.DB.prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ?')
    .bind(u.sub).first<{ totp_secret: string | null; totp_enabled: number }>()
  if (row?.totp_enabled !== 1 || !row.totp_secret) return c.json({ message: '2FA is not enabled' }, 400)
  if (!(await verifyTotp(row.totp_secret, code))) return c.json({ message: 'Invalid code' }, 400)

  await c.env.DB.prepare(
    'UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_backup_codes = NULL WHERE id = ?',
  ).bind(u.sub).run()
  await logAuthEvent(c.env.DB, { orgId: u.orgId, userId: u.sub, email: u.email, eventType: '2fa_disabled', ip: clientIp(c), userAgent: userAgent(c) })
  return c.json({ ok: true })
})

// Admin-only login audit log (org-scoped).
authRoutes.get('/events', authMiddleware, requireAny('admin'), async (c) => {
  const u = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT id, user_id, email, event_type, ip, user_agent, created_at FROM auth_events WHERE org_id = ? ORDER BY created_at DESC LIMIT 200',
  ).bind(u.orgId).all()
  return c.json(results.map((r) => Object.fromEntries(
    Object.entries(r).map(([k, v]) => [k.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()), v]),
  )))
})

authRoutes.get('/me', authMiddleware, async (c) => {
  const jwt = c.get('user')
  const user = await c.env.DB.prepare(
    'SELECT id, email, full_name, role, org_id, totp_enabled FROM users WHERE id = ? AND is_active = 1',
  )
    .bind(jwt.sub)
    .first<{ id: string; email: string; full_name: string; role: string; org_id: string; totp_enabled: number }>()

  if (!user) return c.json({ message: 'User not found' }, 404)

  return c.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    orgId: user.org_id,
    twoFactorEnabled: user.totp_enabled === 1,
  })
})

// First-run setup — works only when no real account exists yet
authRoutes.post('/setup', async (c) => {
  const rlKey = `signup_attempts:${clientIp(c)}`
  if (await isRateLimited(c.env.KV_CACHE, rlKey, MAX_SIGNUPS)) {
    return c.json({ message: 'Too many attempts. Please try again later.' }, 429)
  }
  await recordFailure(c.env.KV_CACHE, rlKey)

  // Abort entirely if ANY real (non-placeholder) active user already exists.
  // Prevents re-trigger and races once the system is in use.
  const realUsers = await c.env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM users WHERE password_hash != 'CHANGE_ME_BEFORE_DEPLOY' AND is_active = 1",
  ).first<{ cnt: number }>()
  if (realUsers && realUsers.cnt > 0) {
    return c.json({ message: 'Setup already completed' }, 403)
  }

  const admin = await c.env.DB.prepare(
    "SELECT id, org_id, password_hash FROM users WHERE role = 'admin' AND password_hash = 'CHANGE_ME_BEFORE_DEPLOY' LIMIT 1",
  ).first<{ id: string; org_id: string; password_hash: string }>()

  if (!admin) {
    return c.json({ message: 'Setup already completed or not available' }, 403)
  }

  const body = await c.req.json()
  const parsed = setupSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)
  }

  const { email, password, fullName, orgName } = parsed.data
  const passwordHash = await hashPassword(password)

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET email = ?, full_name = ?, password_hash = ? WHERE id = ?')
      .bind(email, fullName, passwordHash, admin.id),
    ...(orgName
      ? [c.env.DB.prepare('UPDATE organizations SET name = ? WHERE id = ?').bind(orgName, admin.org_id)]
      : []),
  ])

  const expiry = parseInt(c.env.JWT_EXPIRY, 10)
  const token = await issueToken(c.env.JWT_SECRET, c.env.JWT_EXPIRY, admin.id, email, 'admin', admin.org_id, 0)
  c.header('Set-Cookie', setCookieHeader(token, expiry, c.env.ENVIRONMENT === 'production'))
  await logAuthEvent(c.env.DB, { orgId: admin.org_id, userId: admin.id, email, eventType: 'login_success', ip: clientIp(c), userAgent: userAgent(c) })

  return c.json({ id: admin.id, email, fullName, role: 'admin', orgId: admin.org_id })
})

// Check if setup is needed — true only when NO real (non-placeholder) users exist yet
authRoutes.get('/setup/status', async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM users WHERE password_hash != 'CHANGE_ME_BEFORE_DEPLOY' AND is_active = 1",
  ).first<{ cnt: number }>()

  return c.json({ needsSetup: !row || row.cnt === 0 })
})

// Public registration — creates a new independent org + admin account
authRoutes.post('/register', async (c) => {
  const rlKey = `signup_attempts:${clientIp(c)}`
  if (await isRateLimited(c.env.KV_CACHE, rlKey, MAX_SIGNUPS)) {
    return c.json({ message: 'Too many attempts. Please try again later.' }, 429)
  }
  await recordFailure(c.env.KV_CACHE, rlKey)

  const body = await c.req.json()
  const parsed = setupSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)
  }

  const { email, password, fullName, orgName } = parsed.data

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email).first()
  if (existing) return c.json({ message: 'Email already in use' }, 409)

  const orgId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)

  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO organizations (id, name) VALUES (?, ?)')
      .bind(orgId, orgName ?? 'My Organization'),
    c.env.DB.prepare(
      'INSERT INTO users (id, org_id, email, full_name, role, password_hash, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
    ).bind(userId, orgId, email, fullName, 'admin', passwordHash),
  ])

  const expiry = parseInt(c.env.JWT_EXPIRY, 10)
  const token = await issueToken(c.env.JWT_SECRET, c.env.JWT_EXPIRY, userId, email, 'admin', orgId, 0)
  c.header('Set-Cookie', setCookieHeader(token, expiry, c.env.ENVIRONMENT === 'production'))

  return c.json({ id: userId, email, fullName, role: 'admin', orgId })
})
