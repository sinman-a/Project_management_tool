import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useMyResource } from '@/hooks/useResources'
import { WeeklyTimesheet } from '@/components/time/WeeklyTimesheet'
import type { Task } from '@/types'

export function Timesheet() {
  const { user } = useAuthStore()
  const resource = useMyResource(user?.id)

  const { data: assignedTasks = [], isLoading } = useQuery({
    queryKey: ['tasks', 'assigned'],
    queryFn: () => api.get<(Task & { projectName?: string })[]>('/tasks/assigned'),
    enabled: !!user,
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">My Timesheet</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Log hours against your assigned tasks
        </p>
      </div>

      {!resource ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg">
          <Clock className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium">No resource linked to your account</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ask your admin to create a resource and link it to your user account.
          </p>
        </div>
      ) : (
        <WeeklyTimesheet assignedTasks={assignedTasks} resource={resource} />
      )}
    </div>
  )
}
