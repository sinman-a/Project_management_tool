import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface BurnRatePoint {
  date: string
  spent: number
  projected?: number
  budget: number
}

interface BurnRateChartProps {
  data: BurnRatePoint[]
  title?: string
}

export function BurnRateChart({ data, title = 'Burn Rate' }: BurnRateChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <ReferenceLine y={data[0]?.budget} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Budget', fontSize: 10 }} />
            <Line type="monotone" dataKey="spent" stroke="#3b82f6" strokeWidth={2} dot={false} name="Actual" />
            <Line type="monotone" dataKey="projected" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Projected" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
