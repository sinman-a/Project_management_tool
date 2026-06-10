import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Portfolio, PortfolioSummary } from '@/types'

export function usePortfolios() {
  return useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.get<Portfolio[]>('/portfolios'),
  })
}

export function usePortfolio(id: string | undefined) {
  return useQuery({
    queryKey: ['portfolio', id],
    queryFn: () => api.get<Portfolio>(`/portfolios/${id}`),
    enabled: !!id,
  })
}

export function usePortfolioSummary(id: string | undefined) {
  return useQuery({
    queryKey: ['portfolio-summary', id],
    queryFn: () => api.get<PortfolioSummary>(`/portfolios/${id}/summary`),
    enabled: !!id,
  })
}

export function useCreatePortfolio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; ownerId?: string }) =>
      api.post<Portfolio>('/portfolios', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolios'] }),
  })
}

export function useUpdatePortfolio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; ownerId?: string }) =>
      api.patch<Portfolio>(`/portfolios/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['portfolios'] })
      qc.invalidateQueries({ queryKey: ['portfolio', vars.id] })
    },
  })
}

export function useDeletePortfolio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/portfolios/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolios'] })
      qc.invalidateQueries({ queryKey: ['programs'] })
    },
  })
}
