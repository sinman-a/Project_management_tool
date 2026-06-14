import { useState } from 'react'
import { Plus, FileText } from 'lucide-react'
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
        <div className="py-12 flex flex-col items-center text-center border rounded-lg">
          <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">No status reports yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Status reports capture a point-in-time snapshot of health (RAG), schedule, budget and scope to share with stakeholders.
          </p>
          {canCreate && (
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => { setEditing(null); setShowForm(true) }}>
              <Plus className="w-3.5 h-3.5" /> Generate your first report
            </Button>
          )}
        </div>
      )}

      {reports.map((r) => (
        <StatusReportCard key={r.id} report={r} onEdit={handleEdit} />
      ))}
    </div>
  )
}
