-- PM-P7-03: connector scoping, credential references and append-only audit.
-- Rebuilds connectors and audit_logs so the migration path produces exactly
-- the same schema text as schema.sql. Idempotent column copies preserve rows.
CREATE TABLE connectors_new (
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

INSERT INTO connectors_new (
    connector_id, name, type, provider, status, config, created_by,
    created_at, updated_at, project_id, environment_id, allowed_actions,
    credential_reference_id
)
SELECT
    connector_id, name, type, provider, status, config, created_by,
    created_at, updated_at, NULL, NULL, '[]', NULL
FROM connectors;

DROP TABLE connectors;
ALTER TABLE connectors_new RENAME TO connectors;

CREATE INDEX IF NOT EXISTS idx_connectors_provider
    ON connectors(provider);
CREATE INDEX IF NOT EXISTS idx_connectors_status
    ON connectors(status);

CREATE TABLE audit_logs_new (
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

INSERT INTO audit_logs_new (
    log_id, user_id, agent_id, action, target_table, target_id, old_value,
    new_value, trigger, reasoning_summary, ip_address, created_at,
    actor_type, actor_id, project_id, request_id, trace_id, target_sub_id,
    outcome
)
SELECT
    log_id, user_id, agent_id, action, target_table, target_id, old_value,
    new_value, trigger, reasoning_summary, ip_address, created_at,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM audit_logs;

DROP TABLE audit_logs;
ALTER TABLE audit_logs_new RENAME TO audit_logs;

CREATE INDEX IF NOT EXISTS idx_audit_user             ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_target           ON audit_logs(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at       ON audit_logs(created_at);

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
