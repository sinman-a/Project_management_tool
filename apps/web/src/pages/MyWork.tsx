import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Calendar, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAssignedTasks, useUpdateTask } from '@/hooks/useTasks'
import { useAuthStore } from '@/stores/authStore'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { LogTimeModal } from '@/components/time/LogTimeModal'
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

const STATUS_OPTIONS: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done']

function TaskCard({ task, onOpen, onDragStart, onLogTime }: {
  task: AssignedTask
  onOpen: () => void
  onDragStart: () => void
  onLogTime: () => void
}) {
  const updateTask = useUpdateTask()
  return (
    <div
      draggable
      onDragStart={onDragStart}
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
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            className="text-muted-foreground hover:text-primary p-1"
            title="Quick log time"
            onClick={onLogTime}
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          {/* status select = touch-friendly fallback for drag-and-drop */}
          <select
            className="text-xs border rounded px-1.5 py-0.5"
            value={task.status}
            onChange={(e) => updateTask.mutate({ id: task.id, status: e.target.value as TaskStatus })}
            aria-label={`Change status of ${task.name}`}
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

export function MyWork() {
  const navigate = useNavigate()
  const { data: tasks = [], isLoading } = useAssignedTasks()
  const [selected, setSelected] = useState<AssignedTask | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [logFor, setLogFor] = useState<AssignedTask | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [projectFilter, setProjectFilter] = useState('')
  const [search, setSearch] = useState('')
  const updateTask = useUpdateTask()
  const canEditTasks = useAuthStore((s) => s.hasRole(['admin', 'program_manager', 'pmo_lead', 'project_manager']))

  const projects = Array.from(new Map(tasks.map((t) => [t.projectId, t.projectName])).entries())
  const visible = tasks
    .filter((t) => !projectFilter || t.projectId === projectFilter)
    .filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()))

  function dropTo(status: TaskStatus) {
    if (dragId) updateTask.mutate({ id: dragId, status })
    setDragId(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">My Work</h1>
          <p className="text-sm text-muted-foreground">
            {visible.length} active {visible.length === 1 ? 'task' : 'tasks'} assigned to you
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowLog(true)}>
            <Clock className="w-4 h-4 mr-1.5" /> Log Time
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/timesheet')}>
            Timesheet
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="input-field pl-8 h-9" placeholder="Search my tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field h-9 w-auto" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="">All projects</option>
          {projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
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
            <Button size="sm" className="mt-4" onClick={() => setShowLog(true)}>
              <Clock className="w-4 h-4 mr-1.5" /> Log Time
            </Button>
            <p className="text-xs mt-2">You can log time against any project task.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map((col) => {
              const colTasks = visible.filter((t) => t.status === col.status)
              return (
                <div
                  key={col.status}
                  className="space-y-2 rounded-lg"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropTo(col.status)}
                >
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{col.label}</h2>
                    <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2 min-h-[80px]">
                    {colTasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        onOpen={() => setSelected(t)}
                        onDragStart={() => setDragId(t.id)}
                        onLogTime={() => setLogFor(t)}
                      />
                    ))}
                    {colTasks.length === 0 && <p className="text-xs text-muted-foreground/60 px-1 py-3">Drop here</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <TaskDetailPanel task={selected as Task} projectId={selected.projectId} canEdit={canEditTasks} onClose={() => setSelected(null)} />
      )}
      {logFor && (
        <LogTimeModal
          presetTask={{ id: logFor.id, name: logFor.name, projectName: logFor.projectName }}
          onClose={() => setLogFor(null)}
        />
      )}
      {showLog && <LogTimeModal onClose={() => setShowLog(false)} />}
    </div>
  )
}
