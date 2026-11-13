# Project Manager — Phase 1 Discovery & Authority Decision Pack

**Status:** Complete — pending owner gate review  
**Phase:** 1 — Discovery, Authority & Scope Baseline  
**Repository:** `<workspace>`  
**Git branch:** `main`  
**Git HEAD:** `d705a364b2e845eb02f33d57475e0e3af15228c7`  
**Working tree:** Dirty — 55 tracked files changed and 28 untracked paths at the time of the audit. This pack does not modify, revert, or clean them.  
**Read-only boundary:** No application source file was edited by this phase. No server was started by this phase. No database schema or data was changed. No commit was made.

> Evidence labels used below: **VERIFIED** = read directly from the current working tree or a command result; **REPORTED** = stated in a project document but not independently proved; **PROPOSED** = recommended, not approved; **UNKNOWN** = not currently verifiable; **DECISION-REQUIRED** = owner decision needed.

---

## 1. Executive summary

The existing Project Manager product is a working React 19 + TypeScript + Vite + Tailwind frontend with an Express + TypeScript backend and SQLite persistence. The Project Canvas domain is materially implemented: `canvases`, `canvas_items`, and `canvas_connections` exist in the schema; `/api/canvas` is registered in both app entry points; `canvas.service.ts`, `canvas.routes.ts`, `Canvas.tsx`, `CanvasList.tsx`, and `frontend/src/components/canvas/*` exist.

The Automation Studio is **not** a runtime. `frontend/src/pages/AutomationStudio.tsx` is a preview-only mock: it explicitly says “Preview only · no runtime connected”, has a disabled Publish control, uses sample data, and contains no `fetch()` call. No automation, workflow, execution, replay, or approval route exists in `backend/src/index.ts` or `backend/src/server.ts`, and no automation tables exist in `schema.sql`.

The current source tree is materially unclean and the planning documents disagree with each other. This is a documentation/authority problem, not evidence that the source is absent. The live repository, `UI_UX_REDESIGN_PLAN.md`, and `UI_UX_PROGRESS.md` demonstrate that substantial work exists beyond what older phase tables claim.

**Recommended Phase 1 outcome:** Preserve the working product; improve only the shared foundation and Canvas reliability; extend only after an explicit Automation runtime decision.

---

## 2. Verified baseline

### 2.1 Source and working tree

| Item | Evidence | Classification |
|---|---|---|
| Branch | `git branch --show-current` → `main` | VERIFIED |
| Commit | `git rev-parse HEAD` → `d705a364b2e845eb02f33d57475e0e3af15228c7` | VERIFIED |
| Recent commits | `d705a36`, `8554a2f`, `ea4a3d7`, `42839d0`, `a570dc6` | VERIFIED |
| Tracked change size | `git diff --stat`: 55 files changed, 5,045 insertions, 2,357 deletions | VERIFIED |
| Untracked paths | 28 paths, including `UI_UX_PROGRESS.md`, `UI_UX_REDESIGN_PLAN.md`, `AutomationStudio.tsx`, `AppShell.tsx`, and connector/UI-layout code | VERIFIED |
| Frontend typecheck | `npm run typecheck` in `frontend/` → exit 0 | VERIFIED |
| Frontend build | `npm run build` in `frontend/` → exit 0; Vite built 123 modules | VERIFIED |
| Backend typecheck | `npm run typecheck` in `backend/` → exit 0 | VERIFIED |
| Backend tests | `npm test` in `backend/` → 15 pass, 0 fail | VERIFIED |
| Backend build | `npm run build` in `backend/` → exit 2: `tsconfig.json(19,35): error TS5096: Option 'allowImportingTsExtensions' can only be used when either 'noEmit' or 'emitDeclarationOnly' is set.` | VERIFIED — baseline defect |
| Production backend serving | Not verified by this phase; the failing backend build prevents an evidence-backed production-build claim | UNKNOWN |

The backend test suite starts an Express app on port 3001 during its run and exercises auth, projects, tasks, dependencies, and checklists. It does **not** exercise Canvas, connectors, UI layout, Automation, RBAC enforcement, approvals, audit completeness, accessibility, or frontend integration.

### 2.2 Route registration

**VERIFIED** — both `backend/src/index.ts` and `backend/src/server.ts` register:

