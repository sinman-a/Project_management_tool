import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { TaskDependency } from '@/types'
import { useUpdateDependency, useRemoveDependency } from '@/hooks/useTasks'

const DEP_TYPES: TaskDependency['dependencyType'][] = [
  'finish_to_start',
  'start_to_start',
  'finish_to_finish',
  'start_to_finish',
]

const DEP_LABELS: Record<string, string> = {
  finish_to_start: 'FS',
  start_to_start: 'SS',
  finish_to_finish: 'FF',
  start_to_finish: 'SF',
}

interface Props {
  dep: TaskDependency
  anchorX: number
  anchorY: number
  onClose: () => void
}

export function DependencyPopover({ dep, anchorX, anchorY, onClose }: Props) {
  const [depType, setDepType] = useState(dep.dependencyType)
  const [lagDays, setLagDays] = useState(dep.lagDays)
  const updateDep = useUpdateDependency()
  const removeDep = useRemoveDependency()

  function handleSave() {
    updateDep.mutate(
      { taskId: dep.taskId, depId: dep.id, dependencyType: depType, lagDays },
      { onSuccess: onClose },
    )
  }

  function handleDelete() {
    removeDep.mutate(
      { taskId: dep.taskId, depId: dep.id },
      { onSuccess: onClose },
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <Card
        className="fixed z-50 p-3 w-56 shadow-lg space-y-3"
        style={{ left: anchorX, top: anchorY }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium text-muted-foreground">Dependency</p>

        <div className="space-y-1">
          <label className="text-xs">Type</label>
          <select
            className="w-full text-sm border rounded px-2 py-1"
            value={depType}
            onChange={(e) => setDepType(e.target.value as TaskDependency['dependencyType'])}
          >
            {DEP_TYPES.map((t) => (
              <option key={t} value={t}>{DEP_LABELS[t]} — {t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs">Lag days</label>
          <input
            type="number"
            className="w-full text-sm border rounded px-2 py-1"
            min={-30}
            max={60}
            value={lagDays}
            onChange={(e) => setLagDays(Number(e.target.value))}
          />
        </div>

        <div className="flex justify-between pt-1">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={removeDep.isPending}
          >
            Delete
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateDep.isPending}
          >
            Save
          </Button>
        </div>
      </Card>
    </>
  )
}
