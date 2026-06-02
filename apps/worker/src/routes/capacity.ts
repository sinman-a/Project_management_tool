import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'

export const capacityRoutes = new Hono<HonoContext>()

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function weeksInRange(fromWeek: string, toWeek: string): string[] {
  const weeks: string[] = []
  const parseWeek = (w: string) => {
    const [year, wn] = w.split('-W').map(Number)
    const jan1 = new Date(Date.UTC(year, 0, 1))
    const dayOfWeek = jan1.getUTCDay() || 7
    const monday = new Date(jan1)
    monday.setUTCDate(jan1.getUTCDate() + (dayOfWeek <= 4 ? 1 - dayOfWeek : 8 - dayOfWeek) + (wn - 1) * 7)
    return monday
  }

  let current = parseWeek(fromWeek)
  const end = parseWeek(toWeek)

  while (current <= end) {
    weeks.push(isoWeek(current))
    current.setUTCDate(current.getUTCDate() + 7)
  }
  return weeks
}

// GET /capacity/heatmap
capacityRoutes.get('/heatmap', async (c) => {
  const user = c.get('user')
  const programId = c.req.query('programId')
  const projectId = c.req.query('projectId')
  const aggregation = c.req.query('aggregation') ?? 'weekly'

  const now = new Date()
  const defaultFrom = isoWeek(now)
  const futureDate = new Date(now)
  futureDate.setDate(futureDate.getDate() + 7 * 11)
  const defaultTo = isoWeek(futureDate)

  const fromWeek = c.req.query('from') ?? defaultFrom
  const toWeek = c.req.query('to') ?? defaultTo

  // Build project filter
  let projectFilter = ''
  const params: unknown[] = [user.orgId]

  if (projectId) {
    projectFilter = 'AND t.project_id = ?'
    params.push(projectId)
  } else if (programId) {
    projectFilter = 'AND t.project_id IN (SELECT id FROM projects WHERE program_id = ?)'
    params.push(programId)
  }

  // Query resource allocations (task_assignments joined to tasks with dates)
  const { results: allocRows } = await c.env.DB.prepare(`
    SELECT
      r.id as resource_id,
      r.name as resource_name,
      r.capacity_hours_per_week,
      r.role as resource_role,
      t.project_id,
      p.name as project_name,
      ta.allocated_hours,
      t.start_date,
      t.due_date
    FROM resources r
    LEFT JOIN task_assignments ta ON ta.resource_id = r.id
    LEFT JOIN tasks t ON t.id = ta.task_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE r.org_id = ? ${projectFilter}
    ORDER BY r.name ASC
  `).bind(...params).all<{
    resource_id: string; resource_name: string; capacity_hours_per_week: number; resource_role: string | null
    project_id: string | null; project_name: string | null; allocated_hours: number | null
    start_date: string | null; due_date: string | null
  }>()

  // Build week list
  const weeks = weeksInRange(fromWeek, toWeek)

  // Aggregate per resource × week
  const resourceMap = new Map<string, {
    resourceId: string; resourceName: string; capacity: number; role: string | null
    weeks: Map<string, { allocated: number; projects: Map<string, { name: string; hours: number }> }>
  }>()

  for (const row of allocRows) {
    if (!resourceMap.has(row.resource_id)) {
      resourceMap.set(row.resource_id, {
        resourceId: row.resource_id,
        resourceName: row.resource_name,
        capacity: row.capacity_hours_per_week ?? 40,
        role: row.resource_role,
        weeks: new Map(),
      })
    }
    const rEntry = resourceMap.get(row.resource_id)!

    if (!row.start_date || !row.due_date || !row.allocated_hours) continue

    const taskStart = new Date(row.start_date)
    const taskEnd = new Date(row.due_date)
    const taskWeeks = weeksInRange(isoWeek(taskStart), isoWeek(taskEnd)).filter((w) => weeks.includes(w))
    const hoursPerWeek = taskWeeks.length > 0 ? row.allocated_hours / taskWeeks.length : 0

    for (const week of taskWeeks) {
      if (!rEntry.weeks.has(week)) rEntry.weeks.set(week, { allocated: 0, projects: new Map() })
      const wEntry = rEntry.weeks.get(week)!
      wEntry.allocated += hoursPerWeek

      const pid = row.project_id ?? 'unassigned'
      const pname = row.project_name ?? 'Unassigned'
      if (!wEntry.projects.has(pid)) wEntry.projects.set(pid, { name: pname, hours: 0 })
      wEntry.projects.get(pid)!.hours += hoursPerWeek
    }
  }

  // Format response
  const resources = Array.from(resourceMap.values()).map((r) => ({
    resourceId: r.resourceId,
    resourceName: r.resourceName,
    capacity: r.capacity,
    role: r.role,
    weeks: weeks.map((w) => {
      const wEntry = r.weeks.get(w)
      const allocated = wEntry?.allocated ?? 0
      const utilisation = r.capacity > 0 ? (allocated / r.capacity) * 100 : 0
      const band = utilisation === 0 ? 'empty'
        : utilisation < 50 ? 'low'
        : utilisation < 80 ? 'light'
        : utilisation < 100 ? 'good'
        : utilisation < 120 ? 'amber'
        : 'red'

      return {
        week: w,
        allocated: Math.round(allocated * 10) / 10,
        capacity: r.capacity,
        utilisation: Math.round(utilisation),
        band,
        projects: wEntry ? Array.from(wEntry.projects.values()).map((p) => ({
          name: p.name,
          hours: Math.round(p.hours * 10) / 10,
        })) : [],
      }
    }),
  }))

  return c.json({ weeks, resources, aggregation })
})

// GET /capacity/heatmap/cell?resourceId=&period=YYYY-Www
capacityRoutes.get('/heatmap/cell', async (c) => {
  const resourceId = c.req.query('resourceId')
  const period = c.req.query('period')

  if (!resourceId || !period) {
    return c.json({ message: 'resourceId and period required' }, 400)
  }

  // Find tasks for resource in that week
  const { results } = await c.env.DB.prepare(`
    SELECT t.id, t.name, t.start_date, t.due_date, p.name as project_name, ta.allocated_hours
    FROM task_assignments ta
    JOIN tasks t ON t.id = ta.task_id
    JOIN projects p ON p.id = t.project_id
    WHERE ta.resource_id = ?
    ORDER BY t.start_date ASC
  `).bind(resourceId).all<{
    id: string; name: string; start_date: string | null; due_date: string | null
    project_name: string; allocated_hours: number
  }>()

  // Filter to the period
  const tasks = results.filter((t) => {
    if (!t.start_date || !t.due_date) return false
    const taskWeeks = weeksInRange(isoWeek(new Date(t.start_date)), isoWeek(new Date(t.due_date)))
    return taskWeeks.includes(period)
  }).map((t) => ({
    id: t.id,
    name: t.name,
    projectName: t.project_name,
    allocatedHours: t.allocated_hours,
  }))

  return c.json({ resourceId, period, tasks })
})

// POST /capacity/heatmap/what-if — client-side simulation, no DB writes
capacityRoutes.post('/heatmap/what-if', async (c) => {
  const body = await c.req.json()
  const parsed = z.object({
    hypothetical: z.array(z.object({
      taskId: z.string(),
      fromResourceId: z.string().nullish(),
      toResourceId: z.string(),
      hours: z.number().positive(),
      startDate: z.string(),
      endDate: z.string(),
    })),
  }).safeParse(body)

  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  // Return the hypothetical changes back for client-side diff rendering
  return c.json({ changes: parsed.data.hypothetical, note: 'Hypothetical — not persisted' })
})
