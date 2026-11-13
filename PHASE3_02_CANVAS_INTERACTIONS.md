# PHASE3_02 — Project Canvas Interactions & Scope Decision Pack

**Card:** PM-P3-02 — Project Canvas interaction & scope decisions
**Status:** Complete — read-only planning artifact. Register items remain **DECISION-REQUIRED**.
**Date:** 2026-11-10
**Repository:** `<workspace>`
**Git branch / HEAD:** `main` / `d705a364b2e845eb02f33d57475e0e3af15228c7` — **VERIFIED**
**Read-only boundary:** No application source file was edited. No server was started. No DB, schema, or data change. No commit. Only this artifact was written.
**Method:** Static inspection of the live working tree. No browser/runtime verification was performed in this phase.

> Evidence labels: **VERIFIED** = read directly from the current working tree; **REPORTED** = stated in a project document but not independently proved; **PROPOSED** = recommended, not approved; **UNKNOWN** = not currently verifiable; **DECISION-REQUIRED** = owner decision needed.

---

## 1. Executive summary

- Project Canvas is materially implemented and is a **planning/diagramming surface, not an execution engine**: 3 tables, 10 REST endpoints, a `useCanvas` hook, a page, a list page, and 8 canvas components. **VERIFIED**
- The shipped interaction model is **mouse-first and single-select**: item drag, SE-corner resize, middle-mouse / Space pan with momentum, wheel zoom, click-to-select, click-empty-to-deselect, and one "Connect to first other item" button. **VERIFIED**
- **Missing or unreachable in the UI (VERIFIED):** undo/redo, keyboard editing shortcuts, Delete/Escape handling, multi-select / marquee, touch and Pointer Events, zoom-to-cursor, fit-to-content, connection deletion, connection endpoint choice, task re-linking on existing items, z-index and rotation controls, canvas export/import, view persistence, and optimistic concurrency.
- **Dead code (VERIFIED):** `frontend/src/components/canvas/TaskCard.tsx` is imported by nothing; `frontend/src/components/design/DesignCanvas.tsx` is imported by nothing (the latter is consistent with the recorded owner decision to exclude Design Mode from the main workspace).
- **Scope boundary is explicit and must hold:** a Canvas connection is a *visual relationship*; Automation Studio is a preview-only mock with no runtime. No automation execution, workflow runtime, connector side effect, approval gate, or execution history belongs in Canvas. **VERIFIED + DECISION-REQUIRED**
- **Recommended outcome:** preserve the DOM + CSS-transform interaction model and the glass styling; improve state/validation/error recovery and keyboard/touch coverage; extend only the interaction and complexity capabilities listed in §7. Do not touch Automation Studio.

---

## 2. Scope & authority baseline

| Source | Authority for this pack |
|---|---|
| Live working tree (`frontend/src/**`, `backend/src/**`, `schema.sql`) | **AUTHORITATIVE** for shipped behavior |
| `UI_UX_REDESIGN_PLAN.md` | **CURRENT** design/scope authority (approved glass direction; Canvas vs Automation boundary) |
| `UI_UX_PROGRESS.md` | **CURRENT** for the glass migration record and locked owner decisions |
| `handoff_future_uiux.md` | **REPORTED / SUMMARY** — verified against source |
| `PHASE1_DISCOVERY_DECISION_PACK.md` | **CURRENT** Phase 1 evidence baseline and decision pack |
| `ROADMAP.md`, `PRD.md`, `KANBAN_BOARD.md`, `CHECKLIST.md` | **STALE / CONFLICTING** — historical only; not used for behavior or status |

Locked owner decisions that constrain this card (**VERIFIED** in `UI_UX_PROGRESS.md` §1):

1. Default theme Obsidian Signal; 2. full glassmorphism system; 3. theme/accent customization; 4. **Design Mode excluded from the main workspace**; 5. **strict Canvas vs Automation separation** — Project Canvas is visual diagramming, Automation Studio is a preview until a backend runtime is authorized.

---

## 3. Current interaction inventory

