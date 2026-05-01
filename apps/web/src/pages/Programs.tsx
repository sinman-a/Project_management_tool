import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, Calendar, DollarSign } from 'lucide-react'
import { usePrograms } from '@/hooks/useProjects'
import { useCreateProgram, useUpdateProgram } from '@/hooks/usePrograms'
import { useAuthStore } from '@/stores/authStore'
import { ProgramForm } from '@/components/programs/ProgramForm'
import { RagDot } from '@/components/layout/RagDot'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Program } from '@/types'

export function Programs() {
  const navigate = useNavigate()
  const { canCreateProjects } = useAuthStore()
  const { data: programs = [], isLoading } = usePrograms()
  const createProgram = useCreateProgram()
  const updateProgram = useUpdateProgram()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Program | null>(null)

  function handleClose() {
    setShowForm(false)
    setEditTarget(null)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {programs.length} program{programs.length !== 1 ? 's' : ''} total
          </p>
        </div>
        {canCreateProjects() && !showForm && (
          <Button onClick={() => { setEditTarget(null); setShowForm(true) }}>
            <Plus className="w-4 h-4 mr-2" />
            New Program
          </Button>
        )}
      </div>

      {(showForm || editTarget) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editTarget ? `Edit — ${editTarget.name}` : 'New Program'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(createProgram.isError || updateProgram.isError) && (
              <p className="text-sm text-destructive mb-3">
                {(createProgram.error ?? updateProgram.error)?.message ?? 'An error occurred. Please try again.'}
              </p>
            )}
            <ProgramForm
              program={editTarget ?? undefined}
              isPending={createProgram.isPending || updateProgram.isPending}
              onCancel={handleClose}
              onSubmit={(data) => {
                const payload = { ...data, endDate: data.endDate || undefined }
                if (editTarget) {
                  updateProgram.mutate({ id: editTarget.id, ...payload }, { onSuccess: handleClose })
                } else {
                  createProgram.mutate(payload, { onSuccess: handleClose })
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No programs yet.</p>
          {canCreateProjects() && (
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create your first program
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {programs.map((program) => (
            <Card
              key={program.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/programs/${program.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <RagDot status={program.ragStatus ?? 'green'} />
                    <CardTitle className="text-sm font-semibold truncate">{program.name}</CardTitle>
                  </div>
                  <StatusBadge status={program.status} />
                </div>
                {program.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{program.description}</p>
                )}
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(program.startDate)}
                    {program.endDate && ` → ${formatDate(program.endDate)}`}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    CAPEX {formatCurrency(program.budgetCapex)} · OPEX {formatCurrency(program.budgetOpex)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    {program.projectCount ?? 0} project{program.projectCount !== 1 ? 's' : ''}
                  </span>
                  {canCreateProjects() && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs px-2"
                      onClick={(e) => { e.stopPropagation(); setEditTarget(program); setShowForm(false) }}
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
