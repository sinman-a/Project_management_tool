import { useState } from 'react'
import { useProjects } from '@/hooks/useProjects'
import { usePrograms } from '@/hooks/useProjects'
import { StatusReportList } from '@/components/reports/StatusReportList'
import { PortfolioAnalytics } from '@/components/analytics/PortfolioAnalytics'
import { InsightsPanel } from '@/components/analytics/InsightsPanel'

type FilterMode = 'all' | 'project' | 'program'
type Tab = 'reports' | 'analytics'

export function Reports() {
  const { data: projects = [] } = useProjects()
  const { data: programs = [] } = usePrograms()
  const [tab, setTab] = useState<Tab>('reports')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedProgramId, setSelectedProgramId] = useState('')

  if (tab === 'analytics') {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <TabBar tab={tab} setTab={setTab} />
        <div>
          <h1 className="text-lg font-semibold">Portfolio Analytics</h1>
          <p className="text-sm text-muted-foreground">Predictive health, performance and risk insights across the portfolio.</p>
        </div>
        <PortfolioAnalytics />
        <InsightsPanel />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <TabBar tab={tab} setTab={setTab} />
      <div>
        <h1 className="text-lg font-semibold">Status Reports</h1>
        <p className="text-sm text-muted-foreground">Project and programme health reports with RAG status.</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 border rounded-md p-0.5 bg-muted/30">
          {(['all', 'project', 'program'] as FilterMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className={`px-3 py-1 text-sm rounded capitalize transition-colors ${
                filterMode === m ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'all' ? 'All Reports' : m === 'project' ? 'By Project' : 'By Programme'}
            </button>
          ))}
        </div>

        {filterMode === 'project' && (
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {filterMode === 'program' && (
          <select
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select programme…</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {filterMode === 'all' && (
        <StatusReportList />
      )}
      {filterMode === 'project' && selectedProjectId && (
        <StatusReportList projectId={selectedProjectId} />
      )}
      {filterMode === 'project' && !selectedProjectId && (
        <div className="py-12 text-center text-muted-foreground text-sm border rounded-lg">
          Select a project to view its reports.
        </div>
      )}
      {filterMode === 'program' && selectedProgramId && (
        <StatusReportList programId={selectedProgramId} />
      )}
      {filterMode === 'program' && !selectedProgramId && (
        <div className="py-12 text-center text-muted-foreground text-sm border rounded-lg">
          Select a programme to view its reports.
        </div>
      )}
    </div>
  )
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 border rounded-md p-0.5 bg-muted/30 w-fit">
      {([['reports', 'Status Reports'], ['analytics', 'Analytics']] as [Tab, string][]).map(([t, label]) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`px-4 py-1 text-sm rounded transition-colors ${
            tab === t ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
