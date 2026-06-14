import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'

export const pushRoutes = new Hono<HonoContext>()

// GET /push/public-key — VAPID public key for the client to subscribe (empty string if push disabled).
pushRoutes.get('/public-key', (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY ?? '' })
})

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
})

// POST /push/subscribe — store (or refresh) this browser's push subscription.
pushRoutes.post('/subscribe', async (c) => {
  const user = c.get('user')
  const parsed = subSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ message: 'Invalid subscription' }, 400)
  const { endpoint, keys } = parsed.data

  await c.env.DB.prepare(`
    INSERT INTO push_subscriptions (id, user_id, org_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
  `).bind(crypto.randomUUID(), user.sub, user.orgId, endpoint, keys.p256dh, keys.auth).run()

  return c.json({ ok: true })
})

// POST /push/unsubscribe — remove this endpoint.
pushRoutes.post('/unsubscribe', async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const endpoint = (body as { endpoint?: string }).endpoint
  if (!endpoint) return c.json({ message: 'endpoint required' }, 400)
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
    .bind(endpoint, user.sub).run()
  return c.json({ ok: true })
})
