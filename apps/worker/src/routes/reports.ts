import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'

function toCamel(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] = v
  }
  return out
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
    conditions.push('sr.project_id = ?')
    params.push(projectId)
  } else if (programId) {
    conditions.push('sr.program_id = ?')
    params.push(programId)
  }

  if (user.role === 'project_manager' && !projectId && !programId) {
    conditions.push('p.manager_id = ?')
    params.push(user.sub)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const { results } = await c.env.DB.prepare(`
    SELECT sr.*,
      u.name as author_name,
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
  const { id } = c.req.param()
  const row = await c.env.DB.prepare(`
    SELECT sr.*, u.name as author_name, p.name as project_name, pr.name as program_name
    FROM status_reports sr
    LEFT JOIN users u ON u.id = sr.author_id
    LEFT JOIN projects p ON p.id = sr.project_id
    LEFT JOIN programs pr ON pr.id = sr.program_id
    WHERE sr.id = ?
  `).bind(id).first()
  if (!row) return c.json({ message: 'Not found' }, 404)
  return c.json(toCamel(row as Record<string, unknown>))
})

reportRoutes.post('/', requireAny('admin', 'program_manager', 'project_manager'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const data = reportSchema.parse(body)
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

reportRoutes.patch('/:id', requireAny('admin', 'program_manager', 'project_manager'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const existing = await c.env.DB.prepare('SELECT * FROM status_reports WHERE id = ?').bind(id).first() as Record<string, unknown> | null
  if (!existing) return c.json({ message: 'Not found' }, 404)
  if (user.role !== 'admin' && existing['author_id'] !== user.sub) return c.json({ message: 'Forbidden' }, 403)

  const body = await c.req.json()
  const data = reportSchema.partial().parse(body)
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

reportRoutes.delete('/:id', requireAny('admin', 'program_manager', 'project_manager'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const existing = await c.env.DB.prepare('SELECT * FROM status_reports WHERE id = ?').bind(id).first() as Record<string, unknown> | null
  if (!existing) return c.json({ message: 'Not found' }, 404)
  if (user.role !== 'admin' && existing['author_id'] !== user.sub) return c.json({ message: 'Forbidden' }, 403)
  await c.env.DB.prepare('DELETE FROM status_reports WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})
