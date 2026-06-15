import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'
import { useMyResource } from '@/hooks/useResources'
import { useProjects } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { useCreateTimeLog } from '@/hooks/useTimeLogs'

interface PresetTask {
  id: string
  name: string
  projectName?: string
}

interface Props {
  onClose: () => void
  /** When set, the task is fixed and the project/task pickers are hidden. */
  presetTask?: PresetTask
  /** When set (and no presetTask), the project is fixed and only its tasks are selectable. */
  lockProjectId?: string
}

export function LogTimeModal({ onClose, presetTask, lockProjectId }: Props) {
  const user = useAuthStore((s) => s.user)
  const resource = useMyResource(user?.id)

  const { data: projects = [] } = useProjects()
  const [projectId, setProjectId] = useState(lockProjectId ?? '')
  const [taskId, setTaskId] = useState(presetTask?.id ?? '')
  const { data: projectTasks = [] } = useTasks(presetTask ? undefined : (projectId || undefined))

  const create = useCreateTimeLog()
  const [hours, setHours] = useState('1')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [desc, setDesc] = useState('')

  const selectableTasks = projectTasks.filter((t) => t.status !== 'cancelled')
  const lockedProjectName = lockProjectId ? projects.find((p) => p.id === lockProjectId)?.name : undefined
  const effectiveTaskId = presetTask?.id ?? taskId
  const canSubmit = !!effectiveTaskId && parseFloat(hours) > 0 && !create.isPending

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="bg-background rounded-xl shadow-2xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    )
  }

  // No linked resource → can't attribute cost. Show guidance instead of the form.
  if (!resource) {
    return (
      <Shell>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Can't log time</h3>
          <button onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-muted-foreground">
          Your account isn't linked to a resource yet. Ask an admin to add you as a resource
          (Resources → edit resource → "Linked User") to log time.
        </p>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          {presetTask ? `Log time — ${presetTask.name}` : 'Log Time'}
        </h3>
        <button onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
      </div>

      {presetTask?.projectName && (
        <p className="text-xs text-muted-foreground -mt-1">{presetTask.projectName}</p>
      )}

      {/* Project + task pickers (hidden when a task is preset) */}
      {!presetTask && (
        <div className="space-y-2">
          {lockProjectId ? (
            <p className="text-xs text-muted-foreground">Project: <span className="font-medium text-foreground">{lockedProjectName ?? '—'}</span></p>
          ) : (
            <div>
              <label className="text-xs font-medium">Project</label>
              <select
                className="input-field"
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setTaskId('') }}
              >
                <option value="">Select a project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium">Task</label>
            <select
              className="input-field"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              disabled={!projectId}
            >
              <option value="">{projectId ? 'Select a task…' : 'Choose a project first'}</option>
              {selectableTasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium">Hours</label>
          <input type="number" min="0.25" step="0.25" className="input-field" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium">Date</label>
          <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium">Note (optional)</label>
        <input className="input-field" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What did you work on?" />
      </div>

      {create.isError && <p className="text-xs text-destructive">{(create.error as Error)?.message}</p>}

      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          disabled={!canSubmit}
          onClick={() => create.mutate(
            { taskId: effectiveTaskId, resourceId: resource.id, logDate: date, hours: parseFloat(hours), description: desc.trim() || undefined },
            { onSuccess: onClose },
          )}
        >
          {create.isPending ? 'Logging…' : 'Log time'}
        </Button>
      </div>
    </Shell>
  )
}
