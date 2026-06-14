import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface SearchResults {
  projects: { id: string; name: string; status: string }[]
  tasks: { id: string; name: string; projectId: string }[]
  risks: { id: string; title: string; projectId: string }[]
  ideas: { id: string; title: string }[]
  resources: { id: string; name: string; role: string | null }[]
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get<SearchResults>(`/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  })
}
