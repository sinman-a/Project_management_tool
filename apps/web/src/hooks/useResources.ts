import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Resource, ResourceAllocation } from '@/types'

export function useResources() {
  return useQuery({
    queryKey: ['resources'],
    queryFn: () => api.get<Resource[]>('/resources'),
  })
}

export function useMyResource(userId: string | undefined) {
  const { data: resources = [] } = useResources()
  return resources.find((r) => r.userId === userId) ?? null
}

export function useResourceAllocations(weekStart: string) {
  return useQuery({
    queryKey: ['resourceAllocations', weekStart],
    queryFn: () => api.get<ResourceAllocation[]>(`/resources/allocations?weekStart=${weekStart}`),
    enabled: !!weekStart,
  })
}

export function useCreateResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Resource>) => api.post<Resource>('/resources', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  })
}

export function useUpdateResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Resource> & { id: string }) =>
      api.patch<Resource>(`/resources/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  })
}

export function useDeleteResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/resources/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  })
}
