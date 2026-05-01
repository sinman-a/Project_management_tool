import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'

const resourceSchema = z.object({
  userId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  type: z.enum(['human', 'equipment']),
  costType: z.enum(['capex', 'opex']),
  rate: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  capacityHoursPerWeek: z.number().min(0).max(168).default(40),
})

export const resourceRoutes = new Hono<HonoContext>()

resourceRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM resources WHERE org_id = ? ORDER BY name ASC',
  )
    .bind(user.orgId)
    .all()

  return c.json(results.map(toCamel))
})

resourceRoutes.post('/', requireAny('admin'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = resourceSchema.safeParse(body)

  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const { userId, name, type, costType, rate, currency, capacityHoursPerWeek } = parsed.data
  const id = crypto.randomUUID()

  await c.env.DB.prepare(`
    INSERT INTO resources (id, org_id, user_id, name, type, cost_type, rate, currency, capacity_hours_per_week)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(id, user.orgId, userId ?? null, name, type, costType, rate, currency, capacityHoursPerWeek)
    .run()

  const resource = await c.env.DB.prepare('SELECT * FROM resources WHERE id = ?').bind(id).first()
  return c.json(toCamel(resource!), 201)
})

resourceRoutes.patch('/:id', requireAny('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const resource = await c.env.DB.prepare('SELECT id FROM resources WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId)
    .first()

  if (!resource) return c.json({ message: 'Not found' }, 404)

  const body = await c.req.json()
  const allowed = ['name', 'type', 'cost_type', 'rate', 'currency', 'capacity_hours_per_week']
  const updates = Object.entries(body)
    .filter(([k]) => allowed.includes(toSnake(k)))
    .map(([k, v]) => [toSnake(k), v])

  if (updates.length === 0) return c.json({ message: 'No valid fields' }, 400)

  const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE resources SET ${setClauses} WHERE id = ?`)
    .bind(...updates.map(([, v]) => v), id)
    .run()

  const updated = await c.env.DB.prepare('SELECT * FROM resources WHERE id = ?').bind(id).first()
  return c.json(toCamel(updated!))
})

resourceRoutes.get('/heatmap', async (c) => {
  const user = c.get('user')
  const weeksBack = parseInt(c.req.query('weeksBack') ?? '8')
  const weeksForward = parseInt(c.req.query('weeksForward') ?? '4')

  const today = new Date()
  const monday = new Date(today)
  const day = monday.getDay()
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)

  const startDate = new Date(monday)
  startDate.setDate(startDate.getDate() - weeksBack * 7)
  const endDate = new Date(monday)
  endDate.setDate(endDate.getDate() + weeksForward * 7)

  const { results } = await c.env.DB.prepare(`
    SELECT ra.resource_id, ra.week_start, ra.allocated_hours,
           r.name as resource_name, r.capacity_hours_per_week, r.type
    FROM resource_allocations ra
    JOIN resources r ON r.id = ra.resource_id
    WHERE r.org_id = ? AND ra.week_start >= ? AND ra.week_start < ?
    ORDER BY r.name ASC, ra.week_start ASC
  `).bind(user.orgId, startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)).all()

  return c.json(results.map(toCamel))
})

resourceRoutes.get('/allocations', async (c) => {
  const user = c.get('user')
  const weekStart = c.req.query('weekStart')

  if (!weekStart) return c.json({ message: 'weekStart required' }, 400)

  const { results } = await c.env.DB.prepare(`
    SELECT ra.*, r.name as resource_name, r.capacity_hours_per_week
    FROM resource_allocations ra
    JOIN resources r ON r.id = ra.resource_id
    WHERE r.org_id = ? AND ra.week_start = ?
    ORDER BY r.name ASC
  `)
    .bind(user.orgId, weekStart)
    .all()

  return c.json(results.map(toCamel))
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}

function toSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}
