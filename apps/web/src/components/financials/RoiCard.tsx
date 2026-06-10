import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { useProjectRoi } from '@/hooks/useBudget'

interface Props {
  projectId: string
}

function pct(v: number | null): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(0)}%`
}

export function RoiCard({ projectId }: Props) {
  const { data: roi, isLoading } = useProjectRoi(projectId)
  if (isLoading || !roi) return null

  const roiPositive = (roi.roiPct ?? 0) >= 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card><CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Expected Benefit</p>
        <p className="text-xl font-bold tabular-nums">{formatCurrency(roi.expectedBenefit)}</p>
      </CardContent></Card>

      <Card><CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Budget</p>
        <p className="text-xl font-bold tabular-nums">{formatCurrency(roi.totalBudget)}</p>
      </CardContent></Card>

      <Card><CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">ROI</p>
        <p className={cn('text-xl font-bold tabular-nums flex items-center gap-1', roi.roiPct == null ? '' : roiPositive ? 'text-green-600' : 'text-red-600')}>
          {roi.roiPct != null && (roiPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />)}
          {pct(roi.roiPct)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Net {formatCurrency(roi.netBenefit)}</p>
      </CardContent></Card>

      <Card><CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Projected ROI</p>
        <p className={cn('text-xl font-bold tabular-nums', roi.projectedRoiPct == null ? '' : (roi.projectedRoiPct >= 0 ? 'text-green-600' : 'text-red-600'))}>
          {pct(roi.projectedRoiPct)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">vs EAC {roi.eacTotal > 0 ? formatCurrency(roi.eacTotal) : '—'}</p>
      </CardContent></Card>
    </div>
  )
}
