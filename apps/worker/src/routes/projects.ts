import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'
import { recalculateProjectBudget } from '../services/budgetService'
import { computeCPM, CycleError } from '../services/cpmService'
import { suggestRAGs } from '../services/suggestionService'
import { canAccessProject, canManageProject } from '../middleware/ownership'

const projectSchema = z.object({
  programId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  methodology: z.enum(['waterfall', 'agile', 'hybrid']).default('hybrid'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  budgetCapex: z.number().min(0).default(0),
  budgetOpex: z.number().min(0).default(0),
  expectedBenefit: z.number().min(0).default(0),
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
  const id = c.req.param('id')
  if (!(await canAccessProject(c.env.DB, user, id))) return c.json({ message: 'Not found' }, 404)
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId)
    .first<Record<string, unknown>>()

  if (!project) return c.json({ message: 'Not found' }, 404)

  // RAG cap: if any open critical risk exists → cap rag_status at 'amber'
  const criticalRisk = await c.env.DB.prepare(`
    SELECT id FROM risks
    WHERE project_id = ? AND score_band = 'critical'
      AND status NOT IN ('closed','accepted') AND deleted_at IS NULL
    LIMIT 1
  `).bind(id).first()

  const result = toCamel(project) as Record<string, unknown>
  if (criticalRisk && result.ragStatus === 'green') {
    result.ragStatus = 'amber'
    result.ragCapReason = 'critical_risk'
  }
  return c.json(result)
})

projectRoutes.post('/', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = projectSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const { programId, name, description, methodology, startDate, endDate, budgetCapex, budgetOpex, expectedBenefit } = parsed.data
  const id = crypto.randomUUID()

  await c.env.DB.prepare(`
    INSERT INTO projects (id, org_id, program_id, name, description, manager_id, methodology, status, start_date, end_date, budget_capex, budget_opex, expected_benefit)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'planning', ?, ?, ?, ?, ?)
  `)
    .bind(id, user.orgId, programId ?? null, name, description ?? null, user.sub, methodology, startDate, endDate ?? null, budgetCapex, budgetOpex, expectedBenefit)
    .run()

  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first()
  return c.json(toCamel(project!), 201)
})

projectRoutes.patch('/:id', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
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
  const budgetAllowed = ['budget_capex', 'budget_opex', 'expected_benefit']
  const canEditBudget = user.role === 'admin' || user.role === 'program_manager' || user.role === 'pmo_lead'

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

projectRoutes.delete('/:id', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const project = await c.env.DB.prepare('SELECT id FROM projects WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId).first()
  if (!project) return c.json({ message: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

projectRoutes.get('/:id/budget/history', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await canAccessProject(c.env.DB, user, projectId))) return c.json({ message: 'Not found' }, 404)
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM budget_snapshots WHERE project_id = ? ORDER BY snapshot_date ASC LIMIT 60',
  ).bind(projectId).all()
  return c.json(results.map(toCamel))
})

projectRoutes.post('/:id/budget/recalculate', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await canManageProject(c.env.DB, user, projectId))) return c.json({ message: 'Not found' }, 404)
  try {
    const result = await recalculateProjectBudget(c.env.DB, c.env.KV_CACHE, projectId)
    return c.json(result)
  } catch (e) {
    return c.json({ message: e instanceof Error ? e.message : 'Recalculation failed' }, 500)
  }
})

projectRoutes.get('/:id/budget', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await canAccessProject(c.env.DB, user, projectId))) return c.json({ message: 'Not found' }, 404)

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

// GET /:id/task-dependencies — all deps for a project (for Gantt + WBS)
projectRoutes.get('/:id/task-dependencies', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await canAccessProject(c.env.DB, user, projectId))) return c.json({ message: 'Not found' }, 404)
  const { results } = await c.env.DB.prepare(`
    SELECT td.*,
           t1.name as depends_on_name,
           t2.name as task_name
    FROM task_dependencies td
    JOIN tasks t1 ON t1.id = td.depends_on_id
    JOIN tasks t2 ON t2.id = td.task_id
    WHERE t1.project_id = ? OR t2.project_id = ?
  `).bind(projectId, projectId).all()
  return c.json(results.map(toCamel))
})

