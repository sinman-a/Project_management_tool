-- Feature 5: In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  actor_id TEXT REFERENCES users(id),
  payload TEXT NOT NULL DEFAULT '{}',
  read_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(org_id, created_at DESC);