| # | Interaction | Entry point | Implementation | Evidence | Class |
|---|---|---|---|---|---|
| 1 | Canvas list / create / delete / open | `/canvases`, `/canvases/:projectId` | `pages/CanvasList.tsx:18-69, 128-232` | VERIFIED | Preserve |
| 2 | Auto-create canvas when opening `/canvas` with no id | `/canvas` | `pages/Canvas.tsx:50-77` | VERIFIED | Preserve |
| 3 | Tool selection (Select, Square, Line/Arrow, Text, Task) | Left rail | `components/canvas/CanvasToolbar.tsx:8-14, 35-68` | VERIFIED | Improve |
| 4 | Item creation (square / text / task / line) | Canvas background click | `pages/Canvas.tsx:79-120` | VERIFIED | Improve |
| 5 | Item drag | Item body mousedown | `components/canvas/CanvasItem.tsx:79-135` | VERIFIED | Improve |
| 6 | Item resize | SE handle only | `components/canvas/CanvasItem.tsx:137-191, 435-471` | VERIFIED | Improve |
| 7 | Item delete | Selected-item "Delete" button | `CanvasItem.tsx:473-496`; `hooks/useCanvas.ts:184-219` | VERIFIED | Improve |
| 8 | Pan (middle mouse, or Space + left drag) with momentum | Viewport mousedown | `components/canvas/CanvasViewport.tsx:74-105, 116-213` | VERIFIED | Preserve / Improve |
| 9 | Zoom (wheel, origin 0,0, clamp 0.2–4×) | Viewport wheel | `CanvasViewport.tsx:215-223, 277-283` | VERIFIED | Improve |
| 10 | Selection (single item / single connection) | Click item / click line / click empty | `CanvasItem.tsx:85`; `ConnectionLine.tsx:28-31`; `CanvasViewport.tsx:225-243`; `useCanvas.ts:257-265` | VERIFIED | Improve |
| 11 | Connection render + select | SVG layer | `ConnectionLine.tsx:26-52`; `CanvasViewport.tsx:313-335` | VERIFIED | Preserve |
| 12 | Connection create ("Connect to first other item") | Properties panel | `PropertiesPanel.tsx:603-620`; `useCanvas.ts:221-241` | VERIFIED | Improve |
| 13 | Connection delete | **No UI** — hook only | `useCanvas.ts:243-255` | VERIFIED | Extend |
| 14 | Property edit (type, shape, content, style, x/y/w/h) | Right panel | `PropertiesPanel.tsx:143-183, 196-601` | VERIFIED | Preserve / Improve |
| 15 | Shape change (square/rectangle/circle/diamond/triangle) | Properties panel select | `ShapeSelector.tsx`; `PropertiesPanel.tsx:152-167` | VERIFIED | Preserve |
| 16 | Task picker (creation-time only) | Header, when tool = task | `pages/Canvas.tsx:244-253`; `TaskPicker.tsx:107-276` | VERIFIED | Improve |
| 17 | Animations (enter/exit, drag lift, draw-line, skeleton) | Hook + CSS | `useCanvas.ts:123-134, 186-216`; `index.css:284-298` | VERIFIED | Preserve |
| 18 | Loading / empty / error states | Page + viewport | `Canvas.tsx:129-194`; `CanvasViewport.tsx:355-378` | VERIFIED | Improve |
| 19 | Zoom indicator | Viewport corner | `CanvasViewport.tsx:381-399` | VERIFIED | Preserve |
| 20 | Navigation entry + command palette entry | Sidebar / Ctrl+K | `AppShell.tsx:29-34, 67-69, 376-383` | VERIFIED | Preserve |

---

## 4. Behavior specification (domain by domain)

### 4.1 Drag — **VERIFIED**

- Trigger: `onMouseDown` on the item body, only when `tool === "select"` (`CanvasItem.tsx:79-93`). Any other tool ignores the item and lets the viewport handle the gesture.
- Selection happens on mousedown (`onSelect(item.item_id)`, line 85) and the event is stopped from reaching the viewport (line 84).
- Offset is computed in **world coordinates**: `(e.clientX - pan.x) / zoom - item.x` (lines 89-92). Drag position is recomputed on every `mousemove` using the current `pan`/`zoom` captured in the effect deps (lines 100-107, 127-135).
- Updates are **local-only during the drag** (`onUpdateLocal`, line 106). A single `onSave` fires on mouseup only if the pointer actually moved (`moved.current`, lines 109-118).
- Visual feedback: `scale(1.05)`, floating shadow, `cursor: grabbing`, `z-index: 9999 !important` via `.canvas-item-dragging` (`CanvasItem.tsx:193-220`; `index.css:297`).
- **Gaps:** no grid snapping; no bounds clamping (items can be dragged to negative coordinates or far off-canvas); no multi-item drag; no drag threshold before `moved` is set; no escape-cancel.

### 4.2 Resize — **VERIFIED**

- Only the **bottom-right handle is wired** (`CanvasItem.tsx:444`); the other three handles (top-left, top-right, bottom-left, lines 447-469) are rendered but have no `onMouseDown` — they are decorative.
- Resize records start width/height and pointer position (`CanvasItem.tsx:137-153`), applies `Math.max(20, ...)` minimums in world units (lines 163-168), and saves once on mouseup if moved (lines 171-182).
- **Gaps:** no aspect-ratio lock; no rotation handle; no minimum size in the data model (20 is UI-only); no max size; resize is not anchored to a corner (the box grows from the top-left, so "resize" moves the opposite edge only); text items can be resized but their font size does not follow.

