import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRiceItems, useCreateRiceItem, useUpdateRiceItem, useDeleteRiceItem } from '@/hooks/useRice'
import type { RiceItem } from '@/types'

const REACH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const IMPACT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const CONFIDENCE_OPTIONS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
const EFFORT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function scoreColor(score: number): string {
  if (score >= 20) return 'text-green-600 font-bold'
  if (score >= 10) return 'text-amber-600 font-semibold'
  return 'text-muted-foreground'
}

interface RowFormValues {
  milestone: string
  goal: string
  businessValue: string
  userStory: string
  reach: number
  impact: number
  confidence: number
  effort: number
}

const emptyForm = (): RowFormValues => ({
  milestone: '', goal: '', businessValue: '', userStory: '',
  reach: 5, impact: 5, confidence: 1.0, effort: 1,
})

function calcRice(v: RowFormValues) {
  return Math.round((v.reach * v.impact * v.confidence) / v.effort * 100) / 100
}

function InlineForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: RowFormValues
  onSave: (v: RowFormValues) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [v, setV] = useState<RowFormValues>(initial)
  const set = (k: keyof RowFormValues, val: string | number) => setV((prev) => ({ ...prev, [k]: val }))

  return (
    <tr className="bg-muted/30">
      <td className="p-1.5">
        <input className="input-field text-xs py-1 px-2" placeholder="Milestone" value={v.milestone} onChange={(e) => set('milestone', e.target.value)} />
      </td>
      <td className="p-1.5">
        <input className="input-field text-xs py-1 px-2" placeholder="Goal" value={v.goal} onChange={(e) => set('goal', e.target.value)} />
      </td>
      <td className="p-1.5">
        <input className="input-field text-xs py-1 px-2" placeholder="Business Value" value={v.businessValue} onChange={(e) => set('businessValue', e.target.value)} />
      </td>
      <td className="p-1.5">
        <input className="input-field text-xs py-1 px-2" placeholder="User Story" value={v.userStory} onChange={(e) => set('userStory', e.target.value)} />
      </td>
      <td className="p-1.5">
        <select className="input-field text-xs py-1 px-1" value={v.reach} onChange={(e) => set('reach', Number(e.target.value))}>
          {REACH_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </td>
      <td className="p-1.5">
        <select className="input-field text-xs py-1 px-1" value={v.impact} onChange={(e) => set('impact', Number(e.target.value))}>
          {IMPACT_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </td>
      <td className="p-1.5">
        <select className="input-field text-xs py-1 px-1" value={v.confidence} onChange={(e) => set('confidence', Number(e.target.value))}>
          {CONFIDENCE_OPTIONS.map((n) => <option key={n} value={n}>{n.toFixed(1)}</option>)}
        </select>
      </td>
      <td className="p-1.5">
        <select className="input-field text-xs py-1 px-1" value={v.effort} onChange={(e) => set('effort', Number(e.target.value))}>
          {EFFORT_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </td>
      <td className={`p-1.5 text-center text-sm font-mono ${scoreColor(calcRice(v))}`}>
        {calcRice(v)}
      </td>
      <td className="p-1.5">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={isPending} onClick={() => onSave(v)}>
            <Check className="w-3.5 h-3.5 text-green-600" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onCancel}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

type SortKey = 'riceScore' | 'reach' | 'impact' | 'confidence' | 'effort'

interface Props {
  projectId: string
  canEdit: boolean
}

export function RiceMatrix({ projectId, canEdit }: Props) {
  const { data: items = [], isLoading } = useRiceItems(projectId)
  const createItem = useCreateRiceItem()
  const updateItem = useUpdateRiceItem()
  const deleteItem = useDeleteRiceItem()

  const [isAdding, setIsAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('riceScore')
  const [sortAsc, setSortAsc] = useState(false)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sorted = [...items].sort((a, b) => {
    const dir = sortAsc ? 1 : -1
    return (a[sortKey] - b[sortKey]) * dir
  })

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp className="w-3 h-3 opacity-20" />
    return sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

  function SortTh({ k, label }: { k: SortKey; label: string }) {
    return (
      <th
        className="p-2 text-center cursor-pointer select-none hover:bg-muted/50 whitespace-nowrap"
        onClick={() => toggleSort(k)}
      >
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold">
          {label} <SortIcon k={k} />
        </span>
      </th>
    )
  }

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            RICE = (Reach × Impact × Confidence) ÷ Effort — higher is better
          </p>
        </div>
        {canEdit && !isAdding && (
          <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add item
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="p-2 text-left text-xs font-semibold">Milestone</th>
              <th className="p-2 text-left text-xs font-semibold">Goal</th>
              <th className="p-2 text-left text-xs font-semibold">Business Value</th>
              <th className="p-2 text-left text-xs font-semibold">User Story</th>
              <SortTh k="reach" label="Reach" />
              <SortTh k="impact" label="Impact" />
              <SortTh k="confidence" label="Conf." />
              <SortTh k="effort" label="Effort" />
              <SortTh k="riceScore" label="RICE" />
              {canEdit && <th className="p-2 w-16" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isAdding && (
              <InlineForm
                initial={emptyForm()}
                isPending={createItem.isPending}
                onCancel={() => setIsAdding(false)}
                onSave={(v) => {
                  createItem.mutate(
                    { projectId, ...v, milestone: v.milestone || undefined, goal: v.goal || undefined, businessValue: v.businessValue || undefined, userStory: v.userStory || undefined },
                    { onSuccess: () => setIsAdding(false) },
                  )
                }}
              />
            )}
            {sorted.map((item: RiceItem) =>
              editId === item.id ? (
                <InlineForm
                  key={item.id}
                  initial={{
                    milestone: item.milestone ?? '',
                    goal: item.goal ?? '',
                    businessValue: item.businessValue ?? '',
                    userStory: item.userStory ?? '',
                    reach: item.reach,
                    impact: item.impact,
                    confidence: item.confidence,
                    effort: item.effort,
                  }}
                  isPending={updateItem.isPending}
                  onCancel={() => setEditId(null)}
                  onSave={(v) => {
                    updateItem.mutate(
                      { id: item.id, projectId, ...v, milestone: v.milestone || undefined, goal: v.goal || undefined, businessValue: v.businessValue || undefined, userStory: v.userStory || undefined },
                      { onSuccess: () => setEditId(null) },
                    )
                  }}
                />
              ) : (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-2 max-w-[140px]">
                    <span className="text-xs line-clamp-2">{item.milestone ?? <span className="text-muted-foreground/40">—</span>}</span>
                  </td>
                  <td className="p-2 max-w-[160px]">
                    <span className="text-xs line-clamp-2">{item.goal ?? <span className="text-muted-foreground/40">—</span>}</span>
                  </td>
                  <td className="p-2 max-w-[160px]">
                    <span className="text-xs line-clamp-2">{item.businessValue ?? <span className="text-muted-foreground/40">—</span>}</span>
                  </td>
                  <td className="p-2 max-w-[200px]">
                    <span className="text-xs line-clamp-2">{item.userStory ?? <span className="text-muted-foreground/40">—</span>}</span>
                  </td>
                  <td className="p-2 text-center text-xs">{item.reach}</td>
                  <td className="p-2 text-center text-xs">{item.impact}</td>
                  <td className="p-2 text-center text-xs">{item.confidence.toFixed(1)}</td>
                  <td className="p-2 text-center text-xs">{item.effort}</td>
                  <td className={`p-2 text-center text-sm font-mono ${scoreColor(item.riceScore)}`}>
                    {item.riceScore}
                  </td>
                  {canEdit && (
                    <td className="p-2">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditId(item.id)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 hover:text-destructive"
                          disabled={deleteItem.isPending}
                          onClick={() => deleteItem.mutate({ id: item.id, projectId })}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ),
            )}
            {sorted.length === 0 && !isAdding && (
              <tr>
                <td colSpan={canEdit ? 10 : 9} className="p-8 text-center text-sm text-muted-foreground">
                  No RICE items yet.{canEdit ? ' Click "Add item" to start prioritizing.' : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
