import { Bell, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDismissNotification } from '@/hooks/useNotifications'
import { useNavigate } from 'react-router-dom'
import type { Notification } from '@/types'
import { cn } from '@/lib/utils'

function NotificationRow({ notification, onRead }: { notification: Notification; onRead: () => void }) {
  const navigate = useNavigate()
  const dismiss = useDismissNotification()

  const payload = notification.payload as { message?: string; entityName?: string }

  function handleClick() {
    onRead()
    if (notification.entityType && notification.entityId) {
      navigate(`/${notification.entityType}s/${notification.entityId}`)
    }
  }

  return (
    <div className={cn(
      'flex items-start gap-3 py-3 px-4 border-b last:border-0 hover:bg-muted/30 transition-colors',
      !notification.readAt && 'bg-primary/5',
    )}>
      {!notification.readAt && (
        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
      )}
      <div
        className={cn('flex-1 cursor-pointer min-w-0', !notification.readAt ? '' : 'ml-5')}
        onClick={handleClick}
      >
        <p className="text-sm font-medium capitalize">{notification.type.replace(/_/g, ' ')}</p>
        {payload.message && <p className="text-xs text-muted-foreground mt-0.5">{payload.message}</p>}
        <p className="text-xs text-muted-foreground mt-1">{new Date(notification.createdAt).toLocaleString()}</p>
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
  const { data, isLoading } = useNotifications()
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Recent Notifications</CardTitle>
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
