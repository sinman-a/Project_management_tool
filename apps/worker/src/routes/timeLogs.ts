import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'

const createTimeLogSchema = z.object({
  taskId: z.string().uuid(),
  resourceId: z.string().uuid(),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().positive().max(24),
  description: z.string().max(500).optional(),
  isBillable: z.boolean().default(true),
})

export const timeLogRoutes = new Hono<HonoContext>()

timeLogRoutes.get('/mine', async (c) => {
  const user = c.get('user')
  const resource = await c.env.DB.prepare('SELECT id FROM resources WHERE user_id = ?')
    .bind(user.sub)
    .first<{ id: string }>()

  if (!resource) return c.json([])

  const { results } = await c.env.DB.prepare(
    `SELECT tl.*, t.name as task_name, t.project_id
     FROM time_logs tl
     JOIN tasks t ON t.id = tl.task_id
     WHERE tl.resource_id = ?
     ORDER BY tl.log_date DESC
     LIMIT 100`,
  )
    .bind(resource.id)
    .all()

  return c.json(results.map(toCamel))
})

timeLogRoutes.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = createTimeLogSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)
  }

  const { taskId, resourceId, logDate, hours, description, isBillable } = parsed.data

  const task = await c.env.DB.prepare('SELECT id, cost_type, project_id FROM tasks WHERE id = ?')
    .bind(taskId)
    .first<{ id: string; cost_type: string; project_id: string }>()

  if (!task) return c.json({ message: 'Task not found' }, 404)

  const resource = await c.env.DB.prepare('SELECT id, rate FROM resources WHERE id = ?')
    .bind(resourceId)
    .first<{ id: string; rate: number }>()

  if (!resource) return c.json({ message: 'Resource not found' }, 404)

  const id = crypto.randomUUID()
  const unitRate = resource.rate
  const costType = task.cost_type

  const logDate_d = new Date(logDate)
  const dayOfWeek = logDate_d.getDay()
  const diff = logDate_d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
  logDate_d.setDate(diff)
  const weekStart = logDate_d.toISOString().slice(0, 10)

  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO time_logs (id, task_id, resource_id, logged_by, log_date, hours, description, cost_type, unit_rate, computed_cost, is_billable)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, taskId, resourceId, user.sub, logDate, hours, description ?? null, costType, unitRate, hours * unitRate, isBillable ? 1 : 0),

    c.env.DB.prepare(`
      INSERT INTO resource_allocations (id, resource_id, project_id, week_start, allocated_hours)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (resource_id, project_id, week_start)
      DO UPDATE SET allocated_hours = (
        SELECT COALESCE(SUM(hours), 0) FROM time_logs
        WHERE resource_id = excluded.resource_id
          AND task_id IN (SELECT id FROM tasks WHERE project_id = excluded.project_id)
          AND log_date >= excluded.week_start
          AND log_date < date(excluded.week_start, '+7 days')
      ) + excluded.allocated_hours
    `).bind(crypto.randomUUID(), resourceId, task.project_id, weekStart, hours),
  ])

  const timeLog = await c.env.DB.prepare('SELECT * FROM time_logs WHERE id = ?').bind(id).first()
  return c.json(toCamel(timeLog!), 201)
})

timeLogRoutes.get('/week', async (c) => {
  const user = c.get('user')
  const weekStart = c.req.query('weekStart')
  if (!weekStart) return c.json({ message: 'weekStart required' }, 400)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)

  const { results } = await c.env.DB.prepare(`
    SELECT tl.*, t.name as task_name, t.project_id, p.name as project_name
    FROM time_logs tl
    JOIN tasks t ON t.id = tl.task_id
    JOIN projects p ON p.id = t.project_id
    JOIN resources r ON r.id = tl.resource_id
    WHERE r.user_id = ? AND tl.log_date >= ? AND tl.log_date < ?
    ORDER BY tl.log_date ASC
  `).bind(user.sub, weekStart, weekEndStr).all()

  return c.json(results.map(toCamel))
})

timeLogRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const log = await c.env.DB.prepare(
    'SELECT id, logged_by, approved_at FROM time_logs WHERE id = ?',
  ).bind(id).first<{ id: string; logged_by: string; approved_at: string | null }>()

  if (!log) return c.json({ message: 'Not found' }, 404)
  if (log.logged_by !== user.sub && user.role !== 'admin') return c.json({ message: 'Forbidden' }, 403)
  if (log.approved_at) return c.json({ message: 'Cannot delete an approved log' }, 409)

  await c.env.DB.prepare('DELETE FROM time_logs WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

timeLogRoutes.post('/:id/approve', requireAny('admin', 'project_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const now = new Date().toISOString()

  const result = await c.env.DB.prepare(
    'UPDATE time_logs SET approved_by = ?, approved_at = ? WHERE id = ? AND approved_at IS NULL',
  )
    .bind(user.sub, now, id)
    .run()

  if (result.meta.changes === 0) {
    return c.json({ message: 'Not found or already approved' }, 404)
  }

  await c.env.KV_CACHE.delete(`budget:project:${id}:latest`)

  const timeLog = await c.env.DB.prepare('SELECT * FROM time_logs WHERE id = ?').bind(id).first()
  return c.json(toCamel(timeLog!))
})

timeLogRoutes.get('/project/:projectId', requireAny('admin', 'program_manager', 'project_manager'), async (c) => {
  const projectId = c.req.param('projectId')
  const approved = c.req.query('approved')

  let query = `SELECT tl.*, t.name as task_name, r.name as resource_name
               FROM time_logs tl
               JOIN tasks t ON t.id = tl.task_id
               JOIN resources r ON r.id = tl.resource_id
               WHERE t.project_id = ?`

  if (approved === 'false') {
    query += ' AND tl.approved_at IS NULL'
  } else if (approved === 'true') {
    query += ' AND tl.approved_at IS NOT NULL'
  }

  query += ' ORDER BY tl.log_date DESC LIMIT 200'

  const { results } = await c.env.DB.prepare(query).bind(projectId).all()
  return c.json(results.map(toCamel))
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}
