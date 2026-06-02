import { computeEVM } from './evmService'

export interface RAGSuggestion {
  rags: {
    overall: 'green' | 'amber' | 'red'
    schedule: 'green' | 'amber' | 'red'
    budget: 'green' | 'amber' | 'red'
    scope: 'green' | 'amber' | 'red'
  }
  reasoning: {
    overall: string
    schedule: string
    budget: string
    scope: string
  }
  ruleVersion: string
}

const RULE_VERSION = 'v1.0'

function evmBandToRag(spiOrCpi: number, amberThresh: number, redThresh: number, label: string): {
  rag: 'green' | 'amber' | 'red'; reason: string
} {
  const dev = Math.abs(spiOrCpi - 1)
  if (dev >= redThresh) return { rag: 'red', reason: `${label} = ${spiOrCpi.toFixed(2)} (red band, deviation ≥ ${(redThresh * 100).toFixed(0)}%)` }
  if (dev >= amberThresh) return { rag: 'amber', reason: `${label} = ${spiOrCpi.toFixed(2)} (amber band, deviation ≥ ${(amberThresh * 100).toFixed(0)}%)` }
  return { rag: 'green', reason: `${label} = ${spiOrCpi.toFixed(2)} (within threshold)` }
}

const RAG_ORDER: Record<string, number> = { green: 0, amber: 1, red: 2 }

function worstRag(...rags: ('green' | 'amber' | 'red')[]): 'green' | 'amber' | 'red' {
  return rags.reduce((worst, r) => RAG_ORDER[r] > RAG_ORDER[worst] ? r : worst, 'green' as const)
}

export async function suggestRAGs(db: D1Database, projectId: string): Promise<RAGSuggestion> {
  const evm = await computeEVM(db, projectId)

  let scheduleRag: 'green' | 'amber' | 'red' = 'green'
  let scheduleReason = 'No active baseline — insufficient data'
  let budgetRag: 'green' | 'amber' | 'red' = 'green'
  let budgetReason = 'No active baseline — insufficient data'

  if (evm.hasBaseline) {
    const scheduleResult = evmBandToRag(evm.spi, 0.05, 0.15, 'SPI')
    scheduleRag = scheduleResult.rag
    scheduleReason = scheduleResult.reason

    const budgetResult = evmBandToRag(evm.cpi, 0.05, 0.15, 'CPI')
    budgetRag = budgetResult.rag
    budgetReason = budgetResult.reason
  }

  const scopeRag: 'green' = 'green'
  const scopeReason = 'Scope: no scope-change tracking; PM input required'

  // Overall = worst of three + cap by critical open risk (same logic as existing RAG cap)
  let overallRag = worstRag(scheduleRag, budgetRag, scopeRag)
  let overallReason = `Worst of Schedule (${scheduleRag}), Budget (${budgetRag}), Scope (${scopeRag})`

  const criticalRisk = await db.prepare(`
    SELECT id FROM risks
    WHERE project_id = ? AND score_band = 'critical'
      AND status NOT IN ('closed','accepted') AND deleted_at IS NULL
    LIMIT 1
  `).bind(projectId).first()

  if (criticalRisk && overallRag === 'green') {
    overallRag = 'amber'
    overallReason += ' (capped to amber — critical open risk exists)'
  }

  return {
    rags: { overall: overallRag, schedule: scheduleRag, budget: budgetRag, scope: scopeRag },
    reasoning: { overall: overallReason, schedule: scheduleReason, budget: budgetReason, scope: scopeReason },
    ruleVersion: RULE_VERSION,
  }
}
