import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import type { BudgetSnapshot } from '@/types'

function cpi(budget: number, spent: number, committed: number) {
  const used = spent + committed
  return used > 0 ? budget / used : 1
}

function ragColor(eac: number, budget: number) {
  if (budget <= 0) return 'text-muted-foreground'
  const ratio = eac / budget
  if (ratio > 1.0) return 'text-red-600'
  if (ratio > 0.85) return 'text-amber-600'
  return 'text-green-600'
}

function barColor(pct: number) {
  if (pct > 100) return 'bg-red-500'
  if (pct > 85) return 'bg-amber-400'
  return 'bg-blue-500'
}

interface BarRowProps {
  label: string
  budget: number
  spent: number
  committed: number
  eac: number
}

function BarRow({ label, budget, spent, committed, eac }: BarRowProps) {
  if (budget <= 0 && eac <= 0) return null
  const spentPct = budget > 0 ? (spent / budget) * 100 : 0
  const committedPct = budget > 0 ? (committed / budget) * 100 : 0
  const eacPct = budget > 0 ? (eac / budget) * 100 : 0
  const cpiVal = cpi(budget, spent, committed)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">CPI {cpiVal.toFixed(2)}</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden flex">
        <div
          className={cn('h-full transition-all', barColor(spentPct))}
          style={{ width: `${Math.min(spentPct, 100)}%` }}
          title={`Spent: ${formatCurrency(spent)}`}
        />
        <div
          className="h-full bg-amber-300 transition-all"
          style={{ width: `${Math.min(committedPct, 100 - Math.min(spentPct, 100))}%` }}
          title={`Committed: ${formatCurrency(committed)}`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Spent {formatCurrency(spent)} · Committed {formatCurrency(committed)}</span>
        <span className={cn('font-medium', ragColor(eac, budget))}>
          EAC {formatCurrency(eac)} ({Math.round(eacPct)}%)
        </span>
      </div>
    </div>
  )
}

interface Props {
  snapshot: BudgetSnapshot
}

export function EACIndicator({ snapshot }: Props) {
  const totalBudget = snapshot.budgetCapex + snapshot.budgetOpex
  const totalEac = snapshot.eacCapex + snapshot.eacOpex
  const variance = totalBudget - totalEac

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Budget</p>
          <p className="text-sm font-semibold">{formatCurrency(totalBudget)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">EAC</p>
          <p className={cn('text-sm font-semibold', ragColor(totalEac, totalBudget))}>
            {formatCurrency(totalEac)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Variance</p>
          <p className={cn('text-sm font-semibold', variance < 0 ? 'text-red-600' : 'text-green-600')}>
            {variance < 0 ? '-' : '+'}{formatCurrency(Math.abs(variance))}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <BarRow
          label="CAPEX"
          budget={snapshot.budgetCapex}
          spent={snapshot.spentCapex}
          committed={snapshot.committedCapex}
          eac={snapshot.eacCapex}
        />
        <BarRow
          label="OPEX"
          budget={snapshot.budgetOpex}
          spent={snapshot.spentOpex}
          committed={snapshot.committedOpex}
          eac={snapshot.eacOpex}
        />
      </div>

      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-sm inline-block" />Spent</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-300 rounded-sm inline-block" />Committed</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-muted rounded-sm inline-block border" />Remaining</span>
      </div>
    </div>
  )
}
