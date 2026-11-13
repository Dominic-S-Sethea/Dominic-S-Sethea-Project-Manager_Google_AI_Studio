# PM-P5-01 — Canvas and Automation Semantic Separation Validation

| Field | Value |
|---|---|
| Card | PM-P5-01 — Validate Canvas and Automation semantic separation |
| Artifact | Current-state evidence, target-state evidence, conflicts/risks, binding separation matrix, corrections, acceptance criteria, unresolved decisions |
| Date | 2026-11-10 |
| Repository | `<workspace>` |
| Method | Read-only static inspection of live source, schema, routes, components, and Phase 1–4 artifacts. No servers started, no builds, no DB/schema change, no application source edit. |
| Read-only boundary | Only this artifact was written. No application source file, schema, data, or configuration was modified. |

## Evidence legend

| Label | Meaning |
|---|---|
| **VERIFIED** | Read directly from the cited file/line in the current working tree, or independently re-derived during this review. |
| **REPORTED** | Asserted by a project document or sibling artifact; not independently re-derived here. |
| **PROPOSED** | Recommended target state; not present in code and not yet approved. |
| **UNKNOWN** | Not currently verifiable. |
| **DECISION-REQUIRED** | Owner decision needed before implementation. |

---

## 1. Scope and method

This card answers one question: **are Project Canvas and Automation Studio semantically separated in the live tree, and does the target specification hold that separation?**

The authoritative rule is **REPORTED** and consistent across five documents:

> "Project Canvas visualizes work. Automation Studio executes approved workflow definitions. They must never share a misleading name, a data model, or an implied execution engine." — `UI_UX_REDESIGN_PLAN.md:175`

Reinforced at `handoff_future_uiux.md:46,51,63`, `PHASE1_DISCOVERY_DECISION_PACK.md:122`, `PHASE2_05_SHARED_COMPONENT_CATALOG.md:845-876`, `PHASE3_01_CANVAS_IA_JOURNEYS.md:385-405`, `PHASE4_01_AUTOMATION_IA_REGIONS.md:520-546`, `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md:539-576`, and `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md:846-859`.

The review covered: frontend routes/navigation (`main.tsx`, `AppShell.tsx`), Canvas components and hook, Automation Studio page, backend route registration (`index.ts`, `server.ts`), Canvas routes/service, connector service/routes, import/export service, `schema.sql`, and the Phase 1–4 authority artifacts. No file other than this artifact was written.

---

## 2. Current-state separation evidence

### 2.1 Routes and navigation — VERIFIED

| Dimension | Project Canvas | Automation Studio | Evidence |
|---|---|---|---|
| Frontend route | `/canvas`, `/canvas/:id`, `/canvases`, `/canvases/:projectId` | `/automation` | `frontend/src/main.tsx:39,45-48` |
| Backend route | `/api/canvas` (10 endpoints) | **None — `/api/automation` is not mounted** | `backend/src/index.ts:47`; `backend/src/server.ts:51`; no automation router in either entry point |
| Nav label | "Project Canvas" | "Automation Studio" + `Preview` tag | `frontend/src/components/layout/AppShell.tsx:30-31,88-90` |
| Command palette | "Open Project Canvas" → `/canvases` | "Open Automation Studio" → `/automation` | `AppShell.tsx:376-392` |
| Icon | `canvas` (rect + lines) | `automation` (branching circles) — distinct glyphs | `frontend/src/components/layout/Icon.tsx:2,35,41` |

**Finding:** routes, nav labels, palette entries, and icons are distinct. No shared route path, no shared nav item, no shared icon. **VERIFIED pass.**

### 2.2 Data model / tables — VERIFIED

| Canvas tables (`schema.sql:161-201`) | Automation tables |
|---|---|
| `canvases` (161-169), `canvas_items` (172-187), `canvas_connections` (190-198) | **None.** No `workflows`, `workflow_versions`, `workflow_nodes`, `workflow_edges`, `executions`, `execution_steps`, `approvals`, `environments`, `credential_references`, or `idempotency_keys` table exists. |

