# ChatGPT Code-Generation Prompt — Automation Studio Test Mode, Execution Traces & Safe Replay (Detailed)

**Paste this entire document into ChatGPT regular chat.**
**Do NOT shorten it. Do NOT ask clarifying questions. Return complete replacement files.**

---

## 0. Your role and output contract

You are generating a production patch for an existing TypeScript application:

- Frontend: React 19 + TypeScript + Vite + Tailwind
- Backend: Express 4 + TypeScript (CommonJS/ESM per `package.json`)
- Database: SQLite via `node:sqlite` (WAL + foreign keys, per `backend/src/database/index.ts`)
- Auth: JWT in `Authorization: Bearer ***` header (see `backend/src/middleware/auth.middleware.ts`); every automation endpoint is project-scoped and role-checked against the PM-P7-03 permission contract.

Output rules:

1. Return **complete replacement files** for every file listed in §8. For files you fully rewrite, return the complete content; for append-only additions, show the full new file with the added block clearly marked.
2. Do **not** return snippets, diffs, or "here is the changed part".
3. Do **not** change any file that is not listed in §8.
4. Do **not** add dependencies (npm install). Use only the existing dependency set.
5. Do **not** run git, commits, or pushes.
6. Do **not** invent APIs, tables, environment variables, or routes that are not described here.
7. If something in this prompt is ambiguous, choose the **most conservative** interpretation that preserves existing behavior and state it explicitly in your final notes.
8. Every file you return must type-check with `tsc -p backend/tsconfig.typecheck.json --noEmit` (exit 0) and every file you touch in the frontend must type-check with `tsc --noEmit` in `frontend/` (exit 0).

---

## 1. Project context

**Application:** Project Manager — multi-project management tool (local-first, web-hostable).

**Repository root:** `<workspace>`

**Backend structure (relevant):**
```
backend/src/
  database/
    schema.sql
    migrate.ts
    index.ts
  services/
    canvas.service.ts
    projectAccess.service.ts
    connector.service.ts
    auth.service.ts
  routes/
    canvas.routes.ts
    projects.routes.ts
    connectors.routes.ts
  tests/
    backend.test.ts
    canvas.contract.test.ts
  index.ts
  server.ts
  package.json
  tsconfig.json
  tsconfig.typecheck.json
```

**Frontend structure (relevant):**
```
frontend/src/
  pages/
    AutomationStudio.tsx
    Login.tsx
    Projects.tsx
  components/
    layout/
      Icon.tsx
    canvas/
      CanvasViewport.tsx
      CanvasItem.tsx
      PropertiesPanel.tsx
      CanvasToolbar.tsx
      ConnectionLine.tsx
  theme/
  types/
    canvas.ts
  index.css
```

**Current Automation Studio state (VERIFIED):**

- `frontend/src/pages/AutomationStudio.tsx` is a **static preview-only mock**: "Preview only · no runtime connected" (line 29), "Publish workflow" disabled (line 30), "Replay node · future" disabled (line 216), hard-coded sample data (lines 7-12, 80, 230), **no `fetch()` anywhere**, no backend routes.
- `backend/src/index.ts:37-51` and `backend/src/server.ts:41-55` register 15 route families; **none is automation** (no `/api/automation` routes).
- `backend/src/database/schema.sql` contains **no** workflow/execution/approval/environment/credential-reference tables.
- No worker, queue, scheduler, or background loop exists in `backend/src`.

---

## 2. Approved design decisions (binding)

These are already approved by the project owner and recorded in the Phase 4 Automation Specification Approval Package (`PHASE4_AUTOMATION_SPEC_APPROVAL_PACKAGE.md`) and the Runtime Contract (`PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md`). Implement them exactly.

### 2.1 Runtime boundary

- **AD-01**: The automation runtime boundary is **preview-only** and remains in force. **This card targets the test-only upgrade (Option B, `PHASE4_03:3.2`)**, which is the only boundary under which test executions, traces, and replay are meaningful.
- If the owner does **not** lift the boundary, this card is **not implemented** (no executions, no traces, no routes).
- Under the test-only upgrade:
  - The runtime can execute a workflow version **only against sample or pinned data**.
  - **No external side effects** (no live connector call, no message send, no task mutation, no HTTP write). Connector actions are **mocked**.
  - Workflow/version/execution tables exist; executions are marked for a **test environment**.
  - API: read/write workflow drafts, versions, test executions, and redacted traces. **No publish endpoint.**
  - Production run button, live Execute, live publish, and live connector side effects **remain disabled for every role**.

### 2.2 Replay policy (AD-07, PHASE4_03:8.5)

