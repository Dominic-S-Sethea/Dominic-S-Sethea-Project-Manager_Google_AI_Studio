# ChatGPT Code-Generation Prompt — Automation Event Ingestion & Execution Orchestration (Detailed)

**Paste this entire document into ChatGPT regular chat.**
**Do NOT shorten it. Do NOT ask clarifying questions. Return complete replacement files.**

---

## 0. Your role and output contract

You are generating a production backend patch for an existing Express 4 + TypeScript + SQLite (`node:sqlite`) application.

- Return **complete replacement files** for every file listed in §8.
- Do **not** return snippets, diffs, or "here is the changed part".
- Do **not** change any file that is not listed in §8.
- Do **not** add dependencies.
- Do **not** run git, commits, or pushes.
- Do **not** invent APIs, tables, or environment variables.
- If something in this prompt is ambiguous, choose the **most conservative** interpretation that preserves existing behavior and state it in your final notes.

Your output must be a single response with:
1. A short summary of the approach.
2. Complete file contents, each in its own fenced code block with a header line like `FILE: backend/src/services/eventIngestion.service.ts`.
3. A final "Verification checklist" section.

---

## 1. Project context

**Application:** Project Manager
**Repository root:** `<workspace>`
**Stack:**
- Backend: Express 4 + TypeScript (NodeNext, strict, `noUncheckedIndexedAccess`), `tsx` for dev, `tsc` for build/typecheck.
- Database: SQLite via `node:sqlite` (`DatabaseSync`), type declarations from `@types/node`.
- Auth: JWT in `Authorization: Bearer ...` via `requireAuth` (attaches `req.user`).
- Test runner: `node:test` + `supertest`.
- Import style: `import x from "y.ts"` with `.ts` extensions (NodeNext).

Relevant backend structure:
```
backend/src/
  database/
    schema.sql
    migrate.ts
    index.ts
  middleware/
    auth.middleware.ts
  services/
    monitoring.service.ts          # style reference
    projectAccess.service.ts       # style reference
    (other domain services)
  routes/
    monitoring.routes.ts           # style reference
    (other domain routes)
  tests/
    backend.test.ts
    canvas.contract.test.ts
  env.ts
  index.ts
  server.ts
  package.json
  tsconfig.json
```

---

## 2. Approved design decisions (binding)

These are already approved by the project owner (recorded in `PHASE4_AUTOMATION_SPEC_APPROVAL_PACKAGE.md` AD-01..AD-18 and `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md`). Implement exactly.

### 2.1 Runtime boundary — AD-01 preview-only (owner-confirmed 2026-11-10)

- The Automation Studio runtime is **preview-only**. **No live side effects.**
- **No live connector call, no live HTTP write, no task/project mutation, no message send, no live credential use.** Connector actions are simulated.
- Every execution is marked `preview = true`.
- The preview executor simulates `action` nodes and records a "would-perform" trace (action descriptor + credential-reference pointer; never the secret).
- The Automation Studio UI keeps the "Preview only · no runtime connected" notice, disabled Publish/Execute, and sample-data labels.
- **This card builds the machinery (event ingest → outbox → orchestration → trace) so execution behavior is observable and bounded, NOT live.**

### 2.2 Event source & topology — AD-09 / AD-10 / AD-11

- Single-host SQLite; **no external broker**.
- **Transactional outbox:** the outbox insert happens in the same SQLite transaction as the business write.
- **No scheduled triggers** in this card.

### 2.3 Reliability defaults (PHASE2_03 §5.2)

| Parameter | Default |
|---|---|
| Max attempts | 8 |
| Backoff | exponential, base 1s, factor 2 |
| Max backoff | 30s |
| Jitter | ±20% full jitter |
| Retryable | network error, timeout, HTTP 408/425/429/5xx, SQLite SQLITE_BUSY/SQLITE_LOCKED |
| Non-retryable | HTTP 400/401/403/404/409/422, validation, schema, auth, permission |

