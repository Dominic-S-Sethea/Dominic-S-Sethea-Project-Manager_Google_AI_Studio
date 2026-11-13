# PM-P4-03 — Automation Runtime, Safety, Permission & Backend Contract

| Field | Value |
|---|---|
| Card | PM-P4-03 — Automation runtime boundary, data contracts, permissions, connector credential scope, redaction, audit, reliability, API schema, migration and test requirements |
| Artifact type | Planning / contract definition (read-only) |
| Date | 2026-11-10 |
| Repository | `<workspace>` |
| Status | **PROPOSED** — target-state contract. Nothing in this document is implemented, authorized, or scheduled. |
| Implementation boundary | Read-only planning artifact. No application source, DB schema, migration, credential, environment, or runtime was created or changed by this card. This document authorizes no implementation. |
| Owner gate | The Automation runtime boundary is **DECISION-REQUIRED** and remains open. Phase 2 `D-09` recommends **preview-only for now** (`PHASE2_FOUNDATION_APPROVAL_PACKAGE.md:117`). Phase 1 Decision C defines the same gate (`PHASE1_DISCOVERY_DECISION_PACK.md:148-153`). The Phase 3 Canvas specification approval gate is a separate owner gate and is **not** a runtime approval (`PHASE3_04_CANVAS_SPEC_APPROVAL.md:45`; `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:142`). |

> **Evidence labels.** **VERIFIED** = read directly from the working tree, a command result, or the live SQLite file during this task. **REPORTED** = asserted by a project document but not independently re-derived here. **PROPOSED** = recommended target state, not approved and not present in code. **UNKNOWN** = not currently verifiable. **DECISION-REQUIRED** = owner decision needed before implementation.

---

## 1. Executive summary

The repository has **no Automation runtime**. `frontend/src/pages/AutomationStudio.tsx` is a static preview that says "Preview only · no runtime connected", disables Publish and Replay, renders sample data, and contains no `fetch()` (`AutomationStudio.tsx:29,30,82,216,231`). No automation, workflow, execution, approval, environment, outbox, queue, or event table exists in `backend/src/database/schema.sql` (18 tables, verified) or in the live `backend/data/app.db` (18 tables, verified). No automation/workflow/execution/replay/approval route is registered in `backend/src/index.ts:37-51` or `backend/src/server.ts:41-55`. A regex scan of `backend/src` for `automation|workflow|execution|approval|outbox|setInterval|cron|scheduler|queue|idempot` returned **zero** matches (VERIFIED).

This card defines the contract a future runtime would have to satisfy, and recommends the owner keep the boundary at **preview-only**. The contract is deliberately written so that the recommended state is "nothing is built": the data model, API, permissions, redaction, audit, and reliability sections are **PROPOSED and gated** — they are the acceptance conditions for a later test-only or live decision, not an instruction to implement now.

Three findings shape the contract:

1. **The preview must stay preview-only.** The hard rule in `handoff_future_uiux.md:51` — "never imply Automation Studio has a functioning runtime in any design, mockup, prototype, or screenshot" — is current and binding. Any contract that makes the preview look live violates it.
2. **The connector layer is not safe enough to automate.** `backend/src/services/connector.service.ts` returns the full `config` object, including secret fields, from `getInstance`/`listInstances` with no ownership check (`:99-114`), and `connectors.routes.ts` applies only `requireAuth` with no `requireRole` (`:8-147`). Secrets are stored in plaintext in two places (`connectors.config` JSON and `connector_configs.value`), with `is_secret` as a classification flag only (`schema.sql:205-226`; `connector.service.ts:116-139`). No runtime may call a connector until this is fixed.
3. **The shared foundation does not exist yet.** There is no migration ledger (`backend/src/database/migrations/` is empty; `migrate.ts:4` is a no-op), no audit writer (`audit_logs` has 0 rows), no outbox, no retry/timeout/cancellation model, and no RBAC enforcement beyond `requireAuth` (`PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:40-75,110-118,662`; `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:78-86`). A runtime built before that foundation would have no trustworthy audit, no reliable delivery, and no authorization boundary.

**Recommended outcome for PM-P4-03:** record the contract, keep the boundary **preview-only**, and require a separate owner decision plus a separate implementation card before any test-only or live runtime work. The contract below is the acceptance standard for that later decision.

---

## 2. Current evidence

### 2.1 Automation Studio is a preview-only mock (VERIFIED)

| Evidence | Path:line | Observation |
|---|---|---|
| Future-module label | `frontend/src/pages/AutomationStudio.tsx:24` | `AUTOMATION STUDIO · FUTURE MODULE` |
| Boundary statement | `frontend/src/pages/AutomationStudio.tsx:26` | "Project Canvas maps work. Automation Studio would execute approved workflow definitions." |
| No-runtime notice | `frontend/src/pages/AutomationStudio.tsx:29` | `Preview only · no runtime connected` |
| Publish disabled | `frontend/src/pages/AutomationStudio.tsx:30` | `<button className="pm-secondary-button" disabled>Publish workflow</button>` |
| Draft/test tag | `frontend/src/pages/AutomationStudio.tsx:82` | `Draft · test only` |
| Sample-data warning | `frontend/src/pages/AutomationStudio.tsx:153-157` | "A live builder needs a versioned execution API, redacted logs, connector permission scopes, safe replay rules, and owner-approved publishing." |
| Replay disabled | `frontend/src/pages/AutomationStudio.tsx:216` | `Replay node · future` disabled |
| No simulated history | `frontend/src/pages/AutomationStudio.tsx:231` | "Live run history is deliberately not simulated. It must be powered by a separately approved backend runtime." |
| No data access | `frontend/src/pages/AutomationStudio.tsx:1-18` | Imports only `react` and `Icon`; four `useState` hooks; no `fetch`, no query client, no API import |

**Conclusion (VERIFIED):** the preview is a static mock. It is the correct current state and must not be wired to any runtime without an owner decision.

### 2.2 No runtime, route, table, or worker exists (VERIFIED)

| Check | Result |
|---|---|
| Route registration `backend/src/index.ts:37-51` | `/api/auth`, `/api/users`, `/api/dashboard`, `/api/agents`, `/api/projects`, `/api/tasks`, `/api/checklists`, `/api/dependencies`, `/api/git`, `/api/import-export`, `/api/canvas`, `/api/backup`, `/api/monitoring`, `/api/ui-layout`, `/api/connectors`. **No automation route.** |
| Route registration `backend/src/server.ts:41-55` | Same set. **No automation route.** |
| Regex scan of `backend/src/**/*.{ts,js,sql}` for automation/workflow/execution/approval/outbox/setInterval/cron/scheduler/queue/idempot | **0 matches** |
| Schema tables (`schema.sql`, live DB) | 18 tables; **no** workflow/automation/execution/approval/environment/outbox/event/queue/job/migration table |
| Background work | No worker, queue, scheduler, cron, `setInterval`, or background loop in `backend/src` (REPORTED by `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:118`; consistent with the zero-match scan above) |
| Live DB inspection (`backend/data/app.db`) | 18 tables; `audit_logs` 0 rows; `agent_activities` 0 rows; `agents` 0 rows; `connectors` 0 rows; `canvas*` 0 rows; **no `agent_tokens` table** |

### 2.3 Authentication and authorization primitives (VERIFIED)

| Primitive | Path:line | State |
|---|---|---|
| `requireAuth` | `backend/src/middleware/auth.middleware.ts:8-22` | Bearer JWT verify; `req.user = { user_id, email, role }`; 401 on missing/invalid |
| `requireRole` | `backend/src/middleware/auth.middleware.ts:24-32` | 403 `{ message: "Insufficient permissions" }`. **Defined but used only in `users.routes.ts:43,56,79`.** |
| JWT secret fallback | `backend/src/middleware/auth.middleware.ts:15`; `backend/src/services/auth.service.ts:37,62,86,123`; `backend/src/services/agentLoginService.ts:35` | Hardcoded fallback `"project-manager-jwt-secret"` — insecure default |
| Token lifetime | `backend/src/services/auth.service.ts:38,63,124`; `agentLoginService.ts:36` | 7 days; no refresh or rotation |
| Token storage (browser) | `frontend/src/hooks/useAuth.tsx:13-17` | `localStorage["pm_user"]` and `localStorage["pm_token"]`; `getToken()` reads `pm_token` |
| Demo users | `backend/src/services/auth.service.ts:8-12` | Hardcoded owner/editor/viewer accounts with bcrypt hashes |
| Agent auth | `backend/src/middleware/agentAuthMiddleware.ts:15-38,40-51` | `verifyAgentAuth` / `verifyAgentRole`; SHA-256 API-key hash lookup |
| Agent registration | `backend/src/services/agentAuthService.ts:33-43` | Inserts into `agents.expires_at` and `agent_tokens` — **neither exists**; registration is broken at runtime |
| Rate limiting | `backend/src/middleware/rateLimit.middleware.ts:3-21`; `index.ts:33-34`; `server.ts:37-38` | Global 100 req / 15 min on `/api`; auth 1000 req / 15 min on `/api/auth` |
| Live roles | `backend/data/app.db` (`users`) | 36 users, **all `role = 'viewer'`**; no owner/editor in the database (REPORTED by `PHASE2_01_SHARED_ARCHITECTURE.md:230`) |