- Replay is allowed **only for non-side-effecting nodes by default**.
- A replay that could send, write, or change status requires an explicit **reviewed mode**, a **new `execution_id`**, and a **fresh audit trail**.
- Replay is **owner-only** and **disabled while the boundary is preview-only**.

### 2.3 Redaction (PHASE4_03:6; PHASE2_03:441-457)

Four redaction classes, applied **before** persistence and serialization:

| Class | Fields | Handling |
|---|---|---|
| `secret` | passwords, API keys, tokens, JWTs, connector secrets, `password_hash`, `api_key_hash`, credential `reference` values | **Never stored or returned.** Replaced with `[REDACTED]`. |
| `pii` | email, device fingerprint, IP (optional), username | Masked by default (`u***@example.com`); full value only for owner/admin with a `read_sensitive` audit record. |
| `financial` | future billing/cost fields | Masked unless role permits. |
| `internal` | internal IDs, paths, stack traces | Stored as-is but **never** returned in public APIs. |

- A single shared redaction module is used by API serialization, logging, audit, outbox, export, and error reporting.
- Redaction is applied **before** the audit row is written, not at read time; and to `outbox_events.payload`, logs, exports, error messages, UI previews, and screenshots.
- Workflow node configs, execution step inputs/outputs, and trace payloads are redacted **before persistence**.
- Provider error detail is kept only in protected diagnostics; the API returns a generic safe error with a `request_id`.
- Frontend masking is **never** the only control. Redaction must be testable by a unit test asserting no known secret pattern appears in any serialized audit/outbox/log/export payload.

### 2.4 Test-mode isolation (PHASE4_02:8; PHASE4_03:3.2)

- A test run is bound to a named **pinned dataset**; the UI displays which dataset was used.
- Test input/output previews are redacted and clearly labelled as sample/pinned.
- Test runs **never read live connector data** unless a separately authorized live health check is confirmed. Connector operations in test mode are mock/pinned responses.
- A test-mode action node shows the operation it **would** call and the pinned response it received.
- Test executions carry `environment = test`; the UI visually separates test runs from any live execution history (test runs never mutate tasks, connectors, comments, or any live domain row).
- Test runs may write only to `executions`/`execution_steps`.

### 2.5 API / endpoint inventory (PHASE4_03:9.3)

