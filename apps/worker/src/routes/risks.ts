import { Hono } from 'hono'
import { z } from 'zod'
import type { D1Database } from '@cloudflare/workers-types'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'
import { projectInOrg, canAccessProject, canAccessProgram } from '../middleware/ownership'

/** Verify a risk belongs to the caller's org (risk → project → org). */
async function riskInOrg(db: D1Database, riskId: string, orgId: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT 1 FROM risks r
    JOIN projects p ON p.id = r.project_id
    WHERE r.id = ? AND p.org_id = ?
  `).bind(riskId, orgId).first()
  return !!row
}

const riskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().nullish(),
  category: z.string().min(1).max(50).default('Technical'),
  probability: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  ownerId: z.string().uuid().nullish(),
  status: z.enum(['identified', 'analyzing', 'mitigating', 'closed', 'accepted', 'occurred']).default('identified'),
  responseStrategy: z.enum(['avoid', 'transfer', 'mitigate', 'accept']).nullish(),
  mitigationActions: z.string().nullish(),
  contingencyPlan: z.string().nullish(),
  triggerIndicators: z.string().nullish(),
  dateIdentified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateLastReviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  nextReviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
})

function scoreBand(score: number): string {
  if (score <= 6) return 'low'
  if (score <= 14) return 'medium'
  if (score <= 20) return 'high'
  return 'critical'
}

export const riskRoutes = new Hono<HonoContext>()

// Static routes BEFORE /:id to avoid conflicts
riskRoutes.get('/heatmap', async (c) => {
  const user = c.get('user')
  const projectId = c.req.query('projectId')
  const programId = c.req.query('programId')

  if (programId && !(await canAccessProgram(c.env.DB, user, programId))) return c.json({ message: 'Not found' }, 404)
  if (projectId && !(await canAccessProject(c.env.DB, user, projectId))) return c.json({ message: 'Not found' }, 404)

  let query: string
  let params: string[]

  if (programId) {
    query = `SELECT probability, impact, COUNT(*) as count
             FROM risks
             WHERE project_id IN (SELECT id FROM projects WHERE program_id = ?)
               AND deleted_at IS NULL AND status NOT IN ('closed','accepted')
             GROUP BY probability, impact`
    params = [programId]
  } else if (projectId) {
    query = `SELECT probability, impact, COUNT(*) as count
             FROM risks
             WHERE project_id = ? AND deleted_at IS NULL AND status NOT IN ('closed','accepted')
             GROUP BY probability, impact`
    params = [projectId]
  } else {
    return c.json({ message: 'projectId or programId required' }, 400)
  }

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ cells: results.map(toCamel) })
})

riskRoutes.get('/top', async (c) => {
  const user = c.get('user')
  const projectId = c.req.query('projectId')
  const n = Math.min(parseInt(c.req.query('n') ?? '3', 10), 10)
  if (!projectId) return c.json({ message: 'projectId required' }, 400)
  if (!(await canAccessProject(c.env.DB, user, projectId))) return c.json({ message: 'Not found' }, 404)

  const { results } = await c.env.DB.prepare(`
    SELECT r.*, u.full_name as owner_name
    FROM risks r
    LEFT JOIN users u ON u.id = r.owner_id
    WHERE r.project_id = ? AND r.deleted_at IS NULL
      AND r.status NOT IN ('closed','accepted')
    ORDER BY r.score DESC, r.risk_number ASC
    LIMIT ?
  `).bind(projectId, n).all()
  return c.json(results.map(toCamel))
})

riskRoutes.get('/', async (c) => {
  const user = c.get('user')
  const projectId = c.req.query('projectId')
  const programId = c.req.query('programId')
  const status = c.req.query('status')
  const scoreBandFilter = c.req.query('scoreBand')
  const category = c.req.query('category')

  let where = 'r.deleted_at IS NULL'
  const params: unknown[] = []

  if (projectId) {
    if (!(await canAccessProject(c.env.DB, user, projectId))) return c.json({ message: 'Not found' }, 404)
    where += ' AND r.project_id = ?'
    params.push(projectId)
  } else if (programId) {
    if (!(await canAccessProgram(c.env.DB, user, programId))) return c.json({ message: 'Not found' }, 404)
    where += ' AND r.project_id IN (SELECT id FROM projects WHERE program_id = ?)'
    params.push(programId)
  } else {
    return c.json({ message: 'projectId or programId required' }, 400)
  }

  if (status) { where += ' AND r.status = ?'; params.push(status) }
  if (scoreBandFilter) { where += ' AND r.score_band = ?'; params.push(scoreBandFilter) }
  if (category) { where += ' AND r.category = ?'; params.push(category) }

  const projectCol = programId ? ', p.name as project_name' : ''
  const projectJoin = programId ? 'JOIN projects p ON p.id = r.project_id' : ''

  const { results } = await c.env.DB.prepare(`
    SELECT r.*, u.full_name as owner_name ${projectCol}
    FROM risks r
    LEFT JOIN users u ON u.id = r.owner_id
    ${projectJoin}
    WHERE ${where}
    ORDER BY r.score DESC, r.risk_number ASC
  `).bind(...params).all()

  return c.json(results.map(toCamel))
})

riskRoutes.post('/', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = riskSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const d = parsed.data
  if (!(await projectInOrg(c.env.DB, d.projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)
  const score = d.probability * d.impact
  const band = scoreBand(score)

  // Auto-increment risk_number per project
  const maxRow = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(risk_number), 0) as max_num FROM risks WHERE project_id = ?',
  ).bind(d.projectId).first<{ max_num: number }>()
  const riskNumber = (maxRow?.max_num ?? 0) + 1

  const id = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT INTO risks (id, project_id, risk_number, title, description, category, probability, impact,
      score, score_band, owner_id, status, response_strategy, mitigation_actions, contingency_plan,
      trigger_indicators, date_identified, date_last_reviewed, next_review_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, d.projectId, riskNumber, d.title, d.description ?? null, d.category,
    d.probability, d.impact, score, band, d.ownerId ?? null, d.status,
    d.responseStrategy ?? null, d.mitigationActions ?? null, d.contingencyPlan ?? null,
    d.triggerIndicators ?? null, d.dateIdentified, d.dateLastReviewed ?? null,
    d.nextReviewDate ?? null, user.sub,
  ).run()

  // Audit log
  await c.env.DB.prepare(
    `INSERT INTO risk_audit_log (id, risk_id, changed_by, field_name, old_value, new_value)
     VALUES (?, ?, ?, 'status', NULL, ?)`,
  ).bind(crypto.randomUUID(), id, user.sub, d.status).run()

  const risk = await c.env.DB.prepare(
    `SELECT r.*, u.full_name as owner_name FROM risks r LEFT JOIN users u ON u.id = r.owner_id WHERE r.id = ?`,
  ).bind(id).first()
  return c.json(toCamel(risk!), 201)
})

riskRoutes.patch('/:id', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const existing = await c.env.DB.prepare(`
    SELECT r.* FROM risks r
    JOIN projects p ON p.id = r.project_id
    WHERE r.id = ? AND p.org_id = ? AND r.deleted_at IS NULL
  `).bind(id, user.orgId).first<Record<string, unknown>>()
  if (!existing) return c.json({ message: 'Not found' }, 404)

  const body = await c.req.json()
  const patchSchema = riskSchema.partial().omit({ projectId: true })
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const d = parsed.data
  const updates: [string, unknown][] = []
  const fieldMap: Record<string, string> = {
    title: 'title', description: 'description', category: 'category',
    probability: 'probability', impact: 'impact', ownerId: 'owner_id',
    status: 'status', responseStrategy: 'response_strategy',
    mitigationActions: 'mitigation_actions', contingencyPlan: 'contingency_plan',
    triggerIndicators: 'trigger_indicators', dateIdentified: 'date_identified',
    dateLastReviewed: 'date_last_reviewed', nextReviewDate: 'next_review_date',
  }

  const auditLogs: Array<{ field: string; oldVal: unknown; newVal: unknown }> = []

  for (const [camelKey, colName] of Object.entries(fieldMap)) {
    if (camelKey in d && d[camelKey as keyof typeof d] !== undefined) {
      const newVal = d[camelKey as keyof typeof d]
      const oldColVal = existing[colName]
      if (newVal !== oldColVal) {
        updates.push([colName, newVal ?? null])
        auditLogs.push({ field: colName, oldVal: oldColVal, newVal })
      }
    }
  }

  // Recompute score if probability or impact changed
  const newProb = (updates.find(([k]) => k === 'probability')?.[1] as number | undefined) ?? (existing.probability as number)
  const newImpact = (updates.find(([k]) => k === 'impact')?.[1] as number | undefined) ?? (existing.impact as number)
  const newScore = newProb * newImpact
  if (newScore !== (existing.score as number)) {
    updates.push(['score', newScore], ['score_band', scoreBand(newScore)])
    auditLogs.push({ field: 'score', oldVal: existing.score, newVal: newScore })
  }

  if (updates.length === 0) return c.json(toCamel(existing))

  updates.push(['updated_at', new Date().toISOString()])
  const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE risks SET ${setClauses} WHERE id = ?`)
    .bind(...updates.map(([, v]) => v), id).run()

  // Batch audit logs
  for (const log of auditLogs) {
    await c.env.DB.prepare(
      `INSERT INTO risk_audit_log (id, risk_id, changed_by, field_name, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), id, user.sub, log.field, String(log.oldVal ?? ''), String(log.newVal ?? '')).run()
  }

  const updated = await c.env.DB.prepare(
    `SELECT r.*, u.full_name as owner_name FROM risks r LEFT JOIN users u ON u.id = r.owner_id WHERE r.id = ?`,
  ).bind(id).first()
  return c.json(toCamel(updated!))
})

riskRoutes.delete('/:id', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  if (!(await riskInOrg(c.env.DB, id, user.orgId))) return c.json({ message: 'Not found' }, 404)
  await c.env.DB.prepare(
    `UPDATE risks SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).bind(id).run()
  return c.json({ success: true })
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}
