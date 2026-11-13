-- PM-P7-01 — Baseline adoption migration.
-- This is the current baseline schema expressed idempotently.
-- Existing databases should already contain these objects; this migration
-- adopts them into the migration ledger without dropping or replacing data.

CREATE TABLE IF NOT EXISTS schema_migrations (
    version        INTEGER PRIMARY KEY,
    name           TEXT NOT NULL,
    applied_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    checksum       TEXT NOT NULL,
    duration_ms    INTEGER NOT NULL,
    applied_by     TEXT
);

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
    created_at      DATETIME NOT NULL DEFAULT (datetime('now'))
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

CREATE TABLE IF NOT EXISTS audit_logs (
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
CREATE TABLE IF NOT EXISTS connectors (
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
