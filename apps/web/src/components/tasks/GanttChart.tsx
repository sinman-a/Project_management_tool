import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { Task, TaskLink, TaskDependency, CpmFields } from '@/types'

const STATUS_BAR: Record<string, string> = {
  backlog:     'bg-gray-300',
  todo:        'bg-blue-300',
  in_progress: 'bg-indigo-400',
  review:      'bg-purple-400',
  done:        'bg-green-400',
  cancelled:   'bg-red-200',
}

const ROW_H = 36
const BAR_H = 20
const BAR_OFFSET_Y = (ROW_H - BAR_H) / 2

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
  isCritical?: boolean
  dep?: TaskDependency
}

interface DragState {
  fromTaskId: string
  fromRow: number
  startX: number
  startY: number
  curX: number
  curY: number
}

interface Props {
  tasks: Task[]
  links?: TaskLink[]
  dependencies?: TaskDependency[]
  cpmData?: Map<string, CpmFields>
  onCreateDependency?: (predId: string, succId: string) => void
  onArrowClick?: (dep: TaskDependency) => void
}

export function GanttChart({
  tasks,
  links = [],
  dependencies = [],
  cpmData,
  onCreateDependency,
  onArrowClick,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(0)
  const [showCriticalPath, setShowCriticalPath] = useState(true)
  const [drag, setDrag] = useState<DragState | null>(null)

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

  const rowIndexById = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r, i) => m.set(r.task.id, i))
    return m
  }, [rows])

  // Helper: get X position for an edge of a bar
  function barEdgeX(row: { left: number; width: number }, edge: 'left' | 'right'): number {
    if (edge === 'left') return (row.left / 100) * chartWidth
    return ((row.left + row.width) / 100) * chartWidth
  }

  function rowMidY(rowIdx: number): number {
    return rowIdx * ROW_H + BAR_OFFSET_Y + BAR_H / 2
  }

  // Dashed-orange arrows from task_links (predecessor/successor)
  const linkArrows = useMemo((): Arrow[] => {
    if (!chartWidth) return []
    return links
      .filter((l) => l.linkType === 'predecessor' || l.linkType === 'successor')
      .map((link) => {
        const [srcId, tgtId] =
          link.linkType === 'predecessor'
            ? [link.sourceTaskId, link.targetTaskId]
            : [link.targetTaskId, link.sourceTaskId]
        const srcIdx = rowIndexById.get(srcId)
        const tgtIdx = rowIndexById.get(tgtId)
        if (srcIdx === undefined || tgtIdx === undefined) return null
        const srcRow = rows[srcIdx]
        const tgtRow = rows[tgtIdx]
        return {
          id: link.id,
          x1: barEdgeX(srcRow, 'right'),
          y1: rowMidY(srcIdx),
          x2: barEdgeX(tgtRow, 'left'),
          y2: rowMidY(tgtIdx),
        }
      })
      .filter(Boolean) as Arrow[]
  }, [links, rows, rowIndexById, chartWidth])

  // Solid CPM arrows from task_dependencies
  const cpmArrows = useMemo((): Arrow[] => {
    if (!chartWidth || !showCriticalPath && cpmData) return []
    return dependencies
      .map((dep) => {
        const predIdx = rowIndexById.get(dep.dependsOnId)
        const succIdx = rowIndexById.get(dep.taskId)
        if (predIdx === undefined || succIdx === undefined) return null

        const predRow = rows[predIdx]
        const succRow = rows[succIdx]

        // Source/target edges by dependency type
        let x1: number, x2: number
        switch (dep.dependencyType) {
          case 'start_to_start':
            x1 = barEdgeX(predRow, 'left')
            x2 = barEdgeX(succRow, 'left')
            break
          case 'finish_to_finish':
            x1 = barEdgeX(predRow, 'right')
            x2 = barEdgeX(succRow, 'right')
            break
          case 'start_to_finish':
            x1 = barEdgeX(predRow, 'left')
            x2 = barEdgeX(succRow, 'right')
            break
          default: // finish_to_start
            x1 = barEdgeX(predRow, 'right')
            x2 = barEdgeX(succRow, 'left')
        }

        const isCritical = !!(
          showCriticalPath &&
          cpmData?.get(dep.dependsOnId)?.isCritical &&
          cpmData?.get(dep.taskId)?.isCritical
        )

        return {
          id: dep.id,
          x1,
          y1: rowMidY(predIdx),
          x2,
          y2: rowMidY(succIdx),
          isCritical,
          dep,
        }
      })
      .filter(Boolean) as Arrow[]
  }, [dependencies, rows, rowIndexById, chartWidth, showCriticalPath, cpmData])

  function arrowPath({ x1, y1, x2, y2 }: Arrow): string {
    const gap = 12
    const midX = x1 + gap
    if (x2 > midX) {
      return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`
    } else {
      const loopY = Math.max(y1, y2) + ROW_H * 0.6
      return `M ${x1} ${y1} H ${midX} V ${loopY} H ${x2 - gap} V ${y2} H ${x2}`
    }
  }

  // Drag-to-create dependency
  const handleDragStart = useCallback((e: React.MouseEvent, taskId: string, rowIdx: number) => {
    if (!onCreateDependency) return
    e.preventDefault()
    e.stopPropagation()
    const rect = chartRef.current?.getBoundingClientRect()
    if (!rect) return
    const startX = e.clientX - rect.left
    const startY = e.clientY - rect.top
    setDrag({ fromTaskId: taskId, fromRow: rowIdx, startX, startY, curX: startX, curY: startY })
  }, [onCreateDependency])

  useEffect(() => {
    if (!drag) return

    function onMove(e: MouseEvent) {
      const rect = chartRef.current?.getBoundingClientRect()
      if (!rect) return
      setDrag((d) => d ? { ...d, curX: e.clientX - rect.left, curY: e.clientY - rect.top } : null)
    }

    function onUp(e: MouseEvent) {
      const rect = chartRef.current?.getBoundingClientRect()
      if (!rect || !drag) { setDrag(null); return }
      const relY = e.clientY - rect.top
      const targetRowIdx = Math.floor(relY / ROW_H)
      const targetRow = rows[targetRowIdx]
      if (
        targetRow &&
        targetRow.task.id !== drag.fromTaskId &&
        targetRow.task.status !== 'cancelled' &&
        onCreateDependency
      ) {
        onCreateDependency(drag.fromTaskId, targetRow.task.id)
      }
      setDrag(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [drag, rows, onCreateDependency])

  if (!minDate || rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Add start/due dates to tasks to see the Gantt chart.
      </div>
    )
  }

  const hasCpmArrows = cpmArrows.length > 0
  const hasLinkArrows = linkArrows.length > 0

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Controls */}
        {hasCpmArrows && (
          <div className="flex items-center gap-2 mb-2 ml-40">
            <button
              type="button"
              onClick={() => setShowCriticalPath((v) => !v)}
              className={cn(
                'text-xs px-2 py-0.5 rounded border transition-colors',
                showCriticalPath
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-muted border-border text-muted-foreground',
              )}
            >
              {showCriticalPath ? 'Critical path ON' : 'Critical path OFF'}
            </button>
          </div>
        )}

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

          {/* Chart area */}
          <div ref={chartRef} className="flex-1 relative space-y-1" style={{ cursor: drag ? 'crosshair' : undefined }}>
            {rows.map(({ task, left, width }, rowIdx) => {
              const cpm = cpmData?.get(task.id)
              const isCritical = showCriticalPath && cpm?.isCritical
              return (
                <div key={task.id} className="h-8 relative">
                  <div
                    className={cn(
                      'absolute h-5 top-1.5 rounded text-xs text-white flex items-center px-1 overflow-hidden whitespace-nowrap',
                      STATUS_BAR[task.status],
                      isCritical && 'border-t-2 border-red-600',
                    )}
                    style={{ left: `${left}%`, width: `${width}%`, minWidth: '4px' }}
                    title={`${task.startDate ?? '?'} → ${task.dueDate ?? '?'}${cpm ? ` | Float: ${cpm.totalFloat}d` : ''}`}
                  >
                    {width > 8 ? task.name : ''}
                  </div>
                  {/* Drag handle — right edge of bar */}
                  {onCreateDependency && (
                    <div
                      className="absolute top-1.5 h-5 w-2 cursor-crosshair z-10"
                      style={{ left: `calc(${left}% + ${width}% - 6px)`, width: '8px' }}
                      onMouseDown={(e) => handleDragStart(e, task.id, rowIdx)}
                      title="Drag to create dependency"
                    />
                  )}
                </div>
              )
            })}

            {/* SVG layer: all arrows + live drag line */}
            {(linkArrows.length > 0 || cpmArrows.length > 0 || drag) && chartWidth > 0 && (
              <svg
                className="absolute inset-0 pointer-events-none"
                width={chartWidth}
                height={rows.length * ROW_H}
                style={{ overflow: 'visible' }}
              >
                <defs>
                  <marker id="arrow-orange" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="#f97316" />
                  </marker>
                  <marker id="arrow-critical" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="#dc2626" />
                  </marker>
                  <marker id="arrow-gray" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="#9ca3af" />
                  </marker>
                </defs>

                {/* Task link arrows (dashed orange) */}
                {linkArrows.map((arrow) => (
                  <path
                    key={arrow.id}
                    d={arrowPath(arrow)}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    markerEnd="url(#arrow-orange)"
                  />
                ))}

                {/* CPM dependency arrows (solid) */}
                {cpmArrows.map((arrow) => (
                  <path
                    key={arrow.id}
                    d={arrowPath(arrow)}
                    fill="none"
                    stroke={arrow.isCritical ? '#dc2626' : '#9ca3af'}
                    strokeWidth={arrow.isCritical ? 2 : 1.5}
                    markerEnd={arrow.isCritical ? 'url(#arrow-critical)' : 'url(#arrow-gray)'}
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => arrow.dep && onArrowClick?.(arrow.dep)}
                  />
                ))}

                {/* Live drag line */}
                {drag && (
                  <line
                    x1={drag.startX}
                    y1={drag.startY}
                    x2={drag.curX}
                    y2={drag.curY}
                    stroke="#6366f1"
                    strokeWidth="2"
                    strokeDasharray="6 3"
                  />
                )}
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
          {hasLinkArrows && (
            <span className="flex items-center gap-1">
              <svg width="20" height="10">
                <path d="M0,5 H14" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 2" />
                <path d="M11,2 L15,5 L11,8 z" fill="#f97316" />
              </svg>
              Predecessor link
            </span>
          )}
          {hasCpmArrows && (
            <>
              <span className="flex items-center gap-1">
                <svg width="20" height="10">
                  <path d="M0,5 H14" stroke="#dc2626" strokeWidth="2" />
                  <path d="M11,2 L15,5 L11,8 z" fill="#dc2626" />
                </svg>
                Critical
              </span>
              <span className="flex items-center gap-1">
                <svg width="20" height="10">
                  <path d="M0,5 H14" stroke="#9ca3af" strokeWidth="1.5" />
                  <path d="M11,2 L15,5 L11,8 z" fill="#9ca3af" />
                </svg>
                Dependency
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
