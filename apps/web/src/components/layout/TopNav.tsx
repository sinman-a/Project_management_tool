import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, Users, FileText, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/resources', icon: Users, label: 'Resources' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function TopNav() {
  const location = useLocation()
  const { user, setUser } = useAuthStore()
  const qc = useQueryClient()

  async function handleLogout() {
    await api.post('/auth/logout', {})
    setUser(null)
    qc.clear()
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
                {user.role.replace('_', ' ')}
              </span>
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
