import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AuthEvent } from '@/types'

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post<{ ok: boolean }>('/users/me/change-password', data),
  })
}

export function useLogoutAll() {
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/auth/logout-all', {}),
  })
}

// ── 2FA enrollment ───────────────────────────────────────────────────────────

export function useStart2fa() {
  return useMutation({
    mutationFn: () => api.post<{ secret: string; otpauthUri: string }>('/auth/2fa/setup', {}),
  })
}

export function useEnable2fa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => api.post<{ backupCodes: string[] }>('/auth/2fa/enable', { code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
  })
}

export function useDisable2fa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => api.post<{ ok: boolean }>('/auth/2fa/disable', { code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
  })
}

// ── Admin: login audit log + force-logout ─────────────────────────────────────

export function useAuthEvents(enabled: boolean) {
  return useQuery({
    queryKey: ['auth', 'events'],
    queryFn: () => api.get<AuthEvent[]>('/auth/events'),
    enabled,
  })
}

export function useRevokeSessions() {
  return useMutation({
    mutationFn: (userId: string) => api.post<{ ok: boolean }>(`/users/${userId}/revoke-sessions`, {}),
  })
}