`/api/auth`, `/api/users`, `/api/dashboard`, `/api/agents`, `/api/projects`, `/api/tasks`, `/api/checklists`, `/api/dependencies`, `/api/git`, `/api/import-export`, `/api/canvas`, `/api/backup`, `/api/monitoring`, `/api/ui-layout`, `/api/connectors`.

**Not registered:** comments, Automation, workflow, execution, replay, approval, or audit routes.

**VERIFIED Canvas routes** in `backend/src/routes/canvas.routes.ts`: canvas CRUD, `/items`, `/connections`, `/connections/:connId`, and `/items/:itemId` under `/api/canvas`.

### 2.3 Persistence

**VERIFIED** tables in `backend/src/database/schema.sql`: `users`, `projects`, `tasks`, `task_dependencies`, `comments`, `checklists`, `checklist_items`, `audit_logs`, `agents`, `agent_activities`, `login_history`, `git_commits`, `canvases`, `canvas_items`, `canvas_connections`, `connectors`, `connector_configs`, `ui_layouts`.

**VERIFIED:** no automation/workflow/execution/approval/environment tables exist.

### 2.4 Design system

**VERIFIED:** `frontend/src/index.css` defines 27 `--pm-*` custom properties. The intended six core semantic tokens are `--pm-bg`, `--pm-rail`, `--pm-glass`, `--pm-border`, `--pm-accent`, and `--pm-text`; supporting tokens include `--pm-canvas`, `--pm-danger`, `--pm-success`, `--pm-warning`, `--pm-info`, radius, shadow, spring, and secondary text tokens.

**VERIFIED:** `frontend/src/theme/ThemeProvider.tsx` defines six presets: Obsidian Signal, Carbon Orchid, Aurora Mint, Forge Amber, Emerald Circuit, and Porcelain Glass. The default accent is `#54C8FF`.

**PROPOSED:** a single documented six-token canonical namespace is needed because the handoff describes “six `--pm-*` tokens” while the implementation has 27 supporting variables. This is not an instruction to delete working tokens; it is a governance decision.

---

## 3. Document authority register

| Source | Current content | Authority classification | Action |
|---|---|---|---|
| `PRD.md` | Phase 2/3/4/5 marked Pending; Phase 4 “Custom Canvas” marked Future | **CONFLICTING** — stale relative to live Canvas code | Do not use as sole truth; retain as requirements source |
| `KANBAN_BOARD.md` | Byte-for-byte identical to `PRD.md` (same SHA-256) | **CONFLICTING / REDUNDANT** | Treat as a copy of PRD; do not treat as independent board evidence |
| `ROADMAP.md` | “ALL PHASES COMPLETE”; Custom Canvas complete at `96de21b` | **PARTIAL** — historically true for original Canvas, but stale for the new programme | Use as history only; not current programme truth |
| `CHECKLIST.md` | Phase 3 MVP and Canvas still listed as Pending | **STALE** | Preserve as historical checklist; do not use for status |
| `HANDOVER.md` | Views/Power and Canvas listed as Pending; older incomplete MVP list | **STALE** | Historical reference only |
| `HANDOVER-CORRECTED.md` | Explicitly references historical Student-Instructor workspace | **HISTORICAL** | Do not use for active workspace status |
| `hand-over-checklist.md`, `hand-over-guide.md` | Generic handover procedure | **PROCEDURAL** | Use only for handover hygiene |
| `UI_UX_PROGRESS.md` | UIUX-001 through UIUX-010 marked DONE; records Canvas/Automation separation and Design Mode exclusion | **CURRENT for the glass migration** | Use as migration evidence; reconcile with roadmap |
| `UI_UX_REDESIGN_PLAN.md` | Approved glass direction; explicit Canvas vs Automation boundary; Automation runtime not authorized | **CURRENT design authority** | Use as design/product boundary source |
| `design-system.md` | Older phase-based design research and feature plan | **HISTORICAL / BACKGROUND** | Use for design principles; not current status |
| `TECH_STACK.md` | Stack documentation | **BACKGROUND** | Verify against package manifests before relying on it |
| `handoff_future_uiux.md` | Summary of current state and future UI/UX scope | **REPORTED / SUMMARY** | Verify every claim against source |
| `frontend/src/**`, `backend/src/**`, `schema.sql`, `package.json` | Live implementation | **AUTHORITATIVE for shipped behavior** | Treat as source of truth over prose documents |

