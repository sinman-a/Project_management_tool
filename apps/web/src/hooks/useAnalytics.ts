import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PortfolioAnalytics, Insight, ProjectForecast } from '@/types'

export function usePortfolioAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'portfolio'],
    queryFn: () => api.get<PortfolioAnalytics>('/analytics/portfolio'),
  })
}

export function usePortfolioInsights() {
  return useQuery({
    queryKey: ['analytics', 'insights'],
    queryFn: () => api.get<Insight[]>('/analytics/insights'),
  })
}

export function useProjectForecast(projectId: string | undefined) {
  return useQuery({
    queryKey: ['analytics', 'forecast', projectId],
    queryFn: () => api.get<ProjectForecast>(`/analytics/projects/${projectId}/forecast`),
    enabled: !!projectId,
  })
}
