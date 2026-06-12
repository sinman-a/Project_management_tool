import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function asanaHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function asanaGet(path: string, token: string) {
  const res = await fetch(`https://app.asana.com/api/1.0${path}`, { headers: asanaHeaders(token) })
  if (!res.ok) throw new Error(`Asana API error: ${res.status}`)
  return (await res.json() as { data: unknown }).data
}

/** Fetch all pages from a paginated Asana endpoint */
async function asanaGetAll(path: string, token: string, fields?: string): Promise<unknown[]> {
  const results: unknown[] = []
  let offset: string | null = null
  const sep = path.includes('?') ? '&' : '?'
  do {
    const url = `https://app.asana.com/api/1.0${path}${offset ? `${sep}offset=${offset}&` : sep}limit=100${fields ? `&opt_fields=${fields}` : ''}`
    const res = await fetch(url, { headers: asanaHeaders(token) })
    if (!res.ok) throw new Error(`Asana API error: ${res.status}`)
    const body = await res.json() as { data: unknown[]; next_page?: { offset: string } | null }
    results.push(...body.data)
    offset = body.next_page?.offset ?? null
  } while (offset)
  return results
}

function stateToken(userId: string, secret: string): string {
  return `${userId}.${btoa(secret + userId).slice(0, 16)}`
}

function verifyState(state: string, userId: string, secret: string): boolean {
  return state === stateToken(userId, secret)
}

// CSV parsing ─────────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim())
  return lines.slice(1).map((line) => {
    const vals = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i]?.trim() ?? '' })
    return row
  }).filter((r) => Object.values(r).some((v) => v))
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

interface ParsedTask {
  name: string
  description: string
  type: string
  status: string
  priority: string
  estimatedHours: number
  storyPoints: number | null
  dueDate: string | null
  wbsCode: string | null
  parentName: string | null
}

const VALID_TYPES = ['agile_task', 'agile_story', 'waterfall_phase', 'milestone']
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low']
const VALID_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done']

function csvRowToTask(row: Record<string, string>): ParsedTask {
  const type = VALID_TYPES.includes(row.type) ? row.type : 'agile_task'
  const priority = VALID_PRIORITIES.includes(row.priority) ? row.priority : 'medium'
  const status = VALID_STATUSES.includes(row.status) ? row.status : 'backlog'
  return {
    name: row.name || 'Unnamed task',
    description: row.description || '',
    type,
    status,
    priority,
    estimatedHours: parseFloat(row.estimated_hours || row.estimatedhours || '0') || 0,
    storyPoints: row.story_points || row.storypoints ? parseInt(row.story_points || row.storypoints) || null : null,
    dueDate: row.due_date || row.duedate || null,
    wbsCode: row.wbs_code || row.wbscode || null,
    parentName: row.parent || null,
  }
}

