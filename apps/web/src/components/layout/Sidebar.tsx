import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeft, LayoutDashboard, FolderOpen, FolderKanban, Users, BarChart3, Settings, Clock, Layers, Lightbulb } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { usePrograms, useProjects } from '@/hooks/useProjects'
import { useUiStore } from '@/stores/uiStore'
import { RagDot } from './RagDot'
import { Button } from '@/components/ui/button'
import type { Program } from '@/types'

function ProgramNode({ program }: { program: Program }) {
  const [expanded, setExpanded] = useState(true)
  const { data: projects = [] } = useProjects(program.id)
  const { selectedProjectId, selectedProgramId } = useUiStore()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div>
      <button
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left',
          (selectedProgramId === program.id && !selectedProjectId) ||
            location.pathname === `/programs/${program.id}` ? 'bg-accent font-medium' : '',
        )}
        onClick={() => {
          setExpanded((e) => !e)
          navigate(`/programs/${program.id}`)
        }}
      >
        {expanded ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
        <RagDot status={program.ragStatus ?? 'green'} size="sm" />
        <span className="truncate">{program.name}</span>
      </button>

      {expanded && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          {projects.map((project) => (
            <button
              key={project.id}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1 text-xs rounded-md hover:bg-accent transition-colors text-left',
                (selectedProjectId === project.id || location.pathname === `/projects/${project.id}`) && 'bg-accent font-medium',
              )}
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <RagDot status={project.ragStatus ?? 'green'} size="sm" />
              <span className="truncate">{project.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NavLink({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const active = location.pathname === to || location.pathname.startsWith(to + '/')

  return (
    <button
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left',
        active && 'bg-accent font-medium',
      )}
      onClick={() => navigate(to)}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore()
  const { data: programs = [] } = usePrograms()

  if (sidebarCollapsed) {
    return (
      <div className="w-10 border-r flex flex-col items-center pt-3">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="w-8 h-8">
          <PanelLeft className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  return (
    <aside className="w-60 border-r flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Navigation
        </span>
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="w-7 h-7">
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-2 space-y-0.5 border-b">
        <NavLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavLink to="/portfolios" icon={Layers} label="Portfolios" />
        <NavLink to="/programs" icon={FolderOpen} label="Programs" />
        <NavLink to="/projects" icon={FolderKanban} label="All Projects" />
        <NavLink to="/ideas" icon={Lightbulb} label="Ideas" />
        <NavLink to="/resources" icon={Users} label="Resources" />
        <NavLink to="/timesheet" icon={Clock} label="Timesheet" />
        <NavLink to="/reports" icon={BarChart3} label="Reports" />
        <NavLink to="/settings" icon={Settings} label="Settings" />
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
          Portfolio
        </p>
        {programs.map((program) => (
          <ProgramNode key={program.id} program={program} />
        ))}
        {programs.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-2">No programs yet.</p>
        )}
      </div>
    </aside>
  )
}
