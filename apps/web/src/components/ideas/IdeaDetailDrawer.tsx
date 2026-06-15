import { useState, useEffect } from 'react'
import { X, CheckCircle, XCircle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CommentThread } from '@/components/collaboration/CommentThread'
import { IdeaStrategicValue } from '@/components/ideas/IdeaStrategicValue'
import { useIdea, useApproveIdea, useRejectIdea, useConvertIdea, useUpdateIdea, useTransitionIdea } from '@/hooks/useIdeas'
import { usePrograms } from '@/hooks/useProjects'
import { useUsers } from '@/hooks/useUsers'
import { useAuthStore } from '@/stores/authStore'
import { useDialog } from '@/hooks/useDialog'
import { useNavigate } from 'react-router-dom'

interface Props {
  ideaId: string | null
  onClose: () => void
}

export function IdeaDetailDrawer({ ideaId, onClose }: Props) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { data: idea, isLoading } = useIdea(ideaId ?? undefined)
  const approveIdea = useApproveIdea()
  const rejectIdea = useRejectIdea()
  const convertIdea = useConvertIdea()
  const updateIdea = useUpdateIdea()
  const transitionIdea = useTransitionIdea()

  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [convertProgramId, setConvertProgramId] = useState('')
  const [convertManagerId, setConvertManagerId] = useState('')
  const [convertMethodology, setConvertMethodology] = useState('hybrid')
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const { data: programs = [] } = usePrograms()
  const { data: users = [] } = useUsers()
  const managers = users.filter((u) => ['admin', 'program_manager', 'project_manager', 'pmo_lead'].includes(u.role))

  // Local RICE edit buffer (string inputs); synced when the idea loads.
  const [rice, setRice] = useState({ reach: '', impact: '', confidence: '', effort: '' })
  useEffect(() => {
    if (idea) {
      setRice({
        reach: idea.reach != null ? String(idea.reach) : '',
        impact: idea.impact != null ? String(idea.impact) : '',
        confidence: idea.confidence != null ? String(idea.confidence) : '',
        effort: idea.effort != null ? String(idea.effort) : '',
      })
    }
  }, [idea])

  // Only the drawer handles Escape while the nested convert modal is closed.
  const drawerRef = useDialog(!!ideaId && !showConvertModal, onClose)
  const convertRef = useDialog(showConvertModal, () => setShowConvertModal(false))

  const canDecide = user?.role === 'admin' || user?.role === 'pmo_lead' || user?.role === 'program_manager'
  const canEditIdea = canDecide || user?.role === 'project_manager' || idea?.submitterId === user?.id
  const isApproved = idea?.status === 'approved'
  const isFrozen = idea?.status === 'converted_to_project'

  const TRANSITION_STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'on_hold'] as const

  function saveRice() {
    if (!idea) return
    updateIdea.mutate({
      id: idea.id,
      reach: rice.reach === '' ? null : Number(rice.reach),
      impact: rice.impact === '' ? null : Number(rice.impact),
      confidence: rice.confidence === '' ? null : Number(rice.confidence),
      effort: rice.effort === '' ? null : Number(rice.effort),
    })
  }

  const riceDirty = idea != null && (
    rice.reach !== (idea.reach != null ? String(idea.reach) : '') ||
    rice.impact !== (idea.impact != null ? String(idea.impact) : '') ||
    rice.confidence !== (idea.confidence != null ? String(idea.confidence) : '') ||
    rice.effort !== (idea.effort != null ? String(idea.effort) : '')
  )

  if (!ideaId) return null

  return (
    <>
      <div
        aria-hidden="true"
        className={cn('fixed inset-0 bg-black/30 z-40 transition-opacity', ideaId ? 'opacity-100' : 'opacity-0 pointer-events-none')}
        onClick={onClose}
      />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="idea-drawer-title"
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full sm:w-[560px] bg-background shadow-2xl flex flex-col transition-transform duration-300',
          ideaId ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 id="idea-drawer-title" className="font-semibold text-base">Idea Detail</h2>
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : !idea ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Not found</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{idea.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted by {idea.submitterName} · {new Date(idea.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {idea.riceScore > 0 && (
                  <div className="text-right">
                    <p className="text-2xl font-mono font-bold text-primary">{idea.riceScore.toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">RICE Score</p>
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {canDecide && !isFrozen ? (
                  <select
                    aria-label="Idea status"
                    className="text-xs border rounded px-2 py-1 bg-background font-medium capitalize"
                    value={TRANSITION_STATUSES.includes(idea.status as typeof TRANSITION_STATUSES[number]) ? idea.status : 'draft'}
                    disabled={transitionIdea.isPending}
                    onChange={(e) => transitionIdea.mutate({ id: idea.id, toStatus: e.target.value })}
                  >
                    {TRANSITION_STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                ) : (
                  <span className={cn(
                    'text-xs px-2 py-1 rounded font-medium',
                    idea.status === 'approved' ? 'bg-green-100 text-green-700'
                    : idea.status === 'rejected' ? 'bg-red-100 text-red-700'
                    : idea.status === 'converted_to_project' ? 'bg-teal-100 text-teal-700'
                    : 'bg-blue-100 text-blue-700',
                  )}>
                    {idea.status.replace(/_/g, ' ')}
                  </span>
                )}
                {isFrozen && idea.convertedProjectId && (
                  <button
                    className="ml-2 text-xs text-primary hover:underline"
                    onClick={() => { navigate(`/projects/${idea.convertedProjectId}`); onClose() }}
                  >
                    Open project <ArrowRight className="w-3 h-3 inline" />
                  </button>
                )}
              </div>
            </div>

            {/* Problem & Solution */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Problem</h4>
              <p className="text-sm whitespace-pre-wrap">{idea.problemStatement}</p>
              {idea.proposedSolution && (
                <>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-3">Proposed Solution</h4>
                  <p className="text-sm whitespace-pre-wrap">{idea.proposedSolution}</p>
                </>
              )}
            </section>

            {/* RICE */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">RICE Scoring</h4>
                {canEditIdea && !isFrozen && riceDirty && (
                  <Button size="sm" className="h-6 text-xs px-2" disabled={updateIdea.isPending} onClick={saveRice}>
                    {updateIdea.isPending ? 'Saving…' : 'Save RICE'}
                  </Button>
                )}
              </div>
              {canEditIdea && !isFrozen ? (
                <div className="grid grid-cols-4 gap-2">
                  {([
                    ['reach', 'Reach', 1, 9, 1],
                    ['impact', 'Impact', 1, 9, 1],
                    ['confidence', 'Confidence', 0.1, 1, 0.1],
                    ['effort', 'Effort', 1, 10, 1],
                  ] as const).map(([field, label, min, max, step]) => (
                    <div key={field} className="border rounded p-2 text-center">
                      <label className="text-xs text-muted-foreground">{label}</label>
                      <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        className="w-full text-center text-lg font-bold bg-transparent focus:outline-none"
                        value={rice[field]}
                        onChange={(e) => setRice((r) => ({ ...r, [field]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {(['reach', 'impact', 'confidence', 'effort'] as const).map((field) => (
                    <div key={field} className="border rounded p-2 text-center">
                      <p className="text-xs text-muted-foreground capitalize">{field}</p>
                      <p className="text-lg font-bold">{idea[field] ?? '—'}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                RICE = (Reach × Impact × Confidence) ÷ Effort{idea.riceScore > 0 && ` · current ${idea.riceScore.toFixed(1)}`}
              </p>
            </section>

            {/* Strategic Value — P-score */}
            <IdeaStrategicValue
              ideaId={idea.id}
              estimatedCostEur={idea.estimatedCostEur}
              initialRiskScore={idea.riskScore}
              initialDriverScores={idea.driverScores ?? {}}
              canEdit={canDecide || idea.submitterId === user?.id}
            />

            {/* Financials */}
            {(idea.expectedValueEur != null || idea.estimatedCostEur != null) && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financials</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {idea.expectedValueEur != null && (
                    <div><p className="text-xs text-muted-foreground">Expected Value</p><p className="font-medium">€{idea.expectedValueEur.toLocaleString()}</p></div>
                  )}
                  {idea.estimatedCostEur != null && (
                    <div><p className="text-xs text-muted-foreground">Estimated Cost</p><p className="font-medium">€{idea.estimatedCostEur.toLocaleString()}</p></div>
                  )}
                </div>
              </section>
            )}

            {/* Themes */}
            {idea.themes && idea.themes.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Themes</h4>
                <div className="flex flex-wrap gap-1.5">
                  {idea.themes.map((t) => (
                    <span key={t.id} className="text-xs px-2 py-1 rounded-full border font-medium"
                      style={t.colour ? { borderColor: t.colour, color: t.colour } : {}}>
                      {t.name}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Approval history */}
            {idea.approvals && idea.approvals.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approval History</h4>
                <div className="space-y-2">
                  {idea.approvals.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 text-sm">
                      {a.decision === 'approve' ? <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5" />}
                      <div>
                        <p className="font-medium">{a.approverName} — <span className="capitalize">{a.decision}</span></p>
                        {a.comments && <p className="text-xs text-muted-foreground">{a.comments}</p>}
                        <p className="text-xs text-muted-foreground">{new Date(a.decidedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Decision notes */}
            {idea.decisionNotes && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision Notes</h4>
                <p className="text-sm">{idea.decisionNotes}</p>
              </section>
            )}

            {/* Comments */}
            <section>
              <CommentThread entityType="idea" entityId={idea.id} />
            </section>
          </div>
        )}

        {/* Footer actions */}
        {idea && !isFrozen && canDecide && (
          <div className="border-t px-5 py-4 space-y-3">
            {showRejectForm ? (
              <div className="space-y-2">
                <label className="text-xs font-medium">Reason for rejection (shared as decision notes)</label>
                <textarea
                  rows={3}
                  autoFocus
                  className="input-field resize-none text-sm"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Why is this idea being rejected? e.g. out of scope, low ROI, duplicate…"
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => { setShowRejectForm(false); setRejectReason('') }}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!rejectReason.trim() || rejectIdea.isPending}
                    onClick={() => rejectIdea.mutate(
                      { id: idea.id, notes: rejectReason.trim() },
                      { onSuccess: onClose },
                    )}
                  >
                    {rejectIdea.isPending ? 'Rejecting…' : 'Confirm Reject'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 items-center">
                {idea.status !== 'approved' && idea.status !== 'rejected' && (
                  <>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={approveIdea.isPending}
                      onClick={() => approveIdea.mutate({ id: idea.id }, { onSuccess: onClose })}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setShowRejectForm(true)}
                    >
                      <XCircle className="w-3 h-3 mr-1" /> Reject
                    </Button>
                  </>
                )}
                {isApproved && (
                  <Button size="sm" variant="outline" onClick={() => setShowConvertModal(true)}>
                    <ArrowRight className="w-3 h-3 mr-1" /> Convert to Project
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Convert modal */}
      {showConvertModal && idea && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div
            ref={convertRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="convert-modal-title"
            className="bg-background rounded-lg shadow-2xl p-6 w-full max-w-sm space-y-4"
          >
            <h3 id="convert-modal-title" className="font-semibold">Convert to Project</h3>
            <p className="text-sm text-muted-foreground">Creates a new project from this idea and links it to a programme/portfolio.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium">Programme (sets portfolio)</label>
                <select className="w-full text-sm border rounded px-2 py-1.5" value={convertProgramId} onChange={(e) => setConvertProgramId(e.target.value)}>
                  <option value="">— Standalone (no programme) —</option>
                  {programs.filter((p) => p.status !== 'closed').map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Project Manager</label>
                <select className="w-full text-sm border rounded px-2 py-1.5" value={convertManagerId} onChange={(e) => setConvertManagerId(e.target.value)}>
                  <option value="">— Me —</option>
                  {managers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Methodology</label>
                <select className="w-full text-sm border rounded px-2 py-1.5" value={convertMethodology} onChange={(e) => setConvertMethodology(e.target.value)}>
                  {['waterfall', 'agile', 'hybrid'].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium">Start Date *</label>
                <input type="date" className="w-full text-sm border rounded px-2 py-1.5" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowConvertModal(false)}>Cancel</Button>
              <Button size="sm" disabled={!startDate || convertIdea.isPending} onClick={() => {
                convertIdea.mutate(
                  {
                    id: idea.id,
                    startDate,
                    programId: convertProgramId || undefined,
                    managerId: convertManagerId || undefined,
                    methodology: convertMethodology,
                  },
                  {
                    onSuccess: (data) => {
                      setShowConvertModal(false)
                      onClose()
                      navigate(`/projects/${data.projectId}`)
                    },
                  },
                )
              }}>
                {convertIdea.isPending ? 'Converting…' : 'Convert'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