function parseMarkdown(text: string): ParsedTask[] {
  const tasks: ParsedTask[] = []
  const lines = text.split('\n')
  let currentParent: string | null = null

  for (const raw of lines) {
    const line = raw.trim()
    // ## Heading → parent task group
    if (/^#{1,3}\s+/.test(line)) {
      currentParent = line.replace(/^#+\s+/, '').trim()
      if (currentParent) {
        tasks.push({
          name: currentParent, description: '', type: 'agile_task',
          status: 'backlog', priority: 'medium', estimatedHours: 0,
          storyPoints: null, dueDate: null, wbsCode: null, parentName: null,
        })
      }
      continue
    }
    // - [ ] task or - [x] done task
    const checkMatch = line.match(/^-\s+\[([ xX])\]\s+(.+)$/)
    if (checkMatch) {
      const done = checkMatch[1].toLowerCase() === 'x'
      const rawName = checkMatch[2].trim()
      // parse optional inline metadata: (Nh, priority, YYYY-MM-DD)
      const hoursMatch = rawName.match(/\((\d+(?:\.\d+)?)h\)/)
      const dateMatch = rawName.match(/(\d{4}-\d{2}-\d{2})/)
      const name = rawName.replace(/\(.*?\)/g, '').trim()
      tasks.push({
        name: name || rawName,
        description: '',
        type: 'agile_task',
        status: done ? 'done' : 'backlog',
        priority: 'medium',
        estimatedHours: hoursMatch ? parseFloat(hoursMatch[1]) : 0,
        storyPoints: null,
        dueDate: dateMatch ? dateMatch[1] : null,
        wbsCode: null,
        parentName: currentParent,
      })
    }
  }
  return tasks
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
}

// ─── routes ──────────────────────────────────────────────────────────────────

export const importPublicRoutes = new Hono<HonoContext>()
export const importRoutes = new Hono<HonoContext>()

// ── PUBLIC: OAuth callback & done page ───────────────────────────────────────

importPublicRoutes.get('/asana/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')

  if (error) {
    return c.redirect(`/api/import/asana/done?error=${encodeURIComponent(error)}`)
  }
  if (!code || !state) {
    return c.redirect('/api/import/asana/done?error=missing_params')
  }

  // State = "{userId}.{hash}" — we must decode userId to look up user and verify
  const [userId] = state.split('.')
  if (!userId) return c.redirect('/api/import/asana/done?error=invalid_state')

  const user = await c.env.DB.prepare('SELECT id, org_id FROM users WHERE id = ?').bind(userId).first<{ id: string; org_id: string }>()
  if (!user) return c.redirect('/api/import/asana/done?error=invalid_state')

  if (!verifyState(state, userId, c.env.JWT_SECRET)) {
    return c.redirect('/api/import/asana/done?error=invalid_state')
  }

  // Exchange code for token
  const tokenRes = await fetch('https://app.asana.com/-/oauth_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: c.env.ASANA_CLIENT_ID,
      client_secret: c.env.ASANA_CLIENT_SECRET,
      redirect_uri: c.env.ASANA_REDIRECT_URI,
      code,
    }),
  })

  if (!tokenRes.ok) {
    return c.redirect('/api/import/asana/done?error=token_exchange_failed')
  }

  const tokenData = await tokenRes.json() as { access_token: string; expires_in?: number }
  const ttl = tokenData.expires_in ?? 3600
  await c.env.KV_CACHE.put(
    `asana_token:${user.org_id}:${userId}`,
    tokenData.access_token,
    { expirationTtl: ttl },
  )

  return c.redirect('/api/import/asana/done?success=1')
})

importPublicRoutes.get('/asana/done', (c) => {
  const success = c.req.query('success') === '1'

  // Whitelist error codes → fixed, safe messages (never reflect raw query input)
  const ERROR_MESSAGES: Record<string, string> = {
    token_exchange_failed: 'Could not complete the connection. Please try again.',
    denied: 'Access was denied.',
    invalid_state: 'The session expired. Please restart the connection.',
  }
  const errorCode = c.req.query('error') ?? ''
  const errorMessage = ERROR_MESSAGES[errorCode] ?? 'Connection failed.'

  // Target origin for postMessage — specific frontend origin, never '*'
  const targetOrigin = c.env.ENVIRONMENT === 'production'
    ? 'https://ppm-tool.pages.dev'
    : 'http://localhost:5173'

  const bodyText = success
    ? '✅ Connected! This window will close automatically.'
    : `❌ ${errorMessage}`

  // success is a hardcoded boolean literal; targetOrigin and message are server-controlled constants
  return c.html(`<!DOCTYPE html><html><head><title>Asana</title></head><body>
<script>
  try {
    var TARGET = ${JSON.stringify(targetOrigin)};
    if (${success ? 'true' : 'false'}) {
      window.opener && window.opener.postMessage('asana-connected', TARGET);
    } else {
      window.opener && window.opener.postMessage({ asanaError: ${JSON.stringify(errorCode || 'unknown')} }, TARGET);
    }
  } catch(e) {}
  window.close();
</script>
<p style="font-family:system-ui;text-align:center;margin-top:40px">${bodyText}</p>
</body></html>`)
})

