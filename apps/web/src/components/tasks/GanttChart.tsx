import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'

const STATUS_BAR: Record<string, string> = {
  backlog: 'bg-gray-300',
  todo: 'bg-blue-300',
  in_progress: 'bg-indigo-400',
  review: 'bg-purple-400',
  done: 'bg-green-400',
  cancelled: 'bg-red-200',
}

function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null
  const parsed = new Date(d)
  return isNaN(parsed.getTime()) ? null : parsed
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000)
}

interface Props {
  tasks: Task[]
}

export function GanttChart({ tasks }: Props) {
  const { minDate, totalDays, rows } = useMemo(() => {
    const dated = tasks
      .filter((t) => parseDate(t.startDate) || parseDate(t.dueDate))
      .map((t) => ({
        task: t,
        start: parseDate(t.startDate),
        end: parseDate(t.dueDate),
      }))

    if (dated.length === 0) return { minDate: null, totalDays: 0, rows: [] }

    const allDates = dated.flatMap(({ start, end }) => [start, end].filter(Boolean) as Date[])
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))
    minDate.setDate(minDate.getDate() - 1)
    maxDate.setDate(maxDate.getDate() + 2)
    const totalDays = daysBetween(minDate, maxDate)

    const rows = dated.map(({ task, start, end }) => {
      const effectiveStart = start ?? end!
      const effectiveEnd = end ?? start!
      const left = (daysBetween(minDate, effectiveStart) / totalDays) * 100
      const width = Math.max((daysBetween(effectiveStart, effectiveEnd) + 1) / totalDays * 100, 1)
      return { task, left, width }
    })

    return { minDate, totalDays, rows }
  }, [tasks])

  if (!minDate || rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Add start/due dates to tasks to see the Gantt chart.
      </div>
    )
  }

  const monthLabels = useMemo(() => {
    if (!minDate) return []
    const labels: { label: string; left: number }[] = []
    const cursor = new Date(minDate)
    while (daysBetween(minDate, cursor) < totalDays) {
      labels.push({
        label: cursor.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
        left: (daysBetween(minDate, cursor) / totalDays) * 100,
      })
      cursor.setMonth(cursor.getMonth() + 1)
      cursor.setDate(1)
    }
    return labels
  }, [minDate, totalDays])

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Month headers */}
        <div className="relative h-6 border-b mb-1 text-xs text-muted-foreground">
          {monthLabels.map(({ label, left }) => (
            <span
              key={label + left}
              className="absolute top-0 translate-x-1"
              style={{ left: `${left}%` }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Task rows */}
        <div className="space-y-1">
          {rows.map(({ task, left, width }) => (
            <div key={task.id} className="flex items-center gap-2 h-8">
              <div className="w-40 flex-shrink-0 text-xs truncate text-right pr-2 text-muted-foreground">
                {task.wbsCode && <span className="font-mono mr-1">{task.wbsCode}</span>}
                {task.name}
              </div>
              <div className="flex-1 relative h-5">
                <div
                  className={cn(
                    'absolute h-full rounded text-xs text-white flex items-center px-1 overflow-hidden whitespace-nowrap',
                    STATUS_BAR[task.status],
                  )}
                  style={{ left: `${left}%`, width: `${width}%`, minWidth: '4px' }}
                  title={`${task.startDate ?? '?'} → ${task.dueDate ?? '?'}`}
                >
                  {width > 8 ? task.name : ''}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-3 mt-4 flex-wrap text-xs text-muted-foreground">
          {Object.entries(STATUS_BAR).map(([s, cls]) => (
            <span key={s} className="flex items-center gap-1">
              <span className={cn('w-3 h-3 rounded', cls)} />
              {s.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
