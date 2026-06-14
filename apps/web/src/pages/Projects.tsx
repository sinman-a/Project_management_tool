import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, FolderKanban, Calendar, DollarSign, Archive, Trash2, Link2, Upload, Search, LayoutGrid, LayoutList } from 'lucide-react'
import { ImportModal } from '@/components/settings/ImportModal'
import { EntityImportModal } from '@/components/import/EntityImportModal'
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject, usePrograms } from '@/hooks/useProjects'
import { useAuthStore } from '@/stores/authStore'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { RagDot } from '@/components/layout/RagDot'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Project } from '@/types'

const ARCHIVED_STATUSES = ['completed', 'cancelled']

export function Projects() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const programId = params.get('programId') ?? undefined
  const { canCreateProjects } = useAuthStore()
  const { data: allProjects = [], isLoading } = useProjects(programId)
  const { data: programs = [] } = usePrograms()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Project | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [assignTarget, setAssignTarget] = useState<Project | null>(null)
  const [assignProgramId, setAssignProgramId] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showEntityImport, setShowEntityImport] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [methodologyFilter, setMethodologyFilter] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'newest' | 'budget'>('name')
  const [view, setView] = useState<'cards' | 'table'>('cards')

  const projects = showArchived
    ? allProjects
    : allProjects.filter((p) => !ARCHIVED_STATUSES.includes(p.status))

  const programName = (pid?: string | null) => programs.find((p) => p.id === pid)?.name
  const budgetOf = (p: Project) => (p.budgetCapex ?? 0) + (p.budgetOpex ?? 0)
  const visible = projects
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => !statusFilter || p.status === statusFilter)
    .filter((p) => !methodologyFilter || p.methodology === methodologyFilter)
    .filter((p) => !programFilter || (programFilter === 'none' ? !p.programId : p.programId === programFilter))
    .sort((a, b) =>
      sortBy === 'name' ? a.name.localeCompare(b.name)
        : sortBy === 'budget' ? budgetOf(b) - budgetOf(a)
        : (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
    )

  function handleClose() {
    setShowForm(false)
    setEditTarget(null)
  }

  function handleArchive(project: Project) {
    updateProject.mutate({ id: project.id, status: 'completed' })
  }

  function handleDelete(id: string) {
    deleteProject.mutate(id, { onSuccess: () => setConfirmDeleteId(null) })
  }

  function handleAssignProgram() {
    if (!assignTarget) return
    updateProject.mutate(
      { id: assignTarget.id, programId: assignProgramId || undefined },
      { onSuccess: () => { setAssignTarget(null); setAssignProgramId('') } },
    )
  }

  const archivedCount = allProjects.filter((p) => ARCHIVED_STATUSES.includes(p.status)).length
  const unlinkedCount = allProjects.filter((p) => !p.programId && !ARCHIVED_STATUSES.includes(p.status)).length

  return (
    <>
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
            {programId ? ' in this program' : ' total'}
            {!programId && unlinkedCount > 0 && (
              <span className="ml-1">· <span className="text-amber-600">{unlinkedCount} without program</span></span>
            )}
            {!showArchived && archivedCount > 0 && (
              <span> · <button onClick={() => setShowArchived(true)} className="text-primary hover:underline">{archivedCount} archived</button></span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {archivedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive className="w-3.5 h-3.5 mr-1.5" />
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </Button>
          )}
          {canCreateProjects() && (
            <Button variant="outline" size="sm" onClick={() => setShowEntityImport(true)}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Import CSV
            </Button>
          )}
          {canCreateProjects() && (
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Import Tasks
            </Button>
          )}
          {canCreateProjects() && !showForm && (
            <Button onClick={() => { setEditTarget(null); setShowForm(true) }}>
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          )}
        </div>
      </div>

      {(showForm || editTarget) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editTarget ? `Edit — ${editTarget.name}` : 'New Project'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectForm
              project={editTarget ?? undefined}
              defaultProgramId={programId}
              isPending={createProject.isPending || updateProject.isPending}
              onCancel={handleClose}
              onSubmit={(data) => {
                const payload = {
                  ...data,
                  programId: data.programId || undefined,
                  endDate: data.endDate || undefined,
                }
                if (editTarget) {
                  updateProject.mutate({ id: editTarget.id, ...payload }, { onSuccess: handleClose })
                } else {
                  createProject.mutate(payload, {
                    onSuccess: (p) => { handleClose(); navigate(`/projects/${p.id}`) },
                  })
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-base">Delete Project?</h3>
            <p className="text-sm text-muted-foreground">
              All tasks, sprints, and time logs in this project will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteProject.isPending}
                onClick={() => handleDelete(confirmDeleteId)}
              >
                {deleteProject.isPending ? 'Deleting…' : 'Delete permanently'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign to program modal */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-base">Assign to Program</h3>
            <p className="text-sm text-muted-foreground">
              Select a program for <span className="font-medium text-foreground">"{assignTarget.name}"</span>.
            </p>
            <select
              className="input-field w-full"
              value={assignProgramId}
              onChange={(e) => setAssignProgramId(e.target.value)}
            >
              <option value="">— No program —</option>
              {programs
                .filter((pr) => pr.status !== 'closed')
                .map((pr) => (
                  <option key={pr.id} value={pr.id}>{pr.name}</option>
                ))}
            </select>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setAssignTarget(null); setAssignProgramId('') }}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={updateProject.isPending}
                onClick={handleAssignProgram}
              >
                {updateProject.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderKanban className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">
            {showArchived ? 'No projects found.' : 'No active projects.'}
          </p>
          {canCreateProjects() && !showArchived && (
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create your first project
            </Button>
          )}
        </div>
      ) : (
        <>
        {/* Filters + view toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input-field pl-8 w-full h-9"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input-field h-9 w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {['planning', 'active', 'on_hold', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select className="input-field h-9 w-auto" value={methodologyFilter} onChange={(e) => setMethodologyFilter(e.target.value)}>
            <option value="">All methods</option>
            {['waterfall', 'agile', 'hybrid'].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="input-field h-9 w-auto" value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
            <option value="">All programs</option>
            <option value="none">No program</option>
            {programs.filter((p) => p.status !== 'closed').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input-field h-9 w-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="name">Sort: Name</option>
            <option value="newest">Sort: Newest</option>
            <option value="budget">Sort: Budget</option>
          </select>
          <div className="flex border rounded-md p-0.5 bg-muted/30">
            <button aria-label="Card view" onClick={() => setView('cards')} className={`p-1.5 rounded ${view === 'cards' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}><LayoutGrid className="w-4 h-4" /></button>
            <button aria-label="Table view" onClick={() => setView('table')} className={`p-1.5 rounded ${view === 'table' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}><LayoutList className="w-4 h-4" /></button>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm border rounded-lg">No projects match your filters.</div>
        ) : view === 'table' ? (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left py-2 px-3">Project</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Method</th>
                  <th className="text-left py-2 px-3">Program</th>
                  <th className="text-left py-2 px-3">Timeline</th>
                  <th className="text-right py-2 px-3">Budget</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((project) => (
                  <tr key={project.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/projects/${project.id}`)}>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <RagDot status={project.ragStatus ?? 'green'} size="sm" />
                        <span className="font-medium truncate max-w-[220px]">{project.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3"><StatusBadge status={project.status} /></td>
                    <td className="py-2 px-3 capitalize text-muted-foreground">{project.methodology}</td>
                    <td className="py-2 px-3 text-muted-foreground truncate max-w-[140px]">{programName(project.programId) ?? '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{formatDate(project.startDate)}{project.endDate ? ` → ${formatDate(project.endDate)}` : ''}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(budgetOf(project))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((project) => {
            const isArchived = ARCHIVED_STATUSES.includes(project.status)
            const hasNoProgram = !project.programId && !programId
            return (
              <Card
                key={project.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${isArchived ? 'opacity-60' : ''}`}
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <RagDot status={project.ragStatus ?? 'green'} />
                      <CardTitle className="text-sm font-semibold truncate">{project.name}</CardTitle>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                      {hasNoProgram && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          No program
                        </span>
                      )}
                      <StatusBadge status={project.methodology} />
                      <StatusBadge status={project.status} />
                    </div>
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{project.description}</p>
                  )}
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {formatDate(project.startDate)}
                    {project.endDate && ` → ${formatDate(project.endDate)}`}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <DollarSign className="w-3 h-3" />
                    CAPEX {formatCurrency(project.budgetCapex)} · OPEX {formatCurrency(project.budgetOpex)}
                  </div>
                  {canCreateProjects() && (
                    <div className="flex items-center justify-end gap-1 pt-1 flex-wrap">
                      {hasNoProgram && programs.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            setAssignTarget(project)
                            setAssignProgramId(project.programId ?? '')
                          }}
                        >
                          <Link2 className="w-3 h-3 mr-1" /> Assign program
                        </Button>
                      )}
                      {!isArchived && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2"
                          onClick={(e) => { e.stopPropagation(); handleArchive(project) }}
                          title="Archive project"
                        >
                          <Archive className="w-3 h-3 mr-1" /> Archive
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs px-2"
                        onClick={(e) => { e.stopPropagation(); setEditTarget(project); setShowForm(false) }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id) }}
                        title="Delete project"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
        )}
        </>
      )}
    </div>

    {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    {showEntityImport && <EntityImportModal entityType="project" onClose={() => setShowEntityImport(false)} />}
    </>
  )
}
