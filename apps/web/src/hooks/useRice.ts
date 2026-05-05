import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { RiceItem } from '@/types'

export function useRiceItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['rice', { projectId }],
    queryFn: () => api.get<RiceItem[]>(`/rice?projectId=${projectId}`),
    enabled: !!projectId,
  })
}

export function useCreateRiceItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<RiceItem> & { projectId: string }) =>
      api.post<RiceItem>('/rice', data),
    onSuccess: (item) => qc.invalidateQueries({ queryKey: ['rice', { projectId: item.projectId }] }),
  })
}

export function useUpdateRiceItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, projectId, ...data }: Partial<RiceItem> & { id: string; projectId: string }) =>
      api.patch<RiceItem>(`/rice/${id}`, data).then((r) => ({ ...r, projectId })),
    onSuccess: (item) => qc.invalidateQueries({ queryKey: ['rice', { projectId: item.projectId }] }),
  })
}

export function useDeleteRiceItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string }) =>
      api.delete<{ success: boolean }>(`/rice/${id}`).then(() => projectId),
    onSuccess: (projectId) => qc.invalidateQueries({ queryKey: ['rice', { projectId }] }),
  })
}
