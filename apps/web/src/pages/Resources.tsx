import { useState } from 'react'
import { Users, Pencil, Plus, Trash2, LayoutList, LayoutGrid, MapPin, Zap, Calendar, Activity, AlertTriangle, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useResources, useCreateResource, useUpdateResource, useDeleteResource, useResourceAllocationBreakdown } from '@/hooks/useResources'
import { EntityImportModal } from '@/components/import/EntityImportModal'
import { useOrgSettings } from '@/hooks/useOrg'
import { useCapacityHeatmap } from '@/hooks/useCapacity'
import { useAuthStore } from '@/stores/authStore'
import { ResourceForm } from '@/components/resources/ResourceForm'
import { ResourceHeatmap } from '@/components/resources/ResourceHeatmap'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Resource } from '@/types'

function OverAllocationBanner() {
  const { data: heatmap } = useCapacityHeatmap()
  const over = new Set(
    (heatmap?.resources ?? [])
      .filter((r) => r.weeks.some((w) => w.utilisation > 100))
      .map((r) => r.resourceId),
  )
  if (over.size === 0) return null
  return (
    <div className="flex items-center gap-2 text-sm border border-amber-300 bg-amber-50 rounded-lg px-3 py-2">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <span className="text-amber-700">
        <span className="font-medium">{over.size}</span> resource{over.size !== 1 ? 's' : ''} over-allocated in the planning window.
      </span>
    </div>
  )
}