// ── PROTECTED: Asana data routes ─────────────────────────────────────────────

importRoutes.get('/asana/status', async (c) => {
  const user = c.get('user')
  const token = await c.env.KV_CACHE.get(`asana_token:${user.orgId}:${user.sub}`)
  return c.json({ connected: !!token })
})

importRoutes.get('/asana/auth', (c) => {
  const user = c.get('user')
  const state = stateToken(user.sub, c.env.JWT_SECRET)
  const params = new URLSearchParams({
    client_id: c.env.ASANA_CLIENT_ID,
    redirect_uri: c.env.ASANA_REDIRECT_URI,
    response_type: 'code',
    state,
  })
  return c.redirect(`https://app.asana.com/-/oauth_authorize?${params}`)
})

importRoutes.delete('/asana/disconnect', async (c) => {
  const user = c.get('user')
  await c.env.KV_CACHE.delete(`asana_token:${user.orgId}:${user.sub}`)
  return c.json({ success: true })
})

importRoutes.get('/asana/workspaces', async (c) => {
  const user = c.get('user')
  const token = await c.env.KV_CACHE.get(`asana_token:${user.orgId}:${user.sub}`)
  if (!token) return c.json({ message: 'Not connected to Asana' }, 401)

  const me = await asanaGet('/users/me?opt_fields=workspaces,workspaces.name,workspaces.gid', token) as { workspaces: { gid: string; name: string }[] }
  return c.json(me.workspaces ?? [])
})

importRoutes.get('/asana/projects', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.query('workspaceId')
  if (!workspaceId) return c.json({ message: 'workspaceId required' }, 400)

  const token = await c.env.KV_CACHE.get(`asana_token:${user.orgId}:${user.sub}`)
  if (!token) return c.json({ message: 'Not connected to Asana' }, 401)

  const projects = await asanaGetAll(
    `/projects?workspace=${workspaceId}`,
    token,
    'gid,name,notes,start_on,due_on,color',
  )
  return c.json(projects)
})

