-- PPM Tool — RICE matrix table + bug task type
-- Migration: 0003_rice_and_bug

CREATE TABLE IF NOT EXISTS rice_items (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone      TEXT,
  goal           TEXT,
  business_value TEXT,
  user_story     TEXT,
  reach          INTEGER NOT NULL DEFAULT 1 CHECK(reach BETWEEN 1 AND 9),
  impact         INTEGER NOT NULL DEFAULT 1 CHECK(impact BETWEEN 1 AND 9),
  confidence     REAL    NOT NULL DEFAULT 1.0 CHECK(confidence BETWEEN 0.1 AND 1.0),
  effort         INTEGER NOT NULL DEFAULT 1 CHECK(effort BETWEEN 1 AND 10),
  rice_score     REAL    GENERATED ALWAYS AS (ROUND((reach * impact * confidence) / effort, 2)) VIRTUAL,
  created_by     TEXT NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rice_items_project ON rice_items(project_id);
