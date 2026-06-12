import { History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthEvents } from '@/hooks/useSecurity'

const EVENT_LABEL: Record<string, { label: string; cls: string }> = {
  login_success: { label: 'Login', cls: 'text-green-600' },
  login_failure: { label: 'Login failed', cls: 'text-red-600' },
  login_2fa_required: { label: '2FA prompt', cls: 'text-muted-foreground' },
  login_2fa_failure: { label: '2FA failed', cls: 'text-red-600' },
  logout: { label: 'Logout', cls: 'text-muted-foreground' },
  logout_all: { label: 'Logout (all)', cls: 'text-muted-foreground' },
  password_change: { label: 'Password change', cls: 'text-amber-600' },
  sessions_revoked: { label: 'Sessions revoked', cls: 'text-amber-600' },
  '2fa_enabled': { label: '2FA enabled', cls: 'text-green-600' },
  '2fa_disabled': { label: '2FA disabled', cls: 'text-amber-600' },
}

export function AuthAuditCard() {
  const { data: events = [], isLoading } = useAuthEvents(true)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base"><History className="inline-block w-4 h-4 mr-2 text-primary" /> Login Audit Log</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No authentication events yet.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-1.5 pr-2">Time</th>
                  <th className="text-left py-1.5 pr-2">Email</th>
                  <th className="text-left py-1.5 pr-2">Event</th>
                  <th className="text-left py-1.5">IP</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const meta = EVENT_LABEL[e.eventType] ?? { label: e.eventType, cls: '' }
                  return (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 whitespace-nowrap text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
                      <td className="py-1.5 pr-2 truncate max-w-[160px]">{e.email ?? '—'}</td>
                      <td className={cn('py-1.5 pr-2 font-medium', meta.cls)}>{meta.label}</td>
                      <td className="py-1.5 text-muted-foreground">{e.ip ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
