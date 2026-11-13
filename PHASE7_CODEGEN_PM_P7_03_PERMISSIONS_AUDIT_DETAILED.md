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

Note: `schema.sql` uses `CREATE TABLE IF NOT EXISTS`, which does not alter existing tables. The `ALTER TABLE` statements above are idempotent-safe only on a fresh DB; on an existing DB they would fail on re-run. The implementation must make the schema application tolerant of existing columns (e.g., catch the "duplicate column name" error and continue) OR rely on the PM-P7-01 migration runner. **Follow the existing `getDb()` pattern: it executes `schema.sql` on every connection, so the ALTER statements must not throw on re-run.**

### 6. Target files

**New files (create):**
1. `backend/src/services/redaction.service.ts` — shared recursive redaction module (secrets, PII masking, `[REDACTED]`, canary-safe). Exports `redact(value: unknown): unknown`, `redactForAudit(value: unknown): string | null`, `maskEmail(email: string): string`, and `SECRET_KEY_PATTERNS`.
2. `backend/src/services/actor.service.ts` — actor identity resolution. Exports `ActorType`, `Actor` (`actor_type`, `actor_id`, `actor_display?`, `session_id?`, `on_behalf_of?`, `api_key_fingerprint?`), `resolveActor(req): Actor`, `getRequestId(req): string`, and `fingerprintKey(key: string): string`.
3. `backend/src/services/credentialReference.service.ts` — write-only credential reference CRUD + rotate/revoke + scope checks. Never returns `reference` or any secret.
4. `backend/src/services/approval.service.ts` — request/approve/reject/expire; separation of duties; single-use; idempotent.
5. `backend/src/services/audit.service.ts` — append-only audit writer (`record(entry)`), redaction before insert, actor resolution, transaction-safe where feasible.
6. `backend/src/routes/credentialReferences.routes.ts`
7. `backend/src/routes/approvals.routes.ts`
8. `backend/src/routes/audit.routes.ts` — read-only, project-scoped audit history (owner/editor only).
9. `backend/src/tests/automation.security.test.ts` — tests described in section 7.

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
- No `any` in new code; no new dependencies; no frontend changes.

### 8. Safety protocol (ChatGPT must follow)
1. Inspect the complete current source in section 9 before generating. Reuse existing types, services, middleware, and conventions. Never invent APIs, hooks, CSS variables, or data structures.
2. Identify the existing patterns first: `getDb()`, `projectAccess.service.ts`, `auth.middleware.ts`, `connector.service.ts`, `node:test` style.
3. Stop and report if essential information is missing. Do not guess.
4. Return complete replacement code for every file in section 6, with `## FILE: <path>` headers.
5. Include a concise explanation of implementation decisions.
6. Report any remaining limitations or unverified behavior.
7. **Never claim tests passed unless you actually executed them.** You cannot execute them; say so.

### 9. Current source (full files — read before generating)
