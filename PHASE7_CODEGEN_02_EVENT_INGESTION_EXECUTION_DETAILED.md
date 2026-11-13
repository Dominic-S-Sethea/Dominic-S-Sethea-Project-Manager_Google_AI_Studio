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
