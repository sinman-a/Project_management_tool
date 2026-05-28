import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ProjectDependency, DependencyType } from '@/types'

export function useProgramProjectDeps(programId: string | undefined) {
  return useQuery({
    queryKey: ['project-deps', { programId }],
    queryFn: () => api.get<ProjectDependency[]>(`/programs/${programId}/project-dependencies`),
    enabled: !!programId,
  })
}

export function useAddProjectDependency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      programId,
      projectId,
      dependsOnId,
      dependencyType = 'finish_to_start',
      lagDays = 0,
    }: {
      programId: string
      projectId: string
      dependsOnId: string
      dependencyType?: DependencyType
      lagDays?: number
    }) =>
      api.post<ProjectDependency>(`/programs/${programId}/project-dependencies`, {
        projectId,
        dependsOnId,
        dependencyType,
        lagDays,
      }),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['project-deps', { programId: vars.programId }] }),
  })
}

export function useRemoveProjectDependency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ programId, depId }: { programId: string; depId: string }) =>
      api.delete(`/programs/${programId}/project-dependencies/${depId}`),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['project-deps', { programId: vars.programId }] }),
  })
}
