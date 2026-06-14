import { Bell, BellRing } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNotificationPrefs, useUpdateNotificationPrefs } from '@/hooks/useNotifications'
import { usePush } from '@/hooks/usePush'

const TYPES: { key: string; label: string; desc: string }[] = [
  { key: 'task_overdue', label: 'Overdue tasks', desc: 'When a task you own or manage passes its due date' },
  { key: 'risk_attention', label: 'Risks needing attention', desc: 'Critical or overdue-for-review risks' },
  { key: 'comment_added', label: 'New comments', desc: 'New discussion comments on your projects' },
  { key: 'project_status_changed', label: 'Project status changes', desc: 'When a project you manage changes status' },
  { key: 'mention', label: 'Mentions', desc: 'When someone @mentions you in a comment' },
]

export function NotificationPreferencesCard() {
  const { data: prefs } = useNotificationPrefs()
  const update = useUpdateNotificationPrefs()
  const push = usePush()

  function toggle(key: string, value: boolean) {
    update.mutate({ ...(prefs ?? {}), [key]: value })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base"><Bell className="inline-block w-4 h-4 mr-2 text-primary" /> Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Browser push */}
        {push.supported && (
          <div className="flex items-start justify-between gap-3 border-b pb-3">
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5"><BellRing className="w-4 h-4" /> Browser push notifications</p>
              <p className="text-xs text-muted-foreground">Get alerts on this device even when the tab is closed.</p>
              {push.error && <p className="text-xs text-destructive mt-1">{push.error}</p>}
            </div>
            <Button
              size="sm"
              variant={push.subscribed ? 'outline' : 'default'}
              disabled={push.busy}
              onClick={() => (push.subscribed ? push.unsubscribe() : push.subscribe())}
            >
              {push.busy ? '…' : push.subscribed ? 'Disable' : 'Enable'}
            </Button>
          </div>
        )}
        {TYPES.map((t) => {
          const enabled = prefs ? prefs[t.key] !== false : true
          return (
            <label key={t.key} className="flex items-start justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
              <input
                type="checkbox"
                className="mt-1 rounded"
                checked={enabled}
                onChange={(e) => toggle(t.key, e.target.checked)}
              />
            </label>
          )
        })}
      </CardContent>
    </Card>
  )
}
