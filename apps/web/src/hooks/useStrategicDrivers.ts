import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { StrategicDriver, IdeaRanking } from '@/types'

export function useStrategicDrivers() {
  return useQuery({
    queryKey: ['strategic-drivers'],
    queryFn: () => api.get<StrategicDriver[]>('/strategic-drivers'),
  })
}

export function useCreateDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; weight: number; isActive?: boolean }) =>
      api.post<StrategicDriver>('/strategic-drivers', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategic-drivers'] }),
  })
}

export function useUpdateDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; weight?: number; isActive?: boolean; position?: number }) =>
      api.patch<StrategicDriver>(`/strategic-drivers/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['strategic-drivers'] })
      qc.invalidateQueries({ queryKey: ['idea-ranking'] })
    },
  })
}

export function useDeleteDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/strategic-drivers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['strategic-drivers'] })
      qc.invalidateQueries({ queryKey: ['idea-ranking'] })
    },
  })
}

export function useIdeaRanking(status?: string) {
  const qs = status ? `?status=${status}` : ''
  return useQuery({
    queryKey: ['idea-ranking', status ?? 'all'],
    queryFn: () => api.get<IdeaRanking>(`/ideas/ranking${qs}`),
  })
}

export function useSetIdeaDriverScores() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ideaId, scores }: { ideaId: string; scores: { driverId: string; score: number }[] }) =>
      api.put<{ driverScores: Record<string, number> }>(`/ideas/${ideaId}/driver-scores`, { scores }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ideas', vars.ideaId] })
      qc.invalidateQueries({ queryKey: ['idea-ranking'] })
    },
  })
}
