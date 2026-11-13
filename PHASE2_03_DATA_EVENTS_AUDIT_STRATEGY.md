# PM-P2-03 — Data, Events, Audit & Observability Strategy

**Card:** PM-P2-03 — Migrations, domain events, audit, queue/retry/timeout/idempotency, observability
**Status:** Proposed — pending owner approval (no implementation authorized by this document)
**Phase:** 2 — Shared foundation architecture
**Repository:** `<workspace>`
**Boundary:** Read-only planning artifact. No application source, schema, data, server, or migration was changed. No automation runtime is assumed to exist.
**Date:** 2026-11-10

> Evidence labels: **VERIFIED** = read directly from the working tree or a command result during this task; **REPORTED** = stated in a project document but not independently proved; **PROPOSED** = recommended, not approved; **UNKNOWN** = not currently verifiable; **DECISION-REQUIRED** = owner decision needed.

---

## 1. Executive summary

The workspace has a working SQLite schema (18 tables) and a single idempotent bootstrap script, but **no migration system, no event/outbox system, no audit writer, no queue, no retry/timeout/cancellation model, and no implemented alerting**. The `audit_logs` table exists and is empty (0 rows); no code in `backend/src` writes to it. `agent_activities` exists and is empty; no code writes to it. `backend/src/database/migrations/` exists and is **empty**.

The Automation Studio is a preview-only mock. No automation/workflow/execution/approval tables, routes, services, or runtimes exist. This strategy therefore specifies the **shared data/event/audit/reliability foundation** that any future Automation runtime must build on, without assuming that runtime exists or is approved.

Three concrete defects found during evidence gathering must be resolved before any migration or event work is useful:

1. **Backend build is broken** (`TS5096`: `allowImportingTsExtensions` without `noEmit`/`emitDeclarationOnly`). The Dockerfile runs `npm run build`, so production images cannot currently be built or run migrations.
2. **Agent schema drift:** `agentAuthService.ts` inserts into `agents (…, expires_at)` and into an `agent_tokens` table. Neither `agents.expires_at` nor `agent_tokens` exists in `schema.sql` or in the live DB. Agent registration/login is therefore broken at runtime.
3. **Docker healthcheck port mismatch:** `server.ts` reads `NODE_PORT || "3000"`, but `docker-compose.yml` sets `PORT=4000` (not `NODE_PORT`). The container healthcheck curls `localhost:4000`, which the app does not listen on.

---

## 2. Current-state evidence

### 2.1 Schema

**VERIFIED** — `backend/src/database/schema.sql` (9,351 chars) defines 18 tables:

`users`, `projects`, `tasks`, `task_dependencies`, `comments`, `checklists`, `checklist_items`, `audit_logs`, `agents`, `agent_activities`, `login_history`, `git_commits`, `canvases`, `canvas_items`, `canvas_connections`, `connectors`, `connector_configs`, `ui_layouts`.

**VERIFIED** — live DB `backend/data/app.db` (368,640 bytes; WAL 473,832 bytes) contains the same 18 tables. Row counts: `projects` 70, `tasks` 42, `users` 36, `checklists` 7, `checklist_items` 14, `task_dependencies` 7, `ui_layouts` 1; **`audit_logs` 0, `agent_activities` 0, `agents` 0, `comments` 0, `connectors` 0, `canvas*` 0, `git_commits` 0, `login_history` 0**.

**VERIFIED** — `PRAGMA quick_check` → `ok`; `PRAGMA journal_mode` → `wal`; `PRAGMA page_count` → 90.

**VERIFIED** — **no** tables matching workflow, automation, execution, approval, event, outbox, queue, job, or migration exist in either `schema.sql` or the live DB.

