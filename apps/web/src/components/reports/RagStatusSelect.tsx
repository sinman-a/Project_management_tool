import { cn } from '@/lib/utils'

type RagStatus = 'green' | 'amber' | 'red'

const RAG_OPTIONS: { value: RagStatus; label: string; cls: string }[] = [
  { value: 'green', label: 'Green', cls: 'text-green-700 bg-green-50 border-green-200' },
  { value: 'amber', label: 'Amber', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  { value: 'red', label: 'Red', cls: 'text-red-700 bg-red-50 border-red-200' },
]

interface Props {
  value: RagStatus
  onChange: (v: RagStatus) => void
  disabled?: boolean
}

export function RagStatusSelect({ value, onChange, disabled }: Props) {
  const current = RAG_OPTIONS.find((o) => o.value === value) ?? RAG_OPTIONS[0]
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as RagStatus)}
      disabled={disabled}
      className={cn(
        'text-xs font-medium rounded border px-2 py-1 focus:outline-none',
        current.cls,
      )}
    >
      {RAG_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function RagBadge({ status }: { status: RagStatus }) {
  const map: Record<RagStatus, string> = {
    green: 'bg-green-100 text-green-800 border-green-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    red: 'bg-red-100 text-red-800 border-red-200',
  }
  const labels: Record<RagStatus, string> = { green: 'Green', amber: 'Amber', red: 'Red' }
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded border inline-block', map[status])}>
      {labels[status]}
    </span>
  )
}
