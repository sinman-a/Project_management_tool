import { Hono } from 'hono'
import type { HonoContext } from '../types'

export const notificationRoutes = new Hono<HonoContext>()

// GET /notifications?unread=true&limit=20
notificationRoutes.get('/', async (c) => {
  const user = c.get('user')
  const unreadOnly = c.req.query('unread') === 'true'
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100)
  const offset = parseInt(c.req.query('offset') ?? '0', 10)

  let where = 'n.recipient_id = ?'
  const params: unknown[] = [user.sub]

  if (unreadOnly) {
    where += ' AND n.read_at IS NULL'
  }

  const { results } = await c.env.DB.prepare(`
    SELECT n.*, u.full_name as actor_name
    FROM notifications n
    LEFT JOIN users u ON u.id = n.actor_id
    WHERE ${where}
    ORDER BY n.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()

  const unreadCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM notifications WHERE recipient_id = ? AND read_at IS NULL',
  ).bind(user.sub).first<{ cnt: number }>()

  return c.json({
    items: results.map(toCamel),
    unreadCount: unreadCount?.cnt ?? 0,
  })
})

// POST /notifications/:id/read
notificationRoutes.post('/:id/read', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  await c.env.DB.prepare(
    'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND recipient_id = ? AND read_at IS NULL',
  ).bind(id, user.sub).run()

  return c.json({ success: true })
})

// POST /notifications/read-all
notificationRoutes.post('/read-all', async (c) => {
  const user = c.get('user')

  await c.env.DB.prepare(
    'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE recipient_id = ? AND read_at IS NULL',
  ).bind(user.sub).run()

  return c.json({ success: true })
})

// DELETE /notifications/:id
notificationRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  await c.env.DB.prepare(
    'DELETE FROM notifications WHERE id = ? AND recipient_id = ?',
  ).bind(id, user.sub).run()

  return c.json({ success: true })
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()), v]),
  )
}
