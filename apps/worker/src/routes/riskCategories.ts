import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'

const BUILTIN_CATEGORIES = [
  'Technical', 'Schedule', 'Resource', 'Scope',
  'Financial', 'External', 'Organisational', 'Quality',
]

export const riskCategoryRoutes = new Hono<HonoContext>()

riskCategoryRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM risk_categories WHERE org_id = ? ORDER BY name ASC',
  ).bind(user.orgId).all()

  const builtins = BUILTIN_CATEGORIES.map((name) => ({
    id: `builtin_${name.toLowerCase()}`,
    orgId: user.orgId,
    name,
    isBuiltin: true,
    createdAt: '',
  }))

  const custom = results.map(toCamel) as Array<Record<string, unknown>>
  return c.json([...builtins, ...custom])
})

riskCategoryRoutes.post('/', requireAny('admin'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const schema = z.object({ name: z.string().min(1).max(50) })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  const { name } = parsed.data
  if (BUILTIN_CATEGORIES.includes(name)) {
    return c.json({ message: 'Cannot duplicate a built-in category' }, 409)
  }

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO risk_categories (id, org_id, name, is_builtin) VALUES (?, ?, ?, 0)',
  ).bind(id, user.orgId, name).run()

  return c.json({ id, orgId: user.orgId, name, isBuiltin: false }, 201)
})

riskCategoryRoutes.delete('/:id', requireAny('admin'), async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare(
    'SELECT id, is_builtin, name FROM risk_categories WHERE id = ?',
  ).bind(id).first<{ id: string; is_builtin: number; name: string }>()

  if (!row) return c.json({ message: 'Not found' }, 404)
  if (row.is_builtin) return c.json({ message: 'Cannot delete a built-in category' }, 409)

  const inUse = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM risks WHERE category = ? AND deleted_at IS NULL',
  ).bind(row.name).first<{ cnt: number }>()
  if ((inUse?.cnt ?? 0) > 0) {
    return c.json({ message: 'CATEGORY_IN_USE', riskCount: inUse!.cnt }, 409)
  }

  await c.env.DB.prepare('DELETE FROM risk_categories WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}
