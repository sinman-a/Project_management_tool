import type { D1Database } from '@cloudflare/workers-types'

/** True if the project exists and belongs to the given org. */
export async function projectInOrg(db: D1Database, projectId: string, orgId: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM projects WHERE id = ? AND org_id = ?')
    .bind(projectId, orgId).first()
  return !!row
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
