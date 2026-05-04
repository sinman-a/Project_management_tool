import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, FolderKanban, Calendar, DollarSign, Archive, Trash2, Link2 } from 'lucide-react'
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

  const projects = showArchived
    ? allProjects
    : allProjects.filter((p) => !ARCHIVED_STATUSES.includes(p.status))

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => {
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
    </div>
  )
}
