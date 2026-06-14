import { useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDismissNotification } from '@/hooks/useNotifications'
import { useNavigate } from 'react-router-dom'
import type { Notification } from '@/types'
import { cn } from '@/lib/utils'
import { notificationMeta, notificationLink, relativeTime } from '@/lib/notificationMeta'

function NotificationRow({ notification, onRead }: { notification: Notification; onRead: () => void }) {
  const navigate = useNavigate()
  const dismiss = useDismissNotification()

  const payload = notification.payload as { message?: string; entityName?: string }
  const meta = notificationMeta(notification.type)
  const Icon = meta.icon

  function handleClick() {
    onRead()
    const link = notificationLink(notification)
    if (link) navigate(link)
  }

  return (
    <div className={cn(
      'flex items-start gap-3 py-3 px-4 border-b last:border-0 hover:bg-muted/30 transition-colors',
      !notification.readAt && 'bg-primary/5',
    )}>
      <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', meta.color)} />
      <div
        className="flex-1 cursor-pointer min-w-0"
        onClick={handleClick}
      >
        <p className="text-sm font-medium">{meta.title}{!notification.readAt && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />}</p>
        {payload.message && <p className="text-xs text-muted-foreground mt-0.5">{payload.message}</p>}
        <p className="text-xs text-muted-foreground mt-1">{relativeTime(notification.createdAt)}</p>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {!notification.readAt && (
          <button
            className="text-xs text-muted-foreground hover:text-primary transition-colors p-1"
            title="Mark as read"
            onClick={onRead}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          className="text-xs text-muted-foreground hover:text-destructive transition-colors p-1"
          title="Dismiss"
          onClick={() => dismiss.mutate(notification.id)}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export function Notifications() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { data, isLoading } = useNotifications(filter === 'unread')
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  const items = data?.items ?? []
  const unreadCount = data?.unreadCount ?? 0

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" /> Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-muted-foreground text-sm mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => markAll.mutate()}>
            <Check className="w-3 h-3 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      <div className="flex gap-1 border rounded-md p-0.5 bg-muted/30 w-fit">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-sm rounded capitalize transition-colors ${filter === f ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {f}{f === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">{filter === 'unread' ? 'Unread' : 'Recent'} Notifications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No notifications yet.</p>
          ) : (
            <div>
              {items.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onRead={() => markRead.mutate(n.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
