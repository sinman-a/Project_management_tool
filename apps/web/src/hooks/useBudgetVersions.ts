import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BudgetVersion, BudgetVariance } from '@/types'

export function useBudgetVersions(projectId: string | undefined) {
  return useQuery({
    queryKey: ['budget-versions', projectId],
    queryFn: () => api.get<BudgetVersion[]>(`/projects/${projectId}/budget-versions`),
    enabled: !!projectId,
  })
}

export function useBudgetVariance(projectId: string | undefined) {
  return useQuery({
    queryKey: ['budget-variance', projectId],
    queryFn: () => api.get<BudgetVariance>(`/projects/${projectId}/budget-variance`),
    enabled: !!projectId,
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, projectId: string) {
  qc.invalidateQueries({ queryKey: ['budget-versions', projectId] })
  qc.invalidateQueries({ queryKey: ['budget-variance', projectId] })
  qc.invalidateQueries({ queryKey: ['budget'] })
  qc.invalidateQueries({ queryKey: ['roi', projectId] })
  qc.invalidateQueries({ queryKey: ['projects'] })
}

export function useCreateBudgetVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: string; label: string; gate?: string; capex: number; opex: number; notes?: string }) =>
      api.post<BudgetVersion>(`/projects/${projectId}/budget-versions`, data),
    onSuccess: (_, vars) => invalidate(qc, vars.projectId),
  })
}

export function useUpdateBudgetVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; projectId: string; label?: string; gate?: string; capex?: number; opex?: number; notes?: string }) =>
      api.patch<BudgetVersion>(`/budget-versions/${id}`, data),
    onSuccess: (_, vars) => invalidate(qc, vars.projectId),
  })
}

export function useApproveBudgetVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => api.post<BudgetVersion>(`/budget-versions/${id}/approve`, {}),
    onSuccess: (_, vars) => invalidate(qc, vars.projectId),
  })
}

export function useActivateBudgetVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => api.post<BudgetVersion>(`/budget-versions/${id}/activate`, {}),
    onSuccess: (_, vars) => invalidate(qc, vars.projectId),
  })
}

export function useDeleteBudgetVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => api.delete(`/budget-versions/${id}`),
    onSuccess: (_, vars) => invalidate(qc, vars.projectId),
  })
}