### 4.3 Pan — **VERIFIED**

- Triggers: middle mouse button, **or** Space held + left button (`CanvasViewport.tsx:116-141`). Space is tracked by window-level `keydown`/`keyup` listeners that ignore events originating in `INPUT`, `TEXTAREA`, or `contenteditable` (lines 74-105).
- Pan is delta-based from the gesture start (`panStart`, lines 126-131) and writes `onPanChange` on every move (lines 146-169).
- **Momentum:** velocity is sampled per move (lines 149-157); on release, if speed > 1.2 the viewport runs a `requestAnimationFrame` decay loop (`*= 0.9`, stop < 0.05) (lines 171-204). The rAF handle is cancelled on unmount and on wheel (lines 66-72, 107-114, 217).
- Cursor reflects state: `grabbing` while panning, `grab` while Space held, else `default` (lines 262-266).
- **Gaps:** no pan bounds; no pan persistence; momentum is not disabled by `prefers-reduced-motion` (the CSS motion token is respected for transitions, but the JS momentum loop is unconditional) — **PROPOSED** fix.

### 4.4 Zoom — **VERIFIED**

- Wheel only: `onWheel` → `e.preventDefault()`, `delta = deltaY > 0 ? 0.9 : 1.1`, `newZoom = Math.min(4, Math.max(0.2, zoom * delta))` (`CanvasViewport.tsx:215-223`).
- The world transform is `translate(pan.x, pan.y) scale(zoom)` with `transformOrigin: "0 0"` (lines 277-278). **Zoom is anchored to the world origin, not the cursor** — zooming in moves content away from the pointer.
- Non-panning zoom uses a 120 ms spring transition (lines 279-283).
- Grid background scales with zoom and shifts with pan (lines 257-261); zoom indicator shows `Math.round(zoom*100)%` (line 398).
- **Gaps:** no zoom buttons; no fit-to-content; no zoom-to-selection; no keyboard zoom; no pinch; no persistence; connection stroke widths scale with the world (intended, but no hairline compensation at low zoom).

### 4.5 Selection — **VERIFIED**

- Single selection only. `selectedItemId` and `selectedConnectionId` are mutually exclusive: selecting an item clears the connection and vice-versa (`useCanvas.ts:257-265`).
- Clicking an item selects it; clicking a connection selects it; clicking empty canvas clears both (`CanvasViewport.tsx:225-243`).
- Selection is visual: `.canvas-item-selected` pulse glow, scale 1.02, resize handles, delete button, and properties panel binding (`CanvasItem.tsx:193-220, 435-496`; `index.css:296`).
- **Gaps:** no multi-select; no marquee / rubber-band; no Shift-click; no Ctrl/Cmd-click toggle; no "select all"; no group move; no alignment/distribution; no lock.

### 4.6 Connections — **VERIFIED**

- Rendered as an SVG `<line>` between **item centers** (`ConnectionLine.tsx:11-13, 34-50`) inside a fixed `4000 × 4000` SVG (`CanvasViewport.tsx:285-296`).
- `connection_type === "arrow"` adds a marker (`markerEnd`, `ConnectionLine.tsx:41`); `line` has no marker. Selection color is `#3b82f6` vs `#64748b` (line 39) — hardcoded hex, not a token.
- Connections whose endpoints are missing from `itemMap` are silently skipped (`CanvasViewport.tsx:313-317`).
- Creation is a single button that picks the **first other item in array order**, not a user-chosen target (`PropertiesPanel.tsx:603-620`). There is no drag-from-port, no endpoint picker, no direction choice, and no label.
- Deletion exists in the hook (`useCanvas.ts:243-255`) but is **not called by any component** — connections cannot be removed from the UI.
- Backend `addConnection` performs **no validation**: it does not check that the canvas exists, that the endpoints exist, that they belong to that canvas, that `from !== to`, or that a duplicate already exists (`canvas.service.ts:247-262`; `canvas.routes.ts:115-129`). Self-connections and duplicate edges are therefore possible.
- `deleteItem` cascades connections both client-side and server-side (`useCanvas.ts:208-210`; `canvas.service.ts:237-243`).

### 4.7 Task linking — **VERIFIED**

