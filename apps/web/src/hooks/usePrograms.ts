import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Program } from '@/types'

export function useCreateProgram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Program>) => api.post<Program>('/programs', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
  })
}

export function useUpdateProgram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Program> & { id: string }) =>
      api.patch<Program>(`/programs/${id}`, data),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['programs'] })
      qc.invalidateQueries({ queryKey: ['programs', p.id] })
    },
  })
}
