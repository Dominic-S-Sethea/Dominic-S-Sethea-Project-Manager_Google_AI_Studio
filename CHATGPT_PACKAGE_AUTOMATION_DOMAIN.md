# ChatGPT Code-Generation Prompt — Automation Domain Model & Explicit Migrations (Detailed)

**Paste this entire document into ChatGPT regular chat.**
**Do NOT shorten it. Do NOT ask clarifying questions. Return complete replacement files.**

---

## 0. Your role and output contract

You are generating a production backend patch for an existing TypeScript / Express / SQLite (`node:sqlite`) application.

- Return **complete replacement files** for every file listed in §7.
- Do **not** return snippets, diffs, or "here is the changed part".
- Do **not** change any file that is not listed in §7.
- Do **not** add dependencies.
- Do **not** run git, commits, or pushes.
- Do **not** invent APIs, tables, columns, or environment variables.
- If something in this prompt is ambiguous, choose the **most conservative** interpretation that preserves existing behaviour and state it in your final notes.

Your output must be a single response with:

1. A short summary of the approach.
2. Complete file contents, each in its own fenced code block with a header line like `FILE: backend/src/database/schema.sql`.
3. A final "Verification checklist" section.

---

## 1. Project context

**Application:** Project Manager
**Repository root:** `<workspace>`
**Stack:**

- Frontend: React 19 + TypeScript + Vite + Tailwind
- Backend: Express 4 + TypeScript (`module: NodeNext`, `moduleResolution: NodeNext`, `allowImportingTsExtensions: true`)
- Database: SQLite via `node:sqlite` (`DatabaseSync`), WAL mode, `PRAGMA foreign_keys = ON`
- Tests: `node --test` with `node:test` + `supertest`
- Typecheck gate: `npm run typecheck --prefix backend` -> `tsc -p tsconfig.typecheck.json --noEmit`

The authoritative current source files are embedded in **Part C** at the end of this document. They are the live tree; trust them over any assumption.

---

## 2. Binding constraints (read first — these override convenience)

1. **Runtime boundary AD-01 is preview-only.** This patch adds a *data model and a migration ledger only*. It must not register API routes, start workers, schedule jobs, call connectors, or perform any external side effect.
2. **No implied runtime.** Do not add anything that makes Automation Studio look executable. **`frontend/` must not be touched at all.**
3. **Canvas separation.** No Canvas table (`canvases`, `canvas_items`, `canvas_connections`) may gain a column, trigger, or index. A Canvas connection is a visual relationship and is **not** a workflow edge.
4. **Additive only.** Existing tables, columns, indexes, triggers, backfills, and data must be preserved. No renames, no type changes, no drops outside the explicit down-migration file in §4.3.
5. **No secrets.** No credential value may appear in any schema comment, default, or generated code. `credential_references.reference` is a pointer to a secret store, never the secret itself.
6. **Existing behaviour preserved.** `getDb()` in `backend/src/database/index.ts` must keep working exactly as before and must keep applying `schema.sql`.

---

## 3. Approved data contract (acceptance reference)

Source of truth: `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md` §4 (approved contract). The DDL you generate MUST implement exactly these tables and columns. Do not add columns that are not listed. Do not omit any. Use `TEXT` for ids/timestamps/enums, `INTEGER` for flags/counts, `REAL` for coordinates, matching the existing `schema.sql` style (`CREATE TABLE IF NOT EXISTS`, named `REFERENCES`, `CREATE INDEX IF NOT EXISTS`).

### 3.1 `workflows`

| Column | Type | Constraints |
|---|---|---|
| `workflow_id` | TEXT | PRIMARY KEY |
| `project_id` | TEXT | NOT NULL REFERENCES `projects(project_id)` |
| `name` | TEXT | NOT NULL, 1-120 chars |
| `description` | TEXT | NULL, <=2000 chars |
| `status` | TEXT | NOT NULL DEFAULT `'draft'`, CHECK IN (`draft`,`test`,`published`,`paused`,`archived`) |
| `current_version_id` | TEXT | NULL REFERENCES `workflow_versions(version_id)` |
| `created_by` | TEXT | NOT NULL REFERENCES `users(user_id)` |
| `created_by_agent_id` | TEXT | NULL REFERENCES `agents(agent_id)` |
| `created_at` | TEXT | NOT NULL |
| `updated_at` | TEXT | NOT NULL |
| — | — | UNIQUE(`project_id`, `name`) |

### 3.2 `workflow_versions`

| Column | Type | Constraints |
|---|---|---|
| `version_id` | TEXT | PRIMARY KEY |
| `workflow_id` | TEXT | NOT NULL REFERENCES `workflows(workflow_id)` ON DELETE CASCADE |
| `version_number` | INTEGER | NOT NULL, >=1 |
| `definition_json` | TEXT | NOT NULL |
| `definition_hash` | TEXT | NOT NULL |
| `schema_version` | INTEGER | NOT NULL |
| `is_reviewed` | INTEGER | NOT NULL DEFAULT 0 |
| `review_note` | TEXT | NULL |
| `created_by` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL |
| `published_at` | TEXT | NULL |
| — | — | UNIQUE(`workflow_id`, `version_number`) |

### 3.3 `workflow_nodes`

| Column | Type | Constraints |
|---|---|---|
| `node_id` | TEXT | PRIMARY KEY |
| `version_id` | TEXT | NOT NULL REFERENCES `workflow_versions(version_id)` ON DELETE CASCADE |
| `node_type` | TEXT | NOT NULL, CHECK IN (`trigger`,`transform`,`decision`,`action`,`human_gate`,`error_handler`) |
| `name` | TEXT | NOT NULL, 1-120 chars |
| `config_json` | TEXT | NOT NULL |
| `credential_reference_id` | TEXT | NULL REFERENCES `credential_references(credential_reference_id)` |
| `position_x` | REAL | NOT NULL DEFAULT 0 |
| `position_y` | REAL | NOT NULL DEFAULT 0 |
| `created_at` | TEXT | NOT NULL |

### 3.4 `workflow_edges`

| Column | Type | Constraints |
|---|---|---|
| `edge_id` | TEXT | PRIMARY KEY |
| `version_id` | TEXT | NOT NULL REFERENCES `workflow_versions(version_id)` ON DELETE CASCADE |
| `from_node_id` | TEXT | NOT NULL REFERENCES `workflow_nodes(node_id)` |
| `to_node_id` | TEXT | NOT NULL REFERENCES `workflow_nodes(node_id)` |
| `branch_label` | TEXT | NULL |
| `condition_expr` | TEXT | NULL |

### 3.5 `environments`

| Column | Type | Constraints |
|---|---|---|
| `environment_id` | TEXT | PRIMARY KEY |
| `project_id` | TEXT | NOT NULL REFERENCES `projects(project_id)` |
| `name` | TEXT | NOT NULL |
| `mode` | TEXT | NOT NULL, CHECK IN (`preview`,`test`,`live`) |
| `is_live` | INTEGER | NOT NULL DEFAULT 0 |
| `created_by` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL |
| — | — | UNIQUE(`project_id`, `name`) |
| — | — | partial unique index: at most one `is_live = 1` row per `project_id` |

### 3.6 `executions`