- A `CanvasItem` can carry `task_id` (`types/canvas.ts:17`; `schema.sql:176`).
- Linking happens **only at creation**: the header shows `TaskPicker` only while `tool === "task"` (`Canvas.tsx:244-253`), and `handleCanvasClick` writes `task_id` from the picked task (`Canvas.tsx:98-109`).
- There is **no way to link, re-link, or unlink a task on an existing item**. `TaskPicker` has an "Unlink task" action (lines 243-271) but it is only reachable in the header.
- `PropertiesPanel` exposes no task field at all (no `task_id` / `TaskPicker` reference).
- `TaskCard.tsx` — which would render live task title, status, and priority badges (lines 115-117, 229-245) — is **dead code**: nothing imports it. The live task item renders only a static "Task" label plus `item.content` (`CanvasItem.tsx:326-364`), so status/priority are not shown on the canvas.
- **Cross-feature risk (VERIFIED):** `canvas_items.task_id` is a FK to `tasks(task_id)` with no `ON DELETE` action (`schema.sql:176`), and `PRAGMA foreign_keys = ON` is set (`database/index.ts:14`). `taskService.delete()` performs a raw `DELETE FROM tasks` with no dependent cleanup (`task.service.ts:160-165`). Deleting a task that is linked on a canvas will therefore raise an FK constraint error and surface as a generic 500.

### 4.8 Undo / redo — **VERIFIED ABSENT**

- No undo/redo exists anywhere in the canvas feature. `useCanvas.ts` exposes no history; no canvas component handles Ctrl/Cmd+Z or Ctrl/Cmd+Shift+Z.
- `DesignModeContext.tsx` does implement `history` / `historyIndex` / `undo` / `redo` (lines 17-40), but that context is only consumed by the dead `DesignCanvas` / `DraggableElement` tree and is not wired to Project Canvas.

### 4.9 Keyboard — **VERIFIED MINIMAL**

- The **only** keyboard behavior in the live canvas is the Space-pan modifier, handled at `window` level and suppressed inside form fields (`CanvasViewport.tsx:74-105`).
- No Delete/Backspace to remove a selection; no Escape to deselect or cancel a drag; no arrow-key nudge; no Ctrl/Cmd+Z / Shift+Z; no Ctrl/Cmd+C / V / D; no Ctrl/Cmd+A; no tool hotkeys.
- `TaskCard.tsx` has Enter/Space activation (lines 119-126) but is dead code.
- **Accessibility:** the viewport is a plain `div` with no `role`, no `tabIndex`, no roving focus, and no `aria-label`; items are not focusable. Keyboard-only users cannot operate the canvas.

### 4.10 Touch — **VERIFIED ABSENT**

- No `onTouch*` handlers and no `touch-action` CSS anywhere in the canvas components. All gestures use `onMouseDown` + window `mousemove`/`mouseup`.
- Wheel zoom has no touch equivalent. **Result: on touch devices the canvas cannot be panned, zoomed, dragged, or resized.** Only taps (which map to click) work, and even those are inconsistent because item mousedown is ignored while `tool !== "select"`.

### 4.11 Pointer — **VERIFIED MOUSE-ONLY**

- The Pointer Events API is not used: no `onPointerDown`, no `setPointerCapture`, no pointer type detection.
- Drag/resize rely on window `mousemove`/`mouseup` listeners attached on gesture start (`CanvasItem.tsx:120-126, 184-190`), which works for mouse and pen-with-mouse-emulation but not for touch.
- **PROPOSED:** migrate to Pointer Events with `setPointerCapture` and `touch-action: none` on the viewport; this single change enables pen and touch without a parallel gesture stack.

---

## 5. Complexity management & large-canvas behavior

| Capability | Current state | Evidence | Class |
|---|---|---|---|
| Coordinate space | Fixed `4000 × 4000` SVG surface; world div is unbounded | `CanvasViewport.tsx:285-296` | Improve |
| Rendering | Every item is a DOM node; every connection is an SVG node; **no virtualization, culling, or windowing** | `CanvasViewport.tsx:313-353` | Improve |
| Minimap | None | — | Extend (PROPOSED) |
| Groups / layers / frames | None | — | Extend (PROPOSED, later) |
| Search / filter / focus | None | — | Extend (PROPOSED, later) |
| Z-order control | `z_index` column exists but no UI; drag sets a CSS `z-index: 9999` override; no bring-to-front / send-to-back | `schema.sql:184`; `CanvasItem.tsx:215`; `index.css:297` | Improve |
| Rotation | Column + transform applied (`rotate(item.rotation)`) but no editor field | `schema.sql:181`; `CanvasItem.tsx:210`; `PropertiesPanel.tsx` (absent) | DECISION-REQUIRED |
| Lock / protect | None | — | Extend (PROPOSED, later) |
| Comments / annotations | None | — | Non-goal for this card |
| Export / import | **Zero canvas coverage** in import/export service and routes | `importExport.service.ts`, `importExport.routes.ts` (0 matches) | Extend (PROPOSED) |
| Autosave / debounce | None — every mutation is an immediate `PUT` | `useCanvas.ts:148-182` | Improve |
| Offline / queue | None | — | Non-goal for this card |
| Multi-user presence | None | — | Non-goal for this card |

