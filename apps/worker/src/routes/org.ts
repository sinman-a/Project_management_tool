import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'

const settingsSchema = z.object({
  currency: z.enum(['USD', 'EUR', 'GBP', 'UAH']).optional(),
  fiscalYearStart: z.number().int().min(1).max(12).optional(),
  workingHoursPerDay: z.number().min(1).max(24).optional(),
})

export const orgRoutes = new Hono<HonoContext>()

orgRoutes.get('/', async (c) => {
  const { orgId } = c.get('user')
  const org = await c.env.DB.prepare(
    'SELECT id, name, settings FROM organizations WHERE id = ?',
  )
    .bind(orgId)
    .first<{ id: string; name: string; settings: string }>()

  if (!org) return c.json({ message: 'Organization not found' }, 404)

  return c.json({ id: org.id, name: org.name, settings: JSON.parse(org.settings) })
})

orgRoutes.patch('/', async (c) => {
  const { role, orgId } = c.get('user')
  if (role !== 'admin') return c.json({ message: 'Forbidden' }, 403)

  const body = await c.req.json()
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)
  }

  const org = await c.env.DB.prepare(
    'SELECT settings FROM organizations WHERE id = ?',
  )
    .bind(orgId)
    .first<{ settings: string }>()

  if (!org) return c.json({ message: 'Organization not found' }, 404)

  const current = JSON.parse(org.settings)
  const updated = { ...current, ...parsed.data }

  await c.env.DB.prepare('UPDATE organizations SET settings = ? WHERE id = ?')
    .bind(JSON.stringify(updated), orgId)
    .run()

  return c.json({ settings: updated })
})
