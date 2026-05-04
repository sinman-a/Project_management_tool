import { useState } from 'react'
import { ArrowRight, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { KanbanBoard } from './KanbanBoard'
import { useUpdateTask } from '@/hooks/useTasks'
import type { Sprint, Task } from '@/types'

interface Props {
  projectId: string
  sprints: Sprint[]
  tasks: Task[]
  canEdit: boolean
}

export function ScrumBoard({ projectId, sprints, tasks, canEdit }: Props) {
  const activeSprint = sprints.find((s) => s.status === 'active') ?? sprints[0]
  const [selectedId, setSelectedId] = useState<string>(activeSprint.id)
  const updateTask = useUpdateTask()

  const selectedSprint = sprints.find((s) => s.id === selectedId)!
  const sprintTasks = tasks.filter((t) => t.sprintId === selectedId)
  const backlogTasks = tasks.filter((t) => !t.sprintId)

  const doneCount = sprintTasks.filter((t) => t.status === 'done').length
  const totalPoints = sprintTasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0)

  return (
    <div className="space-y-5">
      {/* Sprint selector tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {sprints.map((sprint) => (
          <button
            key={sprint.id}
            onClick={() => setSelectedId(sprint.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              selectedId === sprint.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground',
            )}
          >
            {sprint.status === 'active' && <Zap className="w-3 h-3" />}
            {sprint.name}
          </button>
        ))}
      </div>

      {/* Sprint info bar */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground border-b pb-3 flex-wrap">
        <StatusBadge status={selectedSprint.status} />
        <span>{selectedSprint.startDate} → {selectedSprint.endDate}</span>
        <span>{doneCount}/{sprintTasks.length} tasks done</span>
        {totalPoints > 0 && <span>{totalPoints} pts</span>}
        {selectedSprint.goal && (
          <span className="italic text-foreground/70">"{selectedSprint.goal}"</span>
        )}
      </div>

      {/* Sprint kanban board */}
      <KanbanBoard
        projectId={projectId}
        tasks={sprintTasks}
        canEdit={canEdit}
        sprintId={selectedId}
      />

      {/* Product backlog — unassigned tasks */}
      {backlogTasks.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Product Backlog ({backlogTasks.length} unassigned)
          </p>
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="space-y-1">
                {backlogTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 py-1 text-sm">
                    <span className="flex-1 truncate">{task.name}</span>
                    {task.storyPoints != null && (
                      <span className="text-xs text-muted-foreground">{task.storyPoints}p</span>
                    )}
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs px-2"
                        disabled={updateTask.isPending}
                        onClick={() => updateTask.mutate({ id: task.id, sprintId: selectedId })}
                      >
                        <ArrowRight className="w-3 h-3 mr-1" />
                        Add to sprint
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