**Large-canvas risk (VERIFIED by construction):** because there is no culling, a canvas with hundreds of items renders hundreds of absolutely-positioned DOM subtrees plus a full SVG connection layer, and every pan frame re-renders the world transform. No performance budget or stress test has been recorded — **UNKNOWN**.

---

## 6. State, validation, error & recovery rules

### 6.1 Client state — **VERIFIED**

- All canvas state is local React state in `useCanvas`: `canvas`, `items`, `connections`, `selectedItemId`, `selectedConnectionId`, `tool`, `pan`, `zoom`, `loading`, `error`, `tasks`, `enteringItemIds`, `deletingItemIds` (`useCanvas.ts:53-65`).
- `pan` and `zoom` are **not persisted** (no `localStorage`, no URL sync). Reloading resets the view to `{0,0}` / `1` (`useCanvas.ts:59-60`).
- No TanStack Query for canvas data — plain `fetch` + `useState`; the global `refetchOnWindowFocus` is `false` (`main.tsx:22`).
- Selection is not tied to URL state; deep-linking to a selection is impossible.

### 6.2 Persistence rules — **VERIFIED**

- **Optimistic local-first, persist-on-release** for drag/resize (`CanvasItem.tsx:106, 116, 168, 180`).
- **Persist-on-blur** for text/number fields (`PropertiesPanel.tsx:226-228, 562, 574, 586, 598`).
- **Persist-on-change** for style controls (`PropertiesPanel.tsx:143-150, 250-268, 313, 330, 365, 382, 405, 427, 443, 479, 503, 516, 533`).
- **No rollback on failure:** `persistItem` sets `error` and returns `null` but never reverts the optimistic local state (`useCanvas.ts:148-167`). The UI can silently diverge from the server.
- **No concurrency control:** `updateItem` has no `updated_at` / version precondition (`canvas.service.ts:187-235`). Concurrent editors are last-write-wins with no warning.
- **Stale ordering:** item/connection mutations do not bump `canvases.updated_at`, so `CanvasList` ordering (`ORDER BY updated_at DESC`, `canvas.service.ts:91-97`) does not reflect edits.
- **Discarded server errors:** every frontend catch uses a generic message (`"Failed to update item"`, etc.) and ignores the response body (`useCanvas.ts:119, 156, 196, 230, 249`; `Canvas.tsx:68`). A server-side message (e.g. an FK constraint) never reaches the user.

### 6.3 Backend validation — **VERIFIED WEAK**

- All routes require auth (`canvas.routes.ts:8`; `auth.middleware.ts:10-27`) but there is **no ownership or role check** — any authenticated user can read, modify, or delete any canvas by id. `requireRole` exists (`auth.middleware.ts:29-32`) but is not applied to canvas routes.
- `addItem` does not validate `item_type` against the type union, does not verify the canvas exists, and does not verify a supplied `task_id` belongs to the canvas's project (`canvas.service.ts:141-179`).
- `updateItem` whitelists fields (good) but does not validate ranges, types, or `item_type` values (`canvas.service.ts:187-235`).
- `style` is stored as an arbitrary string; the client writes JSON, the server never parses or validates it (`canvas.service.ts:173, 216`). Client-side `parseStyle` silently falls back to `{}` on malformed JSON (`CanvasItem.tsx:28-38`; `PropertiesPanel.tsx:85-93`).
- `addConnection` validates nothing (see §4.6).
- Schema FKs are `ON DELETE` **RESTRICT** (default) with `PRAGMA foreign_keys = ON` (`schema.sql:161-198`; `database/index.ts:14`). Canvas deletion manually clears connections then items (`canvas.service.ts:127-137`), but **task deletion does not clear `canvas_items.task_id`** (see §4.7).

### 6.4 Error & recovery UI — **VERIFIED**

- **Page-level error replaces the entire canvas** with a "Canvas could not be loaded" card and only a **Go back** button — no Retry, no inline error, no partial recovery (`Canvas.tsx:167-194`).
- `CanvasList` does have a Retry action (`CanvasList.tsx:135-153`), so the two pages are inconsistent.
- `error` is a single global string; it is only cleared on the next `fetchCanvas` (`useCanvas.ts:85, 99-103`). There is no `clearError`, and one failed mutation permanently blanks the workspace until a refetch.
- **Loading:** full skeleton only when `loading && !canvas` (`Canvas.tsx:147-165`); the viewport shows item skeletons only when `loading && items.length === 0` (`CanvasViewport.tsx:355-378`). A refetch of an existing canvas shows no loading indicator at all.
- **Empty state:** none for a canvas with zero items — the user sees only the grid. `CanvasList` has a proper empty state (`CanvasList.tsx:154-159`).
- **No offline detection, no retry queue, no mutation-pending indicators** on items or connections.

