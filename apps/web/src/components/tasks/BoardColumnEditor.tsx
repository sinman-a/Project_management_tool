import { useState } from 'react'
import { X, Plus, Eye, EyeOff, Trash2, RotateCcw, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useProjectBoardColumns,
  useCreateBoardColumn,
  useUpdateBoardColumn,
  useDeleteBoardColumn,
  useResetBoardColumns,
  type BoardColumn,
} from '@/hooks/useBoardColumns'

const PRESET_COLORS = [
  '#9ca3af', '#60a5fa', '#818cf8', '#c084fc', '#f472b6',
  '#4ade80', '#facc15', '#fb923c', '#f87171', '#2dd4bf',
]

const STATUS_OPTIONS: { key: BoardColumn['statusKey']; defaultLabel: string }[] = [
  { key: 'backlog',      defaultLabel: 'Backlog' },
  { key: 'todo',         defaultLabel: 'To Do' },
  { key: 'in_progress',  defaultLabel: 'In Progress' },
  { key: 'review',       defaultLabel: 'Review' },
  { key: 'done',         defaultLabel: 'Done' },
  { key: 'cancelled',    defaultLabel: 'Cancelled' },
]

interface Props {
  projectId: string
  canEdit: boolean
  onClose: () => void
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`w-5 h-5 rounded-full border-2 transition-transform ${value === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
    </div>
  )
}

interface ColumnRowProps {
  col: BoardColumn
  projectId: string
  canEdit: boolean
}

function ColumnRow({ col, projectId, canEdit }: ColumnRowProps) {
  const update = useUpdateBoardColumn()
  const remove = useDeleteBoardColumn()
  const [label, setLabel] = useState(col.label)
  const [showColors, setShowColors] = useState(false)

  function saveLabel() {
    if (label.trim() && label !== col.label) {
      update.mutate({ id: col.id, projectId, label: label.trim() })
    }
  }

  if (col.isDefault) {
    return (
      <div className="flex items-center gap-2 py-2 px-1 rounded opacity-60">
        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
        <span className="text-sm flex-1">{col.label}</span>
        <span className="text-xs text-muted-foreground">default</span>
      </div>
    )
  }

  return (
    <div className="space-y-1 py-2 px-1 rounded hover:bg-muted/30">
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 cursor-grab" />
        <button
          type="button"
          className="w-4 h-4 rounded-full flex-shrink-0 border border-border/50 transition-transform hover:scale-110"
          style={{ backgroundColor: col.color }}
          onClick={() => canEdit && setShowColors((v) => !v)}
          title="Change color"
        />
        <input
          className="flex-1 text-sm bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-0.5 py-0"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={saveLabel}
          onKeyDown={(e) => e.key === 'Enter' && saveLabel()}
          disabled={!canEdit}
        />
        <span className="text-[10px] text-muted-foreground px-1 py-0.5 bg-muted rounded">
          {col.statusKey.replace(/_/g, ' ')}
        </span>
        {canEdit && (
          <>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={col.isVisible ? 'Hide column' : 'Show column'}
              onClick={() => update.mutate({ id: col.id, projectId, isVisible: !col.isVisible })}
            >
              {col.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-50" />}
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Delete column"
              onClick={() => {
                if (confirm(`Delete column "${col.label}"?`)) {
                  remove.mutate({ id: col.id, projectId })
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
      {showColors && canEdit && (
        <div className="pl-9">
          <ColorPicker
            value={col.color}
            onChange={(c) => {
              update.mutate({ id: col.id, projectId, color: c })
              setShowColors(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

function AddColumnForm({ projectId, existingKeys, onDone }: {
  projectId: string
  existingKeys: string[]
  onDone: () => void
}) {
  const create = useCreateBoardColumn()
  const available = STATUS_OPTIONS.filter((o) => !existingKeys.includes(o.key))
  const [statusKey, setStatusKey] = useState<BoardColumn['statusKey']>(available[0]?.key ?? 'backlog')
  const [label, setLabel] = useState(available[0]?.defaultLabel ?? '')
  const [color, setColor] = useState('#9ca3af')

  if (available.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-2">All status types already added.</p>
  }

  function handleAdd() {
    if (!label.trim()) return
    create.mutate(
      { projectId, statusKey, label: label.trim(), color, position: existingKeys.length, isVisible: true },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
      <div className="space-y-1">
        <label className="text-xs font-medium">Status type</label>
        <select
          className="w-full text-sm border rounded px-2 py-1.5 bg-background"
          value={statusKey}
          onChange={(e) => {
            const key = e.target.value as BoardColumn['statusKey']
            setStatusKey(key)
            setLabel(STATUS_OPTIONS.find((o) => o.key === key)?.defaultLabel ?? '')
          }}
        >
          {available.map((o) => (
            <option key={o.key} value={o.key}>{o.defaultLabel} ({o.key})</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Column label</label>
        <input
          className="w-full text-sm border rounded px-2 py-1.5"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Color</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" disabled={!label.trim() || create.isPending} onClick={handleAdd}>
          {create.isPending ? 'Adding…' : 'Add Column'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}

export function BoardColumnEditor({ projectId, canEdit, onClose }: Props) {
  const { data: columns = [] } = useProjectBoardColumns(projectId)
  const reset = useResetBoardColumns()
  const [showAddForm, setShowAddForm] = useState(false)

  const customColumns = columns.filter((c) => !c.isDefault)
  const hasCustom = customColumns.length > 0

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-80 bg-background shadow-2xl flex flex-col border-l">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Board Settings</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Configure columns for this board. Changes only affect this project.
          </p>

          {/* Column list */}
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Columns</p>
            {columns.map((col) => (
              <ColumnRow key={col.id} col={col} projectId={projectId} canEdit={canEdit} />
            ))}
          </div>

          {/* Add column */}
          {canEdit && !showAddForm && (
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors w-full py-1"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="w-4 h-4" />
              Add Column
            </button>
          )}
          {showAddForm && (
            <AddColumnForm
              projectId={projectId}
              existingKeys={customColumns.map((c) => c.statusKey)}
              onDone={() => setShowAddForm(false)}
            />
          )}
        </div>

        {/* Footer */}
        {canEdit && hasCustom && (
          <div className="border-t px-4 py-3">
            <Button
              size="sm"
              variant="outline"
              className="w-full text-muted-foreground"
              disabled={reset.isPending}
              onClick={() => {
                if (confirm('Reset to default columns? All custom configuration will be lost.')) {
                  reset.mutate(projectId)
                }
              }}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-2" />
              {reset.isPending ? 'Resetting…' : 'Reset to Defaults'}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
