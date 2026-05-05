import { useState } from 'react'
import { Link2, Plus, X, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTaskLinks, useCreateTaskLink, useDeleteTaskLink } from '@/hooks/useTaskLinks'
import type { Task, TaskLink, TaskLinkType } from '@/types'

const LINK_TYPES: { value: TaskLinkType; label: string }[] = [
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
  { value: 'related', label: 'Related' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'predecessor', label: 'Predecessor' },
  { value: 'successor', label: 'Successor' },
]

const LINK_TYPE_STYLE: Record<TaskLinkType, string> = {
  parent:      'bg-purple-50 text-purple-700 border-purple-200',
  child:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  related:     'bg-blue-50 text-blue-700 border-blue-200',
  duplicate:   'bg-gray-100 text-gray-600 border-gray-200',
  predecessor: 'bg-orange-50 text-orange-700 border-orange-200',
  successor:   'bg-green-50 text-green-700 border-green-200',
}

function linkLabel(link: TaskLink, taskId: string): { type: string; style: string; otherName: string } {
  const isSource = link.sourceTaskId === taskId
  const otherName = isSource ? link.targetName : link.sourceName

  let displayType = link.linkType as TaskLinkType
  if (!isSource) {
    const inverses: Partial<Record<TaskLinkType, TaskLinkType>> = {
      predecessor: 'successor',
      successor: 'predecessor',
      parent: 'child',
      child: 'parent',
    }
    displayType = inverses[link.linkType] ?? link.linkType
  }

  const label = LINK_TYPES.find((t) => t.value === displayType)?.label ?? displayType
  return { type: label, style: LINK_TYPE_STYLE[displayType], otherName }
}

interface Props {
  taskId: string
  projectTasks: Task[]
  canEdit: boolean
}

export function TaskLinksPanel({ taskId, projectTasks, canEdit }: Props) {
  const { data: links = [], isLoading } = useTaskLinks(taskId)
  const createLink = useCreateTaskLink()
  const deleteLink = useDeleteTaskLink()

  const [showAdd, setShowAdd] = useState(false)
  const [linkType, setLinkType] = useState<TaskLinkType>('related')
  const [targetId, setTargetId] = useState('')
  const [search, setSearch] = useState('')

  const otherTasks = projectTasks.filter((t) => t.id !== taskId)
  const filtered = search
    ? otherTasks.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : otherTasks

  function handleAdd() {
    if (!targetId) return
    createLink.mutate(
      { sourceTaskId: taskId, targetTaskId: targetId, linkType },
      {
        onSuccess: () => {
          setShowAdd(false)
          setTargetId('')
          setSearch('')
        },
      },
    )
  }

  if (isLoading) return null

  return (
    <div className="mt-1 ml-4 pl-3 border-l-2 border-dashed border-muted-foreground/20 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 py-0.5">
        <Link2 className="w-3 h-3" /> Related work
      </p>

      {links.map((link) => {
        const { type, style, otherName } = linkLabel(link, taskId)
        return (
          <div key={link.id} className="flex items-center gap-1.5 group">
            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${style}`}>
              {type}
            </span>
            <ArrowRight className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
            <span className="text-xs truncate flex-1">{otherName}</span>
            {canEdit && (
              <button
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                onClick={() => deleteLink.mutate({ id: link.id, taskId })}
                title="Remove link"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )
      })}

      {showAdd ? (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              className="input-field text-xs py-0.5 px-1.5 h-7 flex-shrink-0 w-32"
              value={linkType}
              onChange={(e) => setLinkType(e.target.value as TaskLinkType)}
            >
              {LINK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <div className="relative flex-1 min-w-40">
              <input
                className="input-field text-xs py-0.5 px-1.5 h-7 w-full"
                placeholder="Search task by name…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setTargetId('') }}
              />
              {search && filtered.length > 0 && !targetId && (
                <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-background border rounded shadow-lg max-h-40 overflow-y-auto">
                  {filtered.slice(0, 20).map((t) => (
                    <button
                      key={t.id}
                      className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted truncate"
                      onClick={() => { setTargetId(t.id); setSearch(t.name) }}
                    >
                      {t.wbsCode && <span className="font-mono text-muted-foreground mr-1">{t.wbsCode}</span>}
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              size="sm"
              className="h-7 text-xs px-2 flex-shrink-0"
              disabled={!targetId || createLink.isPending}
              onClick={handleAdd}
            >
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2 flex-shrink-0"
              onClick={() => { setShowAdd(false); setTargetId(''); setSearch('') }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        canEdit && (
          <button
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="w-3 h-3" /> Add link
          </button>
        )
      )}
    </div>
  )
}
