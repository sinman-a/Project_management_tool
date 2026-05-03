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

authRoutes.post('/login', async (c) => {
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
    return c.json({ message: 'Invalid email or password' }, 401)
  }

  if (user.password_hash === 'CHANGE_ME_BEFORE_DEPLOY') {
    return c.json({ message: 'SETUP_REQUIRED' }, 403)
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    return c.json({ message: 'Invalid email or password' }, 401)
  }

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

// First-run setup — works only when admin has placeholder password
authRoutes.post('/setup', async (c) => {
  const admin = await c.env.DB.prepare(
    "SELECT id, org_id, password_hash FROM users WHERE role = 'admin' LIMIT 1",
  ).first<{ id: string; org_id: string; password_hash: string }>()

  if (!admin || admin.password_hash !== 'CHANGE_ME_BEFORE_DEPLOY') {
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
