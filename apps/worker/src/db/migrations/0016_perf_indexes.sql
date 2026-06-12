-- Performance indexes for hot read paths (analytics, forecast, insights, board, capacity).
-- Additive only — no schema/logic changes.

CREATE INDEX IF NOT EXISTS idx_tasks_project_status      ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to         ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_time_logs_task            ON time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_budget_snapshots_project  ON budget_snapshots(project_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_task_assignments_resource ON task_assignments(resource_id);
CREATE INDEX IF NOT EXISTS idx_comments_entity           ON comments(org_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_task            ON task_dependencies(task_id);