| Column | Type | Constraints |
|---|---|---|
| `execution_id` | TEXT | PRIMARY KEY |
| `workflow_id` | TEXT | NOT NULL REFERENCES `workflows(workflow_id)` |
| `version_id` | TEXT | NOT NULL REFERENCES `workflow_versions(version_id)` |
| `environment_id` | TEXT | NOT NULL REFERENCES `environments(environment_id)` |
| `status` | TEXT | NOT NULL, CHECK IN (`pending`,`running`,`awaiting_approval`,`succeeded`,`failed`,`cancelled`,`timed_out`) |
| `trigger_type` | TEXT | NOT NULL, CHECK IN (`event`,`manual`,`schedule`,`retry`,`replay`) |
| `trigger_actor_type` | TEXT | NOT NULL, CHECK IN (`user`,`agent`,`system`,`automation`) |
| `trigger_actor_id` | TEXT | NULL |
| `idempotency_key` | TEXT | NOT NULL UNIQUE |
| `trace_id` | TEXT | NOT NULL |
| `approval_id` | TEXT | NULL REFERENCES `approvals(approval_id)` |
| `attempt_count` | INTEGER | NOT NULL DEFAULT 0 |
| `error_class` | TEXT | NULL, CHECK IN (`retryable`,`permanent`) |
| `error_message` | TEXT | NULL |
| `started_at` | TEXT | NULL |
| `completed_at` | TEXT | NULL |
| `cancel_requested_by` | TEXT | NULL |
| `cancel_requested_at` | TEXT | NULL |
| `cancel_reason` | TEXT | NULL |
| `cancelled_at` | TEXT | NULL |
| `created_at` | TEXT | NOT NULL |

### 3.7 `execution_steps`

| Column | Type | Constraints |
|---|---|---|
| `step_id` | TEXT | PRIMARY KEY |
| `execution_id` | TEXT | NOT NULL REFERENCES `executions(execution_id)` ON DELETE CASCADE |
| `node_id` | TEXT | NOT NULL REFERENCES `workflow_nodes(node_id)` |
| `node_type` | TEXT | NOT NULL |
| `attempt` | INTEGER | NOT NULL DEFAULT 1 |
| `status` | TEXT | NOT NULL, CHECK IN (`pending`,`running`,`succeeded`,`failed`,`skipped`,`cancelled`) |
| `input_json` | TEXT | NULL |
| `output_json` | TEXT | NULL |
| `credential_reference_id` | TEXT | NULL |
| `idempotency_key` | TEXT | NOT NULL |
| `started_at` | TEXT | NULL |
| `ended_at` | TEXT | NULL |
| `duration_ms` | INTEGER | NULL |
| `error_class` | TEXT | NULL |
| `error_message` | TEXT | NULL |
| `created_at` | TEXT | NOT NULL |

### 3.8 `approvals`

| Column | Type | Constraints |
|---|---|---|
| `approval_id` | TEXT | PRIMARY KEY |
| `execution_id` | TEXT | NULL REFERENCES `executions(execution_id)` |
| `step_id` | TEXT | NULL REFERENCES `execution_steps(step_id)` |
| `workflow_id` | TEXT | NOT NULL REFERENCES `workflows(workflow_id)` |
| `version_id` | TEXT | NULL |
| `approval_type` | TEXT | NOT NULL, CHECK IN (`publish`,`execute`,`connector_action`,`replay_side_effect`) |
| `status` | TEXT | NOT NULL, CHECK IN (`pending`,`granted`,`rejected`,`expired`,`cancelled`) |
| `requested_by_type` | TEXT | NOT NULL, CHECK IN (`user`,`agent`,`automation`) |
| `requested_by_id` | TEXT | NOT NULL |
| `requested_at` | TEXT | NOT NULL |
| `reviewer_id` | TEXT | NULL REFERENCES `users(user_id)` |
| `decided_at` | TEXT | NULL |
| `decision_note` | TEXT | NULL |
| `expires_at` | TEXT | NOT NULL |
| `idempotency_key` | TEXT | NOT NULL UNIQUE |
| `created_at` | TEXT | NOT NULL |

### 3.9 `credential_references`

| Column | Type | Constraints |
|---|---|---|
| `credential_reference_id` | TEXT | PRIMARY KEY |
| `project_id` | TEXT | NOT NULL REFERENCES `projects(project_id)` |
| `connector_id` | TEXT | NULL REFERENCES `connectors(connector_id)` |
| `environment_id` | TEXT | NULL REFERENCES `environments(environment_id)` |
| `reference` | TEXT | NOT NULL |
| `provider_scopes` | TEXT | NOT NULL DEFAULT `'[]'` |
| `created_by` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL |
| `rotated_at` | TEXT | NULL |
| `expires_at` | TEXT | NULL |
| `revoked_at` | TEXT | NULL |
| `last_verified_at` | TEXT | NULL |

### 3.10 `idempotency_keys`

| Column | Type | Constraints |
|---|---|---|
| `key` | TEXT | PRIMARY KEY |
| `request_hash` | TEXT | NOT NULL |
| `response_snapshot` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL |
| `expires_at` | TEXT | NOT NULL |

### 3.11 State machines and notes

- Enforce the §3 CHECK constraints above. Do **not** add triggers that enforce transitions.
- **Circular foreign keys exist by design** and both sides are nullable: `workflows.current_version_id` <-> `workflow_versions.workflow_id`, and `executions.approval_id` <-> `approvals.execution_id`. Ensure the DDL and any insert order remain valid (insert with NULL, then update).
- Create these indexes (and no others):
  - `idx_workflows_project` ON `workflows(project_id)`
  - `idx_workflows_status` ON `workflows(status)`
  - `idx_workflow_versions_workflow` ON `workflow_versions(workflow_id)`
  - `idx_workflow_nodes_version` ON `workflow_nodes(version_id)`
  - `idx_workflow_edges_version` ON `workflow_edges(version_id)`
  - `idx_workflow_edges_from` ON `workflow_edges(from_node_id)`
  - `idx_environments_project` ON `environments(project_id)`
  - `idx_executions_workflow` ON `executions(workflow_id)`
  - `idx_executions_status` ON `executions(status)`
  - `idx_execution_steps_execution` ON `execution_steps(execution_id)`
  - `idx_approvals_workflow` ON `approvals(workflow_id)`
  - `idx_approvals_status` ON `approvals(status)`
  - `idx_credential_references_project` ON `credential_references(project_id)`
  - `idx_idempotency_keys_expires_at` ON `idempotency_keys(expires_at)`
  - partial unique index for the one-live-environment rule in §3.5.

---

## 4. Migration policy

Derived from `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md` §3 and `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md` §10. Follow it exactly.

### 4.1 Ledger first

`schema_migrations` must exist before any Automation table:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version        INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  applied_at     DATETIME NOT NULL DEFAULT (datetime('now')),
  checksum       TEXT NOT NULL,
  duration_ms    INTEGER NOT NULL,
  applied_by     TEXT
);
```

### 4.2 Baseline adoption — `0000_baseline.sql`

- Contains the complete **current** baseline schema (all existing tables, their indexes, the owner-membership backfill, and the owner-membership trigger) expressed idempotently with `IF NOT EXISTS`, plus `schema_migrations`.
- On an existing database it must be a no-op apart from creating `schema_migrations`; the runner then records version 0.
- Do not add, remove, or alter any baseline object relative to the live `schema.sql`.

### 4.3 Automation domain — `0001_automation_domain.sql` + `0001_automation_domain.down.sql`

- The up file creates the ten §3 tables and their indexes. Every statement must be idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE [UNIQUE] INDEX IF NOT EXISTS`).
- The down file drops the ten Automation tables in reverse dependency order with `DROP TABLE IF EXISTS`. It is **development-only** and must not be wired into deployment.
- `0000_baseline.sql` has no down file: it is adopt-only, and its documented rollback is restore-from-backup.

