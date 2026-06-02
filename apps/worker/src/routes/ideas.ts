import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'
import { programInOrg } from '../middleware/ownership'
import { createNotification } from '../services/notificationService'

const ideaSchema = z.object({
  title: z.string().min(1).max(300),
  problemStatement: z.string().min(1).max(5000),
  proposedSolution: z.string().max(5000).nullish(),
  expectedValueEur: z.number().min(0).nullish(),
  estimatedCostEur: z.number().min(0).nullish(),
  estimatedEffortWeeks: z.number().min(0).nullish(),
  reach: z.number().int().min(1).max(9).nullish(),
  impact: z.number().int().min(1).max(9).nullish(),
  confidence: z.number().min(0.1).max(1.0).nullish(),
  effort: z.number().int().min(1).max(10).nullish(),
  themeIds: z.array(z.string().uuid()).optional(),
})

export const ideaRoutes = new Hono<HonoContext>()

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}

// Static route before /:id
ideaRoutes.get('/balance-report', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(`
    SELECT st.name as theme_name, st.colour, SUM(i.estimated_cost_eur) as total_cost, COUNT(i.id) as idea_count
    FROM strategic_themes st
    JOIN idea_themes it ON it.theme_id = st.id
    JOIN ideas i ON i.id = it.idea_id
    WHERE st.org_id = ? AND i.archived_at IS NULL
      AND i.status IN ('approved', 'converted_to_project')
    GROUP BY st.id, st.name, st.colour
    ORDER BY total_cost DESC
  `).bind(user.orgId).all()
  return c.json(results.map(toCamel))
})

ideaRoutes.get('/', async (c) => {
  const user = c.get('user')
  const status = c.req.query('status')
  const themeId = c.req.query('theme')
  const sort = c.req.query('sort') ?? 'rice_desc'

  let where = 'i.org_id = ? AND i.archived_at IS NULL'
  const params: unknown[] = [user.orgId]

  if (status) { where += ' AND i.status = ?'; params.push(status) }
  if (themeId) { where += ' AND EXISTS (SELECT 1 FROM idea_themes it2 WHERE it2.idea_id = i.id AND it2.theme_id = ?)'; params.push(themeId) }

  const orderBy = sort === 'rice_desc' ? 'i.rice_score DESC, i.created_at DESC'
    : sort === 'newest' ? 'i.created_at DESC'
    : 'i.rice_score DESC'

  const { results } = await c.env.DB.prepare(`
    SELECT i.*, u.full_name as submitter_name
    FROM ideas i
    LEFT JOIN users u ON u.id = i.submitter_id
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT 200
  `).bind(...params).all()

  return c.json(results.map(toCamel))
})

ideaRoutes.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = ideaSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const d = parsed.data
  const id = crypto.randomUUID()

  await c.env.DB.prepare(`
    INSERT INTO ideas (id, org_id, title, problem_statement, proposed_solution,
      expected_value_eur, estimated_cost_eur, estimated_effort_weeks,
      reach, impact, confidence, effort, submitter_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `).bind(
    id, user.orgId, d.title, d.problemStatement, d.proposedSolution ?? null,
    d.expectedValueEur ?? null, d.estimatedCostEur ?? null, d.estimatedEffortWeeks ?? null,
    d.reach ?? null, d.impact ?? null, d.confidence ?? null, d.effort ?? null, user.sub,
  ).run()

  if (d.themeIds?.length) {
    for (const themeId of d.themeIds) {
      await c.env.DB.prepare('INSERT OR IGNORE INTO idea_themes (idea_id, theme_id) VALUES (?, ?)')
        .bind(id, themeId).run()
    }
  }

  const idea = await c.env.DB.prepare('SELECT * FROM ideas WHERE id = ?').bind(id).first()
  return c.json(toCamel(idea!), 201)
})

ideaRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const idea = await c.env.DB.prepare(`
    SELECT i.*, u.full_name as submitter_name, d.full_name as decided_by_name
    FROM ideas i
    LEFT JOIN users u ON u.id = i.submitter_id
    LEFT JOIN users d ON d.id = i.decided_by
    WHERE i.id = ? AND i.org_id = ? AND i.archived_at IS NULL
  `).bind(id, user.orgId).first()

  if (!idea) return c.json({ message: 'Not found' }, 404)

  const { results: themes } = await c.env.DB.prepare(`
    SELECT st.* FROM strategic_themes st
    JOIN idea_themes it ON it.theme_id = st.id
    WHERE it.idea_id = ?
  `).bind(id).all()

  const { results: approvals } = await c.env.DB.prepare(`
    SELECT ia.*, u.full_name as approver_name FROM idea_approvals ia
    JOIN users u ON u.id = ia.approver_id
    WHERE ia.idea_id = ? ORDER BY ia.decided_at DESC
  `).bind(id).all()

  return c.json({ ...toCamel(idea as Record<string, unknown>), themes: themes.map(toCamel), approvals: approvals.map(toCamel) })
})

ideaRoutes.patch('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const idea = await c.env.DB.prepare('SELECT submitter_id, status FROM ideas WHERE id = ? AND org_id = ? AND archived_at IS NULL')
    .bind(id, user.orgId).first<{ submitter_id: string; status: string }>()
  if (!idea) return c.json({ message: 'Not found' }, 404)

  const frozenStatuses = ['converted_to_project']
  if (frozenStatuses.includes(idea.status)) return c.json({ message: 'Idea is frozen' }, 400)

  // Only submitter (while draft/submitted) or PM+/admin can edit
  const canEdit = user.role === 'admin' || ['program_manager', 'pmo_lead', 'project_manager'].includes(user.role) || idea.submitter_id === user.sub
  if (!canEdit) return c.json({ message: 'Forbidden' }, 403)

  const body = await c.req.json()
  const parsed = ideaSchema.partial().safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  const d = parsed.data
  const updates: [string, unknown][] = []
  const fieldMap: Record<string, string> = {
    title: 'title', problemStatement: 'problem_statement', proposedSolution: 'proposed_solution',
    expectedValueEur: 'expected_value_eur', estimatedCostEur: 'estimated_cost_eur',
    estimatedEffortWeeks: 'estimated_effort_weeks',
    reach: 'reach', impact: 'impact', confidence: 'confidence', effort: 'effort',
  }

  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (camel in d) updates.push([snake, d[camel as keyof typeof d] ?? null])
  }

  updates.push(['updated_at', new Date().toISOString()])

  if (updates.length > 0) {
    const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
    await c.env.DB.prepare(`UPDATE ideas SET ${setClauses} WHERE id = ?`)
      .bind(...updates.map(([, v]) => v), id).run()
  }

  if (d.themeIds !== undefined) {
    await c.env.DB.prepare('DELETE FROM idea_themes WHERE idea_id = ?').bind(id).run()
    for (const themeId of d.themeIds ?? []) {
      await c.env.DB.prepare('INSERT OR IGNORE INTO idea_themes (idea_id, theme_id) VALUES (?, ?)').bind(id, themeId).run()
    }
  }

  const updated = await c.env.DB.prepare('SELECT * FROM ideas WHERE id = ?').bind(id).first()
  return c.json(toCamel(updated!))
})

