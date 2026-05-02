import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Plus, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useMyResource } from '@/hooks/useResources'
import { useProjects } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { WeeklyTimesheet } from '@/components/time/WeeklyTimesheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Task } from '@/types'

type PinnedTask = Task & { projectName: string }

const getPinsKey = (userId: string) => `timesheet_pins_${userId}`

function loadPins(userId: string): PinnedTask[] {
  try {
    const raw = localStorage.getItem(getPinsKey(userId))
    return raw ? (JSON.parse(raw) as PinnedTask[]) : []
  } catch {
    return []
  }
}

function savePins(userId: string, tasks: PinnedTask[]) {
  localStorage.setItem(getPinsKey(userId), JSON.stringify(tasks))
}

function TaskPicker({
  existingIds,
  onAdd,
  onClose,
}: {
  existingIds: Set<string>
  onAdd: (task: PinnedTask) => void
  onClose: () => void
}) {
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const { data: projects = [] } = useProjects()
  const { data: projectTasks = [] } = useTasks(selectedProjectId || undefined)

  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const availableTasks = projectTasks.filter(
    (t) => !existingIds.has(t.id) && t.status !== 'cancelled',
  )

  return (
    <Card className="border-dashed">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Add Task to Timesheet</p>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>
        <select
          className="w-full text-sm border rounded px-2 py-1.5 bg-background"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          <option value="">Select a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {selectedProjectId && (
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {availableTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">
                No available tasks in this project
              </p>
            ) : (
              availableTasks.map((task) => (
                <button
                  key={task.id}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors text-left"
                  onClick={() =>
                    onAdd({ ...task, projectName: selectedProject?.name ?? '' })
                  }
                >
                  <span className="truncate">{task.name}</span>
                  <Plus className="w-3 h-3 flex-shrink-0 ml-2 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function Timesheet() {
  const { user } = useAuthStore()
  const resource = useMyResource(user?.id)
  const [pinnedTasks, setPinnedTasks] = useState<PinnedTask[]>(() =>
    user ? loadPins(user.id) : [],
  )
  const [showPicker, setShowPicker] = useState(false)

  const { data: assignedTasks = [], isLoading } = useQuery({
    queryKey: ['tasks', 'assigned'],
    queryFn: () => api.get<(Task & { projectName?: string })[]>('/tasks/assigned'),
    enabled: !!user,
  })

  const assignedIds = useMemo(() => new Set(assignedTasks.map((t) => t.id)), [assignedTasks])

  const extraPinned = useMemo(
    () => pinnedTasks.filter((t) => !assignedIds.has(t.id)),
    [pinnedTasks, assignedIds],
  )

  const allTasks = useMemo(
    () => [...assignedTasks, ...extraPinned],
    [assignedTasks, extraPinned],
  )

  const pinnedTaskIds = useMemo(() => extraPinned.map((t) => t.id), [extraPinned])
  const existingIds = useMemo(() => new Set(allTasks.map((t) => t.id)), [allTasks])

  function addTask(task: PinnedTask) {
    if (!user) return
    const updated = [...pinnedTasks.filter((p) => p.id !== task.id), task]
    setPinnedTasks(updated)
    savePins(user.id, updated)
    setShowPicker(false)
  }

  function removeTask(taskId: string) {
    if (!user) return
    const updated = pinnedTasks.filter((p) => p.id !== taskId)
    setPinnedTasks(updated)
    savePins(user.id, updated)
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Timesheet</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Log hours against tasks. Assigned tasks appear automatically.
          </p>
        </div>
        {resource && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPicker((v) => !v)}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Task
          </Button>
        )}
      </div>

      {showPicker && (
        <TaskPicker
          existingIds={existingIds}
          onAdd={addTask}
          onClose={() => setShowPicker(false)}
        />
      )}

      {!resource ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg">
          <Clock className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium">No resource linked to your account</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ask your admin to create a resource and link it to your user account.
          </p>
        </div>
      ) : (
        <WeeklyTimesheet
          tasks={allTasks}
          pinnedTaskIds={pinnedTaskIds}
          onRemoveTask={removeTask}
          resource={resource}
        />
      )}
    </div>
  )
}
