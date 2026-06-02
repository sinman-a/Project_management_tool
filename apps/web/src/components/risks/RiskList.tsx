import { cn } from '@/lib/utils'
import type { Risk } from '@/types'

const BAND_STYLE: Record<string, string> = {
  low: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  identified: 'Identified',
  analyzing: 'Analyzing',
  mitigating: 'Mitigating',
  closed: 'Closed',
  accepted: 'Accepted',
  occurred: 'Occurred',
}

interface Props {
  risks: Risk[]
  canEdit?: boolean
  onEdit?: (risk: Risk) => void
}

export function RiskList({ risks, canEdit, onEdit }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  if (risks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No risks recorded yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left py-2 px-3 font-medium">Risk ID</th>
            <th className="text-left py-2 px-3 font-medium">Title</th>
            <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Category</th>
            <th className="text-center py-2 px-3 font-medium">P×I</th>
            <th className="text-center py-2 px-3 font-medium">Band</th>
            <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">Status</th>
            <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">Owner</th>
            <th className="text-center py-2 px-3 font-medium hidden xl:table-cell">Next Review</th>
            {canEdit && <th className="py-2 px-3" />}
          </tr>
        </thead>
        <tbody>
          {risks.map((risk) => {
            const isOverdue =
              risk.nextReviewDate &&
              risk.nextReviewDate < today &&
              risk.status !== 'closed' &&
              risk.status !== 'accepted'

            return (
              <tr
                key={risk.id}
                role="button"
                tabIndex={0}
                aria-label={`Open risk R-${String(risk.riskNumber).padStart(3, '0')}: ${risk.title}`}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onEdit?.(risk)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onEdit?.(risk)
                  }
                }}
              >
                <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                  R-{String(risk.riskNumber).padStart(3, '0')}
                </td>
                <td className="py-2 px-3 font-medium max-w-xs">
                  <span className="line-clamp-2">{risk.title}</span>
                </td>
                <td className="py-2 px-3 text-muted-foreground hidden md:table-cell">{risk.category}</td>
                <td className="py-2 px-3 text-center">
                  <span className="font-mono">{risk.probability}×{risk.impact}</span>
                  <span className="ml-1 text-xs text-muted-foreground">={risk.score}</span>
                </td>
                <td className="py-2 px-3 text-center">
                  <span
                    className={cn(
                      'inline-block text-xs px-2 py-0.5 rounded-full border font-medium capitalize',
                      BAND_STYLE[risk.scoreBand],
                    )}
                  >
                    {risk.scoreBand}
                  </span>
                </td>
                <td className="py-2 px-3 hidden lg:table-cell">
                  {STATUS_LABEL[risk.status] ?? risk.status}
                </td>
                <td className="py-2 px-3 text-muted-foreground hidden lg:table-cell">
                  {risk.ownerName ?? '—'}
                </td>
                <td className="py-2 px-3 text-center hidden xl:table-cell">
                  {risk.nextReviewDate ? (
                    <span className={cn('text-xs', isOverdue && 'text-red-600 font-medium flex items-center gap-1 justify-center')}>
                      {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 inline-block" />}
                      {risk.nextReviewDate}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                {canEdit && (
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => { e.stopPropagation(); onEdit?.(risk) }}
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
