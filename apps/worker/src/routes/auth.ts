import { Hono } from 'hono'
import { SignJWT } from 'jose'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { authMiddleware } from '../middleware/auth'
import { hashPassword, verifyPassword } from '../utils/password'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

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
): Promise<string> {
  const secret = new TextEncoder().encode(jwtSecret)
  const expiry = parseInt(jwtExpiry, 10)
  return new SignJWT({ sub: userId, email, role, orgId })
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

// ── Brute-force rate limiting (KV-backed) ────────────────────────────────────
const MAX_ATTEMPTS = 10
const WINDOW_SECONDS = 15 * 60

function clientIp(c: { req: { header: (k: string) => string | undefined } }): string {
  return c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown'
}

/** Returns true if the caller is over the attempt limit. */
async function isRateLimited(kv: KVNamespace, key: string): Promise<boolean> {
  const raw = await kv.get(key)
  return raw !== null && parseInt(raw, 10) >= MAX_ATTEMPTS
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

  const { email, password } = parsed.data
  const user = await c.env.DB.prepare(
    'SELECT id, email, full_name, role, org_id, password_hash FROM users WHERE email = ? AND is_active = 1',
  )
    .bind(email)
    .first<{ id: string; email: string; full_name: string; role: string; org_id: string; password_hash: string }>()

  if (!user) {
    await recordFailure(c.env.KV_CACHE, rlKey)
    return c.json({ message: 'Invalid email or password' }, 401)
  }

  if (user.password_hash === 'CHANGE_ME_BEFORE_DEPLOY') {
    return c.json({ message: 'SETUP_REQUIRED' }, 403)
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    await recordFailure(c.env.KV_CACHE, rlKey)
    return c.json({ message: 'Invalid email or password' }, 401)
  }

  // Successful login — clear the attempt counter
  await clearFailures(c.env.KV_CACHE, rlKey)

  const expiry = parseInt(c.env.JWT_EXPIRY, 10)
  const token = await issueToken(c.env.JWT_SECRET, c.env.JWT_EXPIRY, user.id, user.email, user.role, user.org_id)

  c.header('Set-Cookie', setCookieHeader(token, expiry, c.env.ENVIRONMENT === 'production'))

  return c.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    orgId: user.org_id,
  })
})

authRoutes.post('/logout', (c) => {
  const isProduction = c.env.ENVIRONMENT === 'production'
  const sameSite = isProduction ? 'SameSite=None; Secure;' : 'SameSite=Lax;'
  c.header('Set-Cookie', `ppm_token=; HttpOnly; ${sameSite} Path=/; Max-Age=0`)
  return c.json({ ok: true })
})

authRoutes.get('/me', authMiddleware, async (c) => {
  const jwt = c.get('user')
  const user = await c.env.DB.prepare(
    'SELECT id, email, full_name, role, org_id FROM users WHERE id = ? AND is_active = 1',
  )
    .bind(jwt.sub)
    .first<{ id: string; email: string; full_name: string; role: string; org_id: string }>()

  if (!user) return c.json({ message: 'User not found' }, 404)

  return c.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    orgId: user.org_id,
  })
})

// First-run setup — works only when no real account exists yet
authRoutes.post('/setup', async (c) => {
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
  const token = await issueToken(c.env.JWT_SECRET, c.env.JWT_EXPIRY, admin.id, email, 'admin', admin.org_id)
  c.header('Set-Cookie', setCookieHeader(token, expiry, c.env.ENVIRONMENT === 'production'))

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
  const token = await issueToken(c.env.JWT_SECRET, c.env.JWT_EXPIRY, userId, email, 'admin', orgId)
  c.header('Set-Cookie', setCookieHeader(token, expiry, c.env.ENVIRONMENT === 'production'))

  return c.json({ id: userId, email, fullName, role: 'admin', orgId })
})
