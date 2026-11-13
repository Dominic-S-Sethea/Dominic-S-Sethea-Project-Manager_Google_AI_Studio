-- PM-P7-02: preview-only event ingestion and execution orchestration.
-- Transaction ownership and FK suspension belong to migrate.ts.
CREATE TABLE IF NOT EXISTS event (
    event_id    TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(project_id),
    payload     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
    delivery_id  TEXT PRIMARY KEY,
    event_id     TEXT NOT NULL REFERENCES event(event_id),
    event_type   TEXT NOT NULL,
    payload      TEXT NOT NULL,
    received_at  TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    preview      INTEGER NOT NULL DEFAULT 1 CHECK (preview IN (0, 1)),
    created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
CREATE INDEX IF NOT EXISTS idx_outbox_event_id ON outbox(event_id);
CREATE INDEX IF NOT EXISTS idx_event_project_id ON event(project_id);

CREATE TABLE executions_new (
    execution_id         TEXT PRIMARY KEY,
    workflow_id          TEXT NOT NULL REFERENCES workflows(workflow_id),
    version_id           TEXT NOT NULL REFERENCES workflow_versions(version_id),
    environment_id       TEXT NOT NULL REFERENCES environments(environment_id),
    status               TEXT NOT NULL
                         CHECK (status IN ('pending', 'running', 'awaiting_approval', 'succeeded', 'failed', 'cancelled', 'timed_out', 'created', 'paused', 'rolled_back', 'error')),
    trigger_type         TEXT NOT NULL
                         CHECK (trigger_type IN ('event', 'manual', 'schedule', 'retry', 'replay')),
    trigger_actor_type   TEXT NOT NULL
                         CHECK (trigger_actor_type IN ('user', 'agent', 'system', 'automation')),
    trigger_actor_id     TEXT,
    idempotency_key      TEXT NOT NULL UNIQUE,
    trace_id             TEXT NOT NULL,
    approval_id          TEXT REFERENCES approvals(approval_id),
    attempt_count        INTEGER NOT NULL DEFAULT 0,
    error_class          TEXT CHECK (error_class IS NULL OR error_class IN ('retryable', 'permanent')),
    error_message        TEXT,
    started_at           TEXT,
    completed_at         TEXT,
    cancel_requested_by  TEXT,
    cancel_requested_at  TEXT,
    cancel_reason        TEXT,
    cancelled_at         TEXT,
    created_at           TEXT NOT NULL,
    preview              INTEGER NOT NULL DEFAULT 1 CHECK (preview IN (0, 1))
);

INSERT INTO executions_new (
    execution_id, workflow_id, version_id, environment_id, status,
    trigger_type, trigger_actor_type, trigger_actor_id, idempotency_key,
    trace_id, approval_id, attempt_count, error_class, error_message,
    started_at, completed_at, cancel_requested_by, cancel_requested_at,
    cancel_reason, cancelled_at, created_at, preview
)
SELECT
    execution_id, workflow_id, version_id, environment_id, status,
    trigger_type, trigger_actor_type, trigger_actor_id, idempotency_key,
    trace_id, approval_id, attempt_count, error_class, error_message,
    started_at, completed_at, cancel_requested_by, cancel_requested_at,
    cancel_reason, cancelled_at, created_at, 1
FROM executions;

DROP TABLE executions;
ALTER TABLE executions_new RENAME TO executions;
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);

