import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'

export const notificationRoutes = new Hono<HonoContext>()

const NOTIFICATION_TYPES = ['task_overdue', 'risk_attention', 'comment_added', 'project_status_changed', 'mention'] as const

// GET /notifications/preferences
notificationRoutes.get('/preferences', async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare('SELECT notification_prefs FROM users WHERE id = ?')
    .bind(user.sub).first<{ notification_prefs: string | null }>()
  let prefs: Record<string, boolean> = {}
  try { prefs = row?.notification_prefs ? JSON.parse(row.notification_prefs) : {} } catch { /* ignore */ }
  // Default every type to enabled when unset.
  const result = Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, prefs[t] !== false]))
  return c.json(result)
})

// PUT /notifications/preferences
notificationRoutes.put('/preferences', async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const parsed = z.record(z.boolean()).safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)
  const clean = Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, parsed.data[t] !== false]))
  await c.env.DB.prepare('UPDATE users SET notification_prefs = ? WHERE id = ?')
    .bind(JSON.stringify(clean), user.sub).run()
  return c.json(clean)
})

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
  const out = Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()), v]),
  )
  // payload is stored as a JSON string — parse it so the client gets a usable object.
  if (typeof out.payload === 'string') {
    try { out.payload = JSON.parse(out.payload as string) } catch { out.payload = {} }
  }
  return out
}