**Conclusion (VERIFIED):** authentication exists; authorization beyond "is a logged-in user" does not. A runtime cannot rely on `users.role` for project-scoped decisions.

### 2.4 Connector service and credential handling (VERIFIED)

| Finding | Evidence | Class |
|---|---|---|
| Connector definitions include password fields | `backend/src/services/connector.service.ts:27-65` | VERIFIED |
| `ConnectorInstance.config` is `Record<string, any>` | `connector.service.ts:15-25` | VERIFIED |
| `listInstances(userId)` filters by `created_by` | `connector.service.ts:76-97` | VERIFIED |
| `getInstance(id)` has **no ownership or project check** | `connector.service.ts:99-114` | VERIFIED |
| `createInstance` writes the full config JSON to `connectors.config` **and** individual rows to `connector_configs` | `connector.service.ts:116-139` | VERIFIED |
| `updateConfig` merges and rewrites both stores | `connector.service.ts:141-171` | VERIFIED |
| `getConfig` returns the raw config including secrets | `connector.service.ts:187-191` | VERIFIED |
| Secret classification is a flag, not encryption | `schema.sql:217-226` (`connector_configs.is_secret`) | VERIFIED |
| Routes use `requireAuth` only; no `requireRole`, no ownership check | `backend/src/routes/connectors.routes.ts:8-147` | VERIFIED |
| GitHub calls interpolate the token into the `Authorization` header | `connector.service.ts:199-201,220-222,241-244,317-319` | VERIFIED |
| Hermes calls interpolate the API key into the `Authorization` header | `connector.service.ts:259-261,278-281,297-299` | VERIFIED |
| No `project_id` on `connectors` | `schema.sql:205-215` | VERIFIED |
| Connector secrets are not redacted in API responses | `connector.service.ts:86-96,103-113`; `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:455` | VERIFIED |
| Frontend receives the config object | `frontend/src/pages/Connectors.tsx:23,113-114`; API returns it at `connectors.routes.ts:13-20,23-31` | VERIFIED |

**Conclusion (VERIFIED):** any authenticated user can read and operate any connector by ID, and the API returns plaintext secrets. This is a blocking prerequisite for any Automation action.

### 2.5 Canvas is a visual surface, not an execution engine (VERIFIED)

| Boundary | Evidence |
|---|---|
| Canvas connection is a visual relationship | `PHASE1_DISCOVERY_DECISION_PACK.md:122`; `PHASE3_03_CANVAS_API_CONTRACT.md:475-478` |
| Canvas API must not expose execution semantics | `PHASE3_03_CANVAS_API_CONTRACT.md:476-478` |
| Canvas tables must not gain automation columns | `PHASE3_03_CANVAS_API_CONTRACT.md:480` |
| Canvas item content is inert data | `PHASE3_03_CANVAS_API_CONTRACT.md:481` |
| No connector side effects from Canvas | `PHASE3_03_CANVAS_API_CONTRACT.md:482` |
| Canvas routes are `requireAuth` only | `backend/src/routes/canvas.routes.ts:8`; `PHASE3_03_CANVAS_API_CONTRACT.md:42,164` |
| Canvas service has no side effects | `backend/src/services/canvas.service.ts` (no connector/automation import) |

### 2.6 Phase 2 / Phase 3 authority documents (VERIFIED)

| Document | Relevant content |
|---|---|
| `PHASE1_DISCOVERY_DECISION_PACK.md:148-153` | Decision C: C1 preview-only (recommended), C2 test-only, C3 live, C4 owner-specified |
| `PHASE1_DISCOVERY_DECISION_PACK.md:155-159` | Decision D: D1 define RBAC/credential/redaction/approval/audit **before** any execution work (recommended) |
| `PHASE1_DISCOVERY_DECISION_PACK.md:111-112` | Automation Studio "Extend"; Automation runtime "Extend / DECISION-REQUIRED" |
| `PHASE1_DISCOVERY_DECISION_PACK.md:121` | Runtime ambiguity is a Critical risk |
| `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:63` | "Automation remains preview-only until a separate runtime specification and explicit owner authorization exist." |
| `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:42-57` | Five-actor permission matrix (owner/editor/viewer/commenter/agent) |
| `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:67-72` | Connector scope, storage, write-only UX, use, redaction, audit |
| `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:78-86` | Backend enforcement requirements |
| `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:110-118` | Runtime/automation boundary; no automation route/worker |
| `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:132-215` | Migration policy and rules |
| `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:218-311` | Transactional outbox and dispatcher |
| `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:315-393` | Idempotency, retry, timeout, cancellation, dedupe, dead letters |
| `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:397-496` | Audit actor/object/redaction/append-only/coverage |
| `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:499-581` | Observability metrics/logs/tracing/alerts |
| `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:610-613` | §8.5 Automation data contract — DECISION-REQUIRED, do not build |
| `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:683` | D9 Automation runtime boundary — not decided |
| `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md:117` | D-09 preview-only for now; separate decision before Phase 4/7 |
| `PHASE3_03_CANVAS_API_CONTRACT.md:470-483` | Seven binding Automation boundaries on Canvas |
| `PHASE3_04_CANVAS_SPEC_APPROVAL.md:45` | Phase 3 recommendation: **REQUEST CHANGES** (owner gate) |
| `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:142` | Phase 3 does not authorize Automation runtime changes |
| `UI_UX_REDESIGN_PLAN.md:173-214` | Automation Studio scope, primitives, guardrails |
| `UI_UX_REDESIGN_PLAN.md:233-234` | Automation foundation is backend/security work; test-only rollout before publish |
| `UI_UX_REDESIGN_PLAN.md:240-241` | Automation Studio remains a clearly marked future surface |
| `handoff_future_uiux.md:51` | Hard rule: never imply a functioning runtime |
| `handoff_future_uiux.md:61-63` | No live automation behavior; no secrets in designs; Canvas/Automation boundary |
| `handoff_future_uiux.md:89` | Live automation publishing requires an authorized owner |
| `handoff_future_uiux.md:114` | Backend API contract recommended before UI |
| `PHASE2_05_SHARED_COMPONENT_CATALOG.md:845-876` | Canvas vs Automation semantic separation; binding terminology rules |

### 2.7 Build, migration, and deployment blockers (VERIFIED / REPORTED)

| Blocker | Evidence | Class |
|---|---|---|
| Backend build fails | `backend/tsconfig.json:19` sets `allowImportingTsExtensions` with no `noEmit`/`emitDeclarationOnly` → TS5096 | REPORTED (`PHASE1_DISCOVERY_DECISION_PACK.md:42`; `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:122`) |
| Docker port mismatch | `docker-compose.yml:12` sets `PORT=4000`; `backend/src/server.ts:98` reads `NODE_PORT \|\| "3000"` | VERIFIED |
| No migration ledger | `backend/src/database/migrations/` is empty; `migrate.ts:4` calls `getDb()` only; `package.json:10-12` references missing `seed.ts`/`reset.ts` | VERIFIED |
| Agent schema drift | `agentAuthService.ts:33-43` vs live `agents` columns (no `expires_at`; no `agent_tokens`) | VERIFIED |
| Schema applied on every first connection | `backend/src/database/index.ts:15-18` — `PRAGMA journal_mode=WAL`, `PRAGMA foreign_keys=ON`, `db.exec(schemaSql)` | VERIFIED |
| Static `/health` | `index.ts:54-56`, `server.ts:58-60` return `{status:"ok", database:"connected"}` without a DB check | VERIFIED |

### 2.8 Test baseline (VERIFIED)

`backend/src/tests/backend.test.ts` (363 lines) contains 15 tests covering auth, project CRUD, task CRUD, dependency management, and checklist CRUD. It contains **no** Automation, workflow, execution, approval, audit, connector, RBAC-enforcement, or redaction test. There is no frontend test runner configured in `frontend/package.json` (REPORTED by `PHASE1_DISCOVERY_DECISION_PACK.md:45`; `PHASE3_04_CANVAS_SPEC_APPROVAL.md:89`).

### 2.9 Card provenance (VERIFIED)

