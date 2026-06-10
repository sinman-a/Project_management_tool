import { useState } from 'react'
import { Plus, LayoutList, Kanban, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IdeaCard } from '@/components/ideas/IdeaCard'
import { IdeaDetailDrawer } from '@/components/ideas/IdeaDetailDrawer'
import { PrioritizationView } from '@/components/ideas/PrioritizationView'
import { useIdeas, useCreateIdea, useStrategicThemes } from '@/hooks/useIdeas'
import { useAuthStore } from '@/stores/authStore'
import type { IdeaStatus } from '@/types'

const COLUMNS: { status: IdeaStatus; label: string }[] = [
  { status: 'draft', label: 'Draft' },
  { status: 'submitted', label: 'Submitted' },
  { status: 'under_review', label: 'Under Review' },
  { status: 'approved', label: 'Approved' },
  { status: 'rejected', label: 'Rejected' },
  { status: 'on_hold', label: 'On Hold' },
]

function SubmitForm({ onClose }: { onClose: () => void }) {
  const createIdea = useCreateIdea()
  const [title, setTitle] = useState('')
  const [problem, setProblem] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    if (!problem.trim()) { setError('Problem statement is required'); return }
    createIdea.mutate(
      { title: title.trim(), problemStatement: problem.trim() },
      { onSuccess: onClose, onError: () => setError('Failed to submit idea') },
    )
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <h3 className="font-semibold text-sm">Submit New Idea</h3>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="space-y-1">
            <label className="text-xs font-medium">Title *</label>
            <input
              className="w-full text-sm border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError('') }}
              placeholder="Brief title for the idea"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Problem Statement *</label>
            <textarea
              rows={3}
              className="w-full text-sm border rounded px-3 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="What problem does this solve?"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={createIdea.isPending}>
              {createIdea.isPending ? 'Submitting…' : 'Submit Idea'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function Ideas() {
  const { user } = useAuthStore()
  const [view, setView] = useState<'pipeline' | 'list' | 'priority'>('pipeline')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [themeFilter, setThemeFilter] = useState<string>('')
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null)
  const [showSubmitForm, setShowSubmitForm] = useState(false)

  const { data: ideas = [], isLoading } = useIdeas({
    status: statusFilter || undefined,
    theme: themeFilter || undefined,
  })
  const { data: themes = [] } = useStrategicThemes()

  const canSubmit = !!user

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ideas</h1>
          <p className="text-muted-foreground text-sm mt-1">Idea pipeline — submit, review, and convert to projects</p>
        </div>
        {canSubmit && !showSubmitForm && (
          <Button size="sm" onClick={() => setShowSubmitForm(true)}>
            <Plus className="w-3 h-3 mr-1" /> Submit Idea
          </Button>
        )}
      </div>

      {showSubmitForm && <SubmitForm onClose={() => setShowSubmitForm(false)} />}

      {/* Filters + view toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex border rounded overflow-hidden">
          <button
            className={`px-3 py-1.5 text-sm transition-colors flex items-center gap-1 ${view === 'pipeline' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            onClick={() => setView('pipeline')}
          >
            <Kanban className="w-3.5 h-3.5" /> Pipeline
          </button>
          <button
            className={`px-3 py-1.5 text-sm transition-colors flex items-center gap-1 ${view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            onClick={() => setView('list')}
          >
            <LayoutList className="w-3.5 h-3.5" /> List
          </button>
          <button
            className={`px-3 py-1.5 text-sm transition-colors flex items-center gap-1 ${view === 'priority' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            onClick={() => setView('priority')}
          >
            <Trophy className="w-3.5 h-3.5" /> Prioritization
          </button>
        </div>

        <select
          className="text-sm border rounded px-2 py-1.5"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {COLUMNS.map((c) => (
            <option key={c.status} value={c.status}>{c.label}</option>
          ))}
        </select>

        {themes.length > 0 && (
          <select
            className="text-sm border rounded px-2 py-1.5"
            value={themeFilter}
            onChange={(e) => setThemeFilter(e.target.value)}
          >
            <option value="">All themes</option>
            {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        {(statusFilter || themeFilter) && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground underline"
            onClick={() => { setStatusFilter(''); setThemeFilter('') }}
          >
            Clear filters
          </button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">{ideas.length} idea{ideas.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Content */}
      {view === 'priority' ? (
        <PrioritizationView onOpenIdea={setSelectedIdeaId} />
      ) : isLoading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading ideas…</div>
      ) : view === 'pipeline' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colIdeas = ideas.filter((i) => i.status === col.status)
            return (
              <div key={col.status} className="flex-shrink-0 w-64 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-medium">{col.label}</h3>
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{colIdeas.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {colIdeas.map((idea) => (
                    <IdeaCard key={idea.id} idea={idea} onClick={(i) => setSelectedIdeaId(i.id)} />
                  ))}
                  {colIdeas.length === 0 && (
                    <div className="border-2 border-dashed rounded-lg py-6 text-center text-xs text-muted-foreground">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {['Title', 'Submitter', 'RICE', 'Status', 'Created'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ideas.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">No ideas found.</td></tr>
                ) : ideas.map((idea) => (
                  <tr
                    key={idea.id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedIdeaId(idea.id)}
                  >
                    <td className="px-4 py-3 font-medium">{idea.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{idea.submitterName}</td>
                    <td className="px-4 py-3 font-mono text-primary font-bold">
                      {idea.riceScore > 0 ? idea.riceScore.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                        {idea.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(idea.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <IdeaDetailDrawer ideaId={selectedIdeaId} onClose={() => setSelectedIdeaId(null)} />
    </div>
  )
}
