-- Migration: 0005_dependencies_and_risks
-- Adds: rag_status to projects, project_dependencies table,
--       risk_categories, risks, risk_audit_log tables

-- ============================================================
-- RAG STATUS on projects (computed/manually set by PM)
-- ============================================================
ALTER TABLE projects ADD COLUMN rag_status TEXT NOT NULL DEFAULT 'green'
  CHECK (rag_status IN ('green', 'amber', 'red'));

-- ============================================================
-- PROJECT DEPENDENCIES (program-level Gantt / roadmap)
-- successor project_id depends on predecessor depends_on_id
-- ============================================================
CREATE TABLE IF NOT EXISTS project_dependencies (
  id              TEXT    PRIMARY KEY,
  project_id      TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  depends_on_id   TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dependency_type TEXT    NOT NULL DEFAULT 'finish_to_start'
                          CHECK (dependency_type IN
                            ('finish_to_start','start_to_start','finish_to_finish','start_to_finish')),
  lag_days        INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT    NOT NULL REFERENCES users(id),
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, depends_on_id)
);
CREATE INDEX IF NOT EXISTS idx_proj_deps_project    ON project_dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_deps_depends_on ON project_dependencies(depends_on_id);

-- ============================================================
-- RISK CATEGORIES (custom per org; built-ins are hardcoded in API)
-- ============================================================
CREATE TABLE IF NOT EXISTS risk_categories (
  id         TEXT    PRIMARY KEY,
  org_id     TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (org_id, name)
);
CREATE INDEX IF NOT EXISTS idx_risk_categories_org ON risk_categories(org_id);

-- ============================================================
-- RISKS
-- ============================================================
CREATE TABLE IF NOT EXISTS risks (
  id                 TEXT    PRIMARY KEY,
  project_id         TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  risk_number        INTEGER NOT NULL,
  title              TEXT    NOT NULL,
  description        TEXT,
  category           TEXT    NOT NULL DEFAULT 'Technical',
  probability        INTEGER NOT NULL CHECK (probability BETWEEN 1 AND 5),
  impact             INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
  score              INTEGER NOT NULL,
  score_band         TEXT    NOT NULL CHECK (score_band IN ('low','medium','high','critical')),
  owner_id           TEXT    REFERENCES users(id) ON DELETE SET NULL,
  status             TEXT    NOT NULL DEFAULT 'identified'
                             CHECK (status IN
                               ('identified','analyzing','mitigating','closed','accepted','occurred')),
  response_strategy  TEXT    CHECK (response_strategy IN ('avoid','transfer','mitigate','accept')),
  mitigation_actions TEXT,
  contingency_plan   TEXT,
  trigger_indicators TEXT,
  date_identified    TEXT    NOT NULL,
  date_last_reviewed TEXT,
  next_review_date   TEXT,
  created_by         TEXT    NOT NULL REFERENCES users(id),
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at         DATETIME,
  UNIQUE (project_id, risk_number)
);
CREATE INDEX IF NOT EXISTS idx_risks_project ON risks(project_id);
CREATE INDEX IF NOT EXISTS idx_risks_score   ON risks(score DESC);
CREATE INDEX IF NOT EXISTS idx_risks_deleted ON risks(deleted_at);

-- ============================================================
-- RISK AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS risk_audit_log (
  id         TEXT    PRIMARY KEY,
  risk_id    TEXT    NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  changed_by TEXT    NOT NULL REFERENCES users(id),
  field_name TEXT    NOT NULL,
  old_value  TEXT,
  new_value  TEXT,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_risk_audit_risk ON risk_audit_log(risk_id);
