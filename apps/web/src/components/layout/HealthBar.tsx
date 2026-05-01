import { usePrograms } from '@/hooks/useProjects'
import { formatCurrency } from '@/lib/utils'
import type { RagStatus } from '@/types'

function countByStatus(programs: { ragStatus?: RagStatus }[], status: RagStatus) {
  return programs.filter((p) => p.ragStatus === status).length
}

export function HealthBar() {
  const { data: programs = [] } = usePrograms()

  const green = countByStatus(programs, 'green')
  const amber = countByStatus(programs, 'amber')
  const red = countByStatus(programs, 'red')

  const totalBudget = programs.reduce((s, p) => s + (p as { budgetCapex?: number; budgetOpex?: number }).budgetCapex! + (p as { budgetCapex?: number; budgetOpex?: number }).budgetOpex!, 0)

  return (
    <div className="flex items-center gap-6 px-6 py-2 bg-muted/50 border-b text-sm">
      <span className="font-semibold text-muted-foreground">Portfolio Health:</span>
      <div className="flex items-center gap-3">
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
      <span className="ml-auto text-muted-foreground">
        Total Budget: <span className="font-medium text-foreground">{formatCurrency(totalBudget)}</span>
      </span>
      <span className="text-xs text-muted-foreground">
        As of {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}
