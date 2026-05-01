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

  canManageBudget: () => get().hasRole(['admin', 'program_manager']),

  canApproveTimeLogs: () => get().hasRole(['admin', 'project_manager']),

  canCreateProjects: () => get().hasRole(['admin', 'program_manager']),
}))
