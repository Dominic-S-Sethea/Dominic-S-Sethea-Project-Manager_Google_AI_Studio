# PM-P7-03 — Permissions, Credentials, Approvals and Audit
## ChatGPT code-generation prompt (self-contained)

### 0. How this package works
Paste this entire file into ChatGPT regular chat. ChatGPT must return **complete replacement code** for every file listed in section 6, each under a `## FILE: <path>` header. ChatGPT has no workspace access — everything it needs is in this file. The assistant (not ChatGPT) applies, audits, and verifies the code. Do not ask ChatGPT to run commands; it cannot.

### 1. Project context (verified against the working tree)
- **Project Manager** backend: Express 5 + TypeScript, ESM (`"type": "module"`), NodeNext module resolution, `.ts` import extensions required on relative imports.
- Database: SQLite via `node:sqlite` `DatabaseSync`. `getDb()` in `backend/src/database/index.ts` returns a singleton with `PRAGMA foreign_keys = ON` and executes `schema.sql` on first connection.
- Typecheck gate: `npm run typecheck` in `backend/` (= `tsc -p tsconfig.typecheck.json --noEmit`). Test gate: `npm test` in `backend/` (= `node --test src/tests/`).
- Auth: `backend/src/middleware/auth.middleware.ts` `requireAuth` verifies a JWT and sets `req.user = { user_id, email, role }`. `backend/src/middleware/agentAuthMiddleware.ts` `verifyAgentAuth` sets `req.agent`.
- Project authorization: `backend/src/services/projectAccess.service.ts` resolves access from `project_members` (project creator is always owner). `users.role` is deliberately **not** used for project authorization.
- Connectors: `backend/src/services/connector.service.ts` + `backend/src/routes/connectors.routes.ts`. The `connectors` table has **no** `project_id` today.
- Audit: an `audit_logs` table exists (see `schema.sql`).
- **Runtime boundary AD-01 = preview-only.** No Automation execution exists. Nothing in this card may execute a workflow or imply a live runtime.

### 2. Hard boundaries (NON-NEGOTIABLE)
1. **No runtime.** Do not add any endpoint that executes a workflow, publishes, replays, or calls an external provider as an Automation runtime action.
2. **No secret leakage.** No secret may be stored in or returned from any table, API response, log, audit row, export, or error message. Secrets include passwords, API keys, tokens, JWTs, connector secrets, `password_hash`, `api_key_hash`, and credential `reference` values.
3. **Credential references are write-only.** After create/rotate, the API returns only safe metadata: `{ configured: true, status, scopes, created_at, updated_at, last_verified_at }`. Never echo a submitted secret or return its stored form.
4. **Project-scoped authorization at the service boundary.** Every read/write resolves the resource's project server-side and checks active membership + action. `users.role` must not grant project access. Unknown role, inactive membership, unmapped connector, or policy lookup failure ⇒ **deny** (fail closed).
5. **Separation of duties.** A requester can never approve their own approval request. Only a human project owner may grant or reject.
6. **Append-only audit.** No update/delete audit API. SQLite triggers `RAISE(ABORT)` on `UPDATE`/`DELETE` of `audit_logs`. Redaction is applied **before** the audit row is written.
7. **No new npm dependencies.** No new frontend files. No Canvas table changes. Do not register any `/api/automation` workflow-execution route.
8. **Register every new route in BOTH** `backend/src/index.ts` and `backend/src/server.ts`.
9. Return **complete replacement files**, not diffs or snippets. No `any` unless a type genuinely does not exist; prefer explicit types and `unknown` + narrowing.

### 3. Approved contract (authoritative — from PHASE4_03 / PHASE2_02)

#### 3.1 Automation permission matrix (PHASE4_03 §5.2)
`R` = read, `C` = create, `U` = update, `D` = delete. All access is project-scoped and membership-checked.

| Capability | Owner | Editor | Viewer | Commenter | Agent (default deny) |
|---|---|---|---|---|---|
| Read workflows, versions, executions, traces | R | R | R | R | Only with explicit grant |
| Create/update/delete drafts | C/U/D | C/U/D | — | — | Only with `workflow.draft.*` grant |
| Create a new version | C | C | — | — | Only with grant |
| Run a **test** execution | Yes | Yes | — | — | Only with grant; never self-approved |
| Publish a version | Disabled now (preview-only) | No | No | No | Never |
| Execute a published workflow (live) | Disabled now (preview-only) | No | No | No | Never self-start or self-approve |
| Approve/reject a human gate | Owner only; never the requester | No | No | No | Never |
| Cancel an execution | Owner; initiator | Owner | — | — | Only with grant |
| Replay a step/execution | Disabled now (preview-only) | No | No | No | Never |
| Read approval queue | R | R (project) | — | — | Only with grant |
| Manage credential references | Owner (write-only) | Request change only | — | — | Never |
| Read a secret value | **Never** | **Never** | **Never** | **Never** | **Never** |
| Read redacted execution traces | R | R | R | R | Only with grant |

#### 3.2 Connector credential scope (PHASE4_03 §5.3)
1. Each connector and credential reference is bound to **one project, one provider, one environment**, and a minimum set of provider scopes/operations.
2. Storage is a server-side credential **reference** plus safe metadata. Secrets resolve only inside the backend operation that needs them. Raw credentials never enter workflow JSON, database config fields, browser storage, URLs, or task metadata.
3. **Write-only:** owners set/rotate/revoke through an authorized write-only operation. After save, every role receives only `configured: true`, status, scopes, and update time.
4. **Use:** a connector runner receives only the exact credential reference and provider operation it needs. Agents and workflows receive neither a secret-read API nor a reusable credential value.
5. **Test mode:** mock/pinned data only; it must not call the live provider.
6. **Existing connector records:** because `connectors` has no `project_id`, existing records must be explicitly mapped or **quarantined** before any cross-user/project access. Never fall back to global visibility or creator-only inference.

#### 3.3 Redaction contract (PHASE4_03 §6)
| Class | Fields | Handling |
|---|---|---|
| `secret` | passwords, API keys, tokens, JWTs, connector secrets, `password_hash`, `api_key_hash`, credential `reference` values | Never stored or returned. Replaced with `[REDACTED]`. |
| `pii` | email, device fingerprint, IP (optional), username | Masked by default; full value only for owner/admin with a `read_sensitive` audit record. |
| `financial` | future billing/cost fields | Masked unless role permits. |
| `internal` | internal IDs, paths, stack traces | Stored as-is but never returned in public APIs. |

Rules:
1. A single shared redaction module is used by API serialization, logging, audit, outbox, export, and error reporting.
2. Redaction is applied **before** the audit row is written, not at read time.
3. Redaction applies to logs, exports, error messages, and UI previews.
4. `connector_configs.value` where `is_secret = 1` must never appear in any API response, log, export, or screenshot.
5. Provider error detail is kept in protected diagnostics only after redaction; the API returns a generic safe error with a `request_id`.
6. Redaction must be testable: a unit test asserts that no known secret pattern appears in any serialized audit/log/export payload.
7. Frontend masking is never the only control.

