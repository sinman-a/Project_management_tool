import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useSetupStatus } from '@/hooks/useUsers'
import { useOrgSettings } from '@/hooks/useOrg'
import { setDefaultCurrency } from '@/lib/utils'
import { TopNav } from '@/components/layout/TopNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { HealthBar } from '@/components/layout/HealthBar'
import { Login } from '@/pages/Login'
import { Setup } from '@/pages/Setup'
import { Dashboard } from '@/pages/Dashboard'
import { Settings } from '@/pages/Settings'
import { Programs } from '@/pages/Programs'
import { ProgramDetail } from '@/pages/ProgramDetail'
import { Projects } from '@/pages/Projects'
import { ProjectDetail } from '@/pages/ProjectDetail'
import { Resources } from '@/pages/Resources'
import { Timesheet } from '@/pages/Timesheet'
import { Reports } from '@/pages/Reports'

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
      <OrgCurrencyLoader />
      <TopNav />
      <HealthBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
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
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to="/dashboard" replace />
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus()
  const { user, isLoading: authLoading } = useAuth()

  if (setupLoading || authLoading) return <Spinner />
  if (setupStatus?.needsSetup) return <Navigate to="/setup" replace />
  if (!user) return <Navigate to="/login" replace />

  return <AppShell>{children}</AppShell>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<Login />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/programs" element={<ProtectedRoute><Programs /></ProtectedRoute>} />
      <Route path="/programs/:id" element={<ProtectedRoute><ProgramDetail /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
      <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
      <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
      <Route path="/timesheet" element={<ProtectedRoute><Timesheet /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