**VERIFIED** — schema uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` only. There is **no** `ALTER TABLE`, **no** `schema_migrations`/`user_migrations` table, and no version column.

### 2.2 Migration system

**VERIFIED** — there is no migration system.

| Artifact | State |
|---|---|
| `backend/src/database/migrations/` | Directory exists, **empty** (0 files) |
| `backend/src/database/schema.sql` | Full bootstrap, `IF NOT EXISTS`, re-run on every first connection |
| `backend/src/database/index.ts` | `getDb()` runs `db.exec(schemaSql)` once per process on first connection |
| `backend/src/database/migrate.ts` | Calls `getDb()` only; prints "Database initialized successfully." |
| `backend/src/database/migrate.js` | Plain-JS duplicate that reads `schema.sql` and `db.exec(sql)` once |
| `backend/package.json` | Declares `db:migrate`, `db:seed`, `db:reset` |
| `backend/src/database/seed.ts` | **Does not exist** |
| `backend/src/database/reset.ts` | **Does not exist** |
| `docs/backup-config.md` | Claims restore procedure runs `npm run db:migrate` (no-op today) |
| `docs/deployment-checklist.md` | References migrations; no versioned migration contract |

**Consequence:** schema changes are currently made by editing `schema.sql` and re-running it. Because every statement is `IF NOT EXISTS`, **adding** a table/column/index is safe, but **changing or removing** an existing object silently does nothing, and there is no record of what was applied. A column rename or type change requires a manual, untracked intervention.

### 2.3 Audit

**VERIFIED** — `audit_logs` exists with columns:

`log_id`, `user_id`, `agent_id`, `action`, `target_table`, `target_id`, `old_value`, `new_value`, `trigger`, `reasoning_summary`, `ip_address`, `created_at`.

**VERIFIED** — **zero** rows. A regex scan of all `backend/src/**/*.{ts,js,sql}` found the string `audit` only in `schema.sql`. There is **no** audit service, **no** audit middleware, **no** audit route, and **no** `INSERT INTO audit_logs` anywhere.

**VERIFIED** — `TECH_STACK.md` claims `middleware/audit.middleware.ts` and `services/audit.service.ts` exist. **They do not exist.** That document is aspirational, not descriptive.

**VERIFIED** — `agent_activities` exists (`activity_id`, `agent_id`, `user_id`, `action`, `target_id`, `target_table`, `trigger`, `reasoning_summary`, `status` default `pending`, `created_at`) with **0 rows** and no writer. It is a second, parallel activity store that is currently dead.

**VERIFIED** — the `audit_logs` schema is insufficient for a future automation/audit contract: it has no `actor_type`, no `session_id`, no `trace_id`, no `request_id`, no `before_hash`/`after_hash`, no `redaction_class`, no `retention_class`, and no immutable-write protection.

### 2.4 Backup and restore

**VERIFIED** — `backend/src/services/backup.service.ts`:
- `PRAGMA wal_checkpoint(PASSIVE)` then `fs.copyFileSync` of `app.db`, `app.db-wal`, `app.db-shm`.
- No exclusive lock, no SQLite backup API, no `VACUUM INTO`. A file copy during concurrent writes can produce an inconsistent snapshot even after a PASSIVE checkpoint.
- `pruneOldBackups(keepCount=30)` deletes oldest by filename sort.

**VERIFIED** — `backend/src/routes/backup.routes.ts`: `POST /api/backup`, `GET /api/backup`, `DELETE /api/backup/:filename`, `POST /api/backup/prune` — all `requireAuth`, all **manual**. No role check beyond authentication.

**VERIFIED** — `scripts/backup.sh` (cron-oriented, keeps 30) and `scripts/restore.sh` (copies file back, restores WAL/SHM) exist. `scripts/rollback.sh` is Docker-image rollback only.

**VERIFIED** — `.github/workflows/ci-cd.yml` has **no `schedule:` trigger and no cron**. The `docs/backup-config.md` claim of a "nightly backup via GitHub Actions scheduled workflow" is **not implemented**.

**VERIFIED** — `backend/backups/` contains two manual backup sets (2026-11-09T07-27-30 and 07-32-32), each `.db` + `-shm` + `-wal`. No backup verification, checksum, restore test, or off-host copy exists.

**VERIFIED** — `docker-compose.yml` mounts `app_data:/app/backend/data` (persistent volume) and defines a healthcheck.

### 2.5 Monitoring and alerting

**VERIFIED** — implemented:
- `GET /health` in `monitoring.routes.ts` — unauthenticated, performs `SELECT 1`, returns `status` `ok|degraded|down`, `database`, `uptime`, `memory`, `cpu`, `timestamp`; HTTP 503 when down.
- `GET /api/monitoring/metrics` — `requireAuth`; returns project/task/user/canvas counts, `tasks_by_status`, `tasks_by_priority`, `db_size_bytes`.
- `GET /health` in `index.ts` and `server.ts` — returns a static `{status:"ok", database:"connected"}` **without checking the DB**. This is misleading and should be removed or made real.
- `docker-compose.yml` healthcheck: `curl -f http://localhost:4000/health`, 30s interval, 10s timeout, 3 retries.

**VERIFIED** — **not implemented:**
- No metrics counters, histograms, or timers.
- No request logging, no structured JSON logs, no correlation IDs.
- No alerting pipeline. `docs/monitoring-config.md` lists alert rules (health failure, 5xx rate, DB growth, memory, container restart) — **these are documentation only**; no code or configuration implements them.
- No alert sink (no Alertmanager, webhook, PagerDuty, email, or Slack integration).
- `getMetrics()` computes `db_size_bytes` from `process.env.DB_PATH || "./data/app.db"`, which does not match the path resolution in `database/index.ts` (`__dirname/../../data/app.db`). The metric can be wrong depending on cwd.
- `memory.percentage` divides heap-used by total system memory, which is not a meaningful host memory signal.

### 2.6 Runtime / automation boundary

**VERIFIED** — `frontend/src/pages/AutomationStudio.tsx` is a static preview: it renders "Preview only · no runtime connected", a disabled "Publish workflow" button, sample data, disabled "Replay node · future", and contains **no `fetch()` call**. It explicitly states live run history "must be powered by a separately approved backend runtime."

**VERIFIED** — `frontend/src/pages/ReviewQueue.tsx` performs real `fetch("/api/tasks?status=blocked")` and `fetch("/api/dashboard")`. Its approval panel is explicitly disabled pending a backend contract.

**VERIFIED** — no route in `backend/src/index.ts` or `backend/src/server.ts` handles automation, workflow, execution, replay, approval, audit, event, or outbox.

**VERIFIED** — no worker, queue, scheduler, cron, `setInterval`, or background loop exists in `backend/src` (the only `retry` match is an HTTP `Retry-After` header in `rateLimit.middleware.ts`).

### 2.7 Build and deploy blockers

**VERIFIED** — `backend/tsconfig.json` sets `"allowImportingTsExtensions": true` with `"outDir": "./dist"` and no `noEmit`/`emitDeclarationOnly` → `tsc` fails with **TS5096**. `npm run build` therefore exits non-zero. The Dockerfile's `RUN npm run build` will fail.

**VERIFIED** — a stale `backend/dist/` exists locally (gitignored), so `node dist/server.js` can still be attempted, but it is not reproducible from source.

**VERIFIED** — `docker-compose.yml` sets `PORT=4000`; `server.ts` reads `NODE_PORT || "3000"`. The container will listen on 3000 while the healthcheck probes 4000.

**VERIFIED** — CI (`.github/workflows/ci-cd.yml`) runs backend typecheck, frontend typecheck, backend tests, and frontend build. It does **not** run backend build, migrations, backup, or a scheduled job.

---

## 3. Migration policy (explicit)

### 3.1 Principles