---

## 7. Preserve / Improve / Extend map

### 7.1 Preserve (verified working; do not regress)

- DOM + CSS-transform rendering model and the glass token styling (`CanvasViewport.tsx:247-283`; `index.css:284-298`).
- Spring motion language: enter/exit animations, drag lift, line draw, skeleton pulse (`index.css:284-298`; `useCanvas.ts:123-134, 186-216`).
- Space-pan and middle-mouse pan with momentum (`CanvasViewport.tsx:74-213`).
- Click-to-select / click-empty-to-deselect single selection model (`CanvasViewport.tsx:225-243`).
- Optimistic local-first drag/resize with a single save on release (`CanvasItem.tsx:95-135, 155-191`).
- Full CRUD REST surface and cascade rules for item deletion (`canvas.routes.ts`; `canvas.service.ts:237-243`).
- Canvas list/create/delete and navigation/command-palette entries (`CanvasList.tsx`; `AppShell.tsx:29-34, 376-383`).
- The Canvas vs Automation semantic boundary (see §8).

### 7.2 Improve (verified gaps; safe, in-scope refinements)

- Zoom: cursor-anchored zoom, zoom buttons, fit-to-content, keyboard zoom, optional view persistence.
- Selection: multi-select, marquee, Shift/Ctrl-click, group move, Escape to clear.
- Keyboard: Delete/Backspace, Escape, arrow nudge, Ctrl/Cmd+Z / Shift+Z, tool hotkeys, focusable canvas with ARIA.
- Touch/pen: Pointer Events + `setPointerCapture` + `touch-action: none`.
- Connection authoring: drag-from-port with endpoint choice and direction; make connection deletion reachable; prevent self/duplicate edges in the UI.
- Task linking: make `task_id` editable on existing items; revive `TaskCard` to show live status/priority; keep a visible distinction between linked and unlinked task items.
- State/recovery: inline field-level errors, Retry on the canvas error state, optimistic rollback on save failure, `clearError`, mutation-pending indicators, empty state, reduced-motion guard for momentum.
- Backend: validate `item_type`, numeric ranges, `style` JSON, connection endpoints, and canvas existence; return structured errors the UI can display.
- Data: bump `canvases.updated_at` on item/connection mutation; resolve the task-deletion FK blocker.
- Permissions: project-scoped access for canvas reads/writes (DECISION-REQUIRED — see D-12).

### 7.3 Extend (new capability; requires explicit approval)

- Minimap (only when scale requires it, per `UI_UX_REDESIGN_PLAN.md` §7).
- Groups / frames / layers and z-order controls.
- Canvas export/import (JSON at minimum; PNG/SVG only with owner approval).
- Search / filter / focus-node.
- Optional grouping, locking, and templates — later phases only.
- Undo/redo: session-local history first; persisted server revisions only if the owner approves a revision model.

---

## 8. Explicit non-goals

**Hard non-goals for PM-P3-02 and any Canvas interaction work:**

1. **No automation execution of any kind.** Canvas must not run workflows, call connectors, send messages, change task status, or trigger side effects. A Canvas connection is a *visual relationship*, never a control-flow edge. (**VERIFIED** boundary; `UI_UX_REDESIGN_PLAN.md:175, 240`; `handoff_future_uiux.md:46, 63`.)
2. **No Automation Studio runtime, execution history, replay, approval gate, publish path, credential handling, or environment concept.** Automation Studio stays a labeled preview until a separate backend contract is approved. (**VERIFIED:** `AutomationStudio.tsx:29-30` "Preview only · no runtime connected", disabled Publish, sample data, no `fetch`.)
3. **No conversion of Project Canvas into an automation/workflow surface**, and no shared data model or misleading shared naming between Canvas and Automation Studio.
4. **No secrets, credentials, tokens, or connector payloads rendered on the canvas** or included in any canvas export.
5. **No DB schema change, migration, or data mutation** as part of this card. Schema-affecting recommendations (e.g. FK handling for `canvas_items.task_id`) are DECISION-REQUIRED and must go through the owner gate.
6. **No redesign of the approved glass design system** and no new competing token set; all work maps to existing `--pm-*` tokens.
7. **No implementation of this card's recommendations here.** This artifact is a decision pack, not an implementation authorization.
8. **No scope expansion into comments, real-time collaboration, presence, or offline sync** — not part of this card.
9. **No changes to `DesignCanvas` / `DraggableElement`** beyond keeping them out of the main workspace, per the locked owner decision.

