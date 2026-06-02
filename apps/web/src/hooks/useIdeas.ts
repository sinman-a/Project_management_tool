import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Idea, StrategicTheme } from '@/types'

export function useIdeas(params?: { status?: string; theme?: string; sort?: string }) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.theme) qs.set('theme', params.theme)
  if (params?.sort) qs.set('sort', params.sort)

  return useQuery({
    queryKey: ['ideas', params],
    queryFn: () => api.get<Idea[]>(`/ideas?${qs}`),
  })
}

export function useIdea(id: string | undefined) {
  return useQuery({
    queryKey: ['ideas', id],
    queryFn: () => api.get<Idea>(`/ideas/${id}`),
    enabled: !!id,
  })
}

export function useCreateIdea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Idea> & { title: string; problemStatement: string; themeIds?: string[] }) =>
      api.post<Idea>('/ideas', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  })
}

export function useUpdateIdea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Idea> & { id: string; themeIds?: string[] }) =>
      api.patch<Idea>(`/ideas/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  })
}

export function useTransitionIdea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, toStatus, notes }: { id: string; toStatus: string; notes?: string }) =>
      api.post<Idea>(`/ideas/${id}/transition`, { toStatus, notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  })
}

export function useApproveIdea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, comments }: { id: string; comments?: string }) =>
      api.post<Idea>(`/ideas/${id}/approve`, { comments }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  })
}

export function useRejectIdea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post<Idea>(`/ideas/${id}/reject`, { notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  })
}

export function useConvertIdea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id, programId, managerId, startDate, endDate, methodology,
    }: {
      id: string; programId?: string; managerId?: string
      startDate: string; endDate?: string; methodology?: string
    }) => api.post<{ projectId: string }>(`/ideas/${id}/convert`, {
      programId, managerId, startDate, endDate, methodology,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ideas'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useArchiveIdea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ideas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  })
}

// Strategic themes
export function useStrategicThemes() {
  return useQuery({
    queryKey: ['strategic-themes'],
    queryFn: () => api.get<StrategicTheme[]>('/strategic-themes'),
  })
}

export function useCreateTheme() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; colour?: string }) =>
      api.post<StrategicTheme>('/strategic-themes', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategic-themes'] }),
  })
}

export function useDeleteTheme() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/strategic-themes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategic-themes'] }),
  })
}

// Balance report
export function useIdeaBalanceReport() {
  return useQuery({
    queryKey: ['ideas-balance'],
    queryFn: () => api.get<{ themeName: string; colour: string | null; totalCost: number; ideaCount: number }[]>('/ideas/balance-report'),
  })
}
