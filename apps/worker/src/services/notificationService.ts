import type { Env } from '../types'
import { sendPushToUser } from '../utils/webpush'

interface NotifyOpts {
  orgId: string
  recipientId: string
  type: string
  entityType?: string
  entityId?: string
  actorId?: string
  payload?: Record<string, unknown>
}

export async function createNotification(db: D1Database, opts: NotifyOpts) {
  try {
    await db.prepare(`
      INSERT INTO notifications (id, org_id, recipient_id, type, entity_type, entity_id, actor_id, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      opts.orgId,
      opts.recipientId,
      opts.type,
      opts.entityType ?? null,
      opts.entityId ?? null,
      opts.actorId ?? null,
      JSON.stringify(opts.payload ?? {}),
    ).run()
  } catch {
    // Silently skip if notifications table not yet migrated
  }
}

/** True if the recipient has this notification type enabled (default on when unset). */
async function typeEnabled(db: D1Database, recipientId: string, type: string): Promise<boolean> {
  try {
    const row = await db.prepare('SELECT notification_prefs FROM users WHERE id = ?')
      .bind(recipientId).first<{ notification_prefs: string | null }>()
    if (!row?.notification_prefs) return true
    const prefs = JSON.parse(row.notification_prefs) as Record<string, boolean>
    return prefs[type] !== false
  } catch {
    return true
  }
}

const PUSH_TITLES: Record<string, string> = {
  task_overdue: 'Overdue task',
  risk_attention: 'Risk needs attention',
  comment_added: 'New comment',
  project_status_changed: 'Project status changed',
  mention: 'You were mentioned',
}

/** Fire a Web Push for a just-created notification (best-effort; no-op if push unconfigured). */
async function pushFor(env: Env | undefined, opts: NotifyOpts): Promise<void> {
  if (!env) return
  const url = opts.entityType === 'project' && opts.entityId ? `/projects/${opts.entityId}` : '/notifications'
  await sendPushToUser(env, opts.recipientId, {
    title: PUSH_TITLES[opts.type] ?? 'PPM Tool',
    body: (opts.payload?.message as string) ?? '',
    url,
  })
}

/** Create a notification only if the recipient hasn't disabled this type. Skips self-notifications. */
export async function notifyUser(db: D1Database, opts: NotifyOpts, env?: Env): Promise<void> {
  if (opts.recipientId === opts.actorId) return
  if (!(await typeEnabled(db, opts.recipientId, opts.type))) return
  await createNotification(db, opts)
  await pushFor(env, opts)
}

/**
 * Like notifyUser, but skips if an unread notification of the same type+entity already
 * exists for this recipient (avoids cron-generated duplicates). 24h-effective via read state.
 */
export async function notifyUserDedup(db: D1Database, opts: NotifyOpts, env?: Env): Promise<void> {
  if (!(await typeEnabled(db, opts.recipientId, opts.type))) return
  try {
    const existing = await db.prepare(
      `SELECT 1 FROM notifications WHERE recipient_id = ? AND type = ? AND entity_id = ? AND read_at IS NULL LIMIT 1`,
    ).bind(opts.recipientId, opts.type, opts.entityId ?? null).first()
    if (existing) return
  } catch {
    // table not migrated — fall through
  }
  await createNotification(db, opts)
  await pushFor(env, opts)
}
