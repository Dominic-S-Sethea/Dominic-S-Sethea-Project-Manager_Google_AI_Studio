-- Reverse PM-P7-03: restore the PM-P7-01 connectors and audit_logs shape.
-- A backup table preserves rows while the live table is recreated under the
-- original (unquoted) name, so the rolled-back schema matches 0000_baseline.
CREATE TABLE connectors_backup (
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

INSERT INTO connectors_backup (
    connector_id, name, type, provider, status, config, created_by,
    created_at, updated_at, project_id, environment_id, allowed_actions,
    credential_reference_id
)
SELECT
    connector_id, name, type, provider, status, config, created_by,
    created_at, updated_at, project_id, environment_id, allowed_actions,
    credential_reference_id
FROM connectors;

DROP TABLE connectors;

CREATE TABLE connectors (
    connector_id    TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,
    provider        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'disconnected',
    config          TEXT,
    created_by      TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO connectors (
    connector_id, name, type, provider, status, config, created_by,
    created_at, updated_at
)
SELECT
    connector_id, name, type, provider, status, config, created_by,
    created_at, updated_at
FROM connectors_backup;

DROP TABLE connectors_backup;

CREATE INDEX IF NOT EXISTS idx_connectors_provider
    ON connectors(provider);
CREATE INDEX IF NOT EXISTS idx_connectors_status
    ON connectors(status);

CREATE TABLE audit_logs_backup (
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

INSERT INTO audit_logs_backup (
    log_id, user_id, agent_id, action, target_table, target_id, old_value,
    new_value, trigger, reasoning_summary, ip_address, created_at,
    actor_type, actor_id, project_id, request_id, trace_id, target_sub_id,
    outcome
)
SELECT
    log_id, user_id, agent_id, action, target_table, target_id, old_value,
    new_value, trigger, reasoning_summary, ip_address, created_at,
    actor_type, actor_id, project_id, request_id, trace_id, target_sub_id,
    outcome
FROM audit_logs;

DROP TABLE audit_logs;

CREATE TABLE audit_logs (
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
    created_at     DATETIME NOT NULL
);

INSERT INTO audit_logs (
    log_id, user_id, agent_id, action, target_table, target_id, old_value,
    new_value, trigger, reasoning_summary, ip_address, created_at
)
SELECT
    log_id, user_id, agent_id, action, target_table, target_id, old_value,
    new_value, trigger, reasoning_summary, ip_address, created_at
FROM audit_logs_backup;

DROP TABLE audit_logs_backup;

CREATE INDEX IF NOT EXISTS idx_audit_user             ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_target           ON audit_logs(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at       ON audit_logs(created_at);
