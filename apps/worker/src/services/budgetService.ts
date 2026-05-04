import type { D1Database, KVNamespace } from '@cloudflare/workers-types'

interface ProjectBudgetRow {
  id: string
  budget_capex: number
  budget_opex: number
  start_date: string
}

interface SpentRow {
  cost_type: string
  total_cost: number
}

interface CommittedRow {
  cost_type: string
  committed: number
}

export interface SnapshotResult {
  projectId: string
  snapshotDate: string
  budgetCapex: number
  budgetOpex: number
  spentCapex: number
  spentOpex: number
  committedCapex: number
  committedOpex: number
  burnRateCapex: number
  burnRateOpex: number
  eacCapex: number
  eacOpex: number
}

export async function recalculateProjectBudget(
  db: D1Database,
  kv: KVNamespace,
  projectId: string,
): Promise<SnapshotResult> {
  const project = await db
    .prepare('SELECT id, budget_capex, budget_opex, start_date FROM projects WHERE id = ?')
    .bind(projectId)
    .first<ProjectBudgetRow>()

  if (!project) throw new Error(`Project ${projectId} not found`)

  const snapshotDate = new Date().toISOString().slice(0, 10)

  const { results: spentRows } = await db
    .prepare(`
      SELECT cost_type, COALESCE(SUM(computed_cost), 0) as total_cost
      FROM time_logs
      WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)
        AND approved_at IS NOT NULL
      GROUP BY cost_type
    `)
    .bind(projectId)
    .all<SpentRow>()

  const spentCapex = spentRows.find((r) => r.cost_type === 'capex')?.total_cost ?? 0
  const spentOpex = spentRows.find((r) => r.cost_type === 'opex')?.total_cost ?? 0

  const { results: committedRows } = await db
    .prepare(`
      SELECT t.cost_type,
             COALESCE(SUM((ta.allocated_hours - COALESCE(logged.hours, 0)) * r.rate), 0) as committed
      FROM task_assignments ta
      JOIN resources r ON r.id = ta.resource_id
      JOIN tasks t ON t.id = ta.task_id
      LEFT JOIN (
        SELECT task_id, resource_id, SUM(hours) as hours
        FROM time_logs
        GROUP BY task_id, resource_id
      ) logged ON logged.task_id = ta.task_id AND logged.resource_id = ta.resource_id
      WHERE t.project_id = ? AND t.status NOT IN ('done', 'cancelled')
      GROUP BY t.cost_type
    `)
    .bind(projectId)
    .all<CommittedRow>()

  const committedCapex = Math.max(0, committedRows.find((r) => r.cost_type === 'capex')?.committed ?? 0)
  const committedOpex = Math.max(0, committedRows.find((r) => r.cost_type === 'opex')?.committed ?? 0)

  const startMs = new Date(project.start_date).getTime()
  const nowMs = Date.now()
  const weeksElapsed = Math.max(1, (nowMs - startMs) / (7 * 24 * 60 * 60 * 1000))

  const burnRateCapex = spentCapex / weeksElapsed
  const burnRateOpex = spentOpex / weeksElapsed

  const totalCapex = spentCapex + committedCapex
  const totalOpex = spentOpex + committedOpex
  const cpiCapex = totalCapex > 0 && project.budget_capex > 0 ? project.budget_capex / totalCapex : 1
  const cpiOpex = totalOpex > 0 && project.budget_opex > 0 ? project.budget_opex / totalOpex : 1
  const eacCapex = project.budget_capex / cpiCapex
  const eacOpex = project.budget_opex / cpiOpex

  // Upsert: update same-day snapshot if it exists, otherwise insert fresh row
  const existing = await db
    .prepare('SELECT id FROM budget_snapshots WHERE project_id = ? AND snapshot_date = ?')
    .bind(projectId, snapshotDate)
    .first<{ id: string }>()

  if (existing) {
    await db
      .prepare(`
        UPDATE budget_snapshots SET
          budget_capex = ?, budget_opex = ?,
          spent_capex = ?, spent_opex = ?,
          committed_capex = ?, committed_opex = ?,
          burn_rate_capex = ?, burn_rate_opex = ?,
          eac_capex = ?, eac_opex = ?
        WHERE id = ?
      `)
      .bind(
        project.budget_capex, project.budget_opex,
        spentCapex, spentOpex,
        committedCapex, committedOpex,
        burnRateCapex, burnRateOpex,
        eacCapex, eacOpex,
        existing.id,
      )
      .run()
  } else {
    const snapshotId = crypto.randomUUID()
    await db
      .prepare(`
        INSERT INTO budget_snapshots
          (id, project_id, snapshot_date, budget_capex, budget_opex,
           spent_capex, spent_opex, committed_capex, committed_opex,
           burn_rate_capex, burn_rate_opex, eac_capex, eac_opex)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        snapshotId, projectId, snapshotDate,
        project.budget_capex, project.budget_opex,
        spentCapex, spentOpex,
        committedCapex, committedOpex,
        burnRateCapex, burnRateOpex,
        eacCapex, eacOpex,
      )
      .run()
  }

  const result: SnapshotResult = {
    projectId, snapshotDate,
    budgetCapex: project.budget_capex,
    budgetOpex: project.budget_opex,
    spentCapex, spentOpex,
    committedCapex, committedOpex,
    burnRateCapex, burnRateOpex,
    eacCapex, eacOpex,
  }

  await kv.put(`budget:project:${projectId}:latest`, JSON.stringify(result), { expirationTtl: 65 * 60 })

  const totalBudget = project.budget_capex + project.budget_opex
  const totalSpentAndCommitted = spentCapex + spentOpex + committedCapex + committedOpex

  if (totalBudget > 0 && totalSpentAndCommitted / totalBudget >= 0.8) {
    console.warn(`[BUDGET ALERT] Project ${projectId} at ${Math.round((totalSpentAndCommitted / totalBudget) * 100)}% of budget`)
  }

  return result
}

export async function recalculateAllActiveProjects(
  db: D1Database,
  kv: KVNamespace,
): Promise<void> {
  const { results } = await db
    .prepare("SELECT id FROM projects WHERE status = 'active'")
    .all<{ id: string }>()

  await Promise.allSettled(
    results.map((p) => recalculateProjectBudget(db, kv, p.id)),
  )
}
