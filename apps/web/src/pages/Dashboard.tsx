import { useNavigate } from 'react-router-dom'
import { usePortfolioSummary } from '@/hooks/useBudget'
import { useProjectTimeLogs } from '@/hooks/useTimeLogs'
import { PortfolioTable } from '@/components/financials/PortfolioTable'
import { ResourceHeatmap } from '@/components/resources/ResourceHeatmap'
import { BudgetWidget } from '@/components/financials/BudgetWidget'
import { MetricCard } from '@/components/widgets/MetricCard'
import { RagDot } from '@/components/layout/RagDot'
import { useUiStore } from '@/stores/uiStore'
import { useProject } from '@/hooks/useProjects'
import { useProjectBudget } from '@/hooks/useBudget'
import { formatCurrency } from '@/lib/utils'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function ContextPanel() {
  const navigate = useNavigate()
  const { selectedProjectId } = useUiStore()
  const { data: project } = useProject(selectedProjectId ?? '')
  const { data: budget } = useProjectBudget(selectedProjectId ?? '')
  const { data: pendingLogs = [] } = useProjectTimeLogs(selectedProjectId ?? undefined, false)

  if (!selectedProjectId || !project) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground">Select a project from the sidebar to view details.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <RagDot status={project.ragStatus ?? 'green'} />
          <h3 className="font-medium text-sm truncate">{project.name}</h3>
        </div>
        <p className="text-xs text-muted-foreground capitalize">{project.methodology} · {project.status}</p>
      </div>

      {budget && <BudgetWidget snapshot={budget} label="Project Budget" />}

      {pendingLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Pending Approvals ({pendingLogs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => navigate(`/projects/${project.id}?tab=time`)}
            >
              Review Time Logs
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function KpiRow() {
  const { data: projects = [] } = usePortfolioSummary()

  const activeProjects = projects.filter((p) => p.status === 'active')
  const totalBudget = projects.reduce((s, p) => s + (p.budgetCapex ?? 0) + (p.budgetOpex ?? 0), 0)
  const totalSpent = projects.reduce((s, p) => s + (p.spentCapex ?? 0) + (p.spentOpex ?? 0), 0)
  const totalBurnRate = projects.reduce((s, p) => s + (p.burnRateCapex ?? 0) + (p.burnRateOpex ?? 0), 0)

  const totalUsed = projects.reduce(
    (s, p) => s + (p.spentCapex ?? 0) + (p.spentOpex ?? 0) + (p.committedCapex ?? 0) + (p.committedOpex ?? 0),
    0,
  )
  const avgCpi = totalUsed > 0 && totalBudget > 0 ? totalBudget / totalUsed : null
  const spentPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-3 border-t">
      <MetricCard
        title="Active Projects"
        value={activeProjects.length}
        subtitle={`of ${projects.length} total`}
      />
      <MetricCard
        title="Portfolio Spent"
        value={`${spentPct.toFixed(0)}%`}
        subtitle={formatCurrency(totalSpent)}
        valueColor={spentPct > 80 ? 'red' : spentPct > 60 ? 'amber' : 'default'}
      />
      <MetricCard
        title="Avg CPI"
        value={avgCpi != null ? avgCpi.toFixed(2) : '—'}
        subtitle="cost performance"
        valueColor={avgCpi != null ? (avgCpi < 0.85 ? 'red' : avgCpi < 1.0 ? 'amber' : 'green') : 'default'}
      />
      <MetricCard
        title="Burn Rate / wk"
        value={formatCurrency(totalBurnRate)}
        subtitle="portfolio total"
      />
      <MetricCard
        title="Total Budget"
        value={formatCurrency(totalBudget)}
        subtitle="all projects"
      />
    </div>
  )
}

export function Dashboard() {
  const { dashboardView, setDashboardView } = useUiStore()
  const { data: projects = [], isLoading } = usePortfolioSummary()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <span className="text-sm text-muted-foreground mr-2">View:</span>
        {(['portfolio', 'heatmap'] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={dashboardView === v ? 'default' : 'outline'}
            onClick={() => setDashboardView(v)}
            className="capitalize"
          >
            {v}
          </Button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          {isLoading && (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted rounded" />)}
            </div>
          )}

          {!isLoading && dashboardView === 'portfolio' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Project Portfolio ({projects.length})
              </h2>
              <PortfolioTable projects={projects} />
            </div>
          )}

          {!isLoading && dashboardView === 'heatmap' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Resource Utilization
              </h2>
              <ResourceHeatmap />
            </div>
          )}

          {!isLoading && dashboardView !== 'portfolio' && dashboardView !== 'heatmap' && (
            <PortfolioTable projects={projects} />
          )}
        </div>

        <div className="w-72 border-l flex flex-col overflow-hidden">
          <ContextPanel />
        </div>
      </div>

      <KpiRow />
    </div>
  )
}
