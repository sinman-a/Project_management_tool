import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Calendar, Users, CheckCircle2, ChevronRight } from 'lucide-react'
import { useProject, useUpdateProject, usePrograms } from '@/hooks/useProjects'
import { usePortfolios } from '@/hooks/usePortfolios'
import { useProjectBudget, useProjectBudgetHistory, useRecalculateBudget } from '@/hooks/useBudget'
import { useTasks, useProjectSchedule, useProjectTaskDeps, useAddDependency } from '@/hooks/useTasks'
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
import { DependencyPopover } from '@/components/tasks/DependencyPopover'
import { useProjectLinks } from '@/hooks/useTaskLinks'
import { RiceMatrix } from '@/components/tasks/RiceMatrix'
import { SprintPanel } from '@/components/sprints/SprintPanel'
import { TimeLogList } from '@/components/time/TimeLogList'
import { StatusReportList } from '@/components/reports/StatusReportList'
import { RiskRegister } from '@/components/risks/RiskRegister'
import { TopRisksWidget } from '@/components/risks/TopRisksWidget'
import { ExportButton } from '@/components/ui/ExportButton'
import { EVMTiles } from '@/components/baseline/EVMTiles'
import { ForecastCard } from '@/components/analytics/ForecastCard'
import { CostEstimationMatrix } from '@/components/financials/CostEstimationMatrix'
import { StaffCostView } from '@/components/financials/StaffCostView'
import { RoiCard } from '@/components/financials/RoiCard'
import { BudgetVersionsPanel } from '@/components/financials/BudgetVersionsPanel'
import { BaselinePanel } from '@/components/baseline/BaselinePanel'
import { CommentThread } from '@/components/collaboration/CommentThread'
import { ActivityFeed } from '@/components/collaboration/ActivityFeed'
import { ProjectTeamPanel } from '@/components/resources/ProjectTeamPanel'
import { formatDate } from '@/lib/utils'
import { useState, useMemo } from 'react'
import { ProjectForm } from '@/components/projects/ProjectForm'
import type { ProjectStatus, CpmFields, TaskDependency } from '@/types'

const statusFlow: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'cancelled']

