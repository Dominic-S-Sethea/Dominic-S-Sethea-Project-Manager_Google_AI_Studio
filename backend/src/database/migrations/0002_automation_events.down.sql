-- Guard 1: new execution states cannot be represented by the PM-P7-01 schema.
CREATE TABLE __pm_p7_02_down_guard (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO __pm_p7_02_down_guard(ok)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM executions
  WHERE status IN ('created', 'paused', 'rolled_back', 'error')
) THEN 0 ELSE 1 END;

-- Guard 2: accepted event/outbox data must never be silently discarded.
INSERT INTO __pm_p7_02_down_guard(ok)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM event) = 0 AND (SELECT COUNT(*) FROM outbox) = 0
THEN 1 ELSE 0 END;
DROP TABLE __pm_p7_02_down_guard;

CREATE TABLE executions_old (
  execution_id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id),
  version_id TEXT NOT NULL REFERENCES workflow_versions(version_id),
  environment_id TEXT NOT NULL REFERENCES environments(environment_id),
  status TEXT NOT NULL CHECK (status IN ('pending','running','awaiting_approval','succeeded','failed','cancelled','timed_out')),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event','manual','schedule','retry','replay')),
  trigger_actor_type TEXT NOT NULL CHECK (trigger_actor_type IN ('user','agent','system','automation')),
  trigger_actor_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  trace_id TEXT NOT NULL,
  approval_id TEXT REFERENCES approvals(approval_id),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_class TEXT CHECK (error_class IS NULL OR error_class IN ('retryable','permanent')),
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  cancel_requested_by TEXT,
  cancel_requested_at TEXT,
  cancel_reason TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO executions_old (
  execution_id, workflow_id, version_id, environment_id, status,
  trigger_type, trigger_actor_type, trigger_actor_id, idempotency_key,
  trace_id, approval_id, attempt_count, error_class, error_message,
  started_at, completed_at, cancel_requested_by, cancel_requested_at,
  cancel_reason, cancelled_at, created_at
)
SELECT
  execution_id, workflow_id, version_id, environment_id, status,
  trigger_type, trigger_actor_type, trigger_actor_id, idempotency_key,
  trace_id, approval_id, attempt_count, error_class, error_message,
  started_at, completed_at, cancel_requested_by, cancel_requested_at,
  cancel_reason, cancelled_at, created_at
FROM executions;

DROP TABLE executions;
ALTER TABLE executions_old RENAME TO executions;
DROP TABLE outbox;
DROP TABLE event;
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);