- Honor `Retry-After` from 429/503 within the max backoff ceiling.
- After max attempts → `status='dead'`, `last_error`, `last_error_class='retryable'`, full payload snapshot.
- Retry is per-event and per-handler; a retry re-runs the handler from its recorded input, not the whole workflow.

### 2.4 Timeouts (PHASE2_03 §5.3)

| Handler class | Timeout |
|---|---|
| Default | 15s |
| Connector HTTP | 10s |
| LLM provider | 60s |
| Database write | 5s |
| Webhook delivery | 10s |
| Whole execution | 15m (configurable) |

All outbound `fetch` use `AbortController` (not `Promise.race`, which does not cancel the underlying socket).

### 2.5 Cancellation (PHASE2_03 §5.4)

- Cooperative: check a cancellation flag before each node and **before any side effect**.
- Execution carries `cancel_requested_by`, `cancel_requested_at`, `cancel_reason`, `cancelled_at`.
- A committed side effect cannot be uncancelled; the run transitions to `cancelling`, stops launching further nodes, records the partial outcome, and emits `execution.cancelled` with the skipped nodes.

### 2.6 Idempotency & deduplication (PHASE2_03 §5.1/5.5)

- API `Idempotency-Key` header on mutating endpoints; stored in `idempotency_keys(key, request_hash, response_snapshot, created_at, expires_at)` with 24h TTL.
- Outbox `idempotency_key` UNIQUE (dedupe key).
- Consumer dedupe via `processed_events(event_id PK, handler, processed_at)`.
- Natural keys enforced at the DB layer.
- No read-then-write idempotency (check-then-act is not idempotent under concurrency).

### 2.7 Dead letters (PHASE2_03 §5.6)

- Dead rows retained 30 days, then archived; inspectable with payload, error, and attempt history.
- A handler failing N times in a row on the same payload is quarantined and alerts; never silently dropped.

### 2.8 Credentials & redaction

- Credential references only; secrets never in events, traces, logs, or API responses.
- Redact event payloads **before** writing to the outbox/traces. A conservative local redactor is acceptable in this card; the full policy is a separate card.

### 2.9 No implied runtime (PHASE4 §12)

- Do not register any API route, service, or UI that implies live execution.
- Do not modify Canvas tables or the Automation Studio preview.
- Do not add secrets, credentials, or live agents to anything.

---

## 3. Assumed PM-P7-01 contracts (do not redefine; created by sibling card PM-P7-01)

PM-P7-01 creates, and this card assumes, the automation data model (full DDL per `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md §4.1-4.9`). This card adds its own tables for the outbox boundary.

**Assumed existing tables** (restated for context):

- `workflows(workflow_id PK, name, definition_json, project_id NOT NULL, status, created_by, created_at, updated_at)` — project-scoped.
- `workflow_versions(version_id PK, workflow_id NOT NULL, version INTEGER, definition_json, created_by, created_at, updated_at)` — immutable versions; `version` UNIQUE per workflow.
- `workflow_nodes(node_id PK, version_id NOT NULL, node_type, config_json, order_index, created_at, updated_at)` — trigger, transform, decision, action, human_gate, error_handler.
- `workflow_edges(edge_id PK, version_id NOT NULL, from_node_id, to_node_id, condition_json, order_index)`.
- `environments(environment_id PK, name, project_id NOT NULL, type, config_json, created_at)`.
- `executions(execution_id PK, workflow_id NOT NULL, version_id NOT NULL, environment_id NOT NULL, status, trigger_type, trigger_actor_type, trigger_actor_id, idempotency_key UNIQUE, trace_id, approval_id, attempt_count, error_class, error_message, started_at, completed_at, cancel_requested_by, cancel_requested_at, cancel_reason, cancelled_at, created_at)` — PHASE4 §4.5.
- `execution_steps(step_id PK, execution_id NOT NULL, node_id NOT NULL, node_type, attempt, status, input_json, output_json, credential_reference_id, idempotency_key, started_at, ended_at, duration_ms, error_class, error_message, created_at)` — PHASE4 §4.6.
- `idempotency_keys(key PK, request_hash, response_snapshot, created_at, expires_at)` — PHASE4 §4.9.
- `approvals(approval_id PK, execution_id, step_id, workflow_id, version_id, approval_type, status, requested_by_type, requested_by_id, requested_at, reviewer_id, decided_at, decision_note, expires_at, idempotency_key UNIQUE, created_at)` — PHASE4 §4.7.

