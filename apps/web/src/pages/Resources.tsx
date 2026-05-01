import { useState } from 'react'
import { Users, Pencil, Plus } from 'lucide-react'
import { useResources, useCreateResource, useUpdateResource } from '@/hooks/useResources'
import { useAuthStore } from '@/stores/authStore'
import { ResourceForm } from '@/components/resources/ResourceForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { Resource } from '@/types'

export function Resources() {
  const { user } = useAuthStore()
  const { data: resources = [], isLoading } = useResources()
  const createResource = useCreateResource()
  const updateResource = useUpdateResource()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Resource | null>(null)

  const isAdmin = user?.role === 'admin'

  function handleClose() {
    setShowForm(false)
    setEditTarget(null)
  }

  const humans = resources.filter((r) => r.type === 'human')
  const equipment = resources.filter((r) => r.type === 'equipment')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resources</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {resources.length} resource{resources.length !== 1 ? 's' : ''} total
          </p>
        </div>
        {isAdmin && !showForm && !editTarget && (
          <Button onClick={() => { setEditTarget(null); setShowForm(true) }}>
            <Plus className="w-4 h-4 mr-2" /> New Resource
          </Button>
        )}
      </div>

      {(showForm || editTarget) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editTarget ? `Edit — ${editTarget.name}` : 'New Resource'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResourceForm
              resource={editTarget ?? undefined}
              isPending={createResource.isPending || updateResource.isPending}
              onCancel={handleClose}
              onSubmit={(data) => {
                if (editTarget) {
                  updateResource.mutate({ id: editTarget.id, ...data }, { onSuccess: handleClose })
                } else {
                  createResource.mutate(data, { onSuccess: handleClose })
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No resources yet.</p>
          {isAdmin && (
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add first resource
            </Button>
          )}
        </div>
      ) : (
        <>
          {humans.length > 0 && (
            <ResourceGroup
              title="Human Resources"
              resources={humans}
              isAdmin={isAdmin}
              onEdit={(r) => { setEditTarget(r); setShowForm(false) }}
            />
          )}
          {equipment.length > 0 && (
            <ResourceGroup
              title="Equipment"
              resources={equipment}
              isAdmin={isAdmin}
              onEdit={(r) => { setEditTarget(r); setShowForm(false) }}
            />
          )}
        </>
      )}
    </div>
  )
}

function ResourceGroup({
  title,
  resources,
  isAdmin,
  onEdit,
}: {
  title: string
  resources: Resource[]
  isAdmin: boolean
  onEdit: (r: Resource) => void
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {resources.map((resource) => (
          <Card key={resource.id} className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-semibold">{resource.name}</CardTitle>
                <div className="flex gap-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${resource.costType === 'capex' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {resource.costType.toUpperCase()}
                  </span>
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-6 h-6"
                      onClick={() => onEdit(resource)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-1 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Rate</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(resource.rate)}/{resource.currency}/h
                </span>
              </div>
              <div className="flex justify-between">
                <span>Capacity</span>
                <span>{resource.capacityHoursPerWeek}h/week</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
