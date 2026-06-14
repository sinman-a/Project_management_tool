import { AlertTriangle, ShieldAlert, MessageSquare, RefreshCw, AtSign, Lightbulb, Bell } from 'lucide-react'
import type { Notification } from '@/types'

export const NOTIFICATION_META: Record<string, { title: string; icon: React.ElementType; color: string }> = {
  task_overdue: { title: 'Overdue task', icon: AlertTriangle, color: 'text-red-600' },
  risk_attention: { title: 'Risk needs attention', icon: ShieldAlert, color: 'text-red-600' },
  comment_added: { title: 'New comment', icon: MessageSquare, color: 'text-blue-600' },
  project_status_changed: { title: 'Project status changed', icon: RefreshCw, color: 'text-indigo-600' },
  mention: { title: 'You were mentioned', icon: AtSign, color: 'text-violet-600' },
  idea_decided: { title: 'Idea decision', icon: Lightbulb, color: 'text-amber-600' },
  idea_converted: { title: 'Idea converted to project', icon: Lightbulb, color: 'text-teal-600' },
}

export function notificationMeta(type: string) {
  return NOTIFICATION_META[type] ?? { title: type.replace(/_/g, ' '), icon: Bell, color: 'text-muted-foreground' }
}

/** Where a notification navigates on click (null = no destination, just mark read). */
export function notificationLink(n: Notification): string | null {
  if (!n.entityType || !n.entityId) return null
  if (n.entityType === 'project') return `/projects/${n.entityId}`
  if (n.entityType === 'idea') return '/ideas'
  return null // task/risk lack a standalone route; open from their project instead
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (isNaN(then)) return ''
  const diff = Date.now() - then
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}
