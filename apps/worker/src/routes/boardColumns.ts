import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'

const DEFAULTS = [
  { statusKey: 'backlog',     label: 'Backlog',      color: '#9ca3af', position: 0, isVisible: true },
  { statusKey: 'todo',        label: 'To Do',         color: '#60a5fa', position: 1, isVisible: true },
  { statusKey: 'in_progress', label: 'In Progress',   color: '#818cf8', position: 2, isVisible: true },
  { statusKey: 'review',      label: 'Review',        color: '#c084fc', position: 3, isVisible: true },
  { statusKey: 'done',        label: 'Done',          color: '#4ade80', position: 4, isVisible: true },
  { statusKey: 'cancelled',   label: 'Cancelled',     color: '#6b7280', position: 5, isVisible: false },
]

const columnSchema = z.object({
  statusKey: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled']),
  label: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#9ca3af'),
  position: z.number().int().min(0).default(0),
  isVisible: z.boolean().default(true),
})

// Sub-routes mounted on /projects
export const boardColumnSubRoutes = new Hono<HonoContext>()

// GET /projects/:id/board-columns
boardColumnSubRoutes.get('/:id/board-columns', async (c) => {
  const projectId = c.req.param('id')

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM project_board_columns WHERE project_id = ? ORDER BY position ASC',
  ).bind(projectId).all()

  if (results.length === 0) {
    // Return built-in defaults (not persisted to DB)
    return c.json(DEFAULTS.map((d, i) => ({
      id: `default-${d.statusKey}`,
      projectId,
      statusKey: d.statusKey,
      label: d.label,
      color: d.color,
      position: i,
      isVisible: d.isVisible,
      isDefault: true,
    })))
  }

  return c.json(results.map(toCamel))
})

// POST /projects/:id/board-columns — create a new column
boardColumnSubRoutes.post(
  '/:id/board-columns',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const projectId = c.req.param('id')
    const body = await c.req.json()
    const parsed = columnSchema.safeParse(body)
    if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.flatten() }, 400)

    const d = parsed.data
    const id = crypto.randomUUID()

    await c.env.DB.prepare(
      'INSERT INTO project_board_columns (id, project_id, status_key, label, color, position, is_visible) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, projectId, d.statusKey, d.label, d.color, d.position, d.isVisible ? 1 : 0).run()

    const row = await c.env.DB.prepare(
      'SELECT * FROM project_board_columns WHERE id = ?',
    ).bind(id).first()

    return c.json(toCamel(row!), 201)
  },
)

// POST /projects/:id/board-columns/reset — delete all custom config
boardColumnSubRoutes.post(
  '/:id/board-columns/reset',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const projectId = c.req.param('id')
    await c.env.DB.prepare(
      'DELETE FROM project_board_columns WHERE project_id = ?',
    ).bind(projectId).run()
    return c.json({ success: true, message: 'Reset to defaults' })
  },
)

// Standalone routes mounted on /board-columns
export const boardColumnRoutes = new Hono<HonoContext>()

// PATCH /board-columns/:id
boardColumnRoutes.patch(
  '/:id',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const parsed = columnSchema.partial().safeParse(body)
    if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

    const d = parsed.data
    const updates: [string, unknown][] = []
    if (d.label !== undefined) updates.push(['label', d.label])
    if (d.color !== undefined) updates.push(['color', d.color])
    if (d.position !== undefined) updates.push(['position', d.position])
    if (d.isVisible !== undefined) updates.push(['is_visible', d.isVisible ? 1 : 0])
    if (d.statusKey !== undefined) updates.push(['status_key', d.statusKey])

    if (updates.length === 0) return c.json({ message: 'No fields to update' }, 400)

    const setClauses = updates.map(([k]) => `${k} = ?`).join(', ')
    await c.env.DB.prepare(`UPDATE project_board_columns SET ${setClauses} WHERE id = ?`)
      .bind(...updates.map(([, v]) => v), id).run()

    const row = await c.env.DB.prepare(
      'SELECT * FROM project_board_columns WHERE id = ?',
    ).bind(id).first()

    if (!row) return c.json({ message: 'Not found' }, 404)
    return c.json(toCamel(row))
  },
)

// DELETE /board-columns/:id
boardColumnRoutes.delete(
  '/:id',
  requireAny('admin', 'program_manager', 'pmo_lead', 'project_manager'),
  async (c) => {
    const id = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM project_board_columns WHERE id = ?').bind(id).run()
    return c.json({ success: true })
  },
)

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()), v]),
  )
}
