# PHASE3_01 — Project Canvas: Information Architecture & User-Journey Specification

| Field | Value |
|---|---|
| Card | PM-P3-01 |
| Deliverable | Project Canvas information architecture (IA) and user-journey specification |
| Date | 2026-11-10 |
| Workspace | `<workspace>` |
| Method | Read-only source inspection. No servers started, no builds, no DB/schema changes, no application source edits. |
| Authority | Working tree at `d705a36` with uncommitted changes (55 modified tracked files, 28 untracked paths per `git status --short`). All VERIFIED claims describe the **working tree**, not HEAD. |
| Card provenance | `PM-P3-01` is not present in `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, `CHECKLIST.md`, or any tracked document (0 hits). **UNKNOWN** where the card is hosted; this document is written to the card title supplied in the task. |

## Evidence legend

- **VERIFIED** — read directly from the cited file and line.
- **REPORTED** — asserted in a project document; the underlying source was not exercised.
- **PROPOSED** — recommendation of this specification; not yet built.
- **UNKNOWN** — could not be established from the workspace.
- **DECISION-REQUIRED** — owner must decide before implementation.

---

## 1. Executive summary

The Canvas domain is materially implemented and reachable: 4 frontend routes, 10 REST endpoints, 3 SQLite tables, a 307-line state hook, and 8 canvas components (VERIFIED, §2). It supports a single mouse-driven user building a small diagram. It is not yet a specified product surface:

- No Canvas IA, role model, or journey specification exists anywhere in the repo (VERIFIED, §2.10).
- No undo/redo, no explicit save control, no canvas rename UI, no connection-drawing interaction, no multi-select, no keyboard item operations, and no canvas export/import (VERIFIED, §2.9).
- All Canvas failures collapse into a full-page error; failed saves leave local state diverged from the server with no rollback and no retry (VERIFIED, §2.7, §4.12).
- Any authenticated user can open any canvas by ID; `created_by` is stored but never enforced (VERIFIED, §2.3).
- Canvas and Automation Studio are separated in navigation and in the design authority documents, but the shared "Line/Arrow" tool name and the absence of an in-product semantic rule blur the boundary at the point of use (VERIFIED + PROPOSED, §5).

This document specifies the current IA inventory, roles, journeys, target screen behaviours, accessibility/responsive requirements, scope boundaries, acceptance criteria, and unresolved decisions.

---

## 2. Current Canvas IA inventory (VERIFIED)

### 2.1 Route map

| Route | Component | Evidence |
|---|---|---|
| `/canvas` | `Canvas.tsx` — creates a canvas, then redirects to `/canvas/:id` | `frontend/src/main.tsx:45`; `frontend/src/pages/Canvas.tsx:50-77` |
| `/canvas/:id` | `Canvas.tsx` — diagram editor | `frontend/src/main.tsx:46` |
| `/canvases` | `CanvasList.tsx` — all canvases | `frontend/src/main.tsx:47` |
| `/canvases/:projectId` | `CanvasList.tsx` — project-scoped list | `frontend/src/main.tsx:48` |

All four routes sit inside `ProtectedWorkspace` (`frontend/src/main.tsx:24-28,34-49`), so an unauthenticated visitor is redirected to `/login`.

### 2.2 Navigation entry points

| Entry point | Target | Evidence |
|---|---|---|
| Sidebar → Tools → "Project Canvas" | `/canvases` | `frontend/src/components/layout/AppShell.tsx:29-34` |
| Sidebar active-state rule matches any `/canvas*` path | — | `AppShell.tsx:67-69` |
| Command palette action "Open Project Canvas" (hint `G C`) | `/canvases` | `AppShell.tsx:375-383` |
| Automation Studio is a separate nav item flagged `Preview` | `/automation` | `AppShell.tsx:31,88-90` |

The detail route `/canvas/:id` is reachable only by clicking a card, by the create redirect, or by a pasted URL. There is no in-app link from a project workspace to its canvases.

### 2.3 Backend API inventory

All routes are mounted under `/api/canvas` in both entry points (`backend/src/index.ts:16,47`; `backend/src/server.ts:18,51`) and guarded by `router.use(requireAuth)` (`backend/src/routes/canvas.routes.ts:8`). `requireAuth` verifies a Bearer JWT only; it performs no ownership or role check (`backend/src/middleware/auth.middleware.ts:8-22`). `requireRole` exists (`auth.middleware.ts:24-31`) but is not used by the canvas router.

| Method & path | Handler | Evidence |
|---|---|---|
| `POST /api/canvas` | Create canvas | `canvas.routes.ts:11-25` |
| `GET /api/canvas?project_id=` | List canvases | `canvas.routes.ts:28-36` |
| `GET /api/canvas/:id` | Get canvas + items + connections | `canvas.routes.ts:39-49` |
| `PUT /api/canvas/:id` | Update name/description | `canvas.routes.ts:52-63` |
| `DELETE /api/canvas/:id` | Delete canvas | `canvas.routes.ts:66-76` |
| `POST /api/canvas/:id/items` | Add item | `canvas.routes.ts:79-86` |
| `PUT /api/canvas/items/:itemId` | Update item | `canvas.routes.ts:89-99` |
| `DELETE /api/canvas/items/:itemId` | Delete item | `canvas.routes.ts:102-112` |
| `POST /api/canvas/:id/connections` | Add connection | `canvas.routes.ts:115-129` |
| `DELETE /api/canvas/connections/:connId` | Delete connection | `canvas.routes.ts:132-142` |

Service layer: `createCanvas` 50-64, `getCanvasById` 66-70, `getCanvasWithItems` 72-89 (items ordered `z_index ASC`), `listCanvases` 91-97 (ordered `updated_at DESC`), `updateCanvas` 99-125, `deleteCanvas` 127-137, `addItem` 141-179, `updateItem` 187-235, `deleteItem` 237-243, `addConnection` 247-262, `deleteConnection` 270-274 (`backend/src/services/canvas.service.ts`).

### 2.4 Data model inventory

| Table | Key columns | Evidence |
|---|---|---|
| `canvases` | `canvas_id` PK, `project_id` FK→projects, `name` NOT NULL, `description`, `created_by` FK→users, `created_at`, `updated_at` | `backend/src/database/schema.sql:161-169` |
| `canvas_items` | `item_id` PK, `canvas_id` FK→canvases, `item_type`, `task_id` FK→tasks, `x/y/width/height/rotation`, `content`, `style` (JSON string), `z_index`, timestamps | `schema.sql:172-187` |
| `canvas_connections` | `connection_id` PK, `canvas_id` FK→canvases, `from_item_id`/`to_item_id` FK→canvas_items, `connection_type` default `'line'`, `style`, `created_at` | `schema.sql:190-198` |

Constraints: no `ON DELETE CASCADE`; deletes are manual in the service. No unique constraint preventing duplicate connections. No check constraint on `item_type` or `connection_type`. `canvas_connections` has no `updated_at`. `canvases.project_id` is nullable, so unassigned canvases are representable.

### 2.5 Frontend component inventory

| File | Lines | Role | Status |
|---|---:|---|---|
| `frontend/src/pages/Canvas.tsx` | 333 | Detail shell: header, toolbar, viewport, inspector | VERIFIED in use (`main.tsx:16,45-46`) |
| `frontend/src/pages/CanvasList.tsx` | 236 | List: query, create, delete, grid | VERIFIED in use (`main.tsx:17,47-48`) |
| `frontend/src/hooks/useCanvas.ts` | 307 | All Canvas client state and API calls | VERIFIED in use (`Canvas.tsx:4,23-47`) |
| `frontend/src/types/canvas.ts` | 76 | Types and unions | VERIFIED |
| `frontend/src/components/canvas/CanvasViewport.tsx` | 404 | Viewport, pan/zoom, connection + item layers | VERIFIED (`Canvas.tsx:274`) |
| `frontend/src/components/canvas/CanvasItem.tsx` | 501 | Item render, drag, resize, selection chrome | VERIFIED (`CanvasViewport.tsx:339`) |
| `frontend/src/components/canvas/CanvasToolbar.tsx` | 85 | Tool switcher | VERIFIED (`Canvas.tsx:272`) |
| `frontend/src/components/canvas/PropertiesPanel.tsx` | 641 | Inspector and property editors | VERIFIED (`Canvas.tsx:319`) |
| `frontend/src/components/canvas/TaskPicker.tsx` | 278 | Task selection dropdown | VERIFIED (`Canvas.tsx:246`) |
| `frontend/src/components/canvas/ConnectionLine.tsx` | 55 | Connection renderer | VERIFIED (`CanvasViewport.tsx:324`) |
| `frontend/src/components/canvas/ShapeSelector.tsx` | 89 | Shape dropdown | VERIFIED (`PropertiesPanel.tsx:3,209`) |
| `frontend/src/components/canvas/TaskCard.tsx` | 251 | Rich task card (status/priority badges) | **ORPHANED — 0 imports** |
| `frontend/src/components/design/DesignCanvas.tsx` | 261 | Design-mode free-placement canvas | **ORPHANED — 0 imports**; excluded from the main workspace per `UI_UX_PROGRESS.md:9` |

Dead code in the hook/types: `updateItem` is defined and returned but never consumed by any component (`useCanvas.ts:169-175,293`); `deleteConnection` is defined and returned but never called from the UI (`useCanvas.ts:243-255,297`); `DragState` and `PanState` are defined but unreferenced (`types/canvas.ts:61-68,70-76`).

### 2.6 Client state inventory (`useCanvas.ts:53-65`)

`canvas`, `items`, `connections`, `selectedItemId`, `selectedConnectionId`, `tool`, `pan`, `zoom`, `loading`, `error`, `tasks`, `enteringItemIds`, `deletingItemIds`. Selection is mutually exclusive: selecting an item clears the connection selection and vice-versa (`useCanvas.ts:257-265`). There is no multi-select, no clipboard, no history stack, and no dirty/saved flag.

### 2.7 Interaction inventory

| Interaction | Behaviour | Evidence |
|---|---|---|
| Tool modes | `select`, `square`, `line`, `arrow`, `text`, `task` | `CanvasToolbar.tsx:8-14`; `types/canvas.ts:59` |
| Click-to-place | square 120×120, text 160×40, task 160×80, line/arrow 120×20; tool resets to `select` | `Canvas.tsx:79-120` |
| Drag item | local update during move; one PUT on mouse-up | `CanvasItem.tsx:79-135` |
| Resize item | bottom-right handle, min 20px; PUT on mouse-up | `CanvasItem.tsx:137-191,435-471` |
| Pan | middle mouse or Space+drag; momentum on release | `CanvasViewport.tsx:116-141,143-213` |
| Zoom | mouse wheel only, clamped 0.2–4; indicator bottom-right | `CanvasViewport.tsx:215-223,381-399` |
| Select | click item; click background clears both selections | `CanvasViewport.tsx:225-243` |
| Connect | Properties button "Connect to first other item"; always `arrow` | `PropertiesPanel.tsx:603-620`; `Canvas.tsx:325-327` |
| Delete item | floating Delete button on selected item + inspector Delete | `CanvasItem.tsx:473-496`; `PropertiesPanel.tsx:622-636` |
| Delete connection | API + hook exist, **no UI control** | `canvas.routes.ts:132-142`; `useCanvas.ts:243-255` |
| Keyboard | Space for pan only. No Delete, Escape, Ctrl+Z/Y, arrow, or Tab support | `CanvasViewport.tsx:74-105` |
| Persistence | immediate PUT on drag end, resize end, textarea blur, and most inspector changes | `CanvasItem.tsx:116,180`; `PropertiesPanel.tsx:149,227,267,562-598` |

### 2.8 Orphaned and conflicting assets

- `TaskCard.tsx` (251 lines) is fully implemented — it fetches `/api/tasks/:id`, renders status/priority badges, and handles Enter/Space — but is imported nowhere. The canvas instead renders a plain "Task" + title block inline (`CanvasItem.tsx:326-364`), so live status and priority are never shown on the canvas.
- `DesignCanvas.tsx` (261 lines) is imported nowhere; design mode (`DesignModeContext`, `DesignToolbar`, `DraggableElement`, `ContextMenu`) has undo/redo (`DesignModeContext.tsx:153,160`; `DesignToolbar.tsx:42-59`) but is deliberately excluded from the main workspace (`UI_UX_PROGRESS.md:9`). **No undo/redo exists for Canvas.**
- The toolbar tool labelled "Line/Arrow" creates **items** of type `line`/`arrow` (`Canvas.tsx:110-118`), not `canvas_connections`. There is no drag-from-port-to-port connection authoring anywhere.

### 2.9 Capability gaps (VERIFIED)

1. No undo/redo (only design mode has it).
2. No explicit Save control; persistence is implicit per-mutation, and there is no dirty indicator or retry.
3. No canvas rename/description editing in the UI, although `PUT /api/canvas/:id` and `updateCanvas` exist (`canvas.routes.ts:52-63`; `canvas.service.ts:99-125`).
4. No connection authoring interaction and no connection deletion UI; `connection_type: "line"` is unreachable from the UI (the only caller passes `"arrow"`).
5. No multi-select, clipboard, duplicate, bring-to-front/send-to-back, align, or distribute.
6. No keyboard item operations; no Delete key; no Escape to cancel a tool or close the task picker.
7. No zoom buttons, fit-to-content, or minimap (a "Fit" control exists only in the Automation preview, `AutomationStudio.tsx:79`).
8. No grid snap or visible grid toggle (background grid is decorative, `CanvasViewport.tsx:257-261`).
9. No canvas export/import; `importExport.service.ts` and `importExport.routes.ts` contain zero references to canvas.
10. No concurrency/conflict handling for two users editing the same canvas.
11. No offline or queued-mutation handling.
12. No validation of `item_type`/`connection_type`/geometry; the service accepts arbitrary strings and numbers (`canvas.service.ts:141-179,247-262`).
13. No Canvas tests: `tests/` contains 0 mentions of canvas (VERIFIED).
14. `fetchTasks` swallows failures and sets `tasks` to `[]` (`useCanvas.ts:67-80`), so a task-picker outage is indistinguishable from "no tasks".

### 2.10 Documentation evidence

| Claim | Source | Status |
|---|---|---|
| Phase 3 Custom Canvas complete at commit `96de21b`; EX-001..EX-004 done; 10 REST endpoints, 3 tables, 13 frontend units | `ROADMAP.md:79-88` | REPORTED (historical; `ROADMAP.md` is itself flagged stale by `PHASE1_DISCOVERY_DECISION_PACK.md:79`) |
| Canvas is a planning/diagram surface, not an automation runtime | `UI_UX_REDESIGN_PLAN.md:82,100,175,222,240`; `handoff_future_uiux.md:46` | REPORTED (current design authority per `PHASE1_DISCOVERY_DECISION_PACK.md:85`) |
| Canvas vs Automation boundary rule | `handoff_future_uiux.md:63`; `PHASE1_DISCOVERY_DECISION_PACK.md:122` | REPORTED |
| Automation Studio is preview-only; no runtime, no `fetch`, Publish disabled | `AutomationStudio.tsx:29,30,82,190,201,216,231`; `PHASE1_DISCOVERY_DECISION_PACK.md:19,184` | VERIFIED |
| Canvas save/load and export/import are required by the design system | `design-system.md:289-302` | REPORTED (not implemented) |
| Phase 1 decision pack recommends preserving Canvas and extending only after behaviour is specified | `PHASE1_DISCOVERY_DECISION_PACK.md:142-146` (Decision B1) | REPORTED |

---

## 3. User roles and journeys

### 3.1 Roles

| Role | Canvas capability | Basis |
|---|---|---|
| **Owner / Admin** | Create, rename, delete any canvas; place/edit/delete items and connections; manage project scoping | `requireAuth` only (`auth.middleware.ts:8-22`); no role gate exists. Role strings come from `users.role` (`types/index.ts:8`) |
| **Editor / Member** | Same as Owner under current code (no RBAC) | No canvas-scoped permission check |
| **Viewer / read-only** | No read-only mode exists; every authenticated user can mutate | VERIFIED |
| **AI Agent** | No canvas credentials, routes, or audit events | `agentAuthMiddleware` exists but is not wired to canvas; no canvas mentions in agent routes (0 hits) |

**DECISION-REQUIRED D2:** confirm the Canvas authorization model (any authenticated user vs project members vs owner-only) and whether a read-only role is needed. Current behaviour is VERIFIED as "any authenticated user, full mutate".

### 3.2 Primary journey P1 — Create a canvas and diagram a project

**Entry:** Sidebar → Project Canvas (`AppShell.tsx:30`) or Ctrl/Cmd+K → "Open Project Canvas" (`AppShell.tsx:375-383`).

1. Land on `/canvases` (or `/canvases/:projectId`). List loads via `GET /api/canvas?project_id=` (`CanvasList.tsx:18-31`).
2. Click **New canvas** → inline name form appears (`CanvasList.tsx:83-126`).
3. Enter a name, click **Create** → `POST /api/canvas` (`CanvasList.tsx:33-49`) → navigate to `/canvas/:id` (`CanvasList.tsx:54`).
4. Editor loads canvas + items + connections (`useCanvas.ts:82-104`) and, if the canvas has a `project_id`, loads that project's tasks (`useCanvas.ts:67-80`).
5. Pick the **Task** tool → TaskPicker appears in the header (`Canvas.tsx:244-253`) → search and choose a task (`TaskPicker.tsx:39-46,169-241`).
6. Click the viewport → a 160×80 task item is created (`Canvas.tsx:98-109`) → POST item (`useCanvas.ts:110-142`) → enter animation (`index.css:293`).
7. Drag the item to position it → PUT on drop (`CanvasItem.tsx:100-117`).
8. Select a second item → click **Connect to first other item** → arrow connection created (`PropertiesPanel.tsx:603-620`; `Canvas.tsx:325-327`).
9. Add shapes/text with the toolbar; edit fill, stroke, text, and geometry in the inspector.
10. Every mutation persists immediately. There is no Save button and no exit confirmation.

**Exit:** Back button → `navigate(-1)` (`Canvas.tsx:227-234`).

**Pain points (VERIFIED):** step 8 connects to an arbitrary first item, not a chosen target; step 5 silently shows an empty list if the task fetch fails; step 10 has no undo if step 7/8/9 is wrong.

### 3.3 Primary journey P2 — Open an existing canvas, navigate, edit

**Entry:** Canvas card click (`CanvasList.tsx:179`) → `/canvas/:id`.

1. Loading: full-page skeleton (`Canvas.tsx:147-165`).
2. Pan with middle mouse or Space+drag; zoom with the wheel (`CanvasViewport.tsx:116-141,215-223`).
3. Click an item to select it (selection pulse, `index.css:296`); inspector shows its properties (`Canvas.tsx:122,319-328`).
4. Edit content, shape, style, or X/Y/W/H; changes PUT on blur/change (`PropertiesPanel.tsx:143-150,214-231,547-601`).
5. Resize via the bottom-right handle; drag to move.
6. Delete via the floating button or inspector.

**Failure branch:** any failed load replaces the page with an error card and only a **Go back** button (`Canvas.tsx:167-194`). Any failed mutation also sets the same `error` state (`useCanvas.ts:137,162,203,236,253`), so a single failed PUT blanks the whole editor with a "Canvas could not be loaded." message. **This is the most severe current IA defect.**

### 3.4 Secondary journeys

| ID | Journey | Steps | Evidence |
|---|---|---|---|
| S1 | Shape/text diagramming | Toolbar → click canvas → edit in inspector | `Canvas.tsx:79-120`; `PropertiesPanel.tsx:287-545` |
| S2 | Task linking | Task tool → TaskPicker → place → optional inspector relink via picker is **not** available after placement | `Canvas.tsx:98-109`; `TaskPicker.tsx` is only rendered when `tool === "task"` (`Canvas.tsx:244-253`) |
| S3 | Canvas management | List → create / open / delete (native `confirm()`) | `CanvasList.tsx:33-69,199-209` |
| S4 | Connection editing | Create via inspector; delete is unreachable | `PropertiesPanel.tsx:603-620`; `useCanvas.ts:243-255` |
| S5 | Recovery | List error → Retry; detail error → Go back only | `CanvasList.tsx:135-153`; `Canvas.tsx:167-194` |

### 3.5 Cross-cutting journey rules (PROPOSED)

1. **J1 — One source of truth:** the canvas detail is always routed by `canvas_id`; `project_id` is a filter/scoping attribute, never a second identifier.
2. **J2 — Explicit persistence:** every mutation shows a pending state and either a confirmed or failed outcome; failure never silently diverges local from server state.
3. **J3 — Recoverable destructive actions:** delete canvas/item/connection requires confirmation and offers undo for at least the current session.
4. **J4 — Keyboard parity:** every pointer action has a keyboard equivalent.
5. **J5 — Touch parity:** pan, zoom, select, and place work with touch/pointer input, not only mouse and wheel.
6. **J6 — Semantic separation:** Canvas connections are labelled as visual relationships; nothing in the Canvas UI may use execution vocabulary (run, trigger, workflow, publish, edge) — see §5.

---

## 4. Target IA and screen specification (PROPOSED)

Unless marked otherwise, everything in this section is **PROPOSED** and describes the target surface implied by `UI_UX_REDESIGN_PLAN.md` §5-§7, `handoff_future_uiux.md` §3.1, and the current implementation.

### 4.1 Navigation

- Keep "Project Canvas" in the Tools group (`AppShell.tsx:29-34`) and the command palette action (`AppShell.tsx:375-383`).
- Add a project-context entry: from a project workspace, a "Canvas" tab or action that routes to `/canvases/:projectId`.
- Detail route stays `/canvas/:id`; `/canvas` (no id) remains the create-and-redirect entry.
- Automation Studio stays a separate item with the `Preview` tag; never rename or merge it with Canvas (`AppShell.tsx:31,88-90`).

### 4.2 Canvas list

- **Elements:** heading + description (exists, `CanvasList.tsx:73-81`), New canvas action, create form, filter/sort, card grid, delete.
- **States:** loading skeleton (exists, `128-134`), error + Retry (exists, `135-153`), empty (exists, `154-158`), populated (exists, `160-231`).
- **Changes (PROPOSED):**
  - Scope indicator showing "All projects" vs the selected project; keep `/canvases` and `/canvases/:projectId` (`main.tsx:47-48`).
  - Card shows item/connection counts and project name, not only `updated_at` (`CanvasList.tsx:211-228`).
  - Replace native `confirm()` with an accessible dialog that names the canvas and states the consequence (`CanvasList.tsx:202-206`).
  - Support rename/description from the card or detail (backend already supports it, `canvas.routes.ts:52-63`).
  - Expose canvas export/import (design-system.md:296,302).
- **Accessibility:** the list is a landmark `<section>`; the create form needs an accessible name, Escape to cancel, and a visible focus order. The card is an `<article>` with a nested Delete button; it needs a real link/button name rather than a click handler on the whole card.
- **Responsive:** grid already auto-fills at `minmax(280px, 1fr)` (`CanvasList.tsx:160-168`); below 780px the sidebar collapses to a toggle (`index.css:309-325,485-490`) and the list must reflow to a single column.

### 4.3 Canvas detail shell

- **Elements (existing):** Back button, canvas name, conditional TaskPicker, user name, toolbar, viewport, inspector (`Canvas.tsx:208-330`).
- **Changes (PROPOSED):**
  - Add a page-level heading (`h1`) for the canvas name; currently the name is a `<span>` (`Canvas.tsx:235-243`) and the only heading is the inspector `h2` "Properties" (`309-318`).
  - Add explicit canvas actions: Rename, Save state indicator, Undo/Redo, Zoom controls, Fit, and Canvas menu (export, delete).
  - Show save/pending status derived from mutation state, not a static label.
- **Accessibility:** the shell must provide a skip link to the canvas viewport, an `aria-label` on the viewport region, and a focus-visible treatment on the header controls.
- **Responsive:** the fixed 288px inspector (`Canvas.tsx:295-307`) must become an overlay/drawer below 1120px, and the header must wrap or collapse the TaskPicker below 780px.

### 4.4 Viewport

- **Elements (existing):** grid background, pan/zoom transform, SVG connection layer (4000×4000, `CanvasViewport.tsx:285-296`), item layer, skeleton, zoom indicator.
- **Changes (PROPOSED):**
  - Add zoom in/out/reset/fit controls; wheel zoom remains.
  - Add touch/pointer pan and pinch zoom; today only `onMouseDown`/`onWheel` exist (`CanvasViewport.tsx:268-270`), so touch devices cannot pan or zoom.
  - Add an optional grid toggle and snap-to-grid (currently decorative only, `257-261`).
  - Keep connections rendered underneath items and skip connections whose endpoints are missing (`313-317`).
- **Accessibility:** the viewport container is a plain `<div>` (`248-271`) with no role, label, or keyboard interface. It needs `role="application"` or a labelled region plus a keyboard-accessible alternative for panning/zooming and item manipulation.
- **Responsive:** the viewport must fill available space and not force document-level horizontal scroll; today the page is `height:100vh` with a fixed inspector (`Canvas.tsx:199-206,295-307`), so narrow widths squeeze the canvas rather than reflow.

### 4.5 Toolbar

- **Elements (existing):** 5 tools + active label (`CanvasToolbar.tsx:8-14,35-80`).
- **Changes (PROPOSED):**
  - Rename "Line/Arrow" to "Shape: Line"/"Shape: Arrow" so the tool is not confused with Automation edges (see §5).
  - Add Undo/Redo and Zoom controls, or move them to the detail header.
  - Expose the active tool as `aria-pressed` on each button; today only `title` exists (`38-66`).
  - Add tooltips with shortcut hints and a keyboard shortcut map.
- **Accessibility:** buttons must have accessible names (icon-only glyphs are `aria-hidden`, `54-65`), visible focus, and `aria-pressed` state.
- **Responsive:** the 40px vertical toolbar must remain reachable and not overlap the viewport on small screens.

### 4.6 Inspector

- **Elements (existing):** right-hand aside titled "Properties" (`Canvas.tsx:295-329`), hosting `PropertiesPanel`.
- **Changes (PROPOSED):**
  - Show canvas-level properties when nothing is selected (name, description, project, created/updated, item/connection counts) instead of only the "Select an item" message (`PropertiesPanel.tsx:130-141`).
  - Add a layers/z-order control (bring to front/send to back) — `z_index` exists in the schema but no UI sets it beyond defaults.
  - Add connection list with delete affordance (API exists, `canvas.routes.ts:132-142`).
  - Add multi-select summary when more than one item is selected.
- **Accessibility:** every field needs a programmatically associated label. Many labels are plain `<label>` elements without `htmlFor` (`PropertiesPanel.tsx:65-70,197,215,395,416,437,498,512,528,555,567,579,591`), and most inputs have no `aria-label`; only the colour inputs do (`311,328,363,380,474`).
- **Responsive:** drawer/overlay below 1120px; full-height sidebar above.

### 4.7 Properties

- **Existing sections:** Type, Shape, Content, Style presets (4), Fill & Stroke, Stroke width, Opacity, Border radius, Text formatting (colour, size, weight, align), X/Y/W/H, Connect, Delete (`PropertiesPanel.tsx:196-636`).
- **Changes (PROPOSED):**
  - Show properties for the selected connection (endpoints, type line/arrow, style) — currently a selected connection shows nothing editable.
  - Show task-linked properties for task items (linked task, status, priority) using the orphaned `TaskCard` data model or a read-only summary.
  - Make numeric fields commit on Enter as well as blur, and validate ranges.
- **Accessibility:** group related fields in `fieldset`/`legend` or labelled sections; ensure all controls are keyboard reachable and labelled.
- **Responsive:** properties reflow to a single column in the drawer.

### 4.8 Selection

- **Existing:** single-select only; item and connection selection are mutually exclusive (`useCanvas.ts:257-265`); background click clears both (`CanvasViewport.tsx:225-243`); selected item shows a pulse and resize handles (`CanvasItem.tsx:435-471`).
- **Changes (PROPOSED):**
  - Support multi-select with Shift-click and marquee, plus Select All.
  - Keep item/connection selection as separate modes rather than one mutually-exclusive slot.
  - Expose selection state to assistive technology (`aria-live="polite"` summary such as "3 items selected").
- **Accessibility:** selection must be perceivable without colour alone (the pulse glow is decorative; `index.css:296`) and operable by keyboard.
- **Responsive:** marquee and multi-select need touch equivalents.

### 4.9 Connection

- **Existing:** centre-to-centre lines (`ConnectionLine.tsx:11-13`), arrowhead for `connection_type === "arrow"` (`20,41`), click to select (`27-32`), created only via the inspector button and always as an arrow (`PropertiesPanel.tsx:603-620`).
- **Changes (PROPOSED):**
  - Author connections by dragging from an item edge/port to another item, with a pending-line preview.
  - Let the user choose line vs arrow and label the relationship (e.g. "relates to", "blocks", "depends on") — stored in `canvas_connections.style`.
  - Provide a delete affordance for a selected connection (API exists).
  - Prevent duplicate and self connections at the service layer; today neither is checked (`canvas.service.ts:247-262`).
  - Keep the semantics strictly visual (see §5). Do not label connections as dependencies or workflow edges unless the owner approves a mapping to `task_dependencies` (DECISION-REQUIRED D5).
- **Accessibility:** connections need a keyboard-selectable representation (a list in the inspector) because an SVG `<g>` is not keyboard operable.
- **Responsive:** connection hit areas must be large enough for touch (currently the stroke is 2px, `ConnectionLine.tsx:40`).

### 4.10 Task picker

- **Existing:** rendered only when the Task tool is active (`Canvas.tsx:244-253`); searches title/description (`TaskPicker.tsx:39-46`); listbox with options showing status · priority (`169-241`); "Unlink task" action (`243-271`); closes on outside mousedown (`25-37`).
- **Changes (PROPOSED):**
  - Make the picker reachable after placement so a placed task item can be relinked or unlinked from the inspector.
  - Add Escape to close and arrow-key navigation (the listbox currently has no keyboard model beyond Tab).
  - Distinguish "no tasks in project" from "task list failed to load"; today both render as an empty/`No tasks found` list because `fetchTasks` swallows errors (`useCanvas.ts:77-79`; `TaskPicker.tsx:179-189`).
  - Show assignee and due date, not only status/priority.
- **Accessibility:** keep the existing `listbox`/`option`/`aria-selected` model (`TaskPicker.tsx:171,198-199`); add `aria-activedescendant` or roving tabindex and a visible focus style.
- **Responsive:** the 240px header container (`Canvas.tsx:245`) must expand to full width on small screens.

### 4.11 Save/load

- **Existing:** no Save button; mutations PUT immediately (`CanvasItem.tsx:116,180`; `PropertiesPanel.tsx:149,267`). Canvas metadata update exists but is unused. No export/import.
- **Changes (PROPOSED):**
  - Adopt an explicit autosave model with a visible status (Saving… / Saved / Retry) and a manual Save for canvas metadata (name/description).
  - Add canvas export/import (JSON) so layouts survive project export and can be reused; `design-system.md:296,302` already requires save/load and export/import.
  - Keep the canvas as a single aggregate (`GET /api/canvas/:id` returns canvas + items + connections, `canvas.service.ts:72-89`) so load/save is one transaction.
- **Accessibility:** save status must be announced (`aria-live`) and never conveyed by colour alone.
- **Responsive:** the status indicator must remain visible in the collapsed header.

### 4.12 Undo/redo and error/recovery

**Undo/redo (PROPOSED):**
- Provide per-session undo/redo for item create/move/resize/delete, connection create/delete, and property edits.
- Keep history client-side (in the hook) and replay through the existing API; do not persist history.
- Keyboard: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z / Ctrl+Y.
- Do not import design mode's undo/redo (`DesignModeContext.tsx:153,160`); design mode is excluded from the main workspace (`UI_UX_PROGRESS.md:9`).

**Error/recovery (PROPOSED):**
- Separate load errors from mutation errors. A failed item PUT must not replace the editor with "Canvas could not be loaded." (`Canvas.tsx:167-194`).
- On mutation failure, roll back the optimistic local change (`useCanvas.ts:144-167` currently keeps it) and show an inline, dismissible error with Retry.
- Add Retry to the detail error state; today only Go back exists (`Canvas.tsx:184-190`).
- Surface task-picker load failures distinctly (`useCanvas.ts:77-79`).
- Add a confirmation + undo for canvas deletion (list uses a bare `confirm()`, `CanvasList.tsx:202-206`).
- Define behaviour for concurrent edits (last-write-wins is the current de-facto behaviour; no `updated_at` check on items beyond setting it, `canvas.service.ts:229-233`).

### 4.13 Empty and loading states

| State | Current | Required (PROPOSED) |
|---|---|---|
| List loading | 4 skeleton rows (`CanvasList.tsx:128-134`) | Keep; announce `aria-busy` |
| List empty | "No canvases yet" (`154-158`) | Keep; add primary CTA "New canvas" |
| List error | Error card + Retry (`135-153`) | Keep; add detail message |
| Detail creating | "Creating canvas..." (`Canvas.tsx:129-145`) | Keep; show progress |
| Detail loading | 3 skeleton bars (`147-165`) + viewport skeletons (`CanvasViewport.tsx:355-378`) | Keep; align both |
| Detail error | Full-page card + Go back (`167-194`) | Add Retry; split mutation errors out |
| Canvas with 0 items | No in-viewport guidance | Add an empty-state hint inside the viewport ("Place a task or shape to begin") |
| No selection | "Select an item to edit properties." (`PropertiesPanel.tsx:130-141`) | Show canvas-level properties instead |
| Task picker empty | "No tasks found" (`TaskPicker.tsx:179-189`) | Distinguish empty project from load failure |

---

## 5. Canvas vs Automation — explicit semantic separation

**Authoritative rule (REPORTED):** "Project Canvas visualizes work. Automation Studio executes approved workflow definitions. They must never share a misleading name, a data model, or an implied execution engine." (`UI_UX_REDESIGN_PLAN.md:175`). Reinforced at `handoff_future_uiux.md:46,51,63` and `PHASE1_DISCOVERY_DECISION_PACK.md:122`.

| Dimension | Project Canvas | Automation Studio |
|---|---|---|
| Purpose | Visual planning/diagramming of tasks, shapes, and relationships | Executable workflow authoring, testing, and inspection |
| Data | `canvases`, `canvas_items`, `canvas_connections` (`schema.sql:161-198`) | No tables exist; no runtime, no routes (`PHASE1_DISCOVERY_DECISION_PACK.md:61,112`) |
| Connection meaning | A **visual relationship** between two diagram items; no execution semantics | A **workflow control-flow edge** with ports, branches, and guards (`UI_UX_REDESIGN_PLAN.md:196-205`) |
| Backend | 10 REST endpoints (`canvas.routes.ts`) | None; preview-only mock, disabled Publish, no `fetch` (`AutomationStudio.tsx:29,30,190,201,216,231`) |
| Route | `/canvases`, `/canvas/:id` (`main.tsx:45-48`) | `/automation` (`main.tsx:39`) |
| Nav label | "Project Canvas" (`AppShell.tsx:30`) | "Automation Studio" + `Preview` tag (`AppShell.tsx:31,88-90`) |
| Vocabulary | item, shape, connection, canvas | workflow, node, trigger, execution, publish |
| Status | Implemented | Preview only; runtime requires a separate owner decision (`PHASE1_DISCOVERY_DECISION_PACK.md:148-153`, Decision C) |

**In-product enforcement (PROPOSED):**
1. Never use execution verbs (run, trigger, execute, publish, edge, flow) for Canvas features.
2. Rename the "Line/Arrow" toolbar tool to a shape name so it cannot be read as an Automation edge (`CanvasToolbar.tsx:11`).
3. Do not add a "Run", "Test", or "Publish" control to Canvas.
4. If a future dependency mapping is added, label it explicitly as a dependency link, not a workflow edge, and keep it out of Automation until the runtime is approved (DECISION-REQUIRED D5).
5. Keep separate icons; the icon set already distinguishes `canvas` and `automation` (`Icon.tsx:2,35,41`).

---

## 6. Accessibility requirements

Target: WCAG 2.2 Level AA for the Canvas surface. Baseline evidence: global focus-visible styling exists (`index.css:115`) and reduced motion is honoured globally (`index.css:327-329`).

1. **Perceivable**
   - All icon-only buttons need accessible names: toolbar tools (`CanvasToolbar.tsx:38-66`), the delete button (`CanvasItem.tsx:473-496`), and zoom/pan controls when added.
   - Selection and focus must not rely on colour or the pulse glow alone (`index.css:296`); add a visible outline/affordance.
   - Text and UI must meet 4.5:1 / 3:1 contrast under every one of the six themes (`UI_UX_REDESIGN_PLAN.md:235` requires contrast validation per theme).
2. **Operable**
   - Full keyboard parity: Tab to items, Enter/Space to select, Delete to remove, Ctrl+Z/Y for undo/redo, Escape to cancel a tool or close the task picker, arrows to move the selection.
   - The viewport and SVG connection layer need keyboard-accessible alternatives (`CanvasViewport.tsx:248-271`; `ConnectionLine.tsx:27-33` are pointer-only).
   - TaskPicker needs Escape and arrow-key navigation (`TaskPicker.tsx:25-37,169-241`).
   - Touch targets ≥ 44×44px; connection hit areas must be widened beyond the 2px stroke.
3. **Understandable**
   - Every form field needs a programmatic label; many inspector labels lack `htmlFor` (`PropertiesPanel.tsx:65-70,197,215,395,416,437,498,512,528,555,567,579,591`).
   - Errors must be text, not colour alone, and must identify the failed operation.
4. **Robust**
   - Use landmarks and headings: the detail page needs an `h1` for the canvas name (`Canvas.tsx:235-243`) and a labelled viewport region.
   - Announce async state changes with `aria-live` (`aria-busy` on loading regions; polite status for save/mutation outcomes). The Canvas surface currently has no `aria-live` region.
   - Keep the existing `listbox`/`option` semantics in TaskPicker.

---

## 7. Responsive requirements

Current breakpoints: 1120px and 780px shell rules (`index.css:300-325`), plus 850px/780px workspace rules (`index.css:432-434`). **None target the Canvas surface.**

1. **≥1120px:** three-column editor — toolbar / viewport / 288px inspector (`Canvas.tsx:265-330`).
2. **780–1120px:** inspector becomes an overlay drawer; toolbar remains; TaskPicker width increases.
3. **<780px:** single-column; canvas header wraps; TaskPicker full width; inspector is a bottom sheet/drawer; no document-level horizontal scroll. The current `height:100vh` + fixed 288px inspector (`Canvas.tsx:199-206,295-307`) does not satisfy this.
4. **Touch:** pan, pinch-zoom, select, drag, and place must work. Current handlers are mouse/wheel only (`CanvasViewport.tsx:268-270`; `CanvasItem.tsx:429`), so touch support is a requirement, not a nice-to-have.
5. **Zoom:** the viewport must respect the user's zoom level for hit-testing and text legibility; the grid background already scales (`CanvasViewport.tsx:257-261`).
6. **Motion:** all spring animations must be disabled under `prefers-reduced-motion` — already handled globally (`index.css:327-329`); keep it that way when adding new motion.

---

## 8. Scope boundaries

### 8.1 In scope for PM-P3-01
- This IA and journey specification.
- Behavioural contract for: navigation, list, detail shell, viewport, toolbar, inspector/properties, selection, connections, task picker, save/load, undo/redo, error/recovery, empty/loading states.
- Accessibility and responsive requirements.
- Canvas-vs-Automation semantic rule.
- Acceptance criteria and unresolved decisions.

### 8.2 Out of scope (explicitly)
- Any implementation, source edit, schema change, or migration. This task is read-only except for this artifact.
- Automation Studio runtime, workflow execution, node graphs, approvals, or audit (`UI_UX_REDESIGN_PLAN.md:173-214`).
- Converting Canvas into an execution engine (`PHASE1_DISCOVERY_DECISION_PACK.md:144-146`, B3 rejected by the recommended B1).
- Design Mode / `DesignCanvas` / `DraggableElement` — excluded from the main workspace (`UI_UX_PROGRESS.md:9`).
- New connector, credential, or secret handling.
- RBAC implementation itself (only the Canvas authorization decision is in scope).
- Removing or refactoring orphaned files (`TaskCard.tsx`, `DesignCanvas.tsx`) — flagged for a separate decision (D6).

### 8.3 Assumptions
- The owner approves the recommended Phase 1 decisions (A1, B1, C1) as the authority baseline (`PHASE1_DISCOVERY_DECISION_PACK.md:134-165`).
- Canvas remains a planning/diagramming surface.
- The existing API and schema are preserved; this specification is about behaviour and IA, not data-model change.

---

## 9. Acceptance criteria

Each criterion is testable and traceable. "Current" criteria describe behaviour that must be preserved; "Target" criteria describe the specification in §4.

### 9.1 Current-state conformance (VERIFIED baseline)
- **AC-01:** `/canvases`, `/canvases/:projectId`, `/canvas/:id`, and `/canvas` all resolve to the correct page. (Evidence: `main.tsx:45-48`.)
- **AC-02:** All 10 Canvas REST endpoints are registered under `/api/canvas` in both entry points. (Evidence: `index.ts:47`; `server.ts:51`.)
- **AC-03:** All Canvas routes require a Bearer token. (Evidence: `canvas.routes.ts:8`; `auth.middleware.ts:8-22`.)
- **AC-04:** Canvas CRUD, item CRUD, and connection create/delete persist to the three Canvas tables. (Evidence: `canvas.service.ts`; `schema.sql:161-198`.)
- **AC-05:** Items persist position/size on drag and resize. (Evidence: `CanvasItem.tsx:112-117,174-181`.)
- **AC-06:** The task tool places a task-linked item using the TaskPicker selection. (Evidence: `Canvas.tsx:98-109`; `TaskPicker.tsx:210-214`.)

### 9.2 Target-state criteria (PROPOSED)
- **AC-10 (Navigation):** Project Canvas is reachable from the sidebar and the command palette; Automation Studio remains a separate, clearly tagged item. (Basis: `AppShell.tsx:29-34,375-383`.)
- **AC-11 (List):** The list shows project scope, item/connection counts, and supports create, rename, delete-with-confirmation, and export. No native `confirm()` remains. (Basis: `CanvasList.tsx:199-209`.)
- **AC-12 (Detail shell):** The detail page has an `h1` canvas name, explicit canvas actions (rename, save state, undo/redo, zoom, fit, delete), and a labelled viewport region. (Basis: `Canvas.tsx:208-263`.)
- **AC-13 (Viewport):** Pan and zoom work by mouse, keyboard, and touch; zoom controls and fit are available; grid snap is optional and toggleable. (Basis: `CanvasViewport.tsx:116-223`.)
- **AC-14 (Toolbar):** Every tool is an accessible toggle button with `aria-pressed`, a tooltip, and a documented shortcut; no tool name implies execution. (Basis: `CanvasToolbar.tsx:8-14`.)
- **AC-15 (Inspector/Properties):** All fields have programmatic labels; canvas-level properties appear when nothing is selected; selected connections and task links are editable. (Basis: `PropertiesPanel.tsx:130-141,603-636`.)
- **AC-16 (Selection):** Multi-select works by Shift-click and marquee; selection state is announced to assistive technology. (Basis: `useCanvas.ts:257-265`.)
- **AC-17 (Connection):** Connections can be created by dragging between items, typed as line/arrow, labelled, and deleted; duplicates and self-connections are rejected. (Basis: `PropertiesPanel.tsx:603-620`; `ConnectionLine.tsx:11-50`.)
- **AC-18 (Task picker):** The picker is available before and after placement, supports search, keyboard navigation, Escape, and distinct empty/error states. (Basis: `TaskPicker.tsx:25-46,169-241`; `useCanvas.ts:77-79`.)
- **AC-19 (Save/load):** Autosave status is visible and announced; canvas metadata is editable; canvas export/import exists. (Basis: `canvas.routes.ts:52-63`; `design-system.md:296,302`.)
- **AC-20 (Undo/redo):** Undo/redo covers item and connection mutations and is available by keyboard. (Basis: absence verified in §2.9.)
- **AC-21 (Error/recovery):** Load errors offer Retry; mutation failures roll back optimistic state and offer inline Retry; no mutation failure replaces the editor with a load error. (Basis: `Canvas.tsx:167-194`; `useCanvas.ts:144-167`.)
- **AC-22 (Empty/loading):** Every state in §4.13 exists and is announced; an empty canvas shows guidance. (Basis: `Canvas.tsx:129-194`; `PropertiesPanel.tsx:130-141`.)
- **AC-23 (Accessibility):** WCAG 2.2 AA checklist in §6 passes for every theme, including keyboard-only operation and reduced motion. (Basis: `index.css:115,327-329`; `UI_UX_REDESIGN_PLAN.md:235`.)
- **AC-24 (Responsive):** The three breakpoints in §7 render correctly with no horizontal scroll, and touch pan/zoom/select/place work. (Basis: `index.css:300-325`; `CanvasViewport.tsx:268-270`.)
- **AC-25 (Semantic separation):** No Canvas UI string or control uses Automation vocabulary, and the toolbar "Line/Arrow" tool is renamed. (Basis: §5.)
- **AC-26 (Tests):** Canvas API and hook behaviour are covered by automated tests; currently `tests/` has 0 canvas mentions. (Basis: §2.9 item 13.)

---

## 10. Unresolved decisions

| ID | Decision | Options | Evidence / impact |
|---|---|---|---|
| **D1** | Where is PM-P3-01 hosted, and what is its acceptance definition? | Confirm the board/tool and paste the card text | `PM-P3-01` not found in the repo (0 hits); this spec is written to the task title |
| **D2** | Canvas authorization model | (a) Any authenticated user (current), (b) project members, (c) owner/admin only, (d) add read-only role | `canvas.routes.ts:8`; `auth.middleware.ts:8-31`; no ownership check |
| **D3** | Persistence model | (a) Autosave with status (recommended), (b) explicit Save button, (c) versioned snapshots | No Save UI; PUT per mutation (`CanvasItem.tsx:116,180`) |
| **D4** | Undo/redo scope and retention | Per-session client history vs persisted history; which operations are undoable | No Canvas history; design mode has undo/redo but is excluded (`DesignModeContext.tsx:153,160`) |
| **D5** | Should Canvas connections map to `task_dependencies`? | (a) Keep purely visual (recommended), (b) map selected relationship types to dependencies | `schema.sql:176,190-198`; `PHASE1_DISCOVERY_DECISION_PACK.md:122` |
| **D6** | Orphaned assets | (a) Remove `TaskCard.tsx` / `DesignCanvas.tsx`, (b) adopt `TaskCard` for task items, (c) keep as-is | 0 imports each (§2.5) |
| **D7** | Canvas metadata editing | Expose rename/description in the UI (endpoint exists) or leave as-is | `canvas.routes.ts:52-63` unused |
| **D8** | Canvas export/import | Required by `design-system.md:296,302`; currently absent from import/export | `importExport.service.ts` has 0 canvas mentions |
| **D9** | Connection authoring model | (a) Drag port-to-port (recommended), (b) picker-based, (c) keep inspector button | Inspector button connects to an arbitrary first item (`PropertiesPanel.tsx:609-614`) |
| **D10** | Zoom/fit/minimap and touch support | Add controls and pointer/touch handling or defer | Wheel-only zoom; mouse-only handlers (`CanvasViewport.tsx:215-223,268-270`) |
| **D11** | Unassigned canvases | Allow `project_id: null` and show in "All projects" (current de-facto) or require a project | `schema.sql:163`; `CanvasList.tsx:13` |
| **D12** | Validation and duplicate prevention | Add service/route validation for types and geometry; prevent duplicate connections | `canvas.service.ts:141-179,247-262`; no constraints in `schema.sql:190-198` |
| **D13** | Automation boundary ownership | Confirm Decision C (preview-only) remains in force | `PHASE1_DISCOVERY_DECISION_PACK.md:148-153`; `AutomationStudio.tsx:29,30` |
| **D14** | Accessibility conformance level | Adopt WCAG 2.2 AA as the Canvas target | §6; `UI_UX_REDESIGN_PLAN.md:235` |
| **D15** | Test coverage | Add Canvas API/hook/component tests before extending | `tests/` has 0 canvas mentions |

---

## 11. Evidence index

| Claim area | Primary evidence |
|---|---|
| Routes and pages | `frontend/src/main.tsx:16-17,45-48` |
| Navigation | `frontend/src/components/layout/AppShell.tsx:18-40,67-69,88-90,375-383` |
| Backend registration | `backend/src/index.ts:16,47`; `backend/src/server.ts:18,51` |
| Canvas API | `backend/src/routes/canvas.routes.ts:1-144` |
| Canvas service | `backend/src/services/canvas.service.ts:1-319` |
| Data model | `backend/src/database/schema.sql:161-198` |
| Auth | `backend/src/middleware/auth.middleware.ts:8-31` |
| Client state | `frontend/src/hooks/useCanvas.ts:52-307` |
| Types | `frontend/src/types/canvas.ts:1-76` |
| Detail page | `frontend/src/pages/Canvas.tsx:1-333` |
| List page | `frontend/src/pages/CanvasList.tsx:1-236` |
| Viewport | `frontend/src/components/canvas/CanvasViewport.tsx:1-404` |
| Item | `frontend/src/components/canvas/CanvasItem.tsx:1-501` |
| Toolbar | `frontend/src/components/canvas/CanvasToolbar.tsx:1-85` |
| Inspector | `frontend/src/components/canvas/PropertiesPanel.tsx:1-641` |
| Task picker | `frontend/src/components/canvas/TaskPicker.tsx:1-278` |
| Connection | `frontend/src/components/canvas/ConnectionLine.tsx:1-55` |
| Shape selector | `frontend/src/components/canvas/ShapeSelector.tsx:1-89` |
| Orphans | `frontend/src/components/canvas/TaskCard.tsx:1-251`; `frontend/src/components/design/DesignCanvas.tsx:1-261` (0 imports) |
| Styles/motion | `frontend/src/index.css:284-298,300-325,327-329,485-490` |
| Automation boundary | `UI_UX_REDESIGN_PLAN.md:82,100,173-175,222,240`; `handoff_future_uiux.md:45-51,63`; `frontend/src/pages/AutomationStudio.tsx:29,30,82,190,201,216,231` |
| Canvas scope decisions | `PHASE1_DISCOVERY_DECISION_PACK.md:107-112,122,142-146,148-153` |
| History | `ROADMAP.md:79-88`; `git log --oneline -8` (`96de21b`, `d705a36`) |
| Tests | `tests/` — 0 canvas mentions |

---

*End of PM-P3-01 specification. This artifact is the only file produced by this task; no application source was modified.*
