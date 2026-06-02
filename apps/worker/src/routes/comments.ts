import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'
import { createNotification } from '../services/notificationService'

const commentSchema = z.object({
  entityType: z.enum(['project', 'task', 'status_report', 'risk', 'idea']),
  entityId: z.string().min(1),
  body: z.string().min(1).max(5000),
  parentCommentId: z.string().uuid().nullish(),
})

export const commentRoutes = new Hono<HonoContext>()

// GET /comments?entityType=&entityId=
commentRoutes.get('/', async (c) => {
  const user = c.get('user')
  const entityType = c.req.query('entityType')
  const entityId = c.req.query('entityId')

  if (!entityType || !entityId) {
    return c.json({ message: 'entityType and entityId required' }, 400)
  }

  const { results } = await c.env.DB.prepare(`
    SELECT cm.*, u.full_name as author_name, u.email as author_email
    FROM comments cm
    JOIN users u ON u.id = cm.author_id
    WHERE cm.org_id = ? AND cm.entity_type = ? AND cm.entity_id = ?
      AND cm.deleted_at IS NULL
    ORDER BY cm.is_pinned DESC, cm.created_at ASC
  `).bind(user.orgId, entityType, entityId).all()

  return c.json(results.map(toCamel))
})

// POST /comments
commentRoutes.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = commentSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const { entityType, entityId, body: commentBody, parentCommentId } = parsed.data
  const id = crypto.randomUUID()

  await c.env.DB.prepare(`
    INSERT INTO comments (id, org_id, entity_type, entity_id, parent_comment_id, body, author_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.orgId, entityType, entityId, parentCommentId ?? null, commentBody, user.sub).run()

  // Parse @mentions: @username patterns
  const mentionMatches = commentBody.match(/@(\w+)/g) ?? []
  for (const match of mentionMatches) {
    const username = match.slice(1)
    const mentioned = await c.env.DB.prepare(
      'SELECT id FROM users WHERE (email LIKE ? OR full_name LIKE ?) AND org_id = ? AND id != ?',
    ).bind(`${username}%`, `${username}%`, user.orgId, user.sub).first<{ id: string }>()

    if (mentioned) {
      await c.env.DB.prepare('INSERT INTO mentions (id, comment_id, mentioned_user_id) VALUES (?, ?, ?)')
        .bind(crypto.randomUUID(), id, mentioned.id).run()

      await createNotification(c.env.DB, {
        orgId: user.orgId,
        recipientId: mentioned.id,
        type: 'mention',
        entityType,
        entityId,
        actorId: user.sub,
        payload: { message: `Mentioned you in a comment`, entityType, entityId },
      })
    }
  }

  // Write activity log
  await writeActivity(c.env.DB, {
    orgId: user.orgId,
    entityType,
    entityId,
    eventType: 'comment_added',
    actorId: user.sub,
    payload: { commentId: id },
  })

  const comment = await c.env.DB.prepare(`
    SELECT cm.*, u.full_name as author_name, u.email as author_email
    FROM comments cm JOIN users u ON u.id = cm.author_id
    WHERE cm.id = ?
  `).bind(id).first()

  return c.json(toCamel(comment!), 201)
})

// PATCH /comments/:id
commentRoutes.patch('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const comment = await c.env.DB.prepare(
    'SELECT id, author_id FROM comments WHERE id = ? AND org_id = ? AND deleted_at IS NULL',
  ).bind(id, user.orgId).first<{ id: string; author_id: string }>()

  if (!comment) return c.json({ message: 'Not found' }, 404)
  if (comment.author_id !== user.sub) return c.json({ message: 'Forbidden' }, 403)

  const body = await c.req.json()
  const parsed = z.object({ body: z.string().min(1).max(5000) }).safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  await c.env.DB.prepare(
    'UPDATE comments SET body = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?',
  ).bind(parsed.data.body, id).run()

  const updated = await c.env.DB.prepare(`
    SELECT cm.*, u.full_name as author_name FROM comments cm
    JOIN users u ON u.id = cm.author_id WHERE cm.id = ?
  `).bind(id).first()

  return c.json(toCamel(updated!))
})

// DELETE /comments/:id (soft-delete)
commentRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const comment = await c.env.DB.prepare(
    'SELECT id, author_id FROM comments WHERE id = ? AND org_id = ? AND deleted_at IS NULL',
  ).bind(id, user.orgId).first<{ id: string; author_id: string }>()

  if (!comment) return c.json({ message: 'Not found' }, 404)
  if (comment.author_id !== user.sub && user.role !== 'admin') {
    return c.json({ message: 'Forbidden' }, 403)
  }

  await c.env.DB.prepare(
    'UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
  ).bind(id).run()

  return c.json({ success: true })
})

// POST /comments/:id/pin — moderators only (pinning is a thread-moderation action)
commentRoutes.post('/:id/pin', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const comment = await c.env.DB.prepare(
    'SELECT id, entity_type, entity_id, is_pinned FROM comments WHERE id = ? AND org_id = ? AND deleted_at IS NULL',
  ).bind(id, user.orgId).first<{ id: string; entity_type: string; entity_id: string; is_pinned: number }>()

  if (!comment) return c.json({ message: 'Not found' }, 404)

  const newPinned = comment.is_pinned ? 0 : 1

  if (newPinned === 1) {
    // Unpin any existing pinned comment in thread (org-scoped)
    await c.env.DB.prepare(
      'UPDATE comments SET is_pinned = 0 WHERE entity_type = ? AND entity_id = ? AND org_id = ? AND is_pinned = 1',
    ).bind(comment.entity_type, comment.entity_id, user.orgId).run()
  }

  await c.env.DB.prepare('UPDATE comments SET is_pinned = ? WHERE id = ?').bind(newPinned, id).run()

  return c.json({ success: true, isPinned: newPinned === 1 })
})

// GET /projects/:id/activity
export const activityRoutes = new Hono<HonoContext>()

activityRoutes.get('/projects/:id/activity', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  const eventType = c.req.query('eventType')
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200)
  const offset = parseInt(c.req.query('offset') ?? '0', 10)

  let where = `al.org_id = ? AND al.entity_id = ? AND al.entity_type = 'project'`
  const params: unknown[] = [user.orgId, projectId]

  if (eventType) {
    where += ' AND al.event_type = ?'
    params.push(eventType)
  }

  const { results } = await c.env.DB.prepare(`
    SELECT al.*, u.full_name as actor_name
    FROM activity_log al
    JOIN users u ON u.id = al.actor_id
    WHERE ${where}
    ORDER BY al.occurred_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()

  return c.json(results.map(toCamel))
})

