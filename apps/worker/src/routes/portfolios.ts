import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'

const portfolioSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  ownerId: z.string().uuid().nullish(),
})

export const portfolioRoutes = new Hono<HonoContext>()

// GET /portfolios — list with program/project counts
portfolioRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(`
    SELECT pf.*,
      u.full_name AS owner_name,
      (SELECT COUNT(*) FROM programs pg WHERE pg.portfolio_id = pf.id) AS program_count,
      (SELECT COUNT(*) FROM projects pr
        JOIN programs pg2 ON pg2.id = pr.program_id
        WHERE pg2.portfolio_id = pf.id) AS project_count
    FROM portfolios pf
    LEFT JOIN users u ON u.id = pf.owner_id
    WHERE pf.org_id = ?
    ORDER BY pf.created_at DESC
  `).bind(user.orgId).all()
  return c.json(results.map(toCamel))
})

// GET /portfolios/:id
portfolioRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  const portfolio = await c.env.DB.prepare(`
    SELECT pf.*, u.full_name AS owner_name
    FROM portfolios pf LEFT JOIN users u ON u.id = pf.owner_id
    WHERE pf.id = ? AND pf.org_id = ?
  `).bind(c.req.param('id'), user.orgId).first()
  if (!portfolio) return c.json({ message: 'Not found' }, 404)
  return c.json(toCamel(portfolio))
})

// GET /portfolios/:id/summary — rollup of programs + child-project budgets
portfolioRoutes.get('/:id/summary', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const portfolio = await c.env.DB.prepare('SELECT id FROM portfolios WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId).first()
  if (!portfolio) return c.json({ message: 'Not found' }, 404)

  // Programs in this portfolio
  const { results: programs } = await c.env.DB.prepare(
    'SELECT * FROM programs WHERE portfolio_id = ? AND org_id = ? ORDER BY created_at DESC',
  ).bind(id, user.orgId).all()

  // Projects rolled up via their program, with their latest budget snapshot
  const { results: projects } = await c.env.DB.prepare(`
    SELECT p.id, p.name, p.status, p.rag_status, p.program_id,
      p.budget_capex, p.budget_opex,
      bs.spent_capex, bs.spent_opex, bs.eac_capex, bs.eac_opex
    FROM projects p
    JOIN programs pg ON pg.id = p.program_id
    LEFT JOIN budget_snapshots bs ON bs.id = (
      SELECT id FROM budget_snapshots WHERE project_id = p.id
      ORDER BY snapshot_date DESC, rowid DESC LIMIT 1
    )
    WHERE pg.portfolio_id = ? AND p.org_id = ?
    ORDER BY p.created_at DESC
  `).bind(id, user.orgId).all<{
    budget_capex: number; budget_opex: number
    spent_capex: number | null; spent_opex: number | null
    eac_capex: number | null; eac_opex: number | null
    rag_status: string | null
  }>()

  let totalBudget = 0, totalSpent = 0, totalEac = 0
  const ragMix: Record<string, number> = { green: 0, amber: 0, red: 0 }
  for (const p of projects) {
    totalBudget += (p.budget_capex ?? 0) + (p.budget_opex ?? 0)
    totalSpent += (p.spent_capex ?? 0) + (p.spent_opex ?? 0)
    totalEac += (p.eac_capex ?? 0) + (p.eac_opex ?? 0)
    const rag = p.rag_status ?? 'green'
    ragMix[rag] = (ragMix[rag] ?? 0) + 1
  }

  return c.json({
    programs: programs.map(toCamel),
    projects: projects.map(toCamel),
    rollup: {
      programCount: programs.length,
      projectCount: projects.length,
      totalBudget,
      totalSpent,
      totalEac,
      ragMix,
    },
  })
})

portfolioRoutes.post('/', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = portfolioSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const { name, description, ownerId } = parsed.data
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO portfolios (id, org_id, name, description, owner_id) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, user.orgId, name, description ?? null, ownerId ?? user.sub).run()

  const portfolio = await c.env.DB.prepare('SELECT * FROM portfolios WHERE id = ?').bind(id).first()
  return c.json(toCamel(portfolio!), 201)
})

portfolioRoutes.patch('/:id', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM portfolios WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId).first()
  if (!existing) return c.json({ message: 'Not found' }, 404)

  const body = await c.req.json()
  const parsed = portfolioSchema.partial().safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  const updates: [string, unknown][] = [['updated_at', new Date().toISOString()]]
  if (parsed.data.name !== undefined) updates.push(['name', parsed.data.name])
  if (parsed.data.description !== undefined) updates.push(['description', parsed.data.description ?? null])
  if (parsed.data.ownerId !== undefined) updates.push(['owner_id', parsed.data.ownerId ?? null])

  const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE portfolios SET ${setClauses} WHERE id = ? AND org_id = ?`)
    .bind(...updates.map(([, v]) => v), id, user.orgId).run()

  const updated = await c.env.DB.prepare('SELECT * FROM portfolios WHERE id = ?').bind(id).first()
  return c.json(toCamel(updated!))
})

portfolioRoutes.delete('/:id', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM portfolios WHERE id = ? AND org_id = ?')
    .bind(id, user.orgId).first()
  if (!existing) return c.json({ message: 'Not found' }, 404)

  // Detach programs (keep them, just unassign) then delete the portfolio.
  await c.env.DB.prepare('UPDATE programs SET portfolio_id = NULL WHERE portfolio_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM portfolios WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()), v]),
  )
}
