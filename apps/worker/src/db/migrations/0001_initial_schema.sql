-- PPM Tool — Initial Schema
-- Cloudflare D1 (SQLite)
-- Migration: 0001_initial_schema

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id                    TEXT      PRIMARY KEY,
  name                  TEXT      NOT NULL,
  settings              TEXT      NOT NULL DEFAULT '{"fiscalYearStart":1,"currency":"USD","workingHoursPerDay":8}',
  created_at            DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                    TEXT      PRIMARY KEY,
  org_id                TEXT      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email                 TEXT      NOT NULL UNIQUE,
  full_name             TEXT      NOT NULL,
  role                  TEXT      NOT NULL CHECK (role IN ('admin','program_manager','project_manager','team_member')),
  password_hash         TEXT      NOT NULL,
  is_active             INTEGER   NOT NULL DEFAULT 1,
  created_at            DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);

-- ============================================================
-- RESOURCES
-- ============================================================
CREATE TABLE IF NOT EXISTS resources (
  id                        TEXT          PRIMARY KEY,
  org_id                    TEXT          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id                   TEXT          REFERENCES users(id) ON DELETE SET NULL,
  name                      TEXT          NOT NULL,
  type                      TEXT          NOT NULL CHECK (type IN ('human','equipment')),
  cost_type                 TEXT          NOT NULL CHECK (cost_type IN ('capex','opex')),
  rate                      REAL          NOT NULL CHECK (rate >= 0),
  currency                  TEXT          NOT NULL DEFAULT 'USD',
  capacity_hours_per_week   REAL          NOT NULL DEFAULT 40.0,
  created_at                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resources_org_id  ON resources(org_id);
CREATE INDEX IF NOT EXISTS idx_resources_user_id ON resources(user_id);

-- ============================================================
-- PROGRAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS programs (
  id            TEXT      PRIMARY KEY,
  org_id        TEXT      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT      NOT NULL,
  description   TEXT,
  owner_id      TEXT      NOT NULL REFERENCES users(id),
  status        TEXT      NOT NULL DEFAULT 'planning'
                          CHECK (status IN ('planning','active','on_hold','closed')),
  start_date    TEXT      NOT NULL,
  end_date      TEXT,
  budget_capex  REAL      NOT NULL DEFAULT 0,
  budget_opex   REAL      NOT NULL DEFAULT 0,
  created_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_programs_org_id   ON programs(org_id);
CREATE INDEX IF NOT EXISTS idx_programs_owner_id ON programs(owner_id);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id            TEXT      PRIMARY KEY,
  org_id        TEXT      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  program_id    TEXT      REFERENCES programs(id) ON DELETE SET NULL,
  name          TEXT      NOT NULL,
  description   TEXT,
  manager_id    TEXT      NOT NULL REFERENCES users(id),
  methodology   TEXT      NOT NULL DEFAULT 'hybrid'
                          CHECK (methodology IN ('waterfall','agile','hybrid')),
  status        TEXT      NOT NULL DEFAULT 'planning'
                          CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  start_date    TEXT      NOT NULL,
  end_date      TEXT,
  budget_capex  REAL      NOT NULL DEFAULT 0,
  budget_opex   REAL      NOT NULL DEFAULT 0,
  created_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_org_id     ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_program_id ON projects(program_id);
CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON projects(manager_id);

-- ============================================================
-- SPRINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS sprints (
  id          TEXT      PRIMARY KEY,
  project_id  TEXT      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT      NOT NULL,
  goal        TEXT,
  start_date  TEXT      NOT NULL,
  end_date    TEXT      NOT NULL,
  status      TEXT      NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned','active','completed')),
  velocity    INTEGER,
  created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id              TEXT      PRIMARY KEY,
  project_id      TEXT      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sprint_id       TEXT      REFERENCES sprints(id) ON DELETE SET NULL,
  parent_task_id  TEXT      REFERENCES tasks(id) ON DELETE CASCADE,
  name            TEXT      NOT NULL,
  description     TEXT,
  type            TEXT      NOT NULL DEFAULT 'agile_task'
                            CHECK (type IN ('waterfall_phase','agile_story','agile_task','milestone')),
  status          TEXT      NOT NULL DEFAULT 'backlog'
                            CHECK (status IN ('backlog','todo','in_progress','review','done','cancelled')),
  priority        TEXT      NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('critical','high','medium','low')),
  assigned_to     TEXT      REFERENCES users(id) ON DELETE SET NULL,
  story_points    INTEGER,
  estimated_hours REAL      NOT NULL DEFAULT 0,
  start_date      TEXT,
  due_date        TEXT,
  cost_type       TEXT      NOT NULL DEFAULT 'opex'
                            CHECK (cost_type IN ('capex','opex')),
  wbs_code        TEXT,
  created_by      TEXT      NOT NULL REFERENCES users(id),
  created_at      DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id     ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id      ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to    ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status         ON tasks(status);

-- ============================================================
-- TASK DEPENDENCIES
-- ============================================================
CREATE TABLE IF NOT EXISTS task_dependencies (
  id              TEXT      PRIMARY KEY,
  task_id         TEXT      NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id   TEXT      NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT      NOT NULL DEFAULT 'finish_to_start'
                            CHECK (dependency_type IN
                              ('finish_to_start','start_to_start','finish_to_finish','start_to_finish')),
  lag_days        INTEGER   NOT NULL DEFAULT 0,
  cross_project   INTEGER   NOT NULL DEFAULT 0,
  created_at      DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (task_id, depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_task       ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on ON task_dependencies(depends_on_id);

-- ============================================================
-- TASK ASSIGNMENTS (Resource ↔ Task)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_assignments (
  id              TEXT    PRIMARY KEY,
  task_id         TEXT    NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  resource_id     TEXT    NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  allocated_hours REAL    NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (task_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_task     ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_resource ON task_assignments(resource_id);

-- ============================================================
-- TIME LOGS  ←  Core financial engine entry point
-- computed_cost = hours * unit_rate  (virtual column)
-- cost_type     = snapshot from tasks.cost_type at insert
-- unit_rate     = snapshot from resources.rate at insert (IMMUTABLE)
-- ============================================================
CREATE TABLE IF NOT EXISTS time_logs (
  id            TEXT      PRIMARY KEY,
  task_id       TEXT      NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  resource_id   TEXT      NOT NULL REFERENCES resources(id),
  logged_by     TEXT      NOT NULL REFERENCES users(id),
  log_date      TEXT      NOT NULL,
  hours         REAL      NOT NULL CHECK (hours > 0 AND hours <= 24),
  description   TEXT,
  cost_type     TEXT      NOT NULL CHECK (cost_type IN ('capex','opex')),
  unit_rate     REAL      NOT NULL CHECK (unit_rate >= 0),
  computed_cost REAL      NOT NULL DEFAULT 0,
  is_billable   INTEGER   NOT NULL DEFAULT 1,
  approved_by   TEXT      REFERENCES users(id),
  approved_at   DATETIME,
  created_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_time_logs_task_id     ON time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_resource_id ON time_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_log_date    ON time_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_time_logs_approved_at ON time_logs(approved_at);

-- ============================================================
-- RESOURCE ALLOCATIONS (actual hours per week per project)
-- ============================================================
CREATE TABLE IF NOT EXISTS resource_allocations (
  id              TEXT    PRIMARY KEY,
  resource_id     TEXT    NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  project_id      TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  week_start      TEXT    NOT NULL,
  allocated_hours REAL    NOT NULL DEFAULT 0 CHECK (allocated_hours >= 0),
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (resource_id, project_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_resource_alloc_resource_week
  ON resource_allocations(resource_id, week_start);

-- ============================================================
-- BUDGET SNAPSHOTS (calculated hourly by cron)
-- ============================================================
CREATE TABLE IF NOT EXISTS budget_snapshots (
  id                TEXT    PRIMARY KEY,
  project_id        TEXT    REFERENCES projects(id) ON DELETE CASCADE,
  program_id        TEXT    REFERENCES programs(id) ON DELETE CASCADE,
  snapshot_date     TEXT    NOT NULL,
  budget_capex      REAL    NOT NULL DEFAULT 0,
  budget_opex       REAL    NOT NULL DEFAULT 0,
  spent_capex       REAL    NOT NULL DEFAULT 0,
  spent_opex        REAL    NOT NULL DEFAULT 0,
  committed_capex   REAL    NOT NULL DEFAULT 0,
  committed_opex    REAL    NOT NULL DEFAULT 0,
  burn_rate_capex   REAL    NOT NULL DEFAULT 0,
  burn_rate_opex    REAL    NOT NULL DEFAULT 0,
  eac_capex         REAL    NOT NULL DEFAULT 0,
  eac_opex          REAL    NOT NULL DEFAULT 0,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_budget_snapshots_project_date
  ON budget_snapshots(project_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_budget_snapshots_program_date
  ON budget_snapshots(program_id, snapshot_date);

-- ============================================================
-- STATUS REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS status_reports (
  id                        TEXT      PRIMARY KEY,
  project_id                TEXT      REFERENCES projects(id) ON DELETE CASCADE,
  program_id                TEXT      REFERENCES programs(id) ON DELETE CASCADE,
  author_id                 TEXT      NOT NULL REFERENCES users(id),
  report_date               TEXT      NOT NULL,
  period_start              TEXT      NOT NULL,
  period_end                TEXT      NOT NULL,
  overall_status            TEXT      NOT NULL CHECK (overall_status IN ('green','amber','red')),
  schedule_status           TEXT      NOT NULL CHECK (schedule_status IN ('green','amber','red')),
  budget_status             TEXT      NOT NULL CHECK (budget_status IN ('green','amber','red')),
  scope_status              TEXT      NOT NULL CHECK (scope_status IN ('green','amber','red')),
  narrative_this_period     TEXT,
  narrative_next_period     TEXT,
  risks_issues              TEXT,  -- JSON array
  created_at                DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_status_reports_project ON status_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_status_reports_program ON status_reports(program_id);

-- ============================================================
-- KPI WIDGETS
-- ============================================================
CREATE TABLE IF NOT EXISTS kpi_widgets (
  id                TEXT      PRIMARY KEY,
  org_id            TEXT      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id          TEXT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT      NOT NULL,
  widget_type       TEXT      NOT NULL
                    CHECK (widget_type IN ('metric_card','line_chart','bar_chart','gantt_mini','table')),
  query_config      TEXT      NOT NULL DEFAULT '{}',
  display_config    TEXT      NOT NULL DEFAULT '{}',
  dashboard_position INTEGER  NOT NULL DEFAULT 0,
  created_at        DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpi_widgets_owner ON kpi_widgets(owner_id);

-- ============================================================
-- SEED: Default organization + admin user
-- Password hash = HMAC-SHA256("changeme123") with key "changeme"
-- IMPORTANT: Change password immediately after first login!
-- ============================================================
INSERT OR IGNORE INTO organizations (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'My Organization');

INSERT OR IGNORE INTO users (id, org_id, email, full_name, role, password_hash) VALUES
  ('00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'admin@example.com',
   'System Admin',
   'admin',
   'CHANGE_ME_BEFORE_DEPLOY');
