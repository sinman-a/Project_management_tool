import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Layers, FolderKanban } from 'lucide-react'
import { usePortfolio, usePortfolioSummary } from '@/hooks/usePortfolios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RagDot } from '@/components/layout/RagDot'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatCurrency } from '@/lib/utils'

const RAG_COLOR: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

export function PortfolioDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: portfolio, isLoading } = usePortfolio(id)
  const { data: summary } = usePortfolioSummary(id)

  if (isLoading) {
    return <div className="p-6 animate-pulse"><div className="h-8 w-64 bg-muted rounded" /></div>
  }
  if (!portfolio) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Portfolio not found.</p>
        <Button variant="link" onClick={() => navigate('/portfolios')}>Back to Portfolios</Button>
      </div>
    )
  }

  const rollup = summary?.rollup
  const programs = summary?.programs ?? []
  const projects = summary?.projects ?? []
  const projectsByProgram = (programId: string) => projects.filter((p) => p.programId === programId)

  const ragTotal = rollup ? Object.values(rollup.ragMix).reduce((s, n) => s + n, 0) : 0

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate('/portfolios')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="w-6 h-6" /> {portfolio.name}
          </h1>
          {portfolio.description && <p className="text-muted-foreground text-sm mt-1">{portfolio.description}</p>}
        </div>
      </div>

      {/* Rollup KPIs */}
      {rollup && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Programs</p>
            <p className="text-2xl font-bold">{rollup.programCount}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Projects</p>
            <p className="text-2xl font-bold">{rollup.projectCount}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Budget</p>
            <p className="text-2xl font-bold">{formatCurrency(rollup.totalBudget)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Spent</p>
            <p className="text-2xl font-bold">{formatCurrency(rollup.totalSpent)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">EAC {formatCurrency(rollup.totalEac)}</p>
          </CardContent></Card>
        </div>
      )}

      {/* RAG mix bar */}
      {rollup && ragTotal > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Project Health (RAG)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-3 rounded-full overflow-hidden">
              {(['green', 'amber', 'red'] as const).map((rag) => {
                const n = rollup.ragMix[rag] ?? 0
                if (n === 0) return null
                return <div key={rag} className={RAG_COLOR[rag]} style={{ width: `${(n / ragTotal) * 100}%` }} title={`${rag}: ${n}`} />
              })}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              {(['green', 'amber', 'red'] as const).map((rag) => (
                <span key={rag} className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${RAG_COLOR[rag]}`} /> {rollup.ragMix[rag] ?? 0} {rag}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Programs grouped */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Programs</h2>
        {programs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No programs assigned to this portfolio yet. Assign a program via its edit form.</p>
        ) : (
          programs.map((pg) => (
            <Card key={pg.id}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <button
                  type="button"
                  className="text-sm font-semibold hover:text-primary flex items-center gap-2"
                  onClick={() => navigate(`/programs/${pg.id}`)}
                >
                  <FolderKanban className="w-4 h-4" /> {pg.name}
                </button>
                <StatusBadge status={pg.status} />
              </CardHeader>
              <CardContent className="pt-0">
                {projectsByProgram(pg.id).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No projects.</p>
                ) : (
                  <div className="divide-y">
                    {projectsByProgram(pg.id).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full flex items-center justify-between py-1.5 text-sm hover:text-primary"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <RagDot status={(p.ragStatus as 'green' | 'amber' | 'red') ?? 'green'} />
                          <span className="truncate">{p.name}</span>
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatCurrency((p.budgetCapex ?? 0) + (p.budgetOpex ?? 0))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
