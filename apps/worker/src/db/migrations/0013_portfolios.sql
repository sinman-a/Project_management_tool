-- Feature: Strategic Portfolio Management — Portfolio hierarchy (Portfolio → Program → Project)
CREATE TABLE IF NOT EXISTS portfolios (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  owner_id    TEXT REFERENCES users(id),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_portfolios_org ON portfolios(org_id);

-- Programs may belong to a portfolio (projects roll up via program.portfolio_id).
ALTER TABLE programs ADD COLUMN portfolio_id TEXT REFERENCES portfolios(id);
