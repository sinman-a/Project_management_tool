import { useState, useEffect } from 'react'
import { X, Maximize2, Minimize2, Pencil, Trash2, Clock, Calendar, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useUpdateTask, useDeleteTask } from '@/hooks/useTasks'
import { useUsers } from '@/hooks/useUsers'
import { useSprints } from '@/hooks/useSprints'
import { useDialog } from '@/hooks/useDialog'
import { CommentThread } from '@/components/collaboration/CommentThread'
import { TaskAssignmentsPanel } from '@/components/tasks/TaskAssignmentsPanel'
import type { Task, TaskStatus, TaskPriority, TaskType } from '@/types'

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-gray-300',
}

const PRIORITY_CLS: Record<string, string> = {
  critical: 'text-red-600 bg-red-50',
  high: 'text-orange-600 bg-orange-50',
  medium: 'text-yellow-700 bg-yellow-50',
  low: 'text-gray-500 bg-gray-100',
}

const STATUS_CLS: Record<string, string> = {
  backlog: 'bg-gray-100 text-gray-600',
  todo: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  review: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const TYPE_LABEL: Record<string, string> = {
  agile_task: 'Task', agile_story: 'Story', bug: 'Bug',
  waterfall_phase: 'Phase', milestone: 'Milestone',
}

const ALL_STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled']
const ALL_PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low']
const ALL_TYPES: TaskType[] = ['agile_task', 'agile_story', 'bug', 'waterfall_phase', 'milestone']

interface Props {
  task: Task | null
  projectId: string
  canEdit: boolean
  onClose: () => void
}

interface EditState {
  name: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  type: TaskType
  estimatedHours: number
  storyPoints: string
  startDate: string
  dueDate: string
  assignedTo: string
  wbsCode: string
}

function toEditState(task: Task): EditState {
  return {
    name: task.name,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    type: task.type,
    estimatedHours: task.estimatedHours,
    storyPoints: task.storyPoints != null ? String(task.storyPoints) : '',
    startDate: task.startDate ?? '',
    dueDate: task.dueDate ?? '',
    assignedTo: task.assignedTo ?? '',
    wbsCode: task.wbsCode ?? '',
  }
}

export function TaskDetailPanel({ task, projectId, canEdit, onClose }: Props) {
  const [mode, setMode] = useState<'half' | 'full'>('half')
  const [isEditing, setIsEditing] = useState(false)
  const [editState, setEditState] = useState<EditState | null>(null)

  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { data: users = [] } = useUsers()
  const { data: sprints = [] } = useSprints(projectId)

  const open = !!task
  const dialogRef = useDialog(open, onClose)

  // Reset edit state when task changes
  useEffect(() => {
    if (task) {
      setEditState(toEditState(task))
      setIsEditing(false)
    }
  }, [task?.id])

  function handleSave() {
    if (!task || !editState) return
    updateTask.mutate(
      {
        id: task.id,
        name: editState.name.trim(),
        description: editState.description || null,
        status: editState.status,
        priority: editState.priority,
        type: editState.type,
        estimatedHours: editState.estimatedHours,
        storyPoints: editState.storyPoints !== '' ? parseInt(editState.storyPoints, 10) : null,
        startDate: editState.startDate || null,
        dueDate: editState.dueDate || null,
        assignedTo: editState.assignedTo || null,
        wbsCode: editState.wbsCode || null,
      },
      { onSuccess: () => setIsEditing(false) },
    )
  }

  function handleDelete() {
    if (!task || !confirm(`Delete task "${task.name}"?`)) return
    deleteTask.mutate({ id: task.id, projectId }, { onSuccess: onClose })
  }

  const assigneeName = task
    ? users.find((u) => u.id === task.assignedTo)?.fullName ?? null
    : null

  const sprintName = task?.sprintId
    ? sprints.find((s) => s.id === task.sprintId)?.name ?? null
    : null

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={cn(
          'fixed inset-0 bg-black/20 z-40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={task ? `Task: ${task.name}` : 'Task details'}
        className={cn(
          'fixed inset-y-0 right-0 z-50 bg-background shadow-2xl flex flex-col transition-all duration-300 border-l',
          open ? 'translate-x-0' : 'translate-x-full',
          mode === 'full' ? 'w-full' : 'w-full sm:w-[640px]',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {task && (
              <>
                <span className={cn('text-xs px-2 py-0.5 rounded font-medium', STATUS_CLS[task.status])}>
                  {task.status.replace(/_/g, ' ')}
                </span>
                <span className={cn('text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1', PRIORITY_CLS[task.priority])}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[task.priority])} />
                  {task.priority}
                </span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {TYPE_LABEL[task.type] ?? task.type}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {canEdit && task && !isEditing && (
              <button
                type="button"
                className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Edit task"
                title="Edit"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label={mode === 'half' ? 'Expand to full page' : 'Collapse to half page'}
              title={mode === 'half' ? 'Expand to full page' : 'Collapse to half page'}
              onClick={() => setMode((m) => m === 'half' ? 'full' : 'half')}
            >
              {mode === 'half'
                ? <Maximize2 className="w-3.5 h-3.5" />
                : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Close"
              title="Close"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {task && (
          <div className="flex-1 overflow-y-auto">
            {isEditing && editState ? (
              /* ── EDIT MODE ── */
              <div className="p-5 space-y-5">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Title</label>
                  <input
                    className="w-full text-lg font-semibold border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-1 bg-transparent"
                    value={editState.name}
                    onChange={(e) => setEditState((s) => s && ({ ...s, name: e.target.value }))}
                    autoFocus
                  />
                </div>

                {/* Status + Priority + Type row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <select
                      className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                      value={editState.status}
                      onChange={(e) => setEditState((s) => s && ({ ...s, status: e.target.value as TaskStatus }))}
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <select
                      className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                      value={editState.priority}
                      onChange={(e) => setEditState((s) => s && ({ ...s, priority: e.target.value as TaskPriority }))}
                    >
                      {ALL_PRIORITIES.map((p) => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Type</label>
                    <select
                      className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                      value={editState.type}
                      onChange={(e) => setEditState((s) => s && ({ ...s, type: e.target.value as TaskType }))}
                    >
                      {ALL_TYPES.map((t) => (
                        <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Assignee + Sprint */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Assignee</label>
                    <select
                      className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                      value={editState.assignedTo}
                      onChange={(e) => setEditState((s) => s && ({ ...s, assignedTo: e.target.value }))}
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">WBS Code</label>
                    <input
                      className="w-full text-sm border rounded px-2 py-1.5"
                      value={editState.wbsCode}
                      onChange={(e) => setEditState((s) => s && ({ ...s, wbsCode: e.target.value }))}
                      placeholder="e.g. 1.2.3"
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                    <input
                      type="date"
                      className="w-full text-sm border rounded px-2 py-1.5"
                      value={editState.startDate}
                      onChange={(e) => setEditState((s) => s && ({ ...s, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                    <input
                      type="date"
                      className="w-full text-sm border rounded px-2 py-1.5"
                      value={editState.dueDate}
                      onChange={(e) => setEditState((s) => s && ({ ...s, dueDate: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Hours + Points */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Estimated Hours</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="w-full text-sm border rounded px-2 py-1.5"
                      value={editState.estimatedHours}
                      onChange={(e) => setEditState((s) => s && ({ ...s, estimatedHours: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Story Points</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full text-sm border rounded px-2 py-1.5"
                      value={editState.storyPoints}
                      onChange={(e) => setEditState((s) => s && ({ ...s, storyPoints: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <textarea
                    rows={5}
                    className="w-full text-sm border rounded px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    value={editState.description}
                    onChange={(e) => setEditState((s) => s && ({ ...s, description: e.target.value }))}
                    placeholder="Add a description…"
                  />
                </div>
              </div>
            ) : (
              /* ── READ MODE ── */
              <div className="p-5 space-y-5">
                {/* Title */}
                <h2 className="text-xl font-bold leading-snug">{task.name}</h2>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {assigneeName && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">Assignee</p>
                      <p>{assigneeName}</p>
                    </div>
                  )}
                  {sprintName && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">Sprint</p>
                      <p>{sprintName}</p>
                    </div>
                  )}
                  {task.wbsCode && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">WBS</p>
                      <p className="font-mono">{task.wbsCode}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Cost Type</p>
                    <p className="uppercase text-xs font-medium">{task.costType}</p>
                  </div>
                </div>

                {/* Timeline + effort */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
                    <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Timeline</p>
                      <p className="text-sm">
                        {task.startDate ?? '—'}
                        {task.dueDate ? ` → ${task.dueDate}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
                    <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Effort</p>
                      <p className="text-sm">
                        {task.estimatedHours}h est
                        {task.storyPoints != null && ` · ${task.storyPoints} pts`}
                        {task.loggedHours != null && task.loggedHours > 0 && (
                          <span className="text-muted-foreground"> · {task.loggedHours}h logged</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Assigned resources (capacity planning) */}
                <div className="border-t pt-4">
                  <TaskAssignmentsPanel taskId={task.id} estimatedHours={task.estimatedHours} canEdit={canEdit} />
                </div>

                {/* Description */}
                {task.description && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-foreground/80 leading-relaxed pl-5">
                      {task.description}
                    </p>
                  </div>
                )}
                {!task.description && (
                  <p className="text-sm text-muted-foreground italic">No description added yet.</p>
                )}

                {/* Comments */}
                <div className="border-t pt-4">
                  <CommentThread entityType="task" entityId={task.id} canModerate={canEdit} />
                </div>

                {/* Danger zone */}
                {canEdit && (
                  <div className="border-t pt-4">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
                      onClick={handleDelete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete task
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Edit mode footer */}
        {isEditing && (
          <div className="border-t px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0 bg-background">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setIsEditing(false); if (task) setEditState(toEditState(task)) }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={updateTask.isPending || !editState?.name.trim()}
              onClick={handleSave}
            >
              {updateTask.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