**Finding:** the Canvas schema contains **no automation column** (`workflow_id`, `execution_id`, `trigger_config` are absent). No automation table exists. **VERIFIED pass.** This satisfies the binding constraints at `PHASE3_03_CANVAS_API_CONTRACT.md:480` and `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md:563` as a *current-state* fact, while those constraints remain **PROPOSED** for the future runtime.

### 2.3 Backend services and API — VERIFIED

| Canvas | Automation |
|---|---|
| `canvas.service.ts` (319 lines): pure CRUD on `canvases` / `canvas_items` / `canvas_connections`; imports only `getDb` and `randomUUID` | **No service exists.** No automation/workflow/execution/approval/template/queue/outbox service, worker, or scheduler. |
| `canvas.routes.ts`: `router.use(requireAuth)` at line 8; no role check, no project check | **No route file exists.** `/api/automation` is unmounted. |
| No connector import in `canvas.service.ts`; no external call | Connector service exists (`connector.service.ts`) but is not referenced by Canvas. |

**Finding:** Canvas CRUD has no side effects and no connector/automation import. **VERIFIED pass** on separation; note that the missing authorization is a separate Canvas defect (CB-1/CB-2), not a separation defect.

### 2.4 Frontend components and CSS — VERIFIED

| Canvas | Automation |
|---|---|
| `frontend/src/components/canvas/*` (CanvasItem, CanvasToolbar, CanvasViewport, ConnectionLine, PropertiesPanel, ShapeSelector, TaskCard, TaskPicker) | `frontend/src/pages/AutomationStudio.tsx` — single self-contained page |
| `frontend/src/hooks/useCanvas.ts` — Canvas-only state/persistence | No `useAutomation` hook; no `fetch()` call in `AutomationStudio.tsx` |
| Preview-only markers: none needed | "Preview only · no runtime connected" (`AutomationStudio.tsx:29`), disabled Publish (`:30`), disabled Replay (`:216`), sample-data labels (`:82,154-156,171-174,188-191,231`) |

**Finding:** no Canvas component is imported by Automation Studio and vice versa. Automation Studio makes **zero network calls**. **VERIFIED pass** on component separation.

**CSS naming risk — VERIFIED:** `AutomationStudio.tsx:76` uses `className="pm-canvas-tools"`, and that class is defined inside the "Automation Studio (intentionally non-live)" CSS block at `frontend/src/index.css:430`. The class name is Canvas-domain (`canvas-tools`) but is used only by Automation. No Canvas component currently uses it, so this is a **naming conflation risk**, not a live visual collision. **PROPOSED** rename to `.pm-workflow-tools` / `.pm-automation-tools`.

### 2.5 Documentation / authority — VERIFIED

The separation rule and binding terminology are documented in:

| Document | Lines | Content |
|---|---|---|
| `UI_UX_REDESIGN_PLAN.md` | 175, 222, 240-241 | Authoritative boundary; Canvas retained as planning canvas; Automation future surface |
| `handoff_future_uiux.md` | 46, 51, 63 | Hard rule: never imply a functioning runtime; canvas connection = visual relationship, automation connection = control flow |
| `PHASE1_DISCOVERY_DECISION_PACK.md` | 107, 111-112, 122, 144, 148-153 | Canvas preserve/extend; Automation runtime DECISION-REQUIRED; B1 recommended |
| `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md` | 52-55, 59, 61, 63 | Canvas scope; workflow boundary; preview/publish/execute disabled |
| `PHASE2_05_SHARED_COMPONENT_CATALOG.md` | 845-876, 948 | Binding terminology table and 7 rules; terminology audit checklist item |
| `PHASE3_01_CANVAS_IA_JOURNEYS.md` | 385-405, 498 | Canvas-vs-Automation table; in-product enforcement; AC-25 |
| `PHASE3_02_CANVAS_INTERACTIONS.md` | 256, 258 | No automation execution; no conversion of Canvas into automation surface |
| `PHASE3_03_CANVAS_API_CONTRACT.md` | 474-483 | Seven binding Automation boundaries on Canvas |
| `PHASE4_01_AUTOMATION_IA_REGIONS.md` | 520-546, 700 | Separation table; binding terminology; AC-20 |
| `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md` | 539-576, 600 | §11 Canvas separation; AC-15 |
| `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md` | 100-110, 244, 309, 846-859, 881 | §2.5 boundary evidence; §12 no-implied-runtime rule; AD-15 |

