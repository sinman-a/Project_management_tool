import { create } from 'zustand'

type DashboardView = 'portfolio' | 'heatmap' | 'gantt' | 'board'

interface UiState {
  sidebarCollapsed: boolean
  dashboardView: DashboardView
  selectedProgramId: string | null
  selectedProjectId: string | null
  selectedTaskId: string | null
  toggleSidebar: () => void
  setDashboardView: (view: DashboardView) => void
  selectProgram: (id: string | null) => void
  selectProject: (id: string | null) => void
  selectTask: (id: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  dashboardView: 'portfolio',
  selectedProgramId: null,
  selectedProjectId: null,
  selectedTaskId: null,

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setDashboardView: (dashboardView) => set({ dashboardView }),
  selectProgram: (selectedProgramId) => set({ selectedProgramId, selectedProjectId: null, selectedTaskId: null }),
  selectProject: (selectedProjectId) => set({ selectedProjectId, selectedTaskId: null }),
  selectTask: (selectedTaskId) => set({ selectedTaskId }),
}))