**PM-P7-02's own tables:**
- `outbox_events` (PHASE2_03 §4.3) — see §5.7.
- `outbox_attempts` (per-attempt history).
- `processed_events(event_id PK, handler, processed_at)` (consumer dedupe).

---

## 4. Current code facts you must respect

### 4.1 `backend/src/database/schema.sql`
- SQLite schema; `CREATE TABLE IF NOT EXISTS` everywhere; `INSERT OR IGNORE` backfills; owner-membership trigger.
- Do **not** remove or rename existing tables or columns.
- Your new tables (§5.7) are **appended** to this file.

### 4.2 `backend/src/database/migrate.ts`
- Runs schema initialization; registers SIGINT close. **You** must add a `runMigrations()` function that executes the versioned migrations in `backend/src/database/migrations/` in order (PM-P7-01 owns the `migrations/` directory; this card adds `002_automation_outbox.sql` and calls the runner).

### 4.3 `backend/src/database/index.ts`
- `getDb()` singleton; PRAGMA journal_mode=WAL; foreign_keys=ON; applies `schema.sql` on first connection.

### 4.4 `backend/src/server.ts` / `backend/src/index.ts`
- Express app; security middleware (`configureSecurity`); body parsing; rate limits (`authLimiter` for `/api/auth`, `apiLimiter` for `/api`); route mounting per file; `/health`; 404; error handler; DB init on startup; SIGINT/SIGTERM close.
- `index.ts` is the **test entry point** (exports `app`, `getDb`, `closeDb`). `server.ts` boots Vite dev server in dev / static in prod.
- **Register `/api/automation` router in both `index.ts` and `server.ts`. In `server.ts`, start the in-process outbox dispatcher and run migrations at startup.**

### 4.5 `backend/src/middleware/auth.middleware.ts`
- `requireAuth` attaches `req.user = { user_id, email, role }`. Use it (and `requireRole`) on mutating endpoints.

### 4.6 Style references
- `backend/src/services/monitoring.service.ts` — parameterized queries, `get`/`all`, try/catch → structured error responses.
- `backend/src/services/projectAccess.service.ts` — project-scoped RBAC, creator-is-owner, `users.role` never consulted.
- `backend/src/routes/monitoring.routes.ts` — `Router()`, `router.get/post`, `requireAuth` guards, `res.json({...})` / `res.status(...).json(...)`.

### 4.7 `backend/package.json` / `backend/tsconfig.json`
- `type: "module"`, `build: tsc`, `typecheck: tsc -p tsconfig.typecheck.json --noEmit`, `test: node --test src/tests/`.
- **Do not** add dependencies.

---

## 5. Required implementation

### 5.1 `backend/src/services/eventIngestion.service.ts`
Ingest an event and write its outbox row in the same SQLite transaction as any business write.

```ts
export type ActorType = "user" | "agent" | "system" | "automation" | "anonymous";
export interface IngestEventInput {
  aggregateType: string;      // project|task|checklist|comment|dependency|connector|execution|approval|automation
  aggregateId: string;
  eventType: string;          // aggregate.verb, past tense
  payload: unknown;           // redacted + JSON-serialized
  actorType: ActorType;
  actorId?: string;
  idempotencyKey?: string;    // derived if absent
  traceId?: string;
  occurredAt?: string;        // ISO 8601 UTC
}
export interface IngestEventResult {
  eventId: string;
  status: "accepted" | "duplicate";
  idempotencyKey: string;
  event: OutboxEvent;         // the written row
}
export function ingestEvent(input: IngestEventInput): IngestEventResult;
export function ingestEvents(inputs: IngestEventInput[]): IngestEventResult[];
```

