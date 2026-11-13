# PM-P4-02 — Automation Studio Node Types, Lifecycle States, and Execution Inspection

| Field | Value |
|---|---|
| Card | PM-P4-02 — Automation Studio node types, lifecycle states, and execution inspection |
| Artifact | Proposed node library, node states and validation, workflow lifecycle, execution inspection and traces, approval states, test-mode isolation, redaction, preview-only boundary, Canvas separation, acceptance criteria, unresolved decisions |
| Date | 2026-11-10 |
| Repository | `<workspace>` |
| Method | Read-only static inspection of `AutomationStudio.tsx`, backend routes/services/schema, connector service, review queue, Phase 1–3 planning artifacts, and the design-authority documents. No servers started, no builds, no DB/schema change, no application source edit. |
| Read-only boundary | Only this artifact was written. No application source file, schema, data, environment, or configuration was modified. |
| Status | **Proposed — pending owner approval.** No automation runtime is authorized by this document. |

## Evidence legend

| Label | Meaning |
|---|---|
| **VERIFIED** | Read directly from the cited file/line in the current working tree, or independently re-derived during this review. |
| **REPORTED** | Asserted by a project document or sibling artifact; not independently re-derived here. |
| **PROPOSED** | Recommended target state; not present in code and not yet approved. |
| **UNKNOWN** | Not currently verifiable. |
| **DECISION-REQUIRED** | Owner decision needed before implementation. |

---

## 1. Executive summary

The Automation Studio is a **preview-only mock**. `frontend/src/pages/AutomationStudio.tsx` renders "Preview only · no runtime connected" (`:29`), disables "Publish workflow" (`:30`), disables "Replay node · future" (`:216`), uses hard-coded sample data (`:7-12`, `:80`, `:230`), and contains no `fetch()` call. No automation, workflow, execution, replay, or approval route is registered in `backend/src/index.ts:37-51` or `backend/src/server.ts:41-55`, and no automation tables exist in `backend/src/database/schema.sql` or the live database (`PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:40`). **VERIFIED**

This artifact specifies the target Automation Studio contract so that a future backend runtime can be designed, reviewed, and approved on evidence rather than implication:

1. **Proposed node library** — six node types: trigger, transform, decision, action, human gate, error handler (§3).
2. **Node states and validation** — five design-time node states, eight runtime step states, and a validation rule set with publish gating (§4).
3. **Workflow lifecycle** — draft, test, published, paused, archived, plus versioned rollback (§5).
4. **Execution inspection and traces** — execution/step records, redacted trace UI, replay constraints, retention (§6).
5. **Approval states** — human gate decision states and separation-of-duties rules (§7).
6. **Test-mode isolation** — sample/pinned data only; no silent live side effects (§8).
7. **Redaction** — classes, redaction points, credential references, and a live leak path (§9).
8. **Preview-only boundary** — what stays disabled until a separate runtime approval (§10).
9. **Canvas separation** — the authoritative boundary and binding terminology (§11).