The literal card ID `PM-P4-03` does not appear in `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, or `CHECKLIST.md` (repo-wide search, 0 hits). `KANBAN_BOARD.md:17,51-58` lists Phase 4 as "Views & Power" with cards `VP-001…VP-005`; `ROADMAP.md:92` lists Phase 4 as "Deployment & Monitoring" with `DM-001…DM-004`. The card scope is therefore taken from the delegating instruction and the Phase 4 planning context, not from an in-repo board entry. This mirrors the provenance gap already recorded for `PM-P2-01` (`PHASE2_01_SHARED_ARCHITECTURE.md:9`) and `PM-P3-01…04` (`PHASE3_04_CANVAS_SPEC_APPROVAL.md:41`). **DECISION-REQUIRED:** record the Phase 4 card list and acceptance definitions in the current authority documents.

---

## 3. Runtime boundary options (DECISION-REQUIRED)

The owner must choose one boundary before any runtime work. The options are those defined in `PHASE1_DISCOVERY_DECISION_PACK.md:148-153` and restated in `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:683`.

### 3.1 Option A — Preview-only (RECOMMENDED)

| Aspect | Definition |
|---|---|
| What exists | The static `AutomationStudio.tsx` preview only. |
| Backend runtime | **None.** No routes, tables, services, workers, or executions. |
| Data contracts | Not implemented. The contracts in §4 are the acceptance standard for a later decision. |
| API | None. `/api/automation` is not registered. |
| Credentials | No connector is called by Automation. Existing connector UI remains as-is (and must still be fixed for its own sake). |
| Audit | None for Automation (no events exist). |
| Migration | None for Automation. |
| UI | "Preview only · no runtime connected", disabled Publish, disabled Replay, sample data (`AutomationStudio.tsx:29,30,216,231`). |
| Owner action | Record "preview-only remains in force" and stop. |
| Risk | Lowest. No new attack surface, no new secrets, no new side effects. |
| Cost | The product does not gain automation. |

**Why recommended:** the connector layer is currently unsafe to automate (§2.4), the shared reliability/audit foundation does not exist (§2.6–2.7), and the Phase 3 Canvas specification is still at a REQUEST CHANGES gate (`PHASE3_04:45`). Building a runtime now would be building on an unsafe, unaudited, unapproved base.

### 3.2 Option B — Test-only

| Aspect | Definition |
|---|---|
| What exists | A runtime that can execute a workflow version against **sample or pinned data only**. |
| Backend runtime | In-process executor, no external broker. |
| External side effects | **Forbidden.** No live connector call, no message send, no task mutation, no HTTP write. Connector actions are mocked. |
| Data | Workflow/version/execution tables exist; executions are marked `environment = test`. |
| API | Read/write workflow drafts, versions, test executions, and redacted traces. No publish endpoint. |
| Credentials | No live credential use. `credential_references` may be created but resolve to a test stub. |
| Audit | Full audit of draft/version/test-run/approval events (all synthetic). |
| Migration | Automation tables added via the versioned migration runner. |
| UI | Test run button enabled; Publish and live Execute remain disabled; every test result labelled "test only". |
| Owner action | Approve a test-only scope, a pinned-data policy, and a review path. |
| Risk | Medium-low. Side effects are excluded, but the data model and API still need the full safety contract. |
| Cost | Moderate. Delivers inspectable test runs without live risk. |

### 3.3 Option C — Live

| Aspect | Definition |
|---|---|
| What exists | A runtime that can execute published workflows with real connector calls and real task mutations. |
| Backend runtime | In-process executor with queue/outbox, retries, timeouts, cancellation, dead letters. |
| External side effects | Allowed only for owner-authorized, scope-limited, approved actions. |
| Data | Full contract in §4. |
| API | Full API in §9, including publish, execute, cancel, replay, approvals. |
| Credentials | `credential_references` only; secrets resolved server-side; never in workflow JSON, logs, audit, exports, or UI. |
| Audit | Full immutable audit with actor/trace/before-after/redaction. |
| Migration | Full versioned migration, backup, and rollback plan. |
| UI | Publish/execute/replay enabled only for authorized owners, with explicit confirmation and visible consequences. |
| Owner action | Approve live scope, credential provider, approval policy, retention, and deployment topology. |
| Risk | Highest. Real external writes, real secrets, real blast radius. |
| Cost | Highest. Requires the Phase 2 foundation (migration, outbox, audit, RBAC, connector redaction) to be built and verified first. |

### 3.4 Comparison

| Dimension | A — Preview-only | B — Test-only | C — Live |
|---|---|---|---|
| External side effects | None | None | Allowed with approval |
| Connector secrets used | No | No (stub only) | Yes, reference-only |
| Data model | None | Full, test-marked | Full |
| API surface | None | Draft/version/test/trace | Full + publish/execute/replay |
| Audit | None | Synthetic events | Full immutable |
| Migration | None | Automation tables | Automation tables |
| Prerequisite foundation | None | Phase 2 foundation | Phase 2 foundation, complete |
| Owner gate | Already satisfied by C1 recommendation | New decision | New decision + policy set |
| Recommended | **Yes** | Only after A is deliberately lifted | Only after B and full foundation |

### 3.5 Boundary decision

**PROPOSED: Option A — preview-only.** The boundary remains in force until the owner records a new decision. This contract does not lift it. Any move to B or C requires: (1) an explicit owner decision; (2) a separate implementation card; (3) the Phase 2 foundation built and verified; (4) connector redaction and scope fixed; (5) the migration and test requirements in §10–§11 satisfied.

---

## 4. Proposed data contracts (PROPOSED — gated, do not build until approved)

> Everything in this section is **PROPOSED**. It is the target schema a future test-only or live runtime would use. It is **not** authorized by this card and must not be added to `schema.sql` or the live DB until the owner approves a boundary. All tables are project-scoped and use UUID TEXT primary keys, consistent with the existing schema conventions (`schema.sql:4-246`).

### 4.1 `workflows`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `workflow_id` | TEXT | PRIMARY KEY | UUID |
| `project_id` | TEXT | NOT NULL REFERENCES `projects(project_id)` | Every workflow belongs to exactly one project |
| `name` | TEXT | NOT NULL, 1–120 chars | Unique per project |
| `description` | TEXT | NULL, ≤2000 chars | |
| `status` | TEXT | NOT NULL, default `'draft'` | `draft \| test \| published \| paused \| archived` |
| `current_version_id` | TEXT | NULL REFERENCES `workflow_versions(version_id)` | The currently published/testable version |
| `created_by` | TEXT | NOT NULL REFERENCES `users(user_id)` | Human author |
| `created_by_agent_id` | TEXT | NULL REFERENCES `agents(agent_id)` | Set only when an agent drafted on behalf of a user |
| `created_at` | TEXT | NOT NULL, ISO 8601 | |
| `updated_at` | TEXT | NOT NULL, ISO 8601 | |
| — | — | UNIQUE(`project_id`, `name`) | |

### 4.2 `workflow_versions`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `version_id` | TEXT | PRIMARY KEY | UUID |
| `workflow_id` | TEXT | NOT NULL REFERENCES `workflows(workflow_id)` ON DELETE CASCADE | |
| `version_number` | INTEGER | NOT NULL, ≥1 | Monotonic per workflow |
| `definition_json` | TEXT | NOT NULL | Nodes, edges, node configs, positions. Redacted. No secrets. |
| `definition_hash` | TEXT | NOT NULL | SHA-256 of the canonical definition, for drift detection |
| `schema_version` | INTEGER | NOT NULL | Version of the workflow schema this definition uses |
| `is_reviewed` | INTEGER | NOT NULL DEFAULT 0 | Set only by an authorized reviewer |
| `review_note` | TEXT | NULL | |
| `created_by` | TEXT | NOT NULL | user_id or agent_id |
| `created_at` | TEXT | NOT NULL | |
| `published_at` | TEXT | NULL | |
| — | — | UNIQUE(`workflow_id`, `version_number`) | |

**Immutability rule:** a version is immutable once created. Editing a draft means creating a new version. A published version is never edited; a new version is required.

### 4.3 `workflow_nodes` and `workflow_edges`

Normalized for queryability and per-node audit. Alternatively the same data may live in `definition_json`, but the runtime must still expose per-node records for execution traces.

**`workflow_nodes`**

| Column | Type | Constraints |
|---|---|---|
| `node_id` | TEXT | PRIMARY KEY |
| `version_id` | TEXT | NOT NULL REFERENCES `workflow_versions(version_id)` ON DELETE CASCADE |
| `node_type` | TEXT | NOT NULL — `trigger \| transform \| decision \| action \| human_gate \| error_handler` |
| `name` | TEXT | NOT NULL, 1–120 chars |
| `config_json` | TEXT | NOT NULL — redacted; no secrets |
| `credential_reference_id` | TEXT | NULL REFERENCES `credential_references(credential_reference_id)` |
| `position_x`, `position_y` | REAL | NOT NULL DEFAULT 0 |
| `created_at` | TEXT | NOT NULL |

**`workflow_edges`**

| Column | Type | Constraints |
|---|---|---|
| `edge_id` | TEXT | PRIMARY KEY |
| `version_id` | TEXT | NOT NULL REFERENCES `workflow_versions(version_id)` ON DELETE CASCADE |
| `from_node_id` | TEXT | NOT NULL REFERENCES `workflow_nodes(node_id)` |
| `to_node_id` | TEXT | NOT NULL REFERENCES `workflow_nodes(node_id)` |
| `branch_label` | TEXT | NULL — e.g. `YES`, `NO` |
| `condition_expr` | TEXT | NULL — deterministic expression, no secrets |

**Semantic boundary:** a workflow edge is **control flow**. It must never be stored on `canvas_connections`, and a Canvas connection must never be interpreted as a workflow edge (`PHASE3_03_CANVAS_API_CONTRACT.md:475-478`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md:852`).