#### 3.4 Audit contract (PHASE4_03 §7)
- **Actor model:** `actor_type` (`user | agent | system | automation | anonymous`), `actor_id`, `actor_display` (resolved at read time), `session_id`, `on_behalf_of`, `api_key_fingerprint` (SHA-256 prefix, first 12 chars, never the key), `ip_address`, `user_agent` (truncated), `request_id`, `trace_id`.
- **Object model:** `target_table`, `target_id`, `target_sub_id`, `target_parent_id`, `target_summary`, `project_id`, `action`, `trigger`.
- **Actions:** `workflow.created`, `workflow.updated`, `workflow.archived`, `version.created`, `workflow.published`, `workflow.paused`, `execution.started`, `execution.step_completed`, `execution.step_failed`, `execution.completed`, `execution.failed`, `execution.cancelled`, `execution.timed_out`, `approval.requested`, `approval.granted`, `approval.rejected`, `approval.expired`, `credential_reference.created`, `credential_reference.rotated`, `credential_reference.revoked`, `credential_reference.used`, `replay.requested`, `replay.denied`.
- **Triggers:** `ui | api | agent | automation | system | import | migration | backup`.
- **Before/after:** create ⇒ `old_value = NULL`, `new_value = full redacted snapshot`; update ⇒ field-level diff preferred; delete ⇒ `old_value = full redacted snapshot`, `new_value = NULL`. Snapshots are taken inside the same transaction as the change.
- **Immutability:** audit rows are append-only; no update/delete routes; SQLite triggers `RAISE(ABORT)` on `UPDATE`/`DELETE`.
- **Coverage:** every create/update/delete/approve/execute action in the target domain writes an audit row with server-derived actor/project/resource/action/outcome and `request_id`.

### 4. Target schema contract — owned by PM-P7-01 (DO NOT CREATE THESE TABLES)
Code against these exact columns. PM-P7-01 creates them. If a column you need is missing, **stop and report it**; do not change the contract.

```sql
CREATE TABLE IF NOT EXISTS environments (
    environment_id TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(project_id),
    name            TEXT NOT NULL,
    mode            TEXT NOT NULL,           -- 'preview' | 'test' | 'live'
    is_live         INTEGER NOT NULL DEFAULT 0,
    created_by      TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS approvals (
    approval_id      TEXT PRIMARY KEY,
    execution_id     TEXT REFERENCES executions(execution_id),
    step_id          TEXT REFERENCES execution_steps(step_id),
    workflow_id      TEXT NOT NULL REFERENCES workflows(workflow_id),
    version_id       TEXT,
    approval_type    TEXT NOT NULL,          -- 'publish' | 'execute' | 'connector_action' | 'replay_side_effect'
    status           TEXT NOT NULL,          -- 'pending' | 'granted' | 'rejected' | 'expired' | 'cancelled'
    requested_by_type TEXT NOT NULL,         -- 'user' | 'agent' | 'automation'
    requested_by_id  TEXT NOT NULL,
    requested_at     TEXT NOT NULL,
    reviewer_id      TEXT REFERENCES users(user_id),
    decided_at       TEXT,
    decision_note    TEXT,
    expires_at       TEXT NOT NULL,
    idempotency_key  TEXT NOT NULL UNIQUE,
    created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credential_references (
    credential_reference_id TEXT PRIMARY KEY,
    project_id              TEXT NOT NULL REFERENCES projects(project_id),
    connector_id            TEXT REFERENCES connectors(connector_id),
    environment_id          TEXT REFERENCES environments(environment_id),
    reference               TEXT NOT NULL,   -- pointer to secret store; NOT the secret
    provider_scopes        TEXT NOT NULL DEFAULT '[]',  -- JSON array of allowed scopes/operations
    created_by              TEXT NOT NULL,
    created_at              TEXT NOT NULL,
    rotated_at              TEXT,
    expires_at              TEXT,
    revoked_at              TEXT,
    last_verified_at        TEXT
);
```

### 5. PM-P7-03-owned schema changes
These are part of this card. Add them to `schema.sql` (additive, safe for existing data):

```sql
-- Connector project/environment scope + action allowlist (additive, nullable for legacy rows)
ALTER TABLE connectors ADD COLUMN project_id              TEXT REFERENCES projects(project_id);
ALTER TABLE connectors ADD COLUMN environment_id          TEXT REFERENCES environments(environment_id);
ALTER TABLE connectors ADD COLUMN allowed_actions         TEXT NOT NULL DEFAULT '[]';  -- JSON array
ALTER TABLE connectors ADD COLUMN credential_reference_id TEXT REFERENCES credential_references(credential_reference_id);

CREATE INDEX IF NOT EXISTS idx_connectors_project ON connectors(project_id);

-- Audit actor/correlation columns (additive, nullable)
ALTER TABLE audit_logs ADD COLUMN actor_type   TEXT;
ALTER TABLE audit_logs ADD COLUMN actor_id     TEXT;
ALTER TABLE audit_logs ADD COLUMN project_id   TEXT;
ALTER TABLE audit_logs ADD COLUMN request_id   TEXT;
ALTER TABLE audit_logs ADD COLUMN trace_id     TEXT;
ALTER TABLE audit_logs ADD COLUMN target_sub_id TEXT;
ALTER TABLE audit_logs ADD COLUMN outcome      TEXT;

-- Append-only enforcement (defense in depth)
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
```

Note: `schema.sql` uses `CREATE TABLE IF NOT EXISTS`, which does not alter existing tables. The `ALTER TABLE` statements above are idempotent-safe only on a fresh DB; on an existing DB they would fail on re-run.

**Required approach:** `backend/src/database/index.ts` is an authorized target file. Extend its compatibility migration to idempotently add the new columns from this section. Use `PRAGMA table_info` to check whether each column exists before issuing `ALTER TABLE`. Never throw on re-run. The existing pattern in `index.ts` (adding `agents.expires_at` when absent) is the reference implementation.

Do NOT rely on the PM-P7-01 migration runner for these columns — `getDb()` executes `schema.sql` on every connection, so the compatibility migration in `index.ts` is the correct place.

### 6. Target files

**New files (create):**
1. `backend/src/services/redaction.service.ts` — shared recursive redaction module (secrets, PII masking, `[REDACTED]`, canary-safe). Exports `redact(value: unknown): unknown`, `redactForAudit(value: unknown): string | null`, `maskEmail(email: string): string`, and `SECRET_KEY_PATTERNS`.
2. `backend/src/services/actor.service.ts` — actor identity resolution. Exports `ActorType`, `Actor` (`actor_type`, `actor_id`, `actor_display?`, `session_id?`, `on_behalf_of?`, `api_key_fingerprint?`), `resolveActor(req): Actor`, `getRequestId(req): string`, and `fingerprintKey(key: string): string`.
3. `backend/src/services/credentialReference.service.ts` — write-only credential reference CRUD + rotate/revoke + scope checks. Never returns `reference` or any secret.
4. `backend/src/services/approval.service.ts` — request/approve/reject/expire; separation of duties; single-use; idempotent.
5. `backend/src/services/audit.service.ts` — append-only audit writer (`record(entry)`), redaction before insert, actor resolution, transaction-safe where feasible.
6. `backend/src/services/workflow.service.ts` — workflow CRUD + node/edge CRUD + validation. Exports `createWorkflow`, `getWorkflow`, `listWorkflows`, `updateWorkflow`, `deleteWorkflow`, `createNode`, `updateNode`, `deleteNode`, `createEdge`, `deleteEdge`, `validateWorkflow`.
7. `backend/src/services/workflowVersion.service.ts` — version snapshot/rollback. Exports `createVersion`, `getVersion`, `listVersions`, `rollbackToVersion`.
8. `backend/src/services/environment.service.ts` — environment CRUD + credential reference linking. Exports `createEnvironment`, `getEnvironment`, `listEnvironments`, `updateEnvironment`, `deleteEnvironment`.
9. `backend/src/routes/credentialReferences.routes.ts`
10. `backend/src/routes/approvals.routes.ts`
11. `backend/src/routes/audit.routes.ts` — read-only, project-scoped audit history (owner/editor only).
12. `backend/src/routes/automation.workflows.routes.ts` — workflow + node + edge CRUD at `/api/v1/automation/workflows`.
13. `backend/src/routes/automation.environments.routes.ts` — environment CRUD at `/api/v1/automation/environments`.
14. `backend/src/tests/automation.security.test.ts` — tests described in section 7.
15. `backend/src/tests/automation.api.test.ts` — tests for the new API routes.

