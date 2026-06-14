import { Hono } from 'hono'
import type { HonoContext } from '../types'

export const searchRoutes = new Hono<HonoContext>()

// GET /search?q= — org-scoped global search across key entities (name match, capped).
searchRoutes.get('/', async (c) => {
  const user = c.get('user')
  const q = (c.req.query('q') ?? '').trim()
  if (q.length < 2) {
    return c.json({ projects: [], tasks: [], risks: [], ideas: [], resources: [] })
  }
  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`
  const LIMIT = 6

  const [projects, tasks, risks, ideas, resources] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, name, status FROM projects WHERE org_id = ? AND name LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT ?`,
    ).bind(user.orgId, like, LIMIT).all(),
    c.env.DB.prepare(
      `SELECT t.id, t.name, t.project_id FROM tasks t JOIN projects p ON p.id = t.project_id
       WHERE p.org_id = ? AND t.deleted_at IS NULL AND t.name LIKE ? ESCAPE '\\' ORDER BY t.created_at DESC LIMIT ?`,
    ).bind(user.orgId, like, LIMIT).all(),
    c.env.DB.prepare(
      `SELECT r.id, r.title, r.project_id FROM risks r JOIN projects p ON p.id = r.project_id
       WHERE p.org_id = ? AND r.deleted_at IS NULL AND r.title LIKE ? ESCAPE '\\' ORDER BY r.score DESC LIMIT ?`,
    ).bind(user.orgId, like, LIMIT).all(),
    c.env.DB.prepare(
      `SELECT id, title FROM ideas WHERE org_id = ? AND archived_at IS NULL AND title LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT ?`,
    ).bind(user.orgId, like, LIMIT).all(),
    c.env.DB.prepare(
      `SELECT id, name, role FROM resources WHERE org_id = ? AND name LIKE ? ESCAPE '\\' ORDER BY name ASC LIMIT ?`,
    ).bind(user.orgId, like, LIMIT).all(),
  ])

  const camel = (rows: Record<string, unknown>[]) =>
    rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()), v])))

  return c.json({
    projects: camel(projects.results),
    tasks: camel(tasks.results),
    risks: camel(risks.results),
    ideas: camel(ideas.results),
    resources: camel(resources.results),
  })
})
