import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { RiskCategory } from '@/types'

export function useRiskCategories() {
  return useQuery({
    queryKey: ['risk-categories'],
    queryFn: () => api.get<RiskCategory[]>('/risk-categories'),
  })
}

export function useCreateRiskCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post<RiskCategory>('/risk-categories', { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk-categories'] }),
  })
}

export function useDeleteRiskCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/risk-categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk-categories'] }),
  })
}
