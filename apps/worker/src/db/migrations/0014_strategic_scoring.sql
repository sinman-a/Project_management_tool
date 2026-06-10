-- Feature: Strategic value index (P_score) for demand management.
-- P_score = (Σ wᵢ·Sᵢ) / √(C² + R²)
CREATE TABLE IF NOT EXISTS strategic_drivers (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  weight     REAL NOT NULL DEFAULT 0,    -- relative; normalized so Σ(active) = 1.0 at compute time
  is_active  INTEGER NOT NULL DEFAULT 1,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, name)
);
CREATE INDEX IF NOT EXISTS idx_drivers_org ON strategic_drivers(org_id, position);

-- Per-idea expert score (1-10) against each strategic driver.
CREATE TABLE IF NOT EXISTS idea_driver_scores (
  idea_id   TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES strategic_drivers(id) ON DELETE CASCADE,
  score     INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 10),
  PRIMARY KEY (idea_id, driver_id)
);
CREATE INDEX IF NOT EXISTS idx_ids_idea ON idea_driver_scores(idea_id);

-- Manual expert risk rating (1-5) for the R component.
ALTER TABLE ideas ADD COLUMN risk_score INTEGER;
