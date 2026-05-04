import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface OrgSettings {
  fiscalYearStart: number
  currency: string
  workingHoursPerDay: number
  customRoles: string[]
  customSeniority: string[]
  enableArchetype: boolean
  enableMotto: boolean
}

export interface OrgInfo {
  id: string
  name: string
  settings: OrgSettings
}

export function useOrgSettings() {
  return useQuery({
    queryKey: ['org'],
    queryFn: () => api.get<OrgInfo>('/org'),
  })
}

export function useUpdateOrgSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (settings: Partial<OrgSettings>) =>
      api.patch<{ settings: OrgSettings }>('/org', settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org'] }),
  })
}