importRoutes.post('/asana/run', async (c) => {
  const user = c.get('user')
  const token = await c.env.KV_CACHE.get(`asana_token:${user.orgId}:${user.sub}`)
  if (!token) return c.json({ message: 'Not connected to Asana' }, 401)

  const body = await c.req.json() as { projectGid: string; programId?: string }
  const { projectGid, programId } = body
  if (!projectGid) return c.json({ message: 'projectGid required' }, 400)

  // Fetch Asana project details
  const asanaProject = await asanaGet(
    `/projects/${projectGid}?opt_fields=gid,name,notes,start_on,due_on`,
    token,
  ) as { gid: string; name: string; notes?: string; start_on?: string; due_on?: string }

  // Create PPM project
  const projectId = crypto.randomUUID()
  const now = new Date().toISOString().slice(0, 10)
  await c.env.DB.prepare(`
    INSERT INTO projects (id, org_id, program_id, name, description, manager_id, methodology, status, start_date, end_date, budget_capex, budget_opex, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'agile', 'planning', ?, ?, 0, 0, ?, ?)
  `).bind(
    projectId, user.orgId, programId ?? null, asanaProject.name,
    asanaProject.notes ?? null, user.sub,
    asanaProject.start_on ?? now, asanaProject.due_on ?? null,
    new Date().toISOString(), new Date().toISOString(),
  ).run()

  // Fetch sections (→ sprints)
  const sections = await asanaGetAll(
    `/projects/${projectGid}/sections`,
    token,
    'gid,name',
  ) as { gid: string; name: string }[]

  const sprintMap: Record<string, string> = {}
  for (const section of sections) {
    if (!section.name || section.name === 'Untitled section') continue
    const sprintId = crypto.randomUUID()
    await c.env.DB.prepare(`
      INSERT INTO sprints (id, project_id, name, status, start_date, end_date, created_at)
      VALUES (?, ?, ?, 'planned', ?, ?, ?)
    `).bind(sprintId, projectId, section.name, now, now, new Date().toISOString()).run()
    sprintMap[section.gid] = sprintId
  }

  // Fetch all tasks (with key fields)
  const tasks = await asanaGetAll(
    `/tasks?project=${projectGid}`,
    token,
    'gid,name,notes,completed,due_on,start_on,assignee,assignee.email,parent,memberships.section.gid,resource_subtype,custom_fields,custom_fields.name,custom_fields.number_value',
  ) as AsanaTask[]

  interface AsanaTask {
    gid: string
    name: string
    notes?: string
    completed: boolean
    due_on?: string
    start_on?: string
    resource_subtype?: string
    assignee?: { email: string } | null
    parent?: { gid: string } | null
    memberships?: { section?: { gid: string } }[]
    custom_fields?: { name: string; number_value?: number | null }[]
  }

  // Build user email→id lookup
  const { results: ppmUsers } = await c.env.DB.prepare(
    'SELECT id, email FROM users WHERE org_id = ?',
  ).bind(user.orgId).all<{ id: string; email: string }>()
  const emailToUserId: Record<string, string> = {}
  for (const u of ppmUsers) emailToUserId[u.email] = u.id

  let taskCount = 0
  const gidToId: Record<string, string> = {}

  for (const t of tasks) {
    if (!t.name) continue
    const taskId = crypto.randomUUID()
    gidToId[t.gid] = taskId

    const subtype = t.resource_subtype ?? 'default_task'
    const taskType = subtype === 'milestone' ? 'milestone'
      : subtype === 'approval' ? 'agile_task'
      : 'agile_task'

    const status = t.completed ? 'done' : 'backlog'
    const assigneeId = t.assignee?.email ? emailToUserId[t.assignee.email] ?? null : null
    const sectionGid = t.memberships?.[0]?.section?.gid
    const sprintId = sectionGid ? sprintMap[sectionGid] ?? null : null
    const storyPoints = t.custom_fields?.find((f) =>
      f.name.toLowerCase().includes('story') || f.name.toLowerCase().includes('point'),
    )?.number_value ?? null

    await c.env.DB.prepare(`
      INSERT INTO tasks (id, project_id, sprint_id, parent_task_id, name, description, type, status, priority, assigned_to, story_points, estimated_hours, start_date, due_date, cost_type, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'medium', ?, ?, 0, ?, ?, 'opex', ?, ?, ?)
    `).bind(
      taskId, projectId, sprintId, null,
      t.name, t.notes ?? null, taskType, status,
      assigneeId, storyPoints ?? null,
      t.start_on ?? null, t.due_on ?? null,
      user.sub, new Date().toISOString(), new Date().toISOString(),
    ).run()

    taskCount++
  }

  // Second pass: set parent_task_id for subtasks that had a parent in this project
  for (const t of tasks) {
    if (t.parent?.gid && gidToId[t.parent.gid] && gidToId[t.gid]) {
      await c.env.DB.prepare('UPDATE tasks SET parent_task_id = ? WHERE id = ?')
        .bind(gidToId[t.parent.gid], gidToId[t.gid]).run()
    }
  }

  return c.json({ projectId, projectName: asanaProject.name, taskCount })
})

// ── PROTECTED: File import ────────────────────────────────────────────────────

