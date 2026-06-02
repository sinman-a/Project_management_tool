-- Feature: Cost Estimation Matrix (planning-phase budget calculator)
CREATE TABLE IF NOT EXISTS cost_estimations (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT 'Estimation v1',
  notes        TEXT,
  currency     TEXT NOT NULL DEFAULT 'USD',
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ce_project ON cost_estimations(project_id);

-- Grade columns (roles with day rate and cost type)
CREATE TABLE IF NOT EXISTS cost_estimation_grades (
  id             TEXT PRIMARY KEY,
  estimation_id  TEXT NOT NULL REFERENCES cost_estimations(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  rate_per_day   REAL NOT NULL DEFAULT 0,
  cost_type      TEXT NOT NULL DEFAULT 'capex' CHECK (cost_type IN ('capex','opex')),
  position       INTEGER NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ceg_estimation ON cost_estimation_grades(estimation_id, position);

-- Matrix rows (stage + work description)
CREATE TABLE IF NOT EXISTS cost_estimation_rows (
  id               TEXT PRIMARY KEY,
  estimation_id    TEXT NOT NULL REFERENCES cost_estimations(id) ON DELETE CASCADE,
  stage            TEXT NOT NULL DEFAULT '',
  work_description TEXT NOT NULL DEFAULT '',
  position         INTEGER NOT NULL DEFAULT 0,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cer_estimation ON cost_estimation_rows(estimation_id, position);

-- Sparse cell values (row × grade = days)
CREATE TABLE IF NOT EXISTS cost_estimation_cells (
  id       TEXT PRIMARY KEY,
  row_id   TEXT NOT NULL REFERENCES cost_estimation_rows(id) ON DELETE CASCADE,
  grade_id TEXT NOT NULL REFERENCES cost_estimation_grades(id) ON DELETE CASCADE,
  days     REAL NOT NULL DEFAULT 0,
  UNIQUE (row_id, grade_id)
);
CREATE INDEX IF NOT EXISTS idx_cec_row   ON cost_estimation_cells(row_id);
CREATE INDEX IF NOT EXISTS idx_cec_grade ON cost_estimation_cells(grade_id);
