import type { D1Database } from '@cloudflare/workers-types'
import { notifyUserDedup } from '../services/notificationService'

/**
 * Scan for conditions that need attention and create notifications (deduped against
 * existing unread of the same type+entity). Runs from the hourly scheduled handler.
 */
export async function scanNotifications(db: D1Database): Promise<void> {
  await scanOverdueTasks(db)
  await scanRisks(db)
}

async function scanOverdueTasks(db: D1Database): Promise<void> {
  // One notification per overdue task to its assignee (if any) and the project manager.
  const { results } = await db.prepare(`
    SELECT t.id as task_id, t.name as task_name, t.assigned_to, t.due_date,
           p.id as project_id, p.org_id, p.manager_id, p.name as project_name
    FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.deleted_at IS NULL
      AND t.due_date IS NOT NULL AND t.due_date < date('now')
      AND t.status NOT IN ('done', 'cancelled')
      AND p.status NOT IN ('completed', 'cancelled')
    LIMIT 500
  `).bind().all<{
    task_id: string; task_name: string; assigned_to: string | null; due_date: string
    project_id: string; org_id: string; manager_id: string | null; project_name: string
  }>()

  for (const t of results) {
    const recipients = new Set<string>()
    if (t.assigned_to) recipients.add(t.assigned_to)
    if (t.manager_id) recipients.add(t.manager_id)
    for (const recipientId of recipients) {
      await notifyUserDedup(db, {
        orgId: t.org_id,
        recipientId,
        type: 'task_overdue',
        entityType: 'task',
        entityId: t.task_id,
        payload: { message: `Task "${t.task_name}" in ${t.project_name} is overdue (due ${t.due_date})` },
      })
    }
  }
}

async function scanRisks(db: D1Database): Promise<void> {
  // Critical open risks, or risks whose review date has passed → notify owner + manager.
  const { results } = await db.prepare(`
    SELECT r.id as risk_id, r.title, r.owner_id, r.score_band, r.next_review_date,
           p.org_id, p.manager_id, p.name as project_name
    FROM risks r JOIN projects p ON p.id = r.project_id
    WHERE r.deleted_at IS NULL
      AND r.status NOT IN ('closed', 'accepted')
      AND (r.score_band = 'critical' OR (r.next_review_date IS NOT NULL AND r.next_review_date < date('now')))
    LIMIT 500
  `).bind().all<{
    risk_id: string; title: string; owner_id: string | null; score_band: string; next_review_date: string | null
    org_id: string; manager_id: string | null; project_name: string
  }>()

  for (const r of results) {
    const recipients = new Set<string>()
    if (r.owner_id) recipients.add(r.owner_id)
    if (r.manager_id) recipients.add(r.manager_id)
    const reason = r.score_band === 'critical' ? 'is critical' : 'is due for review'
    for (const recipientId of recipients) {
      await notifyUserDedup(db, {
        orgId: r.org_id,
        recipientId,
        type: 'risk_attention',
        entityType: 'risk',
        entityId: r.risk_id,
        payload: { message: `Risk "${r.title}" in ${r.project_name} ${reason}` },
      })
    }
  }
}
