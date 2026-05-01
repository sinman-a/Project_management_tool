import { cn } from '@/lib/utils'

const map: Record<string, { label: string; className: string }> = {
  planning:   { label: 'Planning',   className: 'bg-blue-100 text-blue-800' },
  active:     { label: 'Active',     className: 'bg-green-100 text-green-800' },
  on_hold:    { label: 'On Hold',    className: 'bg-amber-100 text-amber-800' },
  completed:  { label: 'Completed',  className: 'bg-gray-100 text-gray-700' },
  cancelled:  { label: 'Cancelled',  className: 'bg-red-100 text-red-700' },
  closed:     { label: 'Closed',     className: 'bg-gray-100 text-gray-700' },
  planned:    { label: 'Planned',    className: 'bg-gray-100 text-gray-600' },
  waterfall:  { label: 'Waterfall',  className: 'bg-purple-100 text-purple-800' },
  agile:      { label: 'Agile',      className: 'bg-teal-100 text-teal-800' },
  hybrid:     { label: 'Hybrid',     className: 'bg-indigo-100 text-indigo-800' },
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cfg.className, className)}>
      {cfg.label}
    </span>
  )
}
