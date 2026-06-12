import type { D1Database } from '@cloudflare/workers-types'
import type { JwtPayload } from '../types'

/** True if the project exists and belongs to the given org. */
export async function projectInOrg(db: D1Database, projectId: string, orgId: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM projects WHERE id = ? AND org_id = ?')
    .bind(projectId, orgId).first()
  return !!row
}

/** True if the task exists and belongs to the given org (task → project → org). */
export async function taskInOrg(db: D1Database, taskId: string, orgId: string): Promise<boolean> {
  const row = await db.prepare(
    'SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = ? AND p.org_id = ?',
  ).bind(taskId, orgId).first()
  return !!row
}

// Roles with org-wide read (oversight / executive). Others are scoped to their own work.
const ORG_WIDE_READ = new Set(['admin', 'pmo_lead', 'sponsor', 'viewer', 'program_manager'])

/**
 * Per-entity read authorization for a single project.
 * - Oversight roles: any project in their org.
 * - project_manager: only projects they manage.
 * - team_member: only projects where they have a task assigned.
 * Returns false for cross-org access (defence in depth on top of org_id checks).
 */
export async function canAccessProject(db: D1Database, user: JwtPayload, projectId: string): Promise<boolean> {
  if (!(await projectInOrg(db, projectId, user.orgId))) return false
  if (ORG_WIDE_READ.has(user.role)) return true

  if (user.role === 'project_manager') {
    const row = await db.prepare('SELECT 1 FROM projects WHERE id = ? AND manager_id = ?')
      .bind(projectId, user.sub).first()
    if (row) return true
  }

  // team_member (and any other scoped role): access via an assigned task in the project.
  const assigned = await db.prepare(
    'SELECT 1 FROM tasks WHERE project_id = ? AND assigned_to = ? LIMIT 1',
  ).bind(projectId, user.sub).first()
  return !!assigned
}

/**
 * Per-entity read authorization for a program.
 * Oversight roles see any program in org; scoped roles need access to ≥1 of its projects.
 */
export async function canAccessProgram(db: D1Database, user: JwtPayload, programId: string): Promise<boolean> {
  if (!(await programInOrg(db, programId, user.orgId))) return false
  if (ORG_WIDE_READ.has(user.role)) return true

  if (user.role === 'project_manager') {
    const row = await db.prepare('SELECT 1 FROM projects WHERE program_id = ? AND manager_id = ?')
      .bind(programId, user.sub).first()
    if (row) return true
  }

  const assigned = await db.prepare(`
    SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE p.program_id = ? AND t.assigned_to = ? LIMIT 1
  `).bind(programId, user.sub).first()
  return !!assigned
}

/** True if the program exists and belongs to the given org. */
export async function programInOrg(db: D1Database, programId: string, orgId: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM programs WHERE id = ? AND org_id = ?')
    .bind(programId, orgId).first()
  return !!row
}

/** True if the resource exists and belongs to the given org. */
export async function resourceInOrg(db: D1Database, resourceId: string, orgId: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM resources WHERE id = ? AND org_id = ?')
    .bind(resourceId, orgId).first()
  return !!row
}
