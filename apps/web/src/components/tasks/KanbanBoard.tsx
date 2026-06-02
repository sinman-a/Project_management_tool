import { useState, useRef } from 'react'
import { Plus, Search, X, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks'
import { useUsers } from '@/hooks/useUsers'
import { useProjectBoardColumns } from '@/hooks/useBoardColumns'
import { TaskForm } from './TaskForm'
import { BoardColumnEditor } from './BoardColumnEditor'
import { TaskDetailPanel } from './TaskDetailPanel'
import type { Task, TaskStatus, TaskType, TaskPriority } from '@/types'

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-gray-300',
}

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const TYPE_LABEL: Record<string, string> = {
  agile_task: 'Task',
  agile_story: 'Story',
  bug: 'Bug',
  waterfall_phase: 'Phase',
  milestone: 'Milestone',
}

const ALL_PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low']
const ALL_TYPES: TaskType[] = ['agile_task', 'agile_story', 'bug', 'waterfall_phase', 'milestone']

interface Filters {
  search: string
  priorities: Set<TaskPriority>
  types: Set<TaskType>
  assignedTo: string
}

function applyFilters(tasks: Task[], filters: Filters): Task[] {
  return tasks.filter((t) => {
    if (filters.search && !t.name.toLowerCase().includes(filters.search.toLowerCase())) return false
    if (filters.priorities.size > 0 && !filters.priorities.has(t.priority)) return false
    if (filters.types.size > 0 && !filters.types.has(t.type)) return false
    if (filters.assignedTo && t.assignedTo !== filters.assignedTo) return false
    return true
  })
}