importRoutes.post('/file', async (c) => {
  const user = c.get('user')

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ message: 'Expected multipart/form-data' }, 400)
  }

  const file = formData.get('file') as File | null
  const projectName = (formData.get('projectName') as string | null)?.trim()
  const programId = (formData.get('programId') as string | null) || null

  if (!file || !projectName) return c.json({ message: 'file and projectName required' }, 400)

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const unsupported = ['docx', 'doc', 'pdf', 'xlsx', 'xls', 'pptx']
  if (unsupported.includes(ext)) {
    return c.json({ message: `"${ext.toUpperCase()}" format is not supported. Please convert to CSV or Markdown.` }, 422)
  }

  const text = await file.text()
  let parsedTasks: ParsedTask[] = []

  if (ext === 'csv') {
    const rows = parseCSV(text)
    parsedTasks = rows.map(csvRowToTask)
  } else if (['md', 'markdown', 'txt', 'text', 'html', 'htm'].includes(ext)) {
    const cleaned = ['html', 'htm'].includes(ext) ? stripHtml(text) : text
    parsedTasks = parseMarkdown(cleaned)
    // Fallback: if no checkbox tasks found, treat each non-empty line as a task
    if (parsedTasks.length === 0) {
      parsedTasks = text.split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 2 && !l.startsWith('#'))
        .slice(0, 200)
        .map((l) => ({
          name: l, description: '', type: 'agile_task', status: 'backlog',
          priority: 'medium', estimatedHours: 0, storyPoints: null, dueDate: null,
          wbsCode: null, parentName: null,
        }))
    }
  } else {
    return c.json({ message: 'Unsupported file type. Use CSV, Markdown, HTML, or Text.' }, 422)
  }

  if (parsedTasks.length === 0) return c.json({ message: 'No tasks found in file.' }, 422)

  // Create project
  const projectId = crypto.randomUUID()
  const now = new Date().toISOString().slice(0, 10)
  await c.env.DB.prepare(`
    INSERT INTO projects (id, org_id, program_id, name, manager_id, methodology, status, start_date, budget_capex, budget_opex, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'agile', 'planning', ?, 0, 0, ?, ?)
  `).bind(
    projectId, user.orgId, programId, projectName, user.sub, now,
    new Date().toISOString(), new Date().toISOString(),
  ).run()

  // Build parent-name → taskId map for two-pass insert
  const nameToId: Record<string, string> = {}
  const taskIds: { task: ParsedTask; id: string }[] = parsedTasks.map((t) => ({ task: t, id: crypto.randomUUID() }))

  // First pass — insert all tasks
  for (const { task, id } of taskIds) {
    if (task.name) nameToId[task.name] = id
    await c.env.DB.prepare(`
      INSERT INTO tasks (id, project_id, name, description, type, status, priority, estimated_hours, story_points, due_date, wbs_code, cost_type, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'opex', ?, ?, ?)
    `).bind(
      id, projectId,
      task.name, task.description || null,
      task.type, task.status, task.priority,
      task.estimatedHours, task.storyPoints ?? null,
      task.dueDate ?? null, task.wbsCode ?? null,
      user.sub, new Date().toISOString(), new Date().toISOString(),
    ).run()
  }

  // Second pass — set parent_task_id
  for (const { task, id } of taskIds) {
    if (task.parentName && nameToId[task.parentName]) {
      await c.env.DB.prepare('UPDATE tasks SET parent_task_id = ? WHERE id = ?')
        .bind(nameToId[task.parentName], id).run()
    }
  }

  return c.json({ projectId, projectName, taskCount: taskIds.length })
})

// ── PROTECTED: Bulk entity import (CSV / Google Sheets) ───────────────────────

type EntityType = 'portfolio' | 'program' | 'project' | 'resource'

// Roles allowed to import each entity type (mirrors the create routes).
const IMPORT_ROLES: Record<EntityType, string[]> = {
  portfolio: ['admin', 'program_manager', 'pmo_lead'],
  program: ['admin', 'program_manager', 'pmo_lead'],
  project: ['admin', 'program_manager', 'pmo_lead'],
  resource: ['admin'],
}

