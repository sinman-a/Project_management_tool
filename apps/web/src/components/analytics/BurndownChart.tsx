import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { Sprint, Task } from '@/types'

interface Props {
  sprint: Sprint
  tasks: Task[]
}

const DAY = 86_400_000

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Sprint burndown reconstructed (no historical snapshots) from task completion
 * timestamps: a done task burns down its weight on its updatedAt date.
 * Unit = story points when present, else task count.
 */
export function BurndownChart({ sprint, tasks }: Props) {
  const { data, unit, hasScope } = useMemo(() => {
    const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id && t.status !== 'cancelled')
    const usePoints = sprintTasks.some((t) => (t.storyPoints ?? 0) > 0)
    const weight = (t: Task) => (usePoints ? (t.storyPoints ?? 0) : 1)
    const totalScope = sprintTasks.reduce((s, t) => s + weight(t), 0)

    const start = new Date(sprint.startDate)
    const end = new Date(sprint.endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start || totalScope === 0) {
      return { data: [], unit: usePoints ? 'points' : 'tasks', hasScope: totalScope > 0 }
    }

    // Completed weight per day (done tasks attributed to their updatedAt date)
    const completedByDay = new Map<string, number>()
    for (const t of sprintTasks) {
      if (t.status !== 'done') continue
      const when = t.updatedAt ? new Date(t.updatedAt) : null
      if (!when || isNaN(when.getTime())) continue
      const key = dayKey(when)
      completedByDay.set(key, (completedByDay.get(key) ?? 0) + weight(t))
    }

    const totalDays = Math.max(Math.round((end.getTime() - start.getTime()) / DAY), 1)
    const today = dayKey(new Date())
    const points: { date: string; ideal: number; remaining: number | null }[] = []
    let cumulativeDone = 0

    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(start.getTime() + i * DAY)
      const key = dayKey(d)
      cumulativeDone += completedByDay.get(key) ?? 0
      const ideal = Math.max(totalScope - (totalScope / totalDays) * i, 0)
      // Only draw the actual line up to today (future days have no data yet).
      const remaining = key <= today ? Math.max(totalScope - cumulativeDone, 0) : null
      points.push({ date: key.slice(5), ideal: Math.round(ideal * 10) / 10, remaining })
    }

    return { data: points, unit: usePoints ? 'points' : 'tasks', hasScope: true }
  }, [sprint, tasks])

  if (!hasScope) {
    return (
      <div className="text-xs text-muted-foreground py-6 text-center border rounded-md">
        Add tasks (with story points) to this sprint to see the burndown.
      </div>
    )
  }

  return (
    <div className="border rounded-md p-2">
      <p className="text-xs text-muted-foreground mb-1 px-1">Burndown ({unit})</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 12, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Ideal" />
          <Line type="monotone" dataKey="remaining" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls name="Remaining" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
