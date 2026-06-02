import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, Users, FileText, Settings, LogOut, Bell, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/hooks/useNotifications'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/ideas', icon: Lightbulb, label: 'Ideas' },
  { to: '/resources', icon: Users, label: 'Resources' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const navigate = useNavigate()

  const unread = data?.unreadCount ?? 0
  const items = data?.items ?? []

  function handleClick(n: typeof items[0]) {
    markRead.mutate(n.id)
    setOpen(false)
    if (n.entityType && n.entityId) {
      navigate(`/${n.entityType}s/${n.entityId}`)
    }
  }

  return (
    <div className="relative">
      <button
        className="relative p-1.5 rounded-md hover:bg-accent transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-80 bg-background border rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => markAll.mutate()}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y">
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">No notifications</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    className={cn(
                      'w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors',
                      !n.readAt && 'bg-primary/5',
                    )}
                    onClick={() => handleClick(n)}
                  >
                    <div className="flex gap-2 items-start">
                      {!n.readAt && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                      <div className={cn(!n.readAt ? '' : 'ml-3.5')}>
                        <p className="text-xs font-medium">{n.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(n.payload as { message?: string }).message ?? ''}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="border-t px-3 py-2">
              <Link
                to="/notifications"
                className="text-xs text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function TopNav() {
  const location = useLocation()
  const { user, setUser } = useAuthStore()
  const qc = useQueryClient()
  const navigate = useNavigate()

  async function handleLogout() {
    await api.post('/auth/logout', {})
    setUser(null)
    qc.clear()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center px-6 gap-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-primary">PPM</span>
          <span className="text-muted-foreground font-normal text-sm">Tool</span>
        </Link>

        <nav className="flex items-center gap-1 ml-4">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
                location.pathname === to
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user && (
            <span className="text-sm text-muted-foreground">
              {user.fullName}{' '}
              <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                {user.role.replace(/_/g, ' ')}
              </span>
            </span>
          )}
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out" aria-label="Sign out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
