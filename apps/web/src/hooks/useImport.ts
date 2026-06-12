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

// ── Bulk entity import (CSV / Google Sheets) ─────────────────────────────────

export type ImportEntityType = 'portfolio' | 'program' | 'project' | 'resource'

export interface EntityImportResult {
  created: number
  skipped: number
  errors: { row: number; message: string }[]
}

const ENTITY_QUERY_KEY: Record<ImportEntityType, string> = {
  portfolio: 'portfolios',
  program: 'programs',
  project: 'projects',
  resource: 'resources',
}

export function useEntityImport(entityType: ImportEntityType) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { file?: File; sheetUrl?: string }) => {
      if (input.file) {
        const fd = new FormData()
        fd.append('entityType', entityType)
        fd.append('file', input.file)
        return api.postForm<EntityImportResult>('/import/entities', fd)
      }
      return api.post<EntityImportResult>('/import/entities', { entityType, sheetUrl: input.sheetUrl })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ENTITY_QUERY_KEY[entityType]] })
    },
  })
}

/** Column headers + one example row for each entity's downloadable CSV template. */
const ENTITY_TEMPLATES: Record<ImportEntityType, string> = {
  portfolio: 'name,description\nDigital Transformation,Org-wide modernisation portfolio',
  program: 'name,description,start_date,end_date,budget_capex,budget_opex,portfolio\nCustomer Platform,Unified customer program,2026-01-01,2026-12-31,500000,200000,Digital Transformation',
  project: 'name,description,methodology,start_date,end_date,budget_capex,budget_opex,expected_benefit,program\nMobile App,iOS + Android app,agile,2026-02-01,2026-08-31,300000,120000,900000,Customer Platform',
  resource: 'name,email,type,cost_type,rate,currency,capacity_hours_per_week,role,seniority_level,location\nJane Doe,jane@acme.com,human,opex,85,USD,40,Engineer,Senior,Remote',
}

export function entityTemplateCsv(entityType: ImportEntityType): string {
  return ENTITY_TEMPLATES[entityType]
}