Requirements:
- Derive `idempotencyKey` if absent: `eventType + ":" + aggregateType + ":" + aggregateId + ":" + deterministic-hash(canonicalJson(payload))` (deterministic, not timing-sensitive; UUID fallback acceptable).
- `event_id`, `event_type`, `created_at` defaults set by SQL (`datetime('now')`).
- Redact `payload` before serialization (§2.8), then store the redacted JSON in the `payload` TEXT column.
- `status` defaults `'pending'`; `next_attempt_at` defaults `datetime('now')`.
- Return `status: "duplicate"` and the existing row when the `idempotency_key` already exists (insert ignored/upserted); do not throw.
- Provide lower-level `recordOutboxEvent(db, input)`: inserts into `outbox_events` within the **caller's existing transaction**. Domain services call this inside `db.exec("BEGIN") -> ... -> db.exec("COMMIT")`.

### 5.2 `backend/src/services/outbox.service.ts`
Lease-based outbox dispatcher (in-process).

```ts
export interface OutboxEvent { ... }   // the outbox_events row + event_id
export interface DispatchSummary { dispatched: number; failed: number; dead: number; }
export const OUTBOX_MAX_ATTEMPTS = 8;
export const OUTBOX_MAX_BACKOFF_MS = 30_000;
export function claimPendingEvents(db, limit: number): OutboxEvent[];
export function dispatchEvent(db, event, handler, attemptHistory): Promise<DispatchResult>;
export function startDispatcher(options?: { intervalMs?: number; limit?: number }): { stop: () => void };
export function getOutboxStats(db): { pending, dispatched, failed, dead, total };
export function listDeadLetters(db, limit: number): OutboxEvent[];
```

Requirements:
- Claim lease: `UPDATE outbox_events SET lease_owner=?, lease_expires_at=? WHERE event_id IN (SELECT event_id FROM outbox_events WHERE status='pending' AND next_attempt_at <= datetime('now') AND (lease_expires_at IS NULL OR lease_expires_at < datetime('now')) ORDER BY created_at LIMIT ?)` — single-row claim; set `dispatched_at`.
- `dispatchEvent`: mark dispatched; run handler; on success mark `dispatched` and record an `outbox_attempts` row (ok). On retryable failure, increment `attempt_count`, compute `next_attempt_at` (exp backoff + ±20% jitter, capped 30s), return row to `pending`, record the attempt. On non-retryable failure, set `last_error` + `last_error_class='permanent'`, keep `pending` (no retry). After `OUTBOX_MAX_ATTEMPTS`, set `status='dead'`, `last_error_class='retryable'`, snapshot `payload` + `error_message`.
- Consumer dedupe: `processed_events` checked **before** invoking the handler; on success record `event_id` (idempotent insert).
- `startDispatcher` loop: every `intervalMs` (default 1000ms), claim `limit` (default 5), dispatch each. Cancellable stop handle. Single-instance (no leader election).
- Structured log line per dispatch with `trace_id`; metric counters per dispatch (`outbox_dispatch_total{result}`).
- Timeouts: each handler call wrapped in `AbortController` with the handler-class timeout (default 15s); a timeout is retryable.

### 5.3 `backend/src/services/idempotency.service.ts`
```ts
export function pruneExpiredIdempotencyKeys(db): number;
export async function withIdempotency<T>(
  db: DatabaseSync,
  key: string,
  requestHash: string,
  handler: () => Promise<T>,
  valueSerializer: (value: T) => string,
): Promise<{ result: T; reused: boolean; wasDuplicate: boolean }>;
```