### 4.4 `environments` (workflow environments)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `environment_id` | TEXT | PRIMARY KEY | UUID |
| `project_id` | TEXT | NOT NULL REFERENCES `projects(project_id)` | |
| `name` | TEXT | NOT NULL | e.g. `test`, `staging`, `live` |
| `mode` | TEXT | NOT NULL | `preview \| test \| live` |
| `is_live` | INTEGER | NOT NULL DEFAULT 0 | Exactly one live environment per project (PROPOSED) |
| `created_by` | TEXT | NOT NULL | |
| `created_at` | TEXT | NOT NULL | |
| — | — | UNIQUE(`project_id`, `name`) | |

**Rule:** `mode = live` is the only mode that may perform external side effects. `mode = test` must use pinned/sample data and mocked connectors. `mode = preview` renders only.

### 4.5 `executions`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `execution_id` | TEXT | PRIMARY KEY | UUID |
| `workflow_id` | TEXT | NOT NULL REFERENCES `workflows(workflow_id)` | |
| `version_id` | TEXT | NOT NULL REFERENCES `workflow_versions(version_id)` | The immutable version that ran |
| `environment_id` | TEXT | NOT NULL REFERENCES `environments(environment_id)` | |
| `status` | TEXT | NOT NULL | `pending \| running \| awaiting_approval \| succeeded \| failed \| cancelled \| timed_out` |
| `trigger_type` | TEXT | NOT NULL | `event \| manual \| schedule \| retry \| replay` |
| `trigger_actor_type` | TEXT | NOT NULL | `user \| agent \| system \| automation` |
| `trigger_actor_id` | TEXT | NULL | |
| `idempotency_key` | TEXT | NOT NULL UNIQUE | Duplicate-run guard |
| `trace_id` | TEXT | NOT NULL | Propagated to every step |
| `approval_id` | TEXT | NULL REFERENCES `approvals(approval_id)` | |
| `attempt_count` | INTEGER | NOT NULL DEFAULT 0 | |
| `error_class` | TEXT | NULL | `retryable \| permanent` |
| `error_message` | TEXT | NULL | Redacted, generic |
| `started_at` | TEXT | NULL | |
| `completed_at` | TEXT | NULL | |
| `cancel_requested_by` | TEXT | NULL | |
| `cancel_requested_at` | TEXT | NULL | |
| `cancel_reason` | TEXT | NULL | |
| `cancelled_at` | TEXT | NULL | |
| `created_at` | TEXT | NOT NULL | |

### 4.6 `execution_steps`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `step_id` | TEXT | PRIMARY KEY | UUID |
| `execution_id` | TEXT | NOT NULL REFERENCES `executions(execution_id)` ON DELETE CASCADE | |
| `node_id` | TEXT | NOT NULL REFERENCES `workflow_nodes(node_id)` | |
| `node_type` | TEXT | NOT NULL | Denormalized for trace queries |
| `attempt` | INTEGER | NOT NULL DEFAULT 1 | |
| `status` | TEXT | NOT NULL | `pending \| running \| succeeded \| failed \| skipped \| cancelled` |
| `input_json` | TEXT | NULL | Redacted |
| `output_json` | TEXT | NULL | Redacted |
| `credential_reference_id` | TEXT | NULL | Reference only; never the secret |
| `idempotency_key` | TEXT | NOT NULL | Per-step dedupe |
| `started_at`, `ended_at` | TEXT | NULL | |
| `duration_ms` | INTEGER | NULL | |
| `error_class` | TEXT | NULL | |
| `error_message` | TEXT | NULL | Redacted |
| `created_at` | TEXT | NOT NULL | |

### 4.7 `approvals` (human gates)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `approval_id` | TEXT | PRIMARY KEY | UUID |
| `execution_id` | TEXT | NULL REFERENCES `executions(execution_id)` | Null for publish approvals |
| `step_id` | TEXT | NULL REFERENCES `execution_steps(step_id)` | |
| `workflow_id` | TEXT | NOT NULL REFERENCES `workflows(workflow_id)` | |
| `version_id` | TEXT | NULL | |
| `approval_type` | TEXT | NOT NULL | `publish \| execute \| connector_action \| replay_side_effect` |
| `status` | TEXT | NOT NULL | `pending \| granted \| rejected \| expired \| cancelled` |
| `requested_by_type` | TEXT | NOT NULL | `user \| agent \| automation` |
| `requested_by_id` | TEXT | NOT NULL | |
| `requested_at` | TEXT | NOT NULL | |
| `reviewer_id` | TEXT | NULL REFERENCES `users(user_id)` | Must be a human owner |
| `decided_at` | TEXT | NULL | |
| `decision_note` | TEXT | NULL | |
| `expires_at` | TEXT | NOT NULL | Default 24h (`PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:362`) |
| `idempotency_key` | TEXT | NOT NULL UNIQUE | |
| `created_at` | TEXT | NOT NULL | |

**Separation of duties:** the requester may never be the reviewer. An agent may request; only a human owner may grant or reject. An approval is single-use and expires.

### 4.8 `credential_references`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `credential_reference_id` | TEXT | PRIMARY KEY | UUID |
| `project_id` | TEXT | NOT NULL REFERENCES `projects(project_id)` | |
| `connector_id` | TEXT | NULL REFERENCES `connectors(connector_id)` | |
| `environment_id` | TEXT | NULL REFERENCES `environments(environment_id)` | |
| `reference` | TEXT | NOT NULL | Pointer to the secret store (e.g. vault path). **Not the secret.** |
| `provider_scopes` | TEXT | NOT NULL DEFAULT '[]' | JSON array of allowed scopes/operations |
| `created_by` | TEXT | NOT NULL | |
| `created_at` | TEXT | NOT NULL | |
| `rotated_at` | TEXT | NULL | |
| `expires_at` | TEXT | NULL | |
| `revoked_at` | TEXT | NULL | |
| `last_verified_at` | TEXT | NULL | |

**Hard rules:**