---

## 9. Decision register

| ID | Decision | Options | Recommendation | Class |
|---|---|---|---|---|
| **D-01** | Canvas product boundary | B1 preserve as planning canvas / B2 redesign first / B3 treat as automation surface | **B1** — preserve; extend only after this pack is approved | DECISION-REQUIRED |
| **D-02** | Rendering model | Keep DOM + CSS transforms / migrate to Canvas2D or full SVG | **Keep DOM + CSS transforms**; add Pointer Events. Lower risk, preserves React components and accessibility potential | PROPOSED |
| **D-03** | Zoom model | Origin-anchored wheel only / cursor-anchored + buttons + fit + persist | **Cursor-anchored zoom + fit-to-content + zoom buttons**; persist view only if the owner wants reload continuity | PROPOSED |
| **D-04** | Selection model | Single-select / multi-select + marquee + group ops | **Multi-select + marquee** as an *improve*; keep single-click behavior as the default | PROPOSED |
| **D-05** | Undo/redo | None / session-local history / server-backed revisions | **Session-local undo/redo first**; server revisions only with an approved revision model | PROPOSED |
| **D-06** | Keyboard & touch | Mouse-only / Pointer Events + full keyboard map | **Pointer Events + keyboard map**; required for accessibility and touch | PROPOSED |
| **D-07** | Task linking | Link at creation only / editable link + live TaskCard | **Editable link on existing items + revive `TaskCard`**; keeps canvas task state visible | PROPOSED |
| **D-08** | Connection authoring | "First other item" button / drag-from-port with endpoint + direction | **Drag-from-port with endpoint picker**; keep the button as a fallback | PROPOSED |
| **D-09** | Connection deletion | Unreachable / reachable with confirm | **Make deletion reachable** with an undo affordance | PROPOSED |
| **D-10** | Complexity management | Leave as-is / minimap + groups + culling | **Phased:** virtualization/culling first, minimap when scale requires it, groups later | PROPOSED |
| **D-11** | Save & concurrency | Immediate per-field PUT / debounced batch + version precondition | **Debounced batch + optimistic concurrency (`updated_at` precondition)**; last-write-wins is not acceptable for multi-user | PROPOSED |
| **D-12** | Canvas permissions | Any authenticated user / project-scoped RBAC | **Project-scoped RBAC** — align with the existing project membership model; backend remains authoritative | DECISION-REQUIRED |
| **D-13** | Error & recovery UX | Full-page error / inline errors + retry + rollback | **Inline errors + Retry + optimistic rollback**; keep full-page error only for fatal load failure | PROPOSED |
| **D-14** | Canvas export/import | Excluded / JSON export / JSON + PNG/SVG | **JSON export/import** in a later phase; binary export only with owner approval | PROPOSED |
| **D-15** | Arrow item type | Keep `item_type: "arrow"` / deprecate in favor of connection types | **Deprecate arrow *items*** — they render identically to lines and are unreachable from the toolbar; keep `connection_type: "arrow"` | DECISION-REQUIRED |
| **D-16** | Rotation field | Keep stored-but-uneditable / add rotation control / remove from model | **Add a rotation control** or **remove the field**; a stored-but-uneditable field is a trap | DECISION-REQUIRED |
| **D-17** | Canvas `updated_at` | Stale / bump on item+connection mutation | **Bump on every canvas mutation** so list ordering is truthful | PROPOSED |
| **D-18** | Task deletion FK blocker | Block with raw 500 / unlink on delete / `ON DELETE SET NULL` | **Unlink canvas items on task delete** (or `SET NULL`); requires a schema decision and owner approval | DECISION-REQUIRED |
| **D-19** | Dead code | Keep / remove / revive | **Revive `TaskCard`** (D-07); **keep `DesignCanvas` excluded** per owner decision; do not delete code without approval | DECISION-REQUIRED |

---

## 10. Open questions / UNKNOWN

1. **Performance ceiling (UNKNOWN):** no stress test or item-count budget exists for the canvas. At what item count does the no-culling DOM model become unusable? Needs a measured threshold.
2. **Multi-user reality (UNKNOWN):** is Canvas single-user-per-canvas in practice, or is concurrent editing expected? Determines whether D-05 / D-11 need server backing.
3. **Reduced-motion (UNKNOWN):** no evidence that the JS momentum loop or the CSS animations were verified against `prefers-reduced-motion`.
4. **Screen-reader behavior (UNKNOWN):** no evidence of canvas accessibility verification; the viewport has no role/label and items are not focusable.
5. **Touch usage (UNKNOWN):** whether Canvas is expected to be used on tablets at all — determines the priority of D-06.
6. **Automation runtime (UNKNOWN / out of scope):** no backend runtime exists and none is authorized; this pack makes no assumption about one.
7. **PM-P3-02 card definition (REPORTED):** the literal card ID `PM-P3-02` does not appear in the repository. The card scope is taken from the delegating instruction and the Phase 3 Canvas planning context. Confirm the card text with the owner before implementation.

