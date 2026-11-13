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

## Part C — current source files (authoritative live tree)

Below are the exact current contents of every file this patch touches or depends on. Trust these over assumptions.

### FILE: backend/src/database/schema.sql

```
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
    updated_at    DATETIME NOT NULL DEFAULT (datetime('now'))
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
    expires_at    DATETIME,
    created_at    DATETIME NOT NULL,
    updated_at    DATETIME NOT NULL
);

-- Agent access tokens. The `agents` table records each agent's registration
-- and its expiry window; `agent_tokens` stores the issued, SHA-256 hashed
-- tokens bound to an agent (plus that agent's role and expiry). Separating the
-- bearer records from the event log mirrors the audit-log/activity split.
CREATE TABLE IF NOT EXISTS agent_tokens (
    token_hash    TEXT PRIMARY KEY,
    agent_id      TEXT NOT NULL REFERENCES agents(agent_id),
    role          TEXT NOT NULL,
    expires_at    DATETIME,
    created_at    DATETIME NOT NULL DEFAULT (datetime('now'))
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

### FILE: backend/src/database/migrate.ts

```
import { getDb } from "./index.ts";

// Run schema initialization
getDb();

console.log("Database initialized successfully.");
process.on("SIGINT", () => {
  getDb().close();
  process.exit(0);
});
```

### FILE: backend/src/database/index.ts

```
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let db: InstanceType<typeof DatabaseSync> | null = null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Resolve the schema from the committed source tree, not the compiled dist
// output. In production __dirname resolves to backend/dist/database, whose
// schema.sql is stale (4,891 bytes) and is never refreshed because
// backend/tsconfig.json sets noEmit and .dockerignore excludes dist/.
// Two levels up from src/database/index.ts lands on the backend dir, from
// which src/database/schema.sql is the authoritative, reproducibly sourced
// schema that matches dev and production exactly.
const schemaPath = path.resolve(__dirname, "..", "..", "src", "database", "schema.sql");
const schemaSql = readFileSync(schemaPath, "utf-8");

export function getDb(): InstanceType<typeof DatabaseSync> {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "app.db");
    db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    // Apply schema on first connection
    db.exec(schemaSql);
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

### FILE: backend/package.json

```
{
  "name": "project-manager-backend",
  "version": "1.0.0",
  "description": "Project Manager backend API (Express + TypeScript)",
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc",
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

### FILE: backend/tsconfig.json

```
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

### FILE: backend/tsconfig.typecheck.json

```
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  }
}
```

---

*End of prompt. Paste the entire document above this line into ChatGPT.*