**No implementation is authorized.** The next executable step remains the owner gate on the Phase 1 Decision C boundary (`PHASE1_DISCOVERY_DECISION_PACK.md:148-153`) and the Phase 2 owner decisions on automation publish/execute (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:95-102`).

---

## 2. Current-state baseline (VERIFIED)

### 2.1 Automation Studio is a preview-only mock

| Claim | Evidence |
|---|---|
| Preview-only notice | `frontend/src/pages/AutomationStudio.tsx:29` — "Preview only · no runtime connected" |
| Publish disabled | `AutomationStudio.tsx:30` — `<button className="pm-secondary-button" disabled>Publish workflow</button>` |
| Replay disabled | `AutomationStudio.tsx:216` — `<button disabled>Replay node · future</button>` |
| Sample data, not live | `AutomationStudio.tsx:7-12` (nodeInfo), `:80` ("Sample data"), `:230` (sample JSON), `:231` ("Live run history is deliberately not simulated. It must be powered by a separately approved backend runtime.") |
| No network calls | Repository-wide read: the file contains no `fetch`/API import; `PHASE2_01_SHARED_ARCHITECTURE.md:388` confirms "no `fetch` in the file" |
| Future-module label | `AutomationStudio.tsx:24` — "AUTOMATION STUDIO · FUTURE MODULE"; `:82` — "Draft · test only" |
| Route registered | `frontend/src/main.tsx:39` — `/automation` |
| Nav flagged preview | `frontend/src/components/layout/AppShell.tsx:31` — `future: true`; `:88-90` renders the `Preview` tag |
| Command palette | `AppShell.tsx:385-392` — "Open Automation Studio" / "Node workflow studio preview" |
| CSS labelled non-live | `frontend/src/index.css:429` — `/* Automation Studio (intentionally non-live) */` |
| Icon distinction | `frontend/src/components/layout/Icon.tsx:2,41-43` — `automation`/`flow` icon separate from `canvas` |

### 2.2 No backend runtime, routes, or tables

| Claim | Evidence |
|---|---|
| No automation routes | `backend/src/index.ts:37-51` and `backend/src/server.ts:41-55` register 15 route families; none is automation/workflow/execution/replay/approval |
| No automation tables | `backend/src/database/schema.sql` (246 lines) contains no workflow/execution/approval table; `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:40` confirms 0 matches |
| No worker/queue/scheduler | `PHASE2_03:118` — no worker, queue, scheduler, cron, `setInterval`, or background loop in `backend/src` |
| Preview status cross-checked | `PHASE1_DISCOVERY_DECISION_PACK.md:19,111-112`; `PHASE2_03:18,112`; `PHASE2_01:388` |

### 2.3 Connector surface is the only reusable action provider

| Claim | Evidence |
|---|---|
| Two connector definitions | `backend/src/services/connector.service.ts:27-65` — GitHub (token) and Hermes (api_key) |
| Connector operations | `connector.service.ts:40-45` (GitHub: list_repos, create_issue, list_issues, link_commit); `:59-63` (Hermes: test_connection, send_message, list_models) |
| Connector routes | `backend/src/routes/connectors.routes.ts:8-149` — CRUD, test, GitHub repos/issues, Hermes message/models |
| Connector schema | `backend/src/database/schema.sql:205-215` (`connectors`, no `project_id`); `:217-226` (`connector_configs`, `is_secret` marker) |
| Action node implication | Any future action node must bind to one of these named operations; there is no generic "run connector" primitive |

### 2.4 Review queue is the only human-attention surface

| Claim | Evidence |
|---|---|
| Real data, not approvals | `frontend/src/pages/ReviewQueue.tsx:9-10` — fetches `/api/tasks?status=blocked` and `/api/dashboard` |
| Approval panel disabled | `ReviewQueue.tsx:11` — "Agent proposals and human approvals are intentionally not faked in this interface. Their UI will be enabled after approval records and an API contract are implemented." |
| Empty approval store | `PHASE2_03:36` — `approvals` does not exist; `agent_activities` 0 rows; `PHASE2_01:389` |

### 2.5 Card provenance is unverifiable

**VERIFIED** — `PM-P4-02` (and `PM-P4-*`) returns 0 hits in `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, and `CHECKLIST.md`; the only occurrences are inside Phase 2–3 sibling artifacts (which themselves flag the same governance gap: `PHASE3_04_CANVAS_SPEC_APPROVAL.md:41,118`). The card is a planning-series identifier, not a recorded board card. **DECISION-REQUIRED** — record PM-P4-01/PM-P4-02 and their acceptance definitions in the current authority documents.

---

## 3. Proposed node library

### 3.1 Node type catalog

Six node types are proposed. IDs are stable API identifiers; labels are UI text.

| ID | Label | Role | Input | Output | Side-effect class | Approval | Guardrails |
|---|---|---|---|---|---|---|---|
| `trigger` | Trigger | Starts a run from a subscribed event | Event payload (e.g. `task.updated`) | Normalized trigger payload | None (read-only subscription) | None | Explicit event subscription; exactly one active trigger per workflow version; event schema versioned |
| `transform` | Transform | Deterministic data shaping | Upstream payload | Transformed payload | None | None | Pure/deterministic; no external calls; testable with sample input; no secrets in expressions |
| `decision` | Decision | Conditional branch | Upstream payload | Branch label + payload | None | None | ≥2 outgoing edges with visible labels; exhaustive default branch; test cases required |
| `action` | Action | Performs a scoped operation | Upstream payload + parameters | Operation result | Side-effecting (write/send) or read-only | Publish-time approval; per-run approval for consequential actions | Scoped connector permission; least-privilege; idempotency key; timeout; retry policy |
| `human_gate` | Human gate | Pauses for a human decision | Upstream payload + change summary | Approval decision + payload | None (pauses run) | Always | Explicit decision, expiry, audit record; agent cannot approve its own proposed action |
| `error_handler` | Error handler | Catches and routes node failures | Error context | Recovery action (retry / notify / create review item / end) | Depends on recovery action | Publish-time review | Failure is visible, never silently swallowed; bounded retries; recovery action is itself a scoped node |

The catalog matches the design authority's primitive list (`UI_UX_REDESIGN_PLAN.md:191,198-205`) and the component catalog's primitive row (`PHASE2_05_SHARED_COMPONENT_CATALOG.md:853`).

### 3.2 Node contracts

Each node instance in a workflow version carries:

```
node_id            stable id within the version
node_type          trigger | transform | decision | action | human_gate | error_handler
label              human-readable name (required, unique within the workflow)
purpose            short description (required)
config             type-specific parameters (validated against the type schema)
input_schema       declared input contract
output_schema      declared output contract
side_effect_class  none | read_only | write | send | mixed
idempotency        key strategy for side-effecting actions
credential_ref     reference to a credential reference (never an inline secret)
retry_policy       max_attempts, backoff, timeout_ms
test_cases         pinned input/expected output pairs
```

Type-specific requirements:

- **trigger** — `event_type` (e.g. `task.updated`), `filter` (optional guard), `subscription_id`. One trigger per version; a second trigger creates a new version.
- **transform** — `mapping` (declarative field mapping or a reviewed expression), `on_error` (fail / pass-through). No connector or HTTP call.
- **decision** — `branches: [{label, condition, target_node_id}]`, `default_target_node_id`. Conditions must be deterministic and testable.
- **action** — `connector_id`, `operation_id` (from `AVAILABLE_CONNECTORS` or a future equivalent), `parameters`, `scope`, `idempotency_key`, `timeout_ms`, `on_error`. Must declare `side_effect_class`.
- **human_gate** — `reviewer_policy` (owner / named role / explicit user), `expiry_seconds`, `escalation_policy`, `change_summary_template`.
- **error_handler** — `handles: [node_id | node_type | "any"]`, `recovery: retry | notify | create_review | end`, `max_retries`, `notify_target`.

### 3.3 Library UI and governance

**PROPOSED:**

- The library lists only approved node types; no arbitrary unbounded plugin gallery (`UI_UX_REDESIGN_PLAN.md:191`).
- Search filters by label/description; each entry shows type, side-effect class, and required permission.
- Templates are organization-approved starting points (`UI_UX_REDESIGN_PLAN.md:184`), not user-published arbitrary code.
- Node types are versioned server-side; the UI renders the type schema for the workflow version, not a hard-coded client copy.
- Adding a node type requires a backend schema change, a permission review, and an owner decision. The UI never invents types.

### 3.4 Current-preview gap

**VERIFIED** — the preview's `NodeId` union is `"trigger" | "condition" | "notify" | "review"` (`AutomationStudio.tsx:4`), and `nodeInfo` defines exactly four nodes (`:7-12`):

| Preview node | Proposed type | Gap |
|---|---|---|
| `trigger` — "Task status changed" (`:8`, `:92-96`) | `trigger` | None (concept) |
| `condition` — "Dependency check" (`:9`, `:97-101`) | `decision` | Naming only; no branch test cases |
| `notify` — "Notify task owner" (`:10`, `:102-106`) | `action` | No connector/operation binding, no scope, no idempotency |
| `review` — "Request human review" (`:11`, `:107-111`) | `human_gate` | No reviewer policy, expiry, or audit link |
| — | `transform` | **Absent** from the preview |
| "Error handler" button (`:68-71`) | `error_handler` | **Non-functional**: no `onClick`, no `NodeId`, not rendered on the canvas |

The preview is therefore a 4-of-6 conceptual mock. The missing `transform` type and the non-functional error handler are the two concrete library gaps.

---

## 4. Node states and validation

### 4.1 Design-time node states

**PROPOSED:**

| State | Meaning | Entry criterion | Exit criterion |
|---|---|---|---|
| `draft` | Added but not fully configured | Node created | Required fields completed |
| `invalid` | Fails validation | Validation error found | All errors resolved |
| `valid` | Passes schema/semantic validation | 0 errors | Config changed |
| `tested` | Has ≥1 passing test-mode run for the current version | Test run passes | Version or config changed |
| `deprecated` | Library type retired | Owner deprecates the type | Existing instances remain readable; cannot be added to new drafts |

A node in `draft` or `invalid` cannot be included in a test run or a publish candidate. A node in `valid` can be tested but cannot be published until it is `tested`.

### 4.2 Runtime step states

**PROPOSED** — per node instance within an execution:

| State | Meaning |
|---|---|
| `pending` | Not yet reached |
| `running` | Executing |
| `succeeded` | Completed successfully |
| `failed` | Errored; retry or error handler may follow |
| `skipped` | Not executed due to branch/guard |
| `awaiting_approval` | Human gate waiting for a decision |
| `cancelled` | Run cancelled before completion |
| `retrying` | Retry scheduled; attempt count incremented |

### 4.3 Validation rules

**PROPOSED:**

| # | Rule | Severity |
|---|---|---|
| V-01 | Node type exists in the approved type catalog | error |
| V-02 | Required fields present (`label`, `purpose`, type-specific config) | error |
| V-03 | `config` validates against the type schema | error |
| V-04 | `input_schema` / `output_schema` are well-formed and match the declared type contract | error |
| V-05 | Trigger: exactly one active trigger per workflow version | error |
| V-06 | Trigger: `event_type` is a supported, versioned event | error |
| V-07 | Decision: ≥2 outgoing edges, each with a visible label | error |
| V-08 | Decision: an exhaustive default branch exists | error |
| V-09 | Decision: branch conditions are deterministic and testable | error |
| V-10 | Action: `connector_id` and `operation_id` resolve to an approved connector operation | error |
| V-11 | Action: `scope` is explicit and least-privilege; no wildcard | error |
| V-12 | Action: `side_effect_class` declared; idempotency key strategy declared | error |
| V-13 | Action: `credential_ref` references a credential reference; no inline secret | error |
| V-14 | Transform: no external call, connector, or HTTP reference | error |
| V-15 | Human gate: `reviewer_policy` resolves to at least one human approver; agents excluded | error |
| V-16 | Human gate: `expiry_seconds` and `escalation_policy` set | error |
| V-17 | Error handler: recovery action is itself a scoped, approved operation | error |
| V-18 | Workflow graph is acyclic, or an explicit loop guard with max iterations exists | error |
| V-19 | Workflow has at least one terminal node | error |
| V-20 | No secret pattern in any config, sample data, or trace preview | error |
| V-21 | Actor/role has the required permission for the node's operation | warning |
| V-22 | Node has ≥1 pinned test case | warning |
| V-23 | Node has ≥1 passing test run for the current version | warning (publish gate) |

### 4.4 Validation severity and publish gating

- **error** — blocks test runs and publish.
- **warning** — allows test runs; blocks publish unless an owner explicitly acknowledges the warning at publish time (the acknowledgement is audited).
- Validation runs on save, on test start, and on publish. The publish gate requires **0 errors** and either **0 warnings** or an owner acknowledgement per warning.

---

## 5. Workflow lifecycle

### 5.1 Workflow states

**PROPOSED** — six named states, matching `UI_UX_REDESIGN_PLAN.md:209` and `PHASE2_05_SHARED_COMPONENT_CATALOG.md:857`:

| State | Meaning | Editable | Executable | Live side effects |
|---|---|---|---|---|
| `draft` | Authoring in progress | Yes | No | No |
| `test` | Test-mode runs allowed | Yes | Yes (test mode only) | No |
| `published` | Immutable reviewed version, active | No (new version required) | Yes | Yes, subject to approval |
| `paused` | Published version temporarily disabled | No | No new runs | In-flight runs complete or cancel |
| `archived` | Read-only history | No | No | No |
| `rollback` | Transition: re-activate a previous published version | — | — | — |

`rollback` is a **transition**, not a steady state: it creates a new version that references the target version, and records a `workflow.rolled_back` audit event.

### 5.2 Transition table

**PROPOSED:**

| From | To | Actor | Guard | Audit event |
|---|---|---|---|---|
| `draft` | `test` | owner / editor | 0 errors; ≥1 trigger; ≥1 terminal node | `workflow.test_started` |
| `test` | `draft` | owner / editor | — | `workflow.test_abandoned` |
| `draft` | `published` | owner only | 0 errors; 0 unacknowledged warnings; ≥1 passing test run; explicit publish approval | `workflow.published` |
| `test` | `published` | owner only | same as above | `workflow.published` |
| `published` | `paused` | owner only | confirmation | `workflow.paused` |
| `paused` | `published` | owner only | confirmation | `workflow.resumed` |
| `published` | `archived` | owner only | no in-flight runs | `workflow.archived` |
| `archived` | `published` | owner only | confirmation; restore | `workflow.restored` |
| `published` / `paused` | `published` (rollback) | owner only | target version exists; confirmation; reason recorded | `workflow.rolled_back` |
| `archived` | `draft` | owner only | new draft copy | `workflow.draft_created` |

Publishing is **owner-only** and disabled for every role until a separate runtime/publish policy is approved (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:54`). Execution/replay/retry is likewise disabled for every role until a later runtime authorization (`PHASE2_02:55`).

### 5.3 Versioning and rollback

**PROPOSED:**

- Every workflow has a monotonically increasing `version_number`. A published version is **immutable**; editing creates a new draft version.
- A rollback re-activates a previous published version as a **new** version (the history is preserved; the rollback is itself a versioned, auditable event).
- Version differences are inspectable (node/edge diff) before publish and before rollback.
- Environments are bound to a version; a rollback does not silently change environment bindings.
- Version differences, environment boundaries, and rollback must exist before a live workflow can be published (`UI_UX_REDESIGN_PLAN.md:214`).

### 5.4 Proposed data model

**PROPOSED** — the automation data contract from `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:610-613`:

| Table | Purpose |
|---|---|
| `workflows` | Workflow identity, project scope, current version pointer, state |
| `workflow_versions` | Immutable versioned definitions (nodes/edges JSON), version number, state |
| `workflow_environments` | Per-version environment binding (test/live, credential reference) |
| `executions` | Run records (version, environment, actor, trigger, status, timestamps, outcome) |
| `execution_steps` | Per-node step traces (state, redacted input/output, error class, retries) |
| `approvals` | Human gate decision records |
| `human_gates` | Gate policy per node (reviewer policy, expiry, escalation) |
| `environments` | Environment definitions and modes |
| `credential_references` | Secret-store references; never inline secrets |

This table set is **DECISION-REQUIRED** (`PHASE2_03:610`, D9/D10 at `:683-684`) and must not be built until the automation runtime boundary is approved.

---

## 6. Execution inspection and traces

### 6.1 Execution record

**PROPOSED** — `executions`:

| Field | Meaning |
|---|---|
| `execution_id` | Primary key |
| `workflow_id` / `version_id` | Exact version executed (immutable reference) |
| `environment_id` | test or live environment |
| `actor_type` / `actor_id` | `user` / `agent` / `automation` / `system` (`PHASE2_03:405`) |
| `trigger_event_id` | Source event (trigger node) |
| `status` | `queued` / `running` / `succeeded` / `failed` / `cancelled` / `awaiting_approval` |
| `started_at` / `completed_at` / `duration_ms` | Timing |
| `outcome` | Success/failure summary |
| `error_summary` | Redacted error class and message |
| `trace_id` | Correlation ID for logs/traces (`PHASE2_03:414`) |
| `is_test` | 1 for test-mode runs; 0 for live runs |
| `replayed_from` | Source execution ID when replayed |

Every run stores a redacted step trace, version ID, initiating actor, timestamps, outcome, and approval link when applicable (`UI_UX_REDESIGN_PLAN.md:212`).

### 6.2 Step trace record

**PROPOSED** — `execution_steps`:

| Field | Meaning |
|---|---|
| `step_id` | Primary key |
| `execution_id` | Parent execution |
| `node_id` / `node_type` | Node instance and type |
| `state` | Runtime step state (§4.2) |
| `input_preview` | Redacted input preview |
| `output_preview` | Redacted output preview |
| `error_class` | Retryable / permanent / approval_required |
| `retry_count` | Attempts used |
| `started_at` / `completed_at` | Timing |

### 6.3 Inspection UI

**PROPOSED** — the execution drawer (`UI_UX_REDESIGN_PLAN.md:194,212`):

- **Step timeline**: ordered node list with state glyphs (`AutomationStudio.tsx:220-223` is the preview's static analogue).
- **Selected-node trace**: redacted input/output JSON for the selected step (`AutomationStudio.tsx:225-230`).
- **Error location**: the failing step is highlighted; the error class and redacted message are shown; the error handler's recovery path is visible.
- **Sample/pinned data**: test runs display the pinned dataset used, not live data.
- **Approval link**: when a gate is pending/decided, the approval record is linked from the step.
- **Safe replay constraints**: replay controls are disabled or gated per §6.4.

The current preview deliberately does not simulate live run history (`AutomationStudio.tsx:231`); the inspection UI must be powered by the approved backend runtime and must never be populated with fabricated data.

### 6.4 Replay

**PROPOSED:**

- Replay is allowed **only for non-side-effecting nodes by default** (`UI_UX_REDESIGN_PLAN.md:211`).
- A replay that could send, write, or change status requires an explicit reviewed mode and a per-run approval.
- Replay creates a new execution record with `replayed_from` set; it never mutates the original trace.
- Replay is unavailable while the runtime is disabled (`AutomationStudio.tsx:216` — "Replay node · future").
- Replay of a side-effecting action node is blocked in test mode and requires a live-environment approval in production.

### 6.5 Retention

**PROPOSED** — align with the audit retention policy (`PHASE2_03:463`): hot 90 days; archive to compressed JSON/SQLite cold store after 90 days; delete after 7 years unless a legal hold applies. Execution traces are redacted before persistence and before export.

---

## 7. Approval states

### 7.1 Human gate states

**PROPOSED:**

| State | Meaning | Terminal? |
|---|---|---|
| `not_requested` | Gate not yet reached | No |
| `requested` | Awaiting a reviewer decision | No |
| `approved` | Reviewer approved; run resumes | Yes |
| `rejected` | Reviewer rejected; run follows the rejection path or ends | Yes |
| `expired` | No decision before `expiry_seconds`; escalation/rejection policy applies | Yes |
| `cancelled` | Run cancelled while the gate was pending | Yes |
| `superseded` | Gate replaced by a newer approval request | Yes |

### 7.2 Approval record

**PROPOSED** — `approvals`:

| Field | Meaning |
|---|---|
| `approval_id` | Primary key |
| `workflow_id` / `version_id` | Workflow and version |
| `execution_id` / `step_id` | Run and gate step |
| `gate_node_id` | Human gate node |
| `requester_type` / `requester_id` | Who/what requested the decision |
| `reviewer_id` | Human who decided (nullable until decided) |
| `state` | §7.1 |
| `decision` | approved / rejected / expired / cancelled / superseded |
| `decided_at` | Decision timestamp |
| `expires_at` | Gate expiry |
| `comment` | Reviewer comment (redacted on read) |
| `created_at` | Request timestamp |

### 7.3 Authority and separation of duties

**PROPOSED**, derived from `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:34,42-57`:

- A reviewer must be an **active human project owner** or an explicitly designated approver for the gate's `reviewer_policy`.
- **Agents cannot approve their own proposed action** (`PHASE2_02:34`). An agent-requested gate must be decided by a human.
- The requester cannot approve their own request (separation of duties).
- Approval is itself audited: actor, workflow, gate, decision, timestamp, and comment (`PHASE2_03:428`, `action = approve | reject`).
- A gate decision resumes or terminates the run; it never silently bypasses the gate.

### 7.4 Review queue integration

**PROPOSED:**

- Human gates surface in the Review Queue (`frontend/src/pages/ReviewQueue.tsx:11` — the approval panel is explicitly disabled pending this contract).
- The queue shows pending gates with workflow name, version, requester, change summary, and expiry.
- Approving or rejecting from the queue writes the approval record and resumes/cancels the run.
- The Review Queue remains a **human-attention surface**, not an agent self-service surface.

---

## 8. Test-mode isolation

### 8.1 Sample/pinned data only

**PROPOSED** — test mode uses sample or pinned data (`UI_UX_REDESIGN_PLAN.md:210`):

- A test run is bound to a named pinned dataset; the UI displays which dataset was used.
- Test input/output previews are redacted and clearly labelled as sample/pinned.
- Test runs never read live connector data unless a separately authorized live health check is confirmed (`PHASE2_02:70`).

### 8.2 Connector isolation

**PROPOSED:**

- Test mode **cannot silently call a live side-effecting connector** (`UI_UX_REDESIGN_PLAN.md:210`).
- Connector operations in test mode are mock/pinned responses (`PHASE2_02:70`).
- A test-mode action node shows the operation it *would* call and the pinned response it received.
- Live connector use requires a live environment, an approved version, and a per-run approval.

### 8.3 Test-run marking and separation

**PROPOSED:**

- Test executions carry `is_test = 1` and are visually separated from live execution history (`AutomationStudio.tsx:201` — "Sample test preview" vs `:204` — "Past executions").
- Test runs may write only to `executions`/`execution_steps`; they must not mutate tasks, connectors, comments, or any live domain row.
- Test runs count toward the publish gate (§4.4) but never toward live execution statistics.

### 8.4 Environment boundaries

**PROPOSED:**

- Environments are explicit: `test` and `live` (`workflow_environments`, `environments`).
- A test environment cannot bind a live credential reference; credential references are environment-scoped.
- Publishing to live requires an environment binding review and an owner approval.
- Environment boundaries must exist before a live workflow can be published (`UI_UX_REDESIGN_PLAN.md:214`).

---

## 9. Redaction

### 9.1 Redaction classes

**PROPOSED** — from `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:443-450`:

| Class | Fields | Handling |
|---|---|---|
| `secret` | passwords, API keys, tokens, JWTs, connector secrets, `password_hash`, `api_key_hash` | Never stored; replaced with `[REDACTED]` |
| `pii` | email, device fingerprint, IP (optional), username | Masked by default; full value only for owner/admin with a `read_sensitive` audit record |
| `financial` | future billing/cost fields | Masked unless role permits |
| `internal` | internal IDs, paths, stack traces | Stored as-is but never returned in public APIs |

### 9.2 Redaction points

**PROPOSED** — redaction is applied **before** persistence and serialization (`PHASE2_03:452-457`):

1. Audit rows (`audit_logs`)
2. Outbox/event payloads (`outbox_events.payload`)
3. Structured logs
4. Exports
5. Error messages
6. UI previews (node input/output, execution traces)
7. Screenshots and support diagnostics
8. Workflow/execution JSON in API responses

A single shared redaction module is used by audit, outbox, logging, and export; redaction must be testable (a unit test asserts no known secret pattern appears in any serialized payload) (`PHASE2_03:456-457`).

### 9.3 Credential references

**PROPOSED** — from `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:65-74`:

- Credentials are **references** managed outside the visual node payload; secrets are never in workflow JSON, database config fields, browser storage, URLs, or task metadata (`PHASE2_02:68`).
- After save, all roles — including Owner — receive only a safe result (`configured: true`, status, update time); the secret is never echoed (`PHASE2_02:69`).
- Agents/workflows receive neither a secret-read API nor a reusable credential value (`PHASE2_02:70`).
- Credential set/rotate/revoke/use is audited without storing the secret, auth header, or raw provider error (`PHASE2_02:72`).

### 9.4 Current leak path (VERIFIED)

**VERIFIED** — `backend/src/services/connector.service.ts:86-96` (`listInstances`) and `:103-113` (`getInstance`) return `config: JSON.parse(row.config)` with **no redaction**. `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:455` classifies this as a live leak path that must be fixed before any live connector use. This artifact does not authorize that fix; it records it as a prerequisite for any action node.

---

## 10. Preview-only boundary

### 10.1 Current preview state

**VERIFIED** — the Automation Studio is a labelled preview with no runtime (`AutomationStudio.tsx:24,29-30,82,216,231`; `PHASE1_DISCOVERY_DECISION_PACK.md:19`; `PHASE2_03:18,112`; `handoff_future_uiux.md:31`).

### 10.2 Disabled until runtime approval

**PROPOSED** — the following remain disabled until a separate runtime specification and explicit owner authorization exist (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:63`; `PHASE1_DISCOVERY_DECISION_PACK.md:148-153`, Decision C):

| Capability | Current state | Gate |
|---|---|---|
| Publish workflow | Disabled (`AutomationStudio.tsx:30`) | Owner approval + runtime spec |
| Execute a workflow | Does not exist | Owner approval + runtime spec |
| Replay a node/run | Disabled (`AutomationStudio.tsx:216`) | Runtime spec + replay policy |
| Human approval decisions | Disabled (`ReviewQueue.tsx:11`) | Approval contract + runtime spec |
| Live connector side effects | Not reachable | Connector scope/redaction policy + runtime spec |
| Live execution history | Deliberately not simulated (`AutomationStudio.tsx:231`) | Runtime spec |

### 10.3 Hard rules

**PROPOSED** (binding):

1. Never imply a functioning runtime in any design, mockup, prototype, or screenshot (`handoff_future_uiux.md:51`).
2. Drafting is not publishing; publishing is not execution (`PHASE2_02:63`).
3. A UI button, agent capability, Canvas connection, or test preview cannot imply live execution rights (`PHASE2_02:63`).
4. Any future external write must be separately authorized, approved, attributable, and auditable (`PHASE2_02:63`).
5. The preview's sample data must remain visually and structurally distinct from live execution records (`AutomationStudio.tsx:201-207`).

---

## 11. Canvas separation

### 11.1 Authoritative rule

**REPORTED** — "Project Canvas visualizes work. Automation Studio executes approved workflow definitions. They must never share a misleading name, a data model, or an implied execution engine." (`UI_UX_REDESIGN_PLAN.md:175`). Reinforced at `handoff_future_uiux.md:46,51,63`, `PHASE1_DISCOVERY_DECISION_PACK.md:122`, and `PHASE3_01_CANVAS_IA_JOURNEYS.md:385-405`.

### 11.2 Binding terminology

**PROPOSED** — from `PHASE2_05_SHARED_COMPONENT_CATALOG.md:866-876`:

| Concept | Project Canvas | Automation Studio |
|---|---|---|
| Surface | Infinite 2D canvas; pan/zoom; freeform placement | Node-graph workflow builder; directional flow |
| Connection | **Visual relationship** (line/arrow) | **Control flow** (trigger → transform → decision → action → gate) |
| Primitive | Item (shape, text, task card, line) | Node (trigger, transform, decision, action, human gate, error handler) |
| Inspector | Geometry / style / content | Settings / input / output / validation / permissions |
| Task meaning | Task card is a **visual reference** | Task event is a **trigger payload / action target** |
| Status | Selection / drag / save state | Workflow state + execution outcome |
| Forbidden verbs | run, execute, trigger, publish, edge, flow | shape, canvas item, visual-relationship wording |

### 11.3 Data model separation

**PROPOSED** — binding constraints from `PHASE3_03_CANVAS_API_CONTRACT.md:470-483`:

1. Canvas tables (`canvases`, `canvas_items`, `canvas_connections`, `schema.sql:161-201`) **must not** gain automation columns (`workflow_id`, `execution_id`, `trigger_config`).
2. The Canvas API **must not** expose `execute`, `run`, `trigger`, `workflow`, `execution`, or `order` semantics on connections.
3. Canvas ordering (`z_index`, item coordinates) **must not** be interpreted as execution order.
4. Canvas item `content`/`style` are inert data, never parsed as commands or workflow definitions.
5. Canvas CRUD **must not** invoke connectors or external systems.

### 11.4 Integration constraints

**PROPOSED:**

- If a future phase links Automation to Canvas, it requires its own specification, schema, authorization, audit, and owner approval (`PHASE3_03:483`).
- Any such integration must be **additive** and must not change the Canvas contract without a new card.
- A Canvas connection remains a visual relationship, never a control-flow edge (`PHASE3_02:256`).
- Automation Studio UI work must follow the backend automation contract before any publish path (`PHASE2_05:913`).

---

## 12. Acceptance criteria

The card is complete when:

| ID | Criterion | Label |
|---|---|---|
| AC-01 | This artifact is reviewed and the unresolved decisions in §13 are recorded. | PROPOSED |
| AC-02 | The six-type node library (trigger, transform, decision, action, human gate, error handler) is specified with contracts and guardrails. | PROPOSED |
| AC-03 | The current 4-of-6 preview gap is documented and the missing `transform` type and non-functional error handler are tracked. | VERIFIED |
| AC-04 | Design-time node states and runtime step states are defined and distinguishable. | PROPOSED |
| AC-05 | Validation rules V-01…V-23 are specified with severity and publish gating. | PROPOSED |
| AC-06 | Workflow states draft/test/published/paused/archived and the rollback transition are specified. | PROPOSED |
| AC-07 | Versioning, immutable published versions, and rollback semantics are specified. | PROPOSED |
| AC-08 | Execution and step-trace records are specified with redaction and retention. | PROPOSED |
| AC-09 | Replay is restricted to non-side-effecting nodes by default, with a reviewed mode for side effects. | PROPOSED |
| AC-10 | Human gate approval states and separation-of-duties rules are specified. | PROPOSED |
| AC-11 | Test-mode isolation (sample/pinned data, mock connectors, `is_test` marking) is specified. | PROPOSED |
| AC-12 | Redaction classes and redaction points cover traces, logs, exports, audit, and UI previews. | PROPOSED |
| AC-13 | The connector secret leak path (`connector.service.ts:86-96,103-113`) is recorded as a prerequisite. | VERIFIED |
| AC-14 | The preview-only boundary is restated with the disabled-capability table. | VERIFIED |
| AC-15 | Canvas separation is restated with binding terminology and data-model constraints. | VERIFIED |
| AC-16 | No application source, schema, data, or configuration was modified by this card. | VERIFIED |
| AC-17 | No automation runtime, route, table, or execution is assumed or authorized by this card. | VERIFIED |
| AC-18 | The automation data model (§5.4) is marked DECISION-REQUIRED and is not built. | VERIFIED |
| AC-19 | The card's acceptance definitions are recorded in the current authority documents. | DECISION-REQUIRED |

---

## 13. Unresolved decisions

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **D-01** | Automation runtime boundary (`PHASE1_DISCOVERY_DECISION_PACK.md:148-153`, Decision C) | Preview-only / test-only / live | **Preview-only** until a separate runtime specification is approved |
| **D-02** | Approve the six-type node library and its contracts (§3) | Approve / amend / reject | Approve as specified |
| **D-03** | Approve the design-time node states and validation gates (§4) | Approve / amend / reject | Approve; warnings require owner acknowledgement at publish |
| **D-04** | Approve the workflow lifecycle and rollback semantics (§5) | Approve / amend / reject | Approve; published versions are immutable |
| **D-05** | Approve the automation data model (§5.4) | Approve / amend / defer | Approve as a **target contract only**; do not build until D-01 is settled |
| **D-06** | Approve the execution trace and replay policy (§6) | Approve / amend / reject | Approve; replay restricted to non-side-effecting nodes |
| **D-07** | Approve the human gate states and reviewer policy (§7) | Approve / amend / reject | Approve; agents never approve their own actions |
| **D-08** | Approve the test-mode isolation rules (§8) | Approve / amend / reject | Approve; test mode never calls live side-effecting connectors |
| **D-09** | Approve the redaction module and its mandatory points (§9) | Approve / amend / reject | Approve; required before any live connector use |
| **D-10** | Fix the connector secret leak path (`connector.service.ts:86-96,103-113`) | Fix now / defer to runtime card | Fix before any action node is implemented |
| **D-11** | Record PM-P4-01/PM-P4-02 in the authority documents | Record / leave as series IDs | Record; card provenance is currently unverifiable (§2.5) |
| **D-12** | Phase ordering: backend automation contract before Studio UI (per `PHASE2_05:913`, `handoff_future_uiux.md:114`) | Backend-first / UI-first | Backend-first; UI work follows the approved contract |

---

## 14. Evidence index

**Application source**

- `frontend/src/pages/AutomationStudio.tsx`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/components/layout/Icon.tsx`
- `frontend/src/pages/ReviewQueue.tsx`
- `frontend/src/pages/WorkspaceOverview.tsx`
- `frontend/src/index.css`
- `backend/src/index.ts`
- `backend/src/server.ts`
- `backend/src/routes/connectors.routes.ts`
- `backend/src/services/connector.service.ts`
- `backend/src/database/schema.sql`

**Planning and design-authority documents**

- `PHASE1_DISCOVERY_DECISION_PACK.md`
- `PHASE2_01_SHARED_ARCHITECTURE.md`
- `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md`
- `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md`
- `PHASE2_05_SHARED_COMPONENT_CATALOG.md`
- `PHASE3_01_CANVAS_IA_JOURNEYS.md`
- `PHASE3_02_CANVAS_INTERACTIONS.md`
- `PHASE3_03_CANVAS_API_CONTRACT.md`
- `PHASE3_04_CANVAS_SPEC_APPROVAL.md`
- `UI_UX_REDESIGN_PLAN.md`
- `handoff_future_uiux.md`

---

*Prepared as a Phase 4 planning artifact. This document is a specification and decision register, not an implementation authorization and not a source-code change. Automation Studio remains preview-only until the owner approves a separate runtime specification.*
