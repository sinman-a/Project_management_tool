-- Notification preferences (per-user JSON) + dedup index for cron-generated notifications.

ALTER TABLE users ADD COLUMN notification_prefs TEXT;   -- JSON: { task_overdue, risk_attention, comment_added, project_status_changed, mention } booleans; null = all on

CREATE INDEX IF NOT EXISTS idx_notifications_dedup ON notifications(recipient_id, type, entity_id, read_at);
