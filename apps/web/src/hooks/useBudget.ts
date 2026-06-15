import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BudgetSnapshot, Project, RoiResult } from '@/types'

export function useProjectBudget(projectId: string) {
  return useQuery({
    queryKey: ['budget', 'project', projectId],
    queryFn: () => api.get<BudgetSnapshot>(`/projects/${projectId}/budget`),
    enabled: !!projectId,
    staleTime: 65_000,
  })
}

export function useProjectRoi(projectId: string | undefined) {
  return useQuery({
    queryKey: ['roi', projectId],
    queryFn: () => api.get<RoiResult>(`/projects/${projectId}/roi`),
    enabled: !!projectId,
    staleTime: 65_000,
  })
}

export function useProjectBudgetHistory(projectId: string | undefined) {
  return useQuery({
    queryKey: ['budget', 'history', projectId],
    queryFn: () => api.get<BudgetSnapshot[]>(`/projects/${projectId}/budget/history`),
    enabled: !!projectId,
    staleTime: 65_000,
  })
}

export type ProjectWithBudget = Project & {
  spentCapex?: number
  spentOpex?: number
  committedCapex?: number
  committedOpex?: number
  eacCapex?: number
  eacOpex?: number
  burnRateCapex?: number
  burnRateOpex?: number
  lastSnapshotDate?: string
  taskTotal?: number
  taskDone?: number
}

export function usePortfolioSummary() {
  return useQuery({
    queryKey: ['portfolio', 'summary'],
    queryFn: () => api.get<ProjectWithBudget[]>('/projects/portfolio/summary'),
    staleTime: 60_000,
  })
}

export function useRecalculateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) =>
      api.post<BudgetSnapshot>(`/projects/${projectId}/budget/recalculate`, {}),
    onSuccess: (data, projectId) => {
      // Use the response directly — avoids round-trip to KV which may not have propagated yet
      qc.setQueryData(['budget', 'project', projectId], data)
      qc.invalidateQueries({ queryKey: ['budget', 'history', projectId] })
      qc.invalidateQueries({ queryKey: ['portfolio', 'summary'] })
    },
  })
}

export function useProgramBudget(programId: string) {
  return useQuery({
    queryKey: ['budget', 'program', programId],
    queryFn: () => api.get<BudgetSnapshot>(`/programs/${programId}/budget`),
    enabled: !!programId,
    staleTime: 65_000,
  })
}
