import {
  LayoutDashboard, FolderOpen, FolderKanban, Users, BarChart3, Settings,
  Clock, Layers, Lightbulb, CheckSquare,
} from 'lucide-react'
import type { UserRole } from '@/types'

/**
 * Which roles may access each top-level route.
 * Single source of truth for route guards (App.tsx) and sidebar visibility (Sidebar.tsx).
 * Keys are paths without params. Backend remains the source of truth for mutations.
 */
export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  '/my-work':      ['admin', 'program_manager', 'pmo_lead', 'project_manager', 'team_member'],
  '/dashboard':    ['admin', 'program_manager', 'pmo_lead', 'project_manager', 'sponsor', 'viewer'],
  '/portfolios':   ['admin', 'program_manager', 'pmo_lead', 'project_manager', 'sponsor', 'viewer'],
  '/programs':     ['admin', 'program_manager', 'pmo_lead', 'project_manager', 'sponsor', 'viewer'],
  '/projects':     ['admin', 'program_manager', 'pmo_lead', 'project_manager', 'sponsor', 'viewer'],
  '/ideas':        ['admin', 'program_manager', 'pmo_lead', 'project_manager'],
  '/resources':    ['admin', 'program_manager', 'pmo_lead', 'project_manager'],
  '/timesheet':    ['admin', 'program_manager', 'pmo_lead', 'project_manager', 'team_member'],
  '/reports':      ['admin', 'program_manager', 'pmo_lead', 'project_manager', 'sponsor', 'viewer'],
  '/notifications':['admin', 'program_manager', 'pmo_lead', 'project_manager', 'team_member', 'sponsor', 'viewer'],
  '/settings':     ['admin'],
}

/** Normalise a pathname to its top-level access key (e.g. /projects/abc → /projects). */
function routeKey(path: string): string {
  const seg = path.split('/').filter(Boolean)[0]
  return seg ? `/${seg}` : '/'
}

export function canAccessRoute(role: UserRole, path: string): boolean {
  const allowed = ROUTE_ACCESS[routeKey(path)]
  // Unlisted routes (e.g. detail pages without an explicit key) fall back to allow.
  return allowed ? allowed.includes(role) : true
}

/** Where a user lands after login / when blocked from a route. */
export function landingPath(role: UserRole): string {
  return role === 'team_member' ? '/my-work' : '/dashboard'
}

export interface NavItem {
  to: string
  icon: React.ElementType
  label: string
}

/** Sidebar items in display order; filtered per role via canAccessRoute. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/my-work', icon: CheckSquare, label: 'My Work' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/portfolios', icon: Layers, label: 'Portfolios' },
  { to: '/programs', icon: FolderOpen, label: 'Programs' },
  { to: '/projects', icon: FolderKanban, label: 'All Projects' },
  { to: '/ideas', icon: Lightbulb, label: 'Ideas' },
  { to: '/resources', icon: Users, label: 'Resources' },
  { to: '/timesheet', icon: Clock, label: 'Timesheet' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]