Requirements:
- Idempotency keys stored in `idempotency_keys` with 24h TTL.
- `withIdempotency`: `INSERT ... ON CONFLICT(key) DO NOTHING` then `SELECT`. If a row exists:
  - same `request_hash` → return stored `response_snapshot` (`reused=true`).
  - different `request_hash` → throw `new IdempotencyError("IDEMPOTENCY_KEY_REUSED", 409)`.
- Never read-then-write: `INSERT ... ON CONFLICT` (atomic).
- `pruneExpiredIdempotencyKeys` deletes rows with `expires_at < datetime('now')`.

### 5.4 `backend/src/services/execution.service.ts`
```ts
export interface StartExecutionInput {
  workflowId: string; versionId: string; environmentId: string;
  triggerType: "event" | "manual" | "retry" | "replay";
  triggerActorType: "user" | "agent" | "system" | "automation";
  triggerActorId?: string;
  idempotencyKey?: string;
  traceId?: string;
}
export function startExecution(db, input): Execution;
export function runExecution(db, executionId): Promise<Execution>;
export function cancelExecution(db, executionId, requestedBy: string, reason?: string): Execution;
export function getExecution(db, executionId): Execution | null;
export function getExecutionTrace(db, executionId): ExecutionStep[];
export function listExecutions(db, filter): Execution[];
```

Requirements (execution state machine per PHASE4 §4.10):
- `startExecution`:
  - Atomic insert of the execution + one `execution_step` per node (topological order from `workflow_edges`), `node_id`, `node_type`, `status='pending'`, `idempotency_key` (per-step dedupe), `started_at`/`ended_at` NULL. Register `executions.idempotency_key UNIQUE`.
  - Return the created execution.
- `runExecution`:
  - `status='pending'` → `running`; set `started_at`.
  - For each step in topological order: cooperative check — if `execution.cancelled_at` is set, mark step `cancelled`, record `cancelled_at`, stop launching further nodes; collect `skipped_nodes`.
  - Execute the node via `previewExecutor.executeStep(db, step, execution, payload, traceId, cancelSignal)` (§5.5). On success: step `succeeded`, record `output_json`, `ended_at`, `duration_ms`.
  - Retryable error: increment global `attempt_count`, mark step `failed` (`error_class='retryable'`), retry the same step (up to 8 attempts, exp backoff, 15s per-step timeout). After max attempts → `failed`, `error_class='retryable'`, `completed_at`.
  - Non-retryable error: step `failed`, `error_class='permanent'`, stop execution (`failed`).
  - Whole-execution timeout 15m via AbortController; if exceeded, mark `timed_out` and cancel all pending steps.
  - Completion: `status='succeeded'`, `completed_at`.
- `cancelExecution`: set cancel fields. Only the initiator, the target owner, or an admin may cancel (full RBAC policy is PM-P7-03; this card records the requested authority and returns 403 on unauthorized). 
- Preview guard (§2.9): every node execution goes through the preview executor; no live side effects.
- Observability: step records, attempt counts, durations, redacted error messages.

### 5.5 `backend/src/services/previewExecutor.service.ts`
Preview-only node execution. **No live side effects.**
```ts
export interface StepContext {
  db: DatabaseSync;
  step: ExecutionStep;
  execution: Execution;
  payload: unknown;       // redacted input
  traceId: string;
  cancelSignal: { aborted: boolean };
}
export interface StepResult { output: unknown; outputJson: string; durationMs: number; }
export function executeStep(db, step, execution, payload, traceId, cancelSignal): Promise<StepResult>;
export function getNodeHandlers(): Map<string, (ctx: StepContext) => Promise<unknown>>;
```

