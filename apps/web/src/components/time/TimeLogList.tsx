import { CheckCircle2, Clock, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useProjectTimeLogs, useApproveTimeLog, useDeleteTimeLog } from '@/hooks/useTimeLogs'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import type { TimeLog } from '@/types'

function LogRow({ log, canApprove, canDelete }: { log: TimeLog; canApprove: boolean; canDelete: boolean }) {
  const approve = useApproveTimeLog()
  const del = useDeleteTimeLog()
  const approved = !!log.approvedAt

  return (
    <tr className={cn('border-b text-sm', approved ? 'opacity-70' : '')}>
      <td className="py-2 px-3 text-muted-foreground">{log.logDate}</td>
      <td className="py-2 px-3 truncate max-w-[180px]">
        {(log as unknown as { taskName?: string }).taskName ?? log.taskId.slice(0, 8)}
      </td>
      <td className="py-2 px-3 text-muted-foreground">
        {(log as unknown as { resourceName?: string }).resourceName ?? '—'}
      </td>
      <td className="py-2 px-3 text-right">{log.hours}h</td>
      <td className="py-2 px-3 text-right text-muted-foreground">{formatCurrency(log.computedCost)}</td>
      <td className="py-2 px-3 text-center">
        <span className={cn(
          'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
          log.costType === 'capex' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700',
        )}>
          {log.costType.toUpperCase()}
        </span>
      </td>
      <td className="py-2 px-3 text-center">
        {approved ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <Clock className="w-3 h-3" /> Pending
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-right">
        <div className="flex gap-1 justify-end">
          {!approved && canApprove && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2"
              disabled={approve.isPending}
              onClick={() => approve.mutate(log.id)}
            >
              Approve
            </Button>
          )}
          {!approved && canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-destructive"
              disabled={del.isPending}
              onClick={() => {
                if (confirm('Delete this time log?')) del.mutate(log.id)
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

interface Props {
  projectId: string
}

export function TimeLogList({ projectId }: Props) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: logs = [], isLoading } = useProjectTimeLogs(projectId)
  const canApprove = user?.role === 'admin' || user?.role === 'project_manager'

  const pending = logs.filter((l) => !l.approvedAt)
  const approved = logs.filter((l) => l.approvedAt)

  const totalHours = logs.reduce((s, l) => s + l.hours, 0)
  const approvedHours = approved.reduce((s, l) => s + l.hours, 0)
  const totalCost = logs.reduce((s, l) => s + l.computedCost, 0)
  const approvedCost = approved.reduce((s, l) => s + l.computedCost, 0)

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>

  if (logs.length === 0) {
    return (
      <div className="py-14 text-center border rounded-lg space-y-4">
        <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto" />
        <div>
          <p className="text-sm font-medium text-foreground">No time logs yet</p>
          <p className="text-xs text-muted-foreground mt-1">Log hours via the weekly timesheet and they'll appear here for approval.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/timesheet')}>
          Open Timesheet
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Hours', value: `${totalHours.toFixed(1)}h` },
          { label: 'Approved Hours', value: `${approvedHours.toFixed(1)}h` },
          { label: 'Total Cost', value: formatCurrency(totalCost) },
          { label: 'Approved Cost', value: formatCurrency(approvedCost) },
        ].map(({ label, value }) => (
          <div key={label} className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
            <Clock className="w-4 h-4" /> Pending Approval ({pending.length})
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Task</th>
                  <th className="py-2 px-3">Resource</th>
                  <th className="py-2 px-3 text-right">Hours</th>
                  <th className="py-2 px-3 text-right">Cost</th>
                  <th className="py-2 px-3 text-center">Type</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {pending.map((log) => (
                  <LogRow key={log.id} log={log} canApprove={canApprove} canDelete={true} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approved */}
      {approved.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Approved ({approved.length})
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Task</th>
                  <th className="py-2 px-3">Resource</th>
                  <th className="py-2 px-3 text-right">Hours</th>
                  <th className="py-2 px-3 text-right">Cost</th>
                  <th className="py-2 px-3 text-center">Type</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {approved.map((log) => (
                  <LogRow key={log.id} log={log} canApprove={false} canDelete={false} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