// Archive
ideaRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const idea = await c.env.DB.prepare('SELECT submitter_id FROM ideas WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId).first<{ submitter_id: string }>()
  if (!idea) return c.json({ message: 'Not found' }, 404)
  if (user.role !== 'admin' && idea.submitter_id !== user.sub) return c.json({ message: 'Forbidden' }, 403)

  await c.env.DB.prepare('UPDATE ideas SET archived_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// POST /:id/transition
ideaRoutes.post('/:id/transition', requireAny('admin', 'pmo_lead', 'program_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const exists = await c.env.DB.prepare('SELECT 1 FROM ideas WHERE id = ? AND org_id = ? AND archived_at IS NULL')
    .bind(id, user.orgId).first()
  if (!exists) return c.json({ message: 'Not found' }, 404)
  const body = await c.req.json()
  const parsed = z.object({
    toStatus: z.enum(['draft', 'submitted', 'under_review', 'approved', 'rejected', 'on_hold']),
    notes: z.string().max(2000).nullish(),
  }).safeParse(body)

  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  await c.env.DB.prepare('UPDATE ideas SET status = ?, decision_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(parsed.data.toStatus, parsed.data.notes ?? null, id).run()

  const updated = await c.env.DB.prepare('SELECT * FROM ideas WHERE id = ?').bind(id).first()
  return c.json(toCamel(updated!))
})

// POST /:id/approve
ideaRoutes.post('/:id/approve', requireAny('admin', 'pmo_lead', 'program_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const exists = await c.env.DB.prepare('SELECT 1 FROM ideas WHERE id = ? AND org_id = ? AND archived_at IS NULL')
    .bind(id, user.orgId).first()
  if (!exists) return c.json({ message: 'Not found' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const comments = (body as { comments?: string }).comments ?? null

  await c.env.DB.prepare(`
    INSERT INTO idea_approvals (id, idea_id, approver_id, decision, comments)
    VALUES (?, ?, ?, 'approve', ?)
  `).bind(crypto.randomUUID(), id, user.sub, comments).run()

  await c.env.DB.prepare(`
    UPDATE ideas SET status = 'approved', decided_by = ?, decided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(user.sub, id).run()

  // Notify submitter
  const idea = await c.env.DB.prepare('SELECT submitter_id, title, org_id FROM ideas WHERE id = ?')
    .bind(id).first<{ submitter_id: string; title: string; org_id: string }>()
  if (idea) {
    await createNotification(c.env.DB, {
      orgId: idea.org_id,
      recipientId: idea.submitter_id,
      type: 'idea_decided',
      entityType: 'idea',
      entityId: id,
      actorId: user.sub,
      payload: { decision: 'approve', title: idea.title },
    })
  }

  const updated = await c.env.DB.prepare('SELECT * FROM ideas WHERE id = ?').bind(id).first()
  return c.json(toCamel(updated!))
})

// POST /:id/reject
ideaRoutes.post('/:id/reject', requireAny('admin', 'pmo_lead', 'program_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const exists = await c.env.DB.prepare('SELECT 1 FROM ideas WHERE id = ? AND org_id = ? AND archived_at IS NULL')
    .bind(id, user.orgId).first()
  if (!exists) return c.json({ message: 'Not found' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const notes = (body as { notes?: string }).notes ?? null

  await c.env.DB.prepare(`
    INSERT INTO idea_approvals (id, idea_id, approver_id, decision, comments)
    VALUES (?, ?, ?, 'reject', ?)
  `).bind(crypto.randomUUID(), id, user.sub, notes).run()

  await c.env.DB.prepare(`
    UPDATE ideas SET status = 'rejected', decided_by = ?, decided_at = CURRENT_TIMESTAMP, decision_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(user.sub, notes, id).run()

  const idea = await c.env.DB.prepare('SELECT submitter_id, title, org_id FROM ideas WHERE id = ?')
    .bind(id).first<{ submitter_id: string; title: string; org_id: string }>()
  if (idea) {
    await createNotification(c.env.DB, {
      orgId: idea.org_id,
      recipientId: idea.submitter_id,
      type: 'idea_decided',
      entityType: 'idea',
      entityId: id,
      actorId: user.sub,
      payload: { decision: 'reject', title: idea.title },
    })
  }

  const updated = await c.env.DB.prepare('SELECT * FROM ideas WHERE id = ?').bind(id).first()
  return c.json(toCamel(updated!))
})

// POST /:id/convert
ideaRoutes.post('/:id/convert', requireAny('admin', 'pmo_lead', 'program_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const idea = await c.env.DB.prepare('SELECT * FROM ideas WHERE id = ? AND org_id = ? AND status = ? AND archived_at IS NULL')
    .bind(id, user.orgId, 'approved').first<Record<string, unknown>>()
  if (!idea) return c.json({ message: 'Idea not found or not approved' }, 404)

  const body = await c.req.json()
  const parsed = z.object({
    programId: z.string().uuid().nullish(),
    managerId: z.string().uuid().nullish(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    methodology: z.enum(['waterfall', 'agile', 'hybrid']).default('hybrid'),
  }).safeParse(body)

  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  const projectId = crypto.randomUUID()
  const d = parsed.data

  // Validate program belongs to caller's org (if provided)
  if (d.programId && !(await programInOrg(c.env.DB, d.programId, user.orgId))) {
    return c.json({ message: 'Invalid program' }, 400)
  }
  // Validate manager belongs to caller's org (if provided)
  if (d.managerId) {
    const mgr = await c.env.DB.prepare('SELECT 1 FROM users WHERE id = ? AND org_id = ?')
      .bind(d.managerId, user.orgId).first()
    if (!mgr) return c.json({ message: 'Invalid manager' }, 400)
  }

  // Transactional: create project + update idea atomically
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO projects (id, org_id, program_id, name, description, manager_id, methodology, status, start_date, end_date, budget_capex, budget_opex)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'planning', ?, ?, 0, 0)
      `).bind(
        projectId, idea.org_id as string, d.programId ?? null,
        idea.title as string, idea.problem_statement as string,
        d.managerId ?? user.sub, d.methodology, d.startDate, d.endDate ?? null,
      ),
      c.env.DB.prepare(`
        UPDATE ideas SET status = 'converted_to_project', converted_project_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(projectId, id),
    ])
  } catch (e) {
    return c.json({ message: 'Conversion failed', error: (e as Error).message }, 500)
  }

  await createNotification(c.env.DB, {
    orgId: idea.org_id as string,
    recipientId: idea.submitter_id as string,
    type: 'idea_converted',
    entityType: 'project',
    entityId: projectId,
    actorId: user.sub,
    payload: { ideaTitle: idea.title, projectId },
  })

  return c.json({ success: true, projectId })
})

// ============================================================
// Strategic Themes
// ============================================================

export const themeRoutes = new Hono<HonoContext>()

const themeSchema = z.object({
  name: z.string().min(1).max(100),
  colour: z.string().max(20).nullish(),
  isActive: z.boolean().optional(),
})

themeRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM strategic_themes WHERE org_id = ? ORDER BY name ASC',
  ).bind(user.orgId).all()
  return c.json(results.map(toCamel))
})

