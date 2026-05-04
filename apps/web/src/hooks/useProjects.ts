import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Project, Program } from '@/types'

export function usePrograms() {
  return useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<Program[]>('/programs'),
  })
}

export function useProgram(id: string) {
  return useQuery({
    queryKey: ['programs', id],
    queryFn: () => api.get<Program>(`/programs/${id}`),
    enabled: !!id,
  })
}

export function useProjects(programId?: string) {
  return useQuery({
    queryKey: ['projects', { programId }],
    queryFn: () =>
      programId
        ? api.get<Project[]>(`/programs/${programId}/projects`)
        : api.get<Project[]>('/projects'),
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<Project>(`/projects/${id}`),
    enabled: !!id,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Project>) => api.post<Project>('/projects', data),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      if (project.programId) qc.invalidateQueries({ queryKey: ['programs', project.programId] })
    },
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Project> & { id: string }) =>
      api.patch<Project>(`/projects/${id}`, data),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects', project.id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['portfolio', 'summary'] })
    },
  })
}