Node behaviors:
- `trigger`: no-op; returns the incoming event payload.
- `transform`: return `config.transform(payload)` (pure); no side effect.
- `decision`: evaluate `config.condition(payload)` → route to the edge whose `condition_json` matches; no side effect.
- `action`: **simulated only**. Return a descriptor `{ action: "simulated", connector: config.connector, operation: config.operation, credential_reference_id: config.credentialReferenceId, wouldPerformAt: now }`. Never calls the connector, never sends HTTP, never mutates tasks/projects. Record the descriptor in `step.output_json`.
- `human_gate`: create a synthetic approval record (`status: pending`, reviewer `null`); set `execution.status='awaiting_approval'` and record the `approval_id` on the execution. No notification sent (approval policy is PM-P7-03). No live side effects.
- `error_handler`: inspect `error_class` and route to the `error` edge; no side effect.
- All handlers: respect `cancelSignal.aborted` before any work (even simulated work) and before any node that could have side effects.
- A `if (execution.preview !== true) throw new Error("preview-only")` guard in `executeStep` (defense in depth).

### 5.6 `backend/src/routes/automation.routes.ts`
Base path `/api/automation`; `requireAuth` on all routes.

- `POST /events` — ingest an event (JsonBody + `Idempotency-Key` header). Calls `eventIngestion.ingestEvent`. Returns `{ event }`.
- `GET /outbox` — list outbox events (redacted payload).
- `GET /outbox/dead` — dead-letter list.
- `POST /outbox/:eventId/retry` — retry a dead letter (re-dispatch).
- `POST /executions` — start an execution (`Idempotency-Key` header; `withIdempotency`); returns `{ execution }`.
- `GET /executions` — list (query: workflowId, projectId, status, environmentId).
- `GET /executions/:id` — get.
- `GET /executions/:id/trace` — full step trace.
- `POST /executions/:id/cancel` — cancel (records requester).
- `GET /stats` — outbox + execution stats.

Auth: `requireAuth` (authentication). Project scoping by `project_id` on `workflows`/`environments` — the full permission matrix is PM-P7-03's; this card enforces `requireAuth` and a conservative project-existence check (404 if the workflow/project is missing, 403 if the caller is not a member — future enhancement).

### 5.7 `backend/src/database/migrations/002_automation_outbox.sql`
Append-only DDL (IF NOT EXISTS):
```sql
CREATE TABLE IF NOT EXISTS outbox_events (
  event_id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,            -- redacted JSON
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  trace_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NOT NULL DEFAULT (datetime('now')),
  last_error TEXT,
  last_error_class TEXT,
  lease_owner TEXT,
  lease_expires_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  dispatched_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON outbox_events(aggregate_type, aggregate_id, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_trace ON outbox_events(trace_id);

CREATE TABLE IF NOT EXISTS outbox_attempts (
  attempt_id TEXT PRIMARY KEY,
  outbox_event_id TEXT NOT NULL REFERENCES outbox_events(event_id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,             -- ok | retryable | permanent | dead
  started_at DATETIME NOT NULL DEFAULT (datetime('now')),
  ended_at DATETIME,
  duration_ms INTEGER,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  handler TEXT NOT NULL,
  processed_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
```
Migration runner: `runMigrations()` in `migrate.ts` executes migrations in `migrations/` numerically with `db.exec(sql)`; idempotent and additive-only.

### 5.8 `backend/src/server.ts` / `backend/src/index.ts`
- `index.ts`: register `import automationRouter from "./routes/automation.routes.ts"; app.use("/api/automation", automationRouter);`
- `server.ts`: register the same router; at startup (after `getDb()`), call `runMigrations()`; start the outbox dispatcher in-process (`startDispatcher()`). Keep it cancellable via SIGINT/SIGTERM.
- No new env vars.

### 5.9 `backend/src/tests/automation.runtime.test.ts`
Node `node:test` + `supertest`, isolated on a throwaway `DB_PATH` (like `canvas.contract.test.ts`). Scenarios:
1. Ingest: duplicate idempotent event returns `status='duplicate'`; payload stored redacted (no secret shapes).
2. Outbox: pending event claimed and dispatched; `dispatched_at` set.
3. Retry: a retryable failing handler exhausts attempts → `status='dead'` with `last_error_class='retryable'` and attempt history.
4. Non-retryable: a 400-class handler fails immediately, stays `pending`, `last_error_class='permanent'`.
5. Idempotency: repeated `Idempotency-Key` + same hash → `reused=true`; different hash → 409.
6. Execution: start with an idempotency key → duplicate start returns the same execution; cancel records requester and stops launching.
7. Preview guard: a simulated `action` node returns a "would-perform" descriptor and never mutates any table.

