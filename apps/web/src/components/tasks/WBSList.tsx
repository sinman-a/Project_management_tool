import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/useTasks'
import { TaskForm } from './TaskForm'
import type { Task } from '@/types'

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
}

function TaskRow({ task, depth, projectId, canEdit }: TaskRowProps) {
  const [expanded, setExpanded] = useState(true)
  const [showAddChild, setShowAddChild] = useState(false)
  const [editing, setEditing] = useState(false)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const hasChildren = (task.children?.length ?? 0) > 0

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 group',
          task.status === 'done' && 'opacity-60',
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
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

        <span className={cn('text-sm flex-1 min-w-0 truncate', task.status === 'cancelled' && 'line-through text-muted-foreground')}>
          {task.name}
        </span>

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
          {(['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'] as const).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>

        {task.estimatedHours > 0 && (
          <span className="text-xs text-muted-foreground flex-shrink-0">{task.estimatedHours}h</span>
        )}

        {canEdit && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setShowAddChild((v) => !v)}>
              <Plus className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setEditing((v) => !v)}>
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-destructive"
              onClick={() => {
                if (confirm('Delete this task?')) deleteTask.mutate({ id: task.id, projectId })
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <div className="ml-8 mb-2">
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
        </div>
      )}

      {showAddChild && (
        <div className="ml-8 mb-2">
          <Card className="border-dashed">
            <CardContent className="pt-3 pb-3">
              <TaskForm
                projectId={projectId}
                parentTaskId={task.id}
                isPending={createTask.isPending}
                onCancel={() => setShowAddChild(false)}
                onSubmit={(data) =>
                  createTask.mutate(data, { onSuccess: () => setShowAddChild(false) })
                }
              />
            </CardContent>
          </Card>
        </div>
      )}

      {expanded && hasChildren && (
        <div>
          {task.children!.map((child) => (
            <TaskRow key={child.id} task={child} depth={depth + 1} projectId={projectId} canEdit={canEdit} />
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
}

export function WBSList({ projectId, tasks, canEdit }: Props) {
  const [showForm, setShowForm] = useState(false)
  const createTask = useCreateTask()
  const tree = buildTree(tasks)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
          <span>{tasks.filter((t) => t.status === 'done').length} done</span>
          <span>{tasks.reduce((s, t) => s + t.estimatedHours, 0)}h estimated</span>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="w-3 h-3 mr-1" />
            Add Task
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-dashed mb-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New Task</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskForm
              projectId={projectId}
              isPending={createTask.isPending}
              onCancel={() => setShowForm(false)}
              onSubmit={(data) => createTask.mutate(data, { onSuccess: () => setShowForm(false) })}
            />
          </CardContent>
        </Card>
      )}

      {tree.length === 0 && !showForm ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          No tasks yet. Click "Add Task" to create the first one.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground grid grid-cols-[1fr_auto] gap-2 border-b">
            <span>Task</span>
            <span>Est.</span>
          </div>
          {tree.map((task) => (
            <TaskRow key={task.id} task={task} depth={0} projectId={projectId} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  )
}