**Authority decision required:** designate the live repository plus `UI_UX_REDESIGN_PLAN.md` as current design/behavior authority; mark `PRD.md`/`KANBAN_BOARD.md` status tables as stale; preserve `ROADMAP.md` as history.

---

## 4. Capability inventory and Preserve / Improve / Extend map

| Capability | Current evidence | Classification | Gap / next action |
|---|---|---|---|
| Auth and session | `auth.routes.ts`, `auth.service.ts`, JWT, `pm_token` flow; tests pass | **Preserve** | Verify RBAC enforcement and session edge cases before new permissions work |
| Projects | Project routes/service, project switcher, project CRUD UI | **Preserve** | Keep scope and ownership boundaries explicit |
| Tasks / workspace | Task routes/service, `TaskWorkspace.tsx`, task forms/lists | **Preserve** | Do not redesign; treat as existing product core |
| Checklists / dependencies | Services, routes, forms, lists; backend tests cover partial CRUD | **Preserve / Improve** | Add contract and edge-case coverage; no semantic redesign |
| Comments | `comments` table exists; no comments route in either app entry point | **Improve / Extend** | Backend API and UI contract gap; not part of the two requested features unless owner includes it |
| RBAC | Schema/users/roles and middleware exist; no dedicated approval/permission contract | **Improve** | Define authorization matrix before Automation permissions |
| Audit | `audit_logs` table exists | **Improve / Extend** | Verify coverage, actor identity, and Automation audit requirements |
| Agents / approvals | Agent routes/services and `ReviewQueue.tsx` exist; dedicated approval workflow not registered | **Improve / Extend** | Verify whether review queue is live or partial; define approval contract before runtime |
| Project Canvas | Canvas tables, service, routes, page, list, components, `useCanvas` hook | **Preserve / Improve** | Extend only; do not convert to an execution engine |
| Connectors | `connectors.routes.ts`, `connector.service.ts`, `Connectors.tsx`, connector tables | **Preserve / Improve** | Secret redaction, scope, and test-mode behavior need specification before Automation actions |
| UI layout / Design Mode | `uiLayout.routes.ts`, `uiLayout.service.ts`, design components | **Preserve / Improve** | Keep out of the main workspace per recorded decision |
| Deployment / monitoring / backup | Routes/services/scripts/Docker/CI artifacts | **Preserve** | Verify actual deployment behavior, not documentation claims |
| Automation Studio | `AutomationStudio.tsx` only; preview-only mock, disabled Publish, sample data, no API calls | **Extend** | Requires separate runtime, data, security, approval, and audit decision before implementation |
| Automation runtime | No routes, tables, services, execution, replay, or approval artifacts | **Extend / DECISION-REQUIRED** | Do not implement until owner approves preview-only, test-only, or live scope |

---

## 5. Risks, constraints, and unresolved dependencies

1. **Documentation conflict (High).** `PRD.md` and `KANBAN_BOARD.md` are identical and stale; `ROADMAP.md` disagrees with live Canvas work. A future session could revert or duplicate work if it trusts them silently.
2. **Unclean working tree (High).** A large set of tracked and untracked changes is uncommitted. No commit, revert, or cleanup was performed in Phase 1; owner must decide how to protect and review it.
3. **Backend build defect (High for release).** Backend typecheck and tests pass, but `npm run build` fails on `allowImportingTsExtensions` without `noEmit`/`emitDeclarationOnly`. Production build readiness is not proven.
4. **Automation runtime ambiguity (Critical).** The existing preview explicitly says no runtime is connected. Runtime, credential scope, approval, audit, retries, replay, and rollback must be decided before any implementation.
5. **Canvas semantics (Medium).** A Canvas connection is a visual relationship, not an Automation control-flow edge. Shared visuals must not blur this boundary.
6. **Permissions and connector safety (Medium).** Connector secrets must never appear in UI, logs, exports, or screenshots; Automation actions need explicit authorization and audit.
7. **Test coverage gap (Medium).** Existing backend tests pass but do not cover Canvas, connectors, UI layout, RBAC, approvals, accessibility, or Automation.
8. **Design-token governance (Medium).** The handoff says six tokens; the implementation has 27 `--pm-*` variables. A canonical token contract is needed without breaking working styles.
9. **Manual UX/accessibility verification (Medium).** No evidence yet that keyboard, screen-reader, reduced-motion, and responsive behavior were verified for the two feature areas.

