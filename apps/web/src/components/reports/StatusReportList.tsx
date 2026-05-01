import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusReportCard } from './StatusReportCard'
import { StatusReportForm } from './StatusReportForm'
import { useReports } from '@/hooks/useReports'
import { useAuthStore } from '@/stores/authStore'
import type { StatusReport } from '@/hooks/useReports'

interface Props {
  projectId?: string
  programId?: string
}

export function StatusReportList({ projectId, programId }: Props) {
  const { user } = useAuthStore()
  const { data: reports = [], isLoading } = useReports({ projectId, programId })
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StatusReport | null>(null)

  const canCreate = user?.role !== 'team_member'

  function handleEdit(r: StatusReport) {
    setEditing(r)
    setShowForm(true)
  }

  function handleClose() {
    setShowForm(false)
    setEditing(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2].map((i) => <div key={i} className="h-20 bg-muted rounded" />)}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {canCreate && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => { setEditing(null); setShowForm(true) }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Report
          </Button>
        </div>
      )}

      {showForm && (
        <StatusReportForm
          projectId={projectId}
          programId={programId}
          existing={editing}
          onClose={handleClose}
        />
      )}

      {reports.length === 0 && !showForm && (
        <div className="py-12 text-center text-muted-foreground text-sm border rounded-lg">
          No status reports yet.
          {canCreate && ' Click "New Report" to create one.'}
        </div>
      )}

      {reports.map((r) => (
        <StatusReportCard key={r.id} report={r} onEdit={handleEdit} />
      ))}
    </div>
  )
}