1. **`schema.sql` is the fresh-install source of truth.** Every migration must be reflected in `schema.sql` so a new database is created at the latest version in one step.
2. **Migrations are additive-forward and versioned.** Each migration is an immutable, ordered file. Applied migrations are recorded in a `schema_migrations` table. Migrations are never edited after being applied to any environment.
3. **No destructive change without a backup and a named rollback.** Drop/destructive migrations require a pre-deploy backup, a written rollback, and explicit owner approval.
4. **Expand/contract for compatibility.** Renames and type changes use a two-step expand → migrate data → contract sequence so old and new code can both run during a rollout.
5. **Transactional where possible.** Each migration runs in a single SQLite transaction. SQLite DDL is transactional.
6. **Idempotent runner.** Re-running the runner is a no-op after the latest version.
7. **Same runner in dev, CI, Docker, and production.** No environment edits the schema by hand.

### 3.2 Versioning and ordering

- Integer monotonic version `NNNN` with zero-padded filename: `migrations/0001_init.sql`, `0002_audit_actor.sql`, …
- A migration file may contain multiple statements but must be a single logical change.
- A companion `000N_*.sql` may be followed by a data-backfill script with the same version and a `_data` suffix, executed in the same transaction.
- The runner applies pending versions in ascending order, one at a time, recording `(version, name, applied_at, checksum, duration_ms)` in `schema_migrations`.
- Checksum is SHA-256 of the file bytes. If a recorded checksum no longer matches the file, the runner **refuses to start** and reports drift.
- A `--dry-run` mode prints pending migrations without applying.
- A `--version` command prints the current and latest version.

### 3.3 Rules

| Rule | Requirement |
|---|---|
| R1 | Never modify a migration file that has been applied anywhere. Add a new version instead. |
| R2 | Every migration must be safe to run on a database that already contains production data. |
| R3 | Adding a nullable column, a new table, or a new index is allowed without approval. |
| R4 | Adding a `NOT NULL` column requires a default or a backfill in the same migration. |
| R5 | Dropping a column/table requires expand/contract and owner approval. |
| R6 | Renaming requires `ALTER TABLE … RENAME COLUMN` plus a compatibility view or a two-version contract; never rename and delete in one step. |
| R7 | Index changes must be `CREATE INDEX IF NOT EXISTS` / explicit `DROP INDEX IF EXISTS`. |
| R8 | Foreign keys must be validated: `PRAGMA foreign_key_check` after any migration that touches FK relationships. |
| R9 | Migrations must not depend on application code or environment-specific paths. |
| R10 | Every migration must be covered by a test that runs it against a copy of a representative database. |

### 3.4 Proposed migration artifacts (PROPOSED)

```sql
-- 0000_baseline.sql (PROPOSED, not yet created)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version        INTEGER PRIMARY KEY,
    name           TEXT NOT NULL,
    applied_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    checksum       TEXT NOT NULL,
    duration_ms    INTEGER NOT NULL,
    applied_by     TEXT
);
```

Runner location (PROPOSED): `backend/src/database/migrate.ts` replaced with a real runner that:
1. Opens the DB with `PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;`
2. Creates `schema_migrations` if absent.
3. Reads `migrations/*.sql` sorted by version.
4. Verifies checksums of already-applied versions.
5. Applies pending versions in a transaction, records them, and logs a structured audit event (`trigger = 'migration'`).
6. Refuses to run if `schema.sql` and the latest migration disagree (guards bootstrap drift).

### 3.5 Execution and environments

- **Dev:** `npm run db:migrate` (runner). `npm run db:reset` must be recreated or removed from `package.json`.
- **CI:** add a `db:migrate -- --dry-run` step plus a migration-apply step against a scratch DB, before backend tests.
- **Docker:** run migrations as an entrypoint step **before** `node dist/server.js`, using the same runner. Fix `TS5096` first.
- **Production:** pre-deploy backup → run migrations → health check → smoke test → keep the previous release for rollback. Never migrate automatically on container start without an explicit `RUN_MIGRATIONS` flag (recommended: **off by default**, on via deploy pipeline).

### 3.6 Rollback

- SQLite has no transactional DDL rollback across versions; rollback is a **forward migration** that reverses the change, or a **restore from backup**.
- Every non-additive migration must ship with a documented reverse migration (PROPOSED convention: `NNNN_name.up.sql` / `NNNN_name.down.sql`), even if `down` is only used in development.
- Production rollback order: restore last known-good backup → verify `PRAGMA quick_check` → run app at previous version → verify health.
- The existing `scripts/rollback.sh` only rolls the Docker image; it does not roll the database. **Database rollback is a gap.**

### 3.7 Approval gates

| Gate | Required approval |
|---|---|
| Add table/column/index | Engineering (no owner gate) |
| Add `NOT NULL`/default | Engineering |
| Rename/type change | Engineering + owner |
| Drop/remove | Engineering + owner + backup |
| Migration runner contract | Engineering + owner (this document) |
| Production migration run | Owner + on-call |

---

## 4. Event / outbox / queue strategy

### 4.1 Decision

**PROPOSED: transactional outbox in SQLite, no external broker.**

Rationale:
- The product is single-node SQLite today. Introducing RabbitMQ/Redis/Kafka would add a second system to back up, secure, monitor, and migrate, for no current need.
- A transactional outbox gives atomicity between a state change and its event, which is the property that actually matters.
- If a broker is approved later, the outbox table becomes the publishing adapter; consumers and handlers do not change.
- **Do not assume an automation runtime exists.** This section defines the mechanism; the automation runtime that would consume these events is a separate, unapproved capability.

### 4.2 Event catalog (PROPOSED)

Events are named `aggregate.verb` in past tense. Payload is JSON. Every event carries:

```
event_id, aggregate_type, aggregate_id, event_type, payload,
actor_type, actor_id, idempotency_key, trace_id,
occurred_at, created_at
```

