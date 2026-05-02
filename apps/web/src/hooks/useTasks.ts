import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Task, TaskDependency } from '@/types'

export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', { projectId }],
    queryFn: () => api.get<Task[]>(`/tasks?projectId=${projectId}`),
    enabled: !!projectId,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Task> & { projectId: string }) => api.post<Task>('/tasks', data),
    onSuccess: (t) => qc.invalidateQueries({ queryKey: ['tasks', { projectId: t.projectId }] }),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Task> & { id: string }) =>
      api.patch<Task>(`/tasks/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string }) =>
      api.delete<{ success: boolean }>(`/tasks/${id}`).then(() => projectId),
    onSuccess: (projectId) => qc.invalidateQueries({ queryKey: ['tasks', { projectId }] }),
  })
}

export function useTaskDependencies(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-deps', taskId],
    queryFn: () => api.get<TaskDependency[]>(`/tasks/${taskId}/dependencies`),
    enabled: !!taskId,
  })
}

export function useAddDependency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      taskId,
      dependsOnId,
      dependencyType = 'finish_to_start',
      lagDays = 0,
    }: {
      taskId: string
      dependsOnId: string
      dependencyType?: TaskDependency['dependencyType']
      lagDays?: number
    }) => api.post<TaskDependency>(`/tasks/${taskId}/dependencies`, { dependsOnId, dependencyType, lagDays }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['task-deps', vars.taskId] }),
  })
}

export function useRemoveDependency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, depId }: { taskId: string; depId: string }) =>
      api.delete(`/tasks/${taskId}/dependencies/${depId}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['task-deps', vars.taskId] }),
  })
}
