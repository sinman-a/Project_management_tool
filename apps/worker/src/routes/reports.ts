import { Hono } from 'hono'
import { z } from 'zod'
import type { D1Database } from '@cloudflare/workers-types'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'
import { projectInOrg, programInOrg } from '../middleware/ownership'
import { suggestRAGs } from '../services/suggestionService'

function toCamel(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] = v
  }
  return out
}

/** Fetch a status report only if its project or program belongs to the caller's org. */
async function getReportInOrg(db: D1Database, id: string, orgId: string): Promise<Record<string, unknown> | null> {
  const row = await db.prepare(`
    SELECT sr.* FROM status_reports sr
    LEFT JOIN projects p ON p.id = sr.project_id
    LEFT JOIN programs pr ON pr.id = sr.program_id
    WHERE sr.id = ? AND (p.org_id = ? OR pr.org_id = ?)
  `).bind(id, orgId, orgId).first<Record<string, unknown>>()
  return row ?? null
}

const reportSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  programId: z.string().uuid().optional().nullable(),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  overallStatus: z.enum(['green', 'amber', 'red']),
  scheduleStatus: z.enum(['green', 'amber', 'red']),
  budgetStatus: z.enum(['green', 'amber', 'red']),
  scopeStatus: z.enum(['green', 'amber', 'red']),
  narrativeThisPeriod: z.string().optional().nullable(),
  narrativeNextPeriod: z.string().optional().nullable(),
  risksIssues: z.string().optional().nullable(),
})

export const reportRoutes = new Hono<HonoContext>()

reportRoutes.get('/', async (c) => {
  const user = c.get('user')
  const projectId = c.req.query('projectId')
  const programId = c.req.query('programId')

  const conditions: string[] = []
  const params: string[] = []

  if (projectId) {
    if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)
    conditions.push('sr.project_id = ?')
    params.push(projectId)
  } else if (programId) {
    if (!(await programInOrg(c.env.DB, programId, user.orgId))) return c.json({ message: 'Not found' }, 404)
    conditions.push('sr.program_id = ?')
    params.push(programId)
  }

  // Always constrain results to the caller's org (report's project OR program in org).
  conditions.push('(p.org_id = ? OR pr.org_id = ?)')
  params.push(user.orgId, user.orgId)

  if (user.role === 'project_manager' && !projectId && !programId) {
    conditions.push('p.manager_id = ?')
    params.push(user.sub)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const { results } = await c.env.DB.prepare(`
    SELECT sr.*,
      u.full_name as author_name,
      p.name as project_name,
      pr.name as program_name
    FROM status_reports sr
    LEFT JOIN users u ON u.id = sr.author_id
    LEFT JOIN projects p ON p.id = sr.project_id
    LEFT JOIN programs pr ON pr.id = sr.program_id
    ${where}
    ORDER BY sr.report_date DESC
    LIMIT 100
  `).bind(...params).all()

  return c.json(results.map(toCamel))
})

reportRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const row = await c.env.DB.prepare(`
    SELECT sr.*, u.full_name as author_name, p.name as project_name, pr.name as program_name
    FROM status_reports sr
    LEFT JOIN users u ON u.id = sr.author_id
    LEFT JOIN projects p ON p.id = sr.project_id
    LEFT JOIN programs pr ON pr.id = sr.program_id
    WHERE sr.id = ? AND (p.org_id = ? OR pr.org_id = ?)
  `).bind(id, user.orgId, user.orgId).first()
  if (!row) return c.json({ message: 'Not found' }, 404)
  return c.json(toCamel(row as Record<string, unknown>))
})

reportRoutes.post('/', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = reportSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)
  const data = parsed.data

  if (data.projectId && !(await projectInOrg(c.env.DB, data.projectId, user.orgId))) {
    return c.json({ message: 'Invalid project' }, 400)
  }
  if (data.programId && !(await programInOrg(c.env.DB, data.programId, user.orgId))) {
    return c.json({ message: 'Invalid program' }, 400)
  }
  if (!data.projectId && !data.programId) {
    return c.json({ message: 'projectId or programId required' }, 400)
  }

  const id = crypto.randomUUID()

  await c.env.DB.prepare(`
    INSERT INTO status_reports (
      id, project_id, program_id, author_id, report_date, period_start, period_end,
      overall_status, schedule_status, budget_status, scope_status,
      narrative_this_period, narrative_next_period, risks_issues
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    data.projectId ?? null,
    data.programId ?? null,
    user.sub,
    data.reportDate,
    data.periodStart,
    data.periodEnd,
    data.overallStatus,
    data.scheduleStatus,
    data.budgetStatus,
    data.scopeStatus,
    data.narrativeThisPeriod ?? null,
    data.narrativeNextPeriod ?? null,
    data.risksIssues ?? null,
  ).run()

  const row = await c.env.DB.prepare('SELECT * FROM status_reports WHERE id = ?').bind(id).first()
  return c.json(toCamel(row as Record<string, unknown>), 201)
})

reportRoutes.patch('/:id', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const existing = await getReportInOrg(c.env.DB, id, user.orgId)
  if (!existing) return c.json({ message: 'Not found' }, 404)
  if (user.role !== 'admin' && existing['author_id'] !== user.sub) return c.json({ message: 'Forbidden' }, 403)

  const body = await c.req.json()
  const parsed = reportSchema.partial().safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)
  const data = parsed.data
  const sets: string[] = []
  const params: (string | null)[] = []

  const fieldMap: [keyof typeof data, string][] = [
    ['reportDate', 'report_date'],
    ['periodStart', 'period_start'],
    ['periodEnd', 'period_end'],
    ['overallStatus', 'overall_status'],
    ['scheduleStatus', 'schedule_status'],
    ['budgetStatus', 'budget_status'],
    ['scopeStatus', 'scope_status'],
    ['narrativeThisPeriod', 'narrative_this_period'],
    ['narrativeNextPeriod', 'narrative_next_period'],
    ['risksIssues', 'risks_issues'],
  ]

  for (const [js, sql] of fieldMap) {
    if (data[js] !== undefined) {
      sets.push(`${sql} = ?`)
      params.push((data[js] as string | null) ?? null)
    }
  }

  if (sets.length === 0) return c.json({ message: 'No fields to update' }, 400)

  await c.env.DB.prepare(`UPDATE status_reports SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id).run()
  const row = await c.env.DB.prepare('SELECT * FROM status_reports WHERE id = ?').bind(id).first()
  return c.json(toCamel(row as Record<string, unknown>))
})