---

## 6. Constraints
- No new dependencies.
- Keep TypeScript strict-mode compatible.
- Keep Express 4 and `node:sqlite` (`DatabaseSync`) API.
- Use `.ts` import extensions exactly as the existing code.
- Do not change Canvas tables or the Automation Studio preview.
- Do not add secrets, credentials, auth providers, or live agents.
- Do not run git/commits/pushes.
- Do not invent tables beyond §3 and §5.7.

---

## 7. Acceptance criteria
1. Event ingestion is atomic with outbox writes (same transaction).
2. Outbox lease claim + dispatch are atomic; no double dispatch in a single instance.
3. Retry with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s…) + ±20% jitter; 8 max attempts; dead-letter after exhaustion.
4. Timeouts: AbortController on outbound calls; whole-execution 15m; per-step timeouts.
5. Cooperative cancellation: no side effects launched after cancel; partial outcome recorded.
6. Idempotency: duplicate keys return stored responses; 409 on hash mismatch.
7. Execution idempotent by `executions.idempotency_key`; steps idempotent by (execution, node, attempt).
8. Preview-only: no live side effects; action nodes simulate; traces observable; executions bounded.
9. `npm run typecheck --prefix backend` exits 0.
10. `npm run build --prefix backend` exits 0.
11. `npm test --prefix backend` passes (new suite + existing).
12. No new dependencies.

---

## 8. Files to return (complete replacement code)
1. `backend/src/services/eventIngestion.service.ts`
2. `backend/src/services/outbox.service.ts`
3. `backend/src/services/execution.service.ts`
4. `backend/src/services/idempotency.service.ts`
5. `backend/src/services/previewExecutor.service.ts`
6. `backend/src/routes/automation.routes.ts`
7. `backend/src/database/migrations/002_automation_outbox.sql` (append to `schema.sql` and `migrate.ts`)
8. `backend/src/database/migrate.ts` (add `runMigrations()`)
9. `backend/src/server.ts` (register router, migrate, start dispatcher)
10. `backend/src/index.ts` (register router)
11. `backend/src/tests/automation.runtime.test.ts`

If you believe another file must change, **stop and explain why** instead of changing it.

---

## 9. Final response format
Return exactly:
```text
## Approach
<2-5 bullets>

## Files
FILE: backend/src/services/eventIngestion.service.ts
<complete file>
... (all files)

## Verification checklist
- [ ] npm run typecheck --prefix backend
- [ ] npm run build --prefix backend
- [ ] npm test --prefix backend
- [ ] Atomic ingest + outbox
- [ ] Lease claim + dispatch
- [ ] Retry/dead-letter
- [ ] Idempotency
- [ ] Execution + cancellation
- [ ] Preview guard
- [ ] No new dependencies
```

Do not include any other commentary outside that structure.

---
# Part C — Complete current source files (reference; do not edit)

