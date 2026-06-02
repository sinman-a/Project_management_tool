import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'
import { projectInOrg } from '../middleware/ownership'

/** Verify a task belongs to the caller's org (task → project → org). */
async function taskInOrg(db: D1Database, taskId: string, orgId: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.id = ? AND p.org_id = ?
  `).bind(taskId, orgId).first()
  return !!row
}

/** Verify a task dependency belongs to the caller's org (dep → task → project → org). */
async function depInOrg(db: D1Database, depId: string, orgId: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT 1 FROM task_dependencies td
    JOIN tasks t ON t.id = td.task_id
    JOIN projects p ON p.id = t.project_id
    WHERE td.id = ? AND p.org_id = ?
  `).bind(depId, orgId).first()
  return !!row
}

const taskSchema = z.object({
  projectId: z.string().uuid(),
  sprintId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional(),
  name: z.string().min(1).max(300),
  description: z.string().optional(),
  type: z.enum(['waterfall_phase', 'agile_story', 'agile_task', 'milestone', 'bug']).default('agile_task'),
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
  const user = c.get('user')
  const projectId = c.req.query('projectId')
  if (!projectId) return c.json({ message: 'projectId required' }, 400)
  if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)

  const { results } = await c.env.DB.prepare(
    `SELECT t.*, u.full_name as assignee_name
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.project_id = ?
     ORDER BY t.wbs_code ASC, t.created_at ASC`,
  ).bind(projectId).all()

  return c.json(results.map(toCamel))
})

taskRoutes.post('/', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = taskSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const {
    projectId, sprintId, parentTaskId, name, description, type,
    status, priority, assignedTo, storyPoints, estimatedHours,
    startDate, dueDate, costType, wbsCode,
  } = parsed.data
  if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)
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

  const task = await c.env.DB.prepare(`
    SELECT t.* FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.id = ? AND p.org_id = ?
  `).bind(id, user.orgId).first<{ assigned_to: string | null; project_id: string; estimated_hours: number; due_date: string | null }>()
  if (!task) return c.json({ message: 'Not found' }, 404)

  if (user.role === 'team_member' && task.assigned_to !== user.sub) {
    return c.json({ message: 'Forbidden' }, 403)
  }

  const body = await c.req.json()
  const allAllowed = ['name', 'description', 'status', 'priority', 'assigned_to', 'story_points',
    'estimated_hours', 'start_date', 'due_date', 'cost_type', 'wbs_code', 'sprint_id',
    'parent_task_id', 'project_id']
  const tmAllowed = ['status']

  const updates: [string, unknown][] = Object.entries(body)
    .filter(([k]) => {
      const snake = toSnake(k)
      return user.role === 'team_member' ? tmAllowed.includes(snake) : allAllowed.includes(snake)
    })
    .map(([k, v]) => [toSnake(k), v])

  if (updates.length === 0) return c.json({ message: 'No valid fields' }, 400)

  // When moving to a different project, verify the target project is in the caller's org,
  // then clear sprint and parent (they belong to the old project)
  const newProjectId = updates.find(([k]) => k === 'project_id')?.[1]
  if (newProjectId && newProjectId !== task.project_id) {
    if (typeof newProjectId !== 'string' || !(await projectInOrg(c.env.DB, newProjectId, user.orgId))) {
      return c.json({ message: 'Invalid target project' }, 400)
    }
    if (!updates.find(([k]) => k === 'sprint_id')) updates.push(['sprint_id', null])
    if (!updates.find(([k]) => k === 'parent_task_id')) updates.push(['parent_task_id', null])
  }

  const setClauses = [...updates.map(([k]) => `${k} = ?`), 'updated_at = CURRENT_TIMESTAMP'].join(', ')
  await c.env.DB.prepare(`UPDATE tasks SET ${setClauses} WHERE id = ?`)
    .bind(...updates.map(([, v]) => v), id).run()

  const updated = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first<Record<string, unknown>>()

  // Auto-reschedule FS successors when due_date changes
  const dateChanged = updates.some(([k]) => k === 'due_date')
  const cascade: Record<string, unknown>[] = []
  if (dateChanged && updated) {
    const newDueDate = updated.due_date as string | null
    if (newDueDate) {
      cascade.push(...await propagateReschedule(c.env.DB, id, newDueDate, task.project_id))
    }
  }

  return c.json({ updated: toCamel(updated!), cascade: cascade.map(toCamel) })
})

