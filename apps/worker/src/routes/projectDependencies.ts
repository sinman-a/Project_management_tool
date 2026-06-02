import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types'
import { requireAny } from '../middleware/rbac'
import { programInOrg, projectInOrg } from '../middleware/ownership'

const depSchema = z.object({
  projectId: z.string().uuid(),
  dependsOnId: z.string().uuid(),
  dependencyType: z.enum(['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish']).default('finish_to_start'),
  lagDays: z.number().int().min(-30).max(60).default(0),
})

export const projectDependencyRoutes = new Hono<HonoContext>()

projectDependencyRoutes.get('/:programId/project-dependencies', async (c) => {
  const user = c.get('user')
  const programId = c.req.param('programId')
  if (!(await programInOrg(c.env.DB, programId, user.orgId))) return c.json({ message: 'Not found' }, 404)
  const { results } = await c.env.DB.prepare(`
    SELECT pd.*,
           p1.name as project_name,
           p2.name as depends_on_name
    FROM project_dependencies pd
    JOIN projects p1 ON p1.id = pd.project_id
    JOIN projects p2 ON p2.id = pd.depends_on_id
    WHERE p1.program_id = ?
  `).bind(programId).all()
  return c.json(results.map(toCamel))
})

projectDependencyRoutes.post('/:programId/project-dependencies', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const programId = c.req.param('programId')
  if (!(await programInOrg(c.env.DB, programId, user.orgId))) return c.json({ message: 'Not found' }, 404)
  const body = await c.req.json()
  const parsed = depSchema.safeParse(body)
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400)

  const { projectId, dependsOnId, dependencyType, lagDays } = parsed.data
  if (projectId === dependsOnId) return c.json({ message: 'Project cannot depend on itself' }, 400)

  // Both projects must belong to the caller's org
  if (!(await projectInOrg(c.env.DB, projectId, user.orgId))) return c.json({ message: 'Invalid project' }, 400)
  if (!(await projectInOrg(c.env.DB, dependsOnId, user.orgId))) return c.json({ message: 'Invalid dependency' }, 400)

  const id = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO project_dependencies (id, project_id, depends_on_id, dependency_type, lag_days, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, projectId, dependsOnId, dependencyType, lagDays, user.sub).run()

  return c.json({ id, projectId, dependsOnId, dependencyType, lagDays }, 201)
})

projectDependencyRoutes.delete('/:programId/project-dependencies/:depId', requireAny('admin', 'program_manager', 'pmo_lead'), async (c) => {
  const user = c.get('user')
  const depId = c.req.param('depId')
  // Dependency's project must belong to caller's org
  const owned = await c.env.DB.prepare(`
    SELECT 1 FROM project_dependencies pd
    JOIN projects p ON p.id = pd.project_id
    WHERE pd.id = ? AND p.org_id = ?
  `).bind(depId, user.orgId).first()
  if (!owned) return c.json({ message: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM project_dependencies WHERE id = ?').bind(depId).run()
  return c.json({ success: true })
})

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]),
  )
}
