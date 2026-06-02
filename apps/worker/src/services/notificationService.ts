export async function createNotification(
  db: D1Database,
  opts: {
    orgId: string
    recipientId: string
    type: string
    entityType?: string
    entityId?: string
    actorId?: string
    payload?: Record<string, unknown>
  },
) {
  try {
    await db.prepare(`
      INSERT INTO notifications (id, org_id, recipient_id, type, entity_type, entity_id, actor_id, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      opts.orgId,
      opts.recipientId,
      opts.type,
      opts.entityType ?? null,
      opts.entityId ?? null,
      opts.actorId ?? null,
      JSON.stringify(opts.payload ?? {}),
    ).run()
  } catch {
    // Silently skip if notifications table not yet migrated
  }
}