### 4.4 Runner contract — replace `backend/src/database/migrate.ts`

The current file is a no-op. Replace it with a real runner that:

1. Resolves the database path from `DB_PATH` or the same default as `index.ts` (`backend/data/app.db`).
2. Opens the database with `PRAGMA journal_mode = WAL;` and `PRAGMA foreign_keys = ON;`.
3. Creates `schema_migrations` if absent.
4. Discovers `backend/src/database/migrations/*.sql`, matching `^(\d{4})_.*\.sql$`, **excluding** `*.down.sql`, sorted by numeric version ascending.
5. Computes SHA-256 (lowercase hex) of each file's bytes.
6. **Drift guard:** for every applied ledger row, recompute the checksum of the matching file; if the file is missing or the checksum differs, print a clear error and exit non-zero without applying anything.
7. Applies each pending version in a **single transaction**, records `(version, name, applied_at, checksum, duration_ms, applied_by)`, and logs a structured line per version.
8. Runs `PRAGMA foreign_key_check` after each applied version; on any row returned, rolls back and exits non-zero.
9. **Parity guard:** extracts table names from `schema.sql` and from the migration files; if a migration creates a table that `schema.sql` does not contain, refuse to run (name-level check).
10. Supports `--dry-run` (print pending versions, apply nothing), `--version` (print current and latest), and `--down --to <version>` (development-only rollback).
11. Is idempotent: a second run with no pending versions prints that nothing is pending and exits 0.
12. Does **not** apply `schema.sql`; `index.ts` already does that on first connection. All DDL must therefore be `IF NOT EXISTS` so a database that already received the latest schema through `index.ts` can still be recorded safely.
13. Exports a testable function (for example `runMigrations(options)`) and only runs the CLI when executed directly (`import.meta.url` check). Do not run migrations on import.
14. Never auto-runs on container start; migrations are explicit only.

### 4.5 Fresh-install parity — `schema.sql`

- `schema.sql` must remain the fresh-install source of truth: current content **plus** `schema_migrations` **plus** the ten Automation tables and their indexes.
- A database created by applying `0000_baseline.sql` then `0001_automation_domain.sql` must be indistinguishable (table set, columns, indexes) from one created by `index.ts` executing `schema.sql`.

---

## 5. Current state (verified evidence)

| Fact | Evidence |
|---|---|
| No migration ledger | `backend/src/database/migrations/` is empty |
| Runner is a no-op | `backend/src/database/migrate.ts` is 10 lines, calls `getDb()` only |
| Schema applied on first connection | `backend/src/database/index.ts:15-18` — WAL, foreign keys, `db.exec(schemaSql)` |
| Baseline schema | `backend/src/database/schema.sql`, 20 tables, no Automation tables, no `schema_migrations` |
| `package.json` scripts | `db:migrate` -> `tsx src/database/migrate.ts`; `db:seed`/`db:reset` reference missing files |
| Typecheck gate | `tsc -p tsconfig.typecheck.json --noEmit` |

---

## 6. Required work items

- **W1** — `0000_baseline.sql`: idempotent baseline schema + `schema_migrations`.
- **W2** — `0001_automation_domain.sql`: the ten §3 tables + §3.11 indexes.
- **W3** — `0001_automation_domain.down.sql`: reverse of W2, development-only.
- **W4** — `migrate.ts`: the §4.4 runner (CLI + exported testable function).
- **W5** — `schema.sql`: append `schema_migrations` + Automation tables/indexes for fresh-install parity; change nothing else.
- **W6** — `backend/src/types/automation.ts`: TypeScript contracts (interfaces + string-literal union types + state-machine types) mirroring §3 exactly. No runtime code, no imports of application modules.
- **W7** — `backend/src/tests/automation.migration.test.ts`: the §9 migration tests.
- **W8** — Final response includes the verification checklist with honest pass/fail statements.

---

## 7. Files to return

Return exactly these seven files, each as a complete replacement:

1. `backend/src/database/migrations/0000_baseline.sql`
2. `backend/src/database/migrations/0001_automation_domain.sql`
3. `backend/src/database/migrations/0001_automation_domain.down.sql`
4. `backend/src/database/migrate.ts`
5. `backend/src/database/schema.sql`
6. `backend/src/types/automation.ts`
7. `backend/src/tests/automation.migration.test.ts`

Do not return any other file. Do not modify `frontend/`.

---

## 8. Out of scope (do not implement)

- No API routes, controllers, services, validators, workers, schedulers, queues, outbox, or event ingestion.
- No approval workflow logic, no redaction logic, no permission enforcement.
- No execution engine, no connector calls, no replay logic.
- No changes to `canvases`, `canvas_items`, `canvas_connections`, or any other existing table.
- No CI/Docker wiring changes (flagged as a follow-up).
- No fix for the missing `db:seed` / `db:reset` scripts.
- No backfill of Automation rows.
- No frontend change of any kind.

---

## 9. Verification checklist (report honestly)

The returned package must satisfy:

1. `npm run typecheck --prefix backend` exits 0.
2. `npm run test --prefix backend` passes (existing suites plus the new migration suite).
3. `npm run build --prefix backend` exits 0.
4. Fresh install: creating a database through `index.ts` yields every §3 table.
5. Migration on a representative existing database: applying `0000` then `0001` succeeds; `PRAGMA foreign_key_check` returns no rows; pre-existing row counts are unchanged.
6. Re-running the runner reports no pending versions and exits 0.
7. Tampering with an applied migration file makes the runner refuse to start (non-zero exit).
8. `0001_automation_domain.down.sql` removes the Automation tables and leaves the baseline intact.
9. Table set produced by the migrations equals the table set in `schema.sql`.
10. No `frontend/` file changed.

---

---

## Part C — current source files (authoritative live tree)

### SOURCE FILE: `backend/src/database/schema.sql`

```sql
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
```

### SOURCE FILE: `backend/src/database/migrate.ts`

```typescript
import { getDb } from "./index.ts";

// Run schema initialization
getDb();

console.log("Database initialized successfully.");
process.on("SIGINT", () => {
  getDb().close();
  process.exit(0);
});
```

### SOURCE FILE: `backend/src/database/index.ts`

