import type { Env } from '../types'
import { recalculateAllActiveProjects } from '../services/budgetService'

export async function handleScheduled(_event: ScheduledEvent, env: Env): Promise<void> {
  await recalculateAllActiveProjects(env.DB, env.KV_CACHE)
}
