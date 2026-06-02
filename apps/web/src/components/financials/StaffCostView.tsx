import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjectCostEstimations, useCostEstimation } from '@/hooks/useCostEstimations'
import { useProjectBudget } from '@/hooks/useBudget'

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', UAH: '₴',
}

function fmt(currency: string, amount: number): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency
  return `${sym}${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

interface Props {
  projectId: string
}

export function StaffCostView({ projectId }: Props) {
  const { data: list = [], isLoading: listLoading } = useProjectCostEstimations(projectId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeId = selectedId ?? list[0]?.id ?? null
  const { data: estimation, isLoading } = useCostEstimation(activeId ?? undefined)
  const { data: budget } = useProjectBudget(projectId)

  if (listLoading) {
    return <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
  }

  if (list.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm border rounded-lg">
        No cost estimations yet. Create one in the <span className="font-medium">Cost Estimation</span> tab first.
      </div>
    )
  }

  if (isLoading || !estimation) {
    return <div className="py-12 text-center text-muted-foreground text-sm">Loading staff cost…</div>
  }

  const { currency, summary } = estimation
  const grand = summary.grandTotal
  const capexPct = grand > 0 ? (summary.totalCapex / grand) * 100 : 0
  const opexPct = grand > 0 ? (summary.totalOpex / grand) * 100 : 0

  // Sort grades by cost desc, drop empties
  const gradeRows = [...summary.byGrade]
    .filter((g) => g.totalDays > 0)
    .sort((a, b) => b.totalCost - a.totalCost)

  // Actual budget comparison
  const actualBudget = budget ? (budget.budgetCapex ?? 0) + (budget.budgetOpex ?? 0) : null
  const delta = actualBudget != null ? grand - actualBudget : null

  return (
    <div className="space-y-4">
      {/* Estimation selector */}
      {list.length > 1 && (
        <div className="relative inline-block">
          <select
            className="text-sm border rounded px-3 py-1.5 pr-8 bg-background appearance-none font-medium focus:outline-none focus:ring-1 focus:ring-ring"
            value={activeId ?? ''}
            onChange={(e) => setSelectedId(e.target.value || null)}
          >
            {list.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      )}

      {/* Staff cost breakdown table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Staff Cost Summary — {estimation.name}</CardTitle>
        </CardHeader>
        <CardContent>
          {gradeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No days entered yet. Fill in the cost estimation matrix to see the breakdown.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left py-2 font-medium">Grade</th>
                  <th className="text-right py-2 font-medium">Days</th>
                  <th className="text-right py-2 font-medium">Rate/day</th>
                  <th className="text-right py-2 font-medium">Cost</th>
                  <th className="text-center py-2 font-medium">Type</th>
                  <th className="text-right py-2 font-medium">% of total</th>
                </tr>
              </thead>
              <tbody>
                {gradeRows.map((g) => {
                  const pct = grand > 0 ? (g.totalCost / grand) * 100 : 0
                  return (
                    <tr key={g.gradeId} className="border-b last:border-0">
                      <td className="py-2 font-medium">{g.gradeName}</td>
                      <td className="py-2 text-right tabular-nums">{g.totalDays}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(currency, g.ratePerDay)}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{fmt(currency, g.totalCost)}</td>
                      <td className="py-2 text-center">
                        <span className={cn(
                          'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                          g.costType === 'capex' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700',
                        )}>
                          {g.costType}
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{pct.toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td className="py-2">TOTAL</td>
                  <td className="py-2 text-right tabular-nums">{summary.totalDays}</td>
                  <td className="py-2" />
                  <td className="py-2 text-right tabular-nums">{fmt(currency, grand)}</td>
                  <td className="py-2" />
                  <td className="py-2 text-right tabular-nums">100%</td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>

      {/* CAPEX / OPEX breakdown bars */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">CAPEX / OPEX Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-blue-600">CAPEX</span>
              <span className="tabular-nums">{fmt(currency, summary.totalCapex)} ({capexPct.toFixed(1)}%)</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${capexPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-purple-600">OPEX</span>
              <span className="tabular-nums">{fmt(currency, summary.totalOpex)} ({opexPct.toFixed(1)}%)</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${opexPct}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compare with actual budget */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">Compare with Project Budget</CardTitle>
        </CardHeader>
        <CardContent>
          {actualBudget == null ? (
            <p className="text-sm text-muted-foreground">
              No project budget snapshot yet. Set CAPEX/OPEX budgets and recalculate to compare.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Estimated</p>
                <p className="text-lg font-bold tabular-nums">{fmt(currency, grand)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Budget</p>
                <p className="text-lg font-bold tabular-nums">{fmt(currency, actualBudget)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Δ Variance</p>
                <p className={cn(
                  'text-lg font-bold tabular-nums',
                  delta == null ? '' : delta > 0 ? 'text-red-600' : 'text-green-600',
                )}>
                  {delta != null && delta > 0 ? '+' : ''}{fmt(currency, delta ?? 0)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
