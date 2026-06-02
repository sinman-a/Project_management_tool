import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface StatusReport {
  id: string
  projectId: string | null
  programId: string | null
  authorId: string
  authorName: string | null
  projectName: string | null
  programName: string | null
  reportDate: string
  periodStart: string
  periodEnd: string
  overallStatus: 'green' | 'amber' | 'red'
  scheduleStatus: 'green' | 'amber' | 'red'
  budgetStatus: 'green' | 'amber' | 'red'
  scopeStatus: 'green' | 'amber' | 'red'
  narrativeThisPeriod: string | null
  narrativeNextPeriod: string | null
  risksIssues: string | null
  createdAt: string
}

export interface CreateReportInput {
  projectId?: string | null
  programId?: string | null
  reportDate: string
  periodStart: string
  periodEnd: string
  overallStatus: 'green' | 'amber' | 'red'
  scheduleStatus: 'green' | 'amber' | 'red'
  budgetStatus: 'green' | 'amber' | 'red'
  scopeStatus: 'green' | 'amber' | 'red'
  narrativeThisPeriod?: string
  narrativeNextPeriod?: string
  risksIssues?: string
}

export function useReports(params?: { projectId?: string; programId?: string }) {
  const qs = new URLSearchParams()
  if (params?.projectId) qs.set('projectId', params.projectId)
  if (params?.programId) qs.set('programId', params.programId)
  const query = qs.toString()

  return useQuery({
    queryKey: ['reports', params],
    queryFn: () => api.get<StatusReport[]>(`/reports${query ? `?${query}` : ''}`),
    enabled: params?.projectId !== '',
    staleTime: 60_000,
  })
}

export function useReport(id: string) {
  return useQuery({
    queryKey: ['reports', id],
    queryFn: () => api.get<StatusReport>(`/reports/${id}`),
    enabled: !!id,
  })
}

export function useCreateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateReportInput) => api.post<StatusReport>('/reports', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })
}

export function useUpdateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CreateReportInput> & { id: string }) =>
      api.patch<StatusReport>(`/reports/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })
}

export function useDeleteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/reports/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })
}

export interface RAGSuggestion {
  rags: { overall: 'green' | 'amber' | 'red'; schedule: 'green' | 'amber' | 'red'; budget: 'green' | 'amber' | 'red'; scope: 'green' | 'amber' | 'red' }
  reasoning: { overall: string; schedule: string; budget: string; scope: string }
  ruleVersion: string
}

export function useRAGSuggestion(projectId: string | undefined) {
  return useQuery({
    queryKey: ['rag-suggestion', projectId],
    queryFn: () => api.get<RAGSuggestion>(`/projects/${projectId}/status-reports/suggestion`),
    enabled: !!projectId,
    staleTime: 300_000,
  })
}