activityRoutes.get('/programs/:id/activity', async (c) => {
  const user = c.get('user')
  const programId = c.req.param('id')
  const eventType = c.req.query('eventType')
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200)

  let where = `al.org_id = ? AND al.entity_id = ? AND al.entity_type = 'program'`
  const params: unknown[] = [user.orgId, programId]

  if (eventType) {
    where += ' AND al.event_type = ?'
    params.push(eventType)
  }

  const { results } = await c.env.DB.prepare(`
    SELECT al.*, u.full_name as actor_name
    FROM activity_log al
    JOIN users u ON u.id = al.actor_id
    WHERE ${where}
    ORDER BY al.occurred_at DESC
    LIMIT ?
  `).bind(...params, limit).all()

  return c.json(results.map(toCamel))
})

export async function writeActivity(
  db: D1Database,
  {
    orgId,
    entityType,
    entityId,
    eventType,
    actorId,
    payload,
  }: {
    orgId: string
    entityType: string
    entityId: string
    eventType: string
    actorId: string
    payload?: Record<string, unknown>
  },
) {
  await db.prepare(`
    INSERT INTO activity_log (id, org_id, entity_type, entity_id, event_type, actor_id, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), orgId, entityType, entityId, eventType, actorId,
    JSON.stringify(payload ?? {}),
  ).run()
}

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}
