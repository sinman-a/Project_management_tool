-- Feature 10: Demand Intake — Idea Pipeline
CREATE TABLE IF NOT EXISTS strategic_themes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  colour TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(org_id, name)
);
CREATE INDEX IF NOT EXISTS idx_themes_org ON strategic_themes(org_id);

CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  proposed_solution TEXT,
  expected_value_eur REAL,
  estimated_cost_eur REAL,
  estimated_effort_weeks REAL,
  reach INTEGER CHECK (reach BETWEEN 1 AND 9),
  impact INTEGER CHECK (impact BETWEEN 1 AND 9),
  confidence REAL CHECK (confidence BETWEEN 0.1 AND 1.0),
  effort INTEGER CHECK (effort BETWEEN 1 AND 10),
  rice_score REAL GENERATED ALWAYS AS (
    CASE WHEN effort > 0 AND reach IS NOT NULL AND impact IS NOT NULL AND confidence IS NOT NULL
    THEN (reach * impact * confidence) / effort ELSE 0 END
  ) STORED,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','submitted','under_review','approved','rejected','on_hold','converted_to_project')),
  submitter_id TEXT NOT NULL REFERENCES users(id),
  decision_notes TEXT,
  decided_by TEXT REFERENCES users(id),
  decided_at DATETIME,
  converted_project_id TEXT REFERENCES projects(id),
  archived_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ideas_org ON ideas(org_id, status, rice_score DESC);

CREATE TABLE IF NOT EXISTS idea_themes (
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  theme_id TEXT NOT NULL REFERENCES strategic_themes(id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, theme_id)
);

CREATE TABLE IF NOT EXISTS idea_approvals (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  approver_id TEXT NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('approve','reject','request_changes')),
  comments TEXT,
  decided_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_idea_approvals_idea ON idea_approvals(idea_id);
