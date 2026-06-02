import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Pencil, Check, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  useProjectCostEstimations,
  useCostEstimation,
  useCreateCostEstimation,
  useDeleteCostEstimation,
  useUpdateCostEstimation,
  useAddGrade,
  useUpdateGrade,
  useDeleteGrade,
  useAddRow,
  useUpdateRow,
  useDeleteRow,
  useUpsertCell,
} from '@/hooks/useCostEstimations'
import type { CostEstimation, CostEstimationGrade, CostEstimationRow } from '@/types'

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', UAH: '₴',
}

function fmt(currency: string, amount: number): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency
  if (amount === 0) return '—'
  if (amount >= 1000000) return `${sym}${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `${sym}${(amount / 1000).toFixed(1)}k`
  return `${sym}${amount.toFixed(0)}`
}

// ─── Cell input ─────────────────────────────────────────────────────────────

function CellInput({
  value, rowId, gradeId, estimationId, canEdit,
}: {
  value: number; rowId: string; gradeId: string; estimationId: string; canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value || ''))
  const upsert = useUpsertCell()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commit() {
    const days = parseFloat(draft) || 0
    if (days !== value) {
      upsert.mutate({ rowId, gradeId, days, estimationId })
    }
    setEditing(false)
  }

  if (!canEdit) {
    return (
      <td className="border border-border/50 text-center px-2 py-1 text-sm tabular-nums w-16">
        {value > 0 ? value : <span className="text-muted-foreground/40">—</span>}
      </td>
    )
  }

  return (
    <td
      className={cn(
        'border border-border/50 text-center px-1 py-0.5 w-16 cursor-pointer',
        editing ? 'bg-primary/5' : 'hover:bg-muted/50',
      )}
      onClick={() => { setDraft(String(value || '')); setEditing(true) }}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.5"
          className="w-full text-center text-sm bg-transparent focus:outline-none tabular-nums"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <span className="text-sm tabular-nums">
          {value > 0 ? value : <span className="text-muted-foreground/30">—</span>}
        </span>
      )}
    </td>
  )
}

// ─── Row component ───────────────────────────────────────────────────────────

function MatrixRow({
  row, grades, estimationId, canEdit, isNewStage,
}: {
  row: CostEstimationRow
  grades: CostEstimationGrade[]
  estimationId: string
  canEdit: boolean
  isNewStage: boolean
}) {
  const [editingStage, setEditingStage] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [stageDraft, setStageDraft] = useState(row.stage)
  const [descDraft, setDescDraft] = useState(row.workDescription)
  const updateRow = useUpdateRow()
  const deleteRow = useDeleteRow()

  function saveStage() {
    if (stageDraft !== row.stage) updateRow.mutate({ id: row.id, estimationId, stage: stageDraft })
    setEditingStage(false)
  }

  function saveDesc() {
    if (descDraft !== row.workDescription) updateRow.mutate({ id: row.id, estimationId, workDescription: descDraft })
    setEditingDesc(false)
  }

  const rowTotal = grades.reduce((s, g) => s + (row.cells[g.id] ?? 0), 0)

  return (
    <tr className={cn('group', isNewStage && 'border-t-2 border-t-primary/20')}>
      {/* Stage */}
      <td className="border border-border/50 px-2 py-1 min-w-[120px] max-w-[150px]">
        {editingStage ? (
          <input
            autoFocus
            className="w-full text-sm bg-transparent focus:outline-none"
            value={stageDraft}
            onChange={(e) => setStageDraft(e.target.value)}
            onBlur={saveStage}
            onKeyDown={(e) => { if (e.key === 'Enter') saveStage(); if (e.key === 'Escape') setEditingStage(false) }}
          />
        ) : (
          <span
            className={cn('text-sm font-medium cursor-pointer', canEdit && 'hover:text-primary')}
            onClick={() => canEdit && setEditingStage(true)}
          >
            {row.stage || <span className="text-muted-foreground italic">Stage</span>}
          </span>
        )}
      </td>

      {/* Work description */}
      <td className="border border-border/50 px-2 py-1 min-w-[200px]">
        {editingDesc ? (
          <input
            autoFocus
            className="w-full text-sm bg-transparent focus:outline-none"
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={saveDesc}
            onKeyDown={(e) => { if (e.key === 'Enter') saveDesc(); if (e.key === 'Escape') setEditingDesc(false) }}
          />
        ) : (
          <span
            className={cn('text-sm cursor-pointer', canEdit && 'hover:text-primary')}
            onClick={() => canEdit && setEditingDesc(true)}
          >
            {row.workDescription || <span className="text-muted-foreground italic">Description…</span>}
          </span>
        )}
      </td>

      {/* Grade cells */}
      {grades.map((g) => (
        <CellInput
          key={g.id}
          value={row.cells[g.id] ?? 0}
          rowId={row.id}
          gradeId={g.id}
          estimationId={estimationId}
          canEdit={canEdit}
        />
      ))}

      {/* Row total */}
      <td className="border border-border/50 text-center px-2 py-1 font-medium text-sm tabular-nums bg-muted/20 w-16">
        {rowTotal > 0 ? rowTotal : <span className="text-muted-foreground/40">—</span>}
      </td>

      {/* Delete button */}
      {canEdit && (
        <td className="border-0 pl-1 w-6">
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
            onClick={() => {
              if (confirm('Delete this row?')) deleteRow.mutate({ id: row.id, estimationId })
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      )}
    </tr>
  )
}

// ─── Add Grade form ──────────────────────────────────────────────────────────

function AddGradeForm({ estimationId, onDone }: { estimationId: string; onDone: () => void }) {
  const addGrade = useAddGrade()
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [costType, setCostType] = useState<'capex' | 'opex'>('capex')

  function handleAdd() {
    if (!name.trim()) return
    addGrade.mutate(
      { estimationId, name: name.trim(), ratePerDay: parseFloat(rate) || 0, costType },
      { onSuccess: onDone },
    )
  }

  return (
    <th className="border border-primary/40 bg-primary/5 p-1 w-36 align-top">
      <div className="space-y-1">
        <input
          autoFocus
          className="w-full text-xs border rounded px-1.5 py-1 bg-background"
          placeholder="Grade name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onDone() }}
        />
        <input
          type="number"
          min="0"
          className="w-full text-xs border rounded px-1.5 py-1 bg-background"
          placeholder="Rate/day"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
        <select
          className="w-full text-xs border rounded px-1.5 py-1 bg-background"
          value={costType}
          onChange={(e) => setCostType(e.target.value as 'capex' | 'opex')}
        >
          <option value="capex">CAPEX</option>
          <option value="opex">OPEX</option>
        </select>
        <div className="flex gap-1">
          <button type="button" className="flex-1 text-xs bg-primary text-primary-foreground rounded py-0.5 hover:bg-primary/90" onClick={handleAdd}>
            <Check className="w-3 h-3 mx-auto" />
          </button>
          <button type="button" className="flex-1 text-xs border rounded py-0.5 hover:bg-muted" onClick={onDone}>
            <X className="w-3 h-3 mx-auto" />
          </button>
        </div>
      </div>
    </th>
  )
}

// ─── Grade header cell ───────────────────────────────────────────────────────

function GradeHeader({
  grade, estimationId, currency, canEdit,
}: {
  grade: CostEstimationGrade; estimationId: string; currency: string; canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(grade.name)
  const [rateDraft, setRateDraft] = useState(String(grade.ratePerDay))
  const [costTypeDraft, setCostTypeDraft] = useState<'capex' | 'opex'>(grade.costType)
  const updateGrade = useUpdateGrade()
  const deleteGrade = useDeleteGrade()
  const sym = CURRENCY_SYMBOLS[currency] ?? currency

  function save() {
    updateGrade.mutate({
      id: grade.id, estimationId,
      name: nameDraft.trim() || grade.name,
      ratePerDay: parseFloat(rateDraft) || 0,
      costType: costTypeDraft,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <th className="border border-primary/40 bg-primary/5 p-1 w-32 align-top">
        <div className="space-y-1">
          <input className="w-full text-xs border rounded px-1.5 py-1 bg-background" value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)} autoFocus />
          <input type="number" min="0" className="w-full text-xs border rounded px-1.5 py-1 bg-background"
            value={rateDraft} onChange={(e) => setRateDraft(e.target.value)} />
          <select className="w-full text-xs border rounded px-1.5 py-1 bg-background"
            value={costTypeDraft} onChange={(e) => setCostTypeDraft(e.target.value as 'capex' | 'opex')}>
            <option value="capex">CAPEX</option>
            <option value="opex">OPEX</option>
          </select>
          <div className="flex gap-1">
            <button type="button" className="flex-1 text-xs bg-primary text-primary-foreground rounded py-0.5" onClick={save}>
              <Check className="w-3 h-3 mx-auto" />
            </button>
            <button type="button" className="flex-1 text-xs border rounded py-0.5 hover:bg-muted"
              onClick={() => setEditing(false)}>
              <X className="w-3 h-3 mx-auto" />
            </button>
          </div>
        </div>
      </th>
    )
  }

  return (
    <th className="border border-border/50 text-center p-1 w-16 group relative">
      <div className="text-xs font-semibold truncate" title={grade.name}>{grade.name}</div>
      <div className="text-[10px] text-muted-foreground">{sym}{grade.ratePerDay}/d</div>
      <div className={cn(
        'text-[9px] font-bold uppercase px-1 py-0.5 rounded inline-block mt-0.5',
        grade.costType === 'capex' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700',
      )}>
        {grade.costType}
      </div>
      {canEdit && (
        <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setEditing(true)}>
            <Pencil className="w-2.5 h-2.5" />
          </button>
          <button type="button" className="text-muted-foreground hover:text-destructive"
            onClick={() => { if (confirm(`Delete grade "${grade.name}"?`)) deleteGrade.mutate({ id: grade.id, estimationId }) }}>
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      )}
    </th>
  )
}

// ─── Main matrix component ───────────────────────────────────────────────────

interface MatrixProps {
  estimation: CostEstimation
  canEdit: boolean
}

function EstimationMatrix({ estimation, canEdit }: MatrixProps) {
  const [showAddGrade, setShowAddGrade] = useState(false)
  const addRow = useAddRow()
  const { grades, rows, summary, currency } = estimation

  // Build set of unique stages to detect new-stage boundaries
  const stageAtRow = rows.map((r) => r.stage)

  function handleAddRow() {
    const lastStage = rows[rows.length - 1]?.stage ?? ''
    addRow.mutate({ estimationId: estimation.id, stage: lastStage, workDescription: '' })
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm w-full min-w-max">
        <thead>
          <tr className="bg-muted/50">
            <th className="border border-border/50 text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide min-w-[120px]">
              Stage
            </th>
            <th className="border border-border/50 text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide min-w-[200px]">
              Work Description
            </th>
            {grades.map((g) => (
              <GradeHeader key={g.id} grade={g} estimationId={estimation.id} currency={currency} canEdit={canEdit} />
            ))}
            {showAddGrade && canEdit && (
              <AddGradeForm estimationId={estimation.id} onDone={() => setShowAddGrade(false)} />
            )}
            {!showAddGrade && canEdit && (
              <th className="border border-dashed border-primary/30 text-center p-1 w-10">
                <button type="button" className="text-primary hover:text-primary/70 transition-colors"
                  onClick={() => setShowAddGrade(true)} title="Add grade">
                  <Plus className="w-4 h-4" />
                </button>
              </th>
            )}
            <th className="border border-border/50 text-center px-2 py-2 font-semibold text-xs uppercase tracking-wide w-16 bg-muted/50">
              Total
            </th>
            {canEdit && <th className="w-6 border-0" />}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, idx) => (
            <MatrixRow
              key={row.id}
              row={row}
              grades={grades}
              estimationId={estimation.id}
              canEdit={canEdit}
              isNewStage={idx > 0 && row.stage !== stageAtRow[idx - 1]}
            />
          ))}

          {/* Add row */}
          {canEdit && (
            <tr>
              <td colSpan={grades.length + 3 + (canEdit ? 1 : 0)} className="border-t border-dashed border-border/50 pt-1">
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 px-2 py-1 transition-colors"
                  onClick={handleAddRow}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>
              </td>
            </tr>
          )}
        </tbody>

        {/* Footer: totals */}
        <tfoot>
          <tr className="bg-muted/40 font-medium border-t-2 border-border">
            <td className="border border-border/50 px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground" colSpan={2}>
              TOTAL days / grade
            </td>
            {grades.map((g) => {
              const gradeSum = summary.byGrade.find((s) => s.gradeId === g.id)
              return (
                <td key={g.id} className="border border-border/50 text-center px-2 py-1.5 font-bold tabular-nums">
                  {gradeSum?.totalDays ?? 0}
                </td>
              )
            })}
            {(showAddGrade || !canEdit) ? null : canEdit ? <td className="border-0" /> : null}
            <td className="border border-border/50 text-center px-2 py-1.5 font-bold tabular-nums bg-muted/50">
              {summary.totalDays}
            </td>
            {canEdit && <td className="border-0" />}
          </tr>
          <tr className="bg-muted/20">
            <td className="border border-border/50 px-2 py-1 text-xs text-muted-foreground" colSpan={2}>
              Rate / day
            </td>
            {grades.map((g) => {
              const sym = CURRENCY_SYMBOLS[currency] ?? currency
              return (
                <td key={g.id} className="border border-border/50 text-center px-2 py-1 text-xs text-muted-foreground tabular-nums">
                  {sym}{g.ratePerDay}
                </td>
              )
            })}
            {canEdit ? <td className="border-0" /> : null}
            <td className="border border-border/50 bg-muted/20" />
            {canEdit && <td className="border-0" />}
          </tr>
          <tr className="bg-muted/30">
            <td className="border border-border/50 px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground" colSpan={2}>
              Costed days (cost)
            </td>
            {grades.map((g) => {
              const gradeSum = summary.byGrade.find((s) => s.gradeId === g.id)
              return (
                <td key={g.id} className="border border-border/50 text-center px-2 py-1.5 text-xs font-medium tabular-nums">
                  <div className="font-bold">{gradeSum?.totalDays ?? 0}</div>
                  <div className="text-muted-foreground">{fmt(currency, gradeSum?.totalCost ?? 0)}</div>
                </td>
              )
            })}
            {canEdit ? <td className="border-0" /> : null}
            <td className="border border-border/50 text-center px-2 py-1.5 font-bold tabular-nums bg-muted/50">
              {fmt(currency, summary.grandTotal)}
            </td>
            {canEdit && <td className="border-0" />}
          </tr>
        </tfoot>
      </table>

      {/* Summary totals */}
      <div className="mt-4 flex flex-wrap gap-4 justify-end">
        <div className="flex items-center gap-3 text-sm border rounded-lg px-4 py-2 bg-blue-50/50">
          <span className="text-xs font-semibold uppercase text-blue-600">CAPEX</span>
          <span className="text-lg font-bold text-blue-700">{fmt(currency, summary.totalCapex)}</span>
        </div>
        <div className="flex items-center gap-3 text-sm border rounded-lg px-4 py-2 bg-purple-50/50">
          <span className="text-xs font-semibold uppercase text-purple-600">OPEX</span>
          <span className="text-lg font-bold text-purple-700">{fmt(currency, summary.totalOpex)}</span>
        </div>
        <div className="flex items-center gap-3 text-sm border rounded-lg px-4 py-2 bg-muted">
          <span className="text-xs font-semibold uppercase text-muted-foreground">TOTAL</span>
          <span className="text-lg font-bold">{fmt(currency, summary.grandTotal)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Estimation selector + toolbar ──────────────────────────────────────────

interface Props {
  projectId: string
  canEdit: boolean
}

export function CostEstimationMatrix({ projectId, canEdit }: Props) {
  const { data: list = [], isLoading: listLoading } = useProjectCostEstimations(projectId)
  const createEst = useCreateCostEstimation()
  const deleteEst = useDeleteCostEstimation()
  const updateEst = useUpdateCostEstimation()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  // Auto-select first estimation
  const activeId = selectedId ?? list[0]?.id ?? null

  const { data: estimation, isLoading } = useCostEstimation(activeId ?? undefined)

  function handleCreate() {
    const n = list.length + 1
    createEst.mutate(
      { projectId, name: `Estimation v${n}` },
      { onSuccess: (est) => setSelectedId(est.id) },
    )
  }

  function handleSaveName() {
    if (!activeId || !nameDraft.trim()) { setEditingName(false); return }
    updateEst.mutate({ id: activeId, projectId, name: nameDraft.trim() }, { onSuccess: () => setEditingName(false) })
  }

  if (listLoading) {
    return <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
  }

  if (list.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-muted-foreground text-sm">No cost estimations yet. Create one to start planning your budget.</p>
        {canEdit && (
          <Button size="sm" onClick={handleCreate} disabled={createEst.isPending}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            {createEst.isPending ? 'Creating…' : 'New Estimation'}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Selector */}
        <div className="relative">
          <select
            className="text-sm border rounded px-3 py-1.5 pr-8 bg-background appearance-none font-medium focus:outline-none focus:ring-1 focus:ring-ring"
            value={activeId ?? ''}
            onChange={(e) => setSelectedId(e.target.value || null)}
          >
            {list.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Edit name */}
        {canEdit && activeId && (
          editingName ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
              />
              <button type="button" className="text-primary" onClick={handleSaveName}><Check className="w-4 h-4" /></button>
              <button type="button" className="text-muted-foreground" onClick={() => setEditingName(false)}><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setNameDraft(list.find((e) => e.id === activeId)?.name ?? ''); setEditingName(true) }}
            >
              <Pencil className="w-3 h-3" /> Rename
            </button>
          )
        )}

        <div className="flex-1" />

        {/* Delete estimation */}
        {canEdit && activeId && list.length > 1 && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
            onClick={() => {
              if (confirm('Delete this estimation? This cannot be undone.')) {
                deleteEst.mutate({ id: activeId, projectId }, {
                  onSuccess: () => setSelectedId(list.find((e) => e.id !== activeId)?.id ?? null),
                })
              }
            }}
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        )}

        {canEdit && (
          <Button size="sm" variant="outline" onClick={handleCreate} disabled={createEst.isPending}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Estimation
          </Button>
        )}
      </div>

      {/* Matrix */}
      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Loading estimation…</CardContent></Card>
      ) : estimation ? (
        <Card>
          <CardContent className="p-4 overflow-auto">
            <EstimationMatrix estimation={estimation} canEdit={canEdit} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