Implement **only** the endpoints needed for this card:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/automation/workflows/:id/test` | Run a test execution (test environment only) |
| GET | `/api/automation/executions` | List executions |
| GET | `/api/automation/executions/:id` | Read an execution with redacted step trace |
| POST | `/api/automation/executions/:id/replay` | Replay non-side-effecting nodes (owner only) |

Do **not** add publish, execute, cancel, approval, environment CRUD, or credential-reference endpoints (those belong to other Phase 7 cards).

### 2.6 Preview-only hard rules

1. Never imply a functioning runtime in any design, mockup, prototype, or UI text.
2. Sample/pinned data must remain visually and structurally distinct from live execution records (the current preview already uses `"Sample data"` / `"Sample test preview"` labels).
3. The inspection UI must **never be populated with fabricated live-run history**. Traces must be redacted and labelled test/pinned.

---

## 4. Objective

Implement **test mode, execution traces, per-node I/O, failure display and safe replay restrictions** for the Automation Studio, under the test-only boundary described in §2.

Target behaviour (acceptance is at §6):

1. Sample/pinned test data is formalised and clearly labelled.
2. Per-node input/output is inspected in the UI.
3. Execution/step traces are recorded for test runs and displayed redacted.
4. Failures are displayed with redacted error class and recovery path.
5. Replay is restricted to non-side-effecting nodes and is owner-only.

---

## 5. Required behaviour

### 5.1 Sample/pinned data & test-mode isolation

- Define a small library of named **pinned datasets** (e.g. `sample-01`, `sample-042`, `fail-branch`) with node input schemas and pinned step results.
- A test run binds to one pinned dataset; the UI displays the dataset name.
- Test input/output previews are redacted and clearly labelled "sample/pinned test data — not live".
- Test executions carry `environment = test` and are visually separated from live execution history.
- Connector actions in test mode are mocked. The UI shows the operation the node **would** call and the pinned response it received.

### 5.2 Execution traces

- Every test run writes an immutable `executions` record and one `execution_steps` record per node instance, plus a redacted step trace.
- `executions` columns: `execution_id`, `workflow_id`, `version_id`, `environment_id`, `status`, `trigger_type = 'test'`, `trigger_actor_type`, `trigger_actor_id`, `idempotency_key` (UNIQUE, duplicate-run guard), `trace_id`, `attempt_count`, `error_class`, `error_message` (redacted), `started_at`, `completed_at`, `created_at`.
- `execution_steps` columns: `step_id`, `execution_id`, `node_id`, `node_type`, `attempt`, `status`, `input_preview` (redacted), `output_preview` (redacted), `credential_reference_id` (reference only, never the secret), `idempotency_key`, `started_at`, `completed_at`, `duration_ms`, `error_class`, `error_message` (redacted), `created_at`.
- Redaction is applied **before** the step trace is persisted (no plaintext secrets in `input_preview`/`output_preview`).

### 5.3 Per-node I/O

- The node inspector shows, for the selected node: redacted sample input and output, the input/output schemas, and a "sample/pinned" label.

### 5.4 Failure display

- When a step fails, the failing step is highlighted; the error class (`retryable`, `permanent`, `approval_required`) and a **redacted** message are shown; the error handler's recovery path is visible.
- Widget-level errors are not carried into trace payloads.

### 5.5 Safe replay

- Replay is **disabled** for side-effecting nodes (action / human gate / error handler that mutates state). It is **enabled** for non-side-effecting nodes (trigger, transform, decision).
- Owner-only; requires confirmation; creates a **new `execution_id`** with `replayed_from` set to the source execution; **never mutates the original trace**.
- Replay is unavailable while the runtime is preview-only (the current preview must keep the "Replay node · future" disabled until the boundary is lifted).

### 5.6 API contract

- `POST /api/automation/workflows/:id/test` — run a test execution against the pinned dataset; returns the execution record (step IDs, trace_id, is_test=1). No live side effects.
- `GET /api/automation/executions` — project-scoped list (paginated, status filter).
- `GET /api/automation/executions/:id` — read an execution with the full redacted step trace. The trace is redacted server-side (never just masked in the browser).
- `POST /api/automation/executions/:id/replay` — replay non-side-effecting nodes (owner only); returns the new execution record.

### 5.7 Retention

- Execution traces: hot 90 days; archive to compressed JSON/SQLite cold store after 90 days; delete after 7 years (legal hold applies). Traces are redacted before persistence and before any export.

---

## 6. Acceptance criteria

1. `npm run typecheck --prefix backend` exits 0.
2. `npm run build --prefix backend` exits 0 with no `error TS` lines.
3. `npm test --prefix backend` exits 0 (all tests pass; new trace/redaction tests included).
4. Frontend type-check and build are clean after applying the changes.
5. Test mode **cannot** cause unapproved live side effects (no live connector call, no task mutation, no HTTP write).
6. Trace data is **redacted**; a unit test asserts no known secret pattern appears in any serialized audit/outbox/log/export payload.
7. Replay is restricted to non-side-effecting nodes and is owner-only.
8. Test runs never mutate live domain rows; the UI explicitly labels all test data as sample/pinned.

---

## 7. Files to return

The following files must be returned. You may add helper files but do not change this list's files.

**Backend**
1. `backend/src/database/schema.sql` — add `executions` and `execution_steps` tables (test-marked; `environment_id` references an `environments` row). Use the existing SQLite conventions (UUID TEXT PRIMARY KEY, `DATETIME` via `datetime('now')`, indexes).
2. `backend/src/services/automationRedaction.ts` — new shared redaction module (classes secret/pii/financial/internal; apply-before-persist rule; `[REDACTED]` placeholders; exportable so tests can assert).
3. `backend/src/services/automationTestRun.ts` — new test-run service (pinned-dataset resolution, sandboxed execution, mock connectors, duplicate-run guard via idempotency key, records executions + execution_steps).
4. `backend/src/services/automationTrace.ts` — new trace service (list executions, read execution with redacted step trace, replay non-side-effecting nodes).
5. `backend/src/routes/automation.routes.ts` — new route file exposing the three endpoints from §2.5.
6. `backend/src/tests/automationTrace.test.ts` — new test file: redaction unit test, duplicate-run guard, test-mode isolation (no live connector), trace redaction assertions.

**Frontend**
7. `frontend/src/pages/AutomationStudio.tsx` — add test-run controls (run test, view trace, replay gating), selected-node I/O display, failure display, and safe replay restrictions; keep the "Preview only · no runtime connected" label accurate until the boundary is lifted.
8. `frontend/src/types/automation.ts` — shared types (`Execution`, `ExecutionStep`, `Trace`, `ReplayPolicy`, `PinnedDataset`).

---

## 8. Constraints

- Do **not** implement live execution, publish, human approvals, connector credential management, or environment CRUD (other Phase 7 cards).
- Do **not** store or log any secret value.
- Do **not** add dependencies.
- Do **not** change the data-model shapes or component APIs beyond what this prompt states.
- Do **not** commit. Return a single response with: (1) a short summary of the approach; (2) complete file contents under `FILE: <path>` headers; (3) a final "Verification checklist".
