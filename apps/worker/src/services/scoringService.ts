import type { D1Database } from '@cloudflare/workers-types'

export interface DriverWeight {
  id: string
  name: string
  weight: number        // raw weight
  normWeight: number    // normalized so Σ = 1.0 across active drivers
  position: number
}

export interface IdeaScore {
  ideaId: string
  strategicValue: number   // Σ wᵢ·Sᵢ
  costScore: number        // C, 1..5
  riskScore: number        // R, 1..5
  pScore: number           // strategicValue / √(C²+R²)
  isComplete: boolean      // has ≥1 driver score, cost, and risk
}

const NEUTRAL = 3 // mid of 1..5 when a component is missing

/** Active drivers with normalized weights (Σ = 1.0). */
export async function getActiveDrivers(db: D1Database, orgId: string): Promise<DriverWeight[]> {
  const { results } = await db.prepare(
    'SELECT id, name, weight, position FROM strategic_drivers WHERE org_id = ? AND is_active = 1 ORDER BY position ASC',
  ).bind(orgId).all<{ id: string; name: string; weight: number; position: number }>()

  const total = results.reduce((s, d) => s + (d.weight || 0), 0)
  return results.map((d) => ({
    id: d.id,
    name: d.name,
    weight: d.weight,
    normWeight: total > 0 ? d.weight / total : (results.length > 0 ? 1 / results.length : 0),
    position: d.position,
  }))
}

/** Min-max normalize a cost into the 1..5 cost score. */
function normalizeCost(cost: number | null, min: number, max: number): { c: number; known: boolean } {
  if (cost == null) return { c: NEUTRAL, known: false }
  if (max <= min) return { c: NEUTRAL, known: true } // all equal → neutral
  return { c: 1 + 4 * ((cost - min) / (max - min)), known: true }
}

/**
 * Compute P_score for a set of ideas (the candidate pool defines cost min/max).
 * P_score = (Σ wᵢ·Sᵢ) / √(C² + R²)
 */
export async function scoreIdeas(
  db: D1Database,
  orgId: string,
  ideas: { id: string; estimated_cost_eur: number | null; risk_score: number | null }[],
): Promise<{ drivers: DriverWeight[]; scores: Map<string, IdeaScore>; costRange: { min: number; max: number } }> {
  const drivers = await getActiveDrivers(db, orgId)
  const driverIds = drivers.map((d) => d.id)

  // Per-idea driver scores
  const scoreByIdea = new Map<string, Map<string, number>>()
  if (ideas.length > 0 && driverIds.length > 0) {
    const ideaIds = ideas.map((i) => i.id)
    const placeholdersI = ideaIds.map(() => '?').join(',')
    const placeholdersD = driverIds.map(() => '?').join(',')
    const { results } = await db.prepare(
      `SELECT idea_id, driver_id, score FROM idea_driver_scores
       WHERE idea_id IN (${placeholdersI}) AND driver_id IN (${placeholdersD})`,
    ).bind(...ideaIds, ...driverIds).all<{ idea_id: string; driver_id: string; score: number }>()
    for (const r of results) {
      if (!scoreByIdea.has(r.idea_id)) scoreByIdea.set(r.idea_id, new Map())
      scoreByIdea.get(r.idea_id)!.set(r.driver_id, r.score)
    }
  }

  // Cost range across the candidate pool
  const costs = ideas.map((i) => i.estimated_cost_eur).filter((v): v is number => v != null)
  const min = costs.length ? Math.min(...costs) : 0
  const max = costs.length ? Math.max(...costs) : 0

  const scores = new Map<string, IdeaScore>()
  for (const idea of ideas) {
    const dmap = scoreByIdea.get(idea.id) ?? new Map<string, number>()
    let strategicValue = 0
    let hasAnyScore = false
    for (const d of drivers) {
      const s = dmap.get(d.id) ?? 0
      if (s > 0) hasAnyScore = true
      strategicValue += d.normWeight * s
    }

    const { c, known: costKnown } = normalizeCost(idea.estimated_cost_eur, min, max)
    const riskKnown = idea.risk_score != null
    const r = idea.risk_score ?? NEUTRAL

    const denom = Math.sqrt(c * c + r * r) // c,r ≥ 1 → denom ≥ √2 > 0
    const pScore = denom > 0 ? strategicValue / denom : 0

    scores.set(idea.id, {
      ideaId: idea.id,
      strategicValue,
      costScore: c,
      riskScore: r,
      pScore,
      isComplete: hasAnyScore && costKnown && riskKnown,
    })
  }

  return { drivers, scores, costRange: { min, max } }
}