FILE: backend/src/database/schema.sql
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
FILE: backend/src/database/migrate.ts
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
FILE: backend/src/database/index.ts
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

    // C-4 migration (idempotent): existing databases created from the old
    // schema lack `expires_at` on `agents` and the `agent_tokens` table.
    // Only touch items that are missing so this is safe on both fresh
    // (new schema.sql) and pre-existing (old schema) databases.
    const agentCols = db
      .prepare("PRAGMA table_info(agents)")
      .all() as { name: string }[];
    if (!agentCols.some((c) => c.name === "expires_at")) {
      db.exec("ALTER TABLE agents ADD COLUMN expires_at DATETIME;");
    }
    const tokenTable = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_tokens'",
      )
      .get() as { name: string } | undefined;
    if (!tokenTable) {
      db.exec(
        "CREATE TABLE IF NOT EXISTS agent_tokens (" +
          "token_hash    TEXT PRIMARY KEY," +
          "agent_id      TEXT NOT NULL REFERENCES agents(agent_id)," +
          "role          TEXT NOT NULL," +
          "expires_at    DATETIME," +
          "created_at    DATETIME NOT NULL DEFAULT (datetime('now'))" +
          ");",
      );
    }
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
FILE: backend/src/server.ts
```
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

  const PORT = parseInt(process.env.PORT || "3000");
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
FILE: backend/src/index.ts
```
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
FILE: backend/src/middleware/auth.middleware.ts
```
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
FILE: backend/src/services/monitoring.service.ts
```
import { getDb } from "../database/index.ts";
import fs from "node:fs";
import os from "node:os";

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  database: "connected" | "disconnected";
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    load: number[];
  };
  timestamp: string;
}

export interface Metrics {
  total_projects: number;
  total_tasks: number;
  total_users: number;
  total_canvases: number;
  tasks_by_status: Record<string, number>;
  tasks_by_priority: Record<string, number>;
  db_size_bytes: number;
}

export function getHealthStatus(): HealthStatus {
  const db = getDb();
  let dbStatus: "connected" | "disconnected" = "disconnected";
  try {
    db.prepare("SELECT 1").get();
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();

  return {
    status: dbStatus === "connected" ? "ok" : "down",
    database: dbStatus,
    uptime: process.uptime(),
    memory: {
      used: memUsage.heapUsed,
      total: totalMem,
      percentage: Math.round((memUsage.heapUsed / totalMem) * 100),
    },
    cpu: {
      load: os.loadavg(),
    },
    timestamp: new Date().toISOString(),
  };
}

export function getMetrics(): Metrics {
  const db = getDb();

  const projectCount = (db.prepare("SELECT COUNT(*) as count FROM projects").get() as any)?.count || 0;
  const taskCount = (db.prepare("SELECT COUNT(*) as count FROM tasks").get() as any)?.count || 0;
  const userCount = (db.prepare("SELECT COUNT(*) as count FROM users").get() as any)?.count || 0;
  const canvasCount = (db.prepare("SELECT COUNT(*) as count FROM canvases").get() as any)?.count || 0;

  const statusRows = db.prepare("SELECT status, COUNT(*) as count FROM tasks GROUP BY status").all() as any[];
  const tasksByStatus: Record<string, number> = {};
  for (const row of statusRows) {
    tasksByStatus[row.status] = row.count;
  }

  const priorityRows = db.prepare("SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority").all() as any[];
  const tasksByPriority: Record<string, number> = {};
  for (const row of priorityRows) {
    tasksByPriority[row.priority] = row.count;
  }

  // DB file size
  const dbPath = process.env.DB_PATH || "./data/app.db";
  let dbSize = 0;
  try {
    const stats = fs.statSync(dbPath);
    dbSize = stats.size;
  } catch {
    dbSize = 0;
  }

  return {
    total_projects: projectCount,
    total_tasks: taskCount,
    total_users: userCount,
    total_canvases: canvasCount,
    tasks_by_status: tasksByStatus,
    tasks_by_priority: tasksByPriority,
    db_size_bytes: dbSize,
  };
}

```
FILE: backend/src/services/projectAccess.service.ts
```
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
FILE: backend/src/routes/monitoring.routes.ts
```
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import * as monitoringService from "../services/monitoring.service.ts";

const router = Router();

// Health check (no auth required)
router.get("/health", (_req, res) => {
  const health = monitoringService.getHealthStatus();
  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

// Metrics (auth required)
router.get("/metrics", requireAuth, (req, res) => {
  try {
    const metrics = monitoringService.getMetrics();
    res.json({ metrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

```
FILE: backend/package.json
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
FILE: backend/tsconfig.json
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
