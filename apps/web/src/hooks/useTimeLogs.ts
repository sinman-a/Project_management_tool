import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { TimeLog } from '@/types'

interface CreateTimeLogInput {
  taskId: string
  resourceId: string
  logDate: string
  hours: number
  description?: string
  isBillable?: boolean
}

export function useMyTimeLogs() {
  return useQuery({
    queryKey: ['time-logs', 'mine'],
    queryFn: () => api.get<TimeLog[]>('/time-logs/mine'),
  })
}

export function useWeekTimeLogs(weekStart: string) {
  return useQuery({
    queryKey: ['time-logs', 'week', weekStart],
    queryFn: () => api.get<TimeLog[]>(`/time-logs/week?weekStart=${weekStart}`),
    enabled: !!weekStart,
  })
}

// Alias for backward compatibility with Dashboard
export function usePendingApprovals(projectId: string) {
  return useProjectTimeLogs(projectId, false)
}

export function useProjectTimeLogs(projectId: string | undefined, approved?: boolean) {
  const qs = approved !== undefined ? `?approved=${approved}` : ''
  return useQuery({
    queryKey: ['time-logs', 'project', projectId, approved],
    queryFn: () => api.get<TimeLog[]>(`/time-logs/project/${projectId}${qs}`),
    enabled: !!projectId,
  })
}

export function useCreateTimeLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTimeLogInput) => api.post<TimeLog>('/time-logs', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-logs'] })
      qc.invalidateQueries({ queryKey: ['budget'] })
    },
  })
}

export function useDeleteTimeLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/time-logs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-logs'] }),
  })
}

export function useApproveTimeLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<TimeLog>(`/time-logs/${id}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-logs'] })
      qc.invalidateQueries({ queryKey: ['budget'] })
    },
  })
}
