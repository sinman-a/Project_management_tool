import { computeCPM, CycleError } from './cpmService'
import type { DependencyType } from './cpmService'
import { computeEVM } from './evmService'

export interface ForecastResult {
  hasData: boolean
  confidence: 'high' | 'medium' | 'low'
  plannedFinish: string | null
  forecastFinish: string | null
  scheduleVarianceDays: number | null
  spi: number | null
  cpi: number | null
  velocityPtsPerWeek: number | null
  remainingDays: number | null
}

const MS_PER_DAY = 86_400_000
const WORK_TO_CAL = 7 / 5 // working days → calendar days

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addCalendarDays(from: Date, days: number): Date {
  return new Date(from.getTime() + Math.round(days) * MS_PER_DAY)
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY)
}

const HOURS_PER_DAY = 8

interface TaskRow {
  id: string
  estimated_hours: number
  start_date: string | null
  due_date: string | null
  status: string
  story_points: number | null
}

/**
 * Heuristic (non-AI) completion forecast: combines CPM critical-path duration,
 * EVM schedule performance (SPI), and remaining work to project a finish date.
 */
export async function computeForecast(db: D1Database, projectId: string): Promise<ForecastResult> {
  const empty: ForecastResult = {
    hasData: false, confidence: 'low', plannedFinish: null, forecastFinish: null,
    scheduleVarianceDays: null, spi: null, cpi: null, velocityPtsPerWeek: null, remainingDays: null,
  }

  const project = await db.prepare('SELECT start_date FROM projects WHERE id = ?')
    .bind(projectId).first<{ start_date: string | null }>()

  const { results: taskRows } = await db.prepare(
    `SELECT id, estimated_hours, start_date, due_date, status, story_points
     FROM tasks WHERE project_id = ? AND deleted_at IS NULL`,
  ).bind(projectId).all<TaskRow>()

  if (!taskRows.length) return empty

  const { results: depRows } = await db.prepare(`
    SELECT td.task_id, td.depends_on_id, td.dependency_type, td.lag_days
    FROM task_dependencies td
    JOIN tasks t ON t.id = td.task_id
    WHERE t.project_id = ?
  `).bind(projectId).all<{ task_id: string; depends_on_id: string; dependency_type: string; lag_days: number }>()

  const today = new Date()

  // ── Anchor + planned finish ────────────────────────────────────────────────
  const startCandidates = taskRows.map((t) => toDate(t.start_date)).filter((d): d is Date => d !== null)
  const projStart = toDate(project?.start_date ?? null)
  const anchor = [projStart, ...startCandidates].filter((d): d is Date => d !== null)
    .reduce<Date | null>((min, d) => (min === null || d < min ? d : min), null)

  const dueCandidates = taskRows.map((t) => toDate(t.due_date)).filter((d): d is Date => d !== null)
  let plannedFinish = dueCandidates.reduce<Date | null>((max, d) => (max === null || d > max ? d : max), null)

  // CPM-derived project end (working days from anchor) as a fallback planned finish.
  let cpmProjectEndWorkingDays: number | null = null
  try {
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
      dependencyType: r.dependency_type as DependencyType,
      lagDays: r.lag_days,
    }))
    const cpm = computeCPM(cpmTasks, cpmDeps)
    cpmProjectEndWorkingDays = Math.max(0, ...Array.from(cpm.values()).map((r) => r.earlyFinish))
  } catch (e) {
    if (!(e instanceof CycleError)) throw e
    // Cyclic dependencies — skip CPM, fall back to due dates.
  }

  if (!plannedFinish && anchor && cpmProjectEndWorkingDays != null) {
    plannedFinish = addCalendarDays(anchor, cpmProjectEndWorkingDays * WORK_TO_CAL)
  }

  if (!plannedFinish) return empty

  // ── Progress + SPI ───────────────────────────────────────────────────────────
  const total = taskRows.length
  const done = taskRows.filter((t) => t.status === 'done').length
  const completionRatio = total > 0 ? done / total : 0

  const evm = await computeEVM(db, projectId)
  let spi: number | null = null
  let cpi: number | null = null
  let confidence: ForecastResult['confidence'] = 'low'

  if (evm.hasBaseline) {
    spi = evm.spi
    cpi = evm.cpi
    confidence = 'high'
  } else if (anchor) {
    // Proxy SPI: completion vs elapsed-time ratio (no baseline available).
    const plannedSpanDays = Math.max(diffDays(plannedFinish, anchor), 1)
    const elapsedDays = Math.max(diffDays(today, anchor), 0)
    const timeRatio = Math.min(elapsedDays / plannedSpanDays, 1)
    if (timeRatio > 0.02) {
      spi = Math.max(0.2, Math.min(2, completionRatio / timeRatio))
      confidence = 'medium'
    }
  }

  // ── Remaining work + forecast finish ──────────────────────────────────────────
  const remainingHours = taskRows
    .filter((t) => t.status !== 'done' && t.status !== 'cancelled')
    .reduce((s, t) => s + (t.estimated_hours || 0), 0)
  const remainingWorkCalDays = (remainingHours / HOURS_PER_DAY) * WORK_TO_CAL
  const calToPlanned = Math.max(diffDays(plannedFinish, today), 0)
  // Remaining duration = larger of "time left to plan" and "raw work remaining".
  const remainingDays = Math.max(calToPlanned, remainingWorkCalDays)

  const spiFactor = spi != null ? 1 / Math.max(spi, 0.1) : 1
  const forecastFinish = addCalendarDays(today, remainingDays * spiFactor)
  const scheduleVarianceDays = diffDays(forecastFinish, plannedFinish)

  // ── Velocity (story points / week) ────────────────────────────────────────────
  let velocityPtsPerWeek: number | null = null
  if (anchor) {
    const donePts = taskRows.filter((t) => t.status === 'done').reduce((s, t) => s + (t.story_points ?? 0), 0)
    const weeksElapsed = Math.max(diffDays(today, anchor) / 7, 0.1)
    if (donePts > 0) velocityPtsPerWeek = donePts / weeksElapsed
  }

  return {
    hasData: true,
    confidence,
    plannedFinish: isoDate(plannedFinish),
    forecastFinish: isoDate(forecastFinish),
    scheduleVarianceDays,
    spi,
    cpi,
    velocityPtsPerWeek,
    remainingDays: Math.round(remainingDays),
  }
}