**Finding:** separation is documented in both directions (Canvas must not execute; Automation must not be implied live). **VERIFIED pass** on documentation coverage.

### 2.6 Current-state compliance summary

| # | Current-state property | Status |
|---|---|---|
| CS-1 | Separate routes and nav | **VERIFIED pass** |
| CS-2 | Separate icons | **VERIFIED pass** |
| CS-3 | Canvas tables free of automation columns | **VERIFIED pass** |
| CS-4 | No automation table/service/route/worker | **VERIFIED pass** |
| CS-5 | Automation Studio makes no network calls | **VERIFIED pass** |
| CS-6 | Automation preview markers present and disabled | **VERIFIED pass** |
| CS-7 | Canvas service has no connector/automation import | **VERIFIED pass** |
| CS-8 | Canvas UI contains Automation vocabulary (`workflows`) | **VERIFIED fail** — `CanvasList.tsx:79` |
| CS-9 | Canvas toolbar uses "Line/Arrow" | **VERIFIED fail vs target** — `CanvasToolbar.tsx:11` |
| CS-10 | Automation uses Canvas-domain CSS class name | **VERIFIED risk** — `AutomationStudio.tsx:76`, `index.css:430` |

---

## 3. Target-state separation evidence (Phase 3 / Phase 4)

### 3.1 Binding terminology — REPORTED, derived from `PHASE2_05_SHARED_COMPONENT_CATALOG.md:868-876`

1. Canvas uses **item / connection / shape / canvas / properties / place / link visually**.
2. Automation uses **node / flow / workflow / execution / run / trigger / branch / publish**.
3. Never use "task" as a Canvas primitive name — use **task card** (visual reference).
4. Never use "run"/"execute" in Canvas contexts.
5. Automation must always display draft/test/published state and never imply live execution without the backend runtime.
6. Shared components are reused by both surfaces, but their **content, labels, icons, and consequences** must differ.
7. Visual similarity is allowed; semantic conflation is not.

The same rules are restated at `PHASE4_01_AUTOMATION_IA_REGIONS.md:538-546` and `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md:545-557`.

### 3.2 Data-model constraints — PROPOSED, binding once approved

From `PHASE3_03_CANVAS_API_CONTRACT.md:474-483` and `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md:559-567`:

1. Canvas tables **must not** gain automation columns (`workflow_id`, `execution_id`, `trigger_config`).
2. The Canvas API **must not** expose `execute`, `run`, `trigger`, `workflow`, `execution`, or `order` semantics on connections.
3. Canvas ordering (`z_index`, item coordinates) **must not** be interpreted as execution order.
4. Canvas item `content`/`style` are inert data, never parsed as commands or workflow definitions.
5. Canvas CRUD **must not** invoke connectors or external systems.
6. A workflow edge is control flow; it **must never** be stored on `canvas_connections`, and a Canvas connection **must never** be interpreted as a workflow edge (`PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md:309,854`).

### 3.3 Permission and runtime boundaries — PROPOSED / DECISION-REQUIRED

| Boundary | Target rule | Source |
|---|---|---|
| Canvas access | Project-scoped read/manage/admin; every Canvas resolves to exactly one project | `PHASE2_02:59-61` |
| Automation access | Draft/publish/execute rights defined separately from Canvas | `PHASE2_02:52-55` |
| Publish / execute / replay | Disabled for every role until the Automation runtime boundary is approved | `PHASE2_02:54-55` |
| Runtime boundary | Preview-only until a separate runtime specification and owner authorization exist | `PHASE2_02:63`; `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md:117` (D-09) |
| Canvas integration | **None** — keep Canvas non-execution | `PHASE4_AUTOMATION_SPEC_APPROVAL_PACKAGE.md` AD-15 |
| No implied runtime | No UI may imply a runtime; no `/api/automation` route until approved | `PHASE4_03:851-852` |

### 3.4 Phase 3/4 acceptance criteria relevant to separation