function num(v: string | undefined, fallback = 0): number {
  const n = parseFloat((v ?? '').replace(/[, ]/g, ''))
  return isNaN(n) ? fallback : n
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Turn a Google Sheets share/edit URL into its CSV export URL. */
function sheetsCsvUrl(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!m) return null
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1]
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`
}

const entitySchemas: Record<EntityType, z.ZodType> = {
  portfolio: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  }),
  program: z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    startDate: z.string().regex(DATE_RE),
    endDate: z.string().regex(DATE_RE).optional(),
    budgetCapex: z.number().min(0),
    budgetOpex: z.number().min(0),
    portfolioName: z.string().optional(),
  }),
  project: z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    methodology: z.enum(['waterfall', 'agile', 'hybrid']),
    startDate: z.string().regex(DATE_RE),
    endDate: z.string().regex(DATE_RE).optional(),
    budgetCapex: z.number().min(0),
    budgetOpex: z.number().min(0),
    expectedBenefit: z.number().min(0),
    programName: z.string().optional(),
  }),
  resource: z.object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(200).optional(),
    type: z.enum(['human', 'equipment']),
    costType: z.enum(['capex', 'opex']),
    rate: z.number().min(0),
    currency: z.string().length(3),
    capacityHoursPerWeek: z.number().min(0).max(168),
    role: z.string().max(100).optional(),
    seniorityLevel: z.string().max(50).optional(),
    location: z.string().max(100).optional(),
  }),
}

function mapRow(entityType: EntityType, row: Record<string, string>, today: string): unknown {
  const g = (k: string) => (row[k] ?? '').trim() || undefined
  switch (entityType) {
    case 'portfolio':
      return { name: g('name'), description: g('description') }
    case 'program':
      return {
        name: g('name'), description: g('description'),
        startDate: g('start_date') ?? today, endDate: g('end_date'),
        budgetCapex: num(row.budget_capex), budgetOpex: num(row.budget_opex),
        portfolioName: g('portfolio'),
      }
    case 'project':
      return {
        name: g('name'), description: g('description'),
        methodology: (g('methodology') ?? 'hybrid').toLowerCase(),
        startDate: g('start_date') ?? today, endDate: g('end_date'),
        budgetCapex: num(row.budget_capex), budgetOpex: num(row.budget_opex),
        expectedBenefit: num(row.expected_benefit),
        programName: g('program'),
      }
    case 'resource':
      return {
        name: g('name'), email: g('email'),
        type: (g('type') ?? 'human').toLowerCase(),
        costType: (g('cost_type') ?? 'opex').toLowerCase(),
        rate: num(row.rate), currency: (g('currency') ?? 'USD').toUpperCase(),
        capacityHoursPerWeek: num(row.capacity_hours_per_week, 40),
        role: g('role'), seniorityLevel: g('seniority_level'), location: g('location'),
      }
  }
}

importRoutes.post('/entities', async (c) => {
  const user = c.get('user')
  const contentType = c.req.header('content-type') ?? ''

  let entityType: EntityType | undefined
  let csvText = ''

  if (contentType.includes('multipart/form-data')) {
    const fd = await c.req.formData().catch(() => null)
    if (!fd) return c.json({ message: 'Expected multipart/form-data' }, 400)
    entityType = (fd.get('entityType') as string | null) as EntityType | undefined
    const file = fd.get('file') as File | null
    if (!file) return c.json({ message: 'file required' }, 400)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (ext !== 'csv') return c.json({ message: 'Only .csv files are supported.' }, 422)
    csvText = await file.text()
  } else {
    const body = await c.req.json().catch(() => null) as { entityType?: EntityType; sheetUrl?: string } | null
    if (!body) return c.json({ message: 'Invalid JSON' }, 400)
    entityType = body.entityType
    if (!body.sheetUrl) return c.json({ message: 'sheetUrl required' }, 400)
    const csvUrl = sheetsCsvUrl(body.sheetUrl)
    if (!csvUrl) return c.json({ message: 'Invalid Google Sheets URL' }, 400)
    const res = await fetch(csvUrl)
    if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) {
      return c.json({ message: 'Could not read the sheet. Make sure it is shared as "anyone with the link" or published.' }, 422)
    }
    csvText = await res.text()
  }

  if (!entityType || !(entityType in entitySchemas)) {
    return c.json({ message: 'Invalid entityType' }, 400)
  }
  if (!IMPORT_ROLES[entityType].includes(user.role)) {
    return c.json({ message: 'Forbidden' }, 403)
  }

  const MAX_ROWS = 2000
  const rows = parseCSV(csvText)
  if (rows.length === 0) return c.json({ message: 'No data rows found.' }, 422)
  if (rows.length > MAX_ROWS) return c.json({ message: `Too many rows (max ${MAX_ROWS}). Split the file and retry.` }, 422)

  const schema = entitySchemas[entityType]
  const today = new Date().toISOString().slice(0, 10)
  const errors: { row: number; message: string }[] = []
  let created = 0

  // Lookup maps for name → id resolution (programs/portfolios)
  const portfolioByName = new Map<string, string>()
  const programByName = new Map<string, string>()
  if (entityType === 'program') {
    const { results } = await c.env.DB.prepare('SELECT id, name FROM portfolios WHERE org_id = ?').bind(user.orgId).all<{ id: string; name: string }>()
    for (const r of results) portfolioByName.set(r.name.toLowerCase(), r.id)
  }
  if (entityType === 'project') {
    const { results } = await c.env.DB.prepare('SELECT id, name FROM programs WHERE org_id = ?').bind(user.orgId).all<{ id: string; name: string }>()
    for (const r of results) programByName.set(r.name.toLowerCase(), r.id)
  }

  for (let i = 0; i < rows.length; i++) {
    const parsed = schema.safeParse(mapRow(entityType, rows[i], today))
    if (!parsed.success) {
      errors.push({ row: i + 2, message: parsed.error.issues[0]?.message ?? 'Invalid row' })
      continue
    }
    const d = parsed.data as Record<string, unknown>
    const id = crypto.randomUUID()

    try {
      if (entityType === 'portfolio') {
        await c.env.DB.prepare('INSERT INTO portfolios (id, org_id, name, description, owner_id) VALUES (?, ?, ?, ?, ?)')
          .bind(id, user.orgId, d.name, d.description ?? null, user.sub).run()
      } else if (entityType === 'program') {
        const portfolioId = d.portfolioName ? portfolioByName.get(String(d.portfolioName).toLowerCase()) ?? null : null
        await c.env.DB.prepare(`
          INSERT INTO programs (id, org_id, name, description, portfolio_id, owner_id, status, start_date, end_date, budget_capex, budget_opex)
          VALUES (?, ?, ?, ?, ?, ?, 'planning', ?, ?, ?, ?)
        `).bind(id, user.orgId, d.name, d.description ?? null, portfolioId, user.sub, d.startDate, d.endDate ?? null, d.budgetCapex, d.budgetOpex).run()
      } else if (entityType === 'project') {
        const programId = d.programName ? programByName.get(String(d.programName).toLowerCase()) ?? null : null
        await c.env.DB.prepare(`
          INSERT INTO projects (id, org_id, program_id, name, description, manager_id, methodology, status, start_date, end_date, budget_capex, budget_opex, expected_benefit)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'planning', ?, ?, ?, ?, ?)
        `).bind(id, user.orgId, programId, d.name, d.description ?? null, user.sub, d.methodology, d.startDate, d.endDate ?? null, d.budgetCapex, d.budgetOpex, d.expectedBenefit).run()
      } else {
        await c.env.DB.prepare(`
          INSERT INTO resources (id, org_id, name, email, type, cost_type, rate, currency, capacity_hours_per_week, role, seniority_level, location, project_allocation)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100)
        `).bind(id, user.orgId, d.name, d.email ?? null, d.type, d.costType, d.rate, d.currency, d.capacityHoursPerWeek, d.role ?? null, d.seniorityLevel ?? null, d.location ?? null).run()
      }
      created++
    } catch (e) {
      errors.push({ row: i + 2, message: (e as Error).message })
    }
  }

  return c.json({ created, skipped: errors.length, errors })
})
