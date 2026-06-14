import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FolderKanban, CheckSquare, ShieldAlert, Lightbulb, Users, LayoutDashboard, ArrowRight } from 'lucide-react'
import { useSearch } from '@/hooks/useSearch'

interface FlatItem {
  group: string
  icon: React.ElementType
  label: string
  sub?: string
  to: string
}

const QUICK_NAV: FlatItem[] = [
  { group: 'Go to', icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { group: 'Go to', icon: FolderKanban, label: 'Projects', to: '/projects' },
  { group: 'Go to', icon: Lightbulb, label: 'Ideas', to: '/ideas' },
  { group: 'Go to', icon: Users, label: 'Resources', to: '/resources' },
]

function isTypingTarget(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

export function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(0)
  const [showHelp, setShowHelp] = useState(false)

  // Debounce the query feeding the search request.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200)
    return () => clearTimeout(t)
  }, [query])

  const { data } = useSearch(debounced)

  const items = useMemo<FlatItem[]>(() => {
    if (!query.trim()) return QUICK_NAV
    if (!data) return []
    const out: FlatItem[] = []
    data.projects.forEach((p) => out.push({ group: 'Projects', icon: FolderKanban, label: p.name, sub: p.status, to: `/projects/${p.id}` }))
    data.tasks.forEach((t) => out.push({ group: 'Tasks', icon: CheckSquare, label: t.name, to: `/projects/${t.projectId}` }))
    data.risks.forEach((r) => out.push({ group: 'Risks', icon: ShieldAlert, label: r.title, to: `/projects/${r.projectId}` }))
    data.ideas.forEach((i) => out.push({ group: 'Ideas', icon: Lightbulb, label: i.title, to: '/ideas' }))
    data.resources.forEach((r) => out.push({ group: 'Resources', icon: Users, label: r.name, sub: r.role ?? undefined, to: '/resources' }))
    return out
  }, [query, data])

  // Global hotkeys: ⌘K / Ctrl+K / "/" open palette; g→{d,p,r,i} navigate; ? help; Esc close.
  useEffect(() => {
    let gPending = false
    let gTimer: ReturnType<typeof setTimeout> | undefined
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); setOpen((v) => !v); return
      }
      if (open && e.key === 'Escape') { setOpen(false); return }
      if (isTypingTarget(e.target)) return
      if (e.key === '/') { e.preventDefault(); setOpen(true); return }
      if (e.key === '?') { setShowHelp((v) => !v); return }
      if (gPending) {
        gPending = false
        const map: Record<string, string> = { d: '/dashboard', p: '/projects', r: '/reports', i: '/ideas' }
        if (map[e.key]) { e.preventDefault(); navigate(map[e.key]) }
        return
      }
      if (e.key === 'g') { gPending = true; clearTimeout(gTimer); gTimer = setTimeout(() => { gPending = false }, 1000) }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(gTimer) }
  }, [open, navigate])

  // Reset transient state when opening.
  useEffect(() => { if (open) { setQuery(''); setDebounced(''); setActive(0) } }, [open])
  useEffect(() => { setActive(0) }, [items.length])

  function choose(item: FlatItem) {
    setOpen(false)
    navigate(item.to)
  }

  if (showHelp && !open) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" onClick={() => setShowHelp(false)}>
        <div className="bg-background rounded-xl shadow-2xl p-5 w-full max-w-sm space-y-2 text-sm" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-semibold mb-2">Keyboard shortcuts</h3>
          {[['⌘K / Ctrl+K', 'Open search'], ['/', 'Open search'], ['g then d', 'Dashboard'], ['g then p', 'Projects'], ['g then r', 'Reports'], ['g then i', 'Ideas'], ['?', 'This help']].map(([k, v]) => (
            <div key={k} className="flex justify-between"><kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">{k}</kbd><span className="text-muted-foreground">{v}</span></div>
          ))}
        </div>
      </div>
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] bg-black/40" onClick={() => setOpen(false)}>
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 border-b">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            autoFocus
            className="flex-1 py-3 text-sm bg-transparent focus:outline-none"
            placeholder="Search projects, tasks, risks, ideas, resources…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
              else if (e.key === 'Enter' && items[active]) { e.preventDefault(); choose(items[active]) }
            }}
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {query.trim().length >= 2 && items.length === 0 && (
            <p className="text-sm text-muted-foreground px-4 py-6 text-center">No matches for “{query}”.</p>
          )}
          {items.map((item, i) => {
            const Icon = item.icon
            const showHeader = i === 0 || items[i - 1].group !== item.group
            return (
              <div key={`${item.group}-${item.to}-${i}`}>
                {showHeader && <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-3 pt-2 pb-1">{item.group}</p>}
                <button
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${i === active ? 'bg-accent' : 'hover:bg-accent/50'}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(item)}
                >
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.sub && <span className="text-xs text-muted-foreground capitalize">{item.sub}</span>}
                  <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
                </button>
              </div>
            )
          })}
        </div>
        <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground flex justify-between">
          <span>↑↓ navigate · ↵ open · esc close</span>
          <span>? shortcuts</span>
        </div>
      </div>
    </div>
  )
}
