# PHASE4_01 — Automation Studio: Information Architecture & Builder-Region Specification

> **Kanban card:** PM-P4-01
> **Title:** Automation Studio information architecture and builder-region specification
> **Status:** PLANNING ARTIFACT — PROPOSED; NOT OWNER-APPROVED; NOT AN IMPLEMENTATION AUTHORIZATION
> **Date:** 2026-11-10
> **Workspace:** `<workspace>`
> **Scope:** Read-only planning. **No application source, schema, data, server, or migration was changed.** This artifact is the only file written.
> **Authoritative sources:** live repository tree; `UI_UX_REDESIGN_PLAN.md` (current design authority for Automation Studio); `PHASE1_DISCOVERY_DECISION_PACK.md`; `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md`; `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md`; `PHASE3_01_CANVAS_IA_JOURNEYS.md` (sibling IA specification); `handoff_future_uiux.md`; `UI_UX_PROGRESS.md`.
> **Boundary:** Automation Studio remains **preview-only**. This document specifies a target information architecture and builder regions. It does **not** authorize a runtime, schema, route, service, migration, or implementation.

---

## Evidence legend

| Label | Meaning |
|---|---|
| **VERIFIED** | Read directly from the live repository/DB in this task; path and line cited. |
| **REPORTED** | Stated in a repository document; document is the cited authority, not live code. |
| **PROPOSED** | Target-state specification authored by this artifact; not yet approved. |
| **UNKNOWN** | Not established by evidence; must not be assumed. |
| **DECISION-REQUIRED** | An owner decision gate; do not build until recorded. |

---

## 1. Executive summary

Automation Studio exists today as a **preview-only mock**: one route (`/automation`), one page (`frontend/src/pages/AutomationStudio.tsx`, 240 lines), four sample nodes, a three-tab inspector, a non-modal execution drawer with static sample data, and **zero** `fetch`/`useQuery` calls. There is no automation, workflow, execution, approval, or template table, route, service, or runtime anywhere in the repository or the live database (VERIFIED, §2.11).

This artifact inventories that current IA, then specifies a **target** Automation Studio IA and six builder regions — **library, canvas, inspector, execution/history, templates, approvals** — together with navigation, states, accessibility, responsive requirements, the explicit preview-only boundary, and the Canvas-vs-Automation semantic separation. It mirrors the structure of the sibling Canvas IA specification (`PHASE3_01_CANVAS_IA_JOURNEYS.md`) so the two surfaces stay comparable and non-overlapping.

The target IA is grounded in the current design authority `UI_UX_REDESIGN_PLAN.md` §7 (`:173-214`), which defines the studio navigation (`Workflows / Executions / Approval gates / Templates / Settings`), the builder composition (top bar, left library, center canvas, right inspector, bottom execution drawer), six workflow primitives, and reliability/privacy/governance guardrails. This artifact extends that into a full region-by-region specification and acceptance criteria.

**Nothing in this document authorizes implementation.** The runtime boundary remains DECISION-REQUIRED (§10, D2).

---

## 2. Current Automation Studio IA inventory (VERIFIED)

All facts in this section were read from the live tree unless marked REPORTED.

### 2.1 Route map and navigation entry points

| Entry point | Target | Evidence |
|---|---|---|
| Route declaration | `/automation` → `AutomationStudio` | `frontend/src/main.tsx:39` |
| Sidebar → Tools → "Automation Studio" | `/automation` | `frontend/src/components/layout/AppShell.tsx:31` |
| Sidebar flags the item `future: true` → renders "Preview" tag | — | `AppShell.tsx:31,88-90` |
| Command palette action "Open Automation Studio" (hint `G W`) | `/automation` | `AppShell.tsx:385-392` |
| Icon | `automation` icon (distinct from `canvas`) | `frontend/src/components/layout/Icon.tsx:2,41`; `Icon.tsx:35` |

**VERIFIED:** the route is registered inside the protected workspace (`main.tsx:34-49`); unauthenticated users are redirected to `/login` (`main.tsx:26,50`).

### 2.2 Page shell

`frontend/src/pages/AutomationStudio.tsx` is a single default-exported component with no sub-components, no hooks beyond `useState`, and no data access.

| Element | Content | Evidence |
|---|---|---|
| Kicker | `AUTOMATION STUDIO · FUTURE MODULE` | `AutomationStudio.tsx:24` |
| Heading | "Make automation inspectable before it becomes executable." | `:25` |
| Tagline | "Project Canvas maps work. Automation Studio would execute approved workflow definitions." | `:26` |
| Preview notice | "Preview only · no runtime connected" | `:29` |
| Publish control | `Publish workflow` — **disabled** | `:30` |
| Layout | `.pm-automation-layout` grid: 177px / 1fr / 258px; rows 1fr / 178px | `:34`; `frontend/src/index.css:430` |
| Draft badge | "Draft · test only" | `:82` |

**VERIFIED:** the file contains **0** occurrences of `fetch` and **0** of `useQuery` (regex scan, this task). It contains **2** `disabled` attributes (`:30`, `:216`) and **4** `useState` calls (`:15-17` plus one execution tab state at `:17`).

### 2.3 Builder regions present today

| Region | Present | Container | Evidence |
|---|---|---|---|
| Library | Yes (static) | `.pm-automation-library` | `AutomationStudio.tsx:35-73` |
| Canvas / flow | Yes (static sample) | `.pm-automation-canvas` | `:75-118` |
| Inspector | Yes (static) | `.pm-node-inspector` | `:120-195` |
| Execution / history | Yes (static) | `.pm-execution-drawer` | `:197-235` |
| Templates | **No** | — | absent from page and route map |
| Approvals | **No** | — | absent from page; `ReviewQueue.tsx` is a blocked-task queue, not an automation approval surface |

### 2.4 Node library inventory

Current library (`AutomationStudio.tsx:35-73`) is a left column with a decorative search affordance and four sections:

| Section | Item | Selectable | Evidence |
|---|---|---|---|
| Start | Task event | Yes | `:41-47` |
| Logic | Condition | Yes | `:48-54` |
| Actions | Connector action | Yes | `:55-60` |
| Actions | Human gate | Yes | `:61-65` |
| Safety | Error handler | **No** (no `onClick`) | `:66-72` |

**VERIFIED:** the "Search approved nodes" element at `:37-40` is a styled `div`, not an `input`; it cannot filter. The four selectable items only set `selected` state; they do not add nodes to the canvas. The node catalog is a hardcoded `nodeInfo` record (`:7-12`) with four entries: `trigger`, `condition`, `notify`, `review`.

