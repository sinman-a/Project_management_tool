import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { useUsers } from '@/hooks/useUsers'
import { useSprints } from '@/hooks/useSprints'
import type { Task } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  type: z.enum(['waterfall_phase', 'agile_story', 'agile_task', 'milestone']),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled']),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  costType: z.enum(['capex', 'opex']),
  estimatedHours: z.coerce.number().min(0).default(0),
  storyPoints: z.coerce.number().int().min(0).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
  sprintId: z.string().optional(),
  wbsCode: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  projectId: string
  task?: Task
  parentTaskId?: string
  isPending: boolean
  onCancel: () => void
  onSubmit: (data: FormValues & { projectId: string; parentTaskId?: string }) => void
}

export function TaskForm({ projectId, task, parentTaskId, isPending, onCancel, onSubmit }: Props) {
  const { data: users = [] } = useUsers()
  const { data: sprints = [] } = useSprints(projectId)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: task?.name ?? '',
      description: task?.description ?? '',
      type: task?.type ?? 'agile_task',
      status: task?.status ?? 'backlog',
      priority: task?.priority ?? 'medium',
      costType: task?.costType ?? 'opex',
      estimatedHours: task?.estimatedHours ?? 0,
      storyPoints: task?.storyPoints ?? undefined,
      startDate: task?.startDate ?? '',
      dueDate: task?.dueDate ?? '',
      assignedTo: task?.assignedTo ?? '',
      sprintId: task?.sprintId ?? '',
      wbsCode: task?.wbsCode ?? '',
    },
  })

  return (
    <form
      onSubmit={handleSubmit((data) =>
        onSubmit({
          ...data,
          projectId,
          parentTaskId: parentTaskId ?? task?.parentTaskId ?? undefined,
          assignedTo: data.assignedTo || undefined,
          sprintId: data.sprintId || undefined,
          startDate: data.startDate || undefined,
          dueDate: data.dueDate || undefined,
          wbsCode: data.wbsCode || undefined,
          storyPoints: data.storyPoints || undefined,
        }),
      )}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <input className="input-field" placeholder="Task name *" {...register('name')} />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <textarea
            className="input-field min-h-[60px] resize-none"
            placeholder="Description (optional)"
            {...register('description')}
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Type</label>
          <select className="input-field" {...register('type')}>
            <option value="agile_task">Agile Task</option>
            <option value="agile_story">User Story</option>
            <option value="waterfall_phase">Waterfall Phase</option>
            <option value="milestone">Milestone</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Status</label>
          <select className="input-field" {...register('status')}>
            <option value="backlog">Backlog</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Priority</label>
          <select className="input-field" {...register('priority')}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Cost Type</label>
          <select className="input-field" {...register('costType')}>
            <option value="opex">OPEX</option>
            <option value="capex">CAPEX</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Estimated Hours</label>
          <input type="number" step="0.5" min="0" className="input-field" {...register('estimatedHours')} />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Story Points</label>
          <input type="number" min="0" className="input-field" placeholder="—" {...register('storyPoints')} />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Start Date</label>
          <input type="date" className="input-field" {...register('startDate')} />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Due Date</label>
          <input type="date" className="input-field" {...register('dueDate')} />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Assignee</label>
          <select className="input-field" {...register('assignedTo')}>
            <option value="">— Unassigned —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Sprint</label>
          <select className="input-field" {...register('sprintId')}>
            <option value="">— Backlog —</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">WBS Code</label>
          <input className="input-field" placeholder="e.g. 1.2.3" {...register('wbsCode')} />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving…' : task ? 'Save Changes' : 'Create Task'}
        </Button>
      </div>
    </form>
  )
}