1. The secret value is **never** stored in this table, in `workflows.definition_json`, in any workflow node config, in an execution, in a step trace, in an audit record, in a log, in an export, or in the browser.
2. `reference` is itself treated as sensitive and is redacted in API responses and audit records.
3. A credential reference is usable only by workflows in the same project, in the same environment, and only for the listed scopes/operations.
4. Test mode resolves to a stub; it must not call the live provider.
5. No role, including owner, may read back a secret value. The API exposes only `configured: true`, status, scopes, and timestamps (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:69`).

### 4.9 `idempotency_keys`

| Column | Type | Constraints |
|---|---|---|
| `key` | TEXT | PRIMARY KEY |
| `request_hash` | TEXT | NOT NULL |
| `response_snapshot` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL |
| `expires_at` | TEXT | NOT NULL — default 24h (`PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:322`) |

### 4.10 State machines

**Workflow:**

```
draft ──test──▶ test ──publish (owner + review + approval)──▶ published
  ▲                 │                                             │
  └──────archive────┴────────────pause─────────────────────────────┘
```

- `published` is immutable; changes require a new version.
- `paused` stops new executions; running executions continue or are cancelled per policy.
- `archived` is read-only and hidden from the active list.

**Execution:**

```
pending ──▶ running ──▶ succeeded
   │           │
   │           ├──▶ awaiting_approval ──▶ running ──▶ succeeded
   │           │
   │           ├──▶ failed
   │           ├──▶ cancelled
   │           └──▶ timed_out
```

**Approval:**

```
pending ──▶ granted
   │
   ├──▶ rejected
   ├──▶ expired
   └──▶ cancelled
```

---

## 5. Permissions and connector credential scope

### 5.1 Principal model (PROPOSED)

Authorization is **project-scoped**, consistent with `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:24,40-57`. A human must have an active membership for the target project. `users.role` is not used for project permission decisions. An agent is a non-human principal with default-deny access and an explicit allow-list (`PHASE2_02:34`).

### 5.2 Automation permission matrix (PROPOSED)

`R` = read; `C` = create; `U` = update; `D` = delete. All access is project-scoped and membership-checked.

| Capability | Owner | Editor | Viewer | Commenter | Agent (default deny) |
|---|---|---|---|---|---|
| Read workflows, versions, executions, traces | R | R | R | R | Only with explicit grant |
| Create/update/delete drafts | C/U/D | C/U/D | — | — | Only with `workflow.draft.*` grant |
| Create a new version | C | C | — | — | Only with grant |
| Run a **test** execution | Yes | Yes | — | — | Only with grant; never self-approved |
| Publish a version | **Disabled now.** After approval: owner only, reviewed version, explicit confirmation, audit | No | No | No | Never |
| Execute a published workflow (live) | **Disabled now.** After approval: owner only, per-run approval for side effects | No | No | No | Never self-start or self-approve |
| Approve/reject a human gate | Owner only; never the requester | No | No | No | Never |
| Cancel an execution | Owner; initiator | Owner | — | — | Only with grant |
| Replay a step/execution | **Disabled now.** After approval: owner only, non-side-effecting nodes by default | No | No | No | Never |
| Read approval queue | R | R (project) | — | — | Only with grant |
| Manage credential references | Owner (write-only) | Request change only | — | — | Never |
| Read a secret value | **Never** | **Never** | **Never** | **Never** | **Never** |
| Read redacted execution traces | R | R | R | R | Only with grant |

### 5.3 Connector credential scope (PROPOSED)

1. **Binding:** each connector and credential reference is bound to one project, one provider, one environment, and a minimum set of provider scopes/operations (`PHASE2_02:67`).
2. **Storage:** a server-side credential reference plus safe metadata. Secrets resolve only inside the backend operation that needs them, through a deployment-approved credential provider. Raw credentials never enter workflow JSON, database config fields, browser storage, URLs, or task metadata (`PHASE2_02:68`).
3. **Write-only:** owners set/rotate/revoke through an authorized write-only operation. After save, every role receives only `configured: true`, status, scopes, and update time (`PHASE2_02:69`).
4. **Use:** a connector runner receives only the exact credential reference and provider operation it needs. Agents and workflows receive neither a secret-read API nor a reusable credential value (`PHASE2_02:70`).
5. **Test mode:** mock/pinned data only, unless a separately authorized live health check is confirmed (`PHASE2_02:70`).
6. **Existing connector records:** because `connectors` has no `project_id` (`schema.sql:205-215`), existing records must be explicitly mapped or quarantined before any cross-user/project access. Never fall back to global visibility or creator-only inference (`PHASE2_02:67`).

### 5.4 Backend enforcement requirements (PROPOSED — mandatory)

1. Authenticate first; authorize every request. 401 for missing/invalid identity; identity comes from verified authentication, never from a request-body field (`PHASE2_02:78`).
2. Resolve the project from the resource server-side; verify active membership and action. Scope all list/search/count queries. Authorize both current and destination project on moves. Fail closed on missing, null, or conflicting ownership (`PHASE2_02:79`).
3. Enforce `authorize(actor, project, resource, action)` at the service boundary, not only in route middleware (`PHASE2_02:80`).
4. Protect against IDOR and escalation. Reject user-supplied owner, role, project, membership, creator, scope, agent grant, or audit actor overrides (`PHASE2_02:81`).
5. Fail closed on roles and scopes. Unknown role, inactive membership, expired/revoked grant, unmapped connector, or policy lookup failure means deny (`PHASE2_02:82`).
6. Write audit atomically with the mutation where feasible; redact before persistence (`PHASE2_02:83`).
7. Test at API and service levels, including cross-project ID substitution, role revocation, and connector canary secrets (`PHASE2_02:84`).

### 5.5 Response semantics (PROPOSED)

| HTTP | Meaning |
|---|---|
| 401 | Unauthenticated |
| 403 | Authenticated but unauthorized |
| 404 | Absent or deliberately concealed resource |
| 400/422 | Invalid request |
| 409 | Membership/ownership/version conflict |
| 423 | Runtime disabled (Automation boundary not approved) |
| 429 | Rate limited |
| 500 | Unexpected failure; generic message only |

**PROPOSED:** 404 for reads of inaccessible resources, 403 for writes, to avoid existence probing while giving writers a clear signal (`PHASE3_03_CANVAS_API_CONTRACT.md:225`). While the runtime is disabled, Automation endpoints return **423 `RUNTIME_DISABLED`** if they are registered at all.

---

## 6. Redaction contract (PROPOSED)

Derived from `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:441-457` and `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:71`.

| Class | Fields | Handling |
|---|---|---|
| `secret` | passwords, API keys, tokens, JWTs, connector secrets, `password_hash`, `api_key_hash`, credential `reference` values | **Never stored or returned.** Replaced with `[REDACTED]`. |
| `pii` | email, device fingerprint, IP (optional), username | Masked by default (`u***@example.com`); full value only for owner/admin with a `read_sensitive` audit record. |
| `financial` | future billing/cost fields | Masked unless role permits. |
| `internal` | internal IDs, paths, stack traces | Stored as-is but never returned in public APIs. |

**Rules:**

1. A single shared redaction module is used by API serialization, logging, audit, outbox, export, and error reporting (`PHASE2_03:456`).
2. Redaction is applied **before** the audit row is written, not at read time (`PHASE2_03:453`).
3. Redaction is applied to `outbox_events.payload`, logs, exports, error messages, UI previews, and screenshots (`PHASE2_03:454`).
4. `connector_configs.value` where `is_secret = 1` must never appear in any API response, log, export, or screenshot (`PHASE2_03:455`).
5. Workflow node configs, execution step inputs/outputs, and trace payloads are redacted before persistence.
6. Provider error detail is kept in protected diagnostics only after redaction; the API returns a generic safe error with a `request_id` (`PHASE2_02:71`).
7. Redaction must be testable: a unit test asserts that no known secret pattern appears in any serialized audit/outbox/log/export payload (`PHASE2_03:457`).
8. Frontend masking is never the only control (`PHASE2_02:71`).

---

## 7. Audit contract (PROPOSED)

Derived from `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:397-496`.

### 7.1 Actor model

| Field | Requirement |
|---|---|
| `actor_type` | `user \| agent \| system \| automation \| anonymous` |
| `actor_id` | user_id / agent_id / `system` / execution_id |
| `actor_display` | Resolved at read time; never the only identity |
| `session_id` | JWT session identifier or agent token hash prefix |
| `on_behalf_of` | Delegating user_id when an agent acts for a user |
| `api_key_fingerprint` | SHA-256 prefix (first 12 chars), never the key |
| `ip_address`, `user_agent` | Caller IP; truncated UA |
| `request_id` | Correlation ID from the HTTP layer |
| `trace_id` | Execution/run trace ID |

### 7.2 Object model

`target_table`, `target_id`, `target_sub_id`, `target_parent_id`, `target_summary`, `project_id`, `action`, `trigger`.

**Automation actions:** `workflow.created`, `workflow.updated`, `workflow.archived`, `version.created`, `workflow.published`, `workflow.paused`, `execution.started`, `execution.step_completed`, `execution.step_failed`, `execution.completed`, `execution.failed`, `execution.cancelled`, `execution.timed_out`, `approval.requested`, `approval.granted`, `approval.rejected`, `approval.expired`, `credential_reference.created`, `credential_reference.rotated`, `credential_reference.revoked`, `credential_reference.used`, `replay.requested`, `replay.denied`.

**Triggers:** `ui \| api \| agent \| automation \| system \| import \| migration \| backup`.

### 7.3 Before / after

- Create: `old_value = NULL`, `new_value = full redacted snapshot`.
- Update: field-level diff preferred; full snapshots for deletes.
- Delete: `old_value = full redacted snapshot`, `new_value = NULL`.
- Snapshots are taken inside the same transaction as the change.
- Large payloads: store `before_hash` / `after_hash` plus a truncated preview; full value in cold storage.
- `reasoning_summary` is required for agent/automation actions, capped at 2,000 chars, and never contains secrets.

### 7.4 Immutability and retention

- Audit rows are append-only. No update/delete routes. SQLite triggers `RAISE(ABORT)` on `UPDATE`/`DELETE` as defense in depth (`PHASE2_03:461-462`).
- Retention: hot 90 days; archive after 90 days; delete after 7 years unless a legal hold applies (`PHASE2_03:463`). **DECISION-REQUIRED:** owner + legal.
- A tamper-evidence chain is **PROPOSED** and required before any regulated use (`PHASE2_03:465`).

### 7.5 Coverage matrix (Automation-specific)

| Domain | Create | Update | Delete | Read-sensitive | Approve/Reject | Execute/Cancel |
|---|---|---|---|---|---|---|
| workflows | ✅ | ✅ | ✅ | — | — | — |
| workflow_versions | ✅ | — | — | — | — | — |
| executions | ✅ | — | — | ✅ | — | ✅ |
| execution_steps | ✅ | — | — | ✅ | — | — |
| approvals | ✅ | — | — | — | ✅ | — |
| credential_references | ✅ | ✅ (rotate) | ✅ (revoke) | ✅ | — | — |
| environments | ✅ | ✅ | ✅ | — | — | — |

`✅` = required. Today **none** of these are written (`PHASE2_03:486`).

---

## 8. Reliability: retries, timeouts, idempotency, cancellation, replay (PROPOSED)

Derived from `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:315-393`.

### 8.1 Idempotency

1. **API idempotency key.** Mutating endpoints accept `Idempotency-Key: <uuid>`. The key is stored with a TTL (default 24h) in `idempotency_keys`. A repeated key returns the stored response without re-executing (`PHASE2_03:322`).
2. **Outbox dedupe.** `outbox_events.idempotency_key` is `UNIQUE` (`PHASE2_03:323`).
3. **Consumer dedupe.** Handlers record processed `event_id`s in `processed_events` (`PHASE2_03:324`).
4. **Natural keys.** `execution_id`, `step_id`, `approval_id` are unique at the DB layer.
5. **No read-then-write idempotency.** Check-then-act is not idempotent under concurrency (`PHASE2_03:326`).
6. **Per-step idempotency.** Each `execution_steps.idempotency_key` is unique per `(execution_id, node_id, attempt)`.

### 8.2 Retry

| Parameter | Default |
|---|---|
| Max attempts | 8 |
| Backoff | Exponential, base 1s, factor 2 |
| Max backoff | 30s |
| Jitter | ±20% full jitter |
| Retryable classes | Network error, timeout, HTTP 408, 425, 429, 5xx, SQLite `SQLITE_BUSY`/`SQLITE_LOCKED` |
| Non-retryable classes | HTTP 400/401/403/404/409/422, validation error, schema error, auth error, permission error |

- Retry is per-event and per-handler; a retry re-runs the handler from its recorded input, not the whole workflow (`PHASE2_03:345`).
- `Retry-After` from HTTP 429/503 is honored when within the max backoff ceiling (`PHASE2_03:346`).
- After max attempts the row moves to `dead` with `last_error`, `last_error_class='retryable'`, and a full payload snapshot (`PHASE2_03:347`).
- A dead-letter review UI/API is required before any live side-effecting action is allowed (`PHASE2_03:348`).
- Retry state is visible: `attempt_count`, `next_attempt_at`, and `outbox_attempts` (`PHASE2_03:349`).

### 8.3 Timeouts

| Handler class | Timeout |
|---|---|
| Default | 15s |
| Connector HTTP (GitHub, etc.) | 10s |
| LLM provider call | 60s |
| Database write | 5s |
| Webhook delivery | 10s |
| Human approval wait | 24h (SLA timer, not a timeout) |
| Whole execution | 15m (configurable per workflow) |

All outbound `fetch` calls use `AbortController`; `Promise.race` is not sufficient because it does not cancel the underlying socket (`PHASE2_03:365`).

### 8.4 Cancellation

- Every execution has `cancel_requested_by`, `cancel_requested_at`, `cancel_reason`, `cancelled_at` (`PHASE2_03:370`).
- Cancellation is cooperative: the runtime checks a cancellation flag before each node and **before any side effect** (`PHASE2_03:371`).
- A committed side effect cannot be uncancelled; the run transitions to `cancelling`, stops launching further nodes, records the partial outcome, and emits `execution.cancelled` with the list of skipped nodes (`PHASE2_03:372`).
- Human gates have an expiry timer; expiry emits `approval.expired` and is a distinct outcome, not a failure (`PHASE2_03:373`).
- Cancellation is authorized by RBAC: only the initiator, the target owner, or an admin may cancel (`PHASE2_03:374`).

### 8.5 Replay

- Replay is allowed only for **non-side-effecting** nodes by default (`PHASE2_03:391`; `UI_UX_REDESIGN_PLAN.md:211`).
- A replay that could send, write, or change status requires an explicit reviewed mode, a new `execution_id`, and a fresh audit trail (`PHASE2_03:391`).
- Replay is owner-only and disabled while the runtime boundary is preview-only.
- A cancelled run is idempotent-safe to resume only via an explicit, reviewed replay (`PHASE2_03:375`).

### 8.6 Dead letters

- Dead rows are retained for 30 days, then archived. A dead row is inspectable with its payload, error, and attempt history (`PHASE2_03:392`).
- A handler that fails N times in a row on the same payload is quarantined and alerts; it is never silently dropped (`PHASE2_03:393`).

---

## 9. API schemas and failure behavior (PROPOSED — gated)

> **No endpoint in this section exists or is registered.** While the boundary is preview-only, `/api/automation` is not mounted and any accidental request returns 404. If a future boundary is approved, these endpoints are the contract.

### 9.1 Conventions

- **Base path:** `/api/automation` (PROPOSED). API versioning is **DECISION-REQUIRED**: `/api/v1/automation` (recommended), content negotiation, or unversioned.
- **Auth:** `Authorization: Bearer <jwt>` on every request; `requireAuth` plus project-scoped authorization. Agent tokens accepted only where an agent grant exists.
- **Content type:** `application/json; charset=utf-8`.
- **IDs:** UUID v4 strings.
- **Timestamps:** ISO 8601 UTC strings.
- **Idempotency:** `Idempotency-Key` header on all mutating endpoints.
- **Unified error envelope:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "details": [
      { "field": "name", "code": "REQUIRED", "message": "name is required" }
    ],
    "request_id": "req_01H…"
  }
}
```

The server never returns stack traces, SQL, driver messages, credentials, auth headers, or raw provider payloads.

### 9.2 Status codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed body or field constraint violation |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired token |
| 403 | `FORBIDDEN` | Authenticated but not permitted |
| 404 | `WORKFLOW_NOT_FOUND` / `EXECUTION_NOT_FOUND` / `APPROVAL_NOT_FOUND` / `ENVIRONMENT_NOT_FOUND` / `CREDENTIAL_REFERENCE_NOT_FOUND` | Absent or deliberately concealed |
| 409 | `VERSION_CONFLICT` / `CONFLICT` | Stale version; uniqueness/semantic conflict |
| 422 | `SEMANTIC_ERROR` | Well-formed but invalid in context |
| 423 | `RUNTIME_DISABLED` | Automation boundary not approved |
| 429 | `RATE_LIMITED` | Too many requests; includes `Retry-After` |
| 500 | `INTERNAL_ERROR` | Unexpected failure; generic message only |
| 503 | `SERVICE_UNAVAILABLE` | Dependency unavailable; includes `Retry-After` |

### 9.3 Endpoint inventory (PROPOSED)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/automation/workflows?project_id=&status=` | List workflows (project-scoped, paginated) |
| POST | `/api/automation/workflows` | Create a draft workflow |
| GET | `/api/automation/workflows/:id` | Read a workflow with versions |
| PUT | `/api/automation/workflows/:id` | Update draft metadata |
| DELETE | `/api/automation/workflows/:id` | Archive/delete a draft |
| POST | `/api/automation/workflows/:id/versions` | Create an immutable version |
| GET | `/api/automation/workflows/:id/versions` | List versions |
| POST | `/api/automation/workflows/:id/publish` | Publish a reviewed version (owner only, approval required) |
| POST | `/api/automation/workflows/:id/pause` | Pause a published workflow |
| POST | `/api/automation/workflows/:id/archive` | Archive a workflow |
| POST | `/api/automation/workflows/:id/test` | Run a test execution (test environment only) |
| GET | `/api/automation/executions?project_id=&status=` | List executions |
| GET | `/api/automation/executions/:id` | Read an execution with redacted step trace |
| POST | `/api/automation/executions/:id/cancel` | Cancel a running execution |
| POST | `/api/automation/executions/:id/replay` | Replay non-side-effecting nodes (owner only) |
| GET | `/api/automation/approvals?status=` | List approval requests |
| POST | `/api/automation/approvals/:id/decision` | Grant/reject (owner only, never the requester) |
| GET | `/api/automation/environments?project_id=` | List environments |
| POST | `/api/automation/environments` | Create an environment |
| GET | `/api/automation/credential-references?project_id=` | List references (no secret values) |
| POST | `/api/automation/credential-references` | Create a reference (write-only) |
| POST | `/api/automation/credential-references/:id/rotate` | Rotate (write-only) |
| DELETE | `/api/automation/credential-references/:id` | Revoke |

### 9.4 Failure behavior

- **Safe methods:** `GET` is safe and idempotent; clients may retry freely.
- **Idempotent methods:** `PUT` and `DELETE` are idempotent only with `Idempotency-Key` or when the resource is already gone.
- **Create (`POST`):** retried only with the same `Idempotency-Key`; otherwise a network failure leaves the create ambiguous and the client must refetch.
- **Retry policy:** exponential backoff on 5xx and 429, max 3 attempts, `Retry-After` honored on 429. Never retry 4xx except 409 (after refetching and re-applying).
- **Driver error mapping:** `SQLITE_CONSTRAINT FOREIGN KEY` → 404/422; `SQLITE_BUSY` → 429 or 503 with `Retry-After`; never 500 with raw driver text.
- **Partial failure:** no batch endpoints in v1. If added later, they must be atomic or return per-item results with a `207 Multi-Status` envelope (`PHASE3_03_CANVAS_API_CONTRACT.md:454`).
- **Timeouts:** server responds within 5s for reads and 10s for writes; clients time out at 15s and treat the result as unknown (refetch).
- **Runtime disabled:** while the boundary is preview-only, all Automation endpoints return 423 `RUNTIME_DISABLED` if registered; the recommended state is that they are not registered at all.
- **Audit:** every successful mutation and every denied sensitive operation writes an audit row with server-derived actor/project/resource/action/outcome and `request_id`.

---

## 10. Migration requirements (PROPOSED — gated)

Derived from `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:132-215`.

1. **Ledger first.** Add `schema_migrations` and the versioned runner before any Automation table. The current `backend/src/database/migrations/` is empty and `migrate.ts:4` is a no-op (VERIFIED).
2. **Fresh-install parity.** Every migration must be reflected in `schema.sql` so a new database is created at the latest version in one step (`PHASE2_03:136`).
3. **Additive-first.** Automation tables are new tables and new indexes; adding them is allowed without owner approval under the Phase 2 rules (`PHASE2_03:160`). Renames and destructive changes require expand/contract and owner approval (`PHASE2_03:162-163`).
4. **Versioned, immutable files.** `0001_…`, `0002_…`, checksum SHA-256, applied in a single transaction, recorded with `(version, name, applied_at, checksum, duration_ms)` (`PHASE2_03:146-150`).
5. **Baseline adoption.** A `0000_baseline.sql` must record the current 18-table schema as the starting point; existing databases are adopted at baseline without re-creating tables (`PHASE2_03:172-181`).
6. **No automatic migration on container start** without an explicit `RUN_MIGRATIONS` flag; recommended off by default (`PHASE2_03:196`).
7. **Rollback.** Every non-additive migration ships with a documented reverse migration (`PHASE2_03:201`). Production rollback is restore-from-backup → `PRAGMA quick_check` → previous release → health check (`PHASE2_03:202`).
8. **Pre-requisite fixes.** `TS5096` and the Docker port mismatch must be fixed before any migration runs in production (`PHASE2_03:195`).
9. **No migration is authorized by this card.** The schema in §4 is the target, not an instruction to alter `schema.sql` or the live DB.

---

## 11. Test requirements (PROPOSED — gated)

Derived from `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:628-633`, `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:84`, and `PHASE3_03_CANVAS_API_CONTRACT.md:487-517`.

### 11.1 Migration tests

- Apply all migrations to a scratch DB; assert the final schema matches `schema.sql`.
- Re-run the runner; assert it is a no-op.
- Tamper with a migration file; assert the runner refuses to start on checksum drift.
- Run a reverse migration; assert it restores the prior state.

### 11.2 Authorization tests

- Table-driven role/action tests for every Automation endpoint: owner, editor, viewer, commenter, agent.
- Cross-project ID substitution for workflow, version, execution, approval, environment, and credential-reference IDs.
- Role revocation and membership expiry invalidate authorization before the next request.
- Agent default-deny and explicit-grant cases.
- Publish/execute/replay denial while the runtime boundary is preview-only (expect 423 or 404).
- Separation of duties: a requester cannot approve their own gate.

### 11.3 Redaction tests

- Canary secrets in every API response, log line, audit row, outbox payload, export, and error message.
- `connector_configs.value` with `is_secret = 1` never appears anywhere.
- Credential `reference` values are redacted.
- Workflow node configs and execution step I/O are redacted before persistence.

### 11.4 Reliability tests

- Idempotency-key replay returns the stored response without re-executing.
- Duplicate event with the same `idempotency_key` is ignored.
- Poison message after N failures moves to `dead` and alerts.
- Timeout via `AbortController` actually cancels the outbound socket.
- Cancellation before a side effect prevents it; cancellation after a side effect records the partial outcome.
- Replay of a side-effecting node is denied by default.

### 11.5 Audit tests

- Every row in the §7.5 coverage matrix produces an audit row.
- Actor resolution for user, agent, and automation.
- Append-only enforcement (trigger aborts `UPDATE`/`DELETE`).
- Before/after snapshots are redacted.

### 11.6 Failure and API tests

- 401/403/404/409/422/423/429/500 mappings.
- Driver errors never surface as raw `SQLITE_*` text.
- `request_id` is present on every error.
- Pagination and `has_more` correctness.

### 11.7 Frontend tests

- Automation Studio still renders "Preview only · no runtime connected".
- Publish and Replay controls remain disabled.
- No `fetch` call is made from the preview.
- No secret or credential value is rendered.
- Canvas and Automation terminology remain separate.

### 11.8 Verification gates

- `npm run typecheck` and `npm run build` pass in both `backend/` and `frontend/`.
- Backend tests pass; new Automation tests pass.
- No linter errors.
- Manual QA of the preview-only boundary.

---

## 12. Explicit no-implied-runtime rule

This rule is **binding** and supersedes any convenience, mock, or prototype.

1. **No runtime exists.** Nothing in this repository implements Automation execution. This contract defines a future capability; it does not authorize one.
2. **No UI may imply a runtime.** `AutomationStudio.tsx` must keep the "Preview only · no runtime connected" notice, the disabled Publish button, the disabled Replay control, and the sample-data labels (`AutomationStudio.tsx:29,30,82,216,231`). No screenshot, mockup, demo, or prototype may present Automation as live.
3. **No API route may be registered** for Automation until the owner approves a boundary. While preview-only, `/api/automation` is not mounted.
4. **No data model may ride on Canvas.** Canvas tables must not gain `workflow_id`, `execution_id`, `trigger_config`, or any automation column (`PHASE3_03_CANVAS_API_CONTRACT.md:480`).
5. **A Canvas connection is not a workflow edge.** Canvas `line`/`arrow` is a visual relationship; Automation edges are control flow. They must never share a data model or a misleading name (`PHASE3_03:475-478`; `PHASE2_05:852`).
6. **A test preview is not a live right.** A test run, sample data, or pinned-data execution grants no publish, execute, or credential authority.
7. **No credential value may appear** in workflow JSON, node config, execution trace, audit record, log, export, screenshot, or browser storage.
8. **Drafting is not publishing; publishing is not execution.** Each transition requires its own authorization and audit record (`PHASE2_02:63`).
9. **Any implementation requires a separate card** with its own owner approval, migration, and test plan. This contract is the acceptance standard, not an implementation authorization.
10. **The preview-only boundary remains in force** until the owner records a new decision. This document does not lift it.

---

## 13. Unresolved decisions (DECISION-REQUIRED)

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **AD-1** | Automation runtime boundary | Preview-only / test-only / live | **Preview-only** (`PHASE1_DISCOVERY_DECISION_PACK.md:150`; `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md:117`) |
| **AD-2** | API versioning | `/api/v1/automation` / content negotiation / unversioned | `/api/v1/automation` |
| **AD-3** | Role model | Global `users.role` / project-scoped membership | Project-scoped membership (`PHASE2_02:24`); resolve the cross-phase conflict with `PHASE3_03:240` |
| **AD-4** | Credential provider | OS credential store / managed vault / KMS | Owner + security decision; never store the key beside the ciphertext (`PHASE2_02:74`) |
| **AD-5** | Approval model | Single owner / multi-approver / delegation | Single owner with separation of duties; no self-approval |
| **AD-6** | Side-effecting action policy | Deny all / allow-list / per-action approval | Allow-list + per-run approval for live |
| **AD-7** | Replay policy | Non-side-effecting only / reviewed mode / unrestricted | Non-side-effecting only by default (`PHASE2_03:391`) |
| **AD-8** | Audit retention and legal hold | 90 days hot / 7 years cold / other | Owner + legal (`PHASE2_03:463`) |
| **AD-9** | Environment topology | Single-host SQLite / external broker | Single-host for now (`PHASE2_FOUNDATION_APPROVAL_PACKAGE.md:116`) |
| **AD-10** | Event source for triggers | Transactional outbox / polling / webhook | Transactional outbox (`PHASE2_03:222`) |
| **AD-11** | Scheduled triggers | Not supported / cron in-process / external scheduler | Not supported in v1; decide before live |
| **AD-12** | Agent executor binding | None / dedicated least-privilege executor / general agent grant | Dedicated least-privilege executor; never a general grant (`PHASE2_02:55`) |
| **AD-13** | Publish immutability and rollback | New version only / rollback to previous version | New version only; rollback via new version |
| **AD-14** | Audit actor for automation | `automation` / `system` / executing user | `automation` with `on_behalf_of` when delegated |
| **AD-15** | Canvas integration | None / read-only task events / bidirectional | None; keep Canvas non-execution (`PHASE3_03:483`) |
| **AD-16** | Card provenance | Record Phase 4 cards in authority docs / accept delegating instruction | Record `PM-P4-03` and siblings in `KANBAN_BOARD.md` or the current authority document |
| **AD-17** | Secret recovery and rotation | Owner-only rotation / scheduled rotation / break-glass | Owner-only rotation with audit; break-glass documented |
| **AD-18** | Multi-project behavior | Single project / cross-project workflows | Single project per workflow; cross-project requires explicit grant |

---

## 14. Acceptance criteria for PM-P4-03

The card is complete when:

1. The current evidence in §2 is reviewed and confirmed against the working tree.
2. The runtime boundary options and the preview-only recommendation are recorded (§3).
3. The proposed data contracts, permissions, credential scope, redaction, audit, reliability, API, migration, and test requirements are defined (§4–§11).
4. The explicit no-implied-runtime rule is stated and binding (§12).
5. The unresolved decisions register is recorded (§13).
6. No application source, DB schema, migration, credential, or runtime is created or changed by this card.
7. The Automation Studio preview remains preview-only and continues to satisfy the hard rule in `handoff_future_uiux.md:51`.
8. The artifact is verified on disk with a byte size and SHA-256 (§16).

---

## 15. Evidence index

### 15.1 Live source (VERIFIED)

| Path | Bytes | SHA-256 (first 16) | Relevance |
|---|---:|---|---|
| `frontend/src/pages/AutomationStudio.tsx` | 11,246 | `b0252f0545e6f227` | Preview-only mock; no runtime |
| `backend/src/index.ts` | 2,785 | `ac6f21a123aa039e` | Route registration; no automation |
| `backend/src/server.ts` | 4,145 | `a593fb7fcde93184` | Route registration; `NODE_PORT` |
| `backend/src/database/schema.sql` | 9,599 | `5447d355c0da21f7` | 18 tables; no automation tables |
| `backend/src/database/index.ts` | 840 | `772c9a3e74dca505` | Pragmas; schema exec |
| `backend/src/database/migrate.ts` | 208 | `53e428a9076ec406` | No-op migration |
| `backend/src/middleware/auth.middleware.ts` | 1,159 | `002fdf31428ea049` | `requireAuth` / `requireRole` |
| `backend/src/middleware/agentAuthMiddleware.ts` | 1,576 | `e47ebcb58f0e4238` | Agent auth |
| `backend/src/middleware/rateLimit.middleware.ts` | 651 | — | Rate limits |
| `backend/src/services/auth.service.ts` | 4,972 | `4d502632edf49a52` | Demo users; JWT fallback; 7d |
| `backend/src/services/agentAuthService.ts` | 2,040 | `92aed40e1d42fb02` | Broken insert |
| `backend/src/services/agentLoginService.ts` | 1,656 | `e2beec460f21f533` | Agent login |
| `backend/src/services/connector.service.ts` | 13,641 | `e23b3d86ac66bca5` | Unredacted config; no ownership check |
| `backend/src/routes/connectors.routes.ts` | 5,746 | `21a090489108629f` | `requireAuth` only |
| `backend/src/routes/agents.routes.ts` | 697 | `a3af90ee4aeb0509` | Agent routes |
| `backend/src/routes/canvas.routes.ts` | 3,942 | — | Canvas routes; `requireAuth` only |
| `backend/src/services/canvas.service.ts` | 8,988 | — | Canvas service; no side effects |
| `frontend/src/hooks/useAuth.tsx` | 1,382 | `afaaf7da53f1420b` | localStorage token |
| `frontend/src/pages/Connectors.tsx` | 17,285 | `aa32feaa764a0bc3` | Connector UI |
| `frontend/src/pages/ReviewQueue.tsx` | 2,950 | `244fcca82b93aedc` | Approval panel disabled |
| `backend/src/tests/backend.test.ts` | 12,247 | `681279795b038500` | 15 tests; no automation coverage |
| `backend/package.json` | 1,343 | `65f52d48f029f86e` | Scripts; missing seed/reset |
| `backend/tsconfig.json` | 626 | `80c71c217aed7513` | TS5096 source |
| `docker-compose.yml` | — | — | `PORT=4000` |
| `.env.example` | — | — | No automation env vars |
| `backend/data/app.db` | — | — | 18 tables; `audit_logs` 0 rows; no `agent_tokens` |

### 15.2 Planning documents (VERIFIED)

| Path | Bytes | SHA-256 (first 16) | Relevance |
|---|---:|---|---|
| `PHASE1_DISCOVERY_DECISION_PACK.md` | 16,975 | `0f9d5e4b75eb697d` | Decisions C/D; runtime DECISION-REQUIRED |
| `PHASE2_01_SHARED_ARCHITECTURE.md` | 46,140 | `d46375f68b1f3c0f` | Route/schema/state evidence |
| `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md` | 16,396 | `a45747e154517fd2` | Permission matrix; connector policy |
| `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md` | 46,171 | `ed604eb196e3fbef` | Migrations; outbox; audit; reliability; §8.5 |
| `PHASE2_05_SHARED_COMPONENT_CATALOG.md` | 60,504 | `42c0c5c245df4dbe` | Canvas vs Automation separation |
| `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md` | 13,710 | `7294c778d7443b8b` | D-09 preview-only; implementation boundary |
| `PHASE3_03_CANVAS_API_CONTRACT.md` | 42,129 | `d464d83abe235b16` | Automation boundaries; API conventions |
| `PHASE3_04_CANVAS_SPEC_APPROVAL.md` | 34,151 | `4e6c90fcf0bd92a2` | REQUEST CHANGES gate |
| `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` | 13,056 | `4416a1f14046881f` | Phase 3 exit gate |
| `UI_UX_REDESIGN_PLAN.md` | 15,653 | `cc8099b9a86ef97c` | Automation Studio scope and guardrails |
| `handoff_future_uiux.md` | 8,195 | `1002bf3f4b35fb6a` | Hard rule; owner gates |
| `KANBAN_BOARD.md` | 11,866 | `e53b9088c412fec5` | No `PM-P4-03` |
| `ROADMAP.md` | 9,924 | `74d16bc2879b4926` | Stale phase naming |

### 15.3 Commands run (VERIFIED)

| Command | Result |
|---|---|
| Repo-wide search for `PM-P4-03` | 0 hits |
| Repo-wide regex scan of `backend/src` for automation/workflow/execution/approval/outbox/setInterval/cron/scheduler/queue/idempot | 0 matches |
| `PRAGMA table_info(agents)` on live DB | 11 columns; no `expires_at` |
| `SELECT name FROM sqlite_master WHERE type='table'` on live DB | 18 tables; no `agent_tokens` |
| `SELECT COUNT(*) FROM audit_logs` | 0 |
| `os.listdir backend/src/database/migrations` | `[]` |
| SHA-256 of cited artifacts | See tables above |

---

## 16. Artifact verification

- **Path:** `<workspace>\PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md`
- **Byte size:** _recorded by the card completion report (a file cannot contain its own final size)_
- **SHA-256:** _recorded by the card completion report_
- **Read-only boundary:** No application source file, DB schema, migration, credential, environment, or runtime was created or modified by this card. The only file written is this artifact.
- **Recommended next step:** Owner records the runtime boundary decision (AD-1). If preview-only is confirmed, no further Automation work is authorized and the preview remains as-is. If test-only or live is chosen, a separate implementation card is required, and the Phase 2 foundation (migration runner, outbox, audit writer, RBAC enforcement, connector redaction) must be built and verified first.

---

*Prepared as a read-only Phase 4 planning artifact. This document authorizes no implementation, no schema change, no migration, no credential change, and no Automation runtime. The Automation Studio remains a preview-only surface until the owner records a new boundary decision.*