Initial catalog (only for existing domains):

| Event | Aggregate | Trigger |
|---|---|---|
| `project.created` / `project.updated` / `project.archived` | project | UI/API |
| `task.created` / `task.updated` / `task.status_changed` / `task.deleted` | task | UI/API/agent |
| `task.assigned` / `task.due_date_changed` | task | UI/API/agent |
| `checklist.created` / `checklist.item_toggled` | checklist | UI/API |
| `dependency.created` / `dependency.removed` | task_dependencies | UI/API |
| `comment.created` / `comment.updated` | comment | UI/API |
| `approval.requested` / `approval.granted` / `approval.rejected` / `approval.expired` | approval | agent/automation (future) |
| `execution.started` / `execution.step_completed` / `execution.failed` / `execution.cancelled` / `execution.completed` | execution | automation (future) |
| `connector.config_changed` / `connector.secret_rotated` | connector | UI/API |
| `audit.log_created` | audit | system |
| `migration.applied` | schema | system |
| `backup.created` / `backup.restored` | backup | system |

`approval.*` and `execution.*` are **future contracts** and must not be implemented until the Automation runtime boundary is approved.

### 4.3 Outbox schema (PROPOSED)

```sql
CREATE TABLE IF NOT EXISTS outbox_events (
    event_id          TEXT PRIMARY KEY,
    aggregate_type    TEXT NOT NULL,
    aggregate_id      TEXT NOT NULL,
    event_type        TEXT NOT NULL,
    payload           TEXT NOT NULL,          -- JSON, redacted
    actor_type        TEXT NOT NULL,          -- user|agent|system|automation|anonymous
    actor_id          TEXT,
    idempotency_key   TEXT NOT NULL UNIQUE,   -- dedupe key
    trace_id          TEXT,
    status            TEXT NOT NULL DEFAULT 'pending', -- pending|dispatched|failed|dead
    attempt_count     INTEGER NOT NULL DEFAULT 0,
    next_attempt_at   DATETIME NOT NULL DEFAULT (datetime('now')),
    last_error        TEXT,
    last_error_class  TEXT,                   -- retryable|permanent
    lease_owner       TEXT,
    lease_expires_at  DATETIME,
    created_at        DATETIME NOT NULL DEFAULT (datetime('now')),
    dispatched_at     DATETIME
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON outbox_events(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
    ON outbox_events(aggregate_type, aggregate_id, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_trace
    ON outbox_events(trace_id);
```

### 4.4 Write path

- The outbox insert happens **in the same SQLite transaction** as the business write.
- If the transaction rolls back, the event disappears with it. No dual-write inconsistency.
- Events are never written by a separate "audit service" that runs after the fact; they are written by the same code path that changes state.

### 4.5 Dispatcher (PROPOSED)

- An in-process dispatcher claims pending rows and invokes a registered handler.
- Claiming uses a lease: `UPDATE outbox_events SET lease_owner=?, lease_expires_at=? WHERE event_id IN (SELECT event_id FROM outbox_events WHERE status='pending' AND next_attempt_at <= datetime('now') AND (lease_expires_at IS NULL OR lease_expires_at < datetime('now')) ORDER BY created_at LIMIT ?)`.
- A single-instance deployment needs no leader election. A multi-instance deployment must use `BEGIN IMMEDIATE` or a separate `outbox_leases` table.
- Dispatch is at-least-once; **consumer idempotency is mandatory** (see §5.1).
- A failed dispatch returns the row to `pending` with a computed `next_attempt_at`, or to `dead` after max attempts.
- The dispatcher emits a metric per dispatch (`outbox_dispatch_total{result}`) and a structured log line with `trace_id`.

### 4.6 Why not an external queue

- No queue infrastructure exists, is documented as required, or is approved.
- SQLite already provides the transactional boundary the outbox needs.
- A broker adds operational surface (credentials, TLS, volume backups, alerting) with no current consumer.
- The outbox is broker-agnostic: a future `BrokerPublisher` can read the same rows without changing producers or handlers.

---

## 5. Reliability semantics

### 5.1 Idempotency

**Requirement:** every state-changing operation and every event handler must be safe to execute more than once.

Mechanisms:
1. **API idempotency key.** Mutating endpoints accept `Idempotency-Key: <uuid>`. The key is stored with a TTL (default 24h) in `idempotency_keys(key, request_hash, response_snapshot, created_at, expires_at)`. A repeated key returns the stored response without re-executing.
2. **Outbox dedupe.** `outbox_events.idempotency_key` is `UNIQUE`. A duplicate event insert is ignored or upserted.
3. **Consumer dedupe.** Handlers record processed `event_id`s in `processed_events(event_id PK, handler, processed_at)`. A handler that already processed an event returns success without side effects.
4. **Natural keys.** Where the domain has one (`commit_hash`, `checklist_id`, `connector_id`), enforce `UNIQUE` at the DB layer rather than relying on read-then-write checks.
5. **No read-then-write idempotency.** Check-then-act is not idempotent under concurrency.

**VERIFIED gap:** `importExport.service.ts` uses `INSERT OR IGNORE` plus `catch { /* Skip duplicates */ }`. This swallows **all** errors, not just duplicates, and reports inflated `imported` counts. It must be replaced with explicit `ON CONFLICT DO NOTHING/UPDATE` and per-row error reporting.

### 5.2 Retry

**PROPOSED default policy:**

| Parameter | Default |
|---|---|
| Max attempts | 8 |
| Backoff | exponential, base 1s, factor 2 |
| Max backoff | 30s |
| Jitter | ±20% full jitter |
| Per-attempt timeout | handler-specific (see §5.3) |
| Retryable classes | network error, timeout, HTTP 408, 425, 429, 5xx, SQLite `SQLITE_BUSY`/`SQLITE_LOCKED` |
| Non-retryable classes | HTTP 400/401/403/404/409/422, validation error, schema error, auth error, permission error |

