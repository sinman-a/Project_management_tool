import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useRisks, useRiskHeatmap } from '@/hooks/useRisks'
import { RiskHeatmap } from './RiskHeatmap'
import { RiskList } from './RiskList'
import { RiskDrawer } from './RiskDrawer'
import type { Risk } from '@/types'

type View = 'heatmap' | 'list'

interface Props {
  projectId?: string
  programId?: string
  canEdit?: boolean
}

export function RiskRegister({ projectId, programId, canEdit = false }: Props) {
  const [view, setView] = useState<View>('list')
  const [selectedP, setSelectedP] = useState<number | undefined>()
  const [selectedI, setSelectedI] = useState<number | undefined>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [bandFilter, setBandFilter] = useState<string>('')

  const { data: risks = [], isLoading } = useRisks({
    projectId,
    programId,
    status: statusFilter || undefined,
    scoreBand: bandFilter || undefined,
  })

  const { data: heatmapData } = useRiskHeatmap(projectId)

  const filteredRisks = selectedP && selectedI
    ? risks.filter((r) => r.probability === selectedP && r.impact === selectedI)
    : risks

  function openNew() {
    setEditingRisk(null)
    setDrawerOpen(true)
  }

  function openEdit(risk: Risk) {
    setEditingRisk(risk)
    setDrawerOpen(true)
  }

  function handleHeatmapSelect(p: number, i: number) {
    if (selectedP === p && selectedI === i) {
      setSelectedP(undefined)
      setSelectedI(undefined)
    } else {
      setSelectedP(p)
      setSelectedI(i)
      setView('list')
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded border overflow-hidden">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm transition-colors ${view === 'heatmap' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => setView('heatmap')}
            >
              Heatmap
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => setView('list')}
            >
              List
            </button>
          </div>

          <select
            className="text-sm border rounded px-2 py-1.5"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {['identified', 'analyzing', 'mitigating', 'closed', 'accepted', 'occurred'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            className="text-sm border rounded px-2 py-1.5"
            value={bandFilter}
            onChange={(e) => setBandFilter(e.target.value)}
          >
            <option value="">All bands</option>
            {['low', 'medium', 'high', 'critical'].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {(selectedP || bandFilter || statusFilter) && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => { setSelectedP(undefined); setSelectedI(undefined); setStatusFilter(''); setBandFilter('') }}
            >
              Clear filters
            </button>
          )}
        </div>

        {canEdit && (
          <Button size="sm" onClick={openNew}>
            <Plus className="w-3 h-3 mr-1" />
            Add Risk
          </Button>
        )}
      </div>

      {/* Content */}
      {view === 'heatmap' && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-shrink-0">
            <RiskHeatmap
              cells={heatmapData?.cells ?? []}
              selectedP={selectedP}
              selectedI={selectedI}
              onSelect={handleHeatmapSelect}
            />
          </div>
          {(selectedP !== undefined && selectedI !== undefined) && (
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-2">
                P{selectedP}×I{selectedI} — {filteredRisks.length} risk{filteredRisks.length !== 1 ? 's' : ''}
              </p>
              <RiskList risks={filteredRisks} canEdit={canEdit} onEdit={openEdit} />
            </div>
          )}
        </div>
      )}

      {view === 'list' && (
        isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <RiskList
                risks={filteredRisks}
                canEdit={canEdit}
                onEdit={openEdit}
              />
            </CardContent>
          </Card>
        )
      )}

      <RiskDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        projectId={projectId}
        programId={programId}
        risk={editingRisk}
        canEdit={canEdit}
      />
    </div>
  )
}
