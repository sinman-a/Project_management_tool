import { useMemo, useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { Project, ProjectDependency } from '@/types'

const RAG_BAR: Record<string, string> = {
  green: 'bg-green-300 hover:bg-green-400',
  amber: 'bg-amber-300 hover:bg-amber-400',
  red: 'bg-red-300 hover:bg-red-400',
}

const ROW_H = 44
const BAR_H = 24
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
}

interface Props {
  projects: Project[]
  dependencies: ProjectDependency[]
  canEdit?: boolean
}

export function ProgramRoadmap({ projects, dependencies }: Props) {
  const navigate = useNavigate()
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
    const dated = projects
      .filter((p) => parseDate(p.startDate))
      .map((p) => ({
        project: p,
        start: parseDate(p.startDate)!,
        end: parseDate(p.endDate),
      }))

    if (dated.length === 0) return { minDate: null, totalDays: 0, rows: [] }

    const allDates = dated.flatMap(({ start, end }) => [start, end].filter(Boolean) as Date[])
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))
    minDate.setDate(minDate.getDate() - 7)
    maxDate.setDate(maxDate.getDate() + 14)
    const totalDays = daysBetween(minDate, maxDate)

    const rows = dated.map(({ project, start, end }) => {
      const effectiveEnd = end ?? new Date(start.getTime() + 30 * 86400000)
      const left = (daysBetween(minDate, start) / totalDays) * 100
      const width = Math.max((daysBetween(start, effectiveEnd) + 1) / totalDays * 100, 1.5)
      return { project, left, width }
    })

    return { minDate, totalDays, rows }
  }, [projects])

  const rowIndexById = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r, i) => m.set(r.project.id, i))
    return m
  }, [rows])

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

  const arrows = useMemo((): Arrow[] => {
    if (!chartWidth) return []
    return dependencies
      .map((dep) => {
        const predIdx = rowIndexById.get(dep.dependsOnId)
        const succIdx = rowIndexById.get(dep.projectId)
        if (predIdx === undefined || succIdx === undefined) return null
        const predRow = rows[predIdx]
        const succRow = rows[succIdx]
        const x1 = ((predRow.left + predRow.width) / 100) * chartWidth
        const y1 = predIdx * ROW_H + BAR_OFFSET_Y + BAR_H / 2
        const x2 = (succRow.left / 100) * chartWidth
        const y2 = succIdx * ROW_H + BAR_OFFSET_Y + BAR_H / 2
        return { id: dep.id, x1, y1, x2, y2 }
      })
      .filter(Boolean) as Arrow[]
  }, [dependencies, rows, rowIndexById, chartWidth])

  function arrowPath({ x1, y1, x2, y2 }: Arrow): string {
    const gap = 14
    const midX = x1 + gap
    if (x2 > midX) {
      return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`
    } else {
      const loopY = Math.max(y1, y2) + ROW_H * 0.7
      return `M ${x1} ${y1} H ${midX} V ${loopY} H ${x2 - gap} V ${y2} H ${x2}`
    }
  }

  if (!minDate || rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        No projects with start dates. Add dates to projects to see the roadmap.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Month headers */}
        <div className="relative h-6 border-b mb-1 text-xs text-muted-foreground ml-48">
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

        <div className="flex">
          {/* Labels */}
          <div className="w-48 flex-shrink-0">
            {rows.map(({ project }) => (
              <div
                key={project.id}
                className="flex items-center justify-end pr-3 text-sm cursor-pointer hover:text-primary transition-colors"
                style={{ height: `${ROW_H}px` }}
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <span className="truncate">{project.name}</span>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div ref={chartRef} className="flex-1 relative">
            {rows.map(({ project, left, width }) => (
              <div key={project.id} className="relative" style={{ height: `${ROW_H}px` }}>
                <div
                  className={cn(
                    'absolute rounded text-xs text-gray-800 flex items-center px-2 overflow-hidden whitespace-nowrap cursor-pointer transition-colors',
                    RAG_BAR[project.ragStatus ?? 'green'] ?? 'bg-gray-200 hover:bg-gray-300',
                  )}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    minWidth: '6px',
                    height: `${BAR_H}px`,
                    top: `${BAR_OFFSET_Y}px`,
                  }}
                  title={`${project.startDate} → ${project.endDate ?? 'TBD'}`}
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  {width > 6 ? project.name : ''}
                </div>
              </div>
            ))}

            {arrows.length > 0 && chartWidth > 0 && (
              <svg
                className="absolute inset-0 pointer-events-none"
                width={chartWidth}
                height={rows.length * ROW_H}
                style={{ overflow: 'visible' }}
              >
                <defs>
                  <marker id="roadmap-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="#6366f1" />
                  </marker>
                </defs>
                {arrows.map((arrow) => (
                  <path
                    key={arrow.id}
                    d={arrowPath(arrow)}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="1.5"
                    markerEnd="url(#roadmap-arrow)"
                  />
                ))}
              </svg>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-3 mt-4 text-xs text-muted-foreground ml-48">
          {(['green', 'amber', 'red'] as const).map((rag) => (
            <span key={rag} className="flex items-center gap-1">
              <span className={cn('w-3 h-3 rounded', RAG_BAR[rag].split(' ')[0])} />
              {rag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
