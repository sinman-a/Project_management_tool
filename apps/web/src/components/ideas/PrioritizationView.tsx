import { useState, useMemo } from 'react'
import { SlidersHorizontal, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useIdeaRanking, useStrategicDrivers } from '@/hooks/useStrategicDrivers'
import { computeScores, normalizeWeights } from '@/lib/pscore'

interface Props {
  onOpenIdea: (id: string) => void
}

export function PrioritizationView({ onOpenIdea }: Props) {
  const { data: ranking, isLoading } = useIdeaRanking()
  const { data: drivers = [] } = useStrategicDrivers()

  const activeDrivers = useMemo(() => drivers.filter((d) => d.isActive), [drivers])
  const savedWeights = useMemo(
    () => Object.fromEntries(activeDrivers.map((d) => [d.id, d.weight])),
    [activeDrivers],
  )

  // What-if: local weight overrides (start = saved). null → using saved.
  const [whatIf, setWhatIf] = useState<Record<string, number> | null>(null)
  const [showWhatIf, setShowWhatIf] = useState(false)
  const weights = whatIf ?? savedWeights

  // When What-if is active, recompute pScore client-side from raw driver scores.
  const recomputed = useMemo(() => {
    if (!ranking || !whatIf) return null
    const driverInputs = activeDrivers.map((d) => ({ id: d.id, weight: weights[d.id] ?? 0 }))
    const ideaInputs = ranking.ideas.map((i) => ({
      id: i.id,
      estimatedCostEur: i.estimatedCostEur,
      riskScore: i.riskScore,
      driverScores: i.driverScores ?? {},
    }))
    return computeScores(driverInputs, ideaInputs)
  }, [ranking, whatIf, activeDrivers, weights])

  if (isLoading) return <div className="py-12 text-center text-muted-foreground text-sm">Computing P-scores…</div>
  if (!ranking || ranking.ideas.length === 0) {
    return <div className="py-12 text-center text-muted-foreground text-sm border rounded-lg">No candidate ideas to rank.</div>
  }
  if (activeDrivers.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm border rounded-lg">
        No strategic drivers defined. Add them in Settings → Strategic Drivers to compute P-scores.
      </div>
    )
  }

  // Final sorted list (server pScore, or recomputed for What-if).
  const sorted = ranking.ideas
    .map((i) => {
      const rc = recomputed?.get(i.id)
      return {
        ...i,
        pScore: rc ? rc.pScore : i.pScore,
        strategicValue: rc ? rc.strategicValue : i.strategicValue,
        costScore: rc ? rc.costScore : i.costScore,
        riskScore: rc ? rc.riskScore : i.riskScore,
      }
    })
    .sort((a, b) => b.pScore - a.pScore)

  const norm = normalizeWeights(activeDrivers.map((d) => ({ id: d.id, weight: weights[d.id] ?? 0 })))

  return (
    <div className="space-y-4">
      {/* What-if toolbar */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant={showWhatIf ? 'default' : 'outline'} onClick={() => setShowWhatIf((v) => !v)}>
          <SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> What-if weights
        </Button>
        {whatIf && (
          <Button size="sm" variant="ghost" onClick={() => setWhatIf(null)}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset to saved
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{sorted.length} candidates ranked by P-score</span>
      </div>

      {/* What-if sliders */}
      {showWhatIf && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Adjust driver weights to simulate alternative strategies — ranking re-sorts live (not saved).
            </p>
            {activeDrivers.map((d) => (
              <div key={d.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                <span className="text-sm">{d.name}</span>
                <input
                  type="range" min="0" max="10" step="0.5"
                  value={weights[d.id] ?? 0}
                  onChange={(e) => setWhatIf({ ...(whatIf ?? savedWeights), [d.id]: parseFloat(e.target.value) })}
                  className="w-40"
                  aria-label={`Weight for ${d.name}`}
                />
                <span className="text-xs font-mono w-12 text-right tabular-nums">{((norm.get(d.id) ?? 0) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ranked table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-10">#</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Idea</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Σwᵢ·Sᵢ</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">C</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">R</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">P-score</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((i, idx) => (
                <tr
                  key={i.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open idea ${i.title}`}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onOpenIdea(i.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenIdea(i.id) } }}
                >
                  <td className="px-3 py-2 font-bold text-muted-foreground tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    {i.title}
                    {!i.isComplete && <span className="ml-2 text-[10px] text-amber-600">incomplete</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{i.strategicValue.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{i.costScore.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{i.riskScore.toFixed(0)}</td>
                  <td className={cn('px-3 py-2 text-right font-mono font-bold', idx === 0 ? 'text-primary' : '')}>{i.pScore.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{i.status.replace(/_/g, ' ')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