```typescript
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let db: InstanceType<typeof DatabaseSync> | null = null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the committed source schema from both src/database and dist/database.
// This intentionally avoids reading a stale schema copy beside compiled output.
const schemaPath = fileURLToPath(
  new URL("../../src/database/schema.sql", import.meta.url),
);
const schemaSql = readFileSync(schemaPath, "utf-8");

function applyCompatibilityMigrations(database: InstanceType<typeof DatabaseSync>): void {
  const agentColumns = database
    .prepare("PRAGMA table_info(agents)")
    .all() as Array<{ name: string }>;

  if (!agentColumns.some((column) => column.name === "expires_at")) {
    // SQLite's CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
    // A nullable column keeps legacy agent records valid; new registrations always set it.
    database.exec("ALTER TABLE agents ADD COLUMN expires_at DATETIME;");
  }

  // Keep this migration self-contained: older schema files may not define agent_tokens.
  // These statements are also safe when the current schema has already created them.
  database.exec(`
    CREATE TABLE IF NOT EXISTS agent_tokens (
      token_hash  TEXT PRIMARY KEY,
      agent_id    TEXT NOT NULL REFERENCES agents(agent_id),
      role        TEXT NOT NULL,
      expires_at  DATETIME NOT NULL,
      created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_agent_tokens_agent
      ON agent_tokens(agent_id);

    CREATE INDEX IF NOT EXISTS idx_agent_tokens_expires
      ON agent_tokens(expires_at);
  `);
}

export function getDb(): InstanceType<typeof DatabaseSync> {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "app.db");
    db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");

    // Apply the authoritative schema, then bridge databases created before expires_at
    // and agent_tokens existed.
    db.exec(schemaSql);
    applyCompatibilityMigrations(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

### SOURCE FILE: `backend/package.json`

```json
{
  "name": "project-manager-backend",
  "version": "1.0.0",
  "description": "Project Manager backend API (Express + TypeScript)",
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "db:migrate": "tsx src/database/migrate.ts",
    "db:seed": "tsx src/database/seed.ts",
    "db:reset": "tsx src/database/reset.ts",
    "typecheck": "tsc -p tsconfig.typecheck.json --noEmit",
    "test": "node --test src/tests/",
    "dev:full": "tsx src/server.ts"
  },
  "license": "MIT",
  "dependencies": {
    "bcryptjs": "^3.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.21.2",
    "express-rate-limit": "^7.5.0",
    "helmet": "^8.1.0",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.3",
    "@types/express-rate-limit": "^6.0.2",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^24.0.0",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^5.2.0",
    "autoprefixer": "^10.6.2",
    "jest": "^30.5.2",
    "postcss": "^8.5.32",
    "supertest": "^7.3.1",
    "tailwindcss": "^3.4.11",
    "tsx": "^4.20.0",
    "typescript": "^5.9.3",
    "vite": "^6.4.5"
  },
  "type": "module"
}
```

### SOURCE FILE: `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true,
    "types": [
      "node"
    ],
    "noUncheckedIndexedAccess": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "noImplicitOverride": true
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

### SOURCE FILE: `backend/src/services/canvas.service.ts`

```typescript
import { getDb } from "../database/index.ts";
import { randomUUID } from "node:crypto";

// --- Types ---

export interface Canvas {
  canvas_id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasItem {
  item_id: string;
  canvas_id: string;
  item_type: string;
  task_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string | null;
  style: string | null;
  z_index: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasConnection {
  connection_id: string;
  canvas_id: string;
  from_item_id: string;
  to_item_id: string;
  connection_type: string;
  style: string | null;
  created_at: string;
}

export interface CanvasWithItems extends Canvas {
  items: CanvasItem[];
  connections: CanvasConnection[];
}

type CanvasServiceStatus = 400 | 404;

export class CanvasServiceError extends Error {
  public readonly statusCode: CanvasServiceStatus;

  constructor(statusCode: CanvasServiceStatus, message: string) {
    super(message);
    this.name = "CanvasServiceError";
    this.statusCode = statusCode;
  }
}

interface CanvasDbRow {
  canvas_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CanvasItemDbRow {
  item_id: string;
  canvas_id: string;
  item_type: string;
  task_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string | null;
  style: string | null;
  z_index: number;
  created_at: string;
  updated_at: string;
}

interface CanvasConnectionDbRow {
  connection_id: string;
  canvas_id: string;
  from_item_id: string;
  to_item_id: string;
  connection_type: string;
  style: string | null;
  created_at: string;
}

interface TaskProjectRow {
  project_id: string;
}

interface CanvasItemInput {
  item_type: string;
  task_id?: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  content?: string | null;
  style?: string | null;
  z_index?: number;
}

interface CanvasItemUpdates {
  item_type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  content?: string | null;
  style?: string | null;
  z_index?: number;
  task_id?: string | null;
}

interface CanvasConnectionUpdates {
  connection_type?: string;
  style?: string | null;
}

const SUPPORTED_ITEM_TYPES = new Set([
  "square",
  "rectangle",
  "circle",
  "diamond",
  "triangle",
  "text",
  "task",
  "line",
  "arrow",
]);

// --- Validation and internal helpers ---

function badRequest(message: string): never {
  throw new CanvasServiceError(400, message);
}

function notFound(message: string): never {
  throw new CanvasServiceError(404, message);
}

function validateNonEmptyString(
  value: unknown,
  fieldName: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    badRequest(`${fieldName} is required`);
  }

  return value;
}

function validateNullableString(
  value: unknown,
  fieldName: string,
): string | null {
  if (value === null) return null;

  if (typeof value !== "string") {
    badRequest(`${fieldName} must be a string or null`);
  }

  return value;
}

function validateFiniteNumber(
  value: unknown,
  fieldName: string,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    badRequest(`${fieldName} must be a finite number`);
  }

  return value;
}

function validateItemType(itemType: unknown): string {
  if (
    typeof itemType !== "string" ||
    !SUPPORTED_ITEM_TYPES.has(itemType)
  ) {
    badRequest("Unsupported canvas item type");
  }

  return itemType;
}

function validateConnectionType(value: unknown): "line" | "arrow" {
  if (value !== "line" && value !== "arrow") {
    badRequest('connection_type must be "line" or "arrow"');
  }

  return value;
}

function validateTaskLink(
  canvas: Canvas,
  taskId: string | null | undefined,
): void {
  if (taskId === undefined || taskId === null) return;

  if (typeof taskId !== "string" || !taskId.trim()) {
    badRequest("task_id must be a non-empty string or null");
  }

  const db = getDb();
  const task = db
    .prepare("SELECT project_id FROM tasks WHERE task_id = ?")
    .get(taskId) as TaskProjectRow | undefined;

  if (!task) {
    badRequest("Task does not exist");
  }

  if (task.project_id !== canvas.project_id) {
    badRequest("Task must belong to the same project as the canvas");
  }
}

function getCanvasOrThrow(canvasId: string): Canvas {
  const canvas = getCanvasById(canvasId);

  if (!canvas) {
    notFound("Canvas not found");
  }

  return canvas;
}

function getCanvasItemOrThrow(itemId: string): CanvasItem {
  const item = getCanvasItemById(itemId);

  if (!item) {
    notFound("Canvas item not found");
  }

  return item;
}

function getCanvasConnectionOrThrow(
  connectionId: string,
): CanvasConnection {
  const connection = getCanvasConnectionById(connectionId);

  if (!connection) {
    notFound("Canvas connection not found");
  }

  return connection;
}

function assertItemBelongsToCanvas(
  itemId: string,
  canvasId: string,
): CanvasItem {
  const item = getCanvasItemOrThrow(itemId);

  if (item.canvas_id !== canvasId) {
    badRequest("Both connection items must belong to the requested canvas");
  }

  return item;
}

function assertConnectionBelongsToCanvas(
  connectionId: string,
  canvasId: string,
): CanvasConnection {
  const connection = getCanvasConnectionOrThrow(connectionId);

  if (connection.canvas_id !== canvasId) {
    badRequest("Connection does not belong to the requested canvas");
  }

  return connection;
}

// --- Canvas operations ---

export function createCanvas(
  projectId: string,
  name: string,
  description: string | null,
  createdBy: string,
): Canvas {
  validateNonEmptyString(projectId, "project_id");
  validateNonEmptyString(name, "name");
  validateNonEmptyString(createdBy, "created_by");

  const db = getDb();
  const project = db
    .prepare("SELECT project_id FROM projects WHERE project_id = ?")
    .get(projectId);

  if (!project) {
    notFound("Project not found");
  }

  const now = new Date().toISOString();
  const canvasId = randomUUID();

  db.prepare(
    `INSERT INTO canvases
      (canvas_id, project_id, name, description, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    canvasId,
    projectId,
    name,
    validateNullableString(description, "description"),
    createdBy,
    now,
    now,
  );

  return getCanvasOrThrow(canvasId);
}

