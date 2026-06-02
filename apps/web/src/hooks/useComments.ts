import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Comment } from '@/types'

export function useComments(entityType: string | undefined, entityId: string | undefined) {
  return useQuery({
    queryKey: ['comments', { entityType, entityId }],
    queryFn: () => api.get<Comment[]>(`/comments?entityType=${entityType}&entityId=${entityId}`),
    enabled: !!entityType && !!entityId,
  })
}

export function useCreateComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { entityType: string; entityId: string; body: string; parentCommentId?: string }) =>
      api.post<Comment>('/comments', data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['comments', { entityType: vars.entityType, entityId: vars.entityId }] })
    },
  })
}

export function usePinComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; entityType: string; entityId: string }) =>
      api.post(`/comments/${id}/pin`, {}),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['comments', { entityType: vars.entityType, entityId: vars.entityId }] })
    },
  })
}

export function useDeleteComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; entityType: string; entityId: string }) =>
      api.delete(`/comments/${id}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['comments', { entityType: vars.entityType, entityId: vars.entityId }] })
    },
  })
}