themeRoutes.post('/', requireAny('admin', 'pmo_lead', 'program_manager'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = themeSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO strategic_themes (id, org_id, name, colour) VALUES (?, ?, ?, ?)')
    .bind(id, user.orgId, parsed.data.name, parsed.data.colour ?? null).run()

  const theme = await c.env.DB.prepare('SELECT * FROM strategic_themes WHERE id = ?').bind(id).first()
  return c.json(toCamel(theme!), 201)
})

themeRoutes.patch('/:id', requireAny('admin', 'pmo_lead', 'program_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const exists = await c.env.DB.prepare('SELECT 1 FROM strategic_themes WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId).first()
  if (!exists) return c.json({ message: 'Not found' }, 404)
  const body = await c.req.json()
  const parsed = themeSchema.partial().safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  const updates: [string, unknown][] = []
  if (parsed.data.name !== undefined) updates.push(['name', parsed.data.name])
  if (parsed.data.colour !== undefined) updates.push(['colour', parsed.data.colour ?? null])
  if (parsed.data.isActive !== undefined) updates.push(['is_active', parsed.data.isActive ? 1 : 0])

  if (updates.length === 0) return c.json({ message: 'No fields' }, 400)

  const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE strategic_themes SET ${setClauses} WHERE id = ? AND org_id = ?`)
    .bind(...updates.map(([, v]) => v), id, user.orgId).run()

  const theme = await c.env.DB.prepare('SELECT * FROM strategic_themes WHERE id = ?').bind(id).first()
  return c.json(toCamel(theme!))
})

themeRoutes.delete('/:id', requireAny('admin', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const exists = await c.env.DB.prepare('SELECT 1 FROM strategic_themes WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId).first()
  if (!exists) return c.json({ message: 'Not found' }, 404)
  const inUse = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM idea_themes WHERE theme_id = ?')
    .bind(id).first<{ cnt: number }>()
  if ((inUse?.cnt ?? 0) > 0) return c.json({ message: 'THEME_IN_USE' }, 409)

  await c.env.DB.prepare('DELETE FROM strategic_themes WHERE id = ? AND org_id = ?').bind(id, user.orgId).run()
  return c.json({ success: true })
})
