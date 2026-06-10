import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { TaskAssignment, ProjectAssignment } from '@/types'

export function useTaskAssignments(taskId: string | undefined) {
  return useQuery({
    queryKey: ['assignments', 'task', taskId],
    queryFn: () => api.get<TaskAssignment[]>(`/tasks/${taskId}/assignments`),
    enabled: !!taskId,
  })
}

export function useProjectAssignments(projectId: string | undefined) {
  return useQuery({
    queryKey: ['assignments', 'project', projectId],
    queryFn: () => api.get<ProjectAssignment[]>(`/projects/${projectId}/assignments`),
    enabled: !!projectId,
  })
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['assignments'] })
  qc.invalidateQueries({ queryKey: ['capacity-heatmap'] })
  qc.invalidateQueries({ queryKey: ['budget'] })
}

export function useAddAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, resourceId, allocatedHours }: { taskId: string; resourceId: string; allocatedHours: number }) =>
      api.post<TaskAssignment>(`/tasks/${taskId}/assignments`, { resourceId, allocatedHours }),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useUpdateAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, allocatedHours }: { id: string; allocatedHours: number }) =>
      api.patch<TaskAssignment>(`/task-assignments/${id}`, { allocatedHours }),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useRemoveAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => api.delete(`/task-assignments/${id}`),
    onSuccess: () => invalidateAll(qc),
  })
}