function avatarSrc(r: Resource): string {
  if (r.avatarUrl) return r.avatarUrl
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(r.name)}&backgroundColor=3b82f6&textColor=ffffff`
}

function seniorityColor(s: string | null) {
  if (!s) return 'bg-gray-100 text-gray-600'
  const l = s.toLowerCase()
  if (l.includes('senior') || l.includes('lead')) return 'bg-purple-100 text-purple-700'
  if (l.includes('middle') || l.includes('mid')) return 'bg-blue-100 text-blue-700'
  return 'bg-green-100 text-green-700'
}

export function Resources() {
  const { user } = useAuthStore()
  const { data: resources = [], isLoading } = useResources()
  const { data: org } = useOrgSettings()
  const createResource = useCreateResource()
  const updateResource = useUpdateResource()
  const deleteResource = useDeleteResource()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Resource | null>(null)
  const [view, setView] = useState<'cards' | 'table' | 'capacity'>('cards')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [allocationFor, setAllocationFor] = useState<Resource | null>(null)

  const isAdmin = user?.role === 'admin'
  const enableArchetype = org?.settings?.enableArchetype ?? false
  const enableMotto = org?.settings?.enableMotto ?? false

  function handleClose() {
    setShowForm(false)
    setEditTarget(null)
  }

  function handleDelete(id: string) {
    deleteResource.mutate(id, { onSuccess: () => setConfirmDeleteId(null) })
  }

  const humans = resources.filter((r) => r.type === 'human')
  const equipment = resources.filter((r) => r.type === 'equipment')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resources</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {resources.length} resource{resources.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {resources.length > 0 && (
            <div className="flex border rounded-md overflow-hidden">
              <button
                onClick={() => setView('cards')}
                className={`px-2 py-1.5 text-xs flex items-center gap-1 transition-colors ${view === 'cards' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                <LayoutGrid className="w-3 h-3" /> Cards
              </button>
              <button
                onClick={() => setView('table')}
                className={`px-2 py-1.5 text-xs flex items-center gap-1 transition-colors ${view === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                <LayoutList className="w-3 h-3" /> Table
              </button>
              <button
                onClick={() => setView('capacity')}
                className={`px-2 py-1.5 text-xs flex items-center gap-1 transition-colors ${view === 'capacity' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                <Activity className="w-3 h-3" /> Capacity
              </button>
            </div>
          )}
          {isAdmin && !showForm && !editTarget && (
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="w-4 h-4 mr-2" /> Import CSV
            </Button>
          )}
          {isAdmin && !showForm && !editTarget && (
            <Button onClick={() => { setEditTarget(null); setShowForm(true) }}>
              <Plus className="w-4 h-4 mr-2" /> New Resource
            </Button>
          )}
        </div>
      </div>

      {(showForm || editTarget) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editTarget ? `Edit — ${editTarget.name}` : 'New Resource'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResourceForm
              resource={editTarget ?? undefined}
              isPending={createResource.isPending || updateResource.isPending}
              onCancel={handleClose}
              onSubmit={(data) => {
                if (editTarget) {
                  updateResource.mutate({ id: editTarget.id, ...data }, { onSuccess: handleClose })
                } else {
                  createResource.mutate(data, { onSuccess: handleClose })
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-base">Delete Resource?</h3>
            <p className="text-sm text-muted-foreground">
              This will permanently remove the resource. Time logs referencing it will be unaffected but the resource won't be selectable for new logs.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteResource.isPending}
                onClick={() => handleDelete(confirmDeleteId)}
              >
                {deleteResource.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No resources yet.</p>
          {isAdmin && (
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add first resource
            </Button>
          )}
        </div>
      ) : view === 'capacity' ? (
        <div className="space-y-4">
          <OverAllocationBanner />
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Capacity Heatmap</CardTitle></CardHeader>
            <CardContent>
              <ResourceHeatmap />
            </CardContent>
          </Card>
        </div>
      ) : view === 'table' ? (
        <TeamTable
          humans={humans}
          isAdmin={isAdmin}
          enableArchetype={enableArchetype}
          enableMotto={enableMotto}
          onEdit={(r) => { setEditTarget(r); setShowForm(false) }}
          onDelete={(id) => setConfirmDeleteId(id)}
          onShowAllocation={setAllocationFor}
        />
      ) : (
        <>
          {humans.length > 0 && (
            <ResourceGroup
              title="Human Resources"
              resources={humans}
              isAdmin={isAdmin}
              enableArchetype={enableArchetype}
              enableMotto={enableMotto}
              onEdit={(r) => { setEditTarget(r); setShowForm(false) }}
              onDelete={(id) => setConfirmDeleteId(id)}
              onShowAllocation={setAllocationFor}
            />
          )}
          {equipment.length > 0 && (
            <ResourceGroup
              title="Equipment"
              resources={equipment}
              isAdmin={isAdmin}
              enableArchetype={false}
              enableMotto={false}
              onEdit={(r) => { setEditTarget(r); setShowForm(false) }}
              onDelete={(id) => setConfirmDeleteId(id)}
              onShowAllocation={setAllocationFor}
            />
          )}
        </>
      )}

      {showImport && <EntityImportModal entityType="resource" onClose={() => setShowImport(false)} />}
      {allocationFor && <AllocationModal resource={allocationFor} onClose={() => setAllocationFor(null)} />}
    </div>
  )
}

function AllocationModal({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const navigate = useNavigate()
  const { data, isLoading } = useResourceAllocationBreakdown(resource.id)
  const totalHours = (data?.projects ?? []).reduce((s, p) => s + (p.allocatedHours ?? 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Allocation — {resource.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">✕</button>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : (data?.projects.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No active task assignments for this resource.</p>
        ) : (
          <div className="space-y-1.5">
            {data!.projects.map((p) => (
              <button
                key={p.projectId}
                onClick={() => { navigate(`/projects/${p.projectId}`); onClose() }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border hover:bg-accent transition-colors text-left"
              >
                <span className="text-sm font-medium truncate">{p.projectName}</span>
                <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                  {p.allocatedHours}h{totalHours > 0 ? ` · ${Math.round((p.allocatedHours / totalHours) * 100)}%` : ''}
                </span>
              </button>
            ))}
            <div className="flex justify-between pt-2 text-xs text-muted-foreground border-t mt-2">
              <span>Total allocated</span>
              <span className="tabular-nums">{totalHours}h across {data!.projects.length} project{data!.projects.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ResourceGroup({
  title, resources, isAdmin, enableArchetype, enableMotto, onEdit, onDelete, onShowAllocation,
}: {
  title: string
  resources: Resource[]
  isAdmin: boolean
  enableArchetype: boolean
  enableMotto: boolean
  onEdit: (r: Resource) => void
  onDelete: (id: string) => void
  onShowAllocation: (r: Resource) => void
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {resources.map((r) => (
          <ResourceCard
            key={r.id}
            resource={r}
            isAdmin={isAdmin}
            enableArchetype={enableArchetype}
            enableMotto={enableMotto}
            onEdit={onEdit}
            onDelete={onDelete}
            onShowAllocation={onShowAllocation}
          />
        ))}
      </div>
    </div>
  )
}

function ResourceCard({ resource: r, isAdmin, enableArchetype, enableMotto, onEdit, onDelete, onShowAllocation }: {
  resource: Resource
  isAdmin: boolean
  enableArchetype: boolean
  enableMotto: boolean
  onEdit: (r: Resource) => void
  onDelete: (id: string) => void
  onShowAllocation: (r: Resource) => void
}) {
  const isHuman = r.type === 'human'
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {isHuman && (
              <img
                src={avatarSrc(r)}
                alt={r.name}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-border"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(r.name)}&backgroundColor=3b82f6&textColor=ffffff`
                }}
              />
            )}
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate">{r.name}</CardTitle>
              {isHuman && r.role && (
                <p className="text-xs text-muted-foreground truncate">{r.role}</p>
              )}
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0 items-start">
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${r.costType === 'capex' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
              {r.costType.toUpperCase()}
            </span>
            {isAdmin && (
              <>
                <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => onEdit(r)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="w-6 h-6 text-destructive hover:text-destructive" onClick={() => onDelete(r.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-1.5 text-sm text-muted-foreground">
        {isHuman && r.seniorityLevel && (
          <div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${seniorityColor(r.seniorityLevel)}`}>
              {r.seniorityLevel}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Rate</span>
          <span className="font-medium text-foreground">{formatCurrency(r.rate)}/{r.currency}/h</span>
        </div>
        <div className="flex justify-between">
          <span>Capacity</span>
          <span>{r.capacityHoursPerWeek}h/week</span>
        </div>
        {isHuman && r.projectAllocation != null && (
          <div className="flex justify-between items-center">
            <span>Allocation</span>
            <button
              className="font-medium text-primary hover:underline"
              onClick={() => onShowAllocation(r)}
              title="View per-project breakdown"
            >
              {r.projectAllocation}% ▾
            </button>
          </div>
        )}
        {isHuman && r.location && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{r.location}</span>
          </div>
        )}
        {isHuman && r.startDate && (
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>Since {formatDate(r.startDate)}</span>
          </div>
        )}
        {isHuman && r.superpower && (
          <div className="flex items-start gap-1 pt-0.5">
            <Zap className="w-3 h-3 flex-shrink-0 mt-0.5 text-amber-500" />
            <span className="text-xs italic line-clamp-2">{r.superpower}</span>
          </div>
        )}
        {isHuman && enableArchetype && r.archetype && (
          <div className="text-xs text-muted-foreground border-t pt-1 mt-1">
            <span className="font-medium text-foreground">Archetype:</span> {r.archetype}
          </div>
        )}
        {isHuman && enableMotto && r.motto && (
          <div className="text-xs text-muted-foreground italic border-t pt-1 mt-1">
            "{r.motto}"
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TeamTable({ humans, isAdmin, enableArchetype, enableMotto, onEdit, onDelete, onShowAllocation }: {
  humans: Resource[]
  isAdmin: boolean
  enableArchetype: boolean
  enableMotto: boolean
  onEdit: (r: Resource) => void
  onDelete: (id: string) => void
  onShowAllocation: (r: Resource) => void
}) {
  if (humans.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm border rounded-lg">
        No human resources yet.
      </div>
    )
  }
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-muted/30 text-xs text-muted-foreground font-medium">
          <tr>
            <th className="text-left py-2 px-3">Name</th>
            <th className="text-left py-2 px-3">Role</th>
            <th className="text-left py-2 px-3">Seniority</th>
            <th className="text-right py-2 px-3">Allocation</th>
            <th className="text-right py-2 px-3">Rate</th>
            {enableArchetype && <th className="text-left py-2 px-3">Archetype</th>}
            {enableMotto && <th className="text-left py-2 px-3">Motto</th>}
            {isAdmin && <th className="py-2 px-3" />}
          </tr>
        </thead>
        <tbody>
          {humans.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/20 transition-colors">
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-2">
                  <img
                    src={avatarSrc(r)}
                    alt={r.name}
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(r.name)}&backgroundColor=3b82f6&textColor=ffffff`
                    }}
                  />
                  <div>
                    <p className="font-medium">{r.name}</p>
                    {r.location && <p className="text-xs text-muted-foreground">{r.location}</p>}
                  </div>
                </div>
              </td>
              <td className="py-2.5 px-3 text-muted-foreground">{r.role ?? '—'}</td>
              <td className="py-2.5 px-3">
                {r.seniorityLevel
                  ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${seniorityColor(r.seniorityLevel)}`}>{r.seniorityLevel}</span>
                  : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="py-2.5 px-3 text-right">
                {r.projectAllocation != null
                  ? <button className="text-primary hover:underline font-medium" onClick={() => onShowAllocation(r)}>{r.projectAllocation}% ▾</button>
                  : '—'}
              </td>
              <td className="py-2.5 px-3 text-right text-muted-foreground">
                {formatCurrency(r.rate)}/h
              </td>
              {enableArchetype && <td className="py-2.5 px-3 text-muted-foreground text-xs">{r.archetype ?? '—'}</td>}
              {enableMotto && <td className="py-2.5 px-3 text-muted-foreground text-xs italic max-w-[200px] truncate">{r.motto ? `"${r.motto}"` : '—'}</td>}
              {isAdmin && (
                <td className="py-2.5 px-3">
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => onEdit(r)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-6 h-6 text-destructive hover:text-destructive" onClick={() => onDelete(r.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