type Tab = 'wbs' | 'kanban' | 'gantt' | 'sprints' | 'time' | 'reports' | 'rice' | 'risks' | 'baselines' | 'discussion' | 'activity' | 'cost' | 'staffcost' | 'team' | 'budget'

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
  const { data: projectLinks = [] } = useProjectLinks(id)
  const { data: schedule = [] } = useProjectSchedule(id)
  const { data: taskDeps = [] } = useProjectTaskDeps(id)
  const addDependency = useAddDependency()
  const updateProject = useUpdateProject()
  const { data: programs = [] } = usePrograms()
  const { data: portfolios = [] } = usePortfolios()
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('wbs')
  const [depPopover, setDepPopover] = useState<{ dep: TaskDependency; x: number; y: number } | null>(null)

  const cpmMap = useMemo(() => {
    const m = new Map<string, CpmFields>()
    for (const entry of schedule) {
      m.set(entry.id, {
        earlyStart: entry.earlyStart,
        earlyFinish: entry.earlyFinish,
        lateStart: entry.lateStart,
        lateFinish: entry.lateFinish,
        totalFloat: entry.totalFloat,
        isCritical: entry.isCritical,
        duration: entry.duration,
      })
    }
    return m
  }, [schedule])


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

  const hasCriticalOpenRisk = (project as any)?.ragCapReason === 'critical_risk'

  const TABS: { key: Tab; label: string; badge?: boolean }[] = [
    { key: 'wbs', label: `WBS (${tasks.length})` },
    { key: 'rice', label: 'RICE' },
    { key: 'sprints', label: `Sprint (${sprints.length})` },
    { key: 'kanban', label: 'Board' },
    { key: 'team', label: 'Team' },
    { key: 'gantt', label: 'Gantt' },
    { key: 'time', label: 'Time Logs' },
    { key: 'reports', label: 'Reports' },
    { key: 'risks', label: 'Risks', badge: hasCriticalOpenRisk },
    { key: 'budget', label: 'Budget' },
    { key: 'cost', label: 'Cost Estimation' },
    { key: 'staffcost', label: 'Staff Cost' },
    { key: 'baselines', label: 'Baselines' },
    { key: 'discussion', label: 'Discussion' },
    { key: 'activity', label: 'Activity' },
  ]

  // Group tabs into semantic blocks so they fit on screen (no horizontal scroll).
  const TAB_GROUPS: { label: string; keys: Tab[] }[] = [
    { label: 'Tasks', keys: ['wbs', 'kanban', 'sprints', 'gantt'] },
    { label: 'Finance', keys: ['budget', 'cost'] },
    { label: 'People', keys: ['team', 'time', 'staffcost'] },
    { label: 'Analysis', keys: ['rice', 'risks', 'baselines', 'reports'] },
    { label: 'Communication', keys: ['discussion', 'activity'] },
  ]
  const tabMap = Object.fromEntries(TABS.map((t) => [t.key, t])) as Record<Tab, typeof TABS[number]>
  const activeGroupIdx = Math.max(0, TAB_GROUPS.findIndex((g) => g.keys.includes(activeTab)))

  const program = project.programId ? programs.find((p) => p.id === project.programId) : undefined
  const portfolio = program?.portfolioId ? portfolios.find((pf) => pf.id === program.portfolioId) : undefined

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Breadcrumbs: Portfolio → Program → Project */}
      <nav className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap" aria-label="Breadcrumb">
        {program ? (
          <>
            <Link to="/portfolios" className="hover:text-foreground">Portfolios</Link>
            {portfolio && (
              <>
                <ChevronRight className="w-3 h-3" />
                <Link to={`/portfolios/${portfolio.id}`} className="hover:text-foreground">{portfolio.name}</Link>
              </>
            )}
            <ChevronRight className="w-3 h-3" />
            <Link to={`/programs/${program.id}`} className="hover:text-foreground">{program.name}</Link>
          </>
        ) : (
          <Link to="/projects" className="hover:text-foreground">Projects</Link>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium truncate max-w-[240px]">{project.name}</span>
      </nav>

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

      {/* EVM Tiles */}
      <EVMTiles projectId={id!} />

      {/* Completion Forecast */}
      <ForecastCard projectId={id!} />

      {/* Top Risks */}
      <TopRisksWidget projectId={id!} onRiskClick={() => setActiveTab('risks')} />

      {/* Budget */}
      {budget && <BudgetAlertBanner snapshot={budget} />}
      {budget ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {budget.snapshotDate
                ? `Last calculated ${new Date(budget.snapshotDate).toLocaleString()}`
                : 'Not yet calculated'}
            </span>
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

      {/* Task tabs — grouped into semantic blocks (Tasks/Finance/People/Analysis/Communication) */}
      <div>
        {/* Group selector */}
        <div className="flex flex-wrap gap-1 mb-2">
          {TAB_GROUPS.map((g, idx) => {
            const active = idx === activeGroupIdx
            const groupHasBadge = g.keys.some((k) => tabMap[k]?.badge)
            return (
              <button
                key={g.label}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
                onClick={() => { if (!g.keys.includes(activeTab)) setActiveTab(g.keys[0]) }}
              >
                {g.label}
                {groupHasBadge && <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />}
              </button>
            )
          })}
        </div>
        {/* Sub-tabs of the active group */}
        <div className="flex flex-wrap border-b gap-0 mb-4">
          {TAB_GROUPS[activeGroupIdx].keys.map((key) => {
            const { label, badge } = tabMap[key]
            return (
              <button
                key={key}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1 ${
                  activeTab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab(key)}
              >
                {label}
                {badge && <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />}
              </button>
            )
          })}
        </div>

        {activeTab === 'wbs' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <ExportButton options={[
                { label: 'Export WBS (XLSX)', path: `/projects/${id}/export/wbs` },
              ]} />
            </div>
            <WBSList projectId={id!} tasks={tasks} canEdit={canEdit} dependencies={taskDeps} cpmData={cpmMap.size > 0 ? cpmMap : undefined} />
          </div>
        )}
        {activeTab === 'kanban' && sprints.length > 0 && (
          <ScrumBoard projectId={id!} sprints={sprints} tasks={tasks} canEdit={canEdit} />
        )}
        {activeTab === 'kanban' && sprints.length === 0 && (
          <KanbanBoard projectId={id!} tasks={tasks} canEdit={canEdit} />
        )}
        {activeTab === 'gantt' && (
          <>
            <GanttChart
              tasks={tasks}
              links={projectLinks}
              dependencies={taskDeps}
              cpmData={cpmMap.size > 0 ? cpmMap : undefined}
              onAddTasks={() => setActiveTab('wbs')}
              onCreateDependency={canEdit ? (predId, succId) => {
                addDependency.mutate({ taskId: succId, dependsOnId: predId })
              } : undefined}
              onArrowClick={(dep) => {
                const rect = document.querySelector('[data-gantt-chart]')?.getBoundingClientRect()
                setDepPopover({ dep, x: (rect?.left ?? 0) + 200, y: (rect?.top ?? 0) + 100 })
              }}
            />
            {depPopover && (
              <DependencyPopover
                dep={depPopover.dep}
                anchorX={depPopover.x}
                anchorY={depPopover.y}
                onClose={() => setDepPopover(null)}
              />
            )}
          </>
        )}
        {activeTab === 'sprints' && (
          <SprintPanel projectId={id!} sprints={sprints} tasks={tasks} canEdit={canEdit} />
        )}
        {activeTab === 'rice' && (
          <RiceMatrix projectId={id!} canEdit={canEdit} />
        )}
        {activeTab === 'time' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <ExportButton options={[
                { label: 'Export All (XLSX)', path: `/projects/${id}/export/time-logs` },
                { label: 'Export Approved (XLSX)', path: `/projects/${id}/export/time-logs?status=approved` },
              ]} />
            </div>
            <TimeLogList projectId={id!} />
          </div>
        )}
        {activeTab === 'reports' && (
          <StatusReportList projectId={id!} />
        )}
        {activeTab === 'risks' && (
          <RiskRegister projectId={id!} canEdit={canEdit} />
        )}
        {activeTab === 'cost' && (
          <CostEstimationMatrix projectId={id!} canEdit={canEdit} />
        )}
        {activeTab === 'staffcost' && (
          <StaffCostView projectId={id!} />
        )}
        {activeTab === 'team' && (
          <ProjectTeamPanel projectId={id!} canEdit={canEdit} />
        )}
        {activeTab === 'budget' && (
          <div className="space-y-4">
            <RoiCard projectId={id!} />
            <BudgetVersionsPanel projectId={id!} canEdit={canEdit} />
          </div>
        )}
        {activeTab === 'baselines' && (
          <BaselinePanel projectId={id!} canEdit={canEdit} />
        )}
        {activeTab === 'discussion' && (
          <div className="max-w-2xl">
            <CommentThread entityType="project" entityId={id!} canModerate={canEdit} />
          </div>
        )}
        {activeTab === 'activity' && (
          <div className="max-w-2xl">
            <ActivityFeed projectId={id!} />
          </div>
        )}
      </div>
    </div>
  )
}
