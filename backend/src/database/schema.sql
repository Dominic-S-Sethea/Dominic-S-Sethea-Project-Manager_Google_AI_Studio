-- Project Manager — SQLite Schema
-- Generated per SCHEMA.md (web-ready: WAL mode + foreign keys enforced)

CREATE TABLE IF NOT EXISTS users (
    user_id         TEXT PRIMARY KEY,
    username        TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'viewer',
    status          TEXT NOT NULL DEFAULT 'active',
    created_at      DATETIME NOT NULL,
    last_login_at   DATETIME,
    ip_address      TEXT,
    device_fingerprint TEXT
);

CREATE TABLE IF NOT EXISTS projects (
    project_id   TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'active',
    created_by   TEXT NOT NULL REFERENCES users(user_id),
    metadata     TEXT,
    created_at   DATETIME NOT NULL,
    updated_at   DATETIME NOT NULL
);

-- Project-scoped membership. users.role is retained for compatibility
-- and is not used to authorize Canvas operations.
CREATE TABLE IF NOT EXISTS project_members (
    project_id   TEXT NOT NULL REFERENCES projects(project_id),
    user_id      TEXT NOT NULL REFERENCES users(user_id),
    role         TEXT NOT NULL DEFAULT 'viewer',
    created_at   DATETIME NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user
    ON project_members(user_id);

-- Backfill owner memberships for projects that existed before this table.
-- The service also recognizes projects.created_by as owner if a row is absent.
INSERT OR IGNORE INTO project_members (project_id, user_id, role)
SELECT project_id, created_by, 'owner'
FROM projects;

-- Ensure newly created projects also receive their creator's owner membership.
CREATE TRIGGER IF NOT EXISTS trg_projects_owner_membership_after_insert
AFTER INSERT ON projects
BEGIN
    INSERT OR IGNORE INTO project_members (project_id, user_id, role)
    VALUES (NEW.project_id, NEW.created_by, 'owner');
END;

CREATE TABLE IF NOT EXISTS tasks (
    task_id        TEXT PRIMARY KEY,
    project_id     TEXT NOT NULL REFERENCES projects(project_id),
    title          TEXT NOT NULL,
    description    TEXT,
    status         TEXT NOT NULL DEFAULT 'todo',
    priority       TEXT NOT NULL DEFAULT 'normal',
    assignee_id    TEXT REFERENCES users(user_id),
    created_by     TEXT NOT NULL REFERENCES users(user_id),
    metadata       TEXT,
    due_date       DATETIME,
    created_at     DATETIME NOT NULL,
    updated_at     DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS task_dependencies (
    id              TEXT PRIMARY KEY,
    task_id         TEXT NOT NULL REFERENCES tasks(task_id),
    depends_on_id   TEXT NOT NULL REFERENCES tasks(task_id),
    dependency_type TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT chk_dependency_type CHECK (dependency_type IN ('blocks', 'blocked_by')),
    CONSTRAINT chk_no_self_dependency CHECK (task_id != depends_on_id)
);

CREATE TABLE IF NOT EXISTS comments (
    comment_id    TEXT PRIMARY KEY,
    task_id       TEXT NOT NULL REFERENCES tasks(task_id),
    author_id     TEXT NOT NULL REFERENCES users(user_id),
    body          TEXT NOT NULL,
    created_at    DATETIME NOT NULL,
    updated_at    DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS checklists (
    checklist_id   TEXT PRIMARY KEY,
    task_id        TEXT NOT NULL REFERENCES tasks(task_id),
    title          TEXT NOT NULL,
    is_completed   INTEGER NOT NULL DEFAULT 0,
    created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at     DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checklist_items (
    item_id       TEXT PRIMARY KEY,
    checklist_id  TEXT NOT NULL REFERENCES checklists(checklist_id),
    content       TEXT NOT NULL,
    is_completed  INTEGER NOT NULL DEFAULT 0,
    order_num     INTEGER NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at     DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
    log_id         TEXT PRIMARY KEY,
    user_id        TEXT REFERENCES users(user_id),
    agent_id       TEXT,
    action         TEXT NOT NULL,
    target_table   TEXT NOT NULL,
    target_id      TEXT NOT NULL,
    old_value      TEXT,
    new_value      TEXT,
    trigger        TEXT NOT NULL,
    reasoning_summary TEXT,
    ip_address     TEXT,
    created_at     DATETIME NOT NULL,
    actor_type     TEXT,
    actor_id       TEXT,
    project_id     TEXT,
    request_id     TEXT,
    trace_id       TEXT,
    target_sub_id  TEXT,
    outcome        TEXT
);

CREATE TABLE IF NOT EXISTS agents (
    agent_id      TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL,
    api_key_hash  TEXT NOT NULL,
    provider      TEXT NOT NULL,
    model         TEXT NOT NULL,
    permissions   TEXT NOT NULL,
    rate_limit    INTEGER NOT NULL DEFAULT 60,
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    DATETIME NOT NULL,
    updated_at    DATETIME NOT NULL,
    expires_at    DATETIME
);

-- API tokens issued when an agent is registered.
CREATE TABLE IF NOT EXISTS agent_tokens (
    token_hash  TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL REFERENCES agents(agent_id),
    role        TEXT NOT NULL,
    expires_at  DATETIME NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS agent_activities (
    activity_id   TEXT PRIMARY KEY,
    agent_id      TEXT NOT NULL REFERENCES agents(agent_id),
    user_id       TEXT REFERENCES users(user_id),
    action        TEXT NOT NULL,
    target_id     TEXT NOT NULL,
    target_table  TEXT NOT NULL,
    trigger       TEXT NOT NULL,
    reasoning_summary TEXT,
    status        TEXT NOT NULL DEFAULT 'pending',
    created_at    DATETIME NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project          ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status           ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee         ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date         ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at       ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_deps_task              ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_task          ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_user             ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_target           ON audit_logs(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at       ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_agents_role            ON agents(role);
CREATE INDEX IF NOT EXISTS idx_agents_status          ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_agent     ON agent_tokens(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_expires   ON agent_tokens(expires_at);

CREATE TABLE IF NOT EXISTS login_history (
    login_id         TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(user_id),
    ip_address       TEXT,
    device_fingerprint TEXT,
    logged_in_at     DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_history_user
    ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_time
    ON login_history(logged_in_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_title_project
    ON tasks(project_id, title);

CREATE TABLE IF NOT EXISTS git_commits (
    commit_id       TEXT PRIMARY KEY,
    commit_hash     TEXT NOT NULL UNIQUE,
    commit_message  TEXT NOT NULL,
    task_id         TEXT REFERENCES tasks(task_id),
    author          TEXT,
    committed_at    DATETIME NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_git_commits_task
    ON git_commits(task_id);
CREATE INDEX IF NOT EXISTS idx_git_commits_hash
    ON git_commits(commit_hash);

-- Canvas workspaces (linked to projects).
--
-- NOT NULL applies to newly created databases. CREATE TABLE IF NOT EXISTS
-- does not modify an existing canvases table. Existing databases therefore
-- retain any legacy NULL project_id rows; the service rejects NULL on create
-- and the authorization routes hide those legacy rows.
CREATE TABLE IF NOT EXISTS canvases (
    canvas_id     TEXT PRIMARY KEY,
    project_id    TEXT NOT NULL REFERENCES projects(project_id),
    name          TEXT NOT NULL,
    description   TEXT,
    created_by    TEXT NOT NULL REFERENCES users(user_id),
    created_at    DATETIME NOT NULL,
    updated_at    DATETIME NOT NULL
);

-- Canvas items (components placed on canvas)
CREATE TABLE IF NOT EXISTS canvas_items (
    item_id       TEXT PRIMARY KEY,
    canvas_id     TEXT NOT NULL REFERENCES canvases(canvas_id),
    item_type     TEXT NOT NULL,
    task_id       TEXT REFERENCES tasks(task_id),
    x             REAL NOT NULL DEFAULT 0,
    y             REAL NOT NULL DEFAULT 0,
    width         REAL NOT NULL DEFAULT 100,
    height        REAL NOT NULL DEFAULT 100,
    rotation      REAL NOT NULL DEFAULT 0,
    content       TEXT,
    style         TEXT,
    z_index       INTEGER NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL,
    updated_at    DATETIME NOT NULL
);

-- Canvas connections (lines/arrows between items)
CREATE TABLE IF NOT EXISTS canvas_connections (
    connection_id   TEXT PRIMARY KEY,
    canvas_id       TEXT NOT NULL REFERENCES canvases(canvas_id),
    from_item_id    TEXT NOT NULL REFERENCES canvas_items(item_id),
    to_item_id      TEXT NOT NULL REFERENCES canvas_items(item_id),
    connection_type TEXT NOT NULL DEFAULT 'line',
    style           TEXT,
    created_at      DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canvas_items_canvas
    ON canvas_items(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_conn_canvas
    ON canvas_connections(canvas_id);

-- Connector framework
CREATE TABLE IF NOT EXISTS "connectors" (
    connector_id    TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,
    provider        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'disconnected',
    config          TEXT,
    created_by      TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    project_id              TEXT REFERENCES projects(project_id),
    environment_id          TEXT REFERENCES environments(environment_id),
    allowed_actions         TEXT NOT NULL DEFAULT '[]',
    credential_reference_id TEXT REFERENCES credential_references(credential_reference_id)
);

CREATE TABLE IF NOT EXISTS connector_configs (
    config_id       TEXT PRIMARY KEY,
    connector_id    TEXT NOT NULL REFERENCES connectors(connector_id),
    key             TEXT NOT NULL,
    value           TEXT,
    is_secret       INTEGER NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(connector_id, key)
);

CREATE INDEX IF NOT EXISTS idx_connectors_provider
    ON connectors(provider);
CREATE INDEX IF NOT EXISTS idx_connectors_status
    ON connectors(status);
CREATE INDEX IF NOT EXISTS idx_connector_configs_connector
    ON connector_configs(connector_id);

-- UI Layout (Canvas-style designer)
CREATE TABLE IF NOT EXISTS ui_layouts (
    layout_id   TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    page        TEXT NOT NULL,
    elements    TEXT NOT NULL DEFAULT '[]',
    is_locked   INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, page)
);

CREATE INDEX IF NOT EXISTS idx_ui_layouts_user
    ON ui_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_ui_layouts_page
    ON ui_layouts(page);

-- Explicit migration ledger. It must exist before Automation domain tables.
CREATE TABLE IF NOT EXISTS schema_migrations (
    version        INTEGER PRIMARY KEY,
    name           TEXT NOT NULL,
    applied_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    checksum       TEXT NOT NULL,
    duration_ms    INTEGER NOT NULL,
    applied_by     TEXT
);

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

CREATE TABLE IF NOT EXISTS "executions" (
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
    preview              INTEGER NOT NULL DEFAULT 1 CHECK (preview IN (0, 1)),
    replayed_from        TEXT REFERENCES executions(execution_id)
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

-- PM-P7-02 preview-only event ingestion and outbox records.
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


-- PM-P7-03 append-only audit enforcement.
CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_update
BEFORE UPDATE ON audit_logs
BEGIN
    SELECT RAISE(ABORT, 'audit_logs is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_delete
BEFORE DELETE ON audit_logs
BEGIN
    SELECT RAISE(ABORT, 'audit_logs is append-only');
END;