export function getCanvasById(canvasId: string): Canvas | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM canvases WHERE canvas_id = ?")
    .get(canvasId) as CanvasDbRow | undefined;

  return row ? mapCanvas(row) : null;
}

export function getCanvasWithItems(
  canvasId: string,
): CanvasWithItems | null {
  const db = getDb();
  const canvas = getCanvasById(canvasId);

  if (!canvas) return null;

  const items = db
    .prepare(
      `SELECT * FROM canvas_items
       WHERE canvas_id = ?
       ORDER BY z_index ASC`,
    )
    .all(canvasId) as unknown as CanvasItemDbRow[];

  const connections = db
    .prepare(
      "SELECT * FROM canvas_connections WHERE canvas_id = ?",
    )
    .all(canvasId) as unknown as CanvasConnectionDbRow[];

  return {
    ...canvas,
    items: items.map(mapCanvasItem),
    connections: connections.map(mapCanvasConnection),
  };
}

/**
 * With a project ID, return only that project's canvases.
 *
 * A null project ID retains the old service behavior and returns all canvases.
 * The Canvas routes must filter that result by project membership and omit
 * legacy canvases whose project_id is NULL.
 */
export function listCanvases(projectId: string | null): Canvas[] {
  const db = getDb();

  const rows = projectId
    ? db
        .prepare(
          `SELECT * FROM canvases
           WHERE project_id = ?
           ORDER BY updated_at DESC`,
        )
        .all(projectId)
    : db
        .prepare(
          "SELECT * FROM canvases ORDER BY updated_at DESC",
        )
        .all();

  return (rows as unknown as CanvasDbRow[]).map(mapCanvas);
}

export function updateCanvas(
  canvasId: string,
  updates: { name?: string; description?: string | null },
): Canvas | null {
  const db = getDb();
  const existing = getCanvasById(canvasId);

  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(validateNonEmptyString(updates.name, "name"));
  }

  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(
      validateNullableString(updates.description, "description"),
    );
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(canvasId);

  db.prepare(
    `UPDATE canvases
     SET ${fields.join(", ")}
     WHERE canvas_id = ?`,
  ).run(...values);

  return getCanvasById(canvasId);
}

export function deleteCanvas(canvasId: string): boolean {
  const db = getDb();
  const existingCanvas = getCanvasById(canvasId);

  if (!existingCanvas) return false;

  // The row is deleted below, so this timestamp bump is necessarily
  // transient and cannot affect subsequent CanvasList ordering.
  db.prepare(
    "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
  ).run(new Date().toISOString(), canvasId);

  const items = db
    .prepare("SELECT item_id FROM canvas_items WHERE canvas_id = ?")
    .all(canvasId) as unknown as Array<{ item_id: string }>;

  // Preserve the existing cleanup behavior: remove every connection
  // involving a canvas item before deleting the items and canvas.
  for (const item of items) {
    db.prepare(
      `DELETE FROM canvas_connections
       WHERE from_item_id = ? OR to_item_id = ?`,
    ).run(item.item_id, item.item_id);
  }

  db.prepare(
    "DELETE FROM canvas_items WHERE canvas_id = ?",
  ).run(canvasId);

  const result = db
    .prepare("DELETE FROM canvases WHERE canvas_id = ?")
    .run(canvasId);

  return result.changes > 0;
}

// --- Items ---

export function addItem(
  canvasId: string,
  item: CanvasItemInput,
): CanvasItem {
  const canvas = getCanvasOrThrow(canvasId);
  const db = getDb();

  const itemType = validateItemType(item.item_type);
  validateTaskLink(canvas, item.task_id);

  const x =
    item.x === undefined ? 0 : validateFiniteNumber(item.x, "x");
  const y =
    item.y === undefined ? 0 : validateFiniteNumber(item.y, "y");
  const width =
    item.width === undefined
      ? 100
      : validateFiniteNumber(item.width, "width");
  const height =
    item.height === undefined
      ? 100
      : validateFiniteNumber(item.height, "height");
  const rotation =
    item.rotation === undefined
      ? 0
      : validateFiniteNumber(item.rotation, "rotation");
  const zIndex =
    item.z_index === undefined
      ? 0
      : validateFiniteNumber(item.z_index, "z_index");

  if (width <= 0 || height <= 0) {
    badRequest("Canvas item width and height must be greater than zero");
  }

  if (!Number.isInteger(zIndex)) {
    badRequest("z_index must be an integer");
  }

  const content =
    item.content === undefined
      ? null
      : validateNullableString(item.content, "content");
  const style =
    item.style === undefined
      ? null
      : validateNullableString(item.style, "style");

  const now = new Date().toISOString();
  const itemId = randomUUID();

  db.prepare(
    `INSERT INTO canvas_items
      (item_id, canvas_id, item_type, task_id, x, y, width, height,
       rotation, content, style, z_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    itemId,
    canvasId,
    itemType,
    item.task_id ?? null,
    x,
    y,
    width,
    height,
    rotation,
    content,
    style,
    zIndex,
    now,
    now,
  );

  db.prepare(
    "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
  ).run(now, canvasId);

  return getCanvasItemOrThrow(itemId);
}

export function getCanvasItemById(itemId: string): CanvasItem | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM canvas_items WHERE item_id = ?")
    .get(itemId) as CanvasItemDbRow | undefined;

  return row ? mapCanvasItem(row) : null;
}

export function updateItem(
  itemId: string,
  updates: CanvasItemUpdates,
): CanvasItem | null {
  const db = getDb();
  const existingItem = getCanvasItemById(itemId);

  if (!existingItem) return null;

  // Resolve the item's parent canvas before validating task links. The route
  // separately authorizes access against this exact parent canvas.
  const canvas = getCanvasOrThrow(existingItem.canvas_id);

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.item_type !== undefined) {
    fields.push("item_type = ?");
    values.push(validateItemType(updates.item_type));
  }

  if (updates.x !== undefined) {
    fields.push("x = ?");
    values.push(validateFiniteNumber(updates.x, "x"));
  }

  if (updates.y !== undefined) {
    fields.push("y = ?");
    values.push(validateFiniteNumber(updates.y, "y"));
  }

  if (updates.width !== undefined) {
    const width = validateFiniteNumber(updates.width, "width");
    if (width <= 0) {
      badRequest("Canvas item width must be greater than zero");
    }
    fields.push("width = ?");
    values.push(width);
  }

  if (updates.height !== undefined) {
    const height = validateFiniteNumber(updates.height, "height");
    if (height <= 0) {
      badRequest("Canvas item height must be greater than zero");
    }
    fields.push("height = ?");
    values.push(height);
  }

  if (updates.rotation !== undefined) {
    fields.push("rotation = ?");
    values.push(validateFiniteNumber(updates.rotation, "rotation"));
  }

  if (updates.content !== undefined) {
    fields.push("content = ?");
    values.push(validateNullableString(updates.content, "content"));
  }

  if (updates.style !== undefined) {
    fields.push("style = ?");
    values.push(validateNullableString(updates.style, "style"));
  }

  if (updates.z_index !== undefined) {
    const zIndex = validateFiniteNumber(updates.z_index, "z_index");

    if (!Number.isInteger(zIndex)) {
      badRequest("z_index must be an integer");
    }

    fields.push("z_index = ?");
    values.push(zIndex);
  }

  if (updates.task_id !== undefined) {
    validateTaskLink(canvas, updates.task_id);
    fields.push("task_id = ?");
    values.push(updates.task_id);
  }

  if (fields.length === 0) return existingItem;

  const now = new Date().toISOString();
  fields.push("updated_at = ?");
  values.push(now);
  values.push(itemId);

  db.prepare(
    `UPDATE canvas_items
     SET ${fields.join(", ")}
     WHERE item_id = ?`,
  ).run(...values);

  db.prepare(
    "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
  ).run(now, canvas.canvas_id);

  return getCanvasItemById(itemId);
}

export function deleteItem(itemId: string): boolean {
  const db = getDb();
  const existingItem = getCanvasItemById(itemId);

  if (!existingItem) return false;

  // Delete connections involving this item before deleting the item.
  db.prepare(
    `DELETE FROM canvas_connections
     WHERE from_item_id = ? OR to_item_id = ?`,
  ).run(itemId, itemId);

  const result = db
    .prepare("DELETE FROM canvas_items WHERE item_id = ?")
    .run(itemId);

  if (result.changes > 0) {
    db.prepare(
      "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
    ).run(new Date().toISOString(), existingItem.canvas_id);
  }

  return result.changes > 0;
}

// --- Connections ---

export function addConnection(
  canvasId: string,
  fromItemId: string,
  toItemId: string,
  connectionType = "line",
  style: string | null = null,
): CanvasConnection {
  getCanvasOrThrow(canvasId);

  validateNonEmptyString(fromItemId, "from_item_id");
  validateNonEmptyString(toItemId, "to_item_id");
  validateConnectionType(connectionType);
  validateNullableString(style, "style");

  if (fromItemId === toItemId) {
    badRequest("A canvas item cannot be connected to itself");
  }

  assertItemBelongsToCanvas(fromItemId, canvasId);
  assertItemBelongsToCanvas(toItemId, canvasId);

  const db = getDb();
  const duplicate = db
    .prepare(
      `SELECT connection_id
       FROM canvas_connections
       WHERE canvas_id = ?
         AND from_item_id = ?
         AND to_item_id = ?
       LIMIT 1`,
    )
    .get(canvasId, fromItemId, toItemId);

  if (duplicate) {
    badRequest("A connection already exists between these items");
  }

  const now = new Date().toISOString();
  const connectionId = randomUUID();

  db.prepare(
    `INSERT INTO canvas_connections
      (connection_id, canvas_id, from_item_id, to_item_id,
       connection_type, style, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    connectionId,
    canvasId,
    fromItemId,
    toItemId,
    connectionType,
    style,
    now,
  );

  db.prepare(
    "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
  ).run(now, canvasId);

  return getCanvasConnectionOrThrow(connectionId);
}

export function getCanvasConnectionById(
  connId: string,
): CanvasConnection | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM canvas_connections WHERE connection_id = ?",
    )
    .get(connId) as CanvasConnectionDbRow | undefined;

  return row ? mapCanvasConnection(row) : null;
}

