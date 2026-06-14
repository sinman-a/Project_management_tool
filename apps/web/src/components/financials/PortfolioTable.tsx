import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { RagDot } from '@/components/layout/RagDot'
import { StatusBadge } from '@/components/ui/status-badge'
import type { ProjectWithBudget } from '@/hooks/useBudget'
import type { RagStatus } from '@/types'

function computeRag(p: ProjectWithBudget): RagStatus {
  const budget = (p.budgetCapex ?? 0) + (p.budgetOpex ?? 0)
  if (budget <= 0) return 'green'
  const eac = (p.eacCapex ?? 0) + (p.eacOpex ?? 0)
  const used = (p.spentCapex ?? 0) + (p.spentOpex ?? 0) + (p.committedCapex ?? 0) + (p.committedOpex ?? 0)
  const usedPct = used / budget
  if (eac > budget || usedPct >= 1) return 'red'
  if (usedPct >= 0.8) return 'amber'
  return 'green'
}

function cpiValue(p: ProjectWithBudget): number | null {
  const budget = (p.budgetCapex ?? 0) + (p.budgetOpex ?? 0)
  const used = (p.spentCapex ?? 0) + (p.spentOpex ?? 0) + (p.committedCapex ?? 0) + (p.committedOpex ?? 0)
  if (used <= 0 || budget <= 0) return null
  return budget / used
}

function roiValue(p: ProjectWithBudget): number | null {
  const budget = (p.budgetCapex ?? 0) + (p.budgetOpex ?? 0)
  const benefit = p.expectedBenefit ?? 0
  if (budget <= 0 || benefit <= 0) return null
  return ((benefit - budget) / budget) * 100
}

interface Props {
  projects: ProjectWithBudget[]
}

export function PortfolioTable({ projects }: Props) {
  const navigate = useNavigate()

  if (projects.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm border rounded-lg">
        No projects yet. Create a project to see portfolio data.
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-muted/30 text-xs text-muted-foreground font-medium">
          <tr>
            <th className="text-left py-2 px-3">Project</th>
            <th className="text-left py-2 px-3">Status</th>
            <th className="py-2 px-3 text-center">RAG</th>
            <th className="text-right py-2 px-3">Budget</th>
            <th className="text-right py-2 px-3">Spent %</th>
            <th className="text-right py-2 px-3">EAC</th>
            <th className="text-right py-2 px-3">CPI</th>
            <th className="text-right py-2 px-3">ROI</th>
            <th className="text-right py-2 px-3">Burn/wk</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const budget = (p.budgetCapex ?? 0) + (p.budgetOpex ?? 0)
            const spent = (p.spentCapex ?? 0) + (p.spentOpex ?? 0)
            const committed = (p.committedCapex ?? 0) + (p.committedOpex ?? 0)
            const eac = (p.eacCapex ?? 0) + (p.eacOpex ?? 0)
            const burnRate = (p.burnRateCapex ?? 0) + (p.burnRateOpex ?? 0)
            const spentPct = budget > 0 ? ((spent + committed) / budget) * 100 : 0
            const rag = computeRag(p)
            const cpi = cpiValue(p)
            const roi = roiValue(p)
            const hasSnapshot = p.lastSnapshotDate != null

            return (
              <tr
                key={p.id}
                className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <td className="py-2.5 px-3">
                  <div className="font-medium truncate max-w-[200px]">{p.name}</div>
                  {p.methodology && (
                    <div className="text-xs text-muted-foreground capitalize">{p.methodology}</div>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="py-2.5 px-3 text-center">
                  <RagDot status={rag} />
                </td>
                <td className="py-2.5 px-3 text-right font-medium">
                  {formatCurrency(budget)}
                </td>
                <td className="py-2.5 px-3 text-right">
                  {hasSnapshot ? (
                    <span className={cn(
                      'font-medium',
                      spentPct >= 100 ? 'text-red-600' : spentPct >= 80 ? 'text-amber-600' : '',
                    )}>
                      {formatPercent(spentPct)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">no data</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right">
                  {hasSnapshot ? (
                    <span className={cn(eac > budget && budget > 0 ? 'text-red-600 font-medium' : '')}>
                      {formatCurrency(eac)}
                    </span>
                  ) : '—'}
                </td>
                <td className="py-2.5 px-3 text-right">
                  {cpi != null ? (
                    <span className={cn(
                      'font-medium',
                      cpi < 0.85 ? 'text-red-600' : cpi < 1.0 ? 'text-amber-600' : 'text-green-600',
                    )}>
                      {cpi.toFixed(2)}
                    </span>
                  ) : '—'}
                </td>
                <td className="py-2.5 px-3 text-right">
                  {roi != null ? (
                    <span className={cn('font-medium', roi >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {roi > 0 ? '+' : ''}{roi.toFixed(0)}%
                    </span>
                  ) : '—'}
                </td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">
                  {hasSnapshot ? formatCurrency(burnRate) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
