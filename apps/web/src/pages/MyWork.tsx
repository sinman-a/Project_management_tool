import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAssignedTasks, useUpdateTask } from '@/hooks/useTasks'
import { useAuthStore } from '@/stores/authStore'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import type { AssignedTask } from '@/hooks/useTasks'
import type { Task, TaskStatus } from '@/types'

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-gray-300',
}

// `/tasks/assigned` excludes done/cancelled, so the board shows the active pipeline.
const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
]

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
]

function TaskCard({ task, onOpen }: { task: AssignedTask; onOpen: () => void }) {
  const updateTask = useUpdateTask()

  return (
    <div
      className="border rounded-md bg-card p-3 space-y-2 hover:border-primary/50 transition-colors cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-start gap-2">
        <span className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', PRIORITY_DOT[task.priority])} />
        <p className="text-sm font-medium leading-snug">{task.name}</p>
      </div>
      <p className="text-xs text-muted-foreground truncate">{task.projectName}</p>
      <div className="flex items-center justify-between gap-2">
        {task.dueDate ? (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {task.dueDate}
          </span>
        ) : <span />}
        <select
          className="text-xs border rounded px-1.5 py-0.5 bg-background"
          value={task.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateTask.mutate({ id: task.id, status: e.target.value as TaskStatus })}
          aria-label={`Change status of ${task.name}`}
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  )
}

export function MyWork() {
  const navigate = useNavigate()
  const { data: tasks = [], isLoading } = useAssignedTasks()
  const [selected, setSelected] = useState<AssignedTask | null>(null)
  const canEditTasks = useAuthStore((s) =>
    s.hasRole(['admin', 'program_manager', 'pmo_lead', 'project_manager']))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-lg font-semibold">My Work</h1>
          <p className="text-sm text-muted-foreground">
            {tasks.length} active {tasks.length === 1 ? 'task' : 'tasks'} assigned to you
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/timesheet')}>
          <Clock className="w-4 h-4 mr-1.5" /> Log time
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {COLUMNS.map((c) => <div key={c.status} className="h-40 bg-muted rounded" />)}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <p className="text-sm">No tasks assigned to you.</p>
            <p className="text-xs mt-1">Tasks your project manager assigns will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.status)
              return (
                <div key={col.status} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {col.label}
                    </h2>
                    <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((t) => (
                      <TaskCard key={t.id} task={t} onOpen={() => setSelected(t)} />
                    ))}
                    {colTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground/60 px-1 py-3">No tasks</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <TaskDetailPanel
          task={selected as Task}
          projectId={selected.projectId}
          canEdit={canEditTasks}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