**Modified files (return complete replacements):**
1. `backend/src/database/schema.sql` — add section 5 changes, tolerantly.
2. `backend/src/services/projectAccess.service.ts` — add `authorize(actor, projectId, resource, action)` implementing the section 3.1 matrix, project-scoped, fail-closed; keep existing exports working.
3. `backend/src/services/connector.service.ts` — enforce action allowlists, project/environment scope, quarantine legacy unscoped connectors, redact secret config values in all responses, never return `connector_configs.value` where `is_secret = 1`.
4. `backend/src/routes/connectors.routes.ts` — add authorization, project scope, audit records, safe error envelopes, redaction.
5. `backend/src/middleware/auth.middleware.ts` — resolve actor identity + `request_id`; keep `requireAuth`/`requireRole` behavior.
6. `backend/src/middleware/agentAuthMiddleware.ts` — resolve agent actor, default-deny unless an explicit grant exists; never accept a client-supplied grant.
7. `backend/src/index.ts` — register the new routers.
8. `backend/src/server.ts` — register the new routers.

### 7. Acceptance criteria
- `npm run typecheck` in `backend/` exits 0.
- `npm test` in `backend/` passes (existing tests plus the new file).
- New tests must cover:
  - **Redaction:** a canary secret placed in a connector config, credential reference, audit snapshot, and error path never appears in any serialized output.
  - **Audit immutability:** `UPDATE`/`DELETE` on `audit_logs` raises; the audit API has no update/delete route.
  - **Actor identity:** user, agent, and system actors resolve to the correct `actor_type`/`actor_id`; `request_id` is propagated.
  - **Authorization matrix:** table-driven owner/editor/viewer/commenter/agent cases for credential-reference and approval operations.
  - **IDOR / cross-project:** a project A member cannot read or write project B's credential references or approvals.
  - **Credential write-only:** create/rotate never echo the secret; the API exposes only safe metadata.
  - **Approval separation of duties:** a requester cannot approve their own request; a non-owner cannot approve; expired approvals cannot be granted.
  - **Connector allowlist:** a disallowed action is rejected; a legacy connector with `project_id = NULL` is inaccessible (quarantined).
- **Automation API:** `GET/POST/PUT/DELETE /api/v1/automation/workflows` and `/api/v1/automation/environments` enforce project-scoped authorization (owner/editor can write, viewer read-only, non-member 404). Node/edge operations validate the workflow belongs to the caller's project. All responses use safe error envelopes (no SQL/driver leakage).
- **Workflow validation:** creating/updating a node or edge runs the V-01..V-23 validation rules from the approved spec; invalid operations return 400 with structured errors.
- **Version snapshots:** creating a version snapshots the workflow definition; rollback restores a prior version atomically.
- No `any` in new code; no new dependencies; no frontend changes.

