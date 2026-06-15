import type { ProjectWithBudget } from '@/hooks/useBudget'
import type { RagStatus } from '@/types'

/** Budget/EAC-based RAG for a project (shared by HealthBar + PortfolioTable). */
export function computeRag(p: ProjectWithBudget): RagStatus {
  const budget = (p.budgetCapex ?? 0) + (p.budgetOpex ?? 0)
  if (budget <= 0) return 'green'
  const eac = (p.eacCapex ?? 0) + (p.eacOpex ?? 0)
  const used = (p.spentCapex ?? 0) + (p.spentOpex ?? 0) + (p.committedCapex ?? 0) + (p.committedOpex ?? 0)
  const usedPct = used / budget
  if (eac > budget || usedPct >= 1) return 'red'
  if (usedPct >= 0.8) return 'amber'
  return 'green'
}

/** Proxy CPI = budget / (spent+committed). Null when there's no spend yet. */
export function projectCpi(p: ProjectWithBudget): number | null {
  const budget = (p.budgetCapex ?? 0) + (p.budgetOpex ?? 0)
  const used = (p.spentCapex ?? 0) + (p.spentOpex ?? 0) + (p.committedCapex ?? 0) + (p.committedOpex ?? 0)
  if (used <= 0 || budget <= 0) return null
  return budget / used
}
