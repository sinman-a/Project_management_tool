import { Hono } from 'hono'
import type { HonoContext } from '../types'
import { projectInOrg } from '../middleware/ownership'
import { computeEVM } from '../services/evmService'
import { computeCPM, CycleError, type DependencyType } from '../services/cpmService'
import { computeForecast } from '../services/forecastService'

export const analyticsRoutes = new Hono<HonoContext>()

const ACTIVE_STATUSES = ['planning', 'active', 'on_hold']

interface ProjectRow {
  id: string
  name: string
  status: string
  rag_status: string | null
  budget_capex: number
  budget_opex: number
  spent_capex: number | null
  spent_opex: number | null
}

async function activeProjects(db: D1Database, orgId: string): Promise<ProjectRow[]> {
  const placeholders = ACTIVE_STATUSES.map(() => '?').join(',')
  const { results } = await db.prepare(`
    SELECT p.id, p.name, p.status, p.rag_status, p.budget_capex, p.budget_opex,
      bs.spent_capex, bs.spent_opex
    FROM projects p
    LEFT JOIN budget_snapshots bs ON bs.id = (
      SELECT id FROM budget_snapshots WHERE project_id = p.id
      ORDER BY snapshot_date DESC, rowid DESC LIMIT 1
    )
    WHERE p.org_id = ? AND p.status IN (${placeholders})
    ORDER BY p.created_at DESC
  `).bind(orgId, ...ACTIVE_STATUSES).all<ProjectRow>()
  return results
}

// GET /analytics/portfolio — per-project EVM + forecast + budget, with rollups.
analyticsRoutes.get('/portfolio', async (c) => {
  const user = c.get('user')
  const projects = await activeProjects(c.env.DB, user.orgId)

  const rows = await Promise.all(projects.map(async (p) => {
    const evm = await computeEVM(c.env.DB, p.id)
    const forecast = await computeForecast(c.env.DB, p.id)
    const budget = (p.budget_capex ?? 0) + (p.budget_opex ?? 0)
    const spent = (p.spent_capex ?? 0) + (p.spent_opex ?? 0)
    return {
      projectId: p.id,
      name: p.name,
      status: p.status,
      rag: p.rag_status ?? 'green',
      spi: evm.hasBaseline ? evm.spi : null,
      cpi: evm.hasBaseline ? evm.cpi : null,
      budget,
      spent,
      forecastFinish: forecast.forecastFinish,
      plannedFinish: forecast.plannedFinish,
      scheduleVarianceDays: forecast.scheduleVarianceDays,
    }
  }))

  const ragDistribution = { green: 0, amber: 0, red: 0 }
  for (const r of rows) {
    if (r.rag === 'red') ragDistribution.red++
    else if (r.rag === 'amber') ragDistribution.amber++
    else ragDistribution.green++
  }
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)
  const spiVals = rows.map((r) => r.spi).filter((v): v is number => v != null)
  const cpiVals = rows.map((r) => r.cpi).filter((v): v is number => v != null)
  const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)

  return c.json({
    projects: rows,
    ragDistribution,
    totalBudget,
    totalSpent,
    avgSpi: avg(spiVals),
    avgCpi: avg(cpiVals),
  })
})

interface Insight {
  severity: 'red' | 'amber'
  category: string
  projectId: string | null
  projectName: string
  message: string
}

const SEVERITY_ORDER = { red: 0, amber: 1 }

