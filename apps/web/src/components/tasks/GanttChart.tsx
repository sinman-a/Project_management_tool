import { useMemo, useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Task, TaskLink } from '@/types'

const STATUS_BAR: Record<string, string> = {
  backlog:     'bg-gray-300',
  todo:        'bg-blue-300',
  in_progress: 'bg-indigo-400',
  review:      'bg-purple-400',
  done:        'bg-green-400',
  cancelled:   'bg-red-200',
}

const ROW_H = 36 // h-8 (32px) + space-y-1 gap (4px)
const BAR_H = 20 // bar height inside the row
const BAR_OFFSET_Y = (ROW_H - BAR_H) / 2 // vertical center of bar inside row

function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null
  const p = new Date(d)
  return isNaN(p.getTime()) ? null : p
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000)
}

interface Arrow {
  id: string
  x1: number; y1: number
  x2: number; y2: number
}

interface Props {
  tasks: Task[]
  links?: TaskLink[]
}

export function GanttChart({ tasks, links = [] }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(0)

  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setChartWidth(e.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

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

  // Build task-id → row-index map (only tasks that appear as rows)
  const rowIndexById = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r, i) => m.set(r.task.id, i))
    return m
  }, [rows])

  // Build SVG arrows for predecessor/successor links
  const arrows = useMemo((): Arrow[] => {
    if (!chartWidth || chartWidth === 0) return []

    return links
      .filter((l) => l.linkType === 'predecessor' || l.linkType === 'successor')
      .map((link) => {
        // For predecessor: source finishes → target starts
        // For successor: treat same as predecessor in reverse
        const [srcId, tgtId] =
          link.linkType === 'predecessor'
            ? [link.sourceTaskId, link.targetTaskId]
            : [link.targetTaskId, link.sourceTaskId]

        const srcIdx = rowIndexById.get(srcId)
        const tgtIdx = rowIndexById.get(tgtId)
        if (srcIdx === undefined || tgtIdx === undefined) return null

        const srcRow = rows[srcIdx]
        const tgtRow = rows[tgtIdx]

        // Right edge of source bar
        const x1 = ((srcRow.left + srcRow.width) / 100) * chartWidth
        const y1 = srcIdx * ROW_H + BAR_OFFSET_Y + BAR_H / 2

        // Left edge of target bar
        const x2 = (tgtRow.left / 100) * chartWidth
        const y2 = tgtIdx * ROW_H + BAR_OFFSET_Y + BAR_H / 2

        return { id: link.id, x1, y1, x2, y2 }
      })
      .filter(Boolean) as Arrow[]
  }, [links, rows, rowIndexById, chartWidth])

  function arrowPath({ x1, y1, x2, y2 }: Arrow): string {
    const gap = 12
    const midX = x1 + gap

    if (x2 > midX) {
      // Target is to the right — simple elbow
      return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`
    } else {
      // Target is to the left or very close — loop around
      const loopY = Math.max(y1, y2) + ROW_H * 0.6
      return `M ${x1} ${y1} H ${midX} V ${loopY} H ${x2 - gap} V ${y2} H ${x2}`
    }
  }

  if (!minDate || rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Add start/due dates to tasks to see the Gantt chart.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Month headers */}
        <div className="relative h-6 border-b mb-1 text-xs text-muted-foreground ml-40">
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

        {/* Task rows with SVG overlay */}
        <div className="flex">
          {/* Labels column */}
          <div className="w-40 flex-shrink-0 space-y-1">
            {rows.map(({ task }) => (
              <div key={task.id} className="h-8 flex items-center justify-end pr-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {task.wbsCode && <span className="font-mono mr-1">{task.wbsCode}</span>}
                  {task.name}
                </span>
              </div>
            ))}
          </div>

          {/* Chart area with bars + SVG arrows */}
          <div ref={chartRef} className="flex-1 relative space-y-1">
            {rows.map(({ task, left, width }) => (
              <div key={task.id} className="h-8 relative">
                <div
                  className={cn(
                    'absolute h-5 top-1.5 rounded text-xs text-white flex items-center px-1 overflow-hidden whitespace-nowrap',
                    STATUS_BAR[task.status],
                  )}
                  style={{ left: `${left}%`, width: `${width}%`, minWidth: '4px' }}
                  title={`${task.startDate ?? '?'} → ${task.dueDate ?? '?'}`}
                >
                  {width > 8 ? task.name : ''}
                </div>
              </div>
            ))}

            {/* SVG arrows for dependencies */}
            {arrows.length > 0 && chartWidth > 0 && (
              <svg
                className="absolute inset-0 pointer-events-none"
                width={chartWidth}
                height={rows.length * ROW_H}
                style={{ overflow: 'visible' }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L6,3 z" fill="#f97316" />
                  </marker>
                </defs>
                {arrows.map((arrow) => (
                  <path
                    key={arrow.id}
                    d={arrowPath(arrow)}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    markerEnd="url(#arrowhead)"
                  />
                ))}
              </svg>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-3 mt-4 flex-wrap text-xs text-muted-foreground ml-40">
          {Object.entries(STATUS_BAR).map(([s, cls]) => (
            <span key={s} className="flex items-center gap-1">
              <span className={cn('w-3 h-3 rounded', cls)} />
              {s.replace('_', ' ')}
            </span>
          ))}
          {arrows.length > 0 && (
            <span className="flex items-center gap-1">
              <svg width="20" height="10">
                <path d="M0,5 H14" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 2" />
                <path d="M11,2 L15,5 L11,8 z" fill="#f97316" />
              </svg>
              Predecessor
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
