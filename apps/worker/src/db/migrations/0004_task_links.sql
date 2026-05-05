-- PPM Tool — Task links (Related work)
-- Migration: 0004_task_links

CREATE TABLE IF NOT EXISTS task_links (
  id             TEXT PRIMARY KEY,
  source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type      TEXT NOT NULL CHECK(link_type IN ('parent','child','related','duplicate','predecessor','successor')),
  created_by     TEXT NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_task_id, target_task_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_task_links_source ON task_links(source_task_id);
CREATE INDEX IF NOT EXISTS idx_task_links_target ON task_links(target_task_id);
