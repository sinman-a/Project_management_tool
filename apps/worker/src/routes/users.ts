import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'
import { hashPassword } from '../utils/password'

const ROLES = ['admin', 'program_manager', 'pmo_lead', 'project_manager', 'team_member', 'sponsor', 'viewer'] as const

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(100),
  role: z.enum(ROLES),
  password: z.string().min(8),
})

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
})

export const userRoutes = new Hono<HonoContext>()

userRoutes.get('/', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT id, email, full_name, role, is_active, created_at FROM users WHERE org_id = ? ORDER BY full_name ASC',
  )
    .bind(user.orgId)
    .all()

  return c.json(results.map(toCamel))
})

userRoutes.get('/:id', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const caller = c.get('user')
  const { id } = c.req.param()

  const user = await c.env.DB.prepare(
    'SELECT id, email, full_name, role, is_active, created_at FROM users WHERE id = ? AND org_id = ?',
  )
    .bind(id, caller.orgId)
    .first()

  if (!user) return c.json({ message: 'Not found' }, 404)
  return c.json(toCamel(user))
})

userRoutes.post('/', requireAny('admin'), async (c) => {
  const caller = c.get('user')
  const body = await c.req.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)
  }

  const { email, fullName, role, password } = parsed.data

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) return c.json({ message: 'Email already in use' }, 409)

  const passwordHash = await hashPassword(password)
  const id = crypto.randomUUID()

  await c.env.DB.prepare(
    'INSERT INTO users (id, org_id, email, full_name, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(id, caller.orgId, email, fullName, role, passwordHash)
    .run()

  const user = await c.env.DB.prepare(
    'SELECT id, email, full_name, role, is_active, created_at FROM users WHERE id = ?',
  )
    .bind(id)
    .first()

  return c.json(toCamel(user!), 201)
})

userRoutes.patch('/:id', requireAny('admin'), async (c) => {
  const caller = c.get('user')
  const { id } = c.req.param()

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ? AND org_id = ?')
    .bind(id, caller.orgId)
    .first()
  if (!user) return c.json({ message: 'Not found' }, 404)

  const body = await c.req.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)
  }

  const updates: [string, unknown][] = []
  if (parsed.data.fullName !== undefined) updates.push(['full_name', parsed.data.fullName])
  if (parsed.data.role !== undefined) updates.push(['role', parsed.data.role])
  if (parsed.data.isActive !== undefined) updates.push(['is_active', parsed.data.isActive ? 1 : 0])
  if (parsed.data.password !== undefined) {
    updates.push(['password_hash', await hashPassword(parsed.data.password)])
  }

  if (updates.length === 0) return c.json({ message: 'No valid fields' }, 400)

  const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`)
    .bind(...updates.map(([, v]) => v), id)
    .run()

  const updated = await c.env.DB.prepare(
    'SELECT id, email, full_name, role, is_active, created_at FROM users WHERE id = ?',
  )
    .bind(id)
    .first()

  return c.json(toCamel(updated!))
})

// Allow any authenticated user to change their own password
userRoutes.post('/me/change-password', async (c) => {
  const caller = c.get('user')
  const body = await c.req.json()
  const schema = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  const user = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(caller.sub)
    .first<{ password_hash: string }>()

  if (!user) return c.json({ message: 'Not found' }, 404)

  const { verifyPassword } = await import('../utils/password')
  const valid = await verifyPassword(parsed.data.currentPassword, user.password_hash)
  if (!valid) return c.json({ message: 'Current password incorrect' }, 401)

  const newHash = await hashPassword(parsed.data.newPassword)
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(newHash, caller.sub)
    .run()

  return c.json({ ok: true })
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()), v]),
  )
}
