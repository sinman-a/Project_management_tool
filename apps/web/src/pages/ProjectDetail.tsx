import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Calendar, Users, CheckCircle2 } from 'lucide-react'
import { useProject, useUpdateProject } from '@/hooks/useProjects'
import { useProjectBudget, useProjectBudgetHistory, useRecalculateBudget } from '@/hooks/useBudget'
import { useTasks } from '@/hooks/useTasks'
import { useSprints } from '@/hooks/useSprints'
import { useAuthStore } from '@/stores/authStore'
import { BudgetWidget } from '@/components/financials/BudgetWidget'
import { BurnRateChart } from '@/components/financials/BurnRateChart'
import { EACIndicator } from '@/components/financials/EACIndicator'
import { BudgetAlertBanner } from '@/components/financials/BudgetAlertBanner'
import { RagDot } from '@/components/layout/RagDot'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WBSList } from '@/components/tasks/WBSList'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { ScrumBoard } from '@/components/tasks/ScrumBoard'
import { GanttChart } from '@/components/tasks/GanttChart'
import { RiceMatrix } from '@/components/tasks/RiceMatrix'
import { SprintPanel } from '@/components/sprints/SprintPanel'
import { TimeLogList } from '@/components/time/TimeLogList'
import { StatusReportList } from '@/components/reports/StatusReportList'
import { formatDate } from '@/lib/utils'
import { useState } from 'react'
import { ProjectForm } from '@/components/projects/ProjectForm'
import type { ProjectStatus } from '@/types'

const statusFlow: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'cancelled']

type Tab = 'wbs' | 'kanban' | 'gantt' | 'sprints' | 'time' | 'reports' | 'rice'

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: project, isLoading } = useProject(id!)
  const { data: budget } = useProjectBudget(id!)
  const { data: budgetHistory = [] } = useProjectBudgetHistory(id)
  const recalculate = useRecalculateBudget()
  const { data: tasks = [] } = useTasks(id)
  const { data: sprints = [] } = useSprints(id)
  const updateProject = useUpdateProject()
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('wbs')

  const canEdit =
    user?.role === 'admin' ||
    user?.role === 'program_manager' ||
    (user?.role === 'project_manager' && project?.managerId === user.id)

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-4 w-48 bg-muted rounded" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Project not found.</p>
        <Button variant="link" onClick={() => navigate('/projects')}>Back to Projects</Button>
      </div>
    )
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'wbs', label: `WBS (${tasks.length})` },
    { key: 'rice', label: 'RICE' },
    { key: 'sprints', label: `Sprint (${sprints.length})` },
    { key: 'kanban', label: 'Scrum Board' },
    { key: 'gantt', label: 'Gantt' },
    { key: 'time', label: 'Time Logs' },
    { key: 'reports', label: 'Reports' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <RagDot status={project.ragStatus ?? 'green'} size="lg" />
            <h1 className="text-2xl font-bold truncate">{project.name}</h1>
            <StatusBadge status={project.methodology} />
            <StatusBadge status={project.status} />
          </div>
          {project.description && (
            <p className="text-muted-foreground text-sm mt-1">{project.description}</p>
          )}
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing((v) => !v)}>
            <Pencil className="w-3 h-3 mr-1" />
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>
        )}
      </div>

      {/* Edit form */}
      {isEditing && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Edit Project</CardTitle></CardHeader>
          <CardContent>
            <ProjectForm
              project={project}
              isPending={updateProject.isPending}
              onCancel={() => setIsEditing(false)}
              onSubmit={(data) => {
                updateProject.mutate(
                  { id: project.id, ...data, programId: data.programId || undefined, endDate: data.endDate || undefined },
                  { onSuccess: () => setIsEditing(false) },
                )
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Key info row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Timeline</span>
            </div>
            <p className="text-sm font-medium">{formatDate(project.startDate)}</p>
            {project.endDate && <p className="text-xs text-muted-foreground">→ {formatDate(project.endDate)}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Status</span>
            </div>
            {canEdit ? (
              <select
                className="text-sm w-full border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                value={project.status}
                onChange={(e) =>
                  updateProject.mutate({ id: project.id, status: e.target.value as ProjectStatus })
                }
              >
                {statusFlow.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
                ))}
              </select>
            ) : (
              <StatusBadge status={project.status} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Progress</span>
            </div>
            <p className="text-sm font-medium">
              {tasks.filter((t) => t.status === 'done').length} / {tasks.length} tasks done
            </p>
            {tasks.length > 0 && (
              <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(tasks.filter((t) => t.status === 'done').length / tasks.length) * 100}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget */}
      {budget && <BudgetAlertBanner snapshot={budget} />}
      {budget ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm" variant="ghost"
              className="text-xs text-muted-foreground h-7"
              disabled={recalculate.isPending}
              onClick={() => recalculate.mutate(id!)}
            >
              {recalculate.isPending ? 'Recalculating…' : '↻ Recalculate Budget'}
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BudgetWidget snapshot={budget} label="Project Budget" />
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">EAC Analysis</CardTitle></CardHeader>
              <CardContent><EACIndicator snapshot={budget} /></CardContent>
            </Card>
          </div>
          {budgetHistory.length > 1 && (
            <BurnRateChart
              title="Burn Rate History"
              data={budgetHistory.map((s) => ({
                date: s.snapshotDate?.slice(0, 10) ?? '',
                spent: (s.spentCapex ?? 0) + (s.spentOpex ?? 0),
                budget: (s.budgetCapex ?? 0) + (s.budgetOpex ?? 0),
              }))}
            />
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-3 text-center text-xs text-muted-foreground">
            Budget snapshot appears after the first approved time log.
            {canEdit && (
              <Button size="sm" variant="link" className="ml-1 h-auto p-0 text-xs"
                onClick={() => recalculate.mutate(id!)}>
                Recalculate now
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Task tabs */}
      <div>
        <div className="flex border-b gap-0 mb-4">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'wbs' && (
          <WBSList projectId={id!} tasks={tasks} canEdit={canEdit} />
        )}
        {activeTab === 'kanban' && sprints.length > 0 && (
          <ScrumBoard projectId={id!} sprints={sprints} tasks={tasks} canEdit={canEdit} />
        )}
        {activeTab === 'kanban' && sprints.length === 0 && (
          <KanbanBoard projectId={id!} tasks={tasks} canEdit={canEdit} />
        )}
        {activeTab === 'gantt' && (
          <GanttChart tasks={tasks} />
        )}
        {activeTab === 'sprints' && (
          <SprintPanel projectId={id!} sprints={sprints} tasks={tasks} canEdit={canEdit} />
        )}
        {activeTab === 'rice' && (
          <RiceMatrix projectId={id!} canEdit={canEdit} />
        )}
        {activeTab === 'time' && (
          <TimeLogList projectId={id!} />
        )}
        {activeTab === 'reports' && (
          <StatusReportList projectId={id!} />
        )}
      </div>
    </div>
  )
}
