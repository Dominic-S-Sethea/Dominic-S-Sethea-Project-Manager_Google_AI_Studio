# Project Manager — Phase 4 Automation Studio Specification Approval Package

**Status:** Complete draft — owner runtime decision required  
**Phase:** 4 — Automation Studio Specification & Runtime Boundary  
**Repository:** `<workspace>`  
**Git branch:** `main`  
**Git HEAD:** `d705a364b2e845eb02f33d57475e0e3af15228c7`  
**Implementation boundary:** Planning/design only. No automation source, schema, migration, credential, connector, queue, or runtime change is authorized by this package.

> **Labels:** **VERIFIED** = read directly from live source or generated artifacts. **REPORTED** = stated in a project document but not independently proved. **PROPOSED** = recommended but not approved. **DECISION-REQUIRED** = owner decision required.

---

## 1. Phase 4 result

| ID | Artifact | Bytes | SHA-256 |
|---|---|---:|---|
| P4-01 | `PHASE4_01_AUTOMATION_IA_REGIONS.md` | 51,361 | `e3f0b38c55745be81c1ee4b1381064df36fcb5f232139f0dd2253bf955be010d` |
| P4-02 | `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md` | 40,617 | `efd51dab0511e565f16d6f8cd8476078af92a1431cd2b893b00e1279e8d8507e` |
| P4-03 | `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md` | 69,262 | `4b6935e29e7aff312dc81a8d96bafbcc11e01aea9380b4359f650b4b15ed784c` |

All three artifacts exist in the project workspace. No application source, database, schema, credential, or runtime configuration was changed by Phase 4.

### What each artifact covers

- **P4-01 — IA and builder regions:** current Automation Studio IA; target navigation (Workflows / Executions / Approval gates / Templates / Settings); six builder regions (Library, Workflow canvas, Inspector, Execution/history, Templates, Approvals); states; accessibility/responsive rules; preview-only boundary; Canvas-vs-Automation separation; 10 current-state + 15 target-state acceptance criteria; 15 unresolved decisions.
- **P4-02 — Nodes, lifecycle, execution inspection:** proposed six-type node library (trigger, transform, decision, action, human gate, error handler); design-time and runtime states; validation rules V-01–V-23; workflow lifecycle (draft/test/published/paused/archived + rollback); execution/step traces; human-gate approval states; test-mode isolation; redaction classes; preview-only boundary; Canvas separation; 19 acceptance criteria; 12 unresolved decisions.
- **P4-03 — Runtime, safety, permission, backend contract:** current evidence; proposed workflow/version/node/edge/trigger/execution/step/approval/environment/credential-reference contracts; runtime boundary options; permissions and connector credential scope; redaction; audit; retries/timeouts/idempotency; API schemas and failure behavior; migration/test requirements; explicit no-implied-runtime rule; 18 unresolved decisions.

---

## 2. Verified current-state findings