Rules:
- Retry is per-event and per-handler; a retry re-runs the handler from its recorded input, not the whole workflow.
- `Retry-After` from HTTP 429/503 is honored when present and within the max backoff ceiling.
- After max attempts the row moves to `status='dead'` with `last_error`, `last_error_class='retryable'`, and a full payload snapshot.
- A dead-letter review UI/API is required before any live side-effecting action is allowed.
- Retry state must be visible: `attempt_count`, `next_attempt_at`, and a per-attempt history table (`outbox_attempts`) are required for observability.

### 5.3 Timeout

**PROPOSED defaults:**

| Handler class | Timeout | Notes |
|---|---|---|
| Default | 15s | ceiling for unknown handlers |
| Connector HTTP (GitHub, etc.) | 10s | connect + read |
| LLM provider call | 60s | configurable per model |
| Database write | 5s | fail fast, surface contention |
| Webhook delivery | 10s | honor target `Retry-After` |
| Human approval wait | 24h | not a timeout — an SLA timer that expires the gate |
| Whole execution | 15m | configurable per workflow |

Implementation: `AbortController` for all outbound `fetch`; `Promise.race` is not sufficient because it does not cancel the underlying socket. Every external call must be cancellable.

### 5.4 Cancellation

**PROPOSED:**
- Every execution/run has a `cancel_requested_by`, `cancel_requested_at`, `cancel_reason`, and `cancelled_at`.
- Cancellation is **cooperative**: the runtime checks a cancellation flag before each node and, critically, **before any side effect**.
- A side effect already committed cannot be uncancelled; the run transitions to `cancelling`, stops launching further nodes, records the partial outcome, and emits `execution.cancelled` with the list of skipped nodes.
- Human gates have an expiry timer; expiry emits `approval.expired` and is recorded as a distinct outcome, not a failure.
- Cancellation is authorized by RBAC: only the initiator, the target owner, or an admin may cancel.
- A cancelled run must be idempotent-safe to resume only via an explicit, reviewed replay (see §5.6).

### 5.5 Deduplication

Layers, in order:
1. **Producer dedupe:** `idempotency_key` on the outbox; natural `UNIQUE` constraints on domain tables.
2. **Transport dedupe:** outbox `status` + lease prevents double dispatch within a lease window.
3. **Consumer dedupe:** `processed_events(event_id)` checked before side effects.
4. **UI dedupe:** disable double-submit and use the `Idempotency-Key` header on retries.
5. **Import dedupe:** replace `INSERT OR IGNORE`/`catch` with explicit conflict policy and a per-row result report.

Dedupe is **not** the same as retry. A retried event is the same event; a duplicate event is a different event with the same natural key.

### 5.6 Ordering, replay, and dead letters

- **Ordering:** per-aggregate ordering is guaranteed by `created_at` + `event_id` sequence within a single writer. Cross-aggregate ordering is not guaranteed and must not be assumed.
- **Replay:** replay is allowed only for **non-side-effecting** nodes by default. A replay that could send, write, or change status requires an explicit reviewed mode, a new `execution_id`, and a fresh audit trail. This matches the approved UI/UX boundary in `UI_UX_REDESIGN_PLAN.md` §7.
- **Dead letters:** dead rows are retained for 30 days, then archived. A dead row must be inspectable with its payload, error, and attempt history.
- **Poison message:** a handler that fails `N` times in a row on the same payload is quarantined and alerts; it is never silently dropped.

---

## 6. Audit requirements

### 6.1 Actor model

Every audit record must answer **who** did it, in a way that survives impersonation and agent delegation.

| Field | Requirement |
|---|---|
| `actor_type` | `user` \| `agent` \| `system` \| `automation` \| `anonymous` |
| `actor_id` | user_id / agent_id / `system` / execution_id |
| `actor_display` | username or agent name, resolved at read time (never store mutable display data as the only identity) |
| `session_id` | JWT session identifier or agent token hash prefix |
| `on_behalf_of` | when an agent acts for a user, the delegating user_id |
| `api_key_fingerprint` | SHA-256 prefix (first 12 chars) of the agent key, never the key |
| `ip_address` | caller IP |
| `user_agent` | caller UA, truncated |
| `request_id` | correlation ID from the HTTP layer |
| `trace_id` | execution/run trace ID |

**VERIFIED gap:** `audit_logs` has `user_id` and `agent_id` but no `actor_type`, so a NULL `user_id` is ambiguous between "system" and "agent". This must be resolved.

### 6.2 Object model

| Field | Requirement |
|---|---|
| `target_table` | table name |
| `target_id` | primary key of the affected row |
| `target_sub_id` | PK of a nested row (checklist_item, canvas_item, connector_config, execution_step) |
| `target_parent_id` | parent aggregate for nested rows |
| `target_summary` | short human-readable label (e.g., task title), denormalized at write time |
| `project_id` | project scope for authorization checks |
| `action` | `create` \| `update` \| `delete` \| `read_sensitive` \| `login` \| `login_failed` \| `export` \| `import` \| `approve` \| `reject` \| `execute` \| `cancel` \| `migrate` \| `backup` \| `restore` |
| `trigger` | `ui` \| `api` \| `agent` \| `automation` \| `system` \| `import` \| `migration` \| `backup` |

### 6.3 Before / after

- **Create:** `old_value = NULL`, `new_value = full redacted snapshot`.
- **Update:** `old_value` and `new_value` are JSON snapshots of the row, **or** a field-level diff. Field-level diff is preferred for large rows; full snapshots are required for deletes.
- **Delete:** `old_value = full redacted snapshot`, `new_value = NULL`.
- **Read-sensitive:** both NULL; the action itself is the record.
- Snapshots must be taken **inside the same transaction** as the change.
- For large payloads, store a hash (`before_hash`, `after_hash`) plus the full value in cold storage; the audit row retains the hash and a truncated preview.
- `reasoning_summary` is required for agent/automation actions, capped at 2,000 chars, and must never contain secrets.

