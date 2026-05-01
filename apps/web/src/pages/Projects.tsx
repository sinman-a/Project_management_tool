import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, FolderKanban, Calendar, DollarSign } from 'lucide-react'
import { useProjects, useCreateProject } from '@/hooks/useProjects'
import { useUpdateProject } from '@/hooks/useProjects'
import { useAuthStore } from '@/stores/authStore'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { RagDot } from '@/components/layout/RagDot'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Project } from '@/types'

export function Projects() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const programId = params.get('programId') ?? undefined
  const { canCreateProjects } = useAuthStore()
  const { data: projects = [], isLoading } = useProjects(programId)
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Project | null>(null)

  function handleClose() {
    setShowForm(false)
    setEditTarget(null)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
            {programId ? ' in this program' : ' total'}
          </p>
        </div>
        {canCreateProjects() && !showForm && (
          <Button onClick={() => { setEditTarget(null); setShowForm(true) }}>
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        )}
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

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderKanban className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No projects yet.</p>
          {canCreateProjects() && (
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create your first project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <RagDot status={project.ragStatus ?? 'green'} />
                    <CardTitle className="text-sm font-semibold truncate">{project.name}</CardTitle>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
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
                <div className="flex items-center justify-end pt-1">
                  {canCreateProjects() && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs px-2"
                      onClick={(e) => { e.stopPropagation(); setEditTarget(project); setShowForm(false) }}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