| # | Severity | Finding | Evidence |
|---:|---|---|---|
| A-1 | **Critical** | No Automation runtime exists: no automation/workflow/execution/approval/template/queue/outbox route, service, table, worker, or scheduler. | `backend/src/index.ts:37-51`; `backend/src/server.ts:41-55`; repo-wide backend scan; `schema.sql` |
| A-2 | **Critical** | Automation Studio is preview-only: “Preview only · no runtime connected”, disabled Publish, disabled Replay, sample data, no `fetch()`. | `frontend/src/pages/AutomationStudio.tsx:29,30,82,216,231` |
| A-3 | **High** | Connector secrets are returned unredacted and without ownership checks; credentials are stored plaintext with only an `is_secret` flag; connectors have no `project_id`. | `backend/src/services/connector.service.ts:76-97,99-114`; `connectors.routes.ts:8-147`; `schema.sql:205-226` |
| A-4 | **High** | Agent authentication is broken by schema drift (`agents.expires_at`, `agent_tokens`). | `backend/src/services/agentAuthService.ts:33-43`; `schema.sql` |
| A-5 | **High** | Hardcoded JWT fallback secret and hardcoded demo users; demo login creates an unsaved UUID user. | `backend/src/middleware/auth.middleware.ts`; `backend/src/services/auth.service.ts` |
| A-6 | **High** | Audit tables exist but have no writer; no automation audit coverage. | `schema.sql`; repository-wide scan |
| A-7 | **High** | No migration ledger; `db:migrate` only initializes `schema.sql`. | `backend/src/database/migrate.ts`; `package.json`; empty migrations directory |
| A-8 | **High** | Container port mismatch: app listens on `NODE_PORT || 3000`, Docker/Compose/CI health checks use `4000`. | `backend/src/server.ts:98`; `Dockerfile:25`; `docker-compose.yml:12,22` |
| A-9 | **High** | Backend production build fails (TS5096). | `backend/tsconfig.json:19` |
| A-10 | **Medium** | Preview node library is 4 types (trigger, condition, notify, review); transform is absent and the Error handler is non-functional. | `AutomationStudio.tsx:4,68-71` |
| A-11 | **Medium** | Automation Studio has no automated tests; no runtime observability. | `backend/src/tests/backend.test.ts`; repo scan |
| A-12 | **Medium** | PM-P4-01/02/03/04 are not recorded in the current authority documents; card provenance is unverifiable. | `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, `CHECKLIST.md` (0 hits) |

---

## 3. Proposed Automation specification (summary)

### 3.1 Boundary and scope

- Keep Automation Studio **preview-only** until the owner explicitly selects test-only or live.
- Publish, execute, replay, human approval decisions, live connector side effects, and live execution history remain disabled.
- Canvas remains a visual planning surface; Automation is a separate control-flow domain with its own data model, permissions, audit, and runtime contracts.

### 3.2 IA and builder

- Navigation: Workflows, Executions, Approval gates, Templates, Settings.
- Regions: Library, Workflow canvas, Inspector, Execution/history, Templates, Approvals.
- Every surface carries explicit preview/runtime labeling; no implied execution.

### 3.3 Nodes and lifecycle

- Six node types: trigger, transform, decision, action, human gate, error handler.
- Design-time states: draft, invalid, valid, tested, deprecated.
- Runtime step states: pending, running, succeeded, failed, skipped, awaiting_approval, cancelled, retrying.
- Publish gate: zero errors and acknowledged warnings; published versions immutable.

### 3.4 Runtime, safety, and backend

- Proposed contracts: workflows, workflow_versions, workflow_nodes, workflow_edges, environments, executions, execution_steps, approvals, credential_references, idempotency_keys.
- Credential references only; secrets never in workflow JSON, node config, traces, audit, logs, exports, or browser.
- Project-scoped RBAC; publish/live execute/replay/credential management owner-only; no secret readback for any role.
- Separation of duties: requester may not be reviewer; agents may request but only a human owner may grant or reject.
- Redaction classes secret/pii/financial/internal applied before API serialization, logging, audit, outbox, export, error reporting, and screenshots.
- Reliability defaults: 8 max attempts, exponential backoff, per-handler timeouts, AbortController on outbound fetch, cooperative cancellation, dead-letter.
- Replay restricted to non-side-effecting nodes by default.
- Migration requirements: `schema_migrations` ledger, immutable versioned SQL with SHA-256 checksums, fresh-install parity, additive-first changes, no automatic migration on container start.

---

## 4. Owner decisions required

| Decision | Options | Recommendation |
|---|---|---|
| **AD-01 — Runtime boundary** | Preview-only / test-only / live | **Preview-only** until a separate runtime specification and owner authorization exist. |
| **AD-02 — API versioning** | `/api/v1/automation` / content negotiation / unversioned | `/api/v1/automation`. |
| **AD-03 — Role model** | Project-scoped membership / global `users.role` | Project-scoped; resolve cross-phase conflict with Phase 3. |
| **AD-04 — Credential provider** | OS credential store / managed vault / KMS | Do not store keys beside ciphertext; choose a provider before any action node. |
| **AD-05 — Approval model** | Single owner / multi-approver / delegation | Single owner; no self-approval. |
| **AD-06 — Side-effecting actions** | Deny all / allow-list / per-action approval | Allow-list + per-action approval. |
| **AD-07 — Replay policy** | Non-side-effecting only / reviewed mode / unrestricted | Non-side-effecting only. |
| **AD-08 — Audit retention** | 90 days hot / 7 years cold / other | 90 days hot, 7 years cold (subject to privacy review). |
| **AD-09 — Environment topology** | Single-host SQLite / external broker | Single-host for now. |
| **AD-10 — Event source** | Transactional outbox / polling / webhook | Transactional outbox. |
| **AD-11 — Scheduled triggers** | Not supported / in-process cron / external scheduler | Not supported until runtime approval. |
| **AD-12 — Agent executor** | Dedicated least-privilege executor / general agent grant / none | Dedicated least-privilege executor. |
| **AD-13 — Publish immutability** | New version only / rollback to previous version | New version only. |
| **AD-14 — Audit actor** | Automation with `on_behalf_of` / system / executing user | Automation with `on_behalf_of`. |
| **AD-15 — Canvas integration** | None / read-only task events / bidirectional | None. |
| **AD-16 — Card provenance** | Record Phase 4 cards in the current authority document | Record PM-P4-01/02/03/04. |
| **AD-17 — Secret recovery/rotation** | Owner-only rotation with audit / scheduled / break-glass | Owner-only rotation with audit. |
| **AD-18 — Multi-project behavior** | Single project per workflow / cross-project with explicit grant | Single project per workflow. |

---

## 5. Phase 4 exit gate

Phase 4 is complete as a **discovery/specification phase**. It does **not** authorize:

- automation source or UI implementation;
- workflow/execution/approval/environment/credential-reference tables or migrations;
- connector credential changes;
- queue/worker/scheduler runtime;
- publish/execute/replay behavior;
- commits or pushes.

The next executable step is the Phase 4 approval gate `t_97963e0d`. After the owner selects the runtime boundary and records decisions AD-01–AD-18, the owner may separately authorize:

1. Phase 3 blocking corrections B-1–B-9 and Canvas decisions CD-01–CD-12;
2. Phase 6 foundation/Canvas implementation only after Phase 2/3/4 approvals;
3. Phase 7 Automation runtime implementation only if the owner selects test-only or live and approves the corresponding contracts.

---

## 6. Evidence index

- `PHASE4_01_AUTOMATION_IA_REGIONS.md`
- `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md`
- `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md`
- `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` — Canvas specification and owner decisions.
- `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md` — shared foundation and owner decisions.
- `PHASE1_DISCOVERY_DECISION_PACK.md` — authority register and capability inventory.
- Live source files cited in each artifact with exact paths and line numbers.

---

*Prepared as a Phase 4 owner-gate artifact. This package is a specification and decision register, not an implementation authorization.*
