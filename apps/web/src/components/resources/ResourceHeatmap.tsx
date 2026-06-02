import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useCapacityHeatmap, useCapacityCell } from '@/hooks/useCapacity'
import type { CapacityWeek } from '@/types'

const BAND_CLS: Record<string, string> = {
  empty: 'bg-muted/20 text-muted-foreground/50',
  low: 'bg-blue-50 text-blue-700',
  light: 'bg-green-50 text-green-700',
  good: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800 font-medium',
  red: 'bg-red-100 text-red-700 font-bold',
}

interface CellDrawerProps {
  resourceId: string
  resourceName: string
  week: CapacityWeek
  onClose: () => void
}

function CellDrawer({ resourceId, resourceName, week, onClose }: CellDrawerProps) {
  const { data } = useCapacityCell(resourceId, week.week)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-xl p-5 w-full max-w-md mx-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{resourceName} — {week.week}</h3>
          <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>✕</button>
        </div>
        <p className="text-xs text-muted-foreground">
          {week.allocated}h / {week.capacity}h ({week.utilisation}%)
        </p>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {data?.tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
              <div>
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.projectName}</p>
              </div>
              <span className="text-xs font-medium">{t.allocatedHours}h</span>
            </div>
          ))}
          {!data?.tasks.length && <p className="text-xs text-muted-foreground">No tasks found for this period.</p>}
        </div>
      </div>
    </div>
  )
}

interface Props {
  projectId?: string
  programId?: string
}

export function ResourceHeatmap({ projectId, programId }: Props) {
  const [selectedCell, setSelectedCell] = useState<{ resourceId: string; resourceName: string; week: CapacityWeek } | null>(null)

  const { data: heatmap, isLoading } = useCapacityHeatmap({ projectId, programId })

  if (isLoading) return <div className="py-10 text-center text-muted-foreground text-sm">Loading capacity data…</div>

  if (!heatmap || heatmap.resources.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm border rounded-lg">
        No capacity data yet. Assign tasks to resources to see this view.
      </div>
    )
  }

  const weeks = heatmap.weeks

  return (
    <>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[160px] sticky left-0 bg-background">
                Resource
              </th>
              {weeks.map((w) => (
                <th key={w} className="text-center py-2 px-1 font-medium text-muted-foreground w-[72px]">
                  {w.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.resources.map((r) => (
              <tr key={r.resourceId} className="border-t hover:bg-muted/30 transition-colors">
                <td className="py-1.5 px-3 sticky left-0 bg-background">
                  <p className="font-medium truncate max-w-[150px]">{r.resourceName}</p>
                  {r.role && <p className="text-[10px] text-muted-foreground truncate">{r.role}</p>}
                </td>
                {r.weeks.map((w) => (
                  <td key={w.week} className="py-1 px-0.5 text-center">
                    <button
                      className={cn(
                        'rounded text-[11px] py-1 px-0.5 mx-0.5 w-full min-w-[60px] transition-colors cursor-pointer hover:opacity-80',
                        BAND_CLS[w.band],
                      )}
                      title={`${w.allocated}h / ${r.capacity}h (${w.utilisation}%)\n${w.projects.map((p) => `${p.name}: ${p.hours}h`).join('\n')}`}
                      onClick={() => setSelectedCell({ resourceId: r.resourceId, resourceName: r.resourceName, week: w })}
                    >
                      {w.band === 'empty' ? '—' : `${w.utilisation}%`}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex gap-3 mt-3 text-[10px] text-muted-foreground">
          {[
            { label: '< 50%', cls: 'bg-blue-50' },
            { label: '50–80%', cls: 'bg-green-50' },
            { label: '80–100%', cls: 'bg-green-100' },
            { label: '100–120%', cls: 'bg-amber-100' },
            { label: '> 120%', cls: 'bg-red-100' },
          ].map(({ label, cls }) => (
            <span key={label} className="flex items-center gap-1">
              <span className={cn('w-3 h-3 rounded inline-block border border-border/50', cls)} />{label}
            </span>
          ))}
        </div>
      </div>

      {selectedCell && (
        <CellDrawer
          resourceId={selectedCell.resourceId}
          resourceName={selectedCell.resourceName}
          week={selectedCell.week}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </>
  )
}
