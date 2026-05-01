import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { BudgetSnapshot } from '@/types'

interface BudgetWidgetProps {
  snapshot: BudgetSnapshot
  label?: string
}

export function BudgetWidget({ snapshot, label = 'Budget' }: BudgetWidgetProps) {
  const totalBudget = snapshot.budgetCapex + snapshot.budgetOpex
  const totalSpent = snapshot.spentCapex + snapshot.spentOpex
  const totalCommitted = snapshot.committedCapex + snapshot.committedOpex
  const remaining = Math.max(0, totalBudget - totalSpent - totalCommitted)
  const spentPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  const chartData = [
    { name: 'Spent', value: totalSpent, color: spentPct > 80 ? '#ef4444' : '#3b82f6' },
    { name: 'Committed', value: totalCommitted, color: '#f59e0b' },
    { name: 'Remaining', value: remaining, color: '#e5e7eb' },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={40}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between gap-8">
              <span className="text-muted-foreground">Budget</span>
              <span className="font-medium">{formatCurrency(totalBudget)}</span>
            </div>
            <div className="flex items-center justify-between gap-8">
              <span className="text-muted-foreground">Spent</span>
              <span className={`font-medium ${spentPct > 80 ? 'text-red-600' : ''}`}>
                {formatCurrency(totalSpent)} ({formatPercent(spentPct)})
              </span>
            </div>
            <div className="flex items-center justify-between gap-8">
              <span className="text-muted-foreground">Committed</span>
              <span className="font-medium text-amber-600">{formatCurrency(totalCommitted)}</span>
            </div>
            <div className="flex items-center justify-between gap-8">
              <span className="text-muted-foreground">EAC</span>
              <span className="font-medium">{formatCurrency(snapshot.eacCapex + snapshot.eacOpex)}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Burn Rate / week</span>
            <p>{formatCurrency(snapshot.burnRateCapex + snapshot.burnRateOpex)}</p>
          </div>
          <div>
            <span className="font-medium text-foreground">CAPEX / OPEX</span>
            <p>
              {formatCurrency(snapshot.spentCapex)} / {formatCurrency(snapshot.spentOpex)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
