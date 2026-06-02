import { Hono } from 'hono'
import type { HonoContext } from '../types'
import { buildXlsx, xlsxResponse } from '../services/xlsxService'

export const exportRoutes = new Hono<HonoContext>()

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}

// GET /projects/:id/export/risks
exportRoutes.get('/projects/:id/export/risks', async (c) => {
  const projectId = c.req.param('id')
  const { results } = await c.env.DB.prepare(`
    SELECT r.risk_number, r.title, r.category, r.probability, r.impact, r.score,
           r.score_band, r.status, u.full_name as owner, r.response_strategy,
           r.date_identified, r.next_review_date, r.mitigation_actions
    FROM risks r
    LEFT JOIN users u ON u.id = r.owner_id
    WHERE r.project_id = ? AND r.deleted_at IS NULL
    ORDER BY r.score DESC
  `).bind(projectId).all()

  const rows = results.map((r) => {
    const c = toCamel(r)
    return {
      'Risk #': c.riskNumber,
      Title: c.title,
      Category: c.category,
      Probability: c.probability,
      Impact: c.impact,
      Score: c.score,
      Band: c.scoreBand,
      Status: c.status,
      Owner: c.owner ?? '',
      Strategy: c.responseStrategy ?? '',
      'Date Identified': c.dateIdentified,
      'Next Review': c.nextReviewDate ?? '',
      'Mitigation Actions': c.mitigationActions ?? '',
    }
  })

  const metadata = [{ 'Export Date': new Date().toISOString().slice(0, 10), 'Project ID': projectId, Entity: 'Risk Register' }]
  const buffer = buildXlsx([
    { name: 'Risks', rows },
    { name: 'Metadata', rows: metadata },
  ])

  return xlsxResponse(buffer, `risks-${projectId.slice(0, 8)}.xlsx`)
})

// GET /projects/:id/export/wbs
exportRoutes.get('/projects/:id/export/wbs', async (c) => {
  const projectId = c.req.param('id')
  const { results } = await c.env.DB.prepare(`
    SELECT t.wbs_code, t.name, t.type, t.status, t.priority,
           t.estimated_hours, t.start_date, t.due_date,
           u.full_name as assignee
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.project_id = ?
    ORDER BY t.wbs_code ASC, t.created_at ASC
  `).bind(projectId).all()

  const rows = results.map((r) => {
    const c = toCamel(r)
    return {
      WBS: c.wbsCode ?? '',
      Name: c.name,
      Type: c.type,
      Status: c.status,
      Priority: c.priority,
      'Est. Hours': c.estimatedHours,
      'Start Date': c.startDate ?? '',
      'Due Date': c.dueDate ?? '',
      Assignee: c.assignee ?? '',
    }
  })

  const buffer = buildXlsx([
    { name: 'WBS', rows },
    { name: 'Metadata', rows: [{ 'Export Date': new Date().toISOString().slice(0, 10), 'Project ID': projectId }] },
  ])

  return xlsxResponse(buffer, `wbs-${projectId.slice(0, 8)}.xlsx`)
})

