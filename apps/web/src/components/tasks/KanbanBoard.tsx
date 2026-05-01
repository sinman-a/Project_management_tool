import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks'
import { TaskForm } from './TaskForm'
import type { Task, TaskStatus } from '@/types'

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'backlog', label: 'Backlog', color: 'border-t-gray-300' },
  { status: 'todo', label: 'To Do', color: 'border-t-blue-400' },
  { status: 'in_progress', label: 'In Progress', color: 'border-t-indigo-500' },
  { status: 'review', label: 'Review', color: 'border-t-purple-500' },
  { status: 'done', label: 'Done', color: 'border-t-green-500' },
]

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-gray-300',
}

interface TaskCardProps {
  task: Task
  projectId: string
  canEdit: boolean
  isDragging: boolean
  onDragStart: (taskId: string) => void
  onDragEnd: () => void
}

function TaskCard({ task, projectId, canEdit, isDragging, onDragStart, onDragEnd }: TaskCardProps) {
  const [editing, setEditing] = useState(false)
  const updateTask = useUpdateTask()

  if (editing) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-3 pb-3">
          <TaskForm
            projectId={projectId}
            task={task}
            isPending={updateTask.isPending}
            onCancel={() => setEditing(false)}
            onSubmit={(data) =>
              updateTask.mutate({ id: task.id, ...data }, { onSuccess: () => setEditing(false) })
            }
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', task.id)
        onDragStart(task.id)
      }}
      onDragEnd={onDragEnd}
      onClick={() => canEdit && setEditing(true)}
      className={cn(
        'transition-all select-none',
        canEdit ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-default',
        isDragging && 'opacity-40 scale-95 shadow-none',
      )}
    >
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start gap-2">
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1', PRIORITY_DOT[task.priority])} />
          <p className="text-sm leading-snug flex-1">{task.name}</p>
        </div>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex gap-1">
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {task.type.replace('_', ' ')}
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
  status: TaskStatus
  label: string
  colorClass: string
  tasks: Task[]
  projectId: string
  canEdit: boolean
  isDragOver: boolean
  draggedTaskId: string | null
  onTaskDragStart: (taskId: string) => void
  onTaskDragEnd: () => void
  onDrop: (targetStatus: TaskStatus) => void
  onDragOverColumn: (status: TaskStatus) => void
  onDragLeaveColumn: () => void
}

function KanbanColumn({
  status, label, colorClass, tasks, projectId, canEdit,
  isDragOver, draggedTaskId,
  onTaskDragStart, onTaskDragEnd, onDrop, onDragOverColumn, onDragLeaveColumn,
}: ColumnProps) {
  const [showForm, setShowForm] = useState(false)
  const createTask = useCreateTask()
  const columnRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col min-w-[220px] max-w-xs w-full">
      <div
        ref={columnRef}
        className={cn(
          'bg-card border rounded-lg border-t-4 flex flex-col h-full transition-colors',
          colorClass,
          isDragOver && 'bg-primary/5 border-primary/30 ring-2 ring-primary/40 ring-inset',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          onDragOverColumn(status)
        }}
        onDragLeave={(e) => {
          if (!columnRef.current?.contains(e.relatedTarget as Node)) {
            onDragLeaveColumn()
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          onDrop(status)
        }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">{label}</span>
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
              projectId={projectId}
              canEdit={canEdit}
              isDragging={draggedTaskId === task.id}
              onDragStart={onTaskDragStart}
              onDragEnd={onTaskDragEnd}
            />
          ))}
          {isDragOver && tasks.length > 0 && (
            <div className="border-2 border-dashed border-primary/40 rounded-lg h-10 flex items-center justify-center">
              <span className="text-xs text-primary/60">Drop here</span>
            </div>
          )}
        </div>

        {canEdit && !showForm && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground h-7 text-xs"
              onClick={() => setShowForm(true)}
            >
              <Plus className="w-3 h-3 mr-1" /> Add task
            </Button>
          </div>
        )}

        {showForm && (
          <div className="p-2 border-t">
            <Card className="border-dashed">
              <CardContent className="pt-3 pb-3">
                <TaskForm
                  projectId={projectId}
                  isPending={createTask.isPending}
                  onCancel={() => setShowForm(false)}
                  onSubmit={(data) =>
                    createTask.mutate(
                      { ...data, status },
                      { onSuccess: () => setShowForm(false) },
                    )
                  }
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

interface Props {
  projectId: string
  tasks: Task[]
  canEdit: boolean
}

export function KanbanBoard({ projectId, tasks, canEdit }: Props) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null)
  const updateTask = useUpdateTask()

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
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUMNS.map(({ status, label, color }) => (
        <KanbanColumn
          key={status}
          status={status}
          label={label}
          colorClass={color}
          tasks={tasks.filter((t) => t.status === status)}
          projectId={projectId}
          canEdit={canEdit}
          isDragOver={dropTarget === status}
          draggedTaskId={draggedTaskId}
          onTaskDragStart={(id) => setDraggedTaskId(id)}
          onTaskDragEnd={() => { setDraggedTaskId(null); setDropTarget(null) }}
          onDrop={handleDrop}
          onDragOverColumn={(s) => setDropTarget(s)}
          onDragLeaveColumn={() => setDropTarget(null)}
        />
      ))}
    </div>
  )
}
