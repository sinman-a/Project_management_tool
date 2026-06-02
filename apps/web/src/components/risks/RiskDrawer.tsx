import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useCreateRisk, useUpdateRisk, useDeleteRisk } from '@/hooks/useRisks'
import { useRiskCategories } from '@/hooks/useRiskCategories'
import { useDialog } from '@/hooks/useDialog'
import type { Risk, RiskResponseStrategy, RiskStatus } from '@/types'

const SCORE_BAND = (score: number) => {
  if (score <= 6) return { band: 'low', cls: 'bg-green-50 text-green-700' }
  if (score <= 14) return { band: 'medium', cls: 'bg-yellow-50 text-yellow-700' }
  if (score <= 20) return { band: 'high', cls: 'bg-orange-50 text-orange-700' }
  return { band: 'critical', cls: 'bg-red-50 text-red-700' }
}

const STATUSES: RiskStatus[] = ['identified', 'analyzing', 'mitigating', 'closed', 'accepted', 'occurred']
const STRATEGIES: RiskResponseStrategy[] = ['avoid', 'transfer', 'mitigate', 'accept']

interface Props {
  open: boolean
  onClose: () => void
  projectId?: string
  programId?: string
  risk?: Risk | null
  canEdit?: boolean
}

export function RiskDrawer({ open, onClose, projectId, risk, canEdit = false }: Props) {
  const dialogRef = useDialog(open, onClose)
  const { data: categories = [] } = useRiskCategories()
  const createRisk = useCreateRisk()
  const updateRisk = useUpdateRisk()
  const deleteRisk = useDeleteRisk()

  const today = new Date().toISOString().slice(0, 10)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Technical')
  const [probability, setProbability] = useState(1)
  const [impact, setImpact] = useState(1)
  const [status, setStatus] = useState<RiskStatus>('identified')
  const [strategy, setStrategy] = useState<RiskResponseStrategy | ''>('')
  const [mitigation, setMitigation] = useState('')
  const [contingency, setContingency] = useState('')
  const [triggers, setTriggers] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [dateIdentified, setDateIdentified] = useState(today)
  const [dateLastReviewed, setDateLastReviewed] = useState('')
  const [nextReviewDate, setNextReviewDate] = useState('')
  const [errors, setErrors] = useState<{ title?: string; api?: string }>({})

  useEffect(() => {
    if (risk) {
      setTitle(risk.title)
      setDescription(risk.description ?? '')
      setCategory(risk.category)
      setProbability(risk.probability)
      setImpact(risk.impact)
      setStatus(risk.status)
      setStrategy(risk.responseStrategy ?? '')
      setMitigation(risk.mitigationActions ?? '')
      setContingency(risk.contingencyPlan ?? '')
      setTriggers(risk.triggerIndicators ?? '')
      setOwnerId(risk.ownerId ?? '')
      setDateIdentified(risk.dateIdentified)
      setDateLastReviewed(risk.dateLastReviewed ?? '')
      setNextReviewDate(risk.nextReviewDate ?? '')
    } else {
      setTitle('')
      setDescription('')
      setCategory('Technical')
      setProbability(1)
      setImpact(1)
      setStatus('identified')
      setStrategy('')
      setMitigation('')
      setContingency('')
      setTriggers('')
      setOwnerId('')
      setDateIdentified(today)
      setDateLastReviewed('')
      setNextReviewDate('')
    }
    setErrors({})
  }, [risk, open])

  const score = probability * impact
  const { band, cls: bandCls } = SCORE_BAND(score)

  function validate() {
    const errs: { title?: string } = {}
    if (!title.trim()) errs.title = 'Title is required'
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setErrors({})

    const onError = (err: unknown) =>
      setErrors({ api: (err as { message?: string })?.message ?? 'Failed to save risk. Please try again.' })

    const payload = {
      title: title.trim(),
      description: description || null,
      category,
      probability,
      impact,
      status,
      responseStrategy: strategy || null,
      mitigationActions: mitigation || null,
      contingencyPlan: contingency || null,
      triggerIndicators: triggers || null,
      ownerId: ownerId || null,
      dateIdentified,
      dateLastReviewed: dateLastReviewed || null,
      nextReviewDate: nextReviewDate || null,
    }

    if (risk) {
      updateRisk.mutate({ id: risk.id, ...payload }, { onSuccess: onClose, onError })
    } else if (projectId) {
      createRisk.mutate({ projectId, ...payload }, { onSuccess: onClose, onError })
    }
  }

  function handleDelete() {
    if (!risk || !confirm('Delete this risk?')) return
    deleteRisk.mutate({ id: risk.id, projectId: risk.projectId }, { onSuccess: onClose })
  }

  const isPending = createRisk.isPending || updateRisk.isPending

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={cn('fixed inset-0 bg-black/30 z-40 transition-opacity', open ? 'opacity-100' : 'opacity-0 pointer-events-none')}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="risk-drawer-title"
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-background shadow-2xl flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 id="risk-drawer-title" className="font-semibold text-base">
            {risk ? `R-${String(risk.riskNumber).padStart(3, '0')} — ${risk.title}` : 'New Risk'}
          </h2>
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Identification */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identification</h3>

            <div className="space-y-1">
              <label className="text-sm font-medium">Title *</label>
              <input
                className={cn(
                  'w-full text-sm border rounded px-3 py-1.5 focus:outline-none focus:ring-1',
                  errors.title ? 'border-red-500 focus:ring-red-500' : 'focus:ring-ring',
                )}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (errors.title) setErrors((p) => ({ ...p, title: undefined }))
                }}
                disabled={!canEdit}
              />
              {errors.title && (
                <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <textarea
                rows={2}
                className="w-full text-sm border rounded px-3 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Category</label>
                <select
                  className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={!canEdit}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Date Identified</label>
                <input
                  type="date"
                  className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                  value={dateIdentified}
                  onChange={(e) => setDateIdentified(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </section>

          {/* Assessment */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assessment</h3>

            <div className="space-y-1">
              <label className="text-sm font-medium">Probability (1–5)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={cn(
                      'flex-1 py-1.5 text-sm rounded border transition-colors',
                      probability === v ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
                    )}
                    onClick={() => canEdit && setProbability(v)}
                    disabled={!canEdit}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Impact (1–5)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={cn(
                      'flex-1 py-1.5 text-sm rounded border transition-colors',
                      impact === v ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
                    )}
                    onClick={() => canEdit && setImpact(v)}
                    disabled={!canEdit}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className={cn('rounded px-3 py-2 text-sm font-medium inline-flex items-center gap-2', bandCls)}>
              Score: {score} —
              <span className="capitalize">{band}</span>
            </div>
          </section>

          {/* Response */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Response</h3>

            <div className="space-y-1">
              <label className="text-sm font-medium">Strategy</label>
              <div className="flex gap-2 flex-wrap">
                {STRATEGIES.map((s) => (
                  <label key={s} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="strategy"
                      value={s}
                      checked={strategy === s}
                      onChange={() => canEdit && setStrategy(s)}
                      disabled={!canEdit}
                    />
                    <span className="capitalize">{s}</span>
                  </label>
                ))}
                <label className="flex items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="strategy"
                    value=""
                    checked={strategy === ''}
                    onChange={() => canEdit && setStrategy('')}
                    disabled={!canEdit}
                  />
                  None
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Mitigation Actions</label>
              <textarea
                rows={2}
                className="w-full text-sm border rounded px-3 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                value={mitigation}
                onChange={(e) => setMitigation(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Contingency Plan</label>
              <textarea
                rows={2}
                className="w-full text-sm border rounded px-3 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                value={contingency}
                onChange={(e) => setContingency(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Trigger Indicators</label>
              <input
                className="w-full text-sm border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                value={triggers}
                onChange={(e) => setTriggers(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </section>

          {/* Tracking */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tracking</h3>

            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <select
                className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                value={status}
                onChange={(e) => canEdit && setStatus(e.target.value as RiskStatus)}
                disabled={!canEdit}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Last Reviewed</label>
                <input
                  type="date"
                  className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                  value={dateLastReviewed}
                  onChange={(e) => setDateLastReviewed(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Next Review</label>
                <input
                  type="date"
                  className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                  value={nextReviewDate}
                  onChange={(e) => setNextReviewDate(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </section>
        </form>

        {/* API error banner */}
        {errors.api && (
          <p className="text-xs text-red-600 px-5 py-2 bg-red-50 border-t border-red-200">
            {errors.api}
          </p>
        )}

        {/* Footer */}
        {canEdit && (
          <div className="flex items-center justify-between px-5 py-4 border-t gap-2">
            {risk ? (
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteRisk.isPending}>
                Delete
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={(e) => { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent) }} disabled={isPending}>
                {risk ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
