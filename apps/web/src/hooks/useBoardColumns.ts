import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface BoardColumn {
  id: string
  projectId: string
  statusKey: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
  label: string
  color: string
  position: number
  isVisible: boolean
  isDefault?: boolean
}

export function useProjectBoardColumns(projectId: string | undefined) {
  return useQuery({
    queryKey: ['board-columns', projectId],
    queryFn: () => api.get<BoardColumn[]>(`/projects/${projectId}/board-columns`),
    enabled: !!projectId,
    staleTime: 60_000,
  })
}

export function useCreateBoardColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      projectId, statusKey, label, color, position, isVisible,
    }: {
      projectId: string
      statusKey: BoardColumn['statusKey']
      label: string
      color?: string
      position?: number
      isVisible?: boolean
    }) => api.post<BoardColumn>(`/projects/${projectId}/board-columns`, { statusKey, label, color, position, isVisible }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['board-columns', vars.projectId] }),
  })
}

export function useUpdateBoardColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id, projectId, ...data
    }: Partial<BoardColumn> & { id: string; projectId: string }) =>
      api.patch<BoardColumn>(`/board-columns/${id}`, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['board-columns', vars.projectId] }),
  })
}

export function useDeleteBoardColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      api.delete(`/board-columns/${id}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['board-columns', vars.projectId] }),
  })
}

export function useResetBoardColumns() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) =>
      api.post(`/projects/${projectId}/board-columns/reset`, {}),
    onSuccess: (_, projectId) => qc.invalidateQueries({ queryKey: ['board-columns', projectId] }),
  })
}