// GET /:id/schedule — CPM-computed schedule for all project tasks
projectRoutes.get('/:id/schedule', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await canAccessProject(c.env.DB, user, projectId))) return c.json({ message: 'Not found' }, 404)

  const { results: taskRows } = await c.env.DB.prepare(
    'SELECT id, estimated_hours, start_date, due_date, status FROM tasks WHERE project_id = ?',
  ).bind(projectId).all<{ id: string; estimated_hours: number; start_date: string | null; due_date: string | null; status: string }>()

  const { results: depRows } = await c.env.DB.prepare(`
    SELECT td.task_id, td.depends_on_id, td.dependency_type, td.lag_days
    FROM task_dependencies td
    JOIN tasks t ON t.id = td.task_id
    WHERE t.project_id = ?
  `).bind(projectId).all<{ task_id: string; depends_on_id: string; dependency_type: string; lag_days: number }>()

  const cpmTasks = taskRows.map((r) => ({
    id: r.id,
    estimatedHours: r.estimated_hours,
    startDate: r.start_date,
    dueDate: r.due_date,
    status: r.status,
  }))

  const cpmDeps = depRows.map((r) => ({
    taskId: r.task_id,
    dependsOnId: r.depends_on_id,
    dependencyType: r.dependency_type as import('../services/cpmService').DependencyType,
    lagDays: r.lag_days,
  }))

  try {
    const cpmResult = computeCPM(cpmTasks, cpmDeps)
    const schedule = cpmTasks.map((t) => {
      const cpm = cpmResult.get(t.id)
      return {
        id: t.id,
        earlyStart: cpm?.earlyStart ?? 0,
        earlyFinish: cpm?.earlyFinish ?? 0,
        lateStart: cpm?.lateStart ?? 0,
        lateFinish: cpm?.lateFinish ?? 0,
        totalFloat: cpm?.totalFloat ?? 0,
        isCritical: cpm?.isCritical ?? false,
        duration: cpm?.duration ?? 0,
      }
    })
    return c.json(schedule)
  } catch (e) {
    if (e instanceof CycleError) {
      return c.json({ message: 'Cycle detected in task dependencies', cycle: e.cycle }, 409)
    }
    throw e
  }
})

// GET /:id/roi — return on investment vs budget and projected vs EAC
projectRoutes.get('/:id/roi', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await canAccessProject(c.env.DB, user, projectId))) return c.json({ message: 'Not found' }, 404)
  const project = await c.env.DB.prepare(
    'SELECT budget_capex, budget_opex, expected_benefit FROM projects WHERE id = ? AND org_id = ?',
  ).bind(projectId, user.orgId).first<{ budget_capex: number; budget_opex: number; expected_benefit: number }>()
  if (!project) return c.json({ message: 'Not found' }, 404)

  const snapshot = await c.env.DB.prepare(
    'SELECT eac_capex, eac_opex FROM budget_snapshots WHERE project_id = ? ORDER BY snapshot_date DESC, rowid DESC LIMIT 1',
  ).bind(projectId).first<{ eac_capex: number; eac_opex: number }>()

  const totalBudget = (project.budget_capex ?? 0) + (project.budget_opex ?? 0)
  const expectedBenefit = project.expected_benefit ?? 0
  const eacTotal = snapshot ? (snapshot.eac_capex ?? 0) + (snapshot.eac_opex ?? 0) : 0

  const netBenefit = expectedBenefit - totalBudget
  const roiPct = totalBudget > 0 ? (netBenefit / totalBudget) * 100 : null
  const projectedRoiPct = eacTotal > 0 ? ((expectedBenefit - eacTotal) / eacTotal) * 100 : null

  return c.json({ totalBudget, expectedBenefit, netBenefit, roiPct, eacTotal, projectedRoiPct })
})

// GET /:id/status-reports/suggestion — auto-suggest RAGs
projectRoutes.get('/:id/status-reports/suggestion', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await canAccessProject(c.env.DB, user, projectId))) return c.json({ message: 'Not found' }, 404)
  try {
    const suggestion = await suggestRAGs(c.env.DB, projectId)
    return c.json(suggestion)
  } catch {
    return c.json({ message: 'Could not compute suggestion' }, 500)
  }
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}

function toSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}
