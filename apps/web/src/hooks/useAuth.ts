import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import type { AuthUser } from '@/types'

export function useAuth() {
  const { setUser, setLoading } = useAuthStore()

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<AuthUser>('/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    setUser(data ?? null)
    setLoading(queryLoading)
  }, [data, queryLoading, setUser, setLoading])

  // Return query data directly so ProtectedRoute sees the user immediately
  // after qc.setQueryData() — without waiting for the useEffect to sync Zustand.
  return { user: data ?? null, isLoading: queryLoading }
}