### 6.4 Redaction

**PROPOSED redaction classes:**

| Class | Fields | Handling |
|---|---|---|
| `secret` | passwords, API keys, tokens, JWTs, connector secrets, `password_hash`, `api_key_hash` | **never stored**; replaced with `[REDACTED]` |
| `pii` | email, device fingerprint, IP (optional), username | stored masked by default (`u***@example.com`); full value only for `owner`/`admin` with a `read_sensitive` audit record |
| `financial` | future billing/cost fields | stored masked unless role permits |
| `internal` | internal IDs, paths, stack traces | stored as-is but never returned in public APIs |

Rules:
- Redaction is applied **before** the audit row is written, not at read time.
- Redaction is also applied to `outbox_events.payload`, logs, exports, error messages, and UI previews.
- `connector_configs.value` where `is_secret = 1` must never appear in any API response, log, export, or screenshot. **VERIFIED:** `connector.service.ts` currently returns `config: JSON.parse(row.config)` in `getInstance`/`listInstances` with **no redaction**. This is a live leak path and must be fixed.
- A redaction function is a single shared module used by audit, outbox, logging, and export.
- Redaction must be testable: a unit test asserts that no known secret pattern appears in any serialized audit/outbox/log payload.

### 6.5 Immutability and retention

- Audit rows are **append-only**. There must be no `UPDATE`/`DELETE` audit routes.
- **PROPOSED:** SQLite triggers that `RAISE(ABORT, 'audit_logs is append-only')` on `UPDATE` and `DELETE`, as a defense-in-depth guard in addition to the absence of routes.
- Retention (PROPOSED): hot 90 days; archive to compressed JSON/SQLite cold store after 90 days; delete after 7 years unless a legal hold applies.
- Audit rows are never exported in bulk without a `read_sensitive` record and an owner-approved reason.
- A tamper-evidence chain (hash of previous row + current row) is **PROPOSED** but not required for the first implementation; it is required before any regulated use.

### 6.6 Coverage matrix

| Domain | Create | Update | Delete | Read-sensitive | Approve/Reject | Execute/Cancel |
|---|---|---|---|---|---|---|
| users | ✅ | ✅ | ✅ | ✅ | — | — |
| projects | ✅ | ✅ | ✅ | — | — | — |
| tasks | ✅ | ✅ | ✅ | — | — | — |
| checklists/items | ✅ | ✅ | ✅ | — | — | — |
| dependencies | ✅ | — | ✅ | — | — | — |
| comments | ✅ | ✅ | ✅ | — | — | — |
| connectors/configs | ✅ | ✅ | ✅ | ✅ | — | — |
| agents/tokens | ✅ | ✅ | ✅ | ✅ | — | — |
| approvals | ✅ | — | — | — | ✅ | — |
| executions | ✅ | — | — | — | — | ✅ |
| auth/login | — | — | — | ✅ | — | — |
| import/export | ✅ | — | — | ✅ | — | — |
| migrations | ✅ | — | — | — | — | — |
| backups | ✅ | — | ✅ | — | — | — |

`✅` = required. Today **none** of these are written.

### 6.7 Audit API contract (PROPOSED, future)

- `GET /api/audit` — filter by `actor`, `target_table`, `target_id`, `action`, `from`, `to`, `project_id`; paginated; `requireAuth` + role (`owner`/`admin`/`auditor`).
- `GET /api/audit/:log_id` — single record.
- `POST /api/audit/query` — structured query for the audit trail UI (task detail).
- **No** `POST`/`PUT`/`DELETE` for audit content.
- Every audit read by a non-owner role is itself audited (`read_sensitive`).
- Responses are redacted per §6.4.

---

## 7. Observability and alerting

### 7.1 What exists (VERIFIED)

- `/health` (real DB check) and `/api/monitoring/metrics` (counts only).
- Docker healthcheck (with the port defect in §2.7).
- `docs/monitoring-config.md` alert rules — documentation only.

### 7.2 Metrics to add (PROPOSED)

Counters:
- `http_requests_total method, route, status`
- `http_request_duration_seconds` (histogram)
- `db_query_duration_seconds` (histogram)
- `outbox_events_total event_type, status`
- `outbox_dispatch_total result`
- `outbox_attempts_total handler, result`
- `execution_total outcome, workflow`
- `execution_step_total outcome, node_type`
- `approval_total outcome`
- `audit_write_total result`
- `backup_total result`
- `migration_total result`
- `connector_call_total provider, action, result`

Gauges:
- `outbox_depth` (pending count)
- `outbox_oldest_pending_seconds`
- `execution_active`
- `approval_queue_depth`
- `db_size_bytes`
- `db_freelist_bytes`
- `backup_age_seconds`
- `migration_version`
- `process_heap_bytes`, `process_uptime_seconds`

Metrics are exposed at `/api/monitoring/metrics` (existing) and optionally `/metrics` in Prometheus text format when `METRICS_FORMAT=prometheus` is set. No external metrics backend is assumed.

### 7.3 Logging (PROPOSED)

- Structured JSON to stdout: `timestamp`, `level`, `request_id`, `trace_id`, `actor_type`, `actor_id`, `event`, `duration_ms`, `status`, `error_class`, `message`.
- Levels: `error`, `warn`, `info`, `debug`.
- **No secrets, tokens, passwords, or full connector configs in logs** (enforced by the shared redaction module).
- One log line per request (access log) and one per outbox dispatch.
- `backend/server.log` is currently plain text and npm-noise; it must be replaced by structured output.

