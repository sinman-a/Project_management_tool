import { useState } from 'react'
import { Plus, Trash2, Target, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useStrategicDrivers, useCreateDriver, useUpdateDriver, useDeleteDriver,
} from '@/hooks/useStrategicDrivers'

export function StrategicDriversCard() {
  const { data: drivers = [] } = useStrategicDrivers()
  const createDriver = useCreateDriver()
  const updateDriver = useUpdateDriver()
  const deleteDriver = useDeleteDriver()

  const [name, setName] = useState('')
  const [weight, setWeight] = useState('1')

  const activeTotal = drivers.filter((d) => d.isActive).reduce((s, d) => s + (d.weight || 0), 0)

  function normPct(w: number, active: boolean): string {
    if (!active || activeTotal <= 0) return '—'
    return `${((w / activeTotal) * 100).toFixed(0)}%`
  }

  function handleAdd() {
    if (!name.trim()) return
    createDriver.mutate(
      { name: name.trim(), weight: parseFloat(weight) || 0 },
      { onSuccess: () => { setName(''); setWeight('1') } },
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <Target className="inline-block w-4 h-4 mr-2 text-primary" />
          Strategic Drivers (P-score weights)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Drivers and their weights define the strategic-value index
          <span className="font-mono"> P = (Σ wᵢ·Sᵢ) / √(C²+R²)</span>. Weights are normalized
          across active drivers (current Σ active = {activeTotal || 0}).
        </p>

        {drivers.length > 0 && (
          <div className="border rounded-lg divide-y">
            <div className="grid grid-cols-[1fr_80px_64px_auto_auto] gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Driver</span><span className="text-right">Weight</span><span className="text-right">Norm.</span><span /><span />
            </div>
            {drivers.map((d) => (
              <div key={d.id} className="grid grid-cols-[1fr_80px_64px_auto_auto] gap-2 px-3 py-2 items-center">
                <input
                  className="text-sm bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none"
                  defaultValue={d.name}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value !== d.name) updateDriver.mutate({ id: d.id, name: e.target.value.trim() }) }}
                />
                <input
                  type="number" min="0" step="0.5"
                  className="text-sm text-right border rounded px-1.5 py-0.5 w-full"
                  defaultValue={d.weight}
                  onBlur={(e) => { const w = parseFloat(e.target.value) || 0; if (w !== d.weight) updateDriver.mutate({ id: d.id, weight: w }) }}
                />
                <span className="text-sm text-right tabular-nums text-muted-foreground">{normPct(d.weight, d.isActive)}</span>
                <button
                  type="button"
                  aria-label={d.isActive ? `Deactivate ${d.name}` : `Activate ${d.name}`}
                  title={d.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                  onClick={() => updateDriver.mutate({ id: d.id, isActive: !d.isActive })}
                >
                  {d.isActive
                    ? <ToggleRight className="w-6 h-6 text-primary" />
                    : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${d.name}`}
                  title="Delete driver"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => { if (confirm(`Delete driver "${d.name}"? Idea scores for it will be removed.`)) deleteDriver.mutate(d.id) }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <input
            className="input-field flex-1 mt-0"
            placeholder="New driver (e.g. Revenue growth)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          />
          <input
            type="number" min="0" step="0.5"
            className="input-field w-24 mt-0"
            placeholder="Weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Button size="sm" variant="outline" disabled={!name.trim() || createDriver.isPending} onClick={handleAdd}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