### 8. Safety protocol (ChatGPT must follow)
1. Inspect the complete current source in section 9 before generating. Reuse existing types, services, middleware, and conventions. Never invent APIs, hooks, CSS variables, or data structures.
2. Identify the existing patterns first: `getDb()`, `projectAccess.service.ts`, `auth.middleware.ts`, `connector.service.ts`, `node:test` style.
3. Stop and report if essential information is missing. Do not guess.
4. Return complete replacement code for every file in section 6, with `## FILE: <path>` headers.
5. Include a concise explanation of implementation decisions.
6. Report any remaining limitations or unverified behavior.
7. **Never claim tests passed unless you actually executed them.** You cannot execute them; say so.
8. **Automation API prefix:** use `/api/v1/automation/...` (owner-approved UD-11). Do NOT use `/api/automation/...` (that prefix is already used by PM-P7-02's event/execution routes).
9. **Preview-only boundary:** the Automation API is preview-only (AD-01/UD-10). No publish/execute/replay endpoints. The workflow builder must degrade gracefully when the API is unreachable.

### 9. Current source (full files — read before generating)


## FILE: `backend/src/database/schema.sql`
```typescript
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
    preview              INTEGER NOT NULL DEFAULT 1 CHECK (preview IN (0, 1))
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
```

SHA-256: `0dfb1d05e7035d515bf41f958ed72bdf8d395b4d7bda914e68bffe09676b9ee6`

## FILE: `backend/src/services/connector.service.ts`
```typescript
import { getDb } from "../database/index.ts";
import { randomUUID } from "node:crypto";

export interface ConnectorDefinition {
  id: string;
  name: string;
  provider: string;
  type: "oauth" | "api_key" | "webhook" | "token";
  description: string;
  icon: string;
  configFields: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  actions: { id: string; label: string; description: string }[];
}

export interface ConnectorInstance {
  connector_id: string;
  name: string;
  type: string;
  provider: string;
  status: "connected" | "disconnected" | "error" | "pending";
  config: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const AVAILABLE_CONNECTORS: ConnectorDefinition[] = [
  {
    id: "github",
    name: "GitHub",
    provider: "github",
    type: "token",
    description: "Connect to GitHub repositories, issues, and pull requests",
    icon: "github",
    configFields: [
      { key: "access_token", label: "Personal Access Token", type: "password", required: true, placeholder: "ghp_..." },
      { key: "repo_owner", label: "Repository Owner", type: "text", required: false, placeholder: "username or org" },
      { key: "repo_name", label: "Repository Name", type: "text", required: false, placeholder: "repo-name" },
    ],
    actions: [
      { id: "list_repos", label: "List Repositories", description: "List accessible GitHub repositories" },
      { id: "create_issue", label: "Create Issue", description: "Create a GitHub issue" },
      { id: "list_issues", label: "List Issues", description: "List repository issues" },
      { id: "link_commit", label: "Link Commit", description: "Link a commit to a task" },
    ],
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    provider: "hermes",
    type: "api_key",
    description: "Connect to Hermes Agent for AI-powered assistance",
    icon: "hermes",
    configFields: [
      { key: "api_key", label: "API Key", type: "password", required: true, placeholder: "hermes-..." },
      { key: "base_url", label: "Base URL", type: "url", required: false, placeholder: "https://api.hermes-agent.com" },
      { key: "model", label: "Default Model", type: "text", required: false, placeholder: "gpt-4" },
    ],
    actions: [
      { id: "test_connection", label: "Test Connection", description: "Verify Hermes API connectivity" },
      { id: "send_message", label: "Send Message", description: "Send a message to Hermes" },
      { id: "list_models", label: "List Models", description: "List available models" },
    ],
  },
];

export class ConnectorService {
  listAvailable(): ConnectorDefinition[] {
    return AVAILABLE_CONNECTORS;
  }

  getDefinition(provider: string): ConnectorDefinition | undefined {
    return AVAILABLE_CONNECTORS.find((c) => c.provider === provider);
  }

  listInstances(userId?: string): ConnectorInstance[] {
    const db = getDb();
    let query = "SELECT * FROM connectors";
    const params: any[] = [];
    if (userId) {
      query += " WHERE created_by = ?";
      params.push(userId);
    }
    query += " ORDER BY created_at DESC";
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((row) => ({
      connector_id: row.connector_id,
      name: row.name,
      type: row.type,
      provider: row.provider,
      status: row.status,
      config: row.config ? JSON.parse(row.config) : {},
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  getInstance(connectorId: string): ConnectorInstance | null {
    const db = getDb();
    const row = db.prepare("SELECT * FROM connectors WHERE connector_id = ?").get(connectorId) as any;
    if (!row) return null;
    return {
      connector_id: row.connector_id,
      name: row.name,
      type: row.type,
      provider: row.provider,
      status: row.status,
      config: row.config ? JSON.parse(row.config) : {},
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  createInstance(provider: string, name: string, userId: string, config: Record<string, any> = {}): ConnectorInstance {
    const db = getDb();
    const def = this.getDefinition(provider);
    if (!def) throw new Error(`Unknown connector provider: ${provider}`);

    const connectorId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO connectors (connector_id, name, type, provider, status, config, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(connectorId, name, def.type, provider, "disconnected", JSON.stringify(config), userId, now, now);

    // Save individual config entries
    for (const [key, value] of Object.entries(config)) {
      const configId = randomUUID();
      const field = def.configFields.find((f) => f.key === key);
      db.prepare(`
        INSERT INTO connector_configs (config_id, connector_id, key, value, is_secret, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(configId, connectorId, key, String(value), field?.type === "password" ? 1 : 0, now, now);
    }

    return this.getInstance(connectorId)!;
  }

  updateConfig(connectorId: string, config: Record<string, any>): ConnectorInstance {
    const db = getDb();
    const instance = this.getInstance(connectorId);
    if (!instance) throw new Error("Connector not found");

    const def = this.getDefinition(instance.provider);
    if (!def) throw new Error("Unknown connector provider");

    const now = new Date().toISOString();
    const mergedConfig = { ...instance.config, ...config };
    db.prepare("UPDATE connectors SET config = ?, updated_at = ? WHERE connector_id = ?").run(
      JSON.stringify(mergedConfig), now, connectorId
    );

    // Update individual config entries
    for (const [key, value] of Object.entries(config)) {
      const existing = db.prepare("SELECT config_id FROM connector_configs WHERE connector_id = ? AND key = ?").get(connectorId, key) as any;
      const field = def.configFields.find((f) => f.key === key);
      if (existing) {
        db.prepare("UPDATE connector_configs SET value = ?, updated_at = ? WHERE config_id = ?").run(String(value), now, existing.config_id);
      } else {
        const configId = randomUUID();
        db.prepare(`
          INSERT INTO connector_configs (config_id, connector_id, key, value, is_secret, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(configId, connectorId, key, String(value), field?.type === "password" ? 1 : 0, now, now);
      }
    }

    return this.getInstance(connectorId)!;
  }

  updateStatus(connectorId: string, status: ConnectorInstance["status"]): ConnectorInstance {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare("UPDATE connectors SET status = ?, updated_at = ? WHERE connector_id = ?").run(status, now, connectorId);
    return this.getInstance(connectorId)!;
  }

  deleteInstance(connectorId: string): boolean {
    const db = getDb();
    db.prepare("DELETE FROM connector_configs WHERE connector_id = ?").run(connectorId);
    const result = db.prepare("DELETE FROM connectors WHERE connector_id = ?").run(connectorId);
    return (result as any).changes > 0;
  }

  getConfig(connectorId: string): Record<string, any> {
    const instance = this.getInstance(connectorId);
    if (!instance) throw new Error("Connector not found");
    return instance.config;
  }

  // GitHub-specific actions
  async githubListRepos(connectorId: string): Promise<any[]> {
    const config = this.getConfig(connectorId);
    const token = config.access_token;
    if (!token) throw new Error("GitHub access token not configured");

    const res = await fetch("https://api.github.com/user/repos?per_page=100", {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    const repos = await res.json();
    return repos.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      description: r.description,
      private: r.private,
      html_url: r.html_url,
      default_branch: r.default_branch,
    }));
  }

  async githubListIssues(connectorId: string, owner: string, repo: string): Promise<any[]> {
    const config = this.getConfig(connectorId);
    const token = config.access_token;
    if (!token) throw new Error("GitHub access token not configured");

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=50`, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    const issues = await res.json();
    return issues.map((i: any) => ({
      id: i.id,
      number: i.number,
      title: i.title,
      state: i.state,
      html_url: i.html_url,
      created_at: i.created_at,
      user: i.user?.login,
    }));
  }

  async githubCreateIssue(connectorId: string, owner: string, repo: string, title: string, body: string): Promise<any> {
    const config = this.getConfig(connectorId);
    const token = config.access_token;
    if (!token) throw new Error("GitHub access token not configured");

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: "POST",
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    const issue = await res.json();
    return { id: issue.id, number: issue.number, title: issue.title, html_url: issue.html_url };
  }

  // Hermes-specific actions
  async hermesTestConnection(connectorId: string): Promise<{ ok: boolean; message: string }> {
    const config = this.getConfig(connectorId);
    const apiKey = config.api_key;
    const baseUrl = config.base_url || "https://api.hermes-agent.com";
    if (!apiKey) throw new Error("Hermes API key not configured");

    try {
      const res = await fetch(`${baseUrl}/health`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        return { ok: true, message: "Connection successful" };
      }
      return { ok: false, message: `Connection failed: ${res.status} ${res.statusText}` };
    } catch (err: any) {
      return { ok: false, message: `Connection error: ${err.message}` };
    }
  }

  async hermesSendMessage(connectorId: string, message: string): Promise<any> {
    const config = this.getConfig(connectorId);
    const apiKey = config.api_key;
    const baseUrl = config.base_url || "https://api.hermes-agent.com";
    const model = config.model || "default";
    if (!apiKey) throw new Error("Hermes API key not configured");

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: message }],
      }),
    });
    if (!res.ok) throw new Error(`Hermes API error: ${res.status} ${res.statusText}`);
    return await res.json();
  }

  async hermesListModels(connectorId: string): Promise<any[]> {
    const config = this.getConfig(connectorId);
    const apiKey = config.api_key;
    const baseUrl = config.base_url || "https://api.hermes-agent.com";
    if (!apiKey) throw new Error("Hermes API key not configured");

    try {
      const res = await fetch(`${baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`Hermes API error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      return data.data || data.models || [];
    } catch (err: any) {
      return [{ id: "default", name: "Default Model" }];
    }
  }

  // Test connection for any connector
  async testConnection(connectorId: string): Promise<{ ok: boolean; message: string }> {
    const instance = this.getInstance(connectorId);
    if (!instance) throw new Error("Connector not found");

    if (instance.provider === "github") {
      const config = instance.config;
      if (!config.access_token) return { ok: false, message: "Access token not configured" };
      try {
        const res = await fetch("https://api.github.com/user", {
          headers: { Authorization: `token ${config.access_token}` },
        });
        if (res.ok) {
          const user = await res.json();
          return { ok: true, message: `Connected as ${user.login}` };
        }
        return { ok: false, message: `GitHub auth failed: ${res.status}` };
      } catch (err: any) {
        return { ok: false, message: `Connection error: ${err.message}` };
      }
    }

    if (instance.provider === "hermes") {
      return this.hermesTestConnection(connectorId);
    }

    return { ok: false, message: "Unknown connector type" };
  }
}

export const connectorService = new ConnectorService();
```

SHA-256: `ae823c8dccd09a5a073e7052376cd6930d2224961585a81925e420c665f7b271`

## FILE: `backend/src/services/agentAuthService.ts`
```typescript
import type { Request, Response } from "express";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.ts";

const db = getDb();

const validRoles: readonly string[] = ["admin", "editor", "viewer"];

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

