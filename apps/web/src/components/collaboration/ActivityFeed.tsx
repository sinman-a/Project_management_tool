import { MessageSquare, AlertTriangle, Lock, FileText, CheckCircle2, TrendingUp } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useProjectActivity } from '@/hooks/useActivity'
import type { ActivityEvent } from '@/types'

const EVENT_ICONS: Record<string, React.ReactNode> = {
  comment_added: <MessageSquare className="w-4 h-4 text-blue-500" />,
  risk_added: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  risk_status_changed: <AlertTriangle className="w-4 h-4 text-orange-400" />,
  baseline_locked: <Lock className="w-4 h-4 text-purple-500" />,
  status_report_published: <FileText className="w-4 h-4 text-green-500" />,
  task_created: <CheckCircle2 className="w-4 h-4 text-muted-foreground" />,
  task_status_changed: <CheckCircle2 className="w-4 h-4 text-muted-foreground" />,
  rag_changed: <TrendingUp className="w-4 h-4 text-amber-500" />,
}

const EVENT_LABELS: Record<string, string> = {
  comment_added: 'commented',
  risk_added: 'added a risk',
  risk_status_changed: 'updated risk status',
  baseline_locked: 'locked a baseline',
  status_report_published: 'published a status report',
  task_created: 'created a task',
  task_status_changed: 'updated task status',
  rag_changed: 'changed RAG status',
}

function EventRow({ event }: { event: ActivityEvent }) {
  const icon = EVENT_ICONS[event.eventType] ?? <MessageSquare className="w-4 h-4 text-muted-foreground" />
  const label = EVENT_LABELS[event.eventType] ?? event.eventType.replace(/_/g, ' ')

  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{event.actorName}</span>
          <span className="text-muted-foreground"> {label}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(event.occurredAt)}</p>
      </div>
    </div>
  )
}

interface Props {
  projectId?: string
  programId?: string
  eventType?: string
}

export function ActivityFeed({ projectId }: Props) {
  const { data: events = [], isLoading } = useProjectActivity(projectId)

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading activity…</p>

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No activity yet.</p>
  }

  return (
    <div className="divide-y">
      {events.map((e) => <EventRow key={e.id} event={e} />)}
    </div>
  )
}
