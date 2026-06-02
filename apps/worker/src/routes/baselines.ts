import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'
import { projectInOrg } from '../middleware/ownership'
import { computeEVM } from '../services/evmService'
import { writeActivity } from './comments'

const baselineRoutes = new Hono<HonoContext>()

// GET /baselines (list for a project) — mounted via projects route pattern
export const baselineSubRoutes = new Hono<HonoContext>()

baselineSubRoutes.get('/:id/baselines', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)
  const { results } = await c.env.DB.prepare(`
    SELECT b.*, u.full_name as locked_by_name
    FROM baselines b
    LEFT JOIN users u ON u.id = b.locked_by
    WHERE b.project_id = ?
    ORDER BY b.locked_at DESC
  `).bind(projectId).all()
  return c.json(results.map(toCamel))
})

baselineSubRoutes.post('/:id/baselines',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const user = c.get('user')
    const projectId = c.req.param('id')
    const body = await c.req.json()

    const parsed = z.object({
      name: z.string().min(1).max(100).optional(),
      notes: z.string().max(1000).nullish(),
    }).safeParse(body)

    if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

    // Get project budget (org-scoped)
    const project = await c.env.DB.prepare(
      'SELECT budget_capex, budget_opex, start_date, end_date FROM projects WHERE id = ? AND org_id = ?',
    ).bind(projectId, user.orgId).first<{ budget_capex: number; budget_opex: number; start_date: string; end_date: string }>()

    if (!project) return c.json({ message: 'Project not found' }, 404)

    // Determine baseline name
    const countRow = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM baselines WHERE project_id = ?',
    ).bind(projectId).first<{ cnt: number }>()
    const baselineName = parsed.data.name ?? `Baseline ${(countRow?.cnt ?? 0) + 1}`

    // Deactivate previous active baseline
    await c.env.DB.prepare(
      'UPDATE baselines SET is_active = 0 WHERE project_id = ? AND is_active = 1',
    ).bind(projectId).run()

    const baselineId = crypto.randomUUID()
    await c.env.DB.prepare(`
      INSERT INTO baselines (id, project_id, name, notes, locked_by, is_active, total_budget, total_capex, total_opex, planned_start, planned_finish)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `).bind(
      baselineId, projectId, baselineName, parsed.data.notes ?? null, user.sub,
      (project.budget_capex + project.budget_opex),
      project.budget_capex, project.budget_opex,
      project.start_date, project.end_date ?? null,
    ).run()

    // Snapshot all tasks
    const { results: tasks } = await c.env.DB.prepare(
      'SELECT id, name, start_date, due_date, estimated_hours, budget_capex, budget_opex, parent_task_id FROM tasks WHERE project_id = ? AND deleted_at IS NULL',
    ).bind(projectId).all<{
      id: string; name: string; start_date: string | null; due_date: string | null
      estimated_hours: number; budget_capex?: number; budget_opex?: number; parent_task_id: string | null
    }>()

    const daysPerHour = 1 / 8
    for (const task of tasks) {
      let durationDays = 0
      if (task.start_date && task.due_date) {
        const start = new Date(task.start_date)
        const end = new Date(task.due_date)
        durationDays = Math.max(Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1, 0)
      } else {
        durationDays = Math.ceil(task.estimated_hours * daysPerHour)
      }
      const plannedBudget = (task.budget_capex ?? 0) + (task.budget_opex ?? 0)

      await c.env.DB.prepare(`
        INSERT INTO baseline_tasks (id, baseline_id, task_id, task_name_snapshot, planned_start, planned_finish, planned_duration_days, planned_estimate_hours, planned_budget, parent_task_id_snapshot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(), baselineId, task.id, task.name,
        task.start_date ?? null, task.due_date ?? null,
        durationDays, task.estimated_hours, plannedBudget,
        task.parent_task_id ?? null,
      ).run()
    }

    // Write activity log
    try {
      await writeActivity(c.env.DB, {
        orgId: user.orgId,
        entityType: 'project',
        entityId: projectId,
        eventType: 'baseline_locked',
        actorId: user.sub,
        payload: { baselineId, name: baselineName, taskCount: tasks.length },
      })
    } catch { /* activity log is non-critical */ }

    const baseline = await c.env.DB.prepare('SELECT * FROM baselines WHERE id = ?').bind(baselineId).first()
    return c.json(toCamel(baseline!), 201)
  },
)

baselineSubRoutes.get('/:id/evm', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)
  const result = await computeEVM(c.env.DB, projectId)
  return c.json(result)
})

baselineSubRoutes.get('/:id/evm/history', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)

  // Return weekly EVM snapshots for last 12 weeks
  const { results: snapshots } = await c.env.DB.prepare(`
    SELECT snapshot_date, spent_capex, spent_opex
    FROM budget_snapshots
    WHERE project_id = ?
    ORDER BY snapshot_date ASC
    LIMIT 84
  `).bind(projectId).all<{ snapshot_date: string; spent_capex: number; spent_opex: number }>()

  return c.json(snapshots.map((s) => ({
    date: s.snapshot_date?.slice(0, 10) ?? '',
    ac: (s.spent_capex ?? 0) + (s.spent_opex ?? 0),
  })))
})

baselineSubRoutes.patch('/:id/ev-config',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const user = c.get('user')
    const projectId = c.req.param('id')
    if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)
    const body = await c.req.json()
    const parsed = z.object({
      method: z.enum(['zero_hundred', 'fifty_fifty', 'percent_complete']).optional(),
      spiAmberThreshold: z.number().min(0).max(1).optional(),
      spiRedThreshold: z.number().min(0).max(1).optional(),
      cpiAmberThreshold: z.number().min(0).max(1).optional(),
      cpiRedThreshold: z.number().min(0).max(1).optional(),
    }).safeParse(body)

    if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)
    const d = parsed.data

    await c.env.DB.prepare(`
      INSERT INTO ev_method_configs (project_id, method, spi_amber_threshold, spi_red_threshold, cpi_amber_threshold, cpi_red_threshold)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        method = COALESCE(excluded.method, method),
        spi_amber_threshold = COALESCE(excluded.spi_amber_threshold, spi_amber_threshold),
        spi_red_threshold = COALESCE(excluded.spi_red_threshold, spi_red_threshold),
        cpi_amber_threshold = COALESCE(excluded.cpi_amber_threshold, cpi_amber_threshold),
        cpi_red_threshold = COALESCE(excluded.cpi_red_threshold, cpi_red_threshold)
    `).bind(
      projectId,
      d.method ?? 'percent_complete',
      d.spiAmberThreshold ?? 0.05,
      d.spiRedThreshold ?? 0.15,
      d.cpiAmberThreshold ?? 0.05,
      d.cpiRedThreshold ?? 0.15,
    ).run()

    const config = await c.env.DB.prepare('SELECT * FROM ev_method_configs WHERE project_id = ?').bind(projectId).first()
    return c.json(toCamel(config!))
  },
)

// GET /baselines/:id — baseline detail
baselineRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const baseline = await c.env.DB.prepare(`
    SELECT b.*, u.full_name as locked_by_name
    FROM baselines b
    JOIN projects p ON p.id = b.project_id
    LEFT JOIN users u ON u.id = b.locked_by
    WHERE b.id = ? AND p.org_id = ?
  `).bind(id, user.orgId).first()
  if (!baseline) return c.json({ message: 'Not found' }, 404)

  const { results: tasks } = await c.env.DB.prepare(
    'SELECT * FROM baseline_tasks WHERE baseline_id = ? ORDER BY task_name_snapshot ASC',
  ).bind(id).all()

  return c.json({ ...toCamel(baseline), tasks: tasks.map(toCamel) })
})

export { baselineRoutes }

// Program-level EVM roll-up
export async function getProgramEVM(db: D1Database, programId: string) {
  const { results: projects } = await db.prepare(
    'SELECT id FROM projects WHERE program_id = ?',
  ).bind(programId).all<{ id: string }>()

  let totalEV = 0, totalPV = 0, totalAC = 0
  for (const p of projects) {
    const evm = await computeEVM(db, p.id)
    if (!evm.hasBaseline) continue
    totalEV += evm.ev
    totalPV += evm.pv
    totalAC += evm.ac
  }

  const sv = totalEV - totalPV
  const cv = totalEV - totalAC
  const spi = totalPV === 0 ? 1 : totalEV / totalPV
  const cpi = totalAC === 0 ? 1 : totalEV / totalAC

  return { ev: totalEV, pv: totalPV, ac: totalAC, sv, cv, spi, cpi }
}

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()), v]),
  )
}