export const registerAgent = async (req: Request, res: Response) => {
  try {
    const body =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)
        : {};

    const apiKey = body.apiKey;
    const role = body.role ?? "viewer";

    if (typeof apiKey !== "string" || apiKey.length === 0) {
      return res.status(400).json({ message: "API key is required" });
    }

    if (typeof role !== "string" || !validRoles.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Valid roles: ${validRoles.join(", ")}`,
      });
    }

    const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    const existing = db.prepare(
      "SELECT agent_id FROM agents WHERE api_key_hash = ?"
    ).get(apiKeyHash) as { agent_id: string } | undefined;

    if (existing) {
      return res.status(409).json({ message: "Agent with this API key already exists" });
    }

    const agentId = uuidv4();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // These fields are NOT NULL in agents. Keep the existing API-key/role request
    // contract while allowing callers to supply descriptive metadata when available.
    const name = stringOrDefault(body.name, "Registered Agent");
    const provider = stringOrDefault(body.provider, "unspecified");
    const model = stringOrDefault(body.model, "unspecified");
    const permissions =
      JSON.stringify(Array.isArray(body.permissions) ? body.permissions : []) ?? "[]";

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        `INSERT INTO agents (
          agent_id, name, role, api_key_hash, provider, model, permissions,
          status, created_at, updated_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
      ).run(
        agentId,
        name,
        role,
        apiKeyHash,
        provider,
        model,
        permissions,
        now,
        now,
        expiresAt,
      );

      db.prepare(
        `INSERT INTO agent_tokens (token_hash, agent_id, role, expires_at)
         VALUES (?, ?, ?, ?)`
      ).run(tokenHash, agentId, role, expiresAt);

      db.exec("COMMIT");
    } catch (transactionError) {
      try {
        db.exec("ROLLBACK");
      } catch (rollbackError) {
        console.error("Agent registration rollback error:", rollbackError);
      }
      throw transactionError;
    }

    return res.status(201).json({
      agent_id: agentId,
      api_key: apiKey,
      token,
      expires_at: expiresAt,
    });
  } catch (err: unknown) {
    console.error("Agent registration error:", err);
    return res.status(500).json({ message: "Agent registration failed" });
  }
};
```

SHA-256: `5310a72664430103971970fc06c10077568e4a0df42b21eaa6f9f1cf3edaafa9`

## FILE: `backend/src/services/agentLoginService.ts`
```typescript
import type { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getDb } from "../database/index.ts";

const db = getDb();

export const loginAgent = async (req: Request, res: Response) => {
  try {
    const { apiKey, role } = req.body;
    if (!apiKey) {
      return res.status(400).json({ message: "API key is required" });
    }

    const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    const agent = db.prepare(
      `SELECT a.agent_id, a.role, a.status, a.created_at
       FROM agents a WHERE a.api_key_hash = ? AND a.status = 'active'`
    ).get(apiKeyHash) as { agent_id: string; role: string; status: string; created_at: string } | undefined;

    if (!agent) {
      return res.status(401).json({ message: "Invalid API key" });
    }

    if (role && agent.role !== role) {
      return res.status(403).json({ message: `Agent role mismatch. Expected: ${role}, Got: ${agent.role}` });
    }

    const token = jwt.sign(
      {
        agent_id: agent.agent_id,
        role: agent.role,
        type: "agent",
      },
      process.env.JWT_SECRET || "project-manager-jwt-secret",
      { expiresIn: "7d" }
    );

    return res.json({
      agent: {
        agent_id: agent.agent_id,
        role: agent.role,
        status: agent.status,
        created_at: agent.created_at,
      },
      token,
      token_type: "Bearer",
      expires_in: "7d",
    });
  } catch (err: any) {
    console.error("Agent login error:", err);
    return res.status(500).json({ message: "Agent login failed" });
  }
};
```

SHA-256: `93bf21eb23f0294db8e98054c117ecfe37b25640bedf0c5c486a9d827a1ce486`

## FILE: `backend/src/services/auth.service.ts`
```typescript
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.ts";

// In-memory user store (demo seed). In production, this would be a DB-backed service.
const DEMO_USERS = [
  { email: "owner@projectmgr.dev", passwordHash: bcrypt.hashSync("owner123", 10), role: "owner" as const },
  { email: "editor@projectmgr.dev", passwordHash: bcrypt.hashSync("editor123", 10), role: "editor" as const },
  { email: "viewer@projectmgr.dev", passwordHash: bcrypt.hashSync("viewer123", 10), role: "viewer" as const },
];

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  // Check demo users first
  let user = DEMO_USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  
  // If not found in demo users, check database
  if (!user) {
    const { getDb } = await import("../database/index.ts");
    const db = getDb();
    const dbUser = db.prepare("SELECT user_id, username, email, password_hash, role FROM users WHERE email = ?").get(email.toLowerCase()) as { user_id: string; username: string; email: string; password_hash: string; role: string } | undefined;
    if (dbUser) {
      const valid = await bcrypt.compare(password, dbUser.password_hash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = jwt.sign(
        { user_id: dbUser.user_id, email: dbUser.email, role: dbUser.role },
        process.env.JWT_SECRET || "project-manager-jwt-secret",
        { expiresIn: "7d" }
      );
      return res.json({
        user: {
          user_id: dbUser.user_id,
          username: dbUser.username,
          email: dbUser.email,
          role: dbUser.role,
          status: "active",
          created_at: new Date().toISOString(),
        },
        token,
      });
    }
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { user_id: uuidv4(), email: user.email, role: user.role },
    process.env.JWT_SECRET || "project-manager-jwt-secret",
    { expiresIn: "7d" }
  );

  res.json({
    user: {
      user_id: uuidv4(),
      username: user.email.split("@")[0],
      email: user.email,
      role: user.role,
      status: "active",
      created_at: new Date().toISOString(),
    },
    token,
  });
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }
  try {
    const token = authHeader.split(" ")[1] as string;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "project-manager-jwt-secret");
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};


export async function registerUser(username: string, email: string, password: string) {
  const { getDb } = await import("../database/index.ts");
  const db = getDb();
  
  // Check if user already exists
  const userResult = db.prepare("SELECT user_id FROM users WHERE email = ?").get(email.toLowerCase());
  if (userResult) {
    throw new Error("User already exists");
  }
  
  // Hash the password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  // Generate user_id
  const userId = (await import("uuid")).v4();
  
  // Insert the user
  db.prepare(
    "INSERT INTO users (user_id, username, email, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(userId, username, email.toLowerCase(), passwordHash, "viewer", "active", new Date().toISOString());
  
  // Get the created user
  const user = db.prepare("SELECT user_id, username, email, role FROM users WHERE user_id = ?").get(userId) as { user_id: string; email: string; role: string };
  
  // Generate JWT token
  const token = jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "project-manager-jwt-secret",
    { expiresIn: "7d" }
  );
  
  return { user, token };
}

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
};
```

SHA-256: `0ab330c54213d6cbd75810f7c2f9a667d19355b9000fb39ed2c09c74e28d6cc9`

## FILE: `backend/src/middleware/auth.middleware.ts`
```typescript
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { user_id: string; email: string; role: string };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }
  try {
    const token = authHeader.split(" ")[1] as string;
    const secret = process.env.JWT_SECRET || "project-manager-jwt-secret";
    const decoded = jwt.verify(token, secret) as any;
    (req as AuthRequest).user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = (req as AuthRequest).user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
};
```

SHA-256: `64638281ae66212abba61d1076174addb9f8b03c23b8b7d9b0dff0e60702e218`

## FILE: `backend/src/middleware/agentAuthMiddleware.ts`
```typescript
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { getDb } from "../database/index.ts";

export interface AgentUser {
  agent_id: string;
  api_key_hash: string;
  role: string;
  status: string;
  created_at: string;
}

const db = getDb();

