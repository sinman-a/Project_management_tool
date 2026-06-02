import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ActivityEvent } from '@/types'

export function useProjectActivity(projectId: string | undefined, eventType?: string) {
  const params = new URLSearchParams()
  if (eventType) params.set('eventType', eventType)

  return useQuery({
    queryKey: ['activity', 'project', projectId, eventType],
    queryFn: () => api.get<ActivityEvent[]>(`/projects/${projectId}/activity?${params}`),
    enabled: !!projectId,
  })
}

export function useProgramActivity(programId: string | undefined, eventType?: string) {
  const params = new URLSearchParams()
  if (eventType) params.set('eventType', eventType)

  return useQuery({
    queryKey: ['activity', 'program', programId, eventType],
    queryFn: () => api.get<ActivityEvent[]>(`/programs/${programId}/activity?${params}`),
    enabled: !!programId,
  })
}
