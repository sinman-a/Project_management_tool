import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface HeatmapRow {
  resourceId: string
  resourceName: string
  weekStart: string
  allocatedHours: number
  capacityHoursPerWeek: number
  type: string
}

function utilizationColor(pct: number): string {
  if (pct === 0) return 'bg-muted/30 text-muted-foreground'
  if (pct <= 50) return 'bg-blue-50 text-blue-700'
  if (pct <= 80) return 'bg-green-100 text-green-800'
  if (pct <= 100) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

function getWeeks(weeksBack: number, weeksForward: number): string[] {
  const today = new Date()
  const monday = new Date(today)
  const day = monday.getDay()
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)

  const weeks: string[] = []
  for (let i = -weeksBack; i <= weeksForward; i++) {
    const d = new Date(monday)
    d.setDate(d.getDate() + i * 7)
    weeks.push(d.toISOString().slice(0, 10))
  }
  return weeks
}

export function ResourceHeatmap() {
  const weeksBack = 6
  const weeksForward = 3

  const { data = [], isLoading } = useQuery({
    queryKey: ['resource-heatmap'],
    queryFn: () => api.get<HeatmapRow[]>(`/resources/heatmap?weeksBack=${weeksBack}&weeksForward=${weeksForward}`),
    staleTime: 5 * 60_000,
  })

  const weeks = getWeeks(weeksBack, weeksForward)
  const todayWeek = getWeeks(0, 0)[0]

  // Group by resource
  const resourceMap = new Map<string, { name: string; weeks: Map<string, number>; capacity: number }>()
  for (const row of data) {
    if (!resourceMap.has(row.resourceId)) {
      resourceMap.set(row.resourceId, { name: row.resourceName, weeks: new Map(), capacity: row.capacityHoursPerWeek })
    }
    resourceMap.get(row.resourceId)!.weeks.set(row.weekStart, row.allocatedHours)
  }

  const resources = Array.from(resourceMap.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name))

  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground text-sm">Loading heatmap…</div>
  }

  if (resources.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm border rounded-lg">
        No allocation data yet. Time logs will populate this view.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse min-w-full">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[140px]">Resource</th>
            {weeks.map((w) => (
              <th
                key={w}
                className={cn(
                  'text-center py-2 px-1 font-medium text-muted-foreground w-[60px]',
                  w === todayWeek && 'text-primary',
                )}
              >
                <div>{w === todayWeek ? '▶ Now' : w.slice(5)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map(([id, { name, weeks: wMap, capacity }]) => (
            <tr key={id} className="border-t">
              <td className="py-1.5 px-3 font-medium truncate max-w-[140px]">{name}</td>
              {weeks.map((w) => {
                const hours = wMap.get(w) ?? 0
                const pct = capacity > 0 ? (hours / capacity) * 100 : 0
                return (
                  <td key={w} className="py-1 px-0.5 text-center">
                    <div
                      className={cn(
                        'rounded text-[10px] py-1 px-0.5 mx-0.5',
                        utilizationColor(pct),
                        w === todayWeek && 'ring-1 ring-primary',
                      )}
                      title={`${name}: ${hours}h / ${capacity}h (${Math.round(pct)}%)`}
                    >
                      {pct > 0 ? `${Math.round(pct)}%` : '—'}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-3 mt-3 text-[10px] text-muted-foreground">
        {[
          { label: '1–50%', cls: 'bg-blue-50' },
          { label: '51–80%', cls: 'bg-green-100' },
          { label: '81–100%', cls: 'bg-amber-100' },
          { label: '>100%', cls: 'bg-red-100' },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={cn('w-3 h-3 rounded inline-block', cls)} />{label}
          </span>
        ))}
      </div>
    </div>
  )
}
