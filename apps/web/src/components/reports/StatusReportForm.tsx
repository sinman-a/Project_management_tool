import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RagStatusSelect } from './RagStatusSelect'
import { useCreateReport, useUpdateReport, useRAGSuggestion } from '@/hooks/useReports'
import { useTopRisks } from '@/hooks/useRisks'
import type { StatusReport, CreateReportInput } from '@/hooks/useReports'

interface Risk {
  title: string
  severity: 'high' | 'medium' | 'low'
  mitigation: string
}

function bandToSeverity(band: string): Risk['severity'] {
  if (band === 'critical' || band === 'high') return 'high'
  if (band === 'medium') return 'medium'
  return 'low'
}

interface Props {
  projectId?: string
  programId?: string
  existing?: StatusReport | null
  onClose: () => void
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function weekAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

export function StatusReportForm({ projectId, programId, existing, onClose }: Props) {
  const create = useCreateReport()
  const update = useUpdateReport()
  const { data: topRisks } = useTopRisks(projectId, 3)
  const { data: suggestion } = useRAGSuggestion(!existing ? projectId : undefined)

  const [reportDate, setReportDate] = useState(existing?.reportDate ?? today())
  const [periodStart, setPeriodStart] = useState(existing?.periodStart ?? weekAgo())
  const [periodEnd, setPeriodEnd] = useState(existing?.periodEnd ?? today())
  const [overallStatus, setOverallStatus] = useState<'green' | 'amber' | 'red'>(existing?.overallStatus ?? 'green')
  const [scheduleStatus, setScheduleStatus] = useState<'green' | 'amber' | 'red'>(existing?.scheduleStatus ?? 'green')
  const [budgetStatus, setBudgetStatus] = useState<'green' | 'amber' | 'red'>(existing?.budgetStatus ?? 'green')
  const [scopeStatus, setScopeStatus] = useState<'green' | 'amber' | 'red'>(existing?.scopeStatus ?? 'green')
  const [narrativeThis, setNarrativeThis] = useState(existing?.narrativeThisPeriod ?? '')
  const [narrativeNext, setNarrativeNext] = useState(existing?.narrativeNextPeriod ?? '')
  const [risks, setRisks] = useState<Risk[]>(() => {
    if (!existing?.risksIssues) return []
    try { return JSON.parse(existing.risksIssues) } catch { return [] }
  })

  // Pre-populate RAGs from suggestion when creating a new report
  useEffect(() => {
    if (!existing && suggestion) {
      setOverallStatus(suggestion.rags.overall)
      setScheduleStatus(suggestion.rags.schedule)
      setBudgetStatus(suggestion.rags.budget)
      setScopeStatus(suggestion.rags.scope)
    }
  }, [suggestion, existing])

  // Pre-populate top risks when creating a new report
  useEffect(() => {
    if (!existing && topRisks && topRisks.length > 0 && risks.length === 0) {
      setRisks(topRisks.map((r) => ({
        title: `R-${String(r.riskNumber).padStart(3, '0')}: ${r.title}`,
        severity: bandToSeverity(r.scoreBand),
        mitigation: r.mitigationActions ?? '',
      })))
    }
  }, [topRisks, existing])

  useEffect(() => {
    if (existing) {
      setReportDate(existing.reportDate)
      setPeriodStart(existing.periodStart)
      setPeriodEnd(existing.periodEnd)
      setOverallStatus(existing.overallStatus)
      setScheduleStatus(existing.scheduleStatus)
      setBudgetStatus(existing.budgetStatus)
      setScopeStatus(existing.scopeStatus)
      setNarrativeThis(existing.narrativeThisPeriod ?? '')
      setNarrativeNext(existing.narrativeNextPeriod ?? '')
      try { setRisks(existing.risksIssues ? JSON.parse(existing.risksIssues) : []) } catch { setRisks([]) }
    }
  }, [existing])

  function addRisk() {
    setRisks((r) => [...r, { title: '', severity: 'medium', mitigation: '' }])
  }

  function removeRisk(i: number) {
    setRisks((r) => r.filter((_, idx) => idx !== i))
  }

  function updateRisk(i: number, field: keyof Risk, value: string) {
    setRisks((r) => r.map((risk, idx) => idx === i ? { ...risk, [field]: value } : risk))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: CreateReportInput = {
      projectId: projectId ?? null,
      programId: programId ?? null,
      reportDate,
      periodStart,
      periodEnd,
      overallStatus,
      scheduleStatus,
      budgetStatus,
      scopeStatus,
      narrativeThisPeriod: narrativeThis || undefined,
      narrativeNextPeriod: narrativeNext || undefined,
      risksIssues: risks.length > 0 ? JSON.stringify(risks) : undefined,
    }
    if (existing) {
      await update.mutateAsync({ id: existing.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  const isPending = create.isPending || update.isPending

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{existing ? 'Edit Report' : 'New Status Report'}</CardTitle>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Report Date</label>
              <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} required
                className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Period Start</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required
                className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Period End</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required
                className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                ['Overall', overallStatus, setOverallStatus, suggestion?.rags.overall, suggestion?.reasoning.overall],
                ['Schedule', scheduleStatus, setScheduleStatus, suggestion?.rags.schedule, suggestion?.reasoning.schedule],
                ['Budget', budgetStatus, setBudgetStatus, suggestion?.rags.budget, suggestion?.reasoning.budget],
                ['Scope', scopeStatus, setScopeStatus, suggestion?.rags.scope, suggestion?.reasoning.scope],
              ] as [string, 'green' | 'amber' | 'red', (v: 'green' | 'amber' | 'red') => void, string | undefined, string | undefined][]
            ).map(([label, val, setter, suggested, reason]) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center gap-1">
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  {!existing && suggested && (
                    <span
                      className={`text-[10px] px-1 py-0.5 rounded font-medium ${val === suggested ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}
                      title={reason}
                    >
                      {val === suggested ? 'Suggested' : 'Overridden'}
                    </span>
                  )}
                </div>
                <RagStatusSelect value={val} onChange={setter} />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">This Period — Accomplishments</label>
            <textarea
              value={narrativeThis}
              onChange={(e) => setNarrativeThis(e.target.value)}
              rows={3}
              placeholder="What was completed this period..."
              className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Next Period — Plan</label>
            <textarea
              value={narrativeNext}
              onChange={(e) => setNarrativeNext(e.target.value)}
              rows={3}
              placeholder="What is planned for next period..."
              className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Risks & Issues</label>
              <Button type="button" size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={addRisk}>
                <Plus className="w-3 h-3" /> Add Risk
              </Button>
            </div>
            {risks.map((risk, i) => (
              <div key={i} className="border rounded p-2 space-y-2">
                <div className="flex gap-2 items-start">
                  <input
                    value={risk.title}
                    onChange={(e) => updateRisk(i, 'title', e.target.value)}
                    placeholder="Risk / Issue title"
                    className="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <select
                    value={risk.severity}
                    onChange={(e) => updateRisk(i, 'severity', e.target.value)}
                    className="text-xs border rounded px-2 py-1 focus:outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeRisk(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <input
                  value={risk.mitigation}
                  onChange={(e) => updateRisk(i, 'mitigation', e.target.value)}
                  placeholder="Mitigation / action..."
                  className="w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Saving…' : existing ? 'Update' : 'Create Report'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
