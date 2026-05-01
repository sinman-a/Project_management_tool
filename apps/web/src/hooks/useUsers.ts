import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { User } from '@/types'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users'),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; fullName: string; role: User['role']; password: string }) =>
      api.post<User>('/users', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<User> & { id: string; password?: string }) =>
      api.patch<User>(`/users/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

const WORKER_URL = import.meta.env.VITE_API_URL ?? '/api'

export function useSetupStatus() {
  return useQuery({
    queryKey: ['auth', 'setup-status'],
    queryFn: async () => {
      const res = await fetch(`${WORKER_URL}/auth/setup/status`, { credentials: 'include' })
      return res.json() as Promise<{ needsSetup: boolean }>
    },
    staleTime: Infinity,
    retry: false,
  })
}