### 7.4 Tracing (PROPOSED)

- `request_id` generated at the edge, propagated through services.
- `trace_id` per execution/run, propagated through every step.
- Each execution step emits a span: `step_id`, `node_type`, `started_at`, `ended_at`, `outcome`, `error_class`, `attempt`.
- A trace viewer is a UI requirement, not a backend runtime requirement.

### 7.5 Alert rules (PROPOSED)

| Alert | Condition | Severity | Action |
|---|---|---|---|
| `health_down` | `/health` not ok for > 2 min | critical | page on-call |
| `http_5xx_rate` | 5xx rate > 1% over 5 min | warning | notify channel |
| `http_latency_p95` | p95 > 1s over 5 min | warning | notify channel |
| `outbox_backlog` | pending > 500 or oldest pending > 5 min | critical | page on-call |
| `outbox_dead_letter` | any row → `dead` | critical | page on-call |
| `outbox_dispatch_failure_rate` | > 5% over 10 min | warning | notify channel |
| `execution_failure_rate` | > 5% over 10 min | warning | notify channel |
| `execution_stuck` | active > 15 min with no step progress | critical | page on-call |
| `approval_sla_breach` | approval pending > 24 h | warning | notify channel |
| `audit_write_failure` | any audit write fails | critical | page on-call |
| `backup_missing` | no successful backup in 26 h | critical | page on-call |
| `backup_failed` | any backup failure | warning | notify channel |
| `db_size_anomaly` | size > 2× previous day | warning | notify channel |
| `disk_high` | disk > 80% | warning | notify channel |
| `migration_failure` | any migration fails | critical | page on-call |
| `connector_error_rate` | > 10% over 10 min | warning | notify channel |

Alert routing: webhook → channel; critical → paging integration. No paging integration exists today and none is approved; until one is approved, alerts are logged and surfaced in a `/api/monitoring/alerts` endpoint plus a dashboard.

### 7.6 Dashboards (PROPOSED)

- System: health, request rate, error rate, latency, DB size, disk.
- Data: outbox depth/age, dispatch rate, dead letters.
- Automation (future): executions, step outcomes, approval queue.
- Audit: events by actor/target/action, redaction hits, read-sensitive accesses.
- Backups: last success, age, size, verification status.

---

## 8. Required future contracts

These are **not implemented** and require approval before build. Each is listed with its contract, not its implementation.

### 8.1 Migration contract
- `schema_migrations` table, versioned `migrations/*.sql`, runner with checksum + dry-run, CI step, Docker entrypoint step, rollback procedure.
- Fix `TS5096` before any of this can run in production.

### 8.2 Event/outbox contract
- `outbox_events`, `outbox_attempts`, `processed_events`, `idempotency_keys` tables.
- Dispatcher service, handler registry, retry policy, dead-letter store, outbox admin API (`GET /api/outbox`, `POST /api/outbox/:id/retry`, `POST /api/outbox/:id/dead`).

### 8.3 Reliability contract
- Idempotency-key middleware for mutating endpoints.
- Per-handler timeout and retry configuration.
- Cancellation API (`POST /api/executions/:id/cancel`) — future, automation only.
- Replay API (`POST /api/executions/:id/replay`) — future, automation only, restricted to non-side-effecting nodes by default.

### 8.4 Audit contract
- Audit write service with actor/object/before-after/redaction.
- Append-only enforcement (no update/delete routes; triggers).
- Audit read API with role-based redaction.
- Coverage matrix tests (every row in §6.6 must produce a row in `audit_logs`).
- Retention/archive job.

### 8.5 Automation data contract (DECISION-REQUIRED — do not build until approved)
- `workflows`, `workflow_versions`, `workflow_environments`, `executions`, `execution_steps`, `approvals`, `human_gates`, `environments`, `credential_references`.
- Versioning, publish/pause/archive states, test-mode isolation, replay constraints.
- Credential references must point to a secret store; secrets must never be in the workflow payload.

### 8.6 Agent schema contract
- Resolve the `agents.expires_at` / `agent_tokens` drift found in §2.7. Either add the columns/table via migration or correct the service. Agent registration/login is currently broken.

### 8.7 Security contract
- Connector secret redaction in all API responses, logs, exports, and UI.
- RBAC enforcement on every route (currently only `requireAuth` on most routes; `requireRole` exists but is not applied consistently).
- Agent token rotation and expiry.

### 8.8 Observability contract
- Metrics middleware, structured logging, trace propagation.
- Alert sink + dashboard.
- Backup verification (checksum + restore test) and a scheduled backup (CI `schedule:` or external scheduler).

### 8.9 Test contract
- Migration tests (apply, idempotency, checksum drift, rollback).
- Outbox tests (atomic write, dedupe, retry, dead letter, timeout, cancellation).
- Audit tests (coverage matrix, redaction, append-only, actor resolution).
- Reliability tests (idempotency-key replay, duplicate event, poison message).
- Observability tests (metric emission, alert evaluation).

---

## 9. Exists vs. must be approved / built

