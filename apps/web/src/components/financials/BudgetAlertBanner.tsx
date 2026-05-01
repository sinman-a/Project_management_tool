import { AlertTriangle, XCircle } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { BudgetSnapshot } from '@/types'

interface Props {
  snapshot: BudgetSnapshot
}

export function BudgetAlertBanner({ snapshot }: Props) {
  const totalBudget = snapshot.budgetCapex + snapshot.budgetOpex
  const totalUsed = snapshot.spentCapex + snapshot.spentOpex + snapshot.committedCapex + snapshot.committedOpex
  const pct = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0

  if (pct < 80 || totalBudget <= 0) return null

  const isOver = pct >= 100
  const remaining = Math.max(0, totalBudget - totalUsed)

  return (
    <div className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
      isOver ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-amber-50 border border-amber-200 text-amber-800'
    }`}>
      {isOver
        ? <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
      <div>
        <p className="font-medium">
          {isOver ? 'Over Budget' : 'Budget Alert'} — {formatPercent(pct)} used (spent + committed)
        </p>
        <p className="text-xs mt-0.5 opacity-80">
          {isOver
            ? `EAC exceeds budget by ${formatCurrency(snapshot.eacCapex + snapshot.eacOpex - totalBudget)}`
            : `${formatCurrency(remaining)} remaining before budget is exhausted`}
        </p>
      </div>
    </div>
  )
}