export const verifyAgentAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid agent token" });
  }

  const apiKey = authHeader.split(" ")[1] as string;
  const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  const result = db.prepare(
    "SELECT agent_id, role, status, created_at FROM agents WHERE api_key_hash = ?"
  ).get(apiKeyHash) as AgentUser | undefined;

  if (!result) {
    return res.status(401).json({ message: "Invalid agent credentials" });
  }

  if (result.status !== "active") {
    return res.status(403).json({ message: "Agent account is inactive" });
  }

  (req as any).agent = result;
  next();
};

export const verifyAgentRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const agent = (req as any).agent;
    if (!agent) {
      return res.status(401).json({ message: "Agent not authenticated" });
    }
    if (!allowedRoles.includes(agent.role)) {
      return res.status(403).json({ message: "Insufficient agent permissions" });
    }
    next();
  };
};
```

SHA-256: `bc7665c08d891e1283c51392269aa36cf5e9852cca2b9229e4cb616fc1993f22`

## FILE: `backend/src/routes/agents.routes.ts`
```typescript
import { Router } from "express";
import { registerAgent } from "../services/agentAuthService.ts";
import { loginAgent } from "../services/agentLoginService.ts";
import { verifyAgentAuth, verifyAgentRole } from "../middleware/agentAuthMiddleware.ts";

const router = Router();

/**
 * POST /api/agents/register
 * Register a new agent with API key
 */
router.post("/register", registerAgent);

/**
 * POST /api/agents/login
 * Agent login endpoint
 */
router.post("/login", loginAgent);

/**
 * GET /api/agents/me
 * Get current agent information
 */
router.get("/me", verifyAgentAuth, (req: any, res) => {
  res.json({ agent: req.agent });
});

export default router;
```

SHA-256: `2980b5cc75371d7e9b2e12167f27f29fca1028804ffbfdd1a51edbac56bdf0d4`

## FILE: `backend/src/index.ts`
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

SHA-256: `7cbcf279dd28d461d32e5ada7dc9b851e232af7f323a0c472b6e915f006f0210`

## FILE: `backend/src/server.ts`
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
import { createAutomationEventsRouter } from "./routes/automation.events.ts";
import { createAutomationExecutionsRouter } from "./routes/automation.executions.ts";

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
app.use("/api/automation/events", createAutomationEventsRouter(getDb()));
app.use("/api/automation/executions", createAutomationExecutionsRouter(getDb()));

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

SHA-256: `1109e817ab26dc3a4b7766b02c1c22bb9e1c8db78432590a22a88515f9891752`

## FILE: `backend/src/database/migrate.ts`
```typescript
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LEDGER_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version        INTEGER PRIMARY KEY,
    name           TEXT NOT NULL,
    applied_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    checksum       TEXT NOT NULL,
    duration_ms    INTEGER NOT NULL,
    applied_by     TEXT
);
`;

interface MigrationFile {
  version: number;
  name: string;
  fileName: string;
  filePath: string;
  checksum: string;
  sql: string;
}

interface DownMigrationFile {
  version: number;
  fileName: string;
  filePath: string;
  sql: string;
}

interface AppliedMigrationRow {
  version: number;
  name: string;
  checksum: string;
  applied_at: string;
  duration_ms: number;
  applied_by: string | null;
}

export interface RunMigrationsOptions {
  databasePath?: string;
  migrationsDir?: string;
  schemaPath?: string;
  dryRun?: boolean;
  showVersion?: boolean;
  downToVersion?: number;
  appliedBy?: string | null;
  log?: (message: string) => void;
}

export interface RunMigrationsResult {
  currentVersion: number | null;
  latestVersion: number | null;
  pendingVersions: number[];
  rolledBackVersions: number[];
}

function writeLog(options: RunMigrationsOptions, message: string): void {
  (options.log ?? console.log)(message);
}

const FK_SUSPENSION_BY_VERSION = new Map<number, string>([
  [2, "0002 rebuilds executions while preserving circular approvals and execution_steps references"],
]);

const TRANSIENT_TABLES_BY_VERSION = new Map<number, ReadonlySet<string>>([
  [2, new Set(["executions_new"])],
]);

function stripSqlComments(sql: string): string {
  return sql
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function getCreatedTableNames(sql: string): Set<string> {
  const names = new Set<string>();
  const uncommentedSql = stripSqlComments(sql);
  const pattern = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*))/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(uncommentedSql)) !== null) {
    const tableName = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (tableName) names.add(tableName);
  }

  return names;
}

/** Return ALTER TABLE rename pairs; only declared v2 transient sources are promoted. */
function getRenamedTableNames(sql: string): Map<string, string> {
  const renamed = new Map<string, string>();
  const identifier = '(?:"([^"]+)"|`([^`]+)`|\\[([^\\]]+)\\]|([A-Za-z_][A-Za-z0-9_]*))';
  const pattern = new RegExp(`\\bALTER\\s+TABLE\\s+${identifier}\\s+RENAME\\s+TO\\s+${identifier}`, "gi");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(stripSqlComments(sql))) !== null) {
    const source = match[1] ?? match[2] ?? match[3] ?? match[4];
    const target = match[5] ?? match[6] ?? match[7] ?? match[8];
    if (source && target) renamed.set(source, target);
  }

  return renamed;
}

function discoverMigrations(migrationsDir: string): MigrationFile[] {
  const files = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.endsWith(".down.sql"))
    .map((entry) => entry.name)
    .map((fileName): MigrationFile | null => {
      const match = /^(\d{4})_(.+)\.sql$/.exec(fileName);
      if (!match) return null;

      const versionText = match[1];
      const name = match[2];
      if (!versionText || !name) return null;

      const filePath = path.join(migrationsDir, fileName);
      const bytes = readFileSync(filePath);

      return {
        version: Number.parseInt(versionText, 10),
        name,
        fileName,
        filePath,
        checksum: createHash("sha256").update(bytes).digest("hex"),
        sql: bytes.toString("utf8"),
      };
    })
    .filter((migration): migration is MigrationFile => migration !== null)
    .sort((left, right) => left.version - right.version);

  if (files.length === 0) {
    throw new Error(`No up migration files found in ${migrationsDir}`);
  }

  const versions = new Set<number>();
  for (const migration of files) {
    if (versions.has(migration.version)) {
      throw new Error(`Duplicate migration version ${migration.version}`);
    }
    versions.add(migration.version);
  }

  return files;
}

function assertMigrationSchemaParity(
  migrations: MigrationFile[],
  schemaPath: string,
): void {
  const schemaSql = readFileSync(schemaPath, "utf8");
  const schemaTables = getCreatedTableNames(schemaSql);
  const migrationTables = new Set<string>();

  for (const migration of migrations) {
    const transient = TRANSIENT_TABLES_BY_VERSION.get(migration.version) ?? new Set<string>();
    const createdTables = getCreatedTableNames(migration.sql);
    for (const tableName of createdTables) {
      if (!transient.has(tableName)) migrationTables.add(tableName);
    }
    // A rebuild's scratch table is temporary, but its RENAME target is the
    // persistent table that must be represented by schema.sql.
    for (const [source, target] of getRenamedTableNames(migration.sql)) {
      if (transient.has(source)) migrationTables.add(target);
    }
  }

  const missingTables = [...migrationTables]
    .filter((tableName) => !schemaTables.has(tableName))
    .sort();

  if (missingTables.length > 0) {
    throw new Error(
      `Migration/schema parity failure: schema.sql is missing tables created by migrations: ${missingTables.join(", ")}`,
    );
  }
}

function getAppliedMigrations(database: InstanceType<typeof DatabaseSync>): AppliedMigrationRow[] {
  return database
    .prepare(
      `SELECT version, name, checksum, applied_at, duration_ms, applied_by
       FROM schema_migrations
       ORDER BY version ASC`,
    )
    .all() as unknown as AppliedMigrationRow[];
}

