-- Feature 3: Baseline Lock + EVM
ALTER TABLE tasks ADD COLUMN percent_complete INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS ev_method_configs (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT 'percent_complete' CHECK (method IN ('zero_hundred','fifty_fifty','percent_complete')),
  spi_amber_threshold REAL NOT NULL DEFAULT 0.05,
  spi_red_threshold REAL NOT NULL DEFAULT 0.15,
  cpi_amber_threshold REAL NOT NULL DEFAULT 0.05,
  cpi_red_threshold REAL NOT NULL DEFAULT 0.15
);

CREATE TABLE IF NOT EXISTS baselines (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_by TEXT NOT NULL REFERENCES users(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  total_budget REAL NOT NULL DEFAULT 0,
  total_capex REAL NOT NULL DEFAULT 0,
  total_opex REAL NOT NULL DEFAULT 0,
  planned_start TEXT,
  planned_finish TEXT
);
CREATE INDEX IF NOT EXISTS idx_baselines_project ON baselines(project_id, is_active);

CREATE TABLE IF NOT EXISTS baseline_tasks (
  id TEXT PRIMARY KEY,
  baseline_id TEXT NOT NULL REFERENCES baselines(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  task_name_snapshot TEXT NOT NULL,
  planned_start TEXT,
  planned_finish TEXT,
  planned_duration_days INTEGER NOT NULL DEFAULT 0,
  planned_estimate_hours REAL NOT NULL DEFAULT 0,
  planned_budget REAL NOT NULL DEFAULT 0,
  parent_task_id_snapshot TEXT
);
CREATE INDEX IF NOT EXISTS idx_baseline_tasks_baseline ON baseline_tasks(baseline_id);
CREATE INDEX IF NOT EXISTS idx_baseline_tasks_task ON baseline_tasks(task_id);
