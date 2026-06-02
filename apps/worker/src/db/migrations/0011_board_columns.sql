-- Feature: Configurable Board Columns per project
CREATE TABLE IF NOT EXISTS project_board_columns (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status_key TEXT NOT NULL CHECK (status_key IN ('backlog','todo','in_progress','review','done','cancelled')),
  label      TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#9ca3af',
  position   INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_board_cols_project ON project_board_columns(project_id, position);
