// Frontend mirror of the backend scoring service (apps/worker/src/services/scoringService.ts).
// Used for instant What-if recomputation when driver weights are adjusted client-side.
// P_score = (Σ wᵢ·Sᵢ) / √(C² + R²)

const NEUTRAL = 3 // mid of 1..5 when a component is missing

export interface DriverWeightInput {
  id: string
  weight: number   // raw weight (normalized internally)
}

export interface IdeaScoreInput {
  id: string
  estimatedCostEur: number | null
  riskScore: number | null            // 1..5 or null
  driverScores: Record<string, number> // driverId → 0..10
}

export interface ComputedScore {
  id: string
  strategicValue: number
  costScore: number
  riskScore: number
  pScore: number
  isComplete: boolean
}

export function normalizeWeights(drivers: DriverWeightInput[]): Map<string, number> {
  const total = drivers.reduce((s, d) => s + (d.weight || 0), 0)
  const out = new Map<string, number>()
  for (const d of drivers) {
    out.set(d.id, total > 0 ? d.weight / total : (drivers.length > 0 ? 1 / drivers.length : 0))
  }
  return out
}

function normalizeCost(cost: number | null, min: number, max: number): { c: number; known: boolean } {
  if (cost == null) return { c: NEUTRAL, known: false }
  if (max <= min) return { c: NEUTRAL, known: true }
  return { c: 1 + 4 * ((cost - min) / (max - min)), known: true }
}

/**
 * Compute P_score for a candidate set. The cost min/max is derived from the
 * provided ideas (so What-if over a filtered subset stays consistent).
 */
export function computeScores(
  drivers: DriverWeightInput[],
  ideas: IdeaScoreInput[],
): Map<string, ComputedScore> {
  const norm = normalizeWeights(drivers)
  const costs = ideas.map((i) => i.estimatedCostEur).filter((v): v is number => v != null)
  const min = costs.length ? Math.min(...costs) : 0
  const max = costs.length ? Math.max(...costs) : 0

  const out = new Map<string, ComputedScore>()
  for (const idea of ideas) {
    let strategicValue = 0
    let hasAnyScore = false
    for (const d of drivers) {
      const s = idea.driverScores[d.id] ?? 0
      if (s > 0) hasAnyScore = true
      strategicValue += (norm.get(d.id) ?? 0) * s
    }
    const { c, known: costKnown } = normalizeCost(idea.estimatedCostEur, min, max)
    const riskKnown = idea.riskScore != null
    const r = idea.riskScore ?? NEUTRAL
    const denom = Math.sqrt(c * c + r * r)
    out.set(idea.id, {
      id: idea.id,
      strategicValue,
      costScore: c,
      riskScore: r,
      pScore: denom > 0 ? strategicValue / denom : 0,
      isComplete: hasAnyScore && costKnown && riskKnown,
    })
  }
  return out
}

/** Single-idea P_score given an explicit cost range (for live preview in the drawer). */
export function singlePScore(
  drivers: DriverWeightInput[],
  driverScores: Record<string, number>,
  costScore: number,
  riskScore: number,
): { strategicValue: number; pScore: number } {
  const norm = normalizeWeights(drivers)
  let strategicValue = 0
  for (const d of drivers) strategicValue += (norm.get(d.id) ?? 0) * (driverScores[d.id] ?? 0)
  const denom = Math.sqrt(costScore * costScore + riskScore * riskScore)
  return { strategicValue, pScore: denom > 0 ? strategicValue / denom : 0 }
}
