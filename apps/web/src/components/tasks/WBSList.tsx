import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Link2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/useTasks'
import { useUsers } from '@/hooks/useUsers'
import { TaskForm } from './TaskForm'
import { TaskLinksPanel } from './TaskLinksPanel'
import { TaskDetailPanel } from './TaskDetailPanel'
import type { Task, TaskDependency, TaskStatus, TaskPriority, CpmFields } from '@/types'

const DEP_SHORT: Record<string, string> = {
  finish_to_start: 'FS',
  start_to_start: 'SS',
  finish_to_finish: 'FF',
  start_to_finish: 'SF',
}

const ALL_STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled']
const ALL_PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low']

function formatPredecessors(
  task: Task,
  deps: TaskDependency[],
  allTasks: Task[],
): string {
  const taskById = new Map(allTasks.map((t) => [t.id, t]))
  const preds = deps.filter((d) => d.taskId === task.id)
  if (!preds.length) return ''
  return preds
    .map((d) => {
      const pred = taskById.get(d.dependsOnId)
      const label = pred?.wbsCode ?? pred?.name.slice(0, 6) ?? d.dependsOnId.slice(0, 4)
      const type = DEP_SHORT[d.dependencyType] ?? 'FS'
      const lag = d.lagDays > 0 ? `+${d.lagDays}` : d.lagDays < 0 ? `${d.lagDays}` : ''
      return `${label}${type}${lag}`
    })
    .join(', ')
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-600',
}

function buildTree(tasks: Task[]): Task[] {
  const map = new Map(tasks.map((t) => [t.id, { ...t, children: [] as Task[] }]))
  const roots: Task[] = []
  for (const task of map.values()) {
    if (task.parentTaskId) {
      const parent = map.get(task.parentTaskId)
      if (parent) (parent.children ??= []).push(task)
      else roots.push(task) // parent filtered out — surface as root so it isn't lost
    } else {
      roots.push(task)
    }
  }
  return roots
}

interface TaskRowProps {
  task: Task
  depth: number
  projectId: string
  canEdit: boolean
  allTasks: Task[]
  dependencies: TaskDependency[]
  cpmData?: Map<string, CpmFields>
  onOpenDetail: (task: Task) => void
  selected: Set<string>
  onToggleSelect: (id: string) => void
  flat?: boolean
}

