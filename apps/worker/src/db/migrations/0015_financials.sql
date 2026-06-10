-- Feature: Financial Management — ROI input + stage-gate budget versions

-- ROI input: total expected financial benefit/return over the project horizon (budget currency).
ALTER TABLE projects ADD COLUMN expected_benefit REAL NOT NULL DEFAULT 0;

-- Stage-gate budget versions (multiple labelled budget revisions per project).
CREATE TABLE IF NOT EXISTS budget_versions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  gate        TEXT,
  capex       REAL NOT NULL DEFAULT 0,
  opex        REAL NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','approved','active','archived')),
  notes       TEXT,
  created_by  TEXT NOT NULL REFERENCES users(id),
  approved_by TEXT REFERENCES users(id),
  approved_at DATETIME,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_budget_versions_project ON budget_versions(project_id, created_at);
