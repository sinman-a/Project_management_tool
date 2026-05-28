import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Risk, RiskHeatmapCell } from '@/types'

function toQs(params: Record<string, string | undefined>) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  if (!entries.length) return ''
  return '?' + new URLSearchParams(entries).toString()
}

export function useRisks(params: {
  projectId?: string
  programId?: string
  status?: string
  scoreBand?: string
  category?: string
}) {
  const qs = toQs(params as Record<string, string | undefined>)
  return useQuery({
    queryKey: ['risks', params],
    queryFn: () => api.get<Risk[]>(`/risks${qs}`),
    enabled: !!(params.projectId || params.programId),
  })
}

export function useRiskHeatmap(projectId: string | undefined) {
  return useQuery({
    queryKey: ['risks-heatmap', { projectId }],
    queryFn: () => api.get<{ cells: RiskHeatmapCell[] }>(`/risks/heatmap?projectId=${projectId}`),
    enabled: !!projectId,
  })
}

export function useTopRisks(projectId: string | undefined, n = 3) {
  return useQuery({
    queryKey: ['risks-top', { projectId, n }],
    queryFn: () => api.get<Risk[]>(`/risks/top?projectId=${projectId}&n=${n}`),
    enabled: !!projectId,
  })
}

export function useCreateRisk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Risk, 'id' | 'riskNumber' | 'score' | 'scoreBand' | 'createdBy' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'ownerName' | 'projectName'>) =>
      api.post<Risk>('/risks', data),
    onSuccess: (risk) => {
      qc.invalidateQueries({ queryKey: ['risks'] })
      qc.invalidateQueries({ queryKey: ['risks-top', { projectId: risk.projectId }] })
      qc.invalidateQueries({ queryKey: ['risks-heatmap', { projectId: risk.projectId }] })
    },
  })
}

export function useUpdateRisk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Risk> & { id: string }) =>
      api.patch<Risk>(`/risks/${id}`, data),
    onSuccess: (risk) => {
      qc.invalidateQueries({ queryKey: ['risks'] })
      qc.invalidateQueries({ queryKey: ['risks-top', { projectId: risk.projectId }] })
      qc.invalidateQueries({ queryKey: ['risks-heatmap', { projectId: risk.projectId }] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteRisk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      api.delete<{ success: boolean }>(`/risks/${id}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['risks'] })
      qc.invalidateQueries({ queryKey: ['risks-top', { projectId: vars.projectId }] })
      qc.invalidateQueries({ queryKey: ['risks-heatmap', { projectId: vars.projectId }] })
    },
  })
}