function TaskRow({ task, depth, projectId, canEdit, allTasks, dependencies, cpmData, onOpenDetail, selected, onToggleSelect, flat }: TaskRowProps) {
  const [expanded, setExpanded] = useState(true)
  const [showAddChild, setShowAddChild] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showLinks, setShowLinks] = useState(false)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const hasChildren = !flat && (task.children?.length ?? 0) > 0

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 group',
          task.status === 'done' && 'opacity-60',
        )}
        style={{ paddingLeft: `${(flat ? 0 : depth * 20) + 8}px` }}
      >
        {canEdit && (
          <input
            type="checkbox"
            className="flex-shrink-0 rounded"
            checked={selected.has(task.id)}
            onChange={() => onToggleSelect(task.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${task.name}`}
          />
        )}
        <button
          className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
          onClick={() => setExpanded((e) => !e)}
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 block" />
          )}
        </button>

        {task.wbsCode && (
          <span className="text-xs text-muted-foreground font-mono flex-shrink-0 w-10">{task.wbsCode}</span>
        )}

        <button
          type="button"
          className={cn(
            'text-sm flex-1 min-w-0 truncate text-left hover:text-primary transition-colors',
            task.status === 'cancelled' && 'line-through text-muted-foreground',
          )}
          onClick={() => onOpenDetail(task)}
        >
          {task.name}
        </button>

        <span className={cn('text-xs px-1.5 py-0.5 rounded-full flex-shrink-0', PRIORITY_COLOR[task.priority])}>
          {task.priority}
        </span>

        <select
          className="text-xs border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring rounded px-1"
          value={task.status}
          onChange={(e) =>
            updateTask.mutate({ id: task.id, status: e.target.value as Task['status'] })
          }
          onClick={(e) => e.stopPropagation()}
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>

        {(() => {
          const preds = formatPredecessors(task, dependencies, allTasks)
          return preds ? (
            <span className="text-xs text-muted-foreground font-mono flex-shrink-0 hidden sm:block" title="Predecessors">
              {preds}
            </span>
          ) : null
        })()}

        {cpmData?.has(task.id) && (
          <span
            className={cn(
              'text-xs font-mono flex-shrink-0 hidden sm:block',
              cpmData.get(task.id)!.totalFloat === 0 ? 'text-red-600 font-bold' : 'text-muted-foreground',
            )}
            title="Total float (days)"
          >
            {cpmData.get(task.id)!.totalFloat}d
          </span>
        )}

        {task.estimatedHours > 0 && (
          <span className="text-xs text-muted-foreground flex-shrink-0">{task.estimatedHours}h</span>
        )}

        <div className={cn('flex gap-0.5 flex-shrink-0', canEdit ? 'opacity-0 group-hover:opacity-100 transition-opacity' : 'hidden')}>
          <Button variant="ghost" size="icon" className={cn('w-6 h-6', showLinks && 'text-primary')} aria-label="Related work" title="Related work" onClick={() => setShowLinks((v) => !v)}>
            <Link2 className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="w-6 h-6" aria-label="Add subtask" title="Add subtask" onClick={() => setShowAddChild((v) => !v)}>
            <Plus className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="w-6 h-6" aria-label="Edit task" title="Edit task" onClick={() => setEditing((v) => !v)}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive" aria-label="Delete task" title="Delete task"
            onClick={() => { if (confirm('Delete this task?')) deleteTask.mutate({ id: task.id, projectId }) }}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {showLinks && (
        <div className="ml-4 mb-2 pl-2" style={{ paddingLeft: `${depth * 20 + 8}px` }}>
          <TaskLinksPanel taskId={task.id} projectTasks={allTasks} canEdit={canEdit} />
        </div>
      )}

      {editing && (
        <div className="ml-8 mb-2">
          <Card className="border-dashed">
            <CardContent className="pt-3 pb-3">
              <TaskForm projectId={projectId} task={task} isPending={updateTask.isPending}
                onCancel={() => setEditing(false)}
                onSubmit={(data) => updateTask.mutate({ id: task.id, ...data }, { onSuccess: () => setEditing(false) })} />
            </CardContent>
          </Card>
        </div>
      )}

      {showAddChild && (
        <div className="ml-8 mb-2">
          <Card className="border-dashed">
            <CardContent className="pt-3 pb-3">
              <TaskForm projectId={projectId} parentTaskId={task.id} isPending={createTask.isPending}
                onCancel={() => setShowAddChild(false)}
                onSubmit={(data) => createTask.mutate(data, { onSuccess: () => setShowAddChild(false) })} />
            </CardContent>
          </Card>
        </div>
      )}

      {!flat && expanded && hasChildren && (
        <div>
          {task.children!.map((child) => (
            <TaskRow key={child.id} task={child} depth={depth + 1} projectId={projectId} canEdit={canEdit} allTasks={allTasks} dependencies={dependencies} cpmData={cpmData} onOpenDetail={onOpenDetail} selected={selected} onToggleSelect={onToggleSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  projectId: string
  tasks: Task[]
  canEdit: boolean
  dependencies?: TaskDependency[]
  cpmData?: Map<string, CpmFields>
}

export function WBSList({ projectId, tasks, canEdit, dependencies = [], cpmData }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('')
  const [priorityF, setPriorityF] = useState('')
  const [assigneeF, setAssigneeF] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { data: users = [] } = useUsers()

  const filtersActive = !!(search || statusF || priorityF || assigneeF || criticalOnly)
  const filtered = tasks.filter((t) =>
    (!search || t.name.toLowerCase().includes(search.toLowerCase())) &&
    (!statusF || t.status === statusF) &&
    (!priorityF || t.priority === priorityF) &&
    (!assigneeF || t.assignedTo === assigneeF) &&
    (!criticalOnly || !cpmData || cpmData.get(t.id)?.isCritical),
  )

  // Tree when unfiltered (preserves hierarchy); flat matched list when any filter is active.
  const displayRows = filtersActive ? filtered : buildTree(tasks)
  const allTasks = tasks

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  function clearSelection() { setSelected(new Set()) }
  function bulkUpdate(patch: Partial<Task>) {
    selected.forEach((id) => updateTask.mutate({ id, ...patch }))
    clearSelection()
  }
  function bulkDelete() {
    if (!confirm(`Delete ${selected.size} task(s)? This cannot be undone.`)) return
    selected.forEach((id) => deleteTask.mutate({ id, projectId }))
    clearSelection()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
          <span>{tasks.filter((t) => t.status === 'done').length} done</span>
          <span>{tasks.reduce((s, t) => s + t.estimatedHours, 0)}h estimated</span>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="w-3 h-3 mr-1" /> Add Task
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="input-field pl-8 w-full h-8 text-sm" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field h-8 w-auto text-sm" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className="input-field h-8 w-auto text-sm" value={priorityF} onChange={(e) => setPriorityF(e.target.value)}>
          <option value="">All priorities</option>
          {ALL_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input-field h-8 w-auto text-sm" value={assigneeF} onChange={(e) => setAssigneeF(e.target.value)}>
          <option value="">All assignees</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
        {cpmData && cpmData.size > 0 && (
          <button type="button" onClick={() => setCriticalOnly((v) => !v)}
            className={cn('text-xs px-2 py-1 rounded border transition-colors', criticalOnly ? 'bg-red-50 border-red-300 text-red-700' : 'bg-muted border-border text-muted-foreground')}>
            Critical only
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {canEdit && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2 rounded-md border bg-primary/5">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <select className="input-field h-8 w-auto text-sm" defaultValue="" onChange={(e) => { if (e.target.value) bulkUpdate({ status: e.target.value as TaskStatus }); e.currentTarget.value = '' }}>
            <option value="">Set status…</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select className="input-field h-8 w-auto text-sm" defaultValue="" onChange={(e) => { if (e.target.value) bulkUpdate({ priority: e.target.value as TaskPriority }); e.currentTarget.value = '' }}>
            <option value="">Set priority…</option>
            {ALL_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input-field h-8 w-auto text-sm" defaultValue="" onChange={(e) => { if (e.target.value) bulkUpdate({ assignedTo: e.target.value }); e.currentTarget.value = '' }}>
            <option value="">Assign to…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
          <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={bulkDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={clearSelection}>
            <X className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>
        </div>
      )}

      {showForm && (
        <Card className="border-dashed mb-3">
          <CardHeader className="pb-2"><CardTitle className="text-sm">New Task</CardTitle></CardHeader>
          <CardContent>
            <TaskForm projectId={projectId} isPending={createTask.isPending}
              onCancel={() => setShowForm(false)}
              onSubmit={(data) => createTask.mutate(data, { onSuccess: () => setShowForm(false) })} />
          </CardContent>
        </Card>
      )}

      {displayRows.length === 0 && !showForm ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          {filtersActive ? 'No tasks match your filters.' : 'No tasks yet. Click "Add Task" to create the first one.'}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground grid grid-cols-[1fr_auto] gap-2 border-b">
            <span>Task</span>
            <span>Est.</span>
          </div>
          {displayRows.map((task) => (
            <TaskRow key={task.id} task={task} depth={0} projectId={projectId} canEdit={canEdit} allTasks={allTasks} dependencies={dependencies} cpmData={cpmData} onOpenDetail={setDetailTask} selected={selected} onToggleSelect={toggleSelect} flat={filtersActive} />
          ))}
        </div>
      )}

      <TaskDetailPanel task={detailTask} projectId={projectId} canEdit={canEdit} onClose={() => setDetailTask(null)} />
    </div>
  )
}
