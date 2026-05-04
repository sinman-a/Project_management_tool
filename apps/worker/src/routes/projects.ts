import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'
import { recalculateProjectBudget } from '../services/budgetService'

const projectSchema = z.object({
  programId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  methodology: z.enum(['waterfall', 'agile', 'hybrid']).default('hybrid'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  budgetCapex: z.number().min(0).default(0),
  budgetOpex: z.number().min(0).default(0),
})

export const projectRoutes = new Hono<HonoContext>()

// Must be before /:id to avoid route conflict
projectRoutes.get('/portfolio/summary', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(`
    SELECT p.*,
      bs.spent_capex, bs.spent_opex,
      bs.committed_capex, bs.committed_opex,
      bs.eac_capex, bs.eac_opex,
      bs.burn_rate_capex, bs.burn_rate_opex,
      bs.snapshot_date as last_snapshot_date
    FROM projects p
    LEFT JOIN budget_snapshots bs ON bs.id = (
      SELECT id FROM budget_snapshots
      WHERE project_id = p.id
      ORDER BY snapshot_date DESC, rowid DESC
      LIMIT 1
    )
    WHERE p.org_id = ?
    ORDER BY p.created_at DESC
  `).bind(user.orgId).all()
  return c.json(results.map(toCamel))
})

projectRoutes.get('/', async (c) => {
  const user = c.get('user')
  let query: string
  let params: string[]

  if (user.role === 'admin') {
    query = 'SELECT * FROM projects WHERE org_id = ? ORDER BY created_at DESC'
    params = [user.orgId]
  } else if (user.role === 'program_manager') {
    query = `SELECT p.* FROM projects p
             JOIN programs pg ON pg.id = p.program_id
             WHERE p.org_id = ? AND pg.owner_id = ?
             ORDER BY p.created_at DESC`
    params = [user.orgId, user.sub]
  } else {
    query = 'SELECT * FROM projects WHERE org_id = ? AND manager_id = ? ORDER BY created_at DESC'
    params = [user.orgId, user.sub]
  }

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(results.map(toCamel))
})

projectRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ? AND org_id = ?')
    .bind(c.req.param('id'), user.orgId)
    .first()

  if (!project) return c.json({ message: 'Not found' }, 404)
  return c.json(toCamel(project))
})

projectRoutes.post('/', requireAny('admin', 'program_manager'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = projectSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const { programId, name, description, methodology, startDate, endDate, budgetCapex, budgetOpex } = parsed.data
  const id = crypto.randomUUID()

  await c.env.DB.prepare(`
    INSERT INTO projects (id, org_id, program_id, name, description, manager_id, methodology, status, start_date, end_date, budget_capex, budget_opex)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'planning', ?, ?, ?, ?)
  `)
    .bind(id, user.orgId, programId ?? null, name, description ?? null, user.sub, methodology, startDate, endDate ?? null, budgetCapex, budgetOpex)
    .run()

  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first()
  return c.json(toCamel(project!), 201)
})

projectRoutes.patch('/:id', requireAny('admin', 'program_manager', 'project_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId)
    .first<{ manager_id: string }>()

  if (!project) return c.json({ message: 'Not found' }, 404)
  if (user.role === 'project_manager' && project.manager_id !== user.sub) {
    return c.json({ message: 'Forbidden' }, 403)
  }

  const body = await c.req.json()
  const allowed = ['name', 'description', 'status', 'end_date', 'methodology']
  const budgetAllowed = ['budget_capex', 'budget_opex']
  const canEditBudget = user.role === 'admin' || user.role === 'program_manager'

  const updates = Object.entries(body)
    .filter(([k]) => {
      const snake = toSnake(k)
      return allowed.includes(snake) || (canEditBudget && budgetAllowed.includes(snake))
    })
    .map(([k, v]) => [toSnake(k), v])

  if (updates.length === 0) return c.json({ message: 'No valid fields' }, 400)

  const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE projects SET ${setClauses} WHERE id = ?`)
    .bind(...updates.map(([, v]) => v), id)
    .run()

  const updated = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first()
  return c.json(toCamel(updated!))
})

projectRoutes.delete('/:id', requireAny('admin', 'program_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const project = await c.env.DB.prepare('SELECT id FROM projects WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId).first()
  if (!project) return c.json({ message: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

projectRoutes.get('/:id/budget/history', async (c) => {
  const projectId = c.req.param('id')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM budget_snapshots WHERE project_id = ? ORDER BY snapshot_date ASC LIMIT 60',
  ).bind(projectId).all()
  return c.json(results.map(toCamel))
})

projectRoutes.post('/:id/budget/recalculate', requireAny('admin', 'program_manager', 'project_manager'), async (c) => {
  const projectId = c.req.param('id')
  try {
    const result = await recalculateProjectBudget(c.env.DB, c.env.KV_CACHE, projectId)
    return c.json(result)
  } catch (e) {
    return c.json({ message: e instanceof Error ? e.message : 'Recalculation failed' }, 500)
  }
})

projectRoutes.get('/:id/budget', async (c) => {
  const projectId = c.req.param('id')

  const cached = await c.env.KV_CACHE.get(`budget:project:${projectId}:latest`, 'json')
  if (cached) return c.json(cached)

  const snapshot = await c.env.DB.prepare(
    'SELECT * FROM budget_snapshots WHERE project_id = ? ORDER BY snapshot_date DESC LIMIT 1',
  )
    .bind(projectId)
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
