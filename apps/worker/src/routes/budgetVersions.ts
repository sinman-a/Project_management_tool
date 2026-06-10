import { Hono } from 'hono'
import { z } from 'zod'
import type { D1Database } from '@cloudflare/workers-types'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'
import { projectInOrg } from '../middleware/ownership'
import { recalculateProjectBudget } from '../services/budgetService'

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()), v]),
  )
}

const versionSchema = z.object({
  label: z.string().min(1).max(120),
  gate: z.string().max(60).nullish(),
  capex: z.number().min(0).default(0),
  opex: z.number().min(0).default(0),
  notes: z.string().max(1000).nullish(),
})

/** version → project → org */
async function versionProject(db: D1Database, versionId: string, orgId: string): Promise<{ id: string; project_id: string; status: string } | null> {
  const row = await db.prepare(`
    SELECT bv.id, bv.project_id, bv.status
    FROM budget_versions bv JOIN projects p ON p.id = bv.project_id
    WHERE bv.id = ? AND p.org_id = ?
  `).bind(versionId, orgId).first<{ id: string; project_id: string; status: string }>()
  return row ?? null
}

// ── project sub-routes (mounted on /projects) ────────────────────────────────
export const budgetVersionSubRoutes = new Hono<HonoContext>()

budgetVersionSubRoutes.get('/:id/budget-versions', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)
  const { results } = await c.env.DB.prepare(`
    SELECT bv.*, cu.full_name as created_by_name, au.full_name as approved_by_name
    FROM budget_versions bv
    LEFT JOIN users cu ON cu.id = bv.created_by
    LEFT JOIN users au ON au.id = bv.approved_by
    WHERE bv.project_id = ?
    ORDER BY bv.created_at ASC
  `).bind(projectId).all()
  return c.json(results.map(toCamel))
})

budgetVersionSubRoutes.post('/:id/budget-versions', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)

  const body = await c.req.json()
  const parsed = versionSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const id = crypto.randomUUID()
  const d = parsed.data
  await c.env.DB.prepare(
    'INSERT INTO budget_versions (id, project_id, label, gate, capex, opex, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, projectId, d.label, d.gate ?? null, d.capex, d.opex, d.notes ?? null, user.sub).run()

  const row = await c.env.DB.prepare('SELECT * FROM budget_versions WHERE id = ?').bind(id).first()
  return c.json(toCamel(row!), 201)
})

// active (or latest) vs earliest approved reference
budgetVersionSubRoutes.get('/:id/budget-variance', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)

  const active = await c.env.DB.prepare(
    `SELECT * FROM budget_versions WHERE project_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
  ).bind(projectId).first<Record<string, unknown>>()
  const reference = await c.env.DB.prepare(
    `SELECT * FROM budget_versions WHERE project_id = ? AND status IN ('approved','active','archived')
     ORDER BY (approved_at IS NULL), approved_at ASC, created_at ASC LIMIT 1`,
  ).bind(projectId).first<Record<string, unknown>>()

  if (!active || !reference) return c.json({ active: null, reference: null })

  const aCapex = (active.capex as number) ?? 0, aOpex = (active.opex as number) ?? 0
  const rCapex = (reference.capex as number) ?? 0, rOpex = (reference.opex as number) ?? 0
  const deltaCapex = aCapex - rCapex
  const deltaOpex = aOpex - rOpex
  const deltaTotal = deltaCapex + deltaOpex
  const refTotal = rCapex + rOpex
  const pctChange = refTotal > 0 ? (deltaTotal / refTotal) * 100 : null

  return c.json({
    reference: toCamel(reference),
    active: toCamel(active),
    deltaCapex, deltaOpex, deltaTotal, pctChange,
  })
})

// ── by-id routes (mounted on /budget-versions) ───────────────────────────────
export const budgetVersionRoutes = new Hono<HonoContext>()

budgetVersionRoutes.patch('/:id', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const ver = await versionProject(c.env.DB, id, user.orgId)
  if (!ver) return c.json({ message: 'Not found' }, 404)
  if (ver.status !== 'draft') return c.json({ message: 'Only draft versions can be edited' }, 400)

  const body = await c.req.json()
  const parsed = versionSchema.partial().safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  const updates: [string, unknown][] = []
  if (parsed.data.label !== undefined) updates.push(['label', parsed.data.label])
  if (parsed.data.gate !== undefined) updates.push(['gate', parsed.data.gate ?? null])
  if (parsed.data.capex !== undefined) updates.push(['capex', parsed.data.capex])
  if (parsed.data.opex !== undefined) updates.push(['opex', parsed.data.opex])
  if (parsed.data.notes !== undefined) updates.push(['notes', parsed.data.notes ?? null])
  if (updates.length === 0) return c.json({ message: 'No fields' }, 400)

  const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE budget_versions SET ${setClauses} WHERE id = ?`)
    .bind(...updates.map(([, v]) => v), id).run()

  const row = await c.env.DB.prepare('SELECT * FROM budget_versions WHERE id = ?').bind(id).first()
  return c.json(toCamel(row!))
})

budgetVersionRoutes.post('/:id/approve', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const ver = await versionProject(c.env.DB, id, user.orgId)
  if (!ver) return c.json({ message: 'Not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE budget_versions SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'`,
  ).bind(user.sub, id).run()

  const row = await c.env.DB.prepare('SELECT * FROM budget_versions WHERE id = ?').bind(id).first()
  return c.json(toCamel(row!))
})

budgetVersionRoutes.post('/:id/activate', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const ver = await versionProject(c.env.DB, id, user.orgId)
  if (!ver) return c.json({ message: 'Not found' }, 404)

  const version = await c.env.DB.prepare('SELECT capex, opex FROM budget_versions WHERE id = ?')
    .bind(id).first<{ capex: number; opex: number }>()
  if (!version) return c.json({ message: 'Not found' }, 404)

  // Archive any other active version, activate this one, write budget back to the project.
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE budget_versions SET status = 'archived' WHERE project_id = ? AND status = 'active' AND id != ?`).bind(ver.project_id, id),
    c.env.DB.prepare(`UPDATE budget_versions SET status = 'active', approved_by = COALESCE(approved_by, ?), approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP) WHERE id = ?`).bind(user.sub, id),
    c.env.DB.prepare(`UPDATE projects SET budget_capex = ?, budget_opex = ? WHERE id = ?`).bind(version.capex, version.opex, ver.project_id),
  ])

  // Recalculate budget snapshot against the new active budget.
  try { await recalculateProjectBudget(c.env.DB, c.env.KV_CACHE, ver.project_id) } catch { /* non-critical */ }

  const row = await c.env.DB.prepare('SELECT * FROM budget_versions WHERE id = ?').bind(id).first()
  return c.json(toCamel(row!))
})

budgetVersionRoutes.delete('/:id', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const ver = await versionProject(c.env.DB, id, user.orgId)
  if (!ver) return c.json({ message: 'Not found' }, 404)
  if (ver.status === 'active' || ver.status === 'approved') {
    return c.json({ message: 'Cannot delete an approved or active version' }, 400)
  }
  await c.env.DB.prepare('DELETE FROM budget_versions WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})
