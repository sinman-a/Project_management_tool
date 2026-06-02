import { create } from 'zustand'
import type { AuthUser, UserRole } from '@/types'

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void
  hasRole: (roles: UserRole[]) => boolean
  canManageBudget: () => boolean
  canApproveTimeLogs: () => boolean
  canCreateProjects: () => boolean
  isReadOnly: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  hasRole: (roles) => {
    const user = get().user
    return user !== null && roles.includes(user.role)
  },

  canManageBudget: () => get().hasRole(['admin', 'program_manager', 'pmo_lead']),

  canApproveTimeLogs: () => get().hasRole(['admin', 'project_manager', 'pmo_lead']),

  canCreateProjects: () => get().hasRole(['admin', 'program_manager', 'pmo_lead']),

  isReadOnly: () => get().hasRole(['sponsor', 'viewer']),
}))
