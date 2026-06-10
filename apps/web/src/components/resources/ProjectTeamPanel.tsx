import { useState } from 'react'
import { Users, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjectAssignments, useAddAssignment } from '@/hooks/useAssignments'
import { useCapacityHeatmap } from '@/hooks/useCapacity'
import { useTasks } from '@/hooks/useTasks'

const BAND_CLS: Record<string, string> = {
  empty: 'bg-muted/30',
  low: 'bg-blue-100',
  light: 'bg-green-100',
  good: 'bg-green-300',
  amber: 'bg-amber-300',
  red: 'bg-red-400',
}

interface Props {
  projectId: string
  canEdit: boolean
}

export function ProjectTeamPanel({ projectId, canEdit }: Props) {
  const { data: assignments = [], isLoading } = useProjectAssignments(projectId)
  const { data: tasks = [] } = useTasks(projectId)
  const { data: heatmap } = useCapacityHeatmap({ projectId })
  const addAssignment = useAddAssignment()

  const [editCell, setEditCell] = useState<{ resourceId: string; taskId: string } | null>(null)
  const [cellHours, setCellHours] = useState('')

  // Unique resources from assignments
  const resourceMap = new Map<string, { id: string; name: string; role: string | null; rate: number }>()
  for (const a of assignments) {
    if (!resourceMap.has(a.resourceId)) {
      resourceMap.set(a.resourceId, { id: a.resourceId, name: a.resourceName ?? '—', role: a.resourceRole ?? null, rate: a.rate ?? 0 })
    }
  }
  const resources = [...resourceMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  // allocated hours lookup: resourceId|taskId → hours
  const cellKey = (rid: string, tid: string) => `${rid}|${tid}`
  const cellHoursMap = new Map<string, number>()
  for (const a of assignments) cellHoursMap.set(cellKey(a.resourceId, a.taskId), a.allocatedHours)

  // Per-resource totals
  const plannedByResource = new Map<string, number>()
  for (const a of assignments) plannedByResource.set(a.resourceId, (plannedByResource.get(a.resourceId) ?? 0) + a.allocatedHours)

  // Weekly utilisation per resource (peak %) + over-allocation alerts
  const heatByResource = new Map(heatmap?.resources.map((r) => [r.resourceId, r]) ?? [])
  const peakUtil = (rid: string) => {
    const r = heatByResource.get(rid)
    if (!r) return 0
    return Math.max(0, ...r.weeks.map((w) => w.utilisation))
  }
  const overAlloc = (heatmap?.resources ?? []).flatMap((r) =>
    r.weeks.filter((w) => w.utilisation > 100).map((w) => ({ name: r.resourceName, week: w.week, util: w.utilisation })),
  )

  // Tasks shown as matrix columns: those with assignments, else all project tasks
  const assignedTaskIds = new Set(assignments.map((a) => a.taskId))
  const matrixTasks = tasks.filter((t) => assignedTaskIds.has(t.id) || resources.length > 0)

  function saveCell(resourceId: string, taskId: string) {
    addAssignment.mutate(
      { taskId, resourceId, allocatedHours: parseFloat(cellHours) || 0 },
      { onSuccess: () => setEditCell(null) },
    )
  }

  if (isLoading) return <div className="py-12 text-center text-muted-foreground text-sm">Loading team…</div>

  if (resources.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm border rounded-lg">
        No resources assigned to this project yet. Open a task and assign resources with planned hours.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Over-allocation alerts */}
      {overAlloc.length > 0 && (
        <div className="flex items-start gap-2 text-sm border border-amber-300 bg-amber-50 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-medium text-amber-700">Over-allocation detected.</span>
            <span className="text-amber-700/80 ml-1">
              {overAlloc.slice(0, 4).map((o) => `${o.name} (${o.week}: ${o.util}%)`).join(', ')}
              {overAlloc.length > 4 ? ` +${overAlloc.length - 4} more` : ''}
            </span>
          </div>
        </div>
      )}

      {/* Roster */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">
          <Users className="inline-block w-4 h-4 mr-2 text-primary" /> Team Roster
        </CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-2 font-medium">Resource</th>
                <th className="text-right px-4 py-2 font-medium">Planned h</th>
                <th className="text-right px-4 py-2 font-medium">Planned cost</th>
                <th className="text-right px-4 py-2 font-medium">Peak util.</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => {
                const planned = plannedByResource.get(r.id) ?? 0
                const peak = peakUtil(r.id)
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <span className="font-medium">{r.name}</span>
                      {r.role && <span className="text-xs text-muted-foreground ml-1.5">· {r.role}</span>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{planned}h</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{(planned * r.rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className={cn('px-4 py-2 text-right tabular-nums font-medium', peak > 120 ? 'text-red-600' : peak > 100 ? 'text-amber-600' : '')}>
                      {peak}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Allocation matrix Resource × Task */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Allocation Matrix (planned hours)</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="text-sm border-collapse min-w-max">
            <thead>
              <tr className="bg-muted/40">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground sticky left-0 bg-muted/40 min-w-[160px]">Resource</th>
                {matrixTasks.map((t) => (
                  <th key={t.id} className="px-2 py-2 text-xs font-medium text-muted-foreground w-20 text-center" title={t.name}>
                    <span className="line-clamp-2">{t.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-1.5 sticky left-0 bg-background font-medium truncate max-w-[160px]">{r.name}</td>
                  {matrixTasks.map((t) => {
                    const hours = cellHoursMap.get(cellKey(r.id, t.id)) ?? 0
                    const editing = editCell?.resourceId === r.id && editCell?.taskId === t.id
                    return (
                      <td key={t.id} className="border border-border/40 text-center w-20 p-0">
                        {editing ? (
                          <input
                            type="number" min="0" step="0.5" autoFocus
                            className="w-full text-center text-sm py-1 bg-primary/5 focus:outline-none"
                            value={cellHours}
                            onChange={(e) => setCellHours(e.target.value)}
                            onBlur={() => saveCell(r.id, t.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveCell(r.id, t.id); if (e.key === 'Escape') setEditCell(null) }}
                          />
                        ) : (
                          <button
                            type="button"
                            className={cn('w-full py-1 text-sm tabular-nums', canEdit ? 'hover:bg-muted cursor-pointer' : 'cursor-default', hours === 0 && 'text-muted-foreground/30')}
                            onClick={() => { if (canEdit) { setEditCell({ resourceId: r.id, taskId: t.id }); setCellHours(hours ? String(hours) : '') } }}
                            disabled={!canEdit}
                          >
                            {hours > 0 ? hours : '—'}
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Weekly utilisation strip */}
      {heatmap && heatmap.resources.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Weekly utilisation (this project)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left pr-3 py-1 font-medium text-muted-foreground sticky left-0 bg-background min-w-[140px]">Resource</th>
                  {heatmap.weeks.map((w) => (
                    <th key={w} className="px-0.5 py-1 font-normal text-muted-foreground w-9 text-center">{w.slice(5)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.resources.map((r) => (
                  <tr key={r.resourceId}>
                    <td className="pr-3 py-0.5 sticky left-0 bg-background truncate max-w-[140px]">{r.resourceName}</td>
                    {r.weeks.map((w) => (
                      <td key={w.week} className="p-0.5">
                        <div
                          className={cn('h-5 rounded-sm flex items-center justify-center text-[9px]', BAND_CLS[w.band])}
                          title={`${w.allocated}h / ${w.capacity}h (${w.utilisation}%)`}
                        >
                          {w.utilisation > 0 ? w.utilisation : ''}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
              {[['80–100%', 'good'], ['100–120%', 'amber'], ['>120%', 'red']].map(([label, band]) => (
                <span key={label} className="flex items-center gap-1">
                  <span className={cn('w-3 h-3 rounded-sm', BAND_CLS[band])} /> {label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
