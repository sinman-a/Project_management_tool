import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'

const programSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  budgetCapex: z.number().min(0).default(0),
  budgetOpex: z.number().min(0).default(0),
})

export const programRoutes = new Hono<HonoContext>()

programRoutes.get('/', async (c) => {
  const user = c.get('user')
  let query: string
  let params: string[]

  if (user.role === 'admin') {
    query = 'SELECT * FROM programs WHERE org_id = ? ORDER BY created_at DESC'
    params = [user.orgId]
  } else {
    query = 'SELECT * FROM programs WHERE org_id = ? AND owner_id = ? ORDER BY created_at DESC'
    params = [user.orgId, user.sub]
  }

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(results.map(toCamel))
})

programRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  const program = await c.env.DB.prepare(
    'SELECT * FROM programs WHERE id = ? AND org_id = ?',
  )
    .bind(c.req.param('id'), user.orgId)
    .first()

  if (!program) return c.json({ message: 'Not found' }, 404)
  return c.json(toCamel(program))
})

programRoutes.post('/', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = programSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const { name, description, startDate, endDate, budgetCapex, budgetOpex } = parsed.data
  const id = crypto.randomUUID()

  await c.env.DB.prepare(`
    INSERT INTO programs (id, org_id, name, description, owner_id, status, start_date, end_date, budget_capex, budget_opex)
    VALUES (?, ?, ?, ?, ?, 'planning', ?, ?, ?, ?)
  `)
    .bind(id, user.orgId, name, description ?? null, user.sub, startDate, endDate ?? null, budgetCapex, budgetOpex)
    .run()

  const program = await c.env.DB.prepare('SELECT * FROM programs WHERE id = ?').bind(id).first()
  return c.json(toCamel(program!), 201)
})

programRoutes.patch('/:id', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const program = await c.env.DB.prepare('SELECT * FROM programs WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId)
    .first<{ owner_id: string }>()

  if (!program) return c.json({ message: 'Not found' }, 404)
  if (user.role !== 'admin' && program.owner_id !== user.sub) {
    return c.json({ message: 'Forbidden' }, 403)
  }

  const body = await c.req.json()
  const allowed = ['name', 'description', 'status', 'end_date', 'budget_capex', 'budget_opex']
  const updates = Object.entries(body)
    .filter(([k]) => allowed.includes(toSnake(k)))
    .map(([k, v]) => [toSnake(k), v])

  if (updates.length === 0) return c.json({ message: 'No valid fields' }, 400)

  const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
  const values = updates.map(([, v]) => v)

  await c.env.DB.prepare(`UPDATE programs SET ${setClauses} WHERE id = ?`)
    .bind(...values, id)
    .run()

  const updated = await c.env.DB.prepare('SELECT * FROM programs WHERE id = ?').bind(id).first()
  return c.json(toCamel(updated!))
})

programRoutes.delete('/:id', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const program = await c.env.DB.prepare('SELECT id, owner_id FROM programs WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId).first<{ id: string; owner_id: string }>()
  if (!program) return c.json({ message: 'Not found' }, 404)
  if (user.role !== 'admin' && program.owner_id !== user.sub) return c.json({ message: 'Forbidden' }, 403)
  await c.env.DB.prepare('DELETE FROM programs WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

programRoutes.get('/:id/projects', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM projects WHERE program_id = ? AND org_id = ? ORDER BY created_at DESC',
  )
    .bind(id, user.orgId)
    .all()

  return c.json(results.map(toCamel))
})

programRoutes.get('/:id/budget', async (c) => {
  const id = c.req.param('id')

  const cached = await c.env.KV_CACHE.get(`budget:program:${id}:latest`, 'json')
  if (cached) return c.json(cached)

  const snapshot = await c.env.DB.prepare(
    'SELECT * FROM budget_snapshots WHERE program_id = ? ORDER BY snapshot_date DESC LIMIT 1',
  )
    .bind(id)
    .first()

  if (!snapshot) return c.json({ message: 'No snapshot yet' }, 404)
  return c.json(toCamel(snapshot))
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}

function toSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}