---

## 6. Phase 1 exit gate — owner approvals required

Phase 2 must not begin until the owner explicitly approves the following. This pack does **not** treat any of them as already decided.

### Decision A — Document authority

Choose the authority model:

- **A1 (Recommended):** Live source tree + `UI_UX_REDESIGN_PLAN.md` + `UI_UX_PROGRESS.md` are current behavior/design authority; `PRD.md`/`KANBAN_BOARD.md` status tables are marked stale; `ROADMAP.md` is historical.
- **A2:** Keep `PRD.md` as the master requirements document and reconcile all other documents to it.
- **A3:** Another owner-specified authority order.

### Decision B — Project Canvas scope

- **B1 (Recommended):** Preserve Canvas as a visual planning/diagramming surface; extend only after its current behavior is specified and approved.
- **B2:** Redesign Canvas UX before any extension.
- **B3:** Treat Canvas as an Automation workflow surface.

### Decision C — Automation Studio runtime boundary

- **C1 (Recommended):** Keep Automation Studio **preview-only**; no backend runtime in this programme until a separate specification is approved.
- **C2:** Build a **test-only** runtime with pinned/sample data, no live side effects, and explicit owner approval for any publish path.
- **C3:** Build a **live execution** runtime with approvals, credentials, audit, retries, rollback, and deployment requirements.
- **C4:** Another owner-specified boundary.

### Decision D — Permissions and connector safety

- **D1 (Recommended):** Define project-scoped RBAC, credential references, redaction, human approvals, actor identity, and immutable audit before any Automation execution work.
- **D2:** Defer permissions/safety design until after the Automation UI specification.
- **D3:** Another owner-specified approach.

### Decision E — Phase 1 artifacts

- **E1 (Recommended):** Accept this pack as the Phase 1 evidence baseline and authorize Phase 2 shared-foundation architecture.
- **E2:** Request corrections to this pack before Phase 2.
- **E3:** Keep Phase 1 open.

---

## 7. Phase 2 entry conditions

Phase 2 may begin only after Decisions A–E are recorded and the owner explicitly orders Phase 2. Phase 2 will then define the shared design-system architecture, RBAC/ownership rules, migration/events/audit strategy, and canonical token/accessibility/component contracts before any feature-specific screen specification.

## 8. Evidence index

| Evidence | Path / command | Result |
|---|---|---|
| Git branch/HEAD | `git branch --show-current`; `git rev-parse HEAD` | `main`; `d705a364b2e845eb02f33d57475e0e3af15228c7` |
| Working tree | `git status --short`; `git diff --stat` | 55 tracked changes; 28 untracked paths |
| Backend app factory | `backend/src/index.ts` | All listed route modules registered |
| Backend server | `backend/src/server.ts` | Same route modules registered |
| Schema | `backend/src/database/schema.sql` | 18 tables; Canvas tables present; no Automation tables |
| Canvas service | `backend/src/services/canvas.service.ts` | Canvas/item/connection operations present |
| Canvas routes | `backend/src/routes/canvas.routes.ts` | Canvas/item/connection routes present |
| Automation preview | `frontend/src/pages/AutomationStudio.tsx` | Preview-only mock; no runtime, no fetch |
| Frontend typecheck | `npm run typecheck` in `frontend/` | exit 0 |
| Frontend build | `npm run build` in `frontend/` | exit 0; 123 modules transformed |
| Backend typecheck | `npm run typecheck` in `backend/` | exit 0 |
| Backend tests | `npm test` in `backend/` | 15 pass, 0 fail |
| Backend build | `npm run build` in `backend/` | exit 2 — TS5096 config error |
| Design tokens | `frontend/src/index.css` | 27 `--pm-*` custom properties |
| Theme presets | `frontend/src/theme/ThemeProvider.tsx` | Six presets; default `#54C8FF` |

---

*Prepared as a Phase 1 read-only planning artifact. This document is a decision pack, not an implementation authorization and not a source-code change.*
