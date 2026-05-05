import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'

const LINK_TYPES = ['parent', 'child', 'related', 'duplicate', 'predecessor', 'successor'] as const

const linkSchema = z.object({
  sourceTaskId: z.string().uuid(),
  targetTaskId: z.string().uuid(),
  linkType: z.enum(LINK_TYPES),
})

export const taskLinkRoutes = new Hono<HonoContext>()

// GET /api/task-links?taskId=  OR  ?projectId=
taskLinkRoutes.get('/', async (c) => {
  const taskId = c.req.query('taskId')
  const projectId = c.req.query('projectId')

  if (!taskId && !projectId) return c.json({ message: 'taskId or projectId required' }, 400)

  let results: unknown[]
  if (taskId) {
    const { results: rows } = await c.env.DB.prepare(`
      SELECT tl.*,
        st.name as source_name, st.project_id as source_project_id,
        tt.name as target_name, tt.project_id as target_project_id
      FROM task_links tl
      JOIN tasks st ON st.id = tl.source_task_id
      JOIN tasks tt ON tt.id = tl.target_task_id
      WHERE tl.source_task_id = ? OR tl.target_task_id = ?
      ORDER BY tl.created_at ASC
    `).bind(taskId, taskId).all()
    results = rows
  } else {
    const { results: rows } = await c.env.DB.prepare(`
      SELECT tl.*,
        st.name as source_name, st.start_date as source_start, st.due_date as source_due,
        tt.name as target_name, tt.start_date as target_start, tt.due_date as target_due
      FROM task_links tl
      JOIN tasks st ON st.id = tl.source_task_id
      JOIN tasks tt ON tt.id = tl.target_task_id
      WHERE st.project_id = ? OR tt.project_id = ?
      ORDER BY tl.created_at ASC
    `).bind(projectId, projectId).all()
    results = rows
  }

  return c.json((results as Record<string, unknown>[]).map(toCamel))
})

taskLinkRoutes.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = linkSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

  const { sourceTaskId, targetTaskId, linkType } = parsed.data
  if (sourceTaskId === targetTaskId) return c.json({ message: 'Cannot link a task to itself' }, 400)

  const id = crypto.randomUUID()
  try {
    await c.env.DB.prepare(`
      INSERT INTO task_links (id, source_task_id, target_task_id, link_type, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, sourceTaskId, targetTaskId, linkType, user.sub).run()
  } catch {
    return c.json({ message: 'Link already exists' }, 409)
  }

  const link = await c.env.DB.prepare(`
    SELECT tl.*, st.name as source_name, tt.name as target_name
    FROM task_links tl
    JOIN tasks st ON st.id = tl.source_task_id
    JOIN tasks tt ON tt.id = tl.target_task_id
    WHERE tl.id = ?
  `).bind(id).first()

  return c.json(toCamel(link as Record<string, unknown>), 201)
})

taskLinkRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const link = await c.env.DB.prepare(`
    SELECT tl.id FROM task_links tl
    JOIN tasks st ON st.id = tl.source_task_id
    JOIN projects p ON p.id = st.project_id
    WHERE tl.id = ? AND p.org_id = ?
  `).bind(id, user.orgId).first()
  if (!link) return c.json({ message: 'Not found' }, 404)

  await c.env.DB.prepare('DELETE FROM task_links WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}
