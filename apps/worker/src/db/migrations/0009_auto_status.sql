-- Feature 6: Auto Roll-Up Status Reports
ALTER TABLE status_reports ADD COLUMN auto_suggested_rag TEXT;
ALTER TABLE status_reports ADD COLUMN auto_suggested_at DATETIME;
ALTER TABLE status_reports ADD COLUMN rule_version TEXT;
ALTER TABLE status_reports ADD COLUMN override_reasons TEXT;
ALTER TABLE status_reports ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0;
ALTER TABLE status_reports ADD COLUMN generated_by_system INTEGER NOT NULL DEFAULT 0;
ALTER TABLE status_reports ADD COLUMN draft_assigned_to TEXT REFERENCES users(id);

CREATE TABLE IF NOT EXISTS status_report_schedules (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('program','project')),
  scope_id TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('off','weekly','biweekly','monthly')),
  day_of_week INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_report_schedules_org ON status_report_schedules(org_id);
