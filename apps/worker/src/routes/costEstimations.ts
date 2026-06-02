import { Hono } from 'hono'
import { z } from 'zod'
import type { D1Database } from '@cloudflare/workers-types'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'
import { projectInOrg } from '../middleware/ownership'

// ─── helpers ────────────────────────────────────────────────────────────────

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}

/** Verify a cost estimation belongs to the caller's org (estimation → project → org). */
async function estimationInOrg(db: D1Database, estimationId: string, orgId: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT 1 FROM cost_estimations ce
    JOIN projects p ON p.id = ce.project_id
    WHERE ce.id = ? AND p.org_id = ?
  `).bind(estimationId, orgId).first()
  return !!row
}

/** Verify a grade belongs to the caller's org (grade → estimation → project → org). */
async function gradeInOrg(db: D1Database, gradeId: string, orgId: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT 1 FROM cost_estimation_grades g
    JOIN cost_estimations ce ON ce.id = g.estimation_id
    JOIN projects p ON p.id = ce.project_id
    WHERE g.id = ? AND p.org_id = ?
  `).bind(gradeId, orgId).first()
  return !!row
}

/** Verify a row belongs to the caller's org (row → estimation → project → org). */
async function rowInOrg(db: D1Database, rowId: string, orgId: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT 1 FROM cost_estimation_rows r
    JOIN cost_estimations ce ON ce.id = r.estimation_id
    JOIN projects p ON p.id = ce.project_id
    WHERE r.id = ? AND p.org_id = ?
  `).bind(rowId, orgId).first()
  return !!row
}

type GradeRow = {
  id: string; estimation_id: string; name: string
  rate_per_day: number; cost_type: string; position: number
}

type CellRow = { row_id: string; grade_id: string; days: number }

function buildSummary(
  grades: GradeRow[],
  rowsWithCells: { id: string; cells: Record<string, number> }[],
) {
  const byGrade: Record<string, { totalDays: number; totalCost: number; costType: string; ratePerDay: number; name: string }> = {}
  for (const g of grades) {
    byGrade[g.id] = { totalDays: 0, totalCost: 0, costType: g.cost_type, ratePerDay: g.rate_per_day, name: g.name }
  }
  for (const row of rowsWithCells) {
    for (const [gradeId, days] of Object.entries(row.cells)) {
      if (byGrade[gradeId] !== undefined && days > 0) {
        byGrade[gradeId].totalDays += days
        byGrade[gradeId].totalCost += days * byGrade[gradeId].ratePerDay
      }
    }
  }
  let totalDays = 0, totalCapex = 0, totalOpex = 0
  for (const entry of Object.values(byGrade)) {
    totalDays += entry.totalDays
    if (entry.costType === 'capex') totalCapex += entry.totalCost
    else totalOpex += entry.totalCost
  }
  return {
    byGrade: Object.entries(byGrade).map(([gradeId, e]) => ({
      gradeId, gradeName: e.name, ratePerDay: e.ratePerDay,
      costType: e.costType, totalDays: e.totalDays, totalCost: e.totalCost,
    })),
    totalDays,
    totalCapex,
    totalOpex,
    grandTotal: totalCapex + totalOpex,
  }
}

// ─── Sub-routes on /projects ─────────────────────────────────────────────────

export const costEstimationSubRoutes = new Hono<HonoContext>()

costEstimationSubRoutes.get('/:id/cost-estimations', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM cost_estimations WHERE project_id = ? ORDER BY created_at ASC',
  ).bind(projectId).all()
  return c.json(results.map(toCamel))
})

costEstimationSubRoutes.post(
  '/:id/cost-estimations',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const user = c.get('user')
    const projectId = c.req.param('id')
    if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)
    const body = await c.req.json().catch(() => ({}))
    const parsed = z.object({
      name: z.string().min(1).max(200).default('Estimation v1'),
      notes: z.string().max(1000).nullish(),
      currency: z.string().length(3).default('USD'),
    }).safeParse(body)
    if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

    const id = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO cost_estimations (id, project_id, name, notes, currency, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(id, projectId, parsed.data.name, parsed.data.notes ?? null, parsed.data.currency, user.sub).run()

    const row = await c.env.DB.prepare('SELECT * FROM cost_estimations WHERE id = ?').bind(id).first()
    return c.json(toCamel(row!), 201)
  },
)

// ─── Main estimation CRUD ────────────────────────────────────────────────────

export const costEstimationRoutes = new Hono<HonoContext>()

costEstimationRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const est = await c.env.DB.prepare(`
    SELECT ce.* FROM cost_estimations ce
    JOIN projects p ON p.id = ce.project_id
    WHERE ce.id = ? AND p.org_id = ?
  `).bind(id, user.orgId).first()
  if (!est) return c.json({ message: 'Not found' }, 404)

  const { results: grades } = await c.env.DB.prepare(
    'SELECT * FROM cost_estimation_grades WHERE estimation_id = ? ORDER BY position ASC',
  ).bind(id).all<GradeRow>()

  const { results: rows } = await c.env.DB.prepare(
    'SELECT * FROM cost_estimation_rows WHERE estimation_id = ? ORDER BY position ASC',
  ).bind(id).all<{ id: string; estimation_id: string; stage: string; work_description: string; position: number }>()

  const { results: cells } = await c.env.DB.prepare(`
    SELECT c.* FROM cost_estimation_cells c
    JOIN cost_estimation_rows r ON r.id = c.row_id
    WHERE r.estimation_id = ?
  `).bind(id).all<CellRow>()

  // Build cell map: rowId → { gradeId: days }
  const cellMap = new Map<string, Record<string, number>>()
  for (const cell of cells) {
    if (!cellMap.has(cell.row_id)) cellMap.set(cell.row_id, {})
    cellMap.get(cell.row_id)![cell.grade_id] = cell.days
  }

  const rowsWithCells = rows.map((r) => ({
    ...toCamel(r as unknown as Record<string, unknown>),
    cells: cellMap.get(r.id) ?? {},
  }))

  const summary = buildSummary(grades, rowsWithCells as { id: string; cells: Record<string, number> }[])

  return c.json({
    ...toCamel(est as Record<string, unknown>),
    grades: grades.map((g) => toCamel(g as unknown as Record<string, unknown>)),
    rows: rowsWithCells,
    summary,
  })
})

costEstimationRoutes.patch(
  '/:id',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    if (!(await estimationInOrg(c.env.DB, id, user.orgId))) return c.json({ message: 'Not found' }, 404)
    const body = await c.req.json()
    const parsed = z.object({
      name: z.string().min(1).max(200).optional(),
      notes: z.string().max(1000).nullish(),
      currency: z.string().length(3).optional(),
    }).safeParse(body)
    if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

    const updates: [string, unknown][] = [['updated_at', new Date().toISOString()]]
    if (parsed.data.name !== undefined) updates.push(['name', parsed.data.name])
    if (parsed.data.notes !== undefined) updates.push(['notes', parsed.data.notes ?? null])
    if (parsed.data.currency !== undefined) updates.push(['currency', parsed.data.currency])

    const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
    await c.env.DB.prepare(`UPDATE cost_estimations SET ${setClauses} WHERE id = ?`)
      .bind(...updates.map(([, v]) => v), id).run()

    const row = await c.env.DB.prepare('SELECT * FROM cost_estimations WHERE id = ?').bind(id).first()
    return c.json(toCamel(row!))
  },
)

costEstimationRoutes.delete(
  '/:id',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    if (!(await estimationInOrg(c.env.DB, id, user.orgId))) return c.json({ message: 'Not found' }, 404)
    await c.env.DB.prepare('DELETE FROM cost_estimations WHERE id = ?').bind(id).run()
    return c.json({ success: true })
  },
)

// ─── Grades (column) CRUD ────────────────────────────────────────────────────

costEstimationRoutes.post(
  '/:id/grades',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const user = c.get('user')
    const estimationId = c.req.param('id')
    if (!(await estimationInOrg(c.env.DB, estimationId, user.orgId))) return c.json({ message: 'Not found' }, 404)
    const body = await c.req.json()
    const parsed = z.object({
      name: z.string().min(1).max(100),
      ratePerDay: z.number().min(0),
      costType: z.enum(['capex', 'opex']).default('capex'),
      position: z.number().int().min(0).optional(),
    }).safeParse(body)
    if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

    // Auto-position if not provided
    let position = parsed.data.position
    if (position === undefined) {
      const maxRow = await c.env.DB.prepare(
        'SELECT COALESCE(MAX(position),0) as m FROM cost_estimation_grades WHERE estimation_id = ?',
      ).bind(estimationId).first<{ m: number }>()
      position = (maxRow?.m ?? 0) + 1
    }

    const id = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO cost_estimation_grades (id, estimation_id, name, rate_per_day, cost_type, position) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(id, estimationId, parsed.data.name, parsed.data.ratePerDay, parsed.data.costType, position).run()

    const row = await c.env.DB.prepare('SELECT * FROM cost_estimation_grades WHERE id = ?').bind(id).first()
    return c.json(toCamel(row!), 201)
  },
)

export const gradeRoutes = new Hono<HonoContext>()

gradeRoutes.patch(
  '/:id',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    if (!(await gradeInOrg(c.env.DB, id, user.orgId))) return c.json({ message: 'Not found' }, 404)
    const body = await c.req.json()
    const parsed = z.object({
      name: z.string().min(1).max(100).optional(),
      ratePerDay: z.number().min(0).optional(),
      costType: z.enum(['capex', 'opex']).optional(),
      position: z.number().int().min(0).optional(),
    }).safeParse(body)
    if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

    const updates: [string, unknown][] = []
    if (parsed.data.name !== undefined) updates.push(['name', parsed.data.name])
    if (parsed.data.ratePerDay !== undefined) updates.push(['rate_per_day', parsed.data.ratePerDay])
    if (parsed.data.costType !== undefined) updates.push(['cost_type', parsed.data.costType])
    if (parsed.data.position !== undefined) updates.push(['position', parsed.data.position])

    if (updates.length === 0) return c.json({ message: 'No fields to update' }, 400)
    const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
    await c.env.DB.prepare(`UPDATE cost_estimation_grades SET ${setClauses} WHERE id = ?`)
      .bind(...updates.map(([, v]) => v), id).run()

    const row = await c.env.DB.prepare('SELECT * FROM cost_estimation_grades WHERE id = ?').bind(id).first()
    return c.json(toCamel(row!))
  },
)

gradeRoutes.delete(
  '/:id',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    if (!(await gradeInOrg(c.env.DB, id, user.orgId))) return c.json({ message: 'Not found' }, 404)
    await c.env.DB.prepare('DELETE FROM cost_estimation_grades WHERE id = ?').bind(id).run()
    return c.json({ success: true })
  },
)

// ─── Rows CRUD ────────────────────────────────────────────────────────────────

costEstimationRoutes.post(
  '/:id/rows',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const user = c.get('user')
    const estimationId = c.req.param('id')
    if (!(await estimationInOrg(c.env.DB, estimationId, user.orgId))) return c.json({ message: 'Not found' }, 404)
    const body = await c.req.json().catch(() => ({}))
    const parsed = z.object({
      stage: z.string().max(200).default(''),
      workDescription: z.string().max(500).default(''),
      position: z.number().int().min(0).optional(),
    }).safeParse(body)
    if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

    let position = parsed.data.position
    if (position === undefined) {
      const maxRow = await c.env.DB.prepare(
        'SELECT COALESCE(MAX(position),0) as m FROM cost_estimation_rows WHERE estimation_id = ?',
      ).bind(estimationId).first<{ m: number }>()
      position = (maxRow?.m ?? 0) + 1
    }

    const id = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO cost_estimation_rows (id, estimation_id, stage, work_description, position) VALUES (?, ?, ?, ?, ?)',
    ).bind(id, estimationId, parsed.data.stage, parsed.data.workDescription, position).run()

    const row = await c.env.DB.prepare('SELECT * FROM cost_estimation_rows WHERE id = ?').bind(id).first()
    return c.json({ ...toCamel(row!), cells: {} }, 201)
  },
)

export const rowRoutes = new Hono<HonoContext>()

rowRoutes.patch(
  '/:id',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    if (!(await rowInOrg(c.env.DB, id, user.orgId))) return c.json({ message: 'Not found' }, 404)
    const body = await c.req.json()
    const parsed = z.object({
      stage: z.string().max(200).optional(),
      workDescription: z.string().max(500).optional(),
      position: z.number().int().min(0).optional(),
    }).safeParse(body)
    if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

    const updates: [string, unknown][] = []
    if (parsed.data.stage !== undefined) updates.push(['stage', parsed.data.stage])
    if (parsed.data.workDescription !== undefined) updates.push(['work_description', parsed.data.workDescription])
    if (parsed.data.position !== undefined) updates.push(['position', parsed.data.position])

    if (updates.length === 0) return c.json({ message: 'No fields' }, 400)
    const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
    await c.env.DB.prepare(`UPDATE cost_estimation_rows SET ${setClauses} WHERE id = ?`)
      .bind(...updates.map(([, v]) => v), id).run()

    const row = await c.env.DB.prepare('SELECT * FROM cost_estimation_rows WHERE id = ?').bind(id).first()
    return c.json(toCamel(row!))
  },
)

rowRoutes.delete(
  '/:id',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    if (!(await rowInOrg(c.env.DB, id, user.orgId))) return c.json({ message: 'Not found' }, 404)
    await c.env.DB.prepare('DELETE FROM cost_estimation_rows WHERE id = ?').bind(id).run()
    return c.json({ success: true })
  },
)

// ─── Cell upsert ─────────────────────────────────────────────────────────────

export const cellRoutes = new Hono<HonoContext>()

cellRoutes.put(
  '/',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const body = await c.req.json()
    const parsed = z.object({
      rowId: z.string().uuid(),
      gradeId: z.string().uuid(),
      days: z.number().min(0),
    }).safeParse(body)
    if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

    const { rowId, gradeId, days } = parsed.data
    const user = c.get('user')

    // Both row and grade must chain up to a project in the caller's org,
    // and must belong to the SAME estimation.
    const valid = await c.env.DB.prepare(`
      SELECT 1
      FROM cost_estimation_rows r
      JOIN cost_estimation_grades g ON g.estimation_id = r.estimation_id
      JOIN cost_estimations ce ON ce.id = r.estimation_id
      JOIN projects p ON p.id = ce.project_id
      WHERE r.id = ? AND g.id = ? AND p.org_id = ?
    `).bind(rowId, gradeId, user.orgId).first()
    if (!valid) return c.json({ message: 'Not found' }, 404)

    const id = crypto.randomUUID()

    await c.env.DB.prepare(`
      INSERT INTO cost_estimation_cells (id, row_id, grade_id, days)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(row_id, grade_id) DO UPDATE SET days = excluded.days
    `).bind(id, rowId, gradeId, days).run()

    return c.json({ rowId, gradeId, days })
  },
)