reportRoutes.delete('/:id', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const existing = await getReportInOrg(c.env.DB, id, user.orgId)
  if (!existing) return c.json({ message: 'Not found' }, 404)
  if (user.role !== 'admin' && existing['author_id'] !== user.sub) return c.json({ message: 'Forbidden' }, 403)
  await c.env.DB.prepare('DELETE FROM status_reports WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// Publish a draft report
reportRoutes.post('/:id/publish', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await getReportInOrg(c.env.DB, id, user.orgId)
  if (!existing) return c.json({ message: 'Not found' }, 404)
  if (user.role !== 'admin' && existing['author_id'] !== user.sub) return c.json({ message: 'Forbidden' }, 403)

  await c.env.DB.prepare('UPDATE status_reports SET is_draft = 0 WHERE id = ?').bind(id).run()
  const row = await c.env.DB.prepare('SELECT * FROM status_reports WHERE id = ?').bind(id).first()
  return c.json(toCamel(row as Record<string, unknown>))
})

// ==========================================
// Status Report Schedules
// ==========================================

const scheduleSchema = z.object({
  scopeType: z.enum(['project', 'program']),
  scopeId: z.string().uuid(),
  cadence: z.enum(['off', 'weekly', 'biweekly', 'monthly']),
  dayOfWeek: z.number().int().min(0).max(6).default(1),
  enabled: z.boolean().default(true),
})

export const reportScheduleRoutes = new Hono<HonoContext>()

reportScheduleRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM status_report_schedules WHERE org_id = ? ORDER BY scope_type ASC',
  ).bind(user.orgId).all()
  return c.json(results.map(toCamel))
})

reportScheduleRoutes.post('/', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = scheduleSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  const id = crypto.randomUUID()
  const d = parsed.data

  // scope target must belong to caller's org
  const scopeOk = d.scopeType === 'project'
    ? await projectInOrg(c.env.DB, d.scopeId, user.orgId)
    : await programInOrg(c.env.DB, d.scopeId, user.orgId)
  if (!scopeOk) return c.json({ message: 'Invalid scope' }, 400)

  await c.env.DB.prepare(`
    INSERT INTO status_report_schedules (id, org_id, scope_type, scope_id, cadence, day_of_week, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.orgId, d.scopeType, d.scopeId, d.cadence, d.dayOfWeek, d.enabled ? 1 : 0).run()

  const row = await c.env.DB.prepare('SELECT * FROM status_report_schedules WHERE id = ?').bind(id).first()
  return c.json(toCamel(row!), 201)
})

reportScheduleRoutes.patch('/:id', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const exists = await c.env.DB.prepare('SELECT 1 FROM status_report_schedules WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId).first()
  if (!exists) return c.json({ message: 'Not found' }, 404)
  const body = await c.req.json()
  const parsed = scheduleSchema.partial().safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  const d = parsed.data
  const updates: [string, unknown][] = []
  if (d.cadence !== undefined) updates.push(['cadence', d.cadence])
  if (d.dayOfWeek !== undefined) updates.push(['day_of_week', d.dayOfWeek])
  if (d.enabled !== undefined) updates.push(['enabled', d.enabled ? 1 : 0])

  if (updates.length === 0) return c.json({ message: 'No fields' }, 400)

  const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE status_report_schedules SET ${setClauses} WHERE id = ? AND org_id = ?`)
    .bind(...updates.map(([, v]) => v), id, user.orgId).run()

  const row = await c.env.DB.prepare('SELECT * FROM status_report_schedules WHERE id = ?').bind(id).first()
  return c.json(toCamel(row!))
})

// GET /projects/:id/status-reports/suggestion (mounted separately in projects routes)
export async function getStatusReportSuggestion(db: D1Database, projectId: string) {
  return suggestRAGs(db, projectId)
}