function assertNoMigrationDrift(
  appliedRows: AppliedMigrationRow[],
  migrations: MigrationFile[],
): void {
  const byVersion = new Map(migrations.map((migration) => [migration.version, migration]));

  for (const applied of appliedRows) {
    const migration = byVersion.get(applied.version);

    if (!migration) {
      throw new Error(
        `Migration drift detected: applied version ${applied.version} (${applied.name}) has no matching migration file`,
      );
    }

    if (migration.name !== applied.name) {
      throw new Error(
        `Migration drift detected for version ${applied.version}: ledger name "${applied.name}" does not match file name "${migration.name}"`,
      );
    }

    if (migration.checksum !== applied.checksum) {
      throw new Error(
        `Migration drift detected for version ${applied.version} (${applied.name}): checksum mismatch`,
      );
    }
  }
}

function getForeignKeyViolations(
  database: InstanceType<typeof DatabaseSync>,
): Array<Record<string, unknown>> {
  return database
    .prepare("PRAGMA foreign_key_check")
    .all() as Array<Record<string, unknown>>;
}

function formatForeignKeyViolations(
  violations: Array<Record<string, unknown>>,
): string {
  return JSON.stringify(violations);
}

function currentVersion(rows: AppliedMigrationRow[]): number | null {
  return rows.length > 0 ? rows[rows.length - 1]?.version ?? null : null;
}

function findDownMigration(
  migrationsDir: string,
  migration: MigrationFile,
): DownMigrationFile {
  const fileName = `${String(migration.version).padStart(4, "0")}_${migration.name}.down.sql`;
  const filePath = path.join(migrationsDir, fileName);
  const sql = readFileSync(filePath, "utf8");

  return {
    version: migration.version,
    fileName,
    filePath,
    sql,
  };
}

function rollbackMigrations(
  database: InstanceType<typeof DatabaseSync>,
  options: RunMigrationsOptions,
  migrationsDir: string,
  appliedRows: AppliedMigrationRow[],
  migrations: MigrationFile[],
  latest: number | null,
): RunMigrationsResult {
  const target = options.downToVersion;

  if (target === undefined || !Number.isInteger(target) || target < 0) {
    throw new Error("--down requires a non-negative integer --to <version>");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("--down is a development-only operation and is disabled in production");
  }

  const current = currentVersion(appliedRows);
  if (current !== null && target > current) {
    throw new Error(`Cannot roll back to version ${target}; current version is ${current}`);
  }

  const migrationByVersion = new Map(
    migrations.map((migration) => [migration.version, migration]),
  );

  const rollbackPlan = [...appliedRows]
    .filter((row) => row.version > target)
    .sort((left, right) => right.version - left.version)
    .map((row) => {
      const migration = migrationByVersion.get(row.version);
      if (!migration) {
        throw new Error(`Cannot roll back unknown applied migration ${row.version}`);
      }
      return { row, down: findDownMigration(migrationsDir, migration) };
    });

  if (rollbackPlan.length === 0) {
    writeLog(options, JSON.stringify({
      event: "migration_down_noop",
      current_version: current,
      target_version: target,
    }));
    return {
      currentVersion: current,
      latestVersion: latest,
      pendingVersions: [],
      rolledBackVersions: [],
    };
  }

  if (options.dryRun) {
    writeLog(options, JSON.stringify({
      event: "migration_down_dry_run",
      target_version: target,
      versions: rollbackPlan.map((item) => item.row.version),
    }));
    return {
      currentVersion: current,
      latestVersion: latest,
      pendingVersions: [],
      rolledBackVersions: rollbackPlan.map((item) => item.row.version),
    };
  }

  const rolledBackVersions: number[] = [];

  // The workflow/version and execution/approval references are intentionally
  // circular. Disable FK enforcement outside each transaction while the
  // development-only down scripts remove the complete domain; verify the
  // remaining database before committing and then restore enforcement.
  database.exec("PRAGMA foreign_keys = OFF;");
  try {
    for (const item of rollbackPlan) {
      const startedAt = Date.now();
      database.exec("BEGIN IMMEDIATE;");
      try {
        database.exec(item.down.sql);

        const violations = getForeignKeyViolations(database);
        if (violations.length > 0) {
          throw new Error(
            `Foreign-key check failed after rolling back version ${item.row.version}: ${formatForeignKeyViolations(violations)}`,
          );
        }

        database
          .prepare("DELETE FROM schema_migrations WHERE version = ?")
          .run(item.row.version);

        database.exec("COMMIT;");
        rolledBackVersions.push(item.row.version);

        writeLog(options, JSON.stringify({
          event: "migration_rolled_back",
          version: item.row.version,
          name: item.row.name,
          duration_ms: Date.now() - startedAt,
        }));
      } catch (error) {
        try {
          database.exec("ROLLBACK;");
        } catch {
          // Preserve the original migration error.
        }
        throw error;
      }
    }
  } finally {
    database.exec("PRAGMA foreign_keys = ON;");
  }

  return {
    currentVersion: currentVersion(getAppliedMigrations(database)),
    latestVersion: latest,
    pendingVersions: [],
    rolledBackVersions,
  };
}

/**
 * Runs explicit SQL migrations. Importing this module never opens a database
 * and never applies schema.sql; getDb() remains the schema bootstrap owner.
 */
