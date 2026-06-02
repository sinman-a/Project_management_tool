import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CostEstimation, CostEstimationListItem, CostEstimationGrade, CostEstimationRow } from '@/types'

// ── List ────────────────────────────────────────────────────────────────────
export function useProjectCostEstimations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['cost-estimations', projectId],
    queryFn: () => api.get<CostEstimationListItem[]>(`/projects/${projectId}/cost-estimations`),
    enabled: !!projectId,
  })
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useCostEstimation(id: string | undefined) {
  return useQuery({
    queryKey: ['cost-estimation', id],
    queryFn: () => api.get<CostEstimation>(`/cost-estimations/${id}`),
    enabled: !!id,
  })
}

// ── Create / Update / Delete estimation ─────────────────────────────────────
export function useCreateCostEstimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      projectId, name, notes, currency,
    }: { projectId: string; name?: string; notes?: string; currency?: string }) =>
      api.post<CostEstimationListItem>(`/projects/${projectId}/cost-estimations`, { name, notes, currency }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['cost-estimations', vars.projectId] }),
  })
}

export function useUpdateCostEstimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id, projectId, ...data
    }: { id: string; projectId: string; name?: string; notes?: string; currency?: string }) =>
      api.patch<CostEstimationListItem>(`/cost-estimations/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['cost-estimations', vars.projectId] })
      qc.invalidateQueries({ queryKey: ['cost-estimation', vars.id] })
    },
  })
}

export function useDeleteCostEstimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      api.delete(`/cost-estimations/${id}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['cost-estimations', vars.projectId] }),
  })
}

// ── Grades ──────────────────────────────────────────────────────────────────
export function useAddGrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      estimationId, name, ratePerDay, costType,
    }: { estimationId: string; name: string; ratePerDay: number; costType: 'capex' | 'opex' }) =>
      api.post<CostEstimationGrade>(`/cost-estimations/${estimationId}/grades`, { name, ratePerDay, costType }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['cost-estimation', vars.estimationId] }),
  })
}

export function useUpdateGrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id, estimationId, ...data
    }: { id: string; estimationId: string; name?: string; ratePerDay?: number; costType?: 'capex' | 'opex'; position?: number }) =>
      api.patch<CostEstimationGrade>(`/cost-estimation-grades/${id}`, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['cost-estimation', vars.estimationId] }),
  })
}

export function useDeleteGrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; estimationId: string }) =>
      api.delete(`/cost-estimation-grades/${id}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['cost-estimation', vars.estimationId] }),
  })
}

// ── Rows ────────────────────────────────────────────────────────────────────
export function useAddRow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      estimationId, stage, workDescription,
    }: { estimationId: string; stage?: string; workDescription?: string }) =>
      api.post<CostEstimationRow>(`/cost-estimations/${estimationId}/rows`, { stage, workDescription }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['cost-estimation', vars.estimationId] }),
  })
}

export function useUpdateRow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id, estimationId, ...data
    }: { id: string; estimationId: string; stage?: string; workDescription?: string; position?: number }) =>
      api.patch<CostEstimationRow>(`/cost-estimation-rows/${id}`, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['cost-estimation', vars.estimationId] }),
  })
}

export function useDeleteRow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; estimationId: string }) =>
      api.delete(`/cost-estimation-rows/${id}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['cost-estimation', vars.estimationId] }),
  })
}

// ── Cell upsert ─────────────────────────────────────────────────────────────
export function useUpsertCell() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      rowId, gradeId, days,
    }: { rowId: string; gradeId: string; days: number; estimationId: string }) =>
      api.put<{ rowId: string; gradeId: string; days: number }>(
        '/cost-estimation-cells',
        { rowId, gradeId, days },
      ),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['cost-estimation', vars.estimationId] }),
  })
}
