import { useState } from 'react'
import { Plus, Check, Play, Trash2, GitBranch } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useBudgetVersions, useBudgetVariance, useCreateBudgetVersion,
  useApproveBudgetVersion, useActivateBudgetVersion, useDeleteBudgetVersion,
} from '@/hooks/useBudgetVersions'
import type { BudgetVersionStatus } from '@/types'

const STATUS_CLS: Record<BudgetVersionStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-400',
}

interface Props {
  projectId: string
  canEdit: boolean
}

export function BudgetVersionsPanel({ projectId, canEdit }: Props) {
  const { data: versions = [], isLoading } = useBudgetVersions(projectId)
  const { data: variance } = useBudgetVariance(projectId)
  const createVersion = useCreateBudgetVersion()
  const approveVersion = useApproveBudgetVersion()
  const activateVersion = useActivateBudgetVersion()
  const deleteVersion = useDeleteBudgetVersion()

  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [gate, setGate] = useState('')
  const [capex, setCapex] = useState('')
  const [opex, setOpex] = useState('')

  const active = versions.find((v) => v.status === 'active')

  function handleCreate() {
    if (!label.trim()) return
    createVersion.mutate(
      { projectId, label: label.trim(), gate: gate.trim() || undefined, capex: parseFloat(capex) || 0, opex: parseFloat(opex) || 0 },
      { onSuccess: () => { setShowForm(false); setLabel(''); setGate(''); setCapex(''); setOpex('') } },
    )
  }

  function openForm() {
    // prefill from active version
    setCapex(active ? String(active.capex) : '')
    setOpex(active ? String(active.opex) : '')
    setLabel(''); setGate('')
    setShowForm(true)
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          <GitBranch className="inline-block w-4 h-4 mr-2 text-primary" /> Budget Versions (stage-gate)
        </CardTitle>
        {canEdit && !showForm && (
          <Button size="sm" onClick={openForm}><Plus className="w-3 h-3 mr-1" /> New Version</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Variance summary */}
        {variance?.active && variance?.reference && variance.active.id !== variance.reference.id && (
          <div className="text-sm border rounded-lg px-3 py-2 bg-muted/30">
            <span className="font-medium">Variance</span> vs reference “{variance.reference.label}”:
            <span className={cn('ml-2 font-mono', variance.deltaTotal > 0 ? 'text-red-600' : 'text-green-600')}>
              {variance.deltaTotal > 0 ? '+' : ''}{formatCurrency(variance.deltaTotal)}
              {variance.pctChange != null && ` (${variance.pctChange > 0 ? '+' : ''}${variance.pctChange.toFixed(0)}%)`}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              ΔCapEx {formatCurrency(variance.deltaCapex)} · ΔOpEx {formatCurrency(variance.deltaOpex)}
            </span>
          </div>
        )}

        {/* New version form */}
        {showForm && (
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Label *</label>
                <input className="input-field mt-0.5" placeholder="e.g. Gate 1" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium">Gate (optional)</label>
                <input className="input-field mt-0.5" placeholder="e.g. G1" value={gate} onChange={(e) => setGate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">CAPEX ($)</label>
                <input type="number" min="0" step="1000" className="input-field mt-0.5" value={capex} onChange={(e) => setCapex(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">OPEX ($)</label>
                <input type="number" min="0" step="1000" className="input-field mt-0.5" value={opex} onChange={(e) => setOpex(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" disabled={!label.trim() || createVersion.isPending} onClick={handleCreate}>
                {createVersion.isPending ? 'Creating…' : 'Create draft'}
              </Button>
            </div>
          </div>
        )}

        {/* Versions table */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No budget versions yet. Create one to manage stage-gate budgets.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left py-2 font-medium">Version</th>
                <th className="text-right py-2 font-medium">CapEx</th>
                <th className="text-right py-2 font-medium">OpEx</th>
                <th className="text-right py-2 font-medium">Total</th>
                <th className="text-center py-2 font-medium">Status</th>
                {canEdit && <th className="text-right py-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="py-2">
                    <span className="font-medium">{v.label}</span>
                    {v.gate && <span className="text-xs text-muted-foreground ml-1.5">· {v.gate}</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(v.capex)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(v.opex)}</td>
                  <td className="py-2 text-right tabular-nums font-medium">{formatCurrency(v.capex + v.opex)}</td>
                  <td className="py-2 text-center">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', STATUS_CLS[v.status])}>{v.status}</span>
                  </td>
                  {canEdit && (
                    <td className="py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        {v.status === 'draft' && (
                          <button type="button" aria-label="Approve" title="Approve" className="text-blue-600 hover:text-blue-700"
                            onClick={() => approveVersion.mutate({ id: v.id, projectId })}>
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {v.status !== 'active' && (
                          <button type="button" aria-label="Activate" title="Activate (sets project budget)" className="text-green-600 hover:text-green-700"
                            onClick={() => activateVersion.mutate({ id: v.id, projectId })}>
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {(v.status === 'draft' || v.status === 'archived') && (
                          <button type="button" aria-label="Delete" title="Delete" className="text-muted-foreground hover:text-destructive"
                            onClick={() => { if (confirm(`Delete version "${v.label}"?`)) deleteVersion.mutate({ id: v.id, projectId }) }}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
