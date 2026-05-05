import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'

const riceSchema = z.object({
  milestone: z.string().max(300).optional(),
  goal: z.string().max(500).optional(),
  businessValue: z.string().max(500).optional(),
  userStory: z.string().max(500).optional(),
  reach: z.number().int().min(1).max(9).default(1),
  impact: z.number().int().min(1).max(9).default(1),
  confidence: z.number().min(0.1).max(1.0).default(1.0),
  effort: z.number().int().min(1).max(10).default(1),
})

export const riceRoutes = new Hono<HonoContext>()

riceRoutes.get('/', async (c) => {
  const projectId = c.req.query('projectId')
  if (!projectId) return c.json({ message: 'projectId required' }, 400)

  const { results } = await c.env.DB.prepare(`
    SELECT r.*, u.full_name as created_by_name
    FROM rice_items r
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.project_id = ?
    ORDER BY r.rice_score DESC, r.created_at ASC
  `).bind(projectId).all()

  return c.json(results.map(toCamel))
})

riceRoutes.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = riceSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const projectId = body.projectId as string
  if (!projectId) return c.json({ message: 'projectId required' }, 400)

  // verify project belongs to org
  const project = await c.env.DB.prepare('SELECT id FROM projects WHERE id = ? AND org_id = ?')
    .bind(projectId, user.orgId).first()
  if (!project) return c.json({ message: 'Project not found' }, 404)

  const { milestone, goal, businessValue, userStory, reach, impact, confidence, effort } = parsed.data
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await c.env.DB.prepare(`
    INSERT INTO rice_items (id, project_id, milestone, goal, business_value, user_story, reach, impact, confidence, effort, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, projectId, milestone ?? null, goal ?? null, businessValue ?? null, userStory ?? null,
    reach, impact, confidence, effort, user.sub, now, now).run()

  const item = await c.env.DB.prepare('SELECT * FROM rice_items WHERE id = ?').bind(id).first()
  return c.json(toCamel(item!), 201)
})

riceRoutes.patch('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const existing = await c.env.DB.prepare(`
    SELECT r.id FROM rice_items r
    JOIN projects p ON p.id = r.project_id
    WHERE r.id = ? AND p.org_id = ?
  `).bind(id, user.orgId).first()
  if (!existing) return c.json({ message: 'Not found' }, 404)

  const body = await c.req.json()
  const parsed = riceSchema.partial().safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const fields = parsed.data
  const updates: [string, unknown][] = []
  if (fields.milestone !== undefined) updates.push(['milestone', fields.milestone])
  if (fields.goal !== undefined) updates.push(['goal', fields.goal])
  if (fields.businessValue !== undefined) updates.push(['business_value', fields.businessValue])
  if (fields.userStory !== undefined) updates.push(['user_story', fields.userStory])
  if (fields.reach !== undefined) updates.push(['reach', fields.reach])
  if (fields.impact !== undefined) updates.push(['impact', fields.impact])
  if (fields.confidence !== undefined) updates.push(['confidence', fields.confidence])
  if (fields.effort !== undefined) updates.push(['effort', fields.effort])
  updates.push(['updated_at', new Date().toISOString()])

  const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE rice_items SET ${setClauses} WHERE id = ?`)
    .bind(...updates.map(([, v]) => v), id).run()

  const item = await c.env.DB.prepare('SELECT * FROM rice_items WHERE id = ?').bind(id).first()
  return c.json(toCamel(item!))
})

riceRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const existing = await c.env.DB.prepare(`
    SELECT r.id FROM rice_items r
    JOIN projects p ON p.id = r.project_id
    WHERE r.id = ? AND p.org_id = ?
  `).bind(id, user.orgId).first()
  if (!existing) return c.json({ message: 'Not found' }, 404)

  await c.env.DB.prepare('DELETE FROM rice_items WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}
