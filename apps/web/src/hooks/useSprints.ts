import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Sprint } from '@/types'

export function useSprints(projectId: string | undefined) {
  return useQuery({
    queryKey: ['sprints', { projectId }],
    queryFn: () => api.get<Sprint[]>(`/sprints?projectId=${projectId}`),
    enabled: !!projectId,
  })
}

export function useCreateSprint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Sprint> & { projectId: string }) => api.post<Sprint>('/sprints', data),
    onSuccess: (s) => qc.invalidateQueries({ queryKey: ['sprints', { projectId: s.projectId }] }),
  })
}

export function useUpdateSprint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Sprint> & { id: string }) =>
      api.patch<Sprint>(`/sprints/${id}`, data),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['sprints', { projectId: s.projectId }] })
    },
  })
}

export function useDeleteSprint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string }) =>
      api.delete<{ success: boolean }>(`/sprints/${id}`).then(() => projectId),
    onSuccess: (projectId) => qc.invalidateQueries({ queryKey: ['sprints', { projectId }] }),
  })
}
