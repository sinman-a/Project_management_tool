export interface EVMResult {
  ev: number
  pv: number
  ac: number
  sv: number
  cv: number
  spi: number
  cpi: number
  band: 'green' | 'amber' | 'red'
  hasBaseline: boolean
}

interface BaselineTaskRow {
  task_id: string
  planned_budget: number
  planned_finish: string | null
  planned_start: string | null
  planned_duration_days: number
}

interface TaskRow {
  id: string
  percent_complete: number
  status: string
}

interface ConfigRow {
  method: string
  spi_amber_threshold: number
  spi_red_threshold: number
  cpi_amber_threshold: number
  cpi_red_threshold: number
}

function computeEV(method: string, percentComplete: number, status: string, plannedBudget: number): number {
  if (method === 'zero_hundred') {
    return status === 'done' ? plannedBudget : 0
  }
  if (method === 'fifty_fifty') {
    if (status === 'done') return plannedBudget
    if (['in_progress', 'review'].includes(status)) return plannedBudget * 0.5
    return 0
  }
  // percent_complete (default)
  return (percentComplete / 100) * plannedBudget
}

function computePV(baselineTasks: BaselineTaskRow[], today: Date): number {
  let pv = 0
  for (const bt of baselineTasks) {
    if (!bt.planned_finish || !bt.planned_start) {
      pv += bt.planned_budget
      continue
    }
    const finish = new Date(bt.planned_finish)
    const start = new Date(bt.planned_start)
    if (finish <= today) {
      pv += bt.planned_budget
    } else if (start < today) {
      const totalDays = Math.max((finish.getTime() - start.getTime()) / 86400000, 1)
      const elapsedDays = (today.getTime() - start.getTime()) / 86400000
      pv += (elapsedDays / totalDays) * bt.planned_budget
    }
  }
  return pv
}

function ragBand(
  spi: number,
  cpi: number,
  config: Pick<ConfigRow, 'spi_amber_threshold' | 'spi_red_threshold' | 'cpi_amber_threshold' | 'cpi_red_threshold'>,
): 'green' | 'amber' | 'red' {
  const spiDev = Math.abs(spi - 1)
  const cpiDev = Math.abs(cpi - 1)
  if (spiDev >= config.spi_red_threshold || cpiDev >= config.cpi_red_threshold) return 'red'
  if (spiDev >= config.spi_amber_threshold || cpiDev >= config.cpi_amber_threshold) return 'amber'
  return 'green'
}

export async function computeEVM(db: D1Database, projectId: string): Promise<EVMResult> {
  const today = new Date()

  // Get active baseline
  const baseline = await db.prepare(
    'SELECT id FROM baselines WHERE project_id = ? AND is_active = 1 ORDER BY locked_at DESC LIMIT 1',
  ).bind(projectId).first<{ id: string }>()

  if (!baseline) {
    return { ev: 0, pv: 0, ac: 0, sv: 0, cv: 0, spi: 1, cpi: 1, band: 'green', hasBaseline: false }
  }

  // Get baseline tasks
  const { results: baselineTasks } = await db.prepare(
    'SELECT task_id, planned_budget, planned_finish, planned_start, planned_duration_days FROM baseline_tasks WHERE baseline_id = ?',
  ).bind(baseline.id).all<BaselineTaskRow>()

  // Get current tasks for EV
  const { results: currentTasks } = await db.prepare(
    'SELECT id, percent_complete, status FROM tasks WHERE project_id = ? AND deleted_at IS NULL',
  ).bind(projectId).all<TaskRow>()

  // Get EV method config
  const config = await db.prepare(
    'SELECT method, spi_amber_threshold, spi_red_threshold, cpi_amber_threshold, cpi_red_threshold FROM ev_method_configs WHERE project_id = ?',
  ).bind(projectId).first<ConfigRow>() ?? {
    method: 'percent_complete',
    spi_amber_threshold: 0.05,
    spi_red_threshold: 0.15,
    cpi_amber_threshold: 0.05,
    cpi_red_threshold: 0.15,
  }

  // Build a map of task_id → current task
  const taskMap = new Map(currentTasks.map((t) => [t.id, t]))

  // Compute EV
  let ev = 0
  for (const bt of baselineTasks) {
    const currentTask = taskMap.get(bt.task_id)
    if (!currentTask) continue
    ev += computeEV(config.method, currentTask.percent_complete, currentTask.status, bt.planned_budget)
  }

  // Compute PV
  const pv = computePV(baselineTasks, today)

  // AC from latest budget snapshot
  const snapshot = await db.prepare(
    'SELECT spent_capex, spent_opex FROM budget_snapshots WHERE project_id = ? ORDER BY snapshot_date DESC LIMIT 1',
  ).bind(projectId).first<{ spent_capex: number; spent_opex: number }>()
  const ac = (snapshot?.spent_capex ?? 0) + (snapshot?.spent_opex ?? 0)

  const sv = ev - pv
  const cv = ev - ac
  const spi = pv === 0 ? 1 : ev / pv
  const cpi = ac === 0 ? 1 : ev / ac

  return { ev, pv, ac, sv, cv, spi, cpi, band: ragBand(spi, cpi, config), hasBaseline: true }
}