| Capability | Exists today (VERIFIED) | Must be approved / built |
|---|---|---|
| SQLite schema (18 tables) | ✅ `schema.sql` + live DB | Keep as fresh-install source of truth |
| Migration runner | ❌ empty `migrations/` dir; `migrate.ts` is a no-op | ✅ versioned runner + `schema_migrations` |
| Schema version tracking | ❌ none | ✅ required |
| Audit table | ✅ `audit_logs` (0 rows) | Schema extension (actor_type, trace_id, hashes) |
| Audit writer | ❌ none | ✅ audit service + redaction |
| Audit API | ❌ none | ✅ read API, no write API |
| Agent activity table | ✅ `agent_activities` (0 rows) | Writer + API, or deprecate |
| Agent auth schema | ⚠️ code/DB drift (`expires_at`, `agent_tokens`) | ✅ fix via migration |
| Backup service/API/scripts | ✅ manual only | Scheduled backup, verification, off-host copy |
| Restore | ✅ script | Tested restore procedure + DB rollback |
| Health endpoint | ✅ `/health` (monitoring router) | Remove/fix static `/health` in index/server |
| Metrics endpoint | ✅ counts only | ✅ full metric set |
| Alerting | ❌ docs only | ✅ pipeline + sink |
| Structured logging | ❌ plain text | ✅ JSON logs + redaction |
| Tracing | ❌ none | ✅ request_id / trace_id |
| Outbox/events | ❌ none | ✅ transactional outbox |
| Queue/worker | ❌ none | ✅ dispatcher (in-process) |
| Retry/backoff | ❌ none | ✅ policy + `outbox_attempts` |
| Timeout/cancellation | ❌ none | ✅ AbortController + cancel API |
| Idempotency | ⚠️ `INSERT OR IGNORE` in import only | ✅ API keys, outbox dedupe, consumer dedupe |
| Deduplication | ⚠️ best-effort, swallows errors | ✅ explicit conflict policy |
| Automation runtime | ❌ none (preview-only UI) | ⛔ **DECISION-REQUIRED** |
| Approval workflow | ❌ none | ⛔ **DECISION-REQUIRED** |
| RBAC enforcement | ⚠️ middleware exists, not consistently applied | ✅ per-route enforcement |
| Connector secret redaction | ❌ leaks in API responses | ✅ required |
| Backend production build | ❌ TS5096 | ✅ required before Docker/migrations |
| Docker healthcheck | ⚠️ port mismatch | ✅ fix |

---

## 10. Open decisions (owner gates)

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Approve the transactional-outbox strategy (no external broker) | Approve as specified in §4 |
| D2 | Approve the migration runner contract and `schema_migrations` | Approve as specified in §3 |
| D3 | Approve the audit actor/object/redaction contract | Approve as specified in §6 |
| D4 | Approve the reliability policy (retry/timeout/cancellation/idempotency) | Approve as specified in §5 |
| D5 | Approve the observability metric/alert set and the alert sink | Approve metrics; defer paging sink |
| D6 | Fix `TS5096` and the Docker healthcheck port before any migration work | Approve |
| D7 | Resolve `agents.expires_at` / `agent_tokens` drift | Approve |
| D8 | Connector secret redaction | Approve — required before any live connector use |
| D9 | Automation runtime boundary (preview-only / test-only / live) | **Not decided** — do not build |
| D10 | Approval workflow boundary | **Not decided** — do not build |
| D11 | Audit retention period and legal hold policy | Owner + legal |
| D12 | Backup off-host destination and RPO/RTO | Owner + DevOps |

---

## 11. Acceptance criteria for PM-P2-03

The card is complete when:

1. This strategy is reviewed and D1–D8 are recorded.
2. The exists/must-be-built table in §9 is confirmed against the working tree.
3. A follow-up implementation card is created for the migration runner, outbox, audit writer, and observability — each as a separate, approvable work item.
4. No migration, event, audit, or automation code is written by this card.
5. The `TS5096` build defect is logged as a blocking prerequisite for any production migration.
6. The automation runtime is **not** assumed anywhere in the implementation plan.

---

## 12. Evidence index

| Evidence | Path / command | Result |
|---|---|---|
| Schema file | `backend/src/database/schema.sql` | 18 tables, `IF NOT EXISTS` only |
| Live DB | `backend/data/app.db` | 18 tables; `audit_logs` 0 rows; `agent_activities` 0 rows |
| DB integrity | `PRAGMA quick_check` | `ok` |
| Migrations dir | `backend/src/database/migrations/` | empty |
| Migration entrypoint | `backend/src/database/migrate.ts` | calls `getDb()` only |
| Package scripts | `backend/package.json` | `db:migrate`, `db:seed`, `db:reset`; seed/reset files absent |
| Audit writer scan | regex over `backend/src/**/*.{ts,js,sql}` | only `schema.sql` mentions `audit` |
| Audit columns | `PRAGMA table_info(audit_logs)` | 12 cols; no actor_type/trace_id |
| Agent schema drift | `agentAuthService.ts` vs `PRAGMA table_info(agents)` | `expires_at` and `agent_tokens` missing |
| Backup service | `backend/src/services/backup.service.ts` | file copy + PASSIVE checkpoint |
| Backup API | `backend/src/routes/backup.routes.ts` | manual only |
| CI schedule | `.github/workflows/ci-cd.yml` | no `schedule:` |
| Monitoring | `backend/src/services/monitoring.service.ts` | health + counts only |
| Alerting | `docs/monitoring-config.md` | documentation only |
| Automation UI | `frontend/src/pages/AutomationStudio.tsx` | preview-only, no `fetch` |
| Review queue | `frontend/src/pages/ReviewQueue.tsx` | real task fetch; approvals disabled |
| Route registration | `backend/src/index.ts`, `server.ts` | no automation/audit/event routes |
| Backend build | Phase 1 pack; `backend/tsconfig.json` | TS5096 failure |
| Docker port | `docker-compose.yml` vs `server.ts` | `PORT=4000` vs `NODE_PORT\|\|3000` |
| Connector leak | `backend/src/services/connector.service.ts` | `config` returned unredacted |
| Import dedupe | `backend/src/services/importExport.service.ts` | `INSERT OR IGNORE` + `catch {}` |
| UI/UX boundary | `UI_UX_REDESIGN_PLAN.md` §7 | replay restricted; no runtime approved |

---

*Prepared as a Phase 2 read-only planning artifact. This document authorizes no implementation, no schema change, no migration, and no automation runtime.*
