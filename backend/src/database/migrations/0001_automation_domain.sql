-- Automation domain model. Preview-only data foundation; no execution runtime.
CREATE TABLE IF NOT EXISTS workflows (
    workflow_id          TEXT PRIMARY KEY,
    project_id           TEXT NOT NULL REFERENCES projects(project_id),
    name                 TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    description          TEXT CHECK (description IS NULL OR length(description) <= 2000),
    status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'test', 'published', 'paused', 'archived')),
    current_version_id   TEXT REFERENCES workflow_versions(version_id),
    created_by           TEXT NOT NULL REFERENCES users(user_id),
    created_by_agent_id  TEXT REFERENCES agents(agent_id),
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS workflow_versions (
    version_id       TEXT PRIMARY KEY,
    workflow_id      TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
    version_number   INTEGER NOT NULL CHECK (version_number >= 1),
    definition_json  TEXT NOT NULL,
    definition_hash  TEXT NOT NULL,
    schema_version   INTEGER NOT NULL,
    is_reviewed      INTEGER NOT NULL DEFAULT 0,
    review_note      TEXT,
    created_by       TEXT NOT NULL,
    created_at       TEXT NOT NULL,
    published_at     TEXT,
    UNIQUE (workflow_id, version_number)
);

CREATE TABLE IF NOT EXISTS environments (
    environment_id  TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(project_id),
    name            TEXT NOT NULL,
    mode            TEXT NOT NULL CHECK (mode IN ('preview', 'test', 'live')),
    is_live         INTEGER NOT NULL DEFAULT 0,
    created_by      TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS credential_references (
    credential_reference_id  TEXT PRIMARY KEY,
    project_id               TEXT NOT NULL REFERENCES projects(project_id),
    connector_id             TEXT REFERENCES connectors(connector_id),
    environment_id           TEXT REFERENCES environments(environment_id),
    reference                TEXT NOT NULL,
    provider_scopes          TEXT NOT NULL DEFAULT '[]',
    created_by               TEXT NOT NULL,
    created_at               TEXT NOT NULL,
    rotated_at               TEXT,
    expires_at               TEXT,
    revoked_at               TEXT,
    last_verified_at         TEXT
);

CREATE TABLE IF NOT EXISTS workflow_nodes (
    node_id                   TEXT PRIMARY KEY,
    version_id                TEXT NOT NULL REFERENCES workflow_versions(version_id) ON DELETE CASCADE,
    node_type                 TEXT NOT NULL
                              CHECK (node_type IN ('trigger', 'transform', 'decision', 'action', 'human_gate', 'error_handler')),
    name                      TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    config_json               TEXT NOT NULL,
    credential_reference_id  TEXT REFERENCES credential_references(credential_reference_id),
    position_x                REAL NOT NULL DEFAULT 0,
    position_y                REAL NOT NULL DEFAULT 0,
    created_at                TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_edges (
    edge_id         TEXT PRIMARY KEY,
    version_id      TEXT NOT NULL REFERENCES workflow_versions(version_id) ON DELETE CASCADE,
    from_node_id    TEXT NOT NULL REFERENCES workflow_nodes(node_id),
    to_node_id      TEXT NOT NULL REFERENCES workflow_nodes(node_id),
    branch_label    TEXT,
    condition_expr  TEXT
);

CREATE TABLE IF NOT EXISTS executions (
    execution_id         TEXT PRIMARY KEY,
    workflow_id          TEXT NOT NULL REFERENCES workflows(workflow_id),
    version_id           TEXT NOT NULL REFERENCES workflow_versions(version_id),
    environment_id       TEXT NOT NULL REFERENCES environments(environment_id),
    status               TEXT NOT NULL
                         CHECK (status IN ('pending', 'running', 'awaiting_approval', 'succeeded', 'failed', 'cancelled', 'timed_out')),
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
    created_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_steps (
    step_id                 TEXT PRIMARY KEY,
    execution_id            TEXT NOT NULL REFERENCES executions(execution_id) ON DELETE CASCADE,
    node_id                 TEXT NOT NULL REFERENCES workflow_nodes(node_id),
    node_type               TEXT NOT NULL,
    attempt                 INTEGER NOT NULL DEFAULT 1,
    status                  TEXT NOT NULL
                            CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'skipped', 'cancelled')),
    input_json              TEXT,
    output_json             TEXT,
    credential_reference_id TEXT,
    idempotency_key         TEXT NOT NULL,
    started_at              TEXT,
    ended_at                TEXT,
    duration_ms             INTEGER,
    error_class             TEXT,
    error_message           TEXT,
    created_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
    approval_id        TEXT PRIMARY KEY,
    execution_id       TEXT REFERENCES executions(execution_id),
    step_id            TEXT REFERENCES execution_steps(step_id),
    workflow_id        TEXT NOT NULL REFERENCES workflows(workflow_id),
    version_id         TEXT,
    approval_type      TEXT NOT NULL
                       CHECK (approval_type IN ('publish', 'execute', 'connector_action', 'replay_side_effect')),
    status             TEXT NOT NULL
                       CHECK (status IN ('pending', 'granted', 'rejected', 'expired', 'cancelled')),
    requested_by_type TEXT NOT NULL
                      CHECK (requested_by_type IN ('user', 'agent', 'automation')),
    requested_by_id    TEXT NOT NULL,
    requested_at       TEXT NOT NULL,
    reviewer_id        TEXT REFERENCES users(user_id),
    decided_at         TEXT,
    decision_note      TEXT,
    expires_at         TEXT NOT NULL,
    idempotency_key    TEXT NOT NULL UNIQUE,
    created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key               TEXT PRIMARY KEY,
    request_hash      TEXT NOT NULL,
    response_snapshot TEXT NOT NULL,
    created_at        TEXT NOT NULL,
    expires_at        TEXT NOT NULL
);

-- Approved Automation-domain indexes only.
CREATE INDEX IF NOT EXISTS idx_workflows_project ON workflows(project_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow ON workflow_versions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_version ON workflow_nodes(version_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_version ON workflow_edges(version_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_from ON workflow_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_environments_project ON environments(project_id);
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_execution_steps_execution ON execution_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_approvals_workflow ON approvals(workflow_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_credential_references_project ON credential_references(project_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_environments_one_live_per_project
    ON environments(project_id)
    WHERE is_live = 1;
