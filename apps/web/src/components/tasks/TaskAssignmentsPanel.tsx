import { useState } from 'react'
import { Users, Plus, Trash2, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useResources } from '@/hooks/useResources'
import {
  useTaskAssignments, useAddAssignment, useUpdateAssignment, useRemoveAssignment,
} from '@/hooks/useAssignments'

interface Props {
  taskId: string
  estimatedHours: number
  canEdit: boolean
}

export function TaskAssignmentsPanel({ taskId, estimatedHours, canEdit }: Props) {
  const { data: assignments = [] } = useTaskAssignments(taskId)
  const { data: resources = [] } = useResources()
  const addAssignment = useAddAssignment()
  const updateAssignment = useUpdateAssignment()
  const removeAssignment = useRemoveAssignment()

  const [adding, setAdding] = useState(false)
  const [newResourceId, setNewResourceId] = useState('')
  const [newHours, setNewHours] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editHours, setEditHours] = useState('')

  const assignedIds = new Set(assignments.map((a) => a.resourceId))
  const available = resources.filter((r) => !assignedIds.has(r.id))
  const totalAllocated = assignments.reduce((s, a) => s + a.allocatedHours, 0)

  function handleAdd() {
    if (!newResourceId) return
    addAssignment.mutate(
      { taskId, resourceId: newResourceId, allocatedHours: parseFloat(newHours) || 0 },
      { onSuccess: () => { setAdding(false); setNewResourceId(''); setNewHours('') } },
    )
  }

  function saveEdit(id: string) {
    updateAssignment.mutate(
      { id, allocatedHours: parseFloat(editHours) || 0 },
      { onSuccess: () => setEditId(null) },
    )
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Assigned Resources
        </h4>
        <span className={cn(
          'text-xs',
          estimatedHours > 0 && totalAllocated > estimatedHours ? 'text-red-600 font-medium' : 'text-muted-foreground',
        )}>
          {totalAllocated}h planned{estimatedHours > 0 ? ` / ${estimatedHours}h est` : ''}
        </span>
      </div>

      {assignments.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No resources assigned yet.</p>
      )}

      <div className="space-y-1">
        {assignments.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-sm py-1 group">
            <span className="flex-1 min-w-0 truncate">
              {a.resourceName}
              {a.resourceRole && <span className="text-xs text-muted-foreground ml-1.5">· {a.resourceRole}</span>}
            </span>
            {editId === a.id ? (
              <>
                <input
                  type="number" min="0" step="0.5" autoFocus
                  className="w-20 text-sm border rounded px-1.5 py-0.5 text-right"
                  value={editHours}
                  onChange={(e) => setEditHours(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(a.id); if (e.key === 'Escape') setEditId(null) }}
                />
                <button type="button" aria-label="Save" className="text-primary" onClick={() => saveEdit(a.id)}><Check className="w-4 h-4" /></button>
                <button type="button" aria-label="Cancel" className="text-muted-foreground" onClick={() => setEditId(null)}><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={cn('text-sm tabular-nums', canEdit ? 'hover:text-primary cursor-pointer' : 'cursor-default')}
                  onClick={() => { if (canEdit) { setEditId(a.id); setEditHours(String(a.allocatedHours)) } }}
                  disabled={!canEdit}
                >
                  {a.allocatedHours}h
                </button>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Remove ${a.resourceName}`}
                    title="Remove"
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={() => removeAssignment.mutate({ id: a.id })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        adding ? (
          <div className="flex items-center gap-2">
            <select
              className="flex-1 text-sm border rounded px-2 py-1 bg-background"
              value={newResourceId}
              onChange={(e) => setNewResourceId(e.target.value)}
            >
              <option value="">Select resource…</option>
              {available.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.role ? ` (${r.role})` : ''}</option>
              ))}
            </select>
            <input
              type="number" min="0" step="0.5"
              className="w-20 text-sm border rounded px-1.5 py-1 text-right"
              placeholder="hrs"
              value={newHours}
              onChange={(e) => setNewHours(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            />
            <button type="button" aria-label="Add" className="text-primary" disabled={!newResourceId || addAssignment.isPending} onClick={handleAdd}>
              <Check className="w-4 h-4" />
            </button>
            <button type="button" aria-label="Cancel" className="text-muted-foreground" onClick={() => setAdding(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            onClick={() => setAdding(true)}
            disabled={available.length === 0}
          >
            <Plus className="w-3.5 h-3.5" /> {available.length === 0 ? 'All resources assigned' : 'Assign resource'}
          </button>
        )
      )}
    </section>
  )
}