export function updateConnection(
  connId: string,
  updates: CanvasConnectionUpdates,
): CanvasConnection | null {
  const existing = getCanvasConnectionById(connId);

  if (!existing) return null;

  assertConnectionBelongsToCanvas(connId, existing.canvas_id);

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.connection_type !== undefined) {
    fields.push("connection_type = ?");
    values.push(validateConnectionType(updates.connection_type));
  }

  if (updates.style !== undefined) {
    fields.push("style = ?");
    values.push(validateNullableString(updates.style, "style"));
  }

  if (fields.length === 0) {
    return existing;
  }

  const now = new Date().toISOString();
  values.push(connId);

  getDb()
    .prepare(
      `UPDATE canvas_connections
       SET ${fields.join(", ")}
       WHERE connection_id = ?`,
    )
    .run(...values);

  getDb()
    .prepare(
      "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
    )
    .run(now, existing.canvas_id);

  return getCanvasConnectionOrThrow(connId);
}

export function deleteConnection(connId: string): boolean {
  const existing = getCanvasConnectionById(connId);

  if (!existing) return false;

  // Keep the connection ownership assertion in the deletion path so this
  // helper remains the single place where connection-to-canvas scope is
  // checked inside the service.
  assertConnectionBelongsToCanvas(connId, existing.canvas_id);

  const db = getDb();
  const result = db
    .prepare(
      "DELETE FROM canvas_connections WHERE connection_id = ?",
    )
    .run(connId);

  if (result.changes > 0) {
    db.prepare(
      "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
    ).run(new Date().toISOString(), existing.canvas_id);
  }

  return result.changes > 0;
}

// --- Mappers ---