export function runMigrations(
  options: RunMigrationsOptions = {},
): RunMigrationsResult {
  const databasePath =
    options.databasePath ??
    (process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "app.db"));
  const migrationsDir = options.migrationsDir ?? path.join(__dirname, "migrations");
  const schemaPath = options.schemaPath ?? path.join(__dirname, "schema.sql");

  const migrations = discoverMigrations(migrationsDir);
  assertMigrationSchemaParity(migrations, schemaPath);

  const database = new DatabaseSync(databasePath);

  try {
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(LEDGER_SQL);

    const appliedRows = getAppliedMigrations(database);
    assertNoMigrationDrift(appliedRows, migrations);

    const latest = migrations[migrations.length - 1]?.version ?? null;

    if (options.downToVersion !== undefined) {
      return rollbackMigrations(
        database,
        options,
        migrationsDir,
        appliedRows,
        migrations,
        latest,
      );
    }

    const appliedVersions = new Set(appliedRows.map((row) => row.version));
    const pending = migrations.filter(
      (migration) => !appliedVersions.has(migration.version),
    );

    if (options.showVersion) {
      writeLog(options, JSON.stringify({
        event: "migration_version",
        current_version: currentVersion(appliedRows),
        latest_version: latest,
      }));
      return {
        currentVersion: currentVersion(appliedRows),
        latestVersion: latest,
        pendingVersions: pending.map((migration) => migration.version),
        rolledBackVersions: [],
      };
    }

    if (options.dryRun) {
      writeLog(options, JSON.stringify({
        event: "migration_dry_run",
        current_version: currentVersion(appliedRows),
        pending_versions: pending.map((migration) => migration.version),
      }));
      return {
        currentVersion: currentVersion(appliedRows),
        latestVersion: latest,
        pendingVersions: pending.map((migration) => migration.version),
        rolledBackVersions: [],
      };
    }

    if (pending.length === 0) {
      writeLog(options, JSON.stringify({
        event: "migration_noop",
        current_version: currentVersion(appliedRows),
        message: "No pending migrations",
      }));
      return {
        currentVersion: currentVersion(appliedRows),
        latestVersion: latest,
        pendingVersions: [],
        rolledBackVersions: [],
      };
    }

    for (const migration of pending) {
      const startedAt = Date.now();
      const suspendForeignKeys = FK_SUSPENSION_BY_VERSION.has(migration.version);
      let transactionStarted = false;
      try {
        // A1: only migration version 2 is permitted to suspend FK enforcement.
        // SQLite ignores this pragma inside a transaction, so it must precede BEGIN.
        if (suspendForeignKeys) database.exec("PRAGMA foreign_keys = OFF;");
        database.exec("BEGIN IMMEDIATE;");
        transactionStarted = true;
        database.exec(migration.sql);

        const violations = getForeignKeyViolations(database);
        if (violations.length > 0) {
          throw new Error(
            `Foreign-key check failed after migration ${migration.version} (${migration.name}): ${formatForeignKeyViolations(violations)}`,
          );
        }

        const durationMs = Date.now() - startedAt;
        database
          .prepare(
            `INSERT INTO schema_migrations
              (version, name, checksum, duration_ms, applied_by)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            migration.version,
            migration.name,
            migration.checksum,
            durationMs,
            options.appliedBy ?? null,
          );

        database.exec("COMMIT;");
        transactionStarted = false;

        writeLog(options, JSON.stringify({
          event: "migration_applied",
          version: migration.version,
          name: migration.name,
          checksum: migration.checksum,
          duration_ms: durationMs,
          applied_by: options.appliedBy ?? null,
        }));
      } catch (error) {
        if (transactionStarted) {
          try {
            database.exec("ROLLBACK;");
          } catch {
            // Preserve the original migration error.
          }
        }
        throw error;
      } finally {
        if (suspendForeignKeys) database.exec("PRAGMA foreign_keys = ON;");
      }
    }

    const finalRows = getAppliedMigrations(database);
    return {
      currentVersion: currentVersion(finalRows),
      latestVersion: latest,
      pendingVersions: [],
      rolledBackVersions: [],
    };
  } finally {
    database.close();
  }
}

function parseCliArguments(args: string[]): RunMigrationsOptions {
  const options: RunMigrationsOptions = {};
  let downRequested = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--version") {
      options.showVersion = true;
    } else if (argument === "--down") {
      downRequested = true;
    } else if (argument === "--to") {
      const value = args[index + 1];
      if (!value) throw new Error("--to requires a version number");
      index += 1;
      const version = Number(value);
      if (!Number.isInteger(version) || version < 0) {
        throw new Error("--to requires a non-negative integer version");
      }
      options.downToVersion = version;
    } else {
      throw new Error(`Unknown migration argument: ${argument}`);
    }
  }

  if (downRequested !== (options.downToVersion !== undefined)) {
    throw new Error("Use --down together with --to <version>");
  }

  if (options.showVersion && (options.dryRun || downRequested)) {
    throw new Error("--version cannot be combined with --dry-run or --down");
  }

  return options;
}

function isExecutedDirectly(): boolean {
  const entryPoint = process.argv[1];
  return entryPoint !== undefined &&
    path.resolve(entryPoint) === fileURLToPath(import.meta.url);
}

if (isExecutedDirectly()) {
  try {
    runMigrations(parseCliArguments(process.argv.slice(2)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Migration runner failed: ${message}`);
    process.exitCode = 1;
  }
}
```

SHA-256: `9605830933ec836b6604d41b8d1c8c9f2518342a90915dec348b978c953783fd`

## FILE: `backend/package.json`
```typescript
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

SHA-256: `a934beb912eb4f8eb9cb0a88131881cff47492da2cb7b499aefe8603bf8051be`

## FILE: `backend/src/database/index.ts`
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

SHA-256: `3d14d6ec0850570329246b9f421532a4a97a339c87fede282ac51e78b326b950`

## FILE: `backend/src/services/projectAccess.service.ts`
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

SHA-256: `6a4503dc7db55946c5653425feb584d0c1dab88c689b4f6801d9e8068f6e5cac`

## FILE: `backend/src/routes/connectors.routes.ts`
```typescript
import { Router } from "express";
import { connectorService } from "../services/connector.service.ts";
import { requireAuth } from "../middleware/auth.middleware.ts";

const router = Router();

// List available connector definitions
router.get("/available", requireAuth, (_req, res) => {
  res.json({ connectors: connectorService.listAvailable() });
});

// List connector instances
router.get("/", requireAuth, (req: any, res) => {
  try {
    const instances = connectorService.listInstances(req.user?.user_id);
    res.json({ connectors: instances });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to list connectors", error: err.message });
  }
});

// Get connector instance
router.get("/:id", requireAuth, (req, res) => {
  try {
    const instance = connectorService.getInstance(req.params.id as string);
    if (!instance) return res.status(404).json({ message: "Connector not found" });
    res.json({ connector: instance });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to get connector", error: err.message });
  }
});

// Create connector instance
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const { provider, name, config } = req.body;
    if (!provider) return res.status(400).json({ message: "Provider is required" });
    const instance = connectorService.createInstance(provider, name || provider, req.user.user_id, config || {});
    res.status(201).json({ connector: instance });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to create connector", error: err.message });
  }
});

// Update connector config
router.patch("/:id/config", requireAuth, async (req, res) => {
  try {
    const instance = connectorService.updateConfig(req.params.id as string, req.body.config || req.body);
    res.json({ connector: instance });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to update config", error: err.message });
  }
});

// Update connector status
router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["connected", "disconnected", "error", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const instance = connectorService.updateStatus(req.params.id as string, status);
    res.json({ connector: instance });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to update status", error: err.message });
  }
});

// Delete connector
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const deleted = connectorService.deleteInstance(req.params.id as string);
    if (!deleted) return res.status(404).json({ message: "Connector not found" });
    res.json({ message: "Connector deleted" });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to delete connector", error: err.message });
  }
});

// Test connection
router.post("/:id/test", requireAuth, async (req, res) => {
  try {
    const result = await connectorService.testConnection(req.params.id as string);
    const status = result.ok ? "connected" : "error";
    connectorService.updateStatus(req.params.id as string, status);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: "Test failed", error: err.message });
  }
});

// GitHub-specific: list repos
router.get("/:id/github/repos", requireAuth, async (req, res) => {
  try {
    const repos = await connectorService.githubListRepos(req.params.id as string);
    res.json({ repos });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to list repos", error: err.message });
  }
});

// GitHub-specific: list issues
router.get("/:id/github/issues", requireAuth, async (req, res) => {
  try {
    const owner = req.query.owner as string;
    const repo = req.query.repo as string;
    if (!owner || !repo) return res.status(400).json({ message: "owner and repo required" });
    const issues = await connectorService.githubListIssues(req.params.id as string, owner, repo);
    res.json({ issues });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to list issues", error: err.message });
  }
});

// GitHub-specific: create issue
router.post("/:id/github/issues", requireAuth, async (req, res) => {
  try {
    const { owner, repo, title, body } = req.body as { owner: string; repo: string; title: string; body?: string };
    if (!owner || !repo || !title) return res.status(400).json({ message: "owner, repo, and title required" });
    const issue = await connectorService.githubCreateIssue(req.params.id as string, owner, repo, title, body || "");
    res.status(201).json({ issue });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to create issue", error: err.message });
  }
});

// Hermes-specific: send message
router.post("/:id/hermes/message", requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: "Message is required" });
    const result = await connectorService.hermesSendMessage(req.params.id as string, message);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to send message", error: err.message });
  }
});

// Hermes-specific: list models
router.get("/:id/hermes/models", requireAuth, async (req, res) => {
  try {
    const models = await connectorService.hermesListModels(req.params.id as string);
    res.json({ models });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to list models", error: err.message });
  }
});

export default router;
```

SHA-256: `2fb4e89d91ba393dcb12cfdd53f11709667bff28d0c2d55b4827a51061e3824a`