function FilterBar({
  filters,
  onFiltersChange,
  tasks,
}: {
  filters: Filters
  onFiltersChange: (f: Filters) => void
  tasks: Task[]
}) {
  const { data: users = [] } = useUsers()
  const hasActiveFilters =
    filters.search || filters.priorities.size > 0 || filters.types.size > 0 || filters.assignedTo

  function togglePriority(p: TaskPriority) {
    const next = new Set(filters.priorities)
    next.has(p) ? next.delete(p) : next.add(p)
    onFiltersChange({ ...filters, priorities: next })
  }

  function toggleType(t: TaskType) {
    const next = new Set(filters.types)
    next.has(t) ? next.delete(t) : next.add(t)
    onFiltersChange({ ...filters, types: next })
  }

  function clearAll() {
    onFiltersChange({ search: '', priorities: new Set(), types: new Set(), assignedTo: '' })
  }

  const assigneeIds = [...new Set(tasks.flatMap((t) => t.assignedTo ? [t.assignedTo] : []))]
  const assignees = users.filter((u) => assigneeIds.includes(u.id))

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/30 rounded-lg border">
      <div className="relative flex-shrink-0">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <input
          className="input-field pl-7 h-7 text-xs w-44"
          placeholder="Search tasks…"
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        />
        {filters.search && (
          <button
            onClick={() => onFiltersChange({ ...filters, search: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="w-px h-5 bg-border flex-shrink-0" />

      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-xs text-muted-foreground mr-0.5">Priority:</span>
        {ALL_PRIORITIES.map((p) => (
          <button
            key={p}
            onClick={() => togglePriority(p)}
            className={cn(
              'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors',
              filters.priorities.has(p)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/30',
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[p])} />
            {PRIORITY_LABEL[p]}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border flex-shrink-0" />

      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-xs text-muted-foreground mr-0.5">Type:</span>
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className={cn(
              'text-xs px-2 py-0.5 rounded-full border transition-colors',
              filters.types.has(t)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/30',
            )}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {assignees.length > 0 && (
        <>
          <div className="w-px h-5 bg-border flex-shrink-0" />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-muted-foreground">Assignee:</span>
            <select
              className="text-xs border rounded px-1.5 py-0.5 h-7 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.assignedTo}
              onChange={(e) => onFiltersChange({ ...filters, assignedTo: e.target.value })}
            >
              <option value="">All</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {hasActiveFilters && (
        <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={clearAll}>
          <X className="w-3 h-3 mr-1" /> Clear
        </Button>
      )}
    </div>
  )
}

interface TaskCardProps {
  task: Task
  canEdit: boolean
  isDragging: boolean
  onDragStart: (taskId: string) => void
  onDragEnd: () => void
  onCardClick: (task: Task) => void
}

function TaskCard({ task, canEdit, isDragging, onDragStart, onDragEnd, onCardClick }: TaskCardProps) {
  return (
    <Card
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', task.id)
        onDragStart(task.id)
      }}
      onDragEnd={onDragEnd}
      onClick={() => onCardClick(task)}
      className={cn(
        'transition-all select-none',
        canEdit ? 'cursor-pointer hover:shadow-md hover:border-primary/30' : 'cursor-default',
        isDragging && 'opacity-40 scale-95 shadow-none',
      )}
    >
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start gap-2">
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1', PRIORITY_DOT[task.priority])} />
          <p className="text-sm leading-snug flex-1">{task.name}</p>
        </div>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex gap-1 flex-wrap">
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {TYPE_LABEL[task.type] ?? task.type}
            </span>
            {task.storyPoints != null && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {task.storyPoints} pts
              </span>
            )}
          </div>
          {task.estimatedHours > 0 && (
            <span className="text-xs text-muted-foreground">{task.estimatedHours}h</span>
          )}
        </div>
        {task.dueDate && (
          <p className="text-xs text-muted-foreground">Due {task.dueDate}</p>
        )}
      </CardContent>
    </Card>
  )
}

interface ColumnProps {
  statusKey: TaskStatus
  label: string
  color: string
  tasks: Task[]
  canEdit: boolean
  isDragOver: boolean
  draggedTaskId: string | null
  onTaskDragStart: (taskId: string) => void
  onTaskDragEnd: () => void
  onDrop: (targetStatus: TaskStatus) => void
  onDragOverColumn: (status: TaskStatus) => void
  onDragLeaveColumn: () => void
  onCardClick: (task: Task) => void
}

function KanbanColumn({
  statusKey, label, color, tasks, canEdit,
  isDragOver, draggedTaskId,
  onTaskDragStart, onTaskDragEnd, onDrop, onDragOverColumn, onDragLeaveColumn, onCardClick,
}: ColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col min-w-[220px] max-w-xs w-full">
      <div
        ref={columnRef}
        className={cn(
          'bg-card border border-t-4 rounded-lg flex flex-col h-full transition-colors',
          isDragOver && 'bg-primary/5 border-primary/30 ring-2 ring-primary/40 ring-inset',
        )}
        style={{ borderTopColor: color }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          onDragOverColumn(statusKey)
        }}
        onDragLeave={(e) => {
          if (!columnRef.current?.contains(e.relatedTarget as Node)) {
            onDragLeaveColumn()
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          onDrop(statusKey)
        }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-sm font-medium">{label}</span>
          </div>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2">{tasks.length}</span>
        </div>

        <div className={cn(
          'flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]',
          isDragOver && tasks.length === 0 && 'flex items-center justify-center',
        )}>
          {isDragOver && tasks.length === 0 && (
            <div className="border-2 border-dashed border-primary/40 rounded-lg w-full h-16 flex items-center justify-center">
              <span className="text-xs text-primary/60">Drop here</span>
            </div>
          )}
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canEdit={canEdit}
              isDragging={draggedTaskId === task.id}
              onDragStart={onTaskDragStart}
              onDragEnd={onTaskDragEnd}
              onCardClick={onCardClick}
            />
          ))}
          {isDragOver && tasks.length > 0 && (
            <div className="border-2 border-dashed border-primary/40 rounded-lg h-10 flex items-center justify-center">
              <span className="text-xs text-primary/60">Drop here</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface Props {
  projectId: string
  tasks: Task[]
  canEdit: boolean
  sprintId?: string
}

export function KanbanBoard({ projectId, tasks, canEdit, sprintId }: Props) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null)
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [filters, setFilters] = useState<Filters>({
    search: '',
    priorities: new Set(),
    types: new Set(),
    assignedTo: '',
  })

  const updateTask = useUpdateTask()
  const createTask = useCreateTask()
  const { data: boardColumns = [] } = useProjectBoardColumns(projectId)

  const visibleColumns = boardColumns.filter((c) => c.isVisible)

  const filteredTasks = applyFilters(tasks, filters)
  const isFiltering = filters.search || filters.priorities.size > 0 || filters.types.size > 0 || filters.assignedTo

  function handleDrop(targetStatus: TaskStatus) {
    if (!draggedTaskId) return
    const task = tasks.find((t) => t.id === draggedTaskId)
    if (task && task.status !== targetStatus) {
      updateTask.mutate({ id: draggedTaskId, status: targetStatus })
    }
    setDraggedTaskId(null)
    setDropTarget(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
          <span>{tasks.filter((t) => t.status === 'done').length} done</span>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              title="Board settings"
              className={cn(
                'p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
                showEditor && 'bg-muted text-foreground',
              )}
              onClick={() => setShowEditor((v) => !v)}
            >
              <Settings2 className="w-4 h-4" />
            </button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setNewTaskStatus('todo')}>
              <Plus className="w-3 h-3 mr-1" /> Add Task
            </Button>
          )}
        </div>
      </div>

      <FilterBar filters={filters} onFiltersChange={setFilters} tasks={tasks} />

      {isFiltering && (
        <p className="text-xs text-muted-foreground mb-3">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {visibleColumns.map((col) => (
          <KanbanColumn
            key={col.id}
            statusKey={col.statusKey as TaskStatus}
            label={col.label}
            color={col.color}
            tasks={filteredTasks.filter((t) => t.status === col.statusKey)}
            canEdit={canEdit}
            isDragOver={dropTarget === col.statusKey}
            draggedTaskId={draggedTaskId}
            onTaskDragStart={(id) => setDraggedTaskId(id)}
            onTaskDragEnd={() => { setDraggedTaskId(null); setDropTarget(null) }}
            onDrop={handleDrop}
            onDragOverColumn={(s) => setDropTarget(s)}
            onDragLeaveColumn={() => setDropTarget(null)}
            onCardClick={(task) => setDetailTask(task)}
          />
        ))}
      </div>

      {/* Board column editor */}
      {showEditor && (
        <BoardColumnEditor
          projectId={projectId}
          canEdit={canEdit}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* Task detail panel */}
      <TaskDetailPanel
        task={detailTask}
        projectId={projectId}
        canEdit={canEdit}
        onClose={() => setDetailTask(null)}
      />

      {/* New task modal */}
      {newTaskStatus && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setNewTaskStatus(null)}
        >
          <div
            className="bg-background rounded-xl shadow-2xl p-5 w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">
                New Task — {visibleColumns.find((c) => c.statusKey === newTaskStatus)?.label ?? newTaskStatus}
              </h3>
              <button onClick={() => setNewTaskStatus(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <TaskForm
              projectId={projectId}
              isPending={createTask.isPending}
              onCancel={() => setNewTaskStatus(null)}
              onSubmit={(data) =>
                createTask.mutate(
                  { ...data, status: newTaskStatus, ...(sprintId ? { sprintId } : {}) },
                  { onSuccess: () => setNewTaskStatus(null) },
                )
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