---

## 11. Evidence index

| Evidence | Path / command | Result |
|---|---|---|
| Git branch / HEAD | `git rev-parse HEAD`; `git branch --show-current` | `main`; `d705a364b2e845eb02f33d57475e0e3af15228c7` — VERIFIED |
| Canvas page | `frontend/src/pages/Canvas.tsx` (333 lines) | VERIFIED |
| Canvas hook | `frontend/src/hooks/useCanvas.ts` (307 lines) | VERIFIED |
| Viewport | `frontend/src/components/canvas/CanvasViewport.tsx` (404 lines) | VERIFIED |
| Item | `frontend/src/components/canvas/CanvasItem.tsx` (501 lines) | VERIFIED |
| Properties | `frontend/src/components/canvas/PropertiesPanel.tsx` (641 lines) | VERIFIED |
| Toolbar | `frontend/src/components/canvas/CanvasToolbar.tsx` (85 lines) | VERIFIED |
| Connection line | `frontend/src/components/canvas/ConnectionLine.tsx` (55 lines) | VERIFIED |
| Task picker | `frontend/src/components/canvas/TaskPicker.tsx` (278 lines) | VERIFIED |
| Task card (dead) | `frontend/src/components/canvas/TaskCard.tsx` (251 lines) | VERIFIED — imported by nothing |
| Shape selector | `frontend/src/components/canvas/ShapeSelector.tsx` (89 lines) | VERIFIED |
| Canvas list | `frontend/src/pages/CanvasList.tsx` (236 lines) | VERIFIED |
| Canvas routes | `backend/src/routes/canvas.routes.ts` (144 lines) | VERIFIED |
| Canvas service | `backend/src/services/canvas.service.ts` (319 lines) | VERIFIED |
| Schema | `backend/src/database/schema.sql:161-198` | VERIFIED |
| DB pragma | `backend/src/database/index.ts` | `PRAGMA foreign_keys = ON` — VERIFIED |
| Design tokens / motion | `frontend/src/index.css:7-8, 47-48, 60-61, 73-74, 86-87, 284-298, 445-446` | VERIFIED |
| Types | `frontend/src/types/canvas.ts:13-28, 30-38, 45-59, 61-76` | VERIFIED |
| Routes | `frontend/src/main.tsx:45-48`; `backend/src/index.ts:16,47`; `backend/src/server.ts:18,51` | VERIFIED |
| Navigation | `frontend/src/components/layout/AppShell.tsx:29-34, 67-69, 376-383` | VERIFIED |
| Auth middleware | `backend/src/middleware/auth.middleware.ts:10-32` | VERIFIED |
| Task deletion | `backend/src/services/task.service.ts:160-165` | VERIFIED — no dependent cleanup |
| Project deletion | `backend/src/services/project.service.ts:113-117` | VERIFIED — soft archive |
| Import/export canvas coverage | `backend/src/services/importExport.service.ts`; `backend/src/routes/importExport.routes.ts` | 0 canvas mentions — VERIFIED |
| Backend tests | `backend/src/tests/backend.test.ts` (362 lines) | 0 canvas mentions — VERIFIED |
| Automation boundary | `frontend/src/pages/AutomationStudio.tsx:24-31`; `UI_UX_REDESIGN_PLAN.md:175, 240`; `handoff_future_uiux.md:46, 63` | VERIFIED |
| Design Mode exclusion | `UI_UX_PROGRESS.md` §1.4; `frontend/src/components/design/*` imported by nothing | VERIFIED |
| Planning authority | `PHASE1_DISCOVERY_DECISION_PACK.md`; `UI_UX_REDESIGN_PLAN.md`; `UI_UX_PROGRESS.md` | VERIFIED |

---

## 12. Verification

- This artifact exists at `<workspace>\PHASE3_02_CANVAS_INTERACTIONS.md`.
- Byte size and SHA-256 are recorded in the PM-P3-02 card completion report (the parent artifact log), because a file cannot contain its own final hash.
- No application source file was modified by this pack.

---

*Prepared as a read-only Phase 3 planning artifact. This is a decision pack, not an implementation authorization and not a source-code change.*
