import { useState } from 'react'
import { Printer, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RagBadge } from './RagStatusSelect'
import { useDeleteReport } from '@/hooks/useReports'
import type { StatusReport } from '@/hooks/useReports'
import { useAuthStore } from '@/stores/authStore'

interface Props {
  report: StatusReport
  onEdit: (r: StatusReport) => void
}

interface Risk {
  title: string
  severity: 'high' | 'medium' | 'low'
  mitigation?: string
}

function parseRisks(raw: string | null): Risk[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export function StatusReportCard({ report, onEdit }: Props) {
  const { user } = useAuthStore()
  const deleteReport = useDeleteReport()
  const [expanded, setExpanded] = useState(false)
  const risks = parseRisks(report.risksIssues)

  const canEdit = user?.role === 'admin' || user?.id === report.authorId

  function handlePrint() {
    const el = document.getElementById(`report-${report.id}`)
    if (!el) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>Status Report ${report.reportDate}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .sub { color: #666; font-size: 13px; margin-bottom: 16px; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
        .cell { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; text-align: center; }
        .label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
        .green { color: #15803d; background: #f0fdf4; }
        .amber { color: #b45309; background: #fffbeb; }
        .red { color: #b91c1c; background: #fef2f2; }
        .section { margin-bottom: 14px; }
        .section h3 { font-size: 13px; font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        .section p { font-size: 13px; color: #374151; white-space: pre-wrap; }
        .risk { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; margin-bottom: 8px; }
        .risk-title { font-weight: 600; font-size: 13px; }
        .risk-sev { display: inline-block; font-size: 11px; padding: 1px 6px; border-radius: 999px; margin-left: 8px; }
        .high { background:#fecaca; color:#b91c1c; } .medium { background:#fed7aa; color:#c2410c; } .low { background:#bbf7d0; color:#15803d; }
      </style></head><body>
      ${el.innerHTML}
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{report.reportDate}</span>
              {report.projectName && <span className="text-xs text-muted-foreground">· {report.projectName}</span>}
              {report.programName && !report.projectName && <span className="text-xs text-muted-foreground">· {report.programName}</span>}
              <span className="text-xs text-muted-foreground">by {report.authorName}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Period: {report.periodStart} – {report.periodEnd}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handlePrint} title="Print / Export PDF">
              <Printer className="w-3.5 h-3.5" />
            </Button>
            {canEdit && (
              <>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(report)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => { if (confirm('Delete this report?')) deleteReport.mutate(report.id) }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpanded((e) => !e)}>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-2">
          {(
            [
              ['Overall', report.overallStatus],
              ['Schedule', report.scheduleStatus],
              ['Budget', report.budgetStatus],
              ['Scope', report.scopeStatus],
            ] as [string, 'green' | 'amber' | 'red'][]
          ).map(([label, status]) => (
            <div key={label} className="text-center">
              <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
              <RagBadge status={status} />
            </div>
          ))}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-3 px-4 space-y-3" id={`report-${report.id}`}>
          <div className="sr-only">
            <h1>{report.projectName ?? report.programName} — Status Report {report.reportDate}</h1>
            <div className="sub">Period: {report.periodStart} – {report.periodEnd} · Author: {report.authorName}</div>
            <div className="grid">
              {(['Overall', 'Schedule', 'Budget', 'Scope'] as const).map((label, i) => {
                const s = [report.overallStatus, report.scheduleStatus, report.budgetStatus, report.scopeStatus][i]
                return <div key={label} className={`cell ${s}`}><div className="label">{label}</div><strong>{s.charAt(0).toUpperCase() + s.slice(1)}</strong></div>
              })}
            </div>
          </div>

          {report.narrativeThisPeriod && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">This Period</h4>
              <p className="text-sm whitespace-pre-wrap">{report.narrativeThisPeriod}</p>
            </div>
          )}
          {report.narrativeNextPeriod && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Next Period</h4>
              <p className="text-sm whitespace-pre-wrap">{report.narrativeNextPeriod}</p>
            </div>
          )}
          {risks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Risks & Issues</h4>
              <div className="space-y-1.5">
                {risks.map((r, i) => (
                  <div key={i} className="border rounded p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        r.severity === 'high' ? 'bg-red-100 text-red-700' :
                        r.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {r.severity}
                      </span>
                    </div>
                    {r.mitigation && <p className="text-muted-foreground text-xs mt-1">{r.mitigation}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
