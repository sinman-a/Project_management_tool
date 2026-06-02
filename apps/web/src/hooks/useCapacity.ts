import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CapacityHeatmap } from '@/types'

export function useCapacityHeatmap(params?: {
  programId?: string
  projectId?: string
  from?: string
  to?: string
  aggregation?: 'weekly' | 'monthly'
}) {
  const qs = new URLSearchParams()
  if (params?.programId) qs.set('programId', params.programId)
  if (params?.projectId) qs.set('projectId', params.projectId)
  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  if (params?.aggregation) qs.set('aggregation', params.aggregation)

  return useQuery({
    queryKey: ['capacity-heatmap', params],
    queryFn: () => api.get<CapacityHeatmap>(`/capacity/heatmap?${qs}`),
    staleTime: 60_000,
  })
}

export function useCapacityCell(resourceId?: string, period?: string) {
  return useQuery({
    queryKey: ['capacity-cell', resourceId, period],
    queryFn: () => api.get<{ resourceId: string; period: string; tasks: { id: string; name: string; projectName: string; allocatedHours: number }[] }>(
      `/capacity/heatmap/cell?resourceId=${resourceId}&period=${period}`,
    ),
    enabled: !!resourceId && !!period,
  })
}
