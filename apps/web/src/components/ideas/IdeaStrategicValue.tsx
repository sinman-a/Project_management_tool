import { useState } from 'react'
import { Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStrategicDrivers, useIdeaRanking, useSetIdeaDriverScores } from '@/hooks/useStrategicDrivers'
import { useUpdateIdea } from '@/hooks/useIdeas'
import { singlePScore, normalizeWeights } from '@/lib/pscore'

interface Props {
  ideaId: string
  estimatedCostEur: number | null
  initialRiskScore: number | null
  initialDriverScores: Record<string, number>
  canEdit: boolean
}

export function IdeaStrategicValue({ ideaId, initialRiskScore, initialDriverScores, canEdit }: Props) {
  const { data: drivers = [] } = useStrategicDrivers()
  const { data: ranking } = useIdeaRanking()
  const setScores = useSetIdeaDriverScores()
  const updateIdea = useUpdateIdea()

  const activeDrivers = drivers.filter((d) => d.isActive)
  const norm = normalizeWeights(activeDrivers.map((d) => ({ id: d.id, weight: d.weight })))

  const [scores, setLocalScores] = useState<Record<string, number>>(initialDriverScores)
  const [risk, setRisk] = useState<number | null>(initialRiskScore)
  const [dirty, setDirty] = useState(false)

  // Pool-normalized cost score (C) for this idea, from the ranking endpoint.
  const rankEntry = ranking?.ideas.find((i) => i.id === ideaId)
  const costScore = rankEntry?.costScore ?? 3

  const { strategicValue, pScore } = singlePScore(
    activeDrivers.map((d) => ({ id: d.id, weight: d.weight })),
    scores,
    costScore,
    risk ?? 3,
  )

  function setScore(driverId: string, val: number) {
    setLocalScores((s) => ({ ...s, [driverId]: val }))
    setDirty(true)
  }

  function handleSave() {
    const payload = activeDrivers.map((d) => ({ driverId: d.id, score: scores[d.id] ?? 0 }))
    setScores.mutate({ ideaId, scores: payload })
    updateIdea.mutate({ id: ideaId, riskScore: risk })
    setDirty(false)
  }

  if (activeDrivers.length === 0) {
    return (
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" /> Strategic Value (P-score)
        </h4>
        <p className="text-sm text-muted-foreground">
          No strategic drivers defined yet. Add them in <span className="font-medium">Settings → Strategic Drivers</span>.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" /> Strategic Value (P-score)
        </h4>
        <span className="text-lg font-mono font-bold text-primary">{pScore.toFixed(2)}</span>
      </div>

      {/* Driver score matrix */}
      <div className="space-y-1.5">
        {activeDrivers.map((d) => {
          const w = norm.get(d.id) ?? 0
          const s = scores[d.id] ?? 0
          return (
            <div key={d.id} className="grid grid-cols-[1fr_auto] gap-2 items-center">
              <div className="min-w-0">
                <span className="text-sm">{d.name}</span>
                <span className="text-xs text-muted-foreground ml-2">w={(w * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="range" min="0" max="10" step="1"
                  value={s}
                  disabled={!canEdit}
                  onChange={(e) => setScore(d.id, parseInt(e.target.value, 10))}
                  className="w-28"
                  aria-label={`Score for ${d.name}`}
                />
                <span className="text-sm font-mono w-6 text-right tabular-nums">{s}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* C and R */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="border rounded p-2">
          <p className="text-xs text-muted-foreground">Cost score (C)</p>
          <p className="text-sm font-medium">{costScore.toFixed(1)} <span className="text-xs text-muted-foreground">/ 5 · auto from cost</span></p>
        </div>
        <div className="border rounded p-2">
          <p className="text-xs text-muted-foreground mb-1">Risk score (R)</p>
          <select
            className="w-full text-sm border rounded px-1.5 py-0.5 bg-background"
            value={risk ?? ''}
            disabled={!canEdit}
            onChange={(e) => { setRisk(e.target.value ? parseInt(e.target.value, 10) : null); setDirty(true) }}
          >
            <option value="">— not set —</option>
            {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Breakdown */}
      <div className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1.5 font-mono">
        Σwᵢ·Sᵢ = {strategicValue.toFixed(2)} · √(C²+R²) = {Math.sqrt(costScore * costScore + (risk ?? 3) * (risk ?? 3)).toFixed(2)} · P = {pScore.toFixed(2)}
      </div>

      {canEdit && (
        <Button size="sm" disabled={!dirty || setScores.isPending || updateIdea.isPending} onClick={handleSave}>
          {setScores.isPending || updateIdea.isPending ? 'Saving…' : 'Save P-score inputs'}
        </Button>
      )}
    </section>
  )
}
