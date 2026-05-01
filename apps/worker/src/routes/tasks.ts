import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'

const taskSchema = z.object({
  projectId: z.string().uuid(),
  sprintId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional(),
  name: z.string().min(1).max(300),
  description: z.string().optional(),
  type: z.enum(['waterfall_phase', 'agile_story', 'agile_task', 'milestone']).default('agile_task'),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled']).default('backlog'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  assignedTo: z.string().uuid().optional(),
  storyPoints: z.number().int().min(0).optional(),
  estimatedHours: z.number().min(0).default(0),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  costType: z.enum(['capex', 'opex']).default('opex'),
  wbsCode: z.string().optional(),
})

const depSchema = z.object({
  dependsOnId: z.string().uuid(),
  dependencyType: z.enum(['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish']).default('finish_to_start'),
  lagDays: z.number().int().default(0),
  crossProject: z.boolean().default(false),
})

export const taskRoutes = new Hono<HonoContext>()

taskRoutes.get('/assigned', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(`
    SELECT t.*, p.name as project_name
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.assigned_to = ? AND t.status NOT IN ('done', 'cancelled')
    ORDER BY p.name ASC, t.due_date ASC
  `).bind(user.sub).all()
  return c.json(results.map(toCamel))
})

taskRoutes.get('/', async (c) => {
  const projectId = c.req.query('projectId')
  if (!projectId) return c.json({ message: 'projectId required' }, 400)

  const { results } = await c.env.DB.prepare(
    `SELECT t.*, u.full_name as assignee_name
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.project_id = ?
     ORDER BY t.wbs_code ASC, t.created_at ASC`,
  ).bind(projectId).all()

  return c.json(results.map(toCamel))
})

taskRoutes.post('/', requireAny('admin', 'program_manager', 'project_manager'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = taskSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const {
    projectId, sprintId, parentTaskId, name, description, type,
    status, priority, assignedTo, storyPoints, estimatedHours,
    startDate, dueDate, costType, wbsCode,
  } = parsed.data
  const id = crypto.randomUUID()

  await c.env.DB.prepare(`
    INSERT INTO tasks
      (id, project_id, sprint_id, parent_task_id, name, description, type, status,
       priority, assigned_to, story_points, estimated_hours, start_date, due_date,
       cost_type, wbs_code, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, projectId, sprintId ?? null, parentTaskId ?? null, name, description ?? null,
    type, status, priority, assignedTo ?? null, storyPoints ?? null, estimatedHours,
    startDate ?? null, dueDate ?? null, costType, wbsCode ?? null, user.sub,
  ).run()

  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first()
  return c.json(toCamel(task!), 201)
})

taskRoutes.patch('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?')
    .bind(id).first<{ assigned_to: string | null }>()
  if (!task) return c.json({ message: 'Not found' }, 404)

  if (user.role === 'team_member' && task.assigned_to !== user.sub) {
    return c.json({ message: 'Forbidden' }, 403)
  }

  const body = await c.req.json()
  const allAllowed = ['name', 'description', 'status', 'priority', 'assigned_to', 'story_points',
    'estimated_hours', 'start_date', 'due_date', 'cost_type', 'wbs_code', 'sprint_id', 'parent_task_id']
  const tmAllowed = ['status']

  const updates = Object.entries(body)
    .filter(([k]) => {
      const snake = toSnake(k)
      return user.role === 'team_member' ? tmAllowed.includes(snake) : allAllowed.includes(snake)
    })
    .map(([k, v]) => [toSnake(k), v])

  if (updates.length === 0) return c.json({ message: 'No valid fields' }, 400)

  const setClauses = [...updates.map(([k]) => `${k} = ?`), 'updated_at = CURRENT_TIMESTAMP'].join(', ')
  await c.env.DB.prepare(`UPDATE tasks SET ${setClauses} WHERE id = ?`)
    .bind(...updates.map(([, v]) => v), id).run()

  const updated = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first()
  return c.json(toCamel(updated!))
})

taskRoutes.delete('/:id', requireAny('admin', 'program_manager', 'project_manager'), async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

taskRoutes.get('/:id/dependencies', async (c) => {
  const id = c.req.param('id')
  const { results } = await c.env.DB.prepare(
    `SELECT td.*, t.name as depends_on_name
     FROM task_dependencies td
     JOIN tasks t ON t.id = td.depends_on_id
     WHERE td.task_id = ?`,
  ).bind(id).all()
  return c.json(results.map(toCamel))
})

taskRoutes.post('/:id/dependencies', requireAny('admin', 'program_manager', 'project_manager'), async (c) => {
  const taskId = c.req.param('id')
  const body = await c.req.json()
  const parsed = depSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  if (taskId === parsed.data.dependsOnId) return c.json({ message: 'Task cannot depend on itself' }, 400)

  const id = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO task_dependencies (id, task_id, depends_on_id, dependency_type, lag_days, cross_project)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, taskId, parsed.data.dependsOnId, parsed.data.dependencyType, parsed.data.lagDays, parsed.data.crossProject ? 1 : 0).run()

  return c.json({ id, taskId, ...parsed.data }, 201)
})

taskRoutes.delete('/:id/dependencies/:depId', requireAny('admin', 'program_manager', 'project_manager'), async (c) => {
  await c.env.DB.prepare('DELETE FROM task_dependencies WHERE id = ?').bind(c.req.param('depId')).run()
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
