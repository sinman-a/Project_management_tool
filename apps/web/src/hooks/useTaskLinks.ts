import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { TaskLink, TaskLinkType } from '@/types'

export function useTaskLinks(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-links', { taskId }],
    queryFn: () => api.get<TaskLink[]>(`/task-links?taskId=${taskId}`),
    enabled: !!taskId,
  })
}

export function useProjectLinks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['task-links', { projectId }],
    queryFn: () => api.get<TaskLink[]>(`/task-links?projectId=${projectId}`),
    enabled: !!projectId,
  })
}

export function useCreateTaskLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { sourceTaskId: string; targetTaskId: string; linkType: TaskLinkType }) =>
      api.post<TaskLink>('/task-links', data),
    onSuccess: (link) => {
      qc.invalidateQueries({ queryKey: ['task-links', { taskId: link.sourceTaskId }] })
      qc.invalidateQueries({ queryKey: ['task-links', { taskId: link.targetTaskId }] })
      qc.invalidateQueries({ queryKey: ['task-links'] })
    },
  })
}

export function useDeleteTaskLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; taskId: string }) =>
      api.delete<{ success: boolean }>(`/task-links/${id}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['task-links', { taskId: vars.taskId }] })
      qc.invalidateQueries({ queryKey: ['task-links'] })
    },
  })
}