| Criterion | Source | Status |
|---|---|---|
| AC-25 — No Canvas UI string or control uses Automation vocabulary; toolbar "Line/Arrow" renamed | `PHASE3_01:498` | **NOT MET** (`CanvasList.tsx:79`; `CanvasToolbar.tsx:11`) |
| AC-20 — Canvas and Automation keep separate names, data models, icons, and vocabulary; no Canvas regression | `PHASE4_01:700` | **PARTIAL** (names/data/icons pass; vocabulary fail at `CanvasList.tsx:79`) |
| AC-15 — Canvas separation restated with binding terminology and data-model constraints | `PHASE4_02:600` | **VERIFIED** as a specification artifact |
| Phase 3 blocking corrections B-1–B-9 | `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` | **OPEN** (review verdict: request changes) |
| Phase 4 owner decision AD-01 (preview-only) | `PHASE4_AUTOMATION_SPEC_APPROVAL_PACKAGE.md` | **Owner decision recorded as preview-only** (per card context); artifact table still lists AD-01 as open — provenance gap (AD-16) |

---

## 4. Conflicts and risks

| ID | Severity | Type | Finding | Evidence |
|---|---|---|---|---|
| R-1 | **Medium** | Conflict | Canvas list copy uses Automation vocabulary: "Map tasks, connections, and **workflows** visually." Violates binding rule 2 and the Canvas forbidden list (`workflow`). | `frontend/src/pages/CanvasList.tsx:79`; `PHASE2_05:866,871`; `PHASE3_01:498` (AC-25) |
| R-2 | **Medium** | Conflict | Canvas toolbar tool is labelled "Line/Arrow"; Phase 3 requires renaming it to a shape name so it cannot be read as an Automation edge. Not yet applied (CD-01 open). | `frontend/src/components/canvas/CanvasToolbar.tsx:11`; `PHASE3_01:402,498` |
| R-3 | **Low** | Risk | Automation Studio uses the Canvas-domain CSS class `.pm-canvas-tools`; the class is defined in the Automation CSS block. No live collision today, but the shared name weakens the naming boundary. | `AutomationStudio.tsx:76`; `frontend/src/index.css:430` |
| R-4 | **Low** | Risk | Automation Studio copy says "Project Canvas maps work." This is a cross-reference, not a primitive name, but it is the only Canvas-domain phrase inside the Automation surface and should get an explicit owner ruling. | `AutomationStudio.tsx:26`; `PHASE2_05:866` (Automation forbidden: "canvas item") |
| R-5 | **High** | Governance | Phase 3 specification is **not approved** (REQUEST CHANGES, B-1–B-9). The binding separation matrix below is therefore **PROPOSED**, not an approved contract. | `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` §2 |
| R-6 | **High** | Governance | CD-05 (connection semantics: purely visual vs mapped to `task_dependencies`) and CD-11 (Automation boundary confirmation) remain DECISION-REQUIRED; the data-model separation rule is not yet owner-approved. | `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` CD-05, CD-11 |
| R-7 | **Medium** | Governance | PM-P5-01 and the Phase 3/4 cards are **not recorded** in `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, or `CHECKLIST.md` (0 hits). Same governance gap as B-6 and AD-16. | Repository-wide search, 2026-11-10 |
| R-8 | **High** | Security | Canvas routes use `requireAuth` only; no project-scoped authorization. Separation is semantic, not permission-enforced. If a future Automation runtime reuses Canvas authorization, the gap propagates. | `backend/src/routes/canvas.routes.ts:8`; `PHASE2_02:59-61`; CB-1/CB-2 |
| R-9 | **High** | Security | Connector secrets are returned unredacted and without ownership checks. Automation's "Connector action" node implies connector use; the leak path is a prerequisite for any future action node. No live exposure while preview-only. | `backend/src/services/connector.service.ts:76-97,99-114`; `connectors.routes.ts:13-31`; A-3 |
| R-10 | **Medium** | Data model | `canvases.project_id` is nullable (`schema.sql:163`) and Canvas creation accepts null (`canvas.routes.ts:13-20`). This conflicts with "every Canvas resolves to exactly one project" and is a cross-project visibility risk. | `schema.sql:163`; `canvas.routes.ts:11-25`; `PHASE2_02:61`; B-3/CD-07 |
| R-11 | **Medium** | Dependency | The separation matrix depends on project-scoped RBAC and a `project_members` table that **do not exist**. The matrix cannot be enforced until Phase 2 RBAC work is approved and implemented. | `PHASE2_02:24,59-61`; B-4 |
| R-12 | **Low** | Process | Phase 2 artifact sizes changed during Phase 3 review; cross-phase citations are snapshot-dependent. This artifact cites line numbers, not hashes, and inherits that drift risk. | B-8; `PHASE3_04:43` |
| R-13 | **Low** | Process | No automated terminology audit exists; `PHASE2_05:948` ("Canvas vs Automation terminology audit passes") is an unchecked manual checklist item. | `PHASE2_05:948` |

---

## 5. Binding separation matrix

Status key: **VERIFIED** = true in live tree today; **PROPOSED** = target rule, not yet approved; **DECISION-REQUIRED** = owner decision open.

| Dimension | Project Canvas | Automation Studio | Binding rule | Status |
|---|---|---|---|---|
| **Terminology** | item, connection, shape, canvas, properties, place, link visually | node, flow, workflow, execution, run, trigger, branch, publish | `PHASE2_05:868-876` | **PROPOSED** (violated at `CanvasList.tsx:79`) |
| Forbidden vocabulary | run, execute, trigger, publish, edge, flow, workflow | shape, canvas item, visual-relationship wording | `PHASE2_05:866`; `PHASE4_02:557` | **PROPOSED** |
| Task meaning | task card = visual reference | task event = trigger payload / action target | `PHASE2_05:856` | **PROPOSED** |
| **Route** | `/canvas`, `/canvas/:id`, `/canvases`, `/canvases/:projectId` | `/automation` | `PHASE3_01:395`; `PHASE4_01:533` | **VERIFIED** (separate) |
| **Backend route** | `/api/canvas` | none (unmounted) | `PHASE4_03:852` | **VERIFIED** |
| **Data model** | `canvases`, `canvas_items`, `canvas_connections` | none (no tables) | `PHASE3_03:480`; `PHASE4_02:563` | **VERIFIED** (separate) |
| Shared table | none | none | `PHASE4_03:853-854` | **VERIFIED** |
| Automation columns on Canvas | none | n/a | `PHASE3_03:480` | **VERIFIED** |
| Connection semantics | visual relationship; no execution semantics | control-flow edge with ports/branches/guards | `PHASE2_05:852`; `PHASE3_03:475-478`; `PHASE4_03:309` | **PROPOSED** / CD-05 open |
| Ordering meaning | `z_index` / coordinates = visual only | execution order defined by edges | `PHASE3_03:478`; `PHASE4_02:565` | **PROPOSED** |
| Item content | inert text/graphics, never parsed as commands | node config redacted, no secrets | `PHASE3_03:481`; `PHASE4_02:566` | **PROPOSED** |
| **Permission** | project-scoped read/manage/admin | draft/publish/execute rights, defined separately | `PHASE2_02:59-61`; `PHASE2_02:52-55` | **PROPOSED** (no `project_members` table) |
| Publish / execute / replay | n/a | disabled for every role until runtime approval | `PHASE2_02:54-55` | **VERIFIED** (preview-only) |
| Connector side effects | none — Canvas CRUD must not call connectors | action nodes require scoped credentials | `PHASE3_03:482`; `PHASE4_02:567` | **VERIFIED** (no Canvas side effects) |
| **Runtime** | none — not an execution engine | preview-only; no runtime, no worker, no scheduler | `PHASE1:144`; `PHASE2_02:63`; `PHASE4_03:850-859` | **VERIFIED** (both non-executing) |
| Runtime boundary | n/a | preview-only until owner authorization | AD-01 (owner decision: preview-only) | **DECISION-REQUIRED** (recording gap, AD-16) |
| Canvas integration | none | none recommended | AD-15 | **DECISION-REQUIRED** |
| **Component / CSS** | `components/canvas/*`, `useCanvas.ts` | `pages/AutomationStudio.tsx` (self-contained) | `PHASE2_05:875` | **VERIFIED** (separate) |
| Shared primitives | Button/Panel/Inspector/Toolbar/Status/Toast/Empty/Loading/Error/Menu/Dialog/Drawer reused with different content/labels/icons/consequences | same | `PHASE2_05:875` | **PROPOSED** (shared layer not yet built) |
| CSS naming | `.pm-canvas-*` | `.pm-automation-*` expected; `.pm-canvas-tools` used at `AutomationStudio.tsx:76` | `PHASE2_05:876` | **VERIFIED risk** (R-3) |
| **Docs / authority** | Phase 3 spec (request changes) | Phase 4 spec (preview-only decision) | B-6 / AD-16 | **DECISION-REQUIRED** |

---

## 6. Concrete corrections needed

All corrections are **PROPOSED**. None is authorized by this card; each requires the relevant owner decision (CD-01 for Phase 3 corrections, AD-16 for provenance).

| # | Correction | File:line | Blocking decision |
|---|---|---|---|
| K-1 | Replace "workflows" with "connections" (or "relationships") in Canvas list copy. | `frontend/src/pages/CanvasList.tsx:79` | CD-01 / AC-25 |
| K-2 | Rename the "Line/Arrow" toolbar tool to a shape name (e.g. "Connector line") so it cannot be read as an Automation edge. | `frontend/src/components/canvas/CanvasToolbar.tsx:11` | CD-01 / AC-25 |
| K-3 | Rename `.pm-canvas-tools` to `.pm-workflow-tools` (or `.pm-automation-tools`) and update the Automation Studio usage. | `frontend/src/index.css:430`; `frontend/src/pages/AutomationStudio.tsx:76` | CD-01 / naming rule |
| K-4 | Obtain an owner ruling on the cross-reference sentence "Project Canvas maps work."; if retained, document it as an allowed comparative statement. | `frontend/src/pages/AutomationStudio.tsx:26` | Terminology rule 7 |
| K-5 | Record PM-P5-01 and the Phase 3/4 cards with acceptance definitions in the current authority documents (`KANBAN_BOARD.md` or successor). | `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, `CHECKLIST.md` | B-6 / AD-16 |
| K-6 | Add an automated or checklist-driven terminology audit for Canvas/Automation vocabulary (UI strings, class names, route names). | `PHASE2_05:948` checklist; CI | CD-01 |
| K-7 | Keep `/api/automation` unmounted and Canvas tables free of automation columns as binding invariants in the Phase 6 implementation contract. | `backend/src/index.ts`, `backend/src/server.ts`, `schema.sql` | AD-15 / `PHASE3_03:480` |
| K-8 | Resolve CD-05 (connection semantics) and CD-11 (Automation boundary) before any Canvas-Automation integration work. | Phase 3 decision register | CD-05 / CD-11 |

---

## 7. Acceptance criteria

| ID | Criterion | Status |
|---|---|---|
| AC-01 | No Canvas UI string or control uses Automation vocabulary (`run`, `execute`, `trigger`, `workflow`, `publish`, `edge`, `flow`, `node`). | **NOT MET** — `CanvasList.tsx:79` |
| AC-02 | No Automation UI string or control uses Canvas primitive vocabulary (`shape`, `canvas item`, visual-relationship wording). | **PARTIAL** — `AutomationStudio.tsx:26` cross-reference needs ruling |
| AC-03 | Canvas tables contain no automation column. | **VERIFIED pass** |
| AC-04 | No `/api/automation` route is mounted. | **VERIFIED pass** |
| AC-05 | Canvas service performs no connector or external call. | **VERIFIED pass** |
| AC-06 | Automation Studio makes no network call and shows preview-only markers. | **VERIFIED pass** |
| AC-07 | Canvas and Automation use distinct routes, nav labels, and icons. | **VERIFIED pass** |
| AC-08 | Binding separation matrix is recorded and reviewed by the owner. | **PROPOSED** — this artifact |
| AC-09 | Terminology audit exists and passes. | **NOT MET** — no audit (`PHASE2_05:948`) |
| AC-10 | Phase 3 blocking corrections B-1–B-9 and decisions CD-01–CD-12 are closed. | **OPEN** |
| AC-11 | Phase 4 decision AD-15 (Canvas integration: none) and AD-16 (card provenance) are recorded. | **DECISION-REQUIRED** |
| AC-12 | PM-P5-01 and Phase 3/4 cards appear in the current authority documents. | **NOT MET** — 0 hits |

---

## 8. Unresolved decisions

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| UD-01 | CD-05 — Canvas connection semantics | Purely visual / map to `task_dependencies` | Purely visual (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` CD-05) |
| UD-02 | CD-11 — Confirm Canvas remains non-execution | Confirm preview-only Automation boundary | Confirm (`PHASE3` CD-11) |
| UD-03 | AD-01 — Automation runtime boundary | Preview-only / test-only / live | Preview-only (owner decision per card context; artifact table still open) |
| UD-04 | AD-15 — Canvas integration | None / read-only task events / bidirectional | None (`PHASE4_03:881`) |
| UD-05 | AD-16 — Card provenance | Record Phase 4 cards in authority docs / accept delegating instruction | Record (`PHASE4_03:882`) |
| UD-06 | Whether "canvas" is permitted as a surface word in Automation ("Workflow canvas" region, `.pm-canvas-tools` class) | Permit as surface descriptor / reserve "canvas" for Project Canvas only | Reserve "canvas" for Project Canvas; rename the class (K-3) |
| UD-07 | Cross-reference copy "Project Canvas maps work." | Retain as positioning / remove from Automation surface | Retain with documented allowance (K-4) |
| UD-08 | K-1/K-2 terminology corrections | Approve now / defer to CD-01 | Approve with CD-01 (K-1, K-2) |

---

## 9. Evidence index

**Live source**
- `frontend/src/main.tsx:39,45-48` — routes
- `frontend/src/components/layout/AppShell.tsx:30-31,88-90,376-392` — nav + palette
- `frontend/src/components/layout/Icon.tsx:2,35,41` — icons
- `frontend/src/pages/Canvas.tsx` — Canvas page
- `frontend/src/pages/CanvasList.tsx:79` — terminology violation
- `frontend/src/pages/AutomationStudio.tsx:26,29-30,75-76,82,216,231` — preview-only markers, CSS class
- `frontend/src/components/canvas/CanvasToolbar.tsx:11` — "Line/Arrow"
- `frontend/src/components/canvas/PropertiesPanel.tsx:603-620` — connection authoring
- `frontend/src/hooks/useCanvas.ts` — Canvas-only hook
- `frontend/src/types/canvas.ts` — Canvas types
- `frontend/src/index.css:429-430` — Automation CSS block
- `backend/src/index.ts:37-51`; `backend/src/server.ts:41-55` — route registration
- `backend/src/routes/canvas.routes.ts:8` — `requireAuth` only
- `backend/src/services/canvas.service.ts` — no connector/automation import
- `backend/src/services/connector.service.ts:76-114` — secret exposure path
- `backend/src/routes/connectors.routes.ts:13-31` — unredacted returns
- `backend/src/database/schema.sql:161-201` — Canvas tables
- `backend/src/services/importExport.service.ts` — export scope excludes Canvas/Automation

**Authority artifacts**
- `PHASE1_DISCOVERY_DECISION_PACK.md:107,111-112,122,144,148-153`
- `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:52-63`
- `PHASE2_05_SHARED_COMPONENT_CATALOG.md:845-876,948`
- `PHASE3_01_CANVAS_IA_JOURNEYS.md:385-405,498`
- `PHASE3_02_CANVAS_INTERACTIONS.md:256,258`
- `PHASE3_03_CANVAS_API_CONTRACT.md:474-483`
- `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` — B-1–B-9, CD-01–CD-12
- `PHASE4_01_AUTOMATION_IA_REGIONS.md:520-546,700`
- `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md:539-576,600`
- `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md:100-110,244,309,846-859,881`
- `PHASE4_AUTOMATION_SPEC_APPROVAL_PACKAGE.md` — AD-01–AD-18
- `UI_UX_REDESIGN_PLAN.md:175,222,240-241`
- `handoff_future_uiux.md:46,51,63`

---

*Prepared as a read-only validation artifact for PM-P5-01. This card does not authorize source edits, schema changes, or Automation runtime work.*