function mapCanvas(row: CanvasDbRow): Canvas {
  return {
    canvas_id: row.canvas_id,

    // Existing databases may still contain legacy NULL project_id rows.
    // An empty string keeps the new TypeScript contract non-nullable; routes
    // treat an empty project_id as unscoped and return 404 for those records.
    project_id: row.project_id ?? "",

    name: row.name,
    description: row.description,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCanvasItem(row: CanvasItemDbRow): CanvasItem {
  return {
    item_id: row.item_id,
    canvas_id: row.canvas_id,
    item_type: row.item_type,
    task_id: row.task_id,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    content: row.content,
    style: row.style,
    z_index: row.z_index,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCanvasConnection(
  row: CanvasConnectionDbRow,
): CanvasConnection {
  return {
    connection_id: row.connection_id,
    canvas_id: row.canvas_id,
    from_item_id: row.from_item_id,
    to_item_id: row.to_item_id,
    connection_type: row.connection_type,
    style: row.style,
    created_at: row.created_at,
  };
}
```

### SOURCE FILE: `backend/src/services/projectAccess.service.ts`

```typescript
import { getDb } from "../database/index.ts";

export type ProjectRole =
  | "owner"
  | "editor"
  | "viewer"
  | "commenter"
  | "agent";

export interface ProjectAccess {
  role: ProjectRole;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

interface ProjectCreatorRow {
  created_by: string;
}

interface ProjectMemberRow {
  role: string;
}

const PROJECT_ROLES = new Set<ProjectRole>([
  "owner",
  "editor",
  "viewer",
  "commenter",
  "agent",
]);

function isProjectRole(role: string): role is ProjectRole {
  return PROJECT_ROLES.has(role as ProjectRole);
}

function accessForRole(role: ProjectRole): ProjectAccess {
  const canManage = role === "owner" || role === "editor";

  return {
    role,
    canRead: true,
    canWrite: canManage,
    canDelete: canManage,
  };
}

/**
 * Check whether a project exists.
 *
 * Kept separate from getProjectAccess so routes that accept a project ID
 * can distinguish a missing project (404) from an existing project on which
 * the caller lacks write access (403).
 */
export function projectExists(projectId: string): boolean {
  if (!projectId.trim()) return false;

  const db = getDb();
  const row = db
    .prepare("SELECT project_id FROM projects WHERE project_id = ?")
    .get(projectId);

  return row !== undefined;
}

/**
 * Resolve the caller's access to a project.
 *
 * Project creators are always owners, even if their membership row is absent
 * or contains a different role. Otherwise, access is determined exclusively
 * by project_members; users.role is deliberately not consulted.
 */
export async function getProjectAccess(
  projectId: string,
  userId: string,
): Promise<ProjectAccess | null> {
  if (!projectId.trim() || !userId.trim()) return null;

  const db = getDb();

  const project = db
    .prepare(
      "SELECT created_by FROM projects WHERE project_id = ?",
    )
    .get(projectId) as ProjectCreatorRow | undefined;

  if (!project) return null;

  if (project.created_by === userId) {
    return accessForRole("owner");
  }

  const membership = db
    .prepare(
      `SELECT role
       FROM project_members
       WHERE project_id = ? AND user_id = ?`,
    )
    .get(projectId, userId) as ProjectMemberRow | undefined;

  if (!membership || !isProjectRole(membership.role)) {
    return null;
  }

  return accessForRole(membership.role);
}
```

### SOURCE FILE: `backend/src/routes/canvas.routes.ts`

```typescript
import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import type { AuthRequest } from "../middleware/auth.middleware.ts";
import * as canvasService from "../services/canvas.service.ts";
import { CanvasServiceError } from "../services/canvas.service.ts";
import {
  getProjectAccess,
  projectExists,
} from "../services/projectAccess.service.ts";

const router = Router();

type CanvasPermission = "read" | "write" | "delete";

// All Canvas routes require authentication.
router.use(requireAuth);

function getBody(req: AuthRequest): Record<string, unknown> {
  const body: unknown = req.body;

  if (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body)
  ) {
    return body as Record<string, unknown>;
  }

  return {};
}

function getUserId(
  req: AuthRequest,
  res: Response,
): string | null {
  const userId = req.user?.user_id;

  if (!userId) {
    res.status(401).json({ error: "Missing or invalid token" });
    return null;
  }

  return userId;
}

function sendCanvasError(res: Response, error: unknown): void {
  if (error instanceof CanvasServiceError) {
    res
      .status(error.statusCode)
      .json({ error: error.message });
    return;
  }

  // Do not expose SQL errors, stack traces, or unexpected internal details.
  console.error("Canvas route error:", error);
  res.status(500).json({ error: "Internal server error" });
}

/**
 * Load a canvas and authorize the caller against its project.
 *
 * If the canvas is missing, has no project, or the caller cannot read its
 * project, return 404. This deliberately avoids disclosing the existence
 * of resources outside the caller's accessible projects.
 *
 * A caller who can read the project but lacks the requested write/delete
 * permission receives 403.
 */
async function requireCanvasAccess(
  canvasId: string,
  userId: string,
  permission: CanvasPermission,
  res: Response,
): Promise<canvasService.Canvas | null> {
  const canvas = canvasService.getCanvasById(canvasId);

  if (!canvas || !canvas.project_id) {
    res.status(404).json({ error: "Canvas not found" });
    return null;
  }

  const access = await getProjectAccess(canvas.project_id, userId);

  if (!access || !access.canRead) {
    res.status(404).json({ error: "Canvas not found" });
    return null;
  }

  if (permission === "write" && !access.canWrite) {
    res.status(403).json({ error: "Insufficient permissions" });
    return null;
  }

  if (permission === "delete" && !access.canDelete) {
    res.status(403).json({ error: "Insufficient permissions" });
    return null;
  }

  return canvas;
}

// Create canvas.
router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const body = getBody(req as AuthRequest);
    const projectId = body.project_id;
    const name = body.name;
    const description = body.description;

    if (typeof projectId !== "string" || !projectId.trim()) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      res.status(400).json({
        error: "description must be a string or null",
      });
      return;
    }

    if (!projectExists(projectId)) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const access = await getProjectAccess(projectId, userId);

    if (!access || !access.canWrite) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const canvas = canvasService.createCanvas(
      projectId,
      name,
      description ?? null,
      userId,
    );

    res.status(201).json({ canvas });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// List canvases.
router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const rawProjectId = req.query.project_id;

    if (
      rawProjectId !== undefined &&
      typeof rawProjectId !== "string"
    ) {
      res.status(400).json({ error: "Invalid project_id" });
      return;
    }

    if (typeof rawProjectId === "string") {
      if (!rawProjectId.trim()) {
        res.status(400).json({ error: "Invalid project_id" });
        return;
      }

      if (!projectExists(rawProjectId)) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const access = await getProjectAccess(rawProjectId, userId);

      if (!access || !access.canRead) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const canvases = canvasService.listCanvases(rawProjectId);
      res.json({ canvases });
      return;
    }

    // Preserve the service's existing no-project filter behavior, but never
    // expose its unfiltered result directly. Include only canvases whose
    // projects the caller can read; omit legacy NULL-project canvases.
    const allCanvases = canvasService.listCanvases(null);
    const visibleCanvases: canvasService.Canvas[] = [];

    for (const canvas of allCanvases) {
      if (!canvas.project_id) continue;

      const access = await getProjectAccess(
        canvas.project_id,
        userId,
      );

      if (access?.canRead) {
        visibleCanvases.push(canvas);
      }
    }

    res.json({ canvases: visibleCanvases });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Get canvas with items and connections.
router.get("/:id", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "read",
      res,
    );

    if (!canvas) return;

    const result = canvasService.getCanvasWithItems(canvasId);

    if (!result) {
      res.status(404).json({ error: "Canvas not found" });
      return;
    }

    res.json({ canvas: result });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Update canvas metadata.
router.put("/:id", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);
    const updates: {
      name?: string;
      description?: string | null;
    } = {};

    if (Object.hasOwn(body, "name")) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        res.status(400).json({ error: "name must be a non-empty string" });
        return;
      }

      updates.name = body.name;
    }

    if (Object.hasOwn(body, "description")) {
      if (
        body.description !== null &&
        typeof body.description !== "string"
      ) {
        res.status(400).json({
          error: "description must be a string or null",
        });
        return;
      }

      updates.description = body.description;
    }

    const updatedCanvas = canvasService.updateCanvas(
      canvasId,
      updates,
    );

    if (!updatedCanvas) {
      res.status(404).json({ error: "Canvas not found" });
      return;
    }

    res.json({ canvas: updatedCanvas });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Delete canvas.
router.delete("/:id", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "delete",
      res,
    );

    if (!canvas) return;

    const deleted = canvasService.deleteCanvas(canvasId);

    if (!deleted) {
      res.status(404).json({ error: "Canvas not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Add item to canvas.
router.post("/:id/items", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);
    const item = canvasService.addItem(
      canvasId,
      body as unknown as Parameters<typeof canvasService.addItem>[1],
    );

    res.status(201).json({ item });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Update item. Authorization is resolved using the item's actual parent canvas.
router.put("/items/:itemId", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const itemId = req.params.itemId as string;
    const existingItem = canvasService.getCanvasItemById(itemId);

    if (!existingItem) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const canvas = await requireCanvasAccess(
      existingItem.canvas_id,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);
    const item = canvasService.updateItem(
      itemId,
      body as Parameters<typeof canvasService.updateItem>[1],
    );

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json({ item });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Delete item.
router.delete("/items/:itemId", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const itemId = req.params.itemId as string;
    const item = canvasService.getCanvasItemById(itemId);

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const canvas = await requireCanvasAccess(
      item.canvas_id,
      userId,
      "delete",
      res,
    );

    if (!canvas) return;

    const deleted = canvasService.deleteItem(itemId);

    if (!deleted) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Add connection.
router.post("/:id/connections", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);

    if (
      typeof body.from_item_id !== "string" ||
      !body.from_item_id.trim()
    ) {
      res.status(400).json({
        error: "from_item_id is required",
      });
      return;
    }

    if (
      typeof body.to_item_id !== "string" ||
      !body.to_item_id.trim()
    ) {
      res.status(400).json({
        error: "to_item_id is required",
      });
      return;
    }

    if (
      body.connection_type !== undefined &&
      body.connection_type !== "line" &&
      body.connection_type !== "arrow"
    ) {
      res.status(400).json({
        error: 'connection_type must be "line" or "arrow"',
      });
      return;
    }

    if (
      body.style !== undefined &&
      body.style !== null &&
      typeof body.style !== "string"
    ) {
      res.status(400).json({
        error: "style must be a string or null",
      });
      return;
    }

    const connection = canvasService.addConnection(
      canvasId,
      body.from_item_id,
      body.to_item_id,
      body.connection_type === "arrow" ? "arrow" : "line",
      (body.style as string | null | undefined) ?? null,
    );

    res.status(201).json({ connection });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Update connection.
router.put("/connections/:connId", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const connectionId = req.params.connId as string;
    const existingConnection =
      canvasService.getCanvasConnectionById(connectionId);

    if (!existingConnection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    const canvas = await requireCanvasAccess(
      existingConnection.canvas_id,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);
    const updates: {
      connection_type?: string;
      style?: string | null;
    } = {};

    if (Object.hasOwn(body, "connection_type")) {
      if (
        body.connection_type !== "line" &&
        body.connection_type !== "arrow"
      ) {
        res.status(400).json({
          error: 'connection_type must be "line" or "arrow"',
        });
        return;
      }

      updates.connection_type = body.connection_type;
    }

    if (Object.hasOwn(body, "style")) {
      if (
        body.style !== null &&
        typeof body.style !== "string"
      ) {
        res.status(400).json({
          error: "style must be a string or null",
        });
        return;
      }

      updates.style = body.style;
    }

    if (
      updates.connection_type === undefined &&
      updates.style === undefined
    ) {
      res.status(400).json({
        error: "At least one connection field must be provided",
      });
      return;
    }

    const connection = canvasService.updateConnection(
      connectionId,
      updates,
    );

    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    res.json({ connection });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Delete connection.
router.delete("/connections/:connId", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const connectionId = req.params.connId as string;
    const connection =
      canvasService.getCanvasConnectionById(connectionId);

    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    const canvas = await requireCanvasAccess(
      connection.canvas_id,
      userId,
      "delete",
      res,
    );

    if (!canvas) return;

    const deleted = canvasService.deleteConnection(connectionId);

    if (!deleted) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

export default router;
```

### SOURCE FILE: `backend/src/server.ts`

```typescript
import "./env.ts";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { getDb, closeDb } from "./database/index.ts";
import { configureSecurity } from "./middleware/security.middleware.ts";
import { apiLimiter, authLimiter } from "./middleware/rateLimit.middleware.ts";
import { requireAuth } from "./middleware/auth.middleware.ts";
import authRouter from "./routes/auth.routes.ts";
import tasksRouter from "./routes/tasks.routes.ts";
import projectsRouter from "./routes/projects.routes.ts";
import agentsRouter from "./routes/agents.routes.ts";
import checklistsRouter from "./routes/checklists.routes.ts";
import dependenciesRouter from "./routes/dependencies.routes.ts";
import gitRouter from "./routes/git.routes.ts";
import importExportRouter from "./routes/importExport.routes.ts";
import canvasRouter from "./routes/canvas.routes.ts";
import backupRouter from "./routes/backup.routes.ts";
import monitoringRouter from "./routes/monitoring.routes.ts";
import uiLayoutRouter from "./routes/uiLayout.routes.ts";
import connectorsRouter from "./routes/connectors.routes.ts";
import dashboardRouter from "./routes/dashboard.routes.ts";
import usersRouter from "./routes/users.routes.ts";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Security middleware
configureSecurity(app);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/checklists", checklistsRouter);
app.use("/api/dependencies", dependenciesRouter);
app.use("/api/git", gitRouter);
app.use("/api/import-export", importExportRouter);
app.use("/api/canvas", canvasRouter);
app.use("/api/backup", backupRouter);
app.use("/api/monitoring", monitoringRouter);
app.use("/api/ui-layout", uiLayoutRouter);
app.use("/api/connectors", connectorsRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", database: "connected" });
});

// API 404 handler (only for /api/* routes)
app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Initialize database on startup
getDb();

// Start the unified server with Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode: Mount Vite dev server in middleware mode
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, "..", "..", "frontend", "vite.config.ts"),
      root: path.resolve(__dirname, "..", "..", "frontend"),
      server: { middlewareMode: true },
      appType: "spa",
    });

    // All non-API requests pass to Vite (MUST be before any catch-all handlers)
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve pre-built static bundle
    const distPath = path.join(__dirname, "..", "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Unified Full-Stack Server running on http://localhost:${PORT}`);
    console.log(`   API: /api/*`);
    console.log(`   Frontend: / (React + TypeScript via Vite HMR)`);
  });
}

// Graceful shutdown
process.on("SIGINT", () => { closeDb(); process.exit(0); });
process.on("SIGTERM", () => { closeDb(); process.exit(0); });

startServer();
```

### SOURCE FILE: `backend/src/index.ts`

```typescript
import "./env.ts";
import express from "express";
import { configureSecurity } from "./middleware/security.middleware.ts";
import { apiLimiter, authLimiter } from "./middleware/rateLimit.middleware.ts";
import { requireAuth } from "./middleware/auth.middleware.ts";
import authRouter from "./routes/auth.routes.ts";
import usersRouter from "./routes/users.routes.ts";
import dashboardRouter from "./routes/dashboard.routes.ts";
import agentsRouter from "./routes/agents.routes.ts";
import tasksRouter from "./routes/tasks.routes.ts";
import projectsRouter from "./routes/projects.routes.ts";
import checklistsRouter from "./routes/checklists.routes.ts";
import dependenciesRouter from "./routes/dependencies.routes.ts";
import gitRouter from "./routes/git.routes.ts";
import importExportRouter from "./routes/importExport.routes.ts";
import canvasRouter from "./routes/canvas.routes.ts";
import backupRouter from "./routes/backup.routes.ts";
import monitoringRouter from "./routes/monitoring.routes.ts";
import uiLayoutRouter from "./routes/uiLayout.routes.ts";
import connectorsRouter from "./routes/connectors.routes.ts";
import { getDb, closeDb } from "./database/index.ts";

const app = express();

// Security middleware
configureSecurity(app);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/checklists", checklistsRouter);
app.use("/api/dependencies", dependenciesRouter);
app.use("/api/git", gitRouter);
app.use("/api/import-export", importExportRouter);
app.use("/api/canvas", canvasRouter);
app.use("/api/backup", backupRouter);
app.use("/api/monitoring", monitoringRouter);
app.use("/api/ui-layout", uiLayoutRouter);
app.use("/api/connectors", connectorsRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", database: "connected" });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Initialize database on startup
getDb();

// Graceful shutdown
process.on("SIGINT", () => { closeDb(); process.exit(0); });
process.on("SIGTERM", () => { closeDb(); process.exit(0); });

export { app, getDb, closeDb };
```
