import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'

const driverSchema = z.object({
  name: z.string().min(1).max(120),
  weight: z.number().min(0).max(1000),
  isActive: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
})

export const strategicDriverRoutes = new Hono<HonoContext>()

strategicDriverRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM strategic_drivers WHERE org_id = ? ORDER BY position ASC, created_at ASC',
  ).bind(user.orgId).all()
  return c.json(results.map(toCamel))
})

strategicDriverRoutes.post('/', requireAny('admin', 'pmo_lead', 'program_manager'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = driverSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  let position = parsed.data.position
  if (position === undefined) {
    const maxRow = await c.env.DB.prepare(
      'SELECT COALESCE(MAX(position),0) as m FROM strategic_drivers WHERE org_id = ?',
    ).bind(user.orgId).first<{ m: number }>()
    position = (maxRow?.m ?? 0) + 1
  }

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO strategic_drivers (id, org_id, name, weight, is_active, position) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(id, user.orgId, parsed.data.name, parsed.data.weight, parsed.data.isActive === false ? 0 : 1, position).run()

  const row = await c.env.DB.prepare('SELECT * FROM strategic_drivers WHERE id = ?').bind(id).first()
  return c.json(toCamel(row!), 201)
})

strategicDriverRoutes.patch('/:id', requireAny('admin', 'pmo_lead', 'program_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const exists = await c.env.DB.prepare('SELECT 1 FROM strategic_drivers WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId).first()
  if (!exists) return c.json({ message: 'Not found' }, 404)

  const body = await c.req.json()
  const parsed = driverSchema.partial().safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  const updates: [string, unknown][] = []
  if (parsed.data.name !== undefined) updates.push(['name', parsed.data.name])
  if (parsed.data.weight !== undefined) updates.push(['weight', parsed.data.weight])
  if (parsed.data.isActive !== undefined) updates.push(['is_active', parsed.data.isActive ? 1 : 0])
  if (parsed.data.position !== undefined) updates.push(['position', parsed.data.position])

  if (updates.length === 0) return c.json({ message: 'No fields' }, 400)
  const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE strategic_drivers SET ${setClauses} WHERE id = ? AND org_id = ?`)
    .bind(...updates.map(([, v]) => v), id, user.orgId).run()

  const row = await c.env.DB.prepare('SELECT * FROM strategic_drivers WHERE id = ?').bind(id).first()
  return c.json(toCamel(row!))
})

strategicDriverRoutes.delete('/:id', requireAny('admin', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const exists = await c.env.DB.prepare('SELECT 1 FROM strategic_drivers WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId).first()
  if (!exists) return c.json({ message: 'Not found' }, 404)
  // idea_driver_scores cascade via FK
  await c.env.DB.prepare('DELETE FROM strategic_drivers WHERE id = ? AND org_id = ?').bind(id, user.orgId).run()
  return c.json({ success: true })
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()), v]),
  )
}
