import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'

const sprintSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200),
  goal: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['planned', 'active', 'completed']).default('planned'),
  velocity: z.number().int().optional(),
})

export const sprintRoutes = new Hono<HonoContext>()

sprintRoutes.get('/', async (c) => {
  const projectId = c.req.query('projectId')
  if (!projectId) return c.json({ message: 'projectId required' }, 400)

  const { results } = await c.env.DB.prepare(
    `SELECT s.*, COUNT(t.id) as task_count
     FROM sprints s
     LEFT JOIN tasks t ON t.sprint_id = s.id
     WHERE s.project_id = ?
     GROUP BY s.id
     ORDER BY s.start_date ASC`,
  ).bind(projectId).all()

  return c.json(results.map(toCamel))
})

sprintRoutes.post('/', requireAny('admin', 'program_manager', 'project_manager'), async (c) => {
  const body = await c.req.json()
  const parsed = sprintSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const { projectId, name, goal, startDate, endDate, status, velocity } = parsed.data
  const id = crypto.randomUUID()

  await c.env.DB.prepare(`
    INSERT INTO sprints (id, project_id, name, goal, start_date, end_date, status, velocity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, projectId, name, goal ?? null, startDate, endDate, status, velocity ?? null).run()

  const sprint = await c.env.DB.prepare('SELECT * FROM sprints WHERE id = ?').bind(id).first()
  return c.json(toCamel(sprint!), 201)
})

sprintRoutes.patch('/:id', requireAny('admin', 'program_manager', 'project_manager'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const allowed = ['name', 'goal', 'start_date', 'end_date', 'status', 'velocity']

  const updates = Object.entries(body)
    .filter(([k]) => allowed.includes(toSnake(k)))
    .map(([k, v]) => [toSnake(k), v])

  if (updates.length === 0) return c.json({ message: 'No valid fields' }, 400)

  const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE sprints SET ${setClauses} WHERE id = ?`)
    .bind(...updates.map(([, v]) => v), id).run()

  const updated = await c.env.DB.prepare('SELECT * FROM sprints WHERE id = ?').bind(id).first()
  return c.json(toCamel(updated!))
})

sprintRoutes.delete('/:id', requireAny('admin', 'program_manager', 'project_manager'), async (c) => {
  await c.env.DB.prepare('DELETE FROM sprints WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}

function toSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}
