import { useNavigate } from 'react-router-dom'
import {
  PieChart, Pie, Cell, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricCard } from '@/components/widgets/MetricCard'
import { formatCurrency } from '@/lib/utils'
import { usePortfolioAnalytics } from '@/hooks/useAnalytics'

const RAG_COLORS: Record<string, string> = { green: '#16a34a', amber: '#d97706', red: '#dc2626' }

export function PortfolioAnalytics() {
  const navigate = useNavigate()
  const { data, isLoading } = usePortfolioAnalytics()

  if (isLoading) {
    return <div className="h-64 bg-muted rounded animate-pulse" />
  }
  if (!data || data.projects.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm border rounded-lg">
        No active projects to analyse yet.
      </div>
    )
  }

  const ragData = [
    { name: 'Green', value: data.ragDistribution.green, key: 'green' },
    { name: 'Amber', value: data.ragDistribution.amber, key: 'amber' },
    { name: 'Red', value: data.ragDistribution.red, key: 'red' },
  ].filter((d) => d.value > 0)

  const scatterData = data.projects
    .filter((p) => p.spi != null && p.cpi != null)
    .map((p) => ({ x: p.spi as number, y: p.cpi as number, z: p.budget, name: p.name, projectId: p.projectId }))

  const budgetData = data.projects.map((p) => ({
    name: p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name,
    Budget: p.budget,
    Spent: p.spent,
  }))

  const spentPct = data.totalBudget > 0 ? (data.totalSpent / data.totalBudget) * 100 : 0

  return (
    <div className="space-y-5">
      {/* Summary tiles */}
      <div className="flex gap-3 flex-wrap">
        <MetricCard title="Active Projects" value={data.projects.length} />
        <MetricCard
          title="Portfolio Spent"
          value={`${spentPct.toFixed(0)}%`}
          subtitle={formatCurrency(data.totalSpent)}
          valueColor={spentPct > 80 ? 'red' : spentPct > 60 ? 'amber' : 'default'}
        />
        <MetricCard
          title="Avg SPI"
          value={data.avgSpi != null ? data.avgSpi.toFixed(2) : '—'}
          subtitle="schedule"
          valueColor={data.avgSpi == null ? 'default' : data.avgSpi < 0.85 ? 'red' : data.avgSpi < 0.95 ? 'amber' : 'green'}
        />
        <MetricCard
          title="Avg CPI"
          value={data.avgCpi != null ? data.avgCpi.toFixed(2) : '—'}
          subtitle="cost"
          valueColor={data.avgCpi == null ? 'default' : data.avgCpi < 0.85 ? 'red' : data.avgCpi < 0.95 ? 'amber' : 'green'}
        />
        <MetricCard title="At Risk" value={data.ragDistribution.red + data.ragDistribution.amber} subtitle="amber + red" valueColor={data.ragDistribution.red > 0 ? 'red' : 'amber'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* RAG distribution */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Health (RAG) Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={ragData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {ragData.map((d) => <Cell key={d.key} fill={RAG_COLORS[d.key]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* SPI x CPI scatter */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Schedule (SPI) × Cost (CPI) Performance</CardTitle></CardHeader>
          <CardContent>
            {scatterData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-16 text-center">No baselined projects yet (lock a baseline to compute SPI/CPI).</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ top: 10, right: 16, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" dataKey="x" name="SPI" domain={[0, 'dataMax + 0.2']} tick={{ fontSize: 10 }} label={{ value: 'SPI', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" name="CPI" domain={[0, 'dataMax + 0.2']} tick={{ fontSize: 10 }} label={{ value: 'CPI', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <ZAxis type="number" dataKey="z" range={[60, 400]} name="Budget" />
                  <ReferenceLine x={1} stroke="#94a3b8" strokeDasharray="4 4" />
                  <ReferenceLine y={1} stroke="#94a3b8" strokeDasharray="4 4" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: number) => v.toFixed(2)} labelFormatter={() => ''} />
                  <Scatter data={scatterData} fill="#6366f1" onClick={(d) => d?.projectId && navigate(`/projects/${d.projectId}`)} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget vs Spent */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Budget vs Spent</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(160, budgetData.length * 36)}>
            <BarChart data={budgetData} layout="vertical" margin={{ top: 5, right: 16, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Budget" fill="#cbd5e1" />
              <Bar dataKey="Spent" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
