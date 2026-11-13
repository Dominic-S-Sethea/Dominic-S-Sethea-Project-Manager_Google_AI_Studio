# Project Manager — Phase 2 Foundation Approval Package

**Status:** Complete draft — owner approval required  
**Phase:** 2 — Shared Architecture, Security & Design System  
**Repository:** `<workspace>`  
**Git branch:** `main`  
**Git HEAD:** `d705a364b2e845eb02f33d57475e0e3af15228c7`  
**Implementation boundary:** This package authorizes planning and architecture decisions only. It does **not** authorize source edits, database migrations, credential changes, connector changes, or Automation runtime work.

> **Labels:** **VERIFIED** = read directly from live source, commands, or generated artifacts. **REPORTED** = stated in a project document but not independently proved. **PROPOSED** = recommended but not approved. **DECISION-REQUIRED** = owner decision required.

---

## 1. Phase 2 result

Phase 2 produced five specifications plus a shared-foundations draft:

| ID | Artifact | Bytes | SHA-256 |
|---|---|---:|---|
| P2-01 | `PHASE2_01_SHARED_ARCHITECTURE.md` | 46,140 | `d46375f68b1f3c0f163498ba506501fdc81004bd21fff0ddd1e7e383a7c2f863` |
| P2-02 | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md` | 16,396 | `a45747e154517fd2aeb4b05c3278d83c6bb8dc7b43ddb1a275f0c544282a779f` |
| P2-03 | `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md` | 46,171 | `ed604eb196e3fbef4d056d25d88bf96b0b18c376a10dd1c99f2abba62aaf6041` |
| P2-04 | `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY_DRAFT.md` | 21,615 | `108772a3024c70baec4d841cfaecf06af906be7e21165147a926d35a23b96706` |
| P2-05 | `PHASE2_05_SHARED_COMPONENT_CATALOG.md` | 60,504 | `42c0c5c245df4dbe4b3e2d8627f4693a9eb74e7d18a76b626d1fc2897e770f18` |
| P2-D | `PHASE2_SHARED_FOUNDATIONS_DRAFT.md` | 28,000 | `19121aa8fc06329fa9a785e2f406899cec4b3063832b371e0a3605a593d0e558` |

All six files exist in the project workspace. No application source, database, schema, credential, environment, or deployment configuration was changed by Phase 2.

### What each artifact covers

- **P2-01 — Shared architecture:** verified frontend routing/query/state, backend route/service conventions, SQLite schema and live row counts, Docker/CI/backup/monitoring evidence, dependency map, VERIFIED vs REPORTED capability table, and architecture risks.
- **P2-02 — RBAC & connector security:** current auth evidence, owner/editor/viewer/commenter/agent matrix, project membership and Canvas/workflow access, publish/execute rights, connector credential scope/redaction/logging/export/audit, backend enforcement requirements, and role/route test cases.
- **P2-03 — Data, events, audit & runtime strategy:** migration policy, transactional outbox/events, structured audit, idempotency/retry/timeout/cancellation/dead-letter, observability, and future-gated Automation contracts.
- **P2-04 — Tokens & accessibility:** current token/theme inventory, proposed canonical six-core-token namespace, typography, spacing/sizing, radius, elevation/z-index, focus, motion/reduced-motion, responsive rules, WCAG criteria, and migration notes.
- **P2-05 — Shared component catalog:** existing component inventory, proposed shared primitives, APIs/props, variants/states, keyboard/focus behavior, responsive rules, accessibility, token usage, and Canvas-vs-Automation semantic separation.

---

## 2. Verified critical baseline findings

These findings are **not** part of the proposed design. They are defects already present in the live tree and should be corrected as an implementation-baseline workstream, separately from Phase 2 approval.

| # | Severity | Finding | Evidence |
|---:|---|---|---|
| C-1 | **Critical** | Backend production build fails: `allowImportingTsExtensions` is set without `noEmit` or `emitDeclarationOnly`. | `backend/tsconfig.json:19`; `npm run build` exit 2, TS5096 |
| C-2 | **Critical** | Container port mismatch: app listens on `NODE_PORT || 3000`, while Docker/Compose/CI health checks use `4000`. | `backend/src/server.ts:98`; `Dockerfile:25`; `docker-compose.yml:12,22`; `.github/workflows/ci-cd.yml` |
| C-3 | **Critical** | Runtime schema path is stale/unreproducible: backend reads `dist/database/schema.sql`, but `tsc` does not copy SQL and `.dockerignore` excludes `dist`; the only existing dist schema is stale. | `backend/src/database/index.ts:9`; `backend/tsconfig.json`; `.dockerignore:3` |
| C-4 | **Critical** | Agent registration is broken by schema drift: code inserts `agents.expires_at` and an `agent_tokens` table that do not exist. | `backend/src/services/agentAuthService.ts:33-43`; `backend/src/database/schema.sql` |
| C-5 | **High** | RBAC is not enforced beyond user administration; authenticated viewers can write projects/tasks and most routes use `requireAuth` only. | `backend/src/middleware/auth.middleware.ts`; `backend/src/routes/*.ts`; QA-006 |
| C-6 | **High** | Connector secrets are returned through API responses without ownership checks or redaction; storage is plaintext with only an `is_secret` flag. | `backend/src/routes/connectors.routes.ts`; `backend/src/services/connector.service.ts`; `schema.sql` |
| C-7 | **High** | Hardcoded JWT fallback secret appears in auth code paths. | `backend/src/middleware/auth.middleware.ts`; `backend/src/services/auth.service.ts`; `backend/src/services/agentLoginService.ts` |
| C-8 | **High** | Audit tables exist but have no writer; audit coverage is effectively zero. | `schema.sql`; repository-wide search for audit writes |
| C-9 | **High** | No versioned migration ledger: `db:migrate` only initializes `schema.sql`; existing objects are never altered. | `backend/src/database/migrate.ts`; empty migrations directory; `package.json` |
| C-10 | **High** | Demo login creates an unsaved UUID user while foreign keys are enabled, so demo sessions cannot reliably create projects/tasks. | `backend/src/services/auth.service.ts`; `backend/src/database/index.ts` |
| C-11 | **Medium** | Design-token documentation conflicts with live implementation: live default is `#54C8FF` with current preset names; `UI_UX_REDESIGN_PLAN.md` says `#63C6FF` and older names. | `frontend/src/theme/ThemeProvider.tsx`; `frontend/src/index.css`; `UI_UX_REDESIGN_PLAN.md` |
| C-12 | **Medium** | Accessibility infrastructure gaps: no skip link, no `.sr-only`, no focus trap in dialogs, static page title, non-focusable horizontal scroll region, and an inline `outline:none` violation. | `frontend/src/index.css`; `frontend/src/components/**`; `frontend/src/pages/**` |
| C-13 | **Medium** | Shared component layer does not exist; dialogs/menus are inconsistent and several components are keyboard-inaccessible. | `frontend/src/components/**`; `frontend/src/index.css` |

---

## 3. Proposed shared foundation (summary)

### 3.1 Architecture and API conventions

- Keep the existing React 19 + TypeScript + Vite frontend, Express + TypeScript backend, and SQLite `node:sqlite` persistence model.
- Keep `index.ts` (pure app factory) and `server.ts` (unified dev/prod server) as the two route-registration surfaces; every route must be registered in both.
- Treat the live source tree as the authority for shipped behavior; use `UI_UX_REDESIGN_PLAN.md` and `UI_UX_PROGRESS.md` for design/migration intent; mark `PRD.md` / `KANBAN_BOARD.md` status tables as stale.
- Standardize error envelopes and authentication middleware rather than maintaining duplicate implementations.
- Make database access transactional for multi-write operations; add idempotency and audit at the service boundary.

### 3.2 RBAC, ownership and connector secrets

- Adopt a five-actor model: **owner**, **editor**, **viewer**, **commenter**, **agent**.
- Add project-scoped membership rather than relying only on a global `users.role`.
- Define Canvas access as project-scoped read/manage/admin rights; define Automation workflow access separately as draft/publish/execute rights.
- Keep publish/execute/replay disabled for every role until the Automation runtime boundary is explicitly approved.
- Treat connector credentials as references or encrypted values, never as visual payload data; redact them in API responses, logs, exports, screenshots, and UI state.

### 3.3 Migrations, events, audit and reliability

- Add a versioned migration ledger (`schema_migrations`), immutable SQL migration files with checksums, dry-run/rollback support, and one runner for dev/CI/Docker/prod.
- Add a transactional outbox for domain events; do not assume an external broker.
- Add idempotency keys, per-handler retry/timeout/dead-letter behavior, cooperative cancellation, and replay restrictions for non-side-effecting operations only.
- Add structured audit records with actor, object, before/after snapshots or diffs, request/trace IDs, redaction, append-only enforcement, and retention/archive policy.
- Add metrics, structured logs, trace propagation, alert rules, backup verification, and scheduled backup evidence.

### 3.4 Tokens and accessibility

- Proposed canonical six-core namespace: `--pm-canvas`, `--pm-rail`, `--pm-glass`, `--pm-border`, `--pm-accent`, `--pm-text`; govern the remaining 21 tokens as supporting tokens.
- Preserve the existing six theme IDs and current working values where they conflict with documentation.
- Add typography, spacing, sizing, radius, elevation/z-index, focus, motion, reduced-motion, and responsive token families.
- Enforce WCAG AA text contrast, visible focus, keyboard operability, dialog focus management, screen-reader semantics, and reduced-motion behavior.
- Fix the measured Porcelain theme status-token contrast failures before that theme is presented as accessible.

### 3.5 Shared component catalog

- Build a shared primitive layer for Button, Panel, Inspector, Drawer, Dialog, Menu, Toolbar, Status, Toast, EmptyState, Loading, and ErrorState.
- Require accessible names, focus management, keyboard behavior, responsive rules, and semantic tokens in every primitive.
- Keep Canvas and Automation semantics separate: Canvas item/connection is a visual relationship; Automation node/edge is workflow control flow.

---

## 4. Owner decisions required before implementation

Phase 2 approval is **not** complete until the owner records decisions on the following items. These are not implementation approvals by themselves.

| Decision | Options | Recommendation |
|---|---|---|
| **D-01 — Foundation approval** | Approve the proposed architecture/RBAC/data/token/component foundation as the design baseline, or request changes. | Approve as a **design baseline only**; keep implementation gates separate. |
| **D-02 — Critical baseline defects** | Authorize a baseline-remediation workstream for C-1 through C-4 before foundation implementation, or defer. | **Authorize C-1–C-4 first**; they block production build/deploy and agent auth. |
| **D-03 — RBAC and membership** | Approve project-scoped membership + five-actor model + owner-only role assignment, or choose another model. | Approve proposed model. |
| **D-04 — Connector secrets** | Approve encrypted/reference-based credential storage + redaction + ownership scope, including the migration approach. | Approve; exact key provider remains a security decision. |
| **D-05 — Token palette** | Choose live `#54C8FF` + current preset names, or plan `#63C6FF` + older names. | Preserve live values; update the stale plan document later. |
| **D-06 — Migration policy** | Approve versioned migrations with checksums/dry-run/rollback and a legacy baseline adoption rule. | Approve. |
| **D-07 — Audit and retention** | Approve audit contract and retention/archive period. | Approve contract; owner sets retention. |
| **D-08 — Deployment topology** | Confirm single-host SQLite/queue topology or require external infrastructure. | Keep single-host for now; gate external infrastructure separately. |
| **D-09 — Automation runtime boundary** | Preview-only / test-only / live. | **Preview-only for now**; separate decision before Phase 4/7 implementation. |
| **D-10 — Implementation sequencing** | Approve Phase 6 Canvas/foundation implementation after Phase 2/3 sign-off, or hold. | Hold until D-01–D-09 and Phase 3 Canvas spec approval are recorded. |

---

## 5. Phase 2 exit gate

Phase 2 is complete as a **design/discovery phase**. It does not authorize:

- source-code edits;
- database schema or data changes;
- credential/secret changes;
- connector changes;
- Automation runtime implementation;
- deployment or environment changes;
- commits or pushes.

The next executable step is the Phase 2 approval gate `t_7ac0e3a2`. After that gate, the owner may separately authorize:

1. critical baseline remediation (C-1–C-4);
2. Phase 3 Canvas specification review/approval;
3. Phase 6 foundation/Canvas implementation only after Phase 2 and Phase 3 approvals.

---

## 6. Evidence index

- `PHASE1_DISCOVERY_DECISION_PACK.md` — Phase 1 baseline and authority register.
- `PHASE2_01_SHARED_ARCHITECTURE.md` — architecture, routes, schema, Docker/CI, verified vs reported capabilities.
- `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md` — permission matrix, connector secret policy, enforcement/test requirements.
- `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md` — migrations, outbox, audit, reliability, observability, future contracts.
- `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY_DRAFT.md` — token/theme inventory, canonical token proposal, accessibility rules.
- `PHASE2_05_SHARED_COMPONENT_CATALOG.md` — existing component inventory, shared primitive catalog, interaction/accessibility rules.
- Live source files cited in each artifact; exact paths and line numbers are recorded inside the artifacts.

---

*Prepared as a Phase 2 owner-gate artifact. This package is a design baseline and decision register, not an implementation authorization.*
