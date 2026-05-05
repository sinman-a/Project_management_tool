import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface AsanaWorkspace {
  gid: string
  name: string
}

export interface AsanaProject {
  gid: string
  name: string
  notes: string
}

export interface ImportResult {
  projectId: string
  projectName: string
  taskCount: number
  sprintCount: number
}

export function useAsanaStatus() {
  return useQuery({
    queryKey: ['asana', 'status'],
    queryFn: () => api.get<{ connected: boolean }>('/import/asana/status'),
  })
}

export function useAsanaWorkspaces(enabled: boolean) {
  return useQuery({
    queryKey: ['asana', 'workspaces'],
    queryFn: () => api.get<AsanaWorkspace[]>('/import/asana/workspaces'),
    enabled,
  })
}

export function useAsanaProjects(workspaceId: string | null) {
  return useQuery({
    queryKey: ['asana', 'projects', workspaceId],
    queryFn: () => api.get<AsanaProject[]>(`/import/asana/projects?workspaceId=${workspaceId}`),
    enabled: !!workspaceId,
  })
}

export function useAsanaImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { projectGid: string; programId?: string }) =>
      api.post<ImportResult>('/import/asana/run', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['programs'] })
    },
  })
}

export function useAsanaDisconnect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete<void>('/import/asana/disconnect'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asana'] })
    },
  })
}

export function useFileImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) =>
      api.postForm<ImportResult>('/import/file', formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