// GET /projects/:id/export/time-logs?status=approved|pending|all
exportRoutes.get('/projects/:id/export/time-logs', async (c) => {
  const projectId = c.req.param('id')
  const status = c.req.query('status') ?? 'all'

  let approvedFilter = ''
  if (status === 'approved') approvedFilter = 'AND tl.approved_at IS NOT NULL'
  else if (status === 'pending') approvedFilter = 'AND tl.approved_at IS NULL'

  const { results } = await c.env.DB.prepare(`
    SELECT tl.log_date, t.name as task_name, r.name as resource_name,
           tl.hours, tl.cost_type, tl.unit_rate, tl.computed_cost,
           tl.is_billable, tl.approved_at, tl.description
    FROM time_logs tl
    JOIN tasks t ON t.id = tl.task_id
    JOIN resources r ON r.id = tl.resource_id
    WHERE t.project_id = ? ${approvedFilter}
    ORDER BY tl.log_date DESC
  `).bind(projectId).all()

  const rows = results.map((r) => {
    const c = toCamel(r)
    return {
      Date: c.logDate,
      Task: c.taskName,
      Resource: c.resourceName,
      Hours: c.hours,
      'Cost Type': c.costType,
      Rate: c.unitRate,
      Cost: c.computedCost,
      Billable: c.isBillable ? 'Yes' : 'No',
      Approved: c.approvedAt ? 'Yes' : 'No',
      Description: c.description ?? '',
    }
  })

  const buffer = buildXlsx([
    { name: 'Time Logs', rows },
    { name: 'Metadata', rows: [{ 'Export Date': new Date().toISOString().slice(0, 10), Filter: status }] },
  ])

  return xlsxResponse(buffer, `time-logs-${projectId.slice(0, 8)}.xlsx`)
})

// GET /projects/:id/export/rice
exportRoutes.get('/projects/:id/export/rice', async (c) => {
  const projectId = c.req.param('id')
  const { results } = await c.env.DB.prepare(`
    SELECT ri.milestone, ri.goal, ri.business_value, ri.user_story,
           ri.reach, ri.impact, ri.confidence, ri.effort, ri.rice_score,
           u.full_name as created_by_name
    FROM rice_items ri
    LEFT JOIN users u ON u.id = ri.created_by
    WHERE ri.project_id = ?
    ORDER BY ri.rice_score DESC
  `).bind(projectId).all()

  const rows = results.map((r) => {
    const c = toCamel(r)
    return {
      Milestone: c.milestone ?? '',
      Goal: c.goal ?? '',
      'Business Value': c.businessValue ?? '',
      'User Story': c.userStory ?? '',
      Reach: c.reach,
      Impact: c.impact,
      Confidence: c.confidence,
      Effort: c.effort,
      'RICE Score': c.riceScore,
      'Created By': c.createdByName ?? '',
    }
  })

  const buffer = buildXlsx([
    { name: 'RICE', rows },
    { name: 'Metadata', rows: [{ 'Export Date': new Date().toISOString().slice(0, 10) }] },
  ])

  return xlsxResponse(buffer, `rice-${projectId.slice(0, 8)}.xlsx`)
})

// GET /programs/:id/export/status-reports
exportRoutes.get('/programs/:id/export/status-reports', async (c) => {
  const programId = c.req.param('id')
  const { results } = await c.env.DB.prepare(`
    SELECT sr.report_date, p.name as project_name, u.full_name as author,
           sr.overall_status, sr.schedule_status, sr.budget_status, sr.scope_status,
           sr.narrative_this_period, sr.narrative_next_period, sr.period_start, sr.period_end
    FROM status_reports sr
    LEFT JOIN projects p ON p.id = sr.project_id
    LEFT JOIN users u ON u.id = sr.author_id
    WHERE sr.program_id = ? AND sr.is_draft = 0
    ORDER BY sr.report_date DESC
  `).bind(programId).all()

  const rows = results.map((r) => {
    const c = toCamel(r)
    return {
      Date: c.reportDate,
      Project: c.projectName ?? '',
      Author: c.author ?? '',
      Overall: c.overallStatus,
      Schedule: c.scheduleStatus,
      Budget: c.budgetStatus,
      Scope: c.scopeStatus,
      'Period Start': c.periodStart,
      'Period End': c.periodEnd,
      'This Period': c.narrativeThisPeriod ?? '',
      'Next Period': c.narrativeNextPeriod ?? '',
    }
  })

  const buffer = buildXlsx([
    { name: 'Status Reports', rows },
    { name: 'Metadata', rows: [{ 'Export Date': new Date().toISOString().slice(0, 10), 'Program ID': programId }] },
  ])

  return xlsxResponse(buffer, `status-reports-${programId.slice(0, 8)}.xlsx`)
})
