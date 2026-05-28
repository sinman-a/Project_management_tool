import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTopRisks } from '@/hooks/useRisks'
import type { Risk } from '@/types'

const BAND_DOT: Record<string, string> = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
}

interface Props {
  projectId: string
  onRiskClick?: (risk: Risk) => void
}

export function TopRisksWidget({ projectId, onRiskClick }: Props) {
  const { data: risks = [], isLoading } = useTopRisks(projectId, 3)

  if (isLoading || risks.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Top Risks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {risks.map((risk) => (
          <div
            key={risk.id}
            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors"
            onClick={() => onRiskClick?.(risk)}
          >
            <span
              className={cn('w-2 h-2 rounded-full flex-shrink-0', BAND_DOT[risk.scoreBand])}
              title={risk.scoreBand}
            />
            <span className="font-mono text-xs text-muted-foreground flex-shrink-0 w-10">
              R-{String(risk.riskNumber).padStart(3, '0')}
            </span>
            <span className="flex-1 min-w-0 truncate">{risk.title}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0 font-mono">
              {risk.probability}×{risk.impact}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