**REPORTED (design authority):** the target library is "Trigger, Transform, Decision, Action, Human Gate, Error Handler" with search and approved templates and no arbitrary unbounded plugin gallery (`UI_UX_REDESIGN_PLAN.md:191`). The current mock has no Transform node and no template search.

### 2.5 Canvas / flow region inventory

| Element | Current behavior | Evidence |
|---|---|---|
| Canvas tools | `Select` (active), `+ Node`, `Fit`, `Sample data` — static buttons | `AutomationStudio.tsx:76-81` |
| Flow lines | Decorative SVG bezier paths, `aria-hidden="true"` | `:83-89` |
| Branch labels | Static `YES` / `NO` spans | `:90-91` |
| Nodes | Four absolutely-positioned buttons (trigger, condition, notify, review) | `:92-111` |
| End node | Static "Record / Result" | `:112-116` |
| Zoom | Static `− 100% +` badge; not functional | `:117` |
| Background | Dot grid via CSS | `index.css:430` |

**VERIFIED:** the canvas has **no** pan, zoom, drag, node authoring, edge authoring, minimap, or keyboard node navigation. Node positions are fixed CSS classes (`.pm-flow-node.trigger`, `.condition`, `.notify`, `.review`) at `index.css:430`. The `+ Node` and `Fit` controls have no handlers.

**REPORTED (design authority):** target center canvas is a "directional, spatially consistent node graph with clear entry/exit ports and a minimap only when scale requires it" (`UI_UX_REDESIGN_PLAN.md:192`).

### 2.6 Inspector inventory

| Tab | Content | Evidence |
|---|---|---|
| Settings | Node name (read-only), Purpose (read-only), Node kind, warning copy | `AutomationStudio.tsx:140-158` |
| Input | Sample input preview, input schema, warning copy | `:160-175` |
| Output | Sample output preview, output schema, warning copy | `:177-193` |

**VERIFIED:** all inspector fields are `readOnly` (`:144`, `:148`); the inspector cannot edit a node. The tab bar is a plain `nav` with buttons (`:128-138`), not an ARIA tablist. The inspector header has a close icon with no accessible label and no handler (`:126`).

**REPORTED (design authority):** target inspector covers "node settings, input, output, validation, and permission warnings. Input/output data defaults to redacted previews" (`UI_UX_REDESIGN_PLAN.md:193`).

### 2.7 Execution / history inventory

| Element | Current behavior | Evidence |
|---|---|---|
| Drawer | `.pm-execution-drawer`, bottom row, non-modal | `AutomationStudio.tsx:197-235`; `index.css:430` |
| History tabs | "Sample test preview" (active), "Past executions", "Failures / replay" — static buttons | `:199-208` |
| Step inspector | Static four-step list: done / active / pending / pending | `:219-224` |
| Selected-node I/O | Static JSON sample | `:225-232` |
| Replay | `Replay node · future` — **disabled** | `:216` |
| Explicit notice | "Live run history is deliberately not simulated. It must be powered by a separately approved backend runtime." | `:231` |

**VERIFIED:** the drawer contains no run data, no timestamps, no actor, no outcome, no error location, and no replay controls. The execution tab state is local `useState` (`:17`) and does not change content.

**REPORTED (design authority):** target bottom drawer contains "execution history, step timeline, selected-node trace, error location, sample/pinned data, and safe replay constraints" (`UI_UX_REDESIGN_PLAN.md:194`).

### 2.8 Templates and approvals inventory

**VERIFIED:** there is **no** templates region, template picker, approval gate UI, approval queue, or approval action in `AutomationStudio.tsx`, `AppShell.tsx`, or any route. The only approval-adjacent surface is `frontend/src/pages/ReviewQueue.tsx`, which fetches real blocked tasks (`:9`) and dashboard stats (`:10`) but explicitly disables agent approvals: "Agent proposals and human approvals are intentionally not faked in this interface. Their UI will be enabled after approval records and an API contract are implemented." (`ReviewQueue.tsx:11`).

**REPORTED (design authority):** target studio navigation includes "Approval gates # queued human decisions" and "Templates # organization-approved starting points" (`UI_UX_REDESIGN_PLAN.md:183-184`); the Human Gate primitive requires "explicit decision, expiry, audit record" (`:204`).

### 2.9 Client state inventory

`AutomationStudio.tsx:15-17` holds all state locally:

| State | Type | Purpose |
|---|---|---|
| `selected` | `NodeId` (`trigger \| condition \| notify \| review`) | selected node; drives inspector |
| `inspectorTab` | `settings \| input \| output` | inspector tab |
| `executionTab` | `history \| failures` | execution drawer tab |

**VERIFIED:** no URL state, no persistence, no undo/redo, no dirty flag, no validation state, no workflow identity, and no project scope. State is lost on reload.

### 2.10 Styling inventory

All Automation Studio styles live in `frontend/src/index.css`:

| Lines | Content |
|---|---|
| `:425` | `.pm-automation-page` |
| `:429` | comment "Automation Studio (intentionally non-live)" |
| `:430` | single compressed line defining `.pm-automation-layout`, library, canvas, tools, flow nodes, end node, inspector, execution drawer, trace, and all sub-classes |
| `:432` | `@media (max-width: 1120px)` — 3 columns become 158px / 1fr / 225px; flow nodes 150px; end node hidden |
| `:433` | `@media (max-width: 850px)` — single column; library becomes horizontal; inspector and drawer stack |

**VERIFIED:** the automation class inventory matches `PHASE2_05_SHARED_COMPONENT_CATALOG.md:193` ("Automation family — EXISTING (preview-only)"). No automation styles use Tailwind color classes.

### 2.11 Backend and data inventory

**VERIFIED — no automation backend exists:**

| Check | Result | Evidence |
|---|---|---|
| Schema tables | 18 tables; **no** automation/workflow/execution/approval/environment/template table | `backend/src/database/schema.sql` (full read); live DB `backend/data/app.db` read-only query |
| Live DB | 18 tables; zero rows in `canvases`, `canvas_items`, `canvas_connections`, `connectors`, `audit_logs`, `agent_activities` | read-only SQLite query this task |
| Route registration | `index.ts` and `server.ts` register auth, users, dashboard, agents, projects, tasks, checklists, dependencies, git, import-export, canvas, backup, monitoring, ui-layout, connectors — **no automation route** | `backend/src/index.ts`; `backend/src/server.ts` |
| Services | no automation/workflow/execution/approval service | `backend/src/services/` directory listing |
| Keyword scan | `automation`, `workflow`, `approval`, `execution` do not appear in any backend source file | regex scan this task |
| Frontend data access | `AutomationStudio.tsx` has 0 `fetch`, 0 `useQuery` | `AutomationStudio.tsx` full read |

