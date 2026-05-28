import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Calendar, DollarSign, FolderKanban } from 'lucide-react'
import { useProgram } from '@/hooks/useProjects'
import { useCreateProject, useUpdateProject } from '@/hooks/useProjects'
import { useProjects } from '@/hooks/useProjects'
import { useUpdateProgram } from '@/hooks/usePrograms'
import { useProgramProjectDeps } from '@/hooks/useProjectDependencies'
import { useAuthStore } from '@/stores/authStore'
import { RagDot } from '@/components/layout/RagDot'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProgramRoadmap } from '@/components/programs/ProgramRoadmap'
import { RiskRegister } from '@/components/risks/RiskRegister'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useState } from 'react'
import { ProgramForm } from '@/components/programs/ProgramForm'
import { ProjectForm } from '@/components/projects/ProjectForm'
import type { Project } from '@/types'

type Tab = 'projects' | 'roadmap' | 'risks'

export function ProgramDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: program, isLoading } = useProgram(id!)
  const { data: projects = [] } = useProjects(id)
  const { data: projectDeps = [] } = useProgramProjectDeps(id)
  const updateProgram = useUpdateProgram()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const [isEditing, setIsEditing] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('projects')

  const canEdit = user?.role === 'admin' || user?.role === 'program_manager'

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-4 w-48 bg-muted rounded" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (!program) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Program not found.</p>
        <Button variant="link" onClick={() => navigate('/programs')}>Back to Programs</Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <RagDot status={program.ragStatus ?? 'green'} size="lg" />
            <h1 className="text-2xl font-bold truncate">{program.name}</h1>
            <StatusBadge status={program.status} />
          </div>
          {program.description && (
            <p className="text-muted-foreground text-sm mt-1">{program.description}</p>
          )}
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing((v) => !v)}>
            <Pencil className="w-3 h-3 mr-1" />
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>
        )}
      </div>

      {/* Edit form */}
      {isEditing && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Edit Program</CardTitle></CardHeader>
          <CardContent>
            <ProgramForm
              program={program}
              isPending={updateProgram.isPending}
              onCancel={() => setIsEditing(false)}
              onSubmit={(data) => {
                updateProgram.mutate(
                  { id: program.id, ...data, endDate: data.endDate || undefined },
                  { onSuccess: () => setIsEditing(false) },
                )
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Key info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Timeline</span>
            </div>
            <p className="text-sm font-medium">{formatDate(program.startDate)}</p>
            {program.endDate && <p className="text-xs text-muted-foreground">→ {formatDate(program.endDate)}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Budget</span>
            </div>
            <p className="text-sm font-medium">CAPEX {formatCurrency(program.budgetCapex)}</p>
            <p className="text-xs text-muted-foreground">OPEX {formatCurrency(program.budgetOpex)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab bar */}
      <div className="flex border-b gap-0">
        {([
          { key: 'projects', label: `Projects (${projects.length})` },
          { key: 'roadmap', label: 'Roadmap' },
          { key: 'risks', label: 'Risks' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Roadmap tab */}
      {activeTab === 'roadmap' && (
        <ProgramRoadmap projects={projects} dependencies={projectDeps} canEdit={canEdit} />
      )}

      {/* Risks tab */}
      {activeTab === 'risks' && (
        <RiskRegister programId={id!} canEdit={canEdit} />
      )}

      {/* Projects tab */}
      {activeTab === 'projects' && <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Projects ({projects.length})</h2>
          {canEdit && !showNewProject && !editProject && (
            <Button size="sm" onClick={() => setShowNewProject(true)}>
              + New Project
            </Button>
          )}
        </div>

        {(showNewProject || editProject) && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{editProject ? `Edit — ${editProject.name}` : 'New Project'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectForm
                project={editProject ?? undefined}
                defaultProgramId={id}
                isPending={createProject.isPending || updateProject.isPending}
                onCancel={() => { setShowNewProject(false); setEditProject(null) }}
                onSubmit={(data) => {
                  const payload = { ...data, programId: data.programId || undefined, endDate: data.endDate || undefined }
                  if (editProject) {
                    updateProject.mutate(
                      { id: editProject.id, ...payload },
                      { onSuccess: () => setEditProject(null) },
                    )
                  } else {
                    createProject.mutate(payload, {
                      onSuccess: (p) => { setShowNewProject(false); navigate(`/projects/${p.id}`) },
                    })
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {projects.length === 0 && !showNewProject ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border rounded-lg">
            <FolderKanban className="w-8 h-8 opacity-30 mb-2" />
            <p className="text-sm">No projects in this program yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs px-2"
                        onClick={(e) => { e.stopPropagation(); setEditProject(project); setShowNewProject(false) }}
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
      </div>}
    </div>
  )
}