// GET /analytics/insights — rule-based (non-AI) detection of hidden risks & bottlenecks.
analyticsRoutes.get('/insights', async (c) => {
  const user = c.get('user')
  const orgId = user.orgId
  const projects = await activeProjects(c.env.DB, orgId)
  const insights: Insight[] = []

  // Overdue open tasks per project
  const { results: overdue } = await c.env.DB.prepare(`
    SELECT p.id as project_id, p.name as project_name, COUNT(*) as cnt
    FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE p.org_id = ? AND t.deleted_at IS NULL
      AND t.due_date IS NOT NULL AND t.due_date < date('now')
      AND t.status NOT IN ('done','cancelled')
    GROUP BY p.id
  `).bind(orgId).all<{ project_id: string; project_name: string; cnt: number }>()
  for (const o of overdue) {
    insights.push({
      severity: o.cnt >= 5 ? 'red' : 'amber',
      category: 'Overdue tasks',
      projectId: o.project_id,
      projectName: o.project_name,
      message: `${o.cnt} overdue task${o.cnt === 1 ? '' : 's'} past due date`,
    })
  }

  for (const p of projects) {
    // EVM red band (schedule/cost performance)
    const evm = await computeEVM(c.env.DB, p.id)
    if (evm.hasBaseline && evm.band === 'red') {
      const parts: string[] = []
      if (Math.abs(evm.spi - 1) >= 0.15) parts.push(`SPI ${evm.spi.toFixed(2)}`)
      if (Math.abs(evm.cpi - 1) >= 0.15) parts.push(`CPI ${evm.cpi.toFixed(2)}`)
      insights.push({
        severity: 'red',
        category: 'Performance',
        projectId: p.id,
        projectName: p.name,
        message: `Schedule/cost variance critical (${parts.join(', ') || 'red band'})`,
      })
    }

    // Negative float (over-constrained schedule) via CPM
    const { results: taskRows } = await c.env.DB.prepare(
      `SELECT id, estimated_hours, start_date, due_date, status FROM tasks
       WHERE project_id = ? AND deleted_at IS NULL`,
    ).bind(p.id).all<{ id: string; estimated_hours: number; start_date: string | null; due_date: string | null; status: string }>()
    const { results: depRows } = await c.env.DB.prepare(`
      SELECT td.task_id, td.depends_on_id, td.dependency_type, td.lag_days, td.cross_project
      FROM task_dependencies td JOIN tasks t ON t.id = td.task_id
      WHERE t.project_id = ?
    `).bind(p.id).all<{ task_id: string; depends_on_id: string; dependency_type: string; lag_days: number; cross_project: number }>()

    if (taskRows.length) {
      try {
        const cpm = computeCPM(
          taskRows.map((t) => ({ id: t.id, estimatedHours: t.estimated_hours, startDate: t.start_date, dueDate: t.due_date, status: t.status })),
          depRows.map((d) => ({ taskId: d.task_id, dependsOnId: d.depends_on_id, dependencyType: d.dependency_type as DependencyType, lagDays: d.lag_days })),
        )
        const negativeFloat = Array.from(cpm.values()).filter((r) => r.totalFloat < 0).length
        if (negativeFloat > 0) {
          insights.push({
            severity: 'red',
            category: 'Schedule bottleneck',
            projectId: p.id,
            projectName: p.name,
            message: `${negativeFloat} task${negativeFloat === 1 ? '' : 's'} with negative float (deadline conflict)`,
          })
        }
      } catch (e) {
        if (e instanceof CycleError) {
          insights.push({
            severity: 'red',
            category: 'Dependency cycle',
            projectId: p.id,
            projectName: p.name,
            message: 'Circular task dependency detected — schedule cannot be computed',
          })
        } else { throw e }
      }
    }

    // Cross-project dependency bottleneck
    const crossCount = depRows.filter((d) => d.cross_project === 1).length
    if (crossCount > 0) {
      insights.push({
        severity: 'amber',
        category: 'Cross-project dependency',
        projectId: p.id,
        projectName: p.name,
        message: `${crossCount} cross-project dependenc${crossCount === 1 ? 'y' : 'ies'} — coordinate across portfolio`,
      })
    }
  }

  // Resource over-allocation (current week): allocated hours on active tasks > capacity
  const { results: allocRows } = await c.env.DB.prepare(`
    SELECT r.id, r.name, r.capacity_hours_per_week, t.start_date, t.due_date, ta.allocated_hours
    FROM resources r
    JOIN task_assignments ta ON ta.resource_id = r.id
    JOIN tasks t ON t.id = ta.task_id
    WHERE r.org_id = ? AND t.start_date <= date('now') AND t.due_date >= date('now')
      AND t.status NOT IN ('done','cancelled')
  `).bind(orgId).all<{ id: string; name: string; capacity_hours_per_week: number; start_date: string; due_date: string; allocated_hours: number }>()

  const resourceLoad = new Map<string, { name: string; capacity: number; hoursThisWeek: number }>()
  for (const a of allocRows) {
    const start = new Date(a.start_date)
    const end = new Date(a.due_date)
    const weeks = Math.max(Math.ceil((end.getTime() - start.getTime()) / (7 * 86_400_000)), 1)
    const perWeek = (a.allocated_hours ?? 0) / weeks
    const entry = resourceLoad.get(a.id) ?? { name: a.name, capacity: a.capacity_hours_per_week ?? 40, hoursThisWeek: 0 }
    entry.hoursThisWeek += perWeek
    resourceLoad.set(a.id, entry)
  }
  for (const r of resourceLoad.values()) {
    if (r.capacity > 0 && r.hoursThisWeek > r.capacity) {
      const pct = Math.round((r.hoursThisWeek / r.capacity) * 100)
      insights.push({
        severity: pct >= 120 ? 'red' : 'amber',
        category: 'Resource over-allocation',
        projectId: null,
        projectName: r.name,
        message: `${r.name} allocated ${pct}% of capacity this week`,
      })
    }
  }

  insights.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  return c.json(insights)
})

// GET /analytics/projects/:id/forecast — heuristic completion forecast for one project.
analyticsRoutes.get('/projects/:id/forecast', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)
  const forecast = await computeForecast(c.env.DB, projectId)
  return c.json(forecast)
})
