import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useSetupStatus } from '@/hooks/useUsers'
import { useOrgSettings } from '@/hooks/useOrg'
import { setDefaultCurrency } from '@/lib/utils'
import { landingPath, ROUTE_ACCESS } from '@/lib/permissions'
import type { UserRole } from '@/types'
import { TopNav } from '@/components/layout/TopNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { HealthBar } from '@/components/layout/HealthBar'
import { Login } from '@/pages/Login'
import { Setup } from '@/pages/Setup'
import { Register } from '@/pages/Register'
import { Dashboard } from '@/pages/Dashboard'
import { Settings } from '@/pages/Settings'
import { Programs } from '@/pages/Programs'
import { ProgramDetail } from '@/pages/ProgramDetail'
import { Portfolios } from '@/pages/Portfolios'
import { PortfolioDetail } from '@/pages/PortfolioDetail'
import { Projects } from '@/pages/Projects'
import { ProjectDetail } from '@/pages/ProjectDetail'
import { Resources } from '@/pages/Resources'
import { Timesheet } from '@/pages/Timesheet'
import { Reports } from '@/pages/Reports'
import { Ideas } from '@/pages/Ideas'
import { Notifications } from '@/pages/Notifications'
import { MyWork } from '@/pages/MyWork'
import { Landing } from '@/pages/Landing'

function OrgCurrencyLoader() {
  const { data: org } = useOrgSettings()
  useEffect(() => {
    if (org?.settings?.currency) {
      setDefaultCurrency(org.settings.currency)
    }
  }, [org?.settings?.currency])
  return null
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <OrgCurrencyLoader />
      <TopNav />
      <HealthBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}

function RootRedirect() {
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus()
  const { user, isLoading: authLoading } = useAuth()

  if (setupLoading || authLoading) return <Spinner />
  if (setupStatus?.needsSetup) return <Navigate to="/setup" replace />
  if (!user) return <Landing />
  return <Navigate to={landingPath(user.role)} replace />
}

function ProtectedRoute({ children, allow }: { children: React.ReactNode; allow?: UserRole[] }) {
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus()
  const { user, isLoading: authLoading } = useAuth()

  if (setupLoading || authLoading) return <Spinner />
  if (setupStatus?.needsSetup) return <Navigate to="/setup" replace />
  if (!user) return <Navigate to="/" replace />
  if (allow && !allow.includes(user.role)) return <Navigate to={landingPath(user.role)} replace />

  return <AppShell>{children}</AppShell>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/my-work" element={<ProtectedRoute allow={ROUTE_ACCESS['/my-work']}><MyWork /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute allow={ROUTE_ACCESS['/dashboard']}><Dashboard /></ProtectedRoute>} />
      <Route path="/portfolios" element={<ProtectedRoute allow={ROUTE_ACCESS['/portfolios']}><Portfolios /></ProtectedRoute>} />
      <Route path="/portfolios/:id" element={<ProtectedRoute allow={ROUTE_ACCESS['/portfolios']}><PortfolioDetail /></ProtectedRoute>} />
      <Route path="/programs" element={<ProtectedRoute allow={ROUTE_ACCESS['/programs']}><Programs /></ProtectedRoute>} />
      <Route path="/programs/:id" element={<ProtectedRoute allow={ROUTE_ACCESS['/programs']}><ProgramDetail /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute allow={ROUTE_ACCESS['/projects']}><Projects /></ProtectedRoute>} />
      <Route path="/projects/:id" element={<ProtectedRoute allow={ROUTE_ACCESS['/projects']}><ProjectDetail /></ProtectedRoute>} />
      <Route path="/resources" element={<ProtectedRoute allow={ROUTE_ACCESS['/resources']}><Resources /></ProtectedRoute>} />
      <Route path="/timesheet" element={<ProtectedRoute allow={ROUTE_ACCESS['/timesheet']}><Timesheet /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute allow={ROUTE_ACCESS['/reports']}><Reports /></ProtectedRoute>} />
      <Route path="/ideas" element={<ProtectedRoute allow={ROUTE_ACCESS['/ideas']}><Ideas /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute allow={ROUTE_ACCESS['/notifications']}><Notifications /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute allow={ROUTE_ACCESS['/settings']}><Settings /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
