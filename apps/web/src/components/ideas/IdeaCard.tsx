import { cn } from '@/lib/utils'
import type { Idea } from '@/types'

const STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  on_hold: 'bg-amber-100 text-amber-700',
  converted_to_project: 'bg-teal-100 text-teal-700',
}

interface Props {
  idea: Idea
  onClick: (idea: Idea) => void
}

export function IdeaCard({ idea, onClick }: Props) {
  const ageMs = Date.now() - new Date(idea.createdAt).getTime()
  const ageDays = Math.floor(ageMs / 86400000)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open idea: ${idea.title}`}
      className="bg-background border rounded-lg p-3 space-y-2 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
      onClick={() => onClick(idea)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(idea)
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm leading-snug">{idea.title}</p>
        {idea.riceScore > 0 && (
          <span className="flex-shrink-0 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono font-bold">
            {idea.riceScore.toFixed(1)}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{idea.problemStatement}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', STATUS_CLS[idea.status] ?? 'bg-gray-100')}>
          {idea.status.replace(/_/g, ' ')}
        </span>
        <span className="text-[10px] text-muted-foreground">{idea.submitterName}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{ageDays}d ago</span>
      </div>
    </div>
  )
}
