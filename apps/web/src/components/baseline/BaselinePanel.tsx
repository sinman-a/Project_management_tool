import { useState } from 'react'
import { Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjectBaselines, useLockBaseline } from '@/hooks/useBaselines'
import { formatDate } from '@/lib/utils'
import type { Baseline } from '@/types'

interface Props {
  projectId: string
  canEdit: boolean
}

function BaselineRow({ baseline }: { baseline: Baseline }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Lock className={`w-4 h-4 ${baseline.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{baseline.name}</p>
            {baseline.isActive && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Active</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Locked {formatDate(baseline.lockedAt)} by {baseline.lockedByName ?? 'Unknown'}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          Budget: {baseline.totalBudget.toLocaleString()}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t bg-muted/30 grid grid-cols-3 gap-4 text-sm">
          <div><p className="text-xs text-muted-foreground">CAPEX</p><p>{baseline.totalCapex.toLocaleString()}</p></div>
          <div><p className="text-xs text-muted-foreground">OPEX</p><p>{baseline.totalOpex.toLocaleString()}</p></div>
          <div><p className="text-xs text-muted-foreground">Notes</p><p>{baseline.notes ?? '—'}</p></div>
          {baseline.plannedStart && (
            <div><p className="text-xs text-muted-foreground">Planned Start</p><p>{baseline.plannedStart}</p></div>
          )}
          {baseline.plannedFinish && (
            <div><p className="text-xs text-muted-foreground">Planned Finish</p><p>{baseline.plannedFinish}</p></div>
          )}
        </div>
      )}
    </div>
  )
}

export function BaselinePanel({ projectId, canEdit }: Props) {
  const { data: baselines = [], isLoading } = useProjectBaselines(projectId)
  const lockBaseline = useLockBaseline()
  const [showLockModal, setShowLockModal] = useState(false)
  const [lockName, setLockName] = useState('')
  const [lockNotes, setLockNotes] = useState('')

  function handleLock() {
    lockBaseline.mutate(
      { projectId, name: lockName || undefined, notes: lockNotes || undefined },
      { onSuccess: () => { setShowLockModal(false); setLockName(''); setLockNotes('') } },
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          <Lock className="inline-block w-4 h-4 mr-2 text-primary" />
          Baselines
        </CardTitle>
        {canEdit && (
          <Button size="sm" onClick={() => setShowLockModal(true)}>
            <Lock className="w-3 h-3 mr-1" /> Lock Baseline
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {showLockModal && (
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <h4 className="text-sm font-medium">Lock New Baseline</h4>
            <div className="space-y-1">
              <label className="text-xs font-medium">Name (optional)</label>
              <input
                className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={`Baseline ${baselines.length + 1}`}
                value={lockName}
                onChange={(e) => setLockName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Notes (optional)</label>
              <textarea
                rows={2}
                className="w-full text-sm border rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                value={lockNotes}
                onChange={(e) => setLockNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={lockBaseline.isPending} onClick={handleLock}>
                {lockBaseline.isPending ? 'Locking…' : 'Lock'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowLockModal(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : baselines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No baselines yet. Lock a baseline to start tracking variance.</p>
        ) : (
          baselines.map((b) => <BaselineRow key={b.id} baseline={b} />)
        )}
      </CardContent>
    </Card>
  )
}