taskRoutes.delete('/:id', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  if (!(await taskInOrg(c.env.DB, id, user.orgId))) return c.json({ message: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

taskRoutes.get('/:id/dependencies', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  if (!(await taskInOrg(c.env.DB, id, user.orgId))) return c.json({ message: 'Not found' }, 404)
  const { results } = await c.env.DB.prepare(
    `SELECT td.*, t.name as depends_on_name
     FROM task_dependencies td
     JOIN tasks t ON t.id = td.depends_on_id
     WHERE td.task_id = ?`,
  ).bind(id).all()
  return c.json(results.map(toCamel))
})

taskRoutes.post('/:id/dependencies', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const taskId = c.req.param('id')
  const body = await c.req.json()
  const parsed = depSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  if (taskId === parsed.data.dependsOnId) return c.json({ message: 'Task cannot depend on itself' }, 400)

  // Both the task and its predecessor must belong to the caller's org
  if (!(await taskInOrg(c.env.DB, taskId, user.orgId))) return c.json({ message: 'Not found' }, 404)
  if (!(await taskInOrg(c.env.DB, parsed.data.dependsOnId, user.orgId))) return c.json({ message: 'Invalid dependency' }, 400)

  const id = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO task_dependencies (id, task_id, depends_on_id, dependency_type, lag_days, cross_project)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, taskId, parsed.data.dependsOnId, parsed.data.dependencyType, parsed.data.lagDays, parsed.data.crossProject ? 1 : 0).run()

  return c.json({ id, taskId, ...parsed.data }, 201)
})

taskRoutes.patch('/:id/dependencies/:depId', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const depId = c.req.param('depId')
  if (!(await depInOrg(c.env.DB, depId, user.orgId))) return c.json({ message: 'Not found' }, 404)
  const body = await c.req.json()
  const schema = z.object({
    dependencyType: z.enum(['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish']).optional(),
    lagDays: z.number().int().min(-30).max(60).optional(),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  const updates: [string, unknown][] = []
  if (parsed.data.dependencyType !== undefined) updates.push(['dependency_type', parsed.data.dependencyType])
  if (parsed.data.lagDays !== undefined) updates.push(['lag_days', parsed.data.lagDays])
  if (updates.length === 0) return c.json({ message: 'No valid fields' }, 400)

  const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE task_dependencies SET ${setClauses} WHERE id = ?`)
    .bind(...updates.map(([, v]) => v), depId).run()

  const dep = await c.env.DB.prepare('SELECT * FROM task_dependencies WHERE id = ?').bind(depId).first()
  return c.json(toCamel(dep!))
})

taskRoutes.delete('/:id/dependencies/:depId', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const depId = c.req.param('depId')
  if (!(await depInOrg(c.env.DB, depId, user.orgId))) return c.json({ message: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM task_dependencies WHERE id = ?').bind(depId).run()
  return c.json({ success: true })
})

// BFS reschedule: propagate new due_date forward through FS successors
async function propagateReschedule(
  db: D1Database,
  changedTaskId: string,
  newDueDate: string,
  projectId: string,
): Promise<Record<string, unknown>[]> {
  const HOURS_PER_DAY = 8
  const updated: Record<string, unknown>[] = []
  const visited = new Set<string>()
  const queue: Array<{ predId: string; predDueDate: string }> = [{ predId: changedTaskId, predDueDate: newDueDate }]

  while (queue.length > 0) {
    const { predId, predDueDate } = queue.shift()!

    const { results: successors } = await db.prepare(`
      SELECT td.task_id, td.lag_days, t.estimated_hours, t.start_date, t.due_date, t.status
      FROM task_dependencies td
      JOIN tasks t ON t.id = td.task_id
      WHERE td.depends_on_id = ? AND td.dependency_type = 'finish_to_start'
        AND t.project_id = ? AND t.status NOT IN ('done','cancelled')
    `).bind(predId, projectId).all<{
      task_id: string; lag_days: number; estimated_hours: number
      start_date: string | null; due_date: string | null; status: string
    }>()

    for (const s of successors) {
      if (visited.has(s.task_id)) continue
      visited.add(s.task_id)

      // new start = predDueDate + lagDays + 1
      const predDt = new Date(predDueDate)
      predDt.setDate(predDt.getDate() + s.lag_days + 1)
      const newStart = predDt.toISOString().slice(0, 10)

      const currentStart = s.start_date
      if (currentStart && newStart <= currentStart) continue // no change needed

      const durationDays = Math.max(Math.ceil(s.estimated_hours / HOURS_PER_DAY), 1)
      const endDt = new Date(newStart)
      endDt.setDate(endDt.getDate() + durationDays - 1)
      const newEnd = endDt.toISOString().slice(0, 10)

      await db.prepare(
        `UPDATE tasks SET start_date = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ).bind(newStart, newEnd, s.task_id).run()

      const row = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(s.task_id).first<Record<string, unknown>>()
      if (row) updated.push(row)

      queue.push({ predId: s.task_id, predDueDate: newEnd })
    }
  }
  return updated
}

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}

function toSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}
