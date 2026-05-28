export type DependencyType =
  | 'finish_to_start'
  | 'start_to_start'
  | 'finish_to_finish'
  | 'start_to_finish'

export interface CpmTask {
  id: string
  estimatedHours: number
  startDate: string | null
  dueDate: string | null
  status: string
}

export interface CpmDependency {
  taskId: string        // successor
  dependsOnId: string   // predecessor
  dependencyType: DependencyType
  lagDays: number
}

export interface CpmResult {
  taskId: string
  duration: number
  earlyStart: number
  earlyFinish: number
  lateStart: number
  lateFinish: number
  totalFloat: number
  isCritical: boolean
}

export class CycleError extends Error {
  constructor(public cycle: string[]) {
    super(`Cycle detected: ${cycle.join(' → ')}`)
  }
}

const HOURS_PER_DAY = 8

function duration(task: CpmTask): number {
  if (task.status === 'cancelled') return 0
  const d = Math.ceil(task.estimatedHours / HOURS_PER_DAY)
  return Math.max(d, 0)
}

export function computeCPM(tasks: CpmTask[], deps: CpmDependency[]): Map<string, CpmResult> {
  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const dur = new Map(tasks.map((t) => [t.id, duration(t)]))

  // Build adjacency: successors[predId] = [{succId, type, lag}]
  const successors = new Map<string, { succId: string; type: DependencyType; lag: number }[]>()
  const predecessors = new Map<string, { predId: string; type: DependencyType; lag: number }[]>()
  for (const t of tasks) {
    successors.set(t.id, [])
    predecessors.set(t.id, [])
  }
  for (const d of deps) {
    if (!taskMap.has(d.taskId) || !taskMap.has(d.dependsOnId)) continue
    if (d.taskId === d.dependsOnId) continue
    successors.get(d.dependsOnId)!.push({ succId: d.taskId, type: d.dependencyType, lag: d.lagDays })
    predecessors.get(d.taskId)!.push({ predId: d.dependsOnId, type: d.dependencyType, lag: d.lagDays })
  }

  // Kahn's topological sort
  const inDegree = new Map(tasks.map((t) => [t.id, predecessors.get(t.id)!.length]))
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }
  const sorted: string[] = []
  while (queue.length) {
    const n = queue.shift()!
    sorted.push(n)
    for (const { succId } of successors.get(n)!) {
      const deg = inDegree.get(succId)! - 1
      inDegree.set(succId, deg)
      if (deg === 0) queue.push(succId)
    }
  }
  if (sorted.length < tasks.length) {
    // Cycle: collect node IDs not in sorted
    const inSorted = new Set(sorted)
    const cycle = tasks.map((t) => t.id).filter((id) => !inSorted.has(id))
    throw new CycleError(cycle)
  }

  // Forward pass
  const ES = new Map<string, number>()
  const EF = new Map<string, number>()
  for (const id of sorted) {
    const d = dur.get(id)!
    let es = 0
    for (const { predId, type, lag } of predecessors.get(id)!) {
      const predEF = EF.get(predId) ?? 0
      const predES = ES.get(predId) ?? 0
      const succD = d
      let constraint: number
      switch (type) {
        case 'finish_to_start':  constraint = predEF + lag; break
        case 'start_to_start':   constraint = predES + lag; break
        case 'finish_to_finish': constraint = predEF + lag - succD; break
        case 'start_to_finish':  constraint = predES + lag - succD; break
      }
      if (constraint > es) es = constraint
    }
    ES.set(id, es)
    EF.set(id, es + d)
  }

  const projectEnd = Math.max(0, ...Array.from(EF.values()))

  // Backward pass
  const LF = new Map<string, number>(tasks.map((t) => [t.id, projectEnd]))
  const LS = new Map<string, number>()
  for (const id of [...sorted].reverse()) {
    const d = dur.get(id)!
    let lf = LF.get(id)!
    for (const { succId, type, lag } of successors.get(id)!) {
      const succLS = LS.get(succId) ?? (LF.get(succId)! - (dur.get(succId) ?? 0))
      const succLF = LF.get(succId)!
      const predD = d
      let constraint: number
      switch (type) {
        case 'finish_to_start':  constraint = succLS - lag; break
        case 'start_to_start':   constraint = succLS - lag + predD; break
        case 'finish_to_finish': constraint = succLF - lag; break
        case 'start_to_finish':  constraint = succLF - lag + predD; break
      }
      if (constraint < lf) lf = constraint
    }
    LF.set(id, lf)
    LS.set(id, lf - d)
  }

  const result = new Map<string, CpmResult>()
  for (const t of tasks) {
    const d = dur.get(t.id)!
    const es = ES.get(t.id) ?? 0
    const ef = EF.get(t.id) ?? d
    const lf = LF.get(t.id) ?? projectEnd
    const ls = LS.get(t.id) ?? lf - d
    const tf = ls - es
    result.set(t.id, {
      taskId: t.id,
      duration: d,
      earlyStart: es,
      earlyFinish: ef,
      lateStart: ls,
      lateFinish: lf,
      totalFloat: tf,
      isCritical: tf <= 0 && d > 0,
    })
  }
  return result
}
