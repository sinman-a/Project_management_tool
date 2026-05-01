import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, ChevronDown, ChevronRight, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCreateSprint, useUpdateSprint, useDeleteSprint } from '@/hooks/useSprints'
import { useUpdateTask } from '@/hooks/useTasks'
import { StatusBadge } from '@/components/ui/status-badge'
import type { Sprint, Task } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  goal: z.string().optional(),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().min(1, 'Required'),
  status: z.enum(['planned', 'active', 'completed']).default('planned'),
})
type FormValues = z.infer<typeof schema>

function SprintForm({
  projectId,
  sprint,
  isPending,
  onCancel,
  onSubmit,
}: {
  projectId: string
  sprint?: Sprint
  isPending: boolean
  onCancel: () => void
  onSubmit: (data: FormValues & { projectId: string }) => void
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: sprint?.name ?? '',
      goal: sprint?.goal ?? '',
      startDate: sprint?.startDate ?? '',
      endDate: sprint?.endDate ?? '',
      status: sprint?.status ?? 'planned',
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => onSubmit({ ...d, projectId }))} className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <input className="input-field" placeholder="Sprint name *" {...register('name')} />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>
        <div className="col-span-2">
          <input className="input-field" placeholder="Sprint goal" {...register('goal')} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Start</label>
          <input type="date" className="input-field" {...register('startDate')} />
          {errors.startDate && <p className="field-error">{errors.startDate.message}</p>}
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">End</label>
          <input type="date" className="input-field" {...register('endDate')} />
          {errors.endDate && <p className="field-error">{errors.endDate.message}</p>}
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Status</label>
          <select className="input-field" {...register('status')}>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving…' : sprint ? 'Save' : 'Create Sprint'}
        </Button>
      </div>
    </form>
  )
}

function SprintCard({
  sprint,
  projectId,
  tasks,
  canEdit,
}: {
  sprint: Sprint & { taskCount?: number }
  projectId: string
  tasks: Task[]
  canEdit: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const updateSprint = useUpdateSprint()
  const deleteSprint = useDeleteSprint()
  const updateTask = useUpdateTask()

  const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id)
  const doneCount = sprintTasks.filter((t) => t.status === 'done').length
  const totalPoints = sprintTasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0)

  return (
    <Card className={cn(sprint.status === 'active' && 'border-indigo-300')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <button
            className="flex items-center gap-2 flex-1 text-left"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {sprint.status === 'active' && <Zap className="w-3.5 h-3.5 text-indigo-500" />}
            <CardTitle className="text-sm">{sprint.name}</CardTitle>
            <StatusBadge status={sprint.status} />
          </button>
          {canEdit && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditing((v) => !v)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs px-2 text-destructive"
                onClick={() => {
                  if (confirm('Delete sprint?')) deleteSprint.mutate({ id: sprint.id, projectId })
                }}
              >
                Delete
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-4 text-xs text-muted-foreground pl-6">
          <span>{sprint.startDate} → {sprint.endDate}</span>
          <span>{doneCount}/{sprintTasks.length} tasks</span>
          {totalPoints > 0 && <span>{totalPoints} pts</span>}
        </div>

        {sprint.goal && (
          <p className="text-xs text-muted-foreground pl-6 italic">{sprint.goal}</p>
        )}
      </CardHeader>

      {editing && (
        <CardContent className="pt-0 pb-3">
          <SprintForm
            projectId={projectId}
            sprint={sprint}
            isPending={updateSprint.isPending}
            onCancel={() => setEditing(false)}
            onSubmit={(data) => updateSprint.mutate({ id: sprint.id, ...data }, { onSuccess: () => setEditing(false) })}
          />
        </CardContent>
      )}

      {expanded && sprintTasks.length > 0 && (
        <CardContent className="pt-0 pb-3">
          <div className="space-y-1 border-t pt-2">
            {sprintTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-sm py-0.5">
                <select
                  className="text-xs border-0 bg-transparent cursor-pointer focus:outline-none"
                  value={task.status}
                  onChange={(e) => updateTask.mutate({ id: task.id, status: e.target.value as Task['status'] })}
                >
                  {(['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'] as const).map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
                <span className={cn('flex-1 truncate', task.status === 'done' && 'line-through text-muted-foreground')}>
                  {task.name}
                </span>
                {task.storyPoints != null && (
                  <span className="text-xs text-muted-foreground">{task.storyPoints}p</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

interface Props {
  projectId: string
  sprints: Sprint[]
  tasks: Task[]
  canEdit: boolean
}

export function SprintPanel({ projectId, sprints, tasks, canEdit }: Props) {
  const [showForm, setShowForm] = useState(false)
  const createSprint = useCreateSprint()

  const backlogTasks = tasks.filter((t) => !t.sprintId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sprints.length} sprint{sprints.length !== 1 ? 's' : ''} · {backlogTasks.length} in backlog
        </p>
        {canEdit && !showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="w-3 h-3 mr-1" /> New Sprint
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <SprintForm
              projectId={projectId}
              isPending={createSprint.isPending}
              onCancel={() => setShowForm(false)}
              onSubmit={(data) => createSprint.mutate(data, { onSuccess: () => setShowForm(false) })}
            />
          </CardContent>
        </Card>
      )}

      {sprints.map((sprint) => (
        <SprintCard
          key={sprint.id}
          sprint={sprint}
          projectId={projectId}
          tasks={tasks}
          canEdit={canEdit}
        />
      ))}

      {sprints.length === 0 && !showForm && (
        <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg">
          No sprints yet. Create the first sprint to start planning.
        </div>
      )}

      {backlogTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Backlog ({backlogTasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {backlogTasks.map((task) => (
                <div key={task.id} className="text-sm flex items-center gap-2 py-0.5 text-muted-foreground">
                  <span className="flex-1 truncate">{task.name}</span>
                  {task.storyPoints != null && <span className="text-xs">{task.storyPoints}p</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
