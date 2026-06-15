import { usePortfolioSummary } from '@/hooks/useBudget'
import { computeRag } from '@/lib/rag'
import { formatCurrency } from '@/lib/utils'

const ACTIVE = new Set(['planning', 'active', 'on_hold'])

export function HealthBar() {
  const { data: projects = [] } = usePortfolioSummary()

  // Count real RAG across active projects (budget/EAC-based), not programs.
  const active = projects.filter((p) => ACTIVE.has(p.status))
  let green = 0, amber = 0, red = 0
  for (const p of active) {
    const rag = computeRag(p)
    if (rag === 'red') red++
    else if (rag === 'amber') amber++
    else green++
  }

  const totalBudget = projects.reduce((s, p) => s + (p.budgetCapex ?? 0) + (p.budgetOpex ?? 0), 0)

  return (
    <div className="flex items-center gap-6 px-6 py-2 bg-muted/50 border-b text-sm overflow-x-auto no-scrollbar">
      <span className="font-semibold text-muted-foreground whitespace-nowrap">Portfolio Health:</span>
      <div className="flex items-center gap-3 whitespace-nowrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          {green} On Track
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
          {amber} At Risk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          {red} Critical
        </span>
      </div>
      <span className="ml-auto text-muted-foreground whitespace-nowrap">
        Total Budget: <span className="font-medium text-foreground">{formatCurrency(totalBudget)}</span>
      </span>
    </div>
  )
}