**Relevant existing data model (for target integration, not present):** Canvas tables (`schema.sql:161-201`), connectors (`:205-229`), `audit_logs` (`:79-92`), `agent_activities` (`:108-119`). Connectors define two providers with actions — GitHub (`list_repos`, `create_issue`, `list_issues`, `link_commit`) and Hermes (`test_connection`, `send_message`, `list_models`) — in `backend/src/services/connector.service.ts` (`AVAILABLE_CONNECTORS`). Connector configs may contain secrets (`access_token`, `api_key`) and must never be rendered (§6, §8).

### 2.12 Interaction inventory

| Interaction | Current | Evidence |
|---|---|---|
| Node selection | Click node or library item → inspector updates | `AutomationStudio.tsx:43,50,57,61,92,97,102,107` |
| Inspector tabs | Click switches read-only content | `:129-137` |
| Execution tabs | Click switches active styling only | `:200-208` |
| Canvas pan/zoom/drag | None | `:75-118` |
| Edge authoring | None | `:83-89` |
| Keyboard | Tab/Enter as native buttons; no arrow-key node nav, no Delete, no Escape | `:92-111`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md` keyboard matrix |
| Focus management | None; close icon unlabelled | `:126` |

### 2.13 Orphaned and conflicting assets

| Asset | Status | Evidence |
|---|---|---|
| `TaskCard.tsx` | Orphan (0 imports); dead Enter/Space handler | `PHASE3_01_CANVAS_IA_JOURNEYS.md` §2.5/§2.8 |
| `DesignCanvas.tsx` / `DraggableElement` | Orphan; Design Mode excluded from main workspace | `UI_UX_PROGRESS.md:9`; `PHASE3_01` §2.5 |
| `AutomationStudio.tsx` node data | Hardcoded `nodeInfo`; no external type | `AutomationStudio.tsx:7-12` |
| Automation CSS | Compressed onto one line (`index.css:430`); hard to review | `index.css:430` |

### 2.14 Capability gaps (VERIFIED)

1. No workflow list, detail route, or workflow identity.
2. No node authoring, edge authoring, or canvas editing.
3. No functional search, zoom, pan, fit, minimap, or keyboard canvas semantics.
4. No editable inspector; no validation; no permission warnings.
5. No execution history, step trace, error location, or replay.
6. No templates region or template governance.
7. No approvals region or human-gate decision UX.
8. No workflow states, versioning, publish/pause/archive controls.
9. No audit, actor identity, or redacted trace.
10. No project scoping, RBAC, or authorization.
11. No loading/empty/error states beyond static sample content.
12. No tests for Automation Studio.

### 2.15 Documentation evidence

| Claim | Source | Classification |
|---|---|---|
| Automation Studio is preview-only; no runtime, no `fetch`, Publish disabled | `PHASE1_DISCOVERY_DECISION_PACK.md:19,111,181` | VERIFIED (re-confirmed this task) |
| No automation/workflow/execution/approval/environment tables | `PHASE1_DISCOVERY_DECISION_PACK.md:61` | VERIFIED |
| Canvas connection is a visual relationship, not an Automation control-flow edge | `PHASE1_DISCOVERY_DECISION_PACK.md:122` | REPORTED (design authority) |
| Recommended runtime boundary: keep preview-only until a separate specification is approved (Decision C1) | `PHASE1_DISCOVERY_DECISION_PACK.md:148-153` | REPORTED |
| Automation data contract is DECISION-REQUIRED — do not build until approved | `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:610` | REPORTED |
| Hard rule: never imply Automation Studio has a functioning runtime | `handoff_future_uiux.md:51` | REPORTED |
| Studio IA: Workflows / Executions / Approval gates / Templates / Settings | `UI_UX_REDESIGN_PLAN.md:180-185` | REPORTED (current design authority) |
| Strict Canvas separation | `UI_UX_PROGRESS.md:10` | REPORTED |
| UIUX-007 "Enhance Automation Studio Interactive Inspector & I/O Tabs" marked DONE | `UI_UX_PROGRESS.md:22` | REPORTED |

---

## 3. User roles and journeys

### 3.1 Roles

Roles are **REPORTED** from `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:42-59` (project-scoped membership; not the global `users.role` column). The automation-specific rows:

| Capability | Owner | Editor | Viewer | Commenter | Agent |
|---|---|---|---|---|---|
| Workflow/Automation preview and read (current state) | R | R | R | R | None unless explicitly granted; no runtime authority follows |
| Future workflow draft | C/U/D drafts | C/U/D drafts | R | R; comments only | None by default; `workflow.draft.*` only if granted |
| Publish workflow | **Disabled for every role now.** Later: owner only, immutable reviewed version, explicit confirmation, audit | No | No | No | Never |
| Execute, replay, or retry a side-effecting workflow | **Disabled for every role now.** Later: separate owner authorization + per-run approval | No | No | No | No self-start or self-approval |

**PROPOSED:** this artifact does not change that matrix. It specifies the IA for the **preview** state and the future target state; it does not authorize draft/publish/execute rights.

### 3.2 Primary journeys

**J1 — Inspect the preview (current, VERIFIED baseline).** User opens Tools → Automation Studio (`AppShell.tsx:31`) → sees preview notice and disabled Publish (`AutomationStudio.tsx:29-30`) → selects a node → reads inspector I/O and warnings. No data is fetched.

**J2 — Author a draft workflow (target, PROPOSED).** Owner/Editor opens a workflow → picks nodes from the library → connects them on the canvas → configures each node in the inspector → sees validation and permission warnings → saves a draft. Drafting is not publishing (`PHASE2_02:63`).

**J3 — Test with pinned data (target, PROPOSED).** Author runs a test using sample/pinned data only; the drawer shows a redacted step trace; side-effecting connectors are mocked or disabled (`UI_UX_REDESIGN_PLAN.md:210`).

**J4 — Approve a human gate (target, PROPOSED).** A run reaches a Human Gate → the decision appears in Approval gates → an authorized reviewer grants/rejects with an explicit decision → the outcome, expiry, and audit link are recorded (`UI_UX_REDESIGN_PLAN.md:204,212`).

**J5 — Start from a template (target, PROPOSED).** Author picks an organization-approved template → a versioned draft is created → then edited as in J2 (`UI_UX_REDESIGN_PLAN.md:184,191`).

**J6 — Inspect execution history (target, PROPOSED).** Owner/Editor opens Executions → filters runs → selects a run → inspects the step timeline, error location, and selected-node trace → replays only non-side-effecting nodes (`UI_UX_REDESIGN_PLAN.md:194,211`; `PHASE2_03:391`).

### 3.3 Cross-cutting journey rules (PROPOSED)

1. Every screen states whether it is preview, draft, test, or published — never ambiguous.
2. No control implies live execution without the separately approved runtime (`handoff_future_uiux.md:51`).
3. No secret, credential, or unredacted payload is rendered anywhere in the studio.
4. Selection, validation, and execution status are announced to assistive technology.
5. Every consequential action (publish, approve/reject, replay side effect, delete) requires explicit confirmation and produces an audit record.
6. Canvas and Automation never share a route, data model, or vocabulary (§5).

---

## 4. Target information architecture and builder regions (PROPOSED)

### 4.1 Navigation

**Top-level (unchanged, VERIFIED):** "Automation Studio" remains a Tools item at `/automation` with the `Preview` tag (`AppShell.tsx:31,88-90`) and a command palette action (`:385-392`). It is never merged with "Project Canvas".

**Studio-internal IA (REPORTED design authority, `UI_UX_REDESIGN_PLAN.md:180-185`):**

```
Automation Studio
├── Workflows          # drafts, active, paused, archived
├── Executions         # history, errors, filtered runs
├── Approval gates     # queued human decisions
├── Templates          # organization-approved starting points
└── Settings           # credentials references, environments, limits
```

**PROPOSED routes (DECISION-REQUIRED D3):**

| Route | Purpose |
|---|---|
| `/automation` | Studio home → Workflows list (drafts, active, paused, archived) |
| `/automation/workflows/:id` | Builder (regions R1–R4) |
| `/automation/executions` | Execution history list |
| `/automation/executions/:id` | Run detail (step timeline, trace, error location) |
| `/automation/approvals` | Queued human decisions |
| `/automation/templates` | Organization-approved templates |
| `/automation/settings` | Credential references, environments, limits |

**PROPOSED navigation rules:**

1. The studio-internal nav is a secondary tab/section bar inside the studio, distinct from the global sidebar.
2. Active section is exposed with `aria-current="page"` (or an equivalent tab pattern).
3. The preview tag persists until the runtime boundary is approved (§4.13).
4. Deep links to a workflow/run/approval are supported via the routes above; selection state may be URL-synced (DECISION-REQUIRED D3).

### 4.2 Builder shell

**REPORTED composition (`UI_UX_REDESIGN_PLAN.md:188-194`):** top bar (workflow name, state, version, test, save, publish), left library, center canvas, right inspector, bottom execution drawer.

**PROPOSED shell contract:**

| Region | Position | Purpose |
|---|---|---|
| Top bar | Above builder | Workflow identity, lifecycle state, version, test/save/publish actions |
| R1 Library | Left | Node catalog, search, templates entry |
| R2 Canvas | Center | Directional node graph, ports, branch labels, minimap when needed |
| R3 Inspector | Right | Node settings, input, output, validation, permission warnings |
| R4 Execution/history | Bottom | Run history, step timeline, selected-node trace, replay constraints |
| R5 Templates | Library/top bar entry | Approved starting points |
| R6 Approvals | Studio section + in-builder gate | Queued human decisions |

The shell must not be a single crowded screen; the six regions have distinct names, icons, and consequences (`UI_UX_REDESIGN_PLAN.md:13`).

### 4.3 R1 — Node library

**Purpose:** authoring palette of approved nodes.

**Contents (PROPOSED, grounded in `UI_UX_REDESIGN_PLAN.md:191,196-205`):**

| Category | Nodes |
|---|---|
| Start | Trigger (task event) |
| Logic | Transform, Decision |
| Actions | Action (connector) |
| Safety | Human Gate, Error handler |

**Behavior contract (PROPOSED):**

1. Search filters the catalog by name/kind; it is a real `input` with an accessible label (current is a static `div`, `AutomationStudio.tsx:37-40`).
2. Selecting a library item and clicking the canvas adds a node; drag-and-drop is preferred (DECISION-REQUIRED D3).
3. Each node displays kind, icon, and a short description; icons are distinct from Canvas icons.
4. Connector actions come from an approved, scoped catalog (§10 D9); no arbitrary plugin gallery.
5. The library shows approval/permission state for nodes that require a credential or scope.
6. Empty search results show a clear empty state.

**Current vs target:** current library is static and cannot add nodes (`AutomationStudio.tsx:35-73`); target is an interactive, filtered catalog.

### 4.4 R2 — Workflow canvas

**Purpose:** directional, spatially consistent node graph with clear entry/exit ports.

**Behavior contract (PROPOSED):**

1. Nodes are connected by **control-flow edges** with visible ports; edges are directional.
2. Decision nodes expose labeled branches (e.g., YES/NO) and test cases (`UI_UX_REDESIGN_PLAN.md:202`).
3. The canvas supports pan, zoom, fit, and a minimap only when scale requires it (`UI_UX_REDESIGN_PLAN.md:192`).
4. Node positions are persisted per workflow; ordering is explicit and not inferred from coordinates.
5. Invalid edges (self-loop, duplicate, cross-project target, cycle) are rejected with a visible reason (DECISION-REQUIRED D6/D9).
6. The canvas is keyboard-operable: arrow-key node navigation, Delete to remove a selection, Escape to deselect/cancel, Ctrl/Cmd+Z undo (§6).
7. A visible workflow state badge (draft/test/published/paused/archived) is always present.
8. No "Run", "Execute", or "Publish" control appears on the Canvas surface (§5).

**Current vs target:** current canvas is four fixed sample nodes with decorative SVG paths and no authoring (`AutomationStudio.tsx:75-118`).

### 4.5 R3 — Inspector

**Purpose:** configure and inspect the selected node.

**Tabs (PROPOSED):** Settings, Input, Output, Validation, Permissions.

| Tab | Content |
|---|---|
| Settings | Node name, purpose, kind, trigger subscription / branch labels / action target |
| Input | Input schema, sample/pinned preview (redacted) |
| Output | Output schema, sample/pinned preview (redacted) |
| Validation | Required fields, type/range checks, edge constraints, test cases |
| Permissions | Required connector scope, credential reference (never the secret), approval requirement |

**Behavior contract (PROPOSED):**

1. All fields have programmatic labels; inputs are editable for authorized roles.
2. Input/output previews are redacted by default (`UI_UX_REDESIGN_PLAN.md:193`).
3. Validation errors are inline and linked with `aria-describedby`; warnings use `role="note"` or `aria-live="polite"`.
4. Permission warnings state what scope/credential/approval is missing without revealing secrets.
5. Tab pattern uses `role="tablist"`/`tab`/`tabpanel` with `aria-selected`/`aria-controls` and arrow-key navigation (`PHASE2_05:533-539`).
6. Close button has an accessible label and returns focus to the invoker.

**Current vs target:** current inspector is read-only with three tabs and no validation/permissions (`AutomationStudio.tsx:120-195`).

### 4.6 R4 — Execution / history

**Purpose:** inspect runs and step outcomes.

**Contents (PROPOSED, grounded in `UI_UX_REDESIGN_PLAN.md:194`):**

1. Execution history list with workflow version, initiating actor, timestamps, outcome, and approval link.
2. Step timeline showing per-node outcome and error location.
3. Selected-node trace with redacted input/output.
4. Failures filter and safe replay controls.
5. Sample/pinned data indicator for test runs.

**Behavior contract (PROPOSED):**

1. The drawer is **non-modal** by default so nodes remain inspectable (`PHASE2_05:579`).
2. Every run stores a redacted step trace, version ID, initiating actor, timestamps, outcome, and approval link when applicable (`UI_UX_REDESIGN_PLAN.md:212`).
3. Replay is allowed only for non-side-effecting nodes by default; a side-effecting replay requires an explicit reviewed mode and a fresh audit trail (`UI_UX_REDESIGN_PLAN.md:211`; `PHASE2_03:391`).
4. Failures are visible and never silently swallowed (`UI_UX_REDESIGN_PLAN.md:205`).
5. Empty state: "No executions yet"; loading state: skeleton; error state: retry with a safe message.
6. No live run history is simulated without the approved runtime (current behavior, `AutomationStudio.tsx:231`).

**Current vs target:** current drawer is static sample content with disabled replay and an explicit no-live-history notice (`AutomationStudio.tsx:197-235`).

### 4.7 R5 — Templates

**Purpose:** organization-approved starting points.

**Behavior contract (PROPOSED):**

1. Templates are curated and approved; they are not user-published plugins (`UI_UX_REDESIGN_PLAN.md:191`).
2. Each template declares its required triggers, nodes, credential references, and scopes.
3. Creating from a template produces a versioned draft, never a published workflow.
4. Template contents are validated like any workflow; secrets are never stored in a template payload (`UI_UX_REDESIGN_PLAN.md:213`).
5. Empty state: "No templates available"; no template can be created without owner approval (DECISION-REQUIRED D5).

**Current vs target:** no templates region exists today (§2.8).

### 4.8 R6 — Approvals

**Purpose:** queued human decisions.

**Behavior contract (PROPOSED):**

1. Human Gate nodes surface pending decisions in the Approvals section and, contextually, in the builder.
2. Each decision shows actor, trigger, target, change preview, rationale, impact, and consequence (`UI_UX_REDESIGN_PLAN.md:204`).
3. Decision states: queued, granted, rejected, expired (`PHASE2_03:250`).
4. Expiry is a distinct outcome, not a failure (`PHASE2_03:362`).
5. Only authorized roles may decide; agents can never self-approve (`PHASE2_02:54-55`).
6. Every decision writes an immutable audit record with actor, timestamp, and approval link (`UI_UX_REDESIGN_PLAN.md:212`).
7. Approvals are never faked; the surface is disabled until the backend contract exists (`ReviewQueue.tsx:11`).

**Current vs target:** no approvals region exists; `ReviewQueue.tsx` is blocked-task only.

### 4.9 Region map

| Region | Current state (VERIFIED) | Target state (PROPOSED) | Primary evidence |
|---|---|---|---|
| R1 Library | Static, 5 items, decorative search | Filtered, approved node catalog | `AutomationStudio.tsx:35-73`; `UI_UX_REDESIGN_PLAN.md:191` |
| R2 Canvas | 4 fixed sample nodes, decorative edges | Directional node graph with ports | `AutomationStudio.tsx:75-118`; `UI_UX_REDESIGN_PLAN.md:192` |
| R3 Inspector | 3 read-only tabs | 5 tabs incl. validation + permissions | `AutomationStudio.tsx:120-195`; `UI_UX_REDESIGN_PLAN.md:193` |
| R4 Execution/history | Static sample, disabled replay | Run history + trace + safe replay | `AutomationStudio.tsx:197-235`; `UI_UX_REDESIGN_PLAN.md:194` |
| R5 Templates | Absent | Approved starting points | `UI_UX_REDESIGN_PLAN.md:184,191` |
| R6 Approvals | Absent | Queued human decisions | `UI_UX_REDESIGN_PLAN.md:183,204`; `PHASE2_03:250` |

### 4.10 States

**Workflow lifecycle (REPORTED, `UI_UX_REDESIGN_PLAN.md:209`):** `draft`, `test`, `published`, `paused`, `archived`. Each is distinct and must be visible.

**Node states (PROPOSED):** `idle`, `selected`, `valid`, `invalid`, `warning`, `running`, `succeeded`, `failed`, `skipped`, `awaiting_approval`, `cancelled`.

**Execution states (PROPOSED, aligned to `PHASE2_03` event catalog `:250`):** `queued`, `running`, `step_completed`, `completed`, `failed`, `cancelled`, `awaiting_approval`, `expired`, `replayed`.

**Approval states (PROPOSED, `PHASE2_03:250`):** `queued`, `granted`, `rejected`, `expired`.

**Connection/edge states (PROPOSED):** `valid`, `invalid`, `duplicate`, `self_loop`, `cross_project`, `cycle`.

**State rules (PROPOSED):**

1. State is never conveyed by color alone; pair with text labels/icons (`PHASE2_04` C-04).
2. Draft/test/published are always shown; preview-only state is always shown.
3. A paused or archived workflow cannot be executed; the UI disables the action and explains why.
4. State transitions are attributable and audited (`PHASE2_03:467` coverage matrix).

### 4.11 Routing and URL state

**PROPOSED:** workflow identity, run identity, and approval identity are URL-addressable (§4.1). Selection and inspector tab may be URL-synced for deep linking; pan/zoom are view state and may be session-only (DECISION-REQUIRED D3). Reloading a draft must not silently lose work; persistence model is DECISION-REQUIRED D4.

### 4.12 Empty, loading, and error states

| Region | Empty | Loading | Error |
|---|---|---|---|
| Library | "No nodes match your search" | Skeleton rows | Safe message + retry |
| Canvas | "No nodes yet — add a trigger" | Skeleton | Validation summary |
| Inspector | "Select a node to inspect" | Skeleton | Field-level errors |
| Execution/history | "No executions yet" | Skeleton | Retry + safe message |
| Templates | "No templates available" | Skeleton | Retry |
| Approvals | "No pending decisions" | Skeleton | Retry |

**PROPOSED rule:** never collapse a failure into a full-page error with no retry; never present a failure as an empty state (contrast the Canvas failure pattern flagged in `PHASE3_02_CANVAS_INTERACTIONS.md:204-211`).

### 4.13 Preview-only boundary controls

**VERIFIED current controls (must be preserved):**

1. "Preview only · no runtime connected" notice (`AutomationStudio.tsx:29`).
2. Disabled "Publish workflow" (`:30`).
3. "Draft · test only" badge (`:82`).
4. Disabled "Replay node · future" (`:216`).
5. No `fetch`/`useQuery` (`0` occurrences).
6. "Live run history is deliberately not simulated…" (`:231`).
7. No automation tables, routes, services, or runtime (§2.11).

**PROPOSED boundary rules:**

1. The preview notice and disabled Publish persist until a separate runtime specification is approved (`PHASE1_DISCOVERY_DECISION_PACK.md:148-153`, Decision C1).
2. No design, mockup, prototype, or screenshot may imply a functioning runtime (`handoff_future_uiux.md:51`).
3. Any future "Test", "Run", or "Publish" control is disabled until the runtime boundary and permission matrix are approved (`PHASE2_02:54-55`).
4. This artifact does not lift the boundary; it specifies the IA that will exist behind it.

---

## 5. Canvas vs Automation — explicit semantic separation

**Authoritative rule (REPORTED):** "Project Canvas visualizes work. Automation Studio executes approved workflow definitions. They must never share a misleading name, a data model, or an implied execution engine." (`UI_UX_REDESIGN_PLAN.md:175`; reinforced at `handoff_future_uiux.md:46,51,63` and `PHASE1_DISCOVERY_DECISION_PACK.md:122`.)

| Dimension | Project Canvas | Automation Studio |
|---|---|---|
| Purpose | Visual planning/diagramming | Executable workflow authoring, testing, inspection |
| Data | `canvases`, `canvas_items`, `canvas_connections` (`schema.sql:161-201`) | No tables; no runtime (`PHASE1_DISCOVERY_DECISION_PACK.md:61`) |
| Connection meaning | **Visual relationship** between items; no execution semantics | **Control-flow edge** with ports, branches, guards |
| Primitive | Item (shape, text, task card, line) | Node (trigger, transform, decision, action, human gate, error handler) |
| Inspector | Geometry / style / content | Settings / input / output / validation / permissions |
| Task meaning | Task card is a **visual reference** | Task event is a **trigger payload / action target** |
| Status | Selection / drag / save state | Workflow + node + execution + approval states |
| Route | `/canvases`, `/canvas/:id` (`main.tsx:45-48`) | `/automation` (`main.tsx:39`) |
| Nav label | "Project Canvas" (`AppShell.tsx:30`) | "Automation Studio" + Preview tag (`AppShell.tsx:31,88-90`) |
| Vocabulary | item, shape, connection, canvas, place, link visually | workflow, node, flow, execution, run, trigger, branch, publish |
| Status (implementation) | Implemented | Preview only; runtime requires separate owner decision |

**Binding terminology rules (REPORTED, `PHASE2_05_SHARED_COMPONENT_CATALOG.md:868-876`):**

1. Canvas uses **item / connection / shape / canvas / properties / place / link visually**.
2. Automation uses **node / flow / workflow / execution / run / trigger / branch / publish**.
3. Never use "task" as a Canvas primitive name — use **task card** (visual reference).
4. Never use "run"/"execute" in Canvas contexts.
5. Automation must always display draft/test/published state and never imply live execution without the runtime.
6. Shared components (Button, Panel, Inspector, Toolbar, Status, Toast, Empty, Loading, Error, Menu, Dialog, Drawer) are reused by both surfaces, but their **content, labels, icons, and consequences** must differ.
7. Visual similarity is allowed; semantic conflation is not.

**In-product enforcement (PROPOSED):**

1. Never use execution verbs (run, trigger, execute, publish, edge, flow) for Canvas features.
2. Rename the Canvas "Line/Arrow" tool to a shape name so it cannot be read as an Automation edge.
3. Do not add "Run", "Test", or "Publish" controls to Canvas.
4. Do not add automation columns (`workflow_id`, `execution_id`, `trigger_config`) to Canvas tables (`PHASE3_03_CANVAS_API_CONTRACT.md:480`).
5. Keep separate icons; `canvas` and `automation` are already distinct (`Icon.tsx:35,41`).
6. Any future Canvas↔Automation link requires its own specification, schema, authorization, audit, and owner approval (`PHASE3_03:483`).

---

## 6. Accessibility requirements

Accessibility rules are **REPORTED** from `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md` §7–§8 and applied here to the Automation regions. **PROPOSED** conformance target: WCAG 2.2 AA (DECISION-REQUIRED D12).

### 6.1 Contrast and status

| ID | Requirement |
|---|---|
| A1 | Text ≥ 4.5:1 on its actual background (canvas and glass panel); large text ≥ 3:1 (`PHASE2_04` C-01/C-02). |
| A2 | UI components and focus indicators ≥ 3:1 against adjacent colors (C-03). |
| A3 | Never rely on color alone; pair status colors with text labels/icons (C-04). |
| A4 | Apply the same measured contrast rules to node state badges, branch labels, and execution outcomes. |

### 6.2 Keyboard

| ID | Requirement |
|---|---|
| K1 | All interactive elements reachable via Tab in visual order. |
| K2 | Enter/Space activate; Escape closes menus/dialogs/popovers and returns focus to the invoker. |
| K3 | Arrow keys navigate composite widgets (library list, inspector tabs, execution list) with roving tabindex or focus movement. |
| K4 | Modals (publish confirmation, approval decision) trap Tab, close on Escape, restore focus. |
| K5 | Canvas: arrow-key node navigation, Delete removes selection, Escape deselects/cancels, Ctrl/Cmd+Z undo. |
| K6 | Non-modal execution drawer does not steal focus permanently; Escape collapses it. |
| K7 | Focus indicator always visible (2px accent outline, offset 2px); never `outline: none` without replacement (`PHASE2_04:432`). |
| K8 | "Skip to main content" link as first focusable element (`PHASE2_04` K-05). |

### 6.3 Screen reader

| ID | Requirement |
|---|---|
| SR1 | One `<main>` per route; sidebar `<nav aria-label>`; studio regions labeled with `aria-labelledby`. |
| SR2 | Every icon-only control has an accessible name; decorative SVGs are `aria-hidden` (current flow SVG is correctly `aria-hidden`, `AutomationStudio.tsx:83`). |
| SR3 | Inspector uses `role="tablist"` with `aria-selected`/`aria-controls`; library uses a listbox/tree pattern. |
| SR4 | Selection changes, validation errors, and execution status are announced via `role="status"`/`aria-live="polite"`; errors use `role="alert"`. |
| SR5 | Workflow, node, execution, and approval states have text labels, not color-only dots. |
| SR6 | Page `<title>` updates per route (`PHASE2_04` SR-10). |
| SR7 | The preview notice and all warnings are readable by screen readers (`role="note"` or live region). |

### 6.4 Touch targets and motion

| ID | Requirement |
|---|---|
| T1 | Primary targets 44px, secondary 36px, minimum 24px with spacing (`PHASE2_04` §8.4). |
| M1 | Honor `prefers-reduced-motion` via tokens and a JS `matchMedia` gate; suppress non-essential movement only (`PHASE2_04:450-460`). |
| M2 | Animations are interruptible and never block input. |

### 6.5 Data redaction

| ID | Requirement |
|---|---|
| R1 | Never render secrets, credentials, auth headers, or unredacted provider payloads in the library, canvas, inspector, execution trace, templates, approvals, logs, exports, or screenshots (`UI_UX_REDESIGN_PLAN.md:213`; `PHASE2_02:71`). |
| R2 | Input/output previews are redacted by default (`UI_UX_REDESIGN_PLAN.md:193`). |
| R3 | Redaction is server-side; frontend masking is not sufficient (`PHASE2_02:71`). |

---

## 7. Responsive requirements

**Current breakpoints (VERIFIED):** `1120px` (`index.css:432`) and `850px` (`index.css:433`). At 1120px the automation grid becomes 158px / 1fr / 225px and the end node is hidden; at 850px it becomes a single column with a horizontal library.

**PROPOSED responsive contract (aligned to `PHASE2_04:462-474`, `PHASE2_05:537,572`):**

| Breakpoint | Behavior |
|---|---|
| ≤ 640px (`--pm-bp-sm`) | Single column; library horizontal scroll; drawer full-width; no horizontal page scroll at 375px |
| ≤ 768px (`--pm-bp-md`) | Inspector becomes full-width section below canvas; drawer full-width with drag handle, max-height 70vh |
| ≤ 850px (`--pm-bp-lg`) | Single column; top bar wraps; primary actions remain reachable |
| ≤ 1120px (`--pm-bp-xl`) | 3 columns preserved but narrower; end node hidden |
| ≥ 1280px (`--pm-bp-2xl`) | Full 177px / 1fr / 258px layout |

**Rules:**

1. Regions stack in this order on small screens: top bar → canvas → library → inspector → execution drawer.
2. The execution drawer is full-width ≤ 780px with a drag handle and backdrop (`PHASE2_05:572`).
3. Horizontally scrollable regions are keyboard-focusable with `tabIndex={0}` and an `aria-label` (`PHASE2_04` K-11).
4. The sidebar collapses behind the mobile toggle ≤ 780px with `aria-expanded`/`aria-controls` (`PHASE2_04` K-10).
5. No region overlaps another; the canvas remains reachable and does not trap scroll.

---

## 8. Scope boundaries

### 8.1 In scope for PM-P4-01

- This Automation Studio IA and builder-region specification.
- Behavioral contract for: navigation, library, canvas, inspector, execution/history, templates, approvals, states, routing, empty/loading/error, preview-only boundary.
- Accessibility and responsive requirements.
- Canvas-vs-Automation semantic separation.
- Acceptance criteria and unresolved decisions.

### 8.2 Out of scope (explicitly)

- Any implementation, source edit, schema change, migration, route, service, or runtime.
- Automation execution, node graph runtime, connector side effects, or replay engine.
- Backend workflow/execution/approval APIs and data model (`PHASE2_03:610`, DECISION-REQUIRED).
- RBAC implementation itself (only the automation permission rows are referenced).
- Canvas changes, including renaming its "Line/Arrow" tool (flagged as a Canvas decision).
- Design Mode / `DesignCanvas` / `DraggableElement` (`UI_UX_PROGRESS.md:9`).
- Removing or refactoring orphaned files (`TaskCard.tsx`, `DesignCanvas.tsx`).
- Test implementation.
- Connector credential provider selection and secret storage.

### 8.3 Assumptions

1. The owner confirms the preview-only runtime boundary remains in force (§4.13).
2. `PHASE2_02`, `PHASE2_03`, `PHASE2_04`, and `PHASE2_05` are the foundation contracts this IA builds on.
3. The Automation Studio remains a separate product area from Project Canvas.
4. The card text/acceptance definition for PM-P4-01 is supplied by the owner (§10 D1); it is not present in the repository.

---

## 9. Acceptance criteria

### 9.1 Current-state conformance (VERIFIED baseline)

| ID | Criterion | Evidence |
|---|---|---|
| AC-01 | Automation Studio is reachable at `/automation` from the sidebar and command palette. | `main.tsx:39`; `AppShell.tsx:31,385-392` |
| AC-02 | The page shows "Preview only · no runtime connected". | `AutomationStudio.tsx:29` |
| AC-03 | "Publish workflow" is disabled. | `:30` |
| AC-04 | The page makes no network calls (0 `fetch`, 0 `useQuery`). | full-file scan |
| AC-05 | The execution drawer shows disabled replay and a no-live-history notice. | `:216,231` |
| AC-06 | No automation/workflow/execution/approval table exists in schema or live DB. | `schema.sql`; live DB query |
| AC-07 | No automation route/service exists in the backend. | `index.ts`; `server.ts`; services listing |
| AC-08 | The inspector exposes Settings, Input, Output tabs. | `:128-193` |
| AC-09 | The execution drawer is non-modal. | `:197-235`; `index.css:430` |
| AC-10 | Automation Studio is a separate nav item with a Preview tag, distinct from Project Canvas. | `AppShell.tsx:30-31,88-90` |

### 9.2 Target-state criteria (PROPOSED)

| ID | Criterion |
|---|---|
| AC-11 | Studio-internal navigation exposes Workflows, Executions, Approval gates, Templates, and Settings, each URL-addressable. |
| AC-12 | The library is a filtered, approved node catalog with search; selecting a node and clicking the canvas adds it. |
| AC-13 | The canvas is a directional node graph with ports, branch labels, pan/zoom/fit, and a conditional minimap; invalid edges are rejected visibly. |
| AC-14 | The inspector exposes Settings, Input, Output, Validation, and Permissions; all fields have programmatic labels; previews are redacted. |
| AC-15 | The execution drawer shows run history, step timeline, error location, selected-node trace, and safe replay constraints. |
| AC-16 | Templates produce versioned drafts and never contain secrets. |
| AC-17 | Approvals expose queued/granted/rejected/expired decisions with actor, impact, expiry, and audit link; agents cannot self-approve. |
| AC-18 | Workflow, node, execution, approval, and edge states are defined, visible, and never color-only. |
| AC-19 | The preview-only boundary is preserved: notice, disabled Publish, disabled replay, no runtime calls. |
| AC-20 | Canvas and Automation keep separate names, data models, icons, and vocabulary; no Canvas regression. |
| AC-21 | Accessibility: contrast, keyboard, screen-reader, touch-target, reduced-motion, and redaction requirements are met (WCAG 2.2 AA target). |
| AC-22 | Responsive: no horizontal page scroll at 375px; regions stack correctly; drawer is full-width ≤ 780px. |
| AC-23 | No secrets or unredacted payloads appear in any studio region or artifact. |
| AC-24 | Empty, loading, and error states exist for every region and never present failure as empty. |
| AC-25 | All DECISION-REQUIRED items in §10 are recorded before implementation. |

---

## 10. Unresolved decisions

| ID | Decision | Options / recommendation | Evidence / impact |
|---|---|---|---|
| **D1** | Card provenance and acceptance definition for PM-P4-01 | Confirm the board/tool and paste the card text. `PM-P4-01` has **0 hits** in the repository (full-tree scan, this task); this spec is written to the task title. | `PHASE3_01_CANVAS_IA_JOURNEYS.md` D1 (same pattern) |
| **D2** | Automation runtime boundary | (a) Preview-only (recommended, current), (b) test-only with pinned data, (c) live execution. Do not build until decided. | `PHASE1_DISCOVERY_DECISION_PACK.md:148-153` (C1); `PHASE2_03` D9/D10; `UI_UX_REDESIGN_PLAN.md:240-241` |
| **D3** | Studio route scheme and URL state | Adopt §4.1 routes; decide whether pan/zoom and selection are URL-synced. | `main.tsx:39`; `UI_UX_REDESIGN_PLAN.md:180-185` |
| **D4** | Persistence and versioning model | (a) Autosave drafts with visible status, (b) explicit save + `workflow_versions`, (c) versioned snapshots. Must not lose work on reload. | `UI_UX_REDESIGN_PLAN.md:190,214`; `PHASE2_03:610` |
| **D5** | Template governance | Who approves templates, where they are stored, and whether users may create them. | `UI_UX_REDESIGN_PLAN.md:184,191` |
| **D6** | Approval model | Human-gate semantics, expiry SLA (24h proposed), who may decide, and the relationship to `ReviewQueue`. | `UI_UX_REDESIGN_PLAN.md:204,212`; `PHASE2_03:250,362`; `PHASE2_02:54-55`; `ReviewQueue.tsx:11` |
| **D7** | Execution history retention and redaction | Retention period, redaction class, and trace immutability. | `PHASE2_03:212,391,467` |
| **D8** | Replay constraints | Non-side-effecting only by default; side-effecting replay requires reviewed mode and a new execution ID. | `UI_UX_REDESIGN_PLAN.md:211`; `PHASE2_03:391` |
| **D9** | Connector node catalog | Which connector actions become Automation nodes; required scopes and credential references. | `connector.service.ts` `AVAILABLE_CONNECTORS`; `PHASE2_02:67-72` |
| **D10** | RBAC for workflow draft/publish/execute | Adopt `PHASE2_02:52-55`; publish/execute remain disabled for every role now. | `PHASE2_02:52-55` |
| **D11** | Audit coverage for automation | Add automation rows to the audit coverage matrix and define actor/trace fields. | `PHASE2_03:467` |
| **D12** | Accessibility conformance level | Adopt WCAG 2.2 AA for Automation Studio. | `PHASE2_04` §8; `PHASE3_01` D14 |
| **D13** | Any Canvas↔Automation link | Keep none; any future link requires its own card. | `PHASE3_03:483`; `PHASE1_DISCOVERY_DECISION_PACK.md:122` |
| **D14** | Settings: credential references and environments | Credential provider, environments, and limits. | `UI_UX_REDESIGN_PLAN.md:185`; `PHASE2_02:74` |
| **D15** | Test coverage | Add Automation Studio tests before implementation. | `PHASE3_04` B-9 pattern; `PHASE2_05` gap matrix |

---

## 11. Evidence index

| Claim area | Primary evidence |
|---|---|
| Automation route/page | `frontend/src/main.tsx:39`; `frontend/src/pages/AutomationStudio.tsx:1-240` |
| Navigation | `frontend/src/components/layout/AppShell.tsx:18-40,67-69,88-90,385-392` |
| Icons | `frontend/src/components/layout/Icon.tsx:2,35,41` |
| Automation CSS | `frontend/src/index.css:425-433` |
| Schema / data model | `backend/src/database/schema.sql:79-92,108-119,161-201,205-229`; live DB read-only query |
| Backend registration | `backend/src/index.ts`; `backend/src/server.ts` |
| Connectors | `backend/src/services/connector.service.ts` (`AVAILABLE_CONNECTORS`) |
| Review queue | `frontend/src/pages/ReviewQueue.tsx:9-11` |
| Canvas types | `frontend/src/types/canvas.ts:8,35,47` |
| Canvas client state | `frontend/src/hooks/useCanvas.ts:53-65` |
| Canvas shell | `frontend/src/pages/Canvas.tsx:208-329` |
| Target studio IA | `UI_UX_REDESIGN_PLAN.md:173-214` |
| RBAC / permissions | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:42-59,63,67-74` |
| Data / events / audit | `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:250,362,391,467,610` |
| Accessibility / tokens | `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:421-474,478-559` |
| Shared components | `PHASE2_05_SHARED_COMPONENT_CATALOG.md:193,512-544,545-579,845-876` |
| Sibling IA spec | `PHASE3_01_CANVAS_IA_JOURNEYS.md` (structure, §5 semantic separation) |
| Canvas API boundaries | `PHASE3_03_CANVAS_API_CONTRACT.md:470-483` |
| Canvas interactions | `PHASE3_02_CANVAS_INTERACTIONS.md:134-139,176-211` |
| Approval gate conventions | `PHASE3_04_CANVAS_SPEC_APPROVAL.md:184-221` |
| Preview-only boundary | `PHASE1_DISCOVERY_DECISION_PACK.md:19,61,111,122,148-153,181`; `handoff_future_uiux.md:48-63`; `UI_UX_PROGRESS.md:10,22` |

---

*Prepared as a Phase 4 read-only planning artifact. This document authorizes no implementation, no schema change, no migration, no route, no runtime, and no Automation execution. All target-state content is PROPOSED and requires owner approval.*
