import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Layers, FolderKanban, Trash2, X } from 'lucide-react'
import { usePortfolios, useCreatePortfolio, useDeletePortfolio } from '@/hooks/usePortfolios'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function Portfolios() {
  const navigate = useNavigate()
  const { canCreateProjects } = useAuthStore()
  const { data: portfolios = [], isLoading } = usePortfolios()
  const createPortfolio = useCreatePortfolio()
  const deletePortfolio = useDeletePortfolio()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    createPortfolio.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      { onSuccess: () => { setName(''); setDescription(''); setShowForm(false) } },
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="w-6 h-6" /> Portfolios
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Strategic grouping of programs and projects
          </p>
        </div>
        {canCreateProjects() && !showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Portfolio
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">New Portfolio</CardTitle>
            <button type="button" aria-label="Close" title="Close" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea className="input-field resize-none" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={!name.trim() || createPortfolio.isPending}>
                  {createPortfolio.isPending ? 'Creating…' : 'Create Portfolio'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : portfolios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Layers className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No portfolios yet. Group programs under strategic portfolios.</p>
          {canCreateProjects() && (
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create your first portfolio
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {portfolios.map((pf) => (
            <Card
              key={pf.id}
              role="button"
              tabIndex={0}
              aria-label={`Open portfolio ${pf.name}`}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/portfolios/${pf.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/portfolios/${pf.id}`) } }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold truncate">{pf.name}</CardTitle>
                  {canCreateProjects() && (
                    <button
                      type="button"
                      aria-label={`Delete portfolio ${pf.name}`}
                      title="Delete portfolio"
                      className="text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete portfolio "${pf.name}"? Programs will be unlinked, not deleted.`)) {
                          deletePortfolio.mutate(pf.id)
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {pf.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{pf.description}</p>}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FolderKanban className="w-3 h-3" /> {pf.programCount ?? 0} program{pf.programCount !== 1 ? 's' : ''}
                  </span>
                  <span>{pf.projectCount ?? 0} project{pf.projectCount !== 1 ? 's' : ''}</span>
                </div>
                {pf.ownerName && <p className="text-xs text-muted-foreground mt-1">Owner: {pf.ownerName}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
