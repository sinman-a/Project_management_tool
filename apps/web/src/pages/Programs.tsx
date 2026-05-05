import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, Calendar, DollarSign, Archive, Trash2, Upload } from 'lucide-react'
import { ImportModal } from '@/components/settings/ImportModal'
import { usePrograms } from '@/hooks/useProjects'
import { useCreateProgram, useUpdateProgram, useDeleteProgram } from '@/hooks/usePrograms'
import { useAuthStore } from '@/stores/authStore'
import { ProgramForm } from '@/components/programs/ProgramForm'
import { RagDot } from '@/components/layout/RagDot'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Program } from '@/types'

const ARCHIVED_STATUSES = ['closed']

export function Programs() {
  const navigate = useNavigate()
  const { canCreateProjects } = useAuthStore()
  const { data: allPrograms = [], isLoading } = usePrograms()
  const createProgram = useCreateProgram()
  const updateProgram = useUpdateProgram()
  const deleteProgram = useDeleteProgram()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Program | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)

  const programs = showArchived
    ? allPrograms
    : allPrograms.filter((p) => !ARCHIVED_STATUSES.includes(p.status))

  function handleClose() {
    setShowForm(false)
    setEditTarget(null)
  }

  function handleArchive(program: Program) {
    updateProgram.mutate({ id: program.id, status: 'closed' })
  }

  function handleDelete(id: string) {
    deleteProgram.mutate(id, { onSuccess: () => setConfirmDeleteId(null) })
  }

  const archivedCount = allPrograms.filter((p) => ARCHIVED_STATUSES.includes(p.status)).length

  return (
    <>
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {programs.length} program{programs.length !== 1 ? 's' : ''} total
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
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Import
            </Button>
          )}
          {canCreateProjects() && !showForm && (
            <Button onClick={() => { setEditTarget(null); setShowForm(true) }}>
              <Plus className="w-4 h-4 mr-2" />
              New Program
            </Button>
          )}
        </div>
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

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-base">Delete Program?</h3>
            <p className="text-sm text-muted-foreground">
              All projects within this program will be unlinked (not deleted). This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteProgram.isPending}
                onClick={() => handleDelete(confirmDeleteId)}
              >
                {deleteProgram.isPending ? 'Deleting…' : 'Delete permanently'}
              </Button>
            </div>
          </div>
        </div>
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
          <p className="text-muted-foreground">
            {showArchived ? 'No programs found.' : 'No active programs.'}
          </p>
          {canCreateProjects() && !showArchived && (
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create your first program
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {programs.map((program) => {
            const isArchived = ARCHIVED_STATUSES.includes(program.status)
            return (
              <Card
                key={program.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${isArchived ? 'opacity-60' : ''}`}
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
                      <div className="flex gap-1">
                        {!isArchived && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={(e) => { e.stopPropagation(); handleArchive(program) }}
                            title="Archive program"
                          >
                            <Archive className="w-3 h-3 mr-1" /> Archive
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2"
                          onClick={(e) => { e.stopPropagation(); setEditTarget(program); setShowForm(false) }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(program.id) }}
                          title="Delete program"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>

    {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </>
  )
}
