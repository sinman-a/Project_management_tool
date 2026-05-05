import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Link2, CheckCircle, AlertCircle, Loader2, ExternalLink, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePrograms } from '@/hooks/useProjects'
import {
  useAsanaStatus,
  useAsanaWorkspaces,
  useAsanaProjects,
  useAsanaImport,
  useAsanaDisconnect,
  useFileImport,
  type AsanaProject,
  type ImportResult,
} from '@/hooks/useImport'
import { useNavigate } from 'react-router-dom'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

function AsanaSection() {
  const navigate = useNavigate()
  const { data: status, refetch: refetchStatus } = useAsanaStatus()
  const connected = status?.connected ?? false

  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [programId, setProgramId] = useState('')
  const [selectedGids, setSelectedGids] = useState<Set<string>>(new Set())
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [connecting, setConnecting] = useState(false)

  const { data: workspaces = [] } = useAsanaWorkspaces(connected)
  const { data: projects = [], isLoading: loadingProjects } = useAsanaProjects(workspaceId)
  const { data: programs = [] } = usePrograms()

  const asanaImport = useAsanaImport()
  const disconnect = useAsanaDisconnect()

  // Auto-select first workspace
  useEffect(() => {
    if (workspaces.length > 0 && !workspaceId) {
      setWorkspaceId(workspaces[0].gid)
    }
  }, [workspaces, workspaceId])

  const openPopup = useCallback(() => {
    setConnecting(true)
    const popup = window.open(
      `${BASE_URL}/import/asana/auth`,
      'asana-oauth',
      'width=600,height=700,scrollbars=yes,resizable=yes',
    )

    function onMessage(e: MessageEvent) {
      if (e.data === 'asana-connected') {
        window.removeEventListener('message', onMessage)
        setConnecting(false)
        refetchStatus()
      }
    }
    window.addEventListener('message', onMessage)

    const timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer)
        window.removeEventListener('message', onMessage)
        setConnecting(false)
        refetchStatus()
      }
    }, 500)
  }, [refetchStatus])

  function toggleProject(gid: string) {
    setSelectedGids((prev) => {
      const next = new Set(prev)
      if (next.has(gid)) next.delete(gid)
      else next.add(gid)
      return next
    })
  }

  async function runImport() {
    const gids = Array.from(selectedGids)
    const results: ImportResult[] = []
    for (const gid of gids) {
      const result = await asanaImport.mutateAsync({ projectGid: gid, programId: programId || undefined })
      results.push(result)
    }
    setImportResults(results)
    setSelectedGids(new Set())
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {!connected ? (
          <Button onClick={openPopup} disabled={connecting} variant="outline">
            {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
            Connect Asana
          </Button>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              Connected
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              Disconnect
            </Button>
          </>
        )}
        <a
          href="https://app.asana.com/0/developer-console"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:underline flex items-center gap-1 ml-auto"
        >
          <ExternalLink className="w-3 h-3" />
          Asana Developer Console
        </a>
      </div>

      {connected && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Workspace</label>
              <select
                className="input-field w-full"
                value={workspaceId ?? ''}
                onChange={(e) => { setWorkspaceId(e.target.value); setSelectedGids(new Set()) }}
              >
                {workspaces.map((w) => (
                  <option key={w.gid} value={w.gid}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Assign to program (optional)</label>
              <select
                className="input-field w-full"
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
              >
                <option value="">— No program —</option>
                {programs.filter((p) => p.status !== 'closed').map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Projects {loadingProjects && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {projects.map((p: AsanaProject) => (
                <label
                  key={p.gid}
                  className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedGids.has(p.gid)}
                    onChange={() => toggleProject(p.gid)}
                    className="rounded"
                  />
                  <span className="text-sm truncate">{p.name}</span>
                </label>
              ))}
              {projects.length === 0 && !loadingProjects && (
                <p className="text-sm text-muted-foreground col-span-2">No projects found in this workspace.</p>
              )}
            </div>
          </div>

          <Button
            disabled={selectedGids.size === 0 || asanaImport.isPending}
            onClick={runImport}
          >
            {asanaImport.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Import selected ({selectedGids.size})
          </Button>
        </>
      )}

      {importResults.map((r) => (
        <div key={r.projectId} className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>"{r.projectName}" imported — {r.taskCount} tasks, {r.sprintCount} sprints</span>
          <button
            className="ml-auto text-xs underline hover:no-underline"
            onClick={() => navigate(`/projects/${r.projectId}`)}
          >
            Open →
          </button>
        </div>
      ))}

      {asanaImport.isError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <AlertCircle className="w-4 h-4" />
          <span>{(asanaImport.error as Error)?.message ?? 'Import failed'}</span>
        </div>
      )}
    </div>
  )
}

function FileImportSection() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [projectName, setProjectName] = useState('')
  const [programId, setProgramId] = useState('')
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const { data: programs = [] } = usePrograms()
  const fileImport = useFileImport()

  function pickFile(f: File) {
    setFile(f)
    if (!projectName) setProjectName(f.name.replace(/\.[^.]+$/, ''))
    setResult(null)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }

  async function handleImport() {
    if (!file || !projectName.trim()) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('projectName', projectName.trim())
    if (programId) fd.append('programId', programId)
    const r = await fileImport.mutateAsync(fd)
    setResult(r)
    setFile(null)
    setProjectName('')
  }

  const unsupported = file && /\.(docx?|pdf)$/i.test(file.name)

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        {file ? (
          <p className="text-sm font-medium">{file.name}</p>
        ) : (
          <>
            <p className="text-sm font-medium">Drop CSV, Markdown, HTML or Text — or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Supported: .csv · .md · .txt · .html · .htm</p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.md,.txt,.html,.htm,.docx,.doc,.pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
        />
      </div>

      {unsupported && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Word and PDF files are not supported. Please convert to CSV or Markdown first.</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Project name</label>
          <input
            className="input-field w-full"
            placeholder="My Project"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Assign to program (optional)</label>
          <select
            className="input-field w-full"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
          >
            <option value="">— No program —</option>
            {programs.filter((p) => p.status !== 'closed').map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <Button
        disabled={!file || !projectName.trim() || !!unsupported || fileImport.isPending}
        onClick={handleImport}
      >
        {fileImport.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Import
      </Button>

      {result && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>"{result.projectName}" created — {result.taskCount} tasks</span>
          <button
            className="ml-auto text-xs underline hover:no-underline"
            onClick={() => navigate(`/projects/${result.projectId}`)}
          >
            Open →
          </button>
        </div>
      )}

      {fileImport.isError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <AlertCircle className="w-4 h-4" />
          <span>{(fileImport.error as Error)?.message ?? 'Import failed'}</span>
        </div>
      )}
    </div>
  )
}

export function ImportContent() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold">Asana</h3>
          <span className="text-xs text-muted-foreground">Requires Asana OAuth app — see Developer Console</span>
        </div>
        <AsanaSection />
      </div>

      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold mb-3">File Import</h3>
        <FileImportSection />
      </div>
    </div>
  )
}

export function ImportSection() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <Upload className="inline-block w-4 h-4 mr-2 text-primary" />
          Import
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ImportContent />
      </CardContent>
    </Card>
  )
}
