import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Baseline, EVMResult } from '@/types'

export function useProjectBaselines(projectId: string | undefined) {
  return useQuery({
    queryKey: ['baselines', projectId],
    queryFn: () => api.get<Baseline[]>(`/projects/${projectId}/baselines`),
    enabled: !!projectId,
  })
}

export function useLockBaseline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, name, notes }: { projectId: string; name?: string; notes?: string }) =>
      api.post<Baseline>(`/projects/${projectId}/baselines`, { name, notes }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['baselines', vars.projectId] })
      qc.invalidateQueries({ queryKey: ['evm', vars.projectId] })
    },
  })
}

export function useProjectEVM(projectId: string | undefined) {
  return useQuery({
    queryKey: ['evm', projectId],
    queryFn: () => api.get<EVMResult>(`/projects/${projectId}/evm`),
    enabled: !!projectId,
  })
}

export function useUpdateEVConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, ...data }: {
      projectId: string
      method?: 'zero_hundred' | 'fifty_fifty' | 'percent_complete'
      spiAmberThreshold?: number
      spiRedThreshold?: number
    }) => api.patch(`/projects/${projectId}/ev-config`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['evm', vars.projectId] })
    },
  })
}
