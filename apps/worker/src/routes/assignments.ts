import { Hono } from 'hono'
import { z } from 'zod'
import type { D1Database } from '@cloudflare/workers-types'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'
import { projectInOrg } from '../middleware/ownership'

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()), v]),
  )
}

/** Verify a task_assignment chains to a project in the caller's org. */
async function assignmentInOrg(db: D1Database, assignmentId: string, orgId: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT 1 FROM task_assignments ta
    JOIN tasks t ON t.id = ta.task_id
    JOIN projects p ON p.id = t.project_id
    WHERE ta.id = ? AND p.org_id = ?
  `).bind(assignmentId, orgId).first()
  return !!row
}

// ── by-id routes mounted at /task-assignments ────────────────────────────────
export const assignmentRoutes = new Hono<HonoContext>()

assignmentRoutes.patch('/:id', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  if (!(await assignmentInOrg(c.env.DB, id, user.orgId))) return c.json({ message: 'Not found' }, 404)

  const body = await c.req.json()
  const parsed = z.object({ allocatedHours: z.number().min(0) }).safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  await c.env.DB.prepare('UPDATE task_assignments SET allocated_hours = ? WHERE id = ?')
    .bind(parsed.data.allocatedHours, id).run()

  const row = await c.env.DB.prepare(`
    SELECT ta.*, r.name as resource_name, r.role as resource_role, r.rate, r.capacity_hours_per_week
    FROM task_assignments ta JOIN resources r ON r.id = ta.resource_id WHERE ta.id = ?
  `).bind(id).first()
  return c.json(toCamel(row!))
})

assignmentRoutes.delete('/:id', requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  if (!(await assignmentInOrg(c.env.DB, id, user.orgId))) return c.json({ message: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM task_assignments WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ── project aggregate mounted at /projects ───────────────────────────────────
export const assignmentSubRoutes = new Hono<HonoContext>()

assignmentSubRoutes.get('/:id/assignments', async (c) => {
  const user = c.get('user')
  const projectId = c.req.param('id')
  if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Not found' }, 404)

  const { results } = await c.env.DB.prepare(`
    SELECT ta.*, t.name as task_name, t.start_date, t.due_date,
           r.name as resource_name, r.role as resource_role,
           r.rate, r.capacity_hours_per_week
    FROM task_assignments ta
    JOIN tasks t ON t.id = ta.task_id
    JOIN resources r ON r.id = ta.resource_id
    WHERE t.project_id = ?
    ORDER BY r.name ASC, t.name ASC
  `).bind(projectId).all()

  return c.json(results.map(toCamel))
})
