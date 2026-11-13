# Project Manager — Phase 6 Canvas Implementation: Prompts + Complete Current Source

**Paste this entire document into ChatGPT regular chat.**  
This is a self-contained work package. It contains the two approved implementation prompts and the exact current source files they refer to.

---

## How to use this document

1. Read **Part A** (Canvas authorization prompt) and **Part B** (Canvas accessibility prompt).
2. Read **Part C** (complete current source files). These are the authoritative current code.
3. Generate complete replacement files exactly as the prompts specify.
4. Do not invent APIs, types, tables, or files.
5. Do not change files that the prompts do not list.

---

## Part A — Canvas Authorization Prompt


<!-- BEGIN PHASE6_CODEGEN_02_CANVAS_AUTH_DETAILED.md -->

# ChatGPT Code-Generation Prompt — Canvas Authorization Hardening (Detailed)

**Paste this entire document into ChatGPT regular chat.**  
**Do NOT shorten it. Do NOT ask clarifying questions. Return complete replacement files.**

---

## 0. Your role and output contract

You are generating a production backend patch for an existing TypeScript/Express/SQLite application.

- Return **complete replacement files** for every file listed in §7.
- Do **not** return snippets, diffs, or “here is the changed part”.
- Do **not** change any file that is not listed in §7.
- Do **not** add dependencies.
- Do **not** run git, commits, or pushes.
- Do **not** invent APIs, tables, or environment variables.
- If something in this prompt is ambiguous, choose the **most conservative** interpretation that preserves existing behavior and state it in your final notes.

Your output must be a single response with:

1. A short summary of the approach.
2. Complete file contents, each in its own fenced code block with a header line like `FILE: backend/src/database/schema.sql`.
3. A final “Verification checklist” section.

---

## 1. Project context

**Application:** Project Manager  
**Repository root:** `<workspace>`  
**Stack:**
- Frontend: React 19 + TypeScript + Vite + Tailwind
- Backend: Express 4 + TypeScript
- Database: SQLite via `node:sqlite`
- Auth: JWT in `Authorization: Bearer <token>` header
- Test runner: `node:test` + `supertest`

**Backend structure (relevant):**
```
backend/src/
  database/
    index.ts
    schema.sql
    migrate.ts
  middleware/
    auth.middleware.ts
  services/
    canvas.service.ts
    project.service.ts
  routes/
    canvas.routes.ts
    projects.routes.ts
  tests/
    backend.test.ts
  index.ts
  server.ts
```

**Current auth contract:** `requireAuth` attaches `req.user = { user_id, email, role }` from the JWT. `requireRole` exists but is not used by Canvas routes.

---

## 2. Approved design decisions (binding)

These decisions are already approved by the project owner. Implement them exactly.

### 2.1 Project-scoped RBAC

The application is moving to **project-scoped membership**, not global `users.role`.

- Five actor roles: `owner`, `editor`, `viewer`, `commenter`, `agent`.
- The membership table is **`project_members`** and does **not exist yet**.
- `users.role` remains in the schema for backward compatibility but **must not** be used for Canvas authorization.
- The project creator is the **owner** of that project.

### 2.2 Canvas scope

- Every Canvas must belong to exactly one project.
- `canvases.project_id` becomes **required** (`NOT NULL`) for new canvases.
- The existing schema has `project_id TEXT REFERENCES projects(project_id)` and the service accepts `null`. You are adding the migration + validation to make it required.
- `project_id = null` is **not allowed** on Canvas create or update.

### 2.3 Authorization model

- **owner**: full control of the project and its canvases.
- **editor**: can create, read, update, and delete canvases and canvas items/connections in the project.
- **viewer**: read-only on canvases and items/connections.
- **commenter**: read-only on canvases (same read access as viewer for Canvas; no writes).
- **agent**: read-only on canvases unless a future explicit grant is added. For this patch, treat `agent` as read-only.

### 2.4 Error semantics

- **401**: missing or invalid token (already handled by `requireAuth`).
- **404**: the caller cannot establish access to the resource (unauthorized read, or resource does not exist).
- **403**: the caller is authenticated and has access to the project but is not allowed to perform the action (for example, viewer trying to write).
- **400**: invalid input (missing `project_id`, invalid IDs, invalid item/connection payloads).
- **500**: unexpected server error.

---

## 3. Current code facts you must respect

### 3.1 `backend/src/database/schema.sql` — current Canvas tables

```sql
CREATE TABLE IF NOT EXISTS canvases (
    canvas_id     TEXT PRIMARY KEY,
    project_id    TEXT REFERENCES projects(project_id),
    name          TEXT NOT NULL,
    description   TEXT,
    created_by    TEXT NOT NULL REFERENCES users(user_id),
    created_at    DATETIME NOT NULL,
    updated_at    DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS canvas_items (
    item_id       TEXT PRIMARY KEY,
    canvas_id     TEXT NOT NULL REFERENCES canvases(canvas_id),
    item_type     TEXT NOT NULL,
    task_id       TEXT REFERENCES tasks(task_id),
    x             REAL NOT NULL DEFAULT 0,
    y             REAL NOT NULL DEFAULT 0,
    width         REAL NOT NULL DEFAULT 100,
    height        REAL NOT NULL DEFAULT 100,
    rotation      REAL NOT NULL DEFAULT 0,
    content       TEXT,
    style         TEXT,
    z_index       INTEGER NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL,
    updated_at    DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS canvas_connections (
    connection_id   TEXT PRIMARY KEY,
    canvas_id       TEXT NOT NULL REFERENCES canvases(canvas_id),
    from_item_id    TEXT NOT NULL REFERENCES canvas_items(item_id),
    to_item_id      TEXT NOT NULL REFERENCES canvas_items(item_id),
    connection_type TEXT NOT NULL DEFAULT 'line',
    style           TEXT,
    created_at      DATETIME NOT NULL
);
```

There is **no** `project_members` table.

### 3.2 `backend/src/services/canvas.service.ts` — current exported API

```ts
export interface Canvas {
  canvas_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasItem {
  item_id: string;
  canvas_id: string;
  item_type: string;
  task_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string | null;
  style: string | null;
  z_index: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasConnection {
  connection_id: string;
  canvas_id: string;
  from_item_id: string;
  to_item_id: string;
  connection_type: string;
  style: string | null;
  created_at: string;
}

export function createCanvas(projectId: string | null, name: string, description: string | null, createdBy: string): Canvas;
export function getCanvasById(canvasId: string): Canvas | null;
export function getCanvasWithItems(canvasId: string): CanvasWithItems | null;
export function listCanvases(projectId: string | null): Canvas[];
export function updateCanvas(canvasId: string, updates: { name?: string; description?: string | null }): Canvas | null;
export function deleteCanvas(canvasId: string): boolean;
export function addItem(canvasId: string, item: {...}): CanvasItem;
export function getCanvasItemById(itemId: string): CanvasItem | null;
export function updateItem(itemId: string, updates: {...}): CanvasItem | null;
export function deleteItem(itemId: string): boolean;
export function addConnection(canvasId: string, fromItemId: string, toItemId: string, connectionType?: string, style?: string | null): CanvasConnection;
export function getCanvasConnectionById(connId: string): CanvasConnection | null;
export function deleteConnection(connId: string): boolean;
```

### 3.3 `backend/src/routes/canvas.routes.ts` — current routes

```
POST   /api/canvas
GET    /api/canvas
GET    /api/canvas/:id
PUT    /api/canvas/:id
DELETE /api/canvas/:id
POST   /api/canvas/:id/items
PUT    /api/canvas/items/:itemId
DELETE /api/canvas/items/:itemId
POST   /api/canvas/:id/connections
DELETE /api/canvas/connections/:connId
```

All routes use `router.use(requireAuth)` only. There is **no authorization check** beyond authentication.

### 3.4 `backend/src/middleware/auth.middleware.ts`

```ts
export interface AuthRequest extends Request {
  user?: { user_id: string; email: string; role: string };
}
```

The JWT payload contains `user_id`, `email`, and `role`.

---

## 4. Required implementation

### 4.1 Schema: add `project_members`

Add this table to `backend/src/database/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS project_members (
    project_id   TEXT NOT NULL REFERENCES projects(project_id),
    user_id      TEXT NOT NULL REFERENCES users(user_id),
    role         TEXT NOT NULL DEFAULT 'viewer',
    created_at   DATETIME NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (project_id, user_id)
);
```

Also add an index if appropriate.

**Migration rule:**
- Existing projects must get an owner membership row for `projects.created_by`.
- Existing canvases with `project_id = NULL` must be handled conservatively:
  - Do **not** delete them.
  - Leave them in place.
  - They will be invisible to the new authorization helper because they have no project.
- New canvases must have a non-null `project_id`.

**Important SQLite detail:** `CREATE TABLE IF NOT EXISTS` will not alter an existing `canvases` table. You may add a comment in the schema documenting that the `project_id` requirement is enforced at the service/route layer for existing databases. Do **not** drop or recreate tables.

### 4.2 Add a membership/access helper

Create a new file:

```
backend/src/services/projectAccess.service.ts
```

It must export a typed helper used by Canvas routes. Suggested API (you may refine names, but keep the semantics):

```ts
export type ProjectRole = "owner" | "editor" | "viewer" | "commenter" | "agent";

export interface ProjectAccess {
  role: ProjectRole;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export async function getProjectAccess(projectId: string, userId: string): Promise<ProjectAccess | null>;
```

Rules:
- If the user is the project creator (`projects.created_by = userId`), they are `owner` even if a membership row is missing.
- Otherwise look up `project_members`.
- If no membership row exists, return `null` (no access).
- `owner` and `editor` → read/write/delete.
- `viewer` and `commenter` → read only.
- `agent` → read only for this patch.

### 4.3 Canvas service changes

Update `backend/src/services/canvas.service.ts`:

1. Change `Canvas.project_id` to `string` (not `string | null`).
2. `createCanvas(projectId: string, ...)`:
   - Throw/return an error if `projectId` is missing or does not exist.
   - Insert with the provided project id.
3. `listCanvases(projectId: string | null)`:
   - If `projectId` is provided, return only canvases for that project.
   - If `projectId` is null, return only canvases whose project is owned by or shared with the caller (optional; if that is too broad, keep the existing behavior but document it).
4. Add internal helpers:
   - `getCanvasOrThrow(canvasId)`
   - `getCanvasItemOrThrow(itemId)`
   - `getCanvasConnectionOrThrow(connectionId)`
   - `assertItemBelongsToCanvas(itemId, canvasId)`
   - `assertConnectionBelongsToCanvas(connectionId, canvasId)`
5. `addItem`:
   - Validate `item_type` is one of the supported types.
   - If `task_id` is provided, verify the task exists and belongs to the same project as the canvas. If not, reject.
   - Reject if the canvas does not exist.
6. `updateItem`:
   - Reject cross-canvas item updates.
   - If `task_id` is provided, verify the task exists and belongs to the same project.
7. `addConnection`:
   - Verify both `from_item_id` and `to_item_id` exist.
   - Verify both items belong to the same canvas.
   - Reject self-connections (`from_item_id === to_item_id`) or allow them only if the existing UI does; prefer rejecting.
   - Reject duplicate connections between the same pair in the same direction.
8. `deleteItem` / `deleteConnection`:
   - Keep existing cleanup behavior.

Use explicit error classes or error messages that the route can map to 400/404/403. Keep it simple: throw `Error` with a clear message and let the route map.

### 4.4 Canvas route authorization

Update `backend/src/routes/canvas.routes.ts`:

- Keep `router.use(requireAuth)`.
- For every route, resolve the caller’s access to the relevant project.
- Use the helper from §4.2.
- Map errors as described in §2.4.

Route-by-route requirements:

| Route | Access required | Notes |
|---|---|---|
| `POST /api/canvas` | write access to `project_id` | 400 if `project_id` missing; 404 if project not found; 403 if caller cannot write |
| `GET /api/canvas` | read access to `project_id` if provided | 404 if project not found or caller cannot read |
| `GET /api/canvas/:id` | read access to the canvas’s project | 404 if canvas not found or caller cannot read |
| `PUT /api/canvas/:id` | write access | 404 if canvas not found; 403 if caller cannot write |
| `DELETE /api/canvas/:id` | delete access | 404 if canvas not found; 403 if caller cannot delete |
| `POST /api/canvas/:id/items` | write access | 404 if canvas not found; 403 if caller cannot write |
| `PUT /api/canvas/items/:itemId` | write access to the item’s canvas project | 404 if item not found; 403 if caller cannot write |
| `DELETE /api/canvas/items/:itemId` | delete access | 404 if item not found; 403 if caller cannot delete |
| `POST /api/canvas/:id/connections` | write access | 404 if canvas not found; 403 if caller cannot write |
| `DELETE /api/canvas/connections/:connId` | delete access | 404 if connection not found; 403 if caller cannot delete |

**Do not leak resource existence to unauthorized callers.** If the caller cannot read the project, return 404 even if the canvas exists.

### 4.5 Normalized error responses

Use a consistent JSON shape:

```json
{ "error": "Canvas not found" }
```

or

```json
{ "error": "Insufficient permissions" }
```

Keep the existing success response shapes unchanged.

### 4.6 Tests

Add a new `describe("Canvas Authorization")` block to `backend/src/tests/backend.test.ts`.

Cover at least:

1. Owner can create a canvas in their project.
2. Editor can create/update/delete a canvas.
3. Viewer cannot create/update/delete a canvas (403).
4. Viewer can read a canvas (200).
5. Non-member cannot read a canvas (404).
6. Non-member cannot write a canvas (404 or 403, consistent with your implementation).
7. `project_id = null` is rejected (400).
8. Canvas item cannot be added with a task from a different project.
9. Connection cannot be created between items from different canvases.
10. Unauthorized item update returns 404/403.

Use the existing `supertest` + `getAuthToken()` pattern. Create a second user for non-member tests.

---

## 5. Constraints

- Do **not** change `backend/src/index.ts` or `backend/src/server.ts` unless route registration is required (it is not).
- Do **not** change the frontend.
- Do **not** change Automation Studio.
- Do **not** add a migration runner.
- Do **not** use global `users.role` for Canvas authorization.
- Do **not** store secrets.
- Do **not** remove existing columns or tables.
- Do **not** use `any` in new code unless the existing file already does.
- Keep TypeScript strict-mode compatible (`noUncheckedIndexedAccess` is on).
- Keep Express 4 compatible (do not use Express 5-only APIs).
- Use `.ts` import extensions exactly as the existing backend does.

---

## 6. Acceptance criteria

1. `npm run typecheck --prefix backend` exits 0.
2. `npm run build --prefix backend` exits 0.
3. `npm test --prefix backend` exits 0 with the new Canvas authorization tests passing.
4. Every Canvas route rejects unauthorized or cross-scope access.
5. `project_id = null` is rejected on create.
6. Canvas item task links are validated against the canvas project.
7. Canvas connections are validated to belong to the same canvas.
8. No frontend file is changed.
9. No Automation runtime file is changed.

---

## 7. Files to return (complete replacement code)

Return complete replacement code for:

1. `backend/src/database/schema.sql`
2. `backend/src/services/projectAccess.service.ts` (new file)
3. `backend/src/services/canvas.service.ts`
4. `backend/src/routes/canvas.routes.ts`
5. `backend/src/tests/backend.test.ts`

If you believe another backend file must change, **stop and explain why** instead of changing it.

---

## 8. Final response format

Return exactly:

```text
## Approach
<2-5 bullets>

## Files
FILE: backend/src/database/schema.sql
<complete file>

FILE: backend/src/services/projectAccess.service.ts
<complete file>

FILE: backend/src/services/canvas.service.ts
<complete file>

FILE: backend/src/routes/canvas.routes.ts
<complete file>

FILE: backend/src/tests/backend.test.ts
<complete file>

## Verification checklist
- [ ] npm run typecheck --prefix backend
- [ ] npm run build --prefix backend
- [ ] npm test --prefix backend
- [ ] Manual route matrix checked
- [ ] No frontend files changed
```

Do not include any other commentary outside that structure.


<!-- END PHASE6_CODEGEN_02_CANVAS_AUTH_DETAILED.md -->

<!-- BEGIN PHASE6_CODEGEN_03_CANVAS_ACCESSIBILITY_DETAILED.md -->

# ChatGPT Code-Generation Prompt — Canvas Accessibility & Responsive Behavior (Detailed)

**Paste this entire document into ChatGPT regular chat.**  
**Do NOT shorten it. Do NOT ask clarifying questions. Return complete replacement files.**

---

## 0. Your role and output contract

You are generating a production frontend patch for an existing React 19 + TypeScript + Vite + Tailwind application.

- Return **complete replacement files** for every file listed in §8.
- Do **not** return snippets, diffs, or “here is the changed part”.
- Do **not** change any file that is not listed in §8.
- Do **not** add dependencies.
- Do **not** change the backend, database, API routes, services, or schema.
- Do **not** change Automation Studio.
- Do **not** run git, commits, or pushes.
- If something is ambiguous, choose the **most conservative** interpretation that preserves existing behavior and state it in your final notes.

Your output must be a single response with:

1. A short summary of the approach.
2. Complete file contents, each in its own fenced code block with a header line like `FILE: frontend/src/components/canvas/CanvasViewport.tsx`.
3. A final “Verification checklist” section.

---

## 1. Project context

**Application:** Project Manager  
**Repository root:** `<workspace>`  
**Stack:**
- React 19 + TypeScript + Vite + Tailwind
- Express + TypeScript backend
- SQLite via `node:sqlite`
- JWT auth

**Frontend structure (relevant):**
```
frontend/src/
  components/canvas/
    CanvasToolbar.tsx
    CanvasViewport.tsx
    CanvasItem.tsx
    PropertiesPanel.tsx
    ShapeSelector.tsx
    ConnectionLine.tsx
    TaskPicker.tsx
    TaskCard.tsx
  pages/
    Canvas.tsx
    CanvasList.tsx
  hooks/
    useCanvas.ts
  types/
    canvas.ts
    index.ts
  index.css
```

**Existing design language:** Obsidian Signal Glass. Use existing CSS variables only:

```
--pm-canvas
--pm-canvas-deep
--pm-rail
--pm-glass
--pm-glass-strong
--pm-glass-soft
--pm-glass-hover
--pm-border
--pm-border-strong
--pm-text
--pm-text-secondary
--pm-text-muted
--pm-accent
--pm-accent-rgb
--pm-accent-ink
--pm-accent-soft
--pm-accent-glow
--pm-success
--pm-warning
--pm-danger
--pm-info
--pm-radius-sm
--pm-radius
--pm-radius-lg
--pm-shadow
--pm-shadow-float
--pm-spring
```

Do **not** hardcode new colors in components. If a token is missing, use an existing one.

---

## 2. Current behavior you must preserve

### 2.1 Data model (`frontend/src/types/canvas.ts`)

```ts
export interface CanvasItem {
  item_id: string;
  canvas_id: string;
  item_type: "task" | "square" | "rectangle" | "circle" | "diamond" | "triangle" | "line" | "arrow" | "text";
  task_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string | null;
  style: string | null;
  z_index: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasConnection {
  connection_id: string;
  canvas_id: string;
  from_item_id: string;
  to_item_id: string;
  connection_type: "line" | "arrow";
  style: string | null;
  created_at: string;
}

export type CanvasTool = "select" | "square" | "line" | "arrow" | "text" | "task";
```

### 2.2 Existing state and API flows

- `useCanvas(canvasId)` owns items, connections, selection, tool, pan, zoom, loading, error, tasks, entering/deleting item ids.
- Canvas item updates go through `updateItemLocal` + `saveItem`.
- Canvas connections are created/deleted through `addConnection` / `deleteConnection`.
- Canvas page creates an empty canvas if no `id` is present.
- Existing drag/resize/zoom/pan behavior must remain functional.

### 2.3 Existing components

- `CanvasToolbar`: vertical tool rail with select/square/line/text/task buttons.
- `CanvasViewport`: pan/zoom surface, SVG connections layer, item layer, zoom indicator.
- `CanvasItem`: absolutely positioned item with drag, resize, selection, delete button.
- `PropertiesPanel`: inspector for the selected item.
- `ShapeSelector`: select input for shape type.
- `ConnectionLine`: SVG line/arrow renderer with click selection.

---

## 3. Required behavior — precise specification

Implement **all** of the following. Do not approximate.

### 3.1 Canvas viewport accessibility container

In `CanvasViewport.tsx`:

- Add `role="application"` to the viewport container, with a descriptive `aria-label` such as `Canvas workspace`.
- Add `aria-describedby` pointing to a visually hidden instructions element.
- Add a visually hidden instructions block describing keyboard controls:
  - `Tab` moves through canvas items and connections.
  - `Arrow keys` move the selected item.
  - `Shift + Arrow` moves by 10 pixels.
  - `Delete` or `Backspace` deletes the selected item.
  - `Escape` clears selection.
  - `Space + drag` pans the canvas.
- Add `aria-live="polite"` status text for selection changes, for example: `Selected item 3 of 8` or `Connection selected`.
- Do not announce every pixel movement.

### 3.2 Roving tabindex for canvas items

In `CanvasItem.tsx` and `CanvasViewport.tsx`:

- Canvas items must be reachable by keyboard.
- Use a **roving tabindex**:
  - The selected item has `tabIndex={0}`.
  - All other items have `tabIndex={-1}`.
- Do **not** make every item tabbable.
- When the selected item changes, focus should move to the new selected item if the change originated from keyboard navigation.
- Clicking an item may select it without forcing focus.
- If the selected item is deleted, focus moves to:
  1. The next item in visual order, or
  2. The previous item if there is no next item, or
  3. The viewport container if no items remain.

### 3.3 Arrow-key item navigation

In `CanvasViewport.tsx` (or a small hook if needed):

- Arrow keys navigate the **selected item** when the focused element is a canvas item.
- Arrow behavior:
  - `ArrowLeft` → x -= step
  - `ArrowRight` → x += step
  - `ArrowUp` → y -= step
  - `ArrowDown` → y += step
  - `step = 1` by default
  - `step = 10` when `Shift` is held
- Use `onUpdateItemLocal` + `onSaveItem` so the change persists.
- Do **not** move the selected item when focus is inside an `input`, `textarea`, `select`, or `contentEditable`.
- Do **not** use arrow keys to pan the canvas.
- Do **not** use arrow keys to move connections; connection movement is out of scope.

### 3.4 Delete and escape behavior

- `Delete` or `Backspace` deletes the selected item **only when**:
  - The selected item exists, and
  - Focus is not inside `input`, `textarea`, `select`, or `contentEditable`.
- `Escape`:
  - Clears item selection.
  - Clears connection selection.
  - Does not close the Canvas page or navigate away.
- `Space`:
  - Remains the pan modifier.
  - Must not trigger item selection or deletion.
  - Must not `preventDefault` when focus is in an input/textarea/contentEditable.

### 3.5 Accessible delete action

The existing delete button inside `CanvasItem` is only rendered when an item is selected and can be visually awkward. Make deletion reliably accessible:

- Keep the existing visual delete button if it does not break layout.
- Additionally render a **visually hidden delete button** for the selected item with:
  - `aria-label="Delete selected canvas item"`
  - `className="pm-visually-hidden-focusable"` (add this utility class to `index.css` if needed)
  - It becomes visible on focus.
- The hidden delete button must call the same `onDelete(item.item_id)` handler.
- Do not create a second visible delete control.

### 3.6 Connection accessibility

In `ConnectionLine.tsx` and `CanvasViewport.tsx`:

- Each connection must be keyboard-focusable.
- Add `tabIndex={0}` to the connection `<g>` element (React supports `tabIndex` on SVG elements).
- Add `role="button"`.
- Add `aria-label` such as `Connection from item 2 to item 5`.
- Add `aria-pressed` or `aria-selected` reflecting selection state.
- Enter or Space selects the connection.
- Delete or Backspace deletes the selected connection **only when focus is on the connection** and the caller provides an `onDelete` handler.
- If no delete handler is provided, hide the connection delete behavior from keyboard users (do not advertise it).

### 3.7 Connection tab order

- Items and connections share one logical tab order.
- Recommended order:
  1. Canvas items in visual order (roving tabindex, one tab stop).
  2. Connections in visual order (each its own tab stop).
- Do not create a separate tab cycle for connections.

### 3.8 Toolbar accessibility

In `CanvasToolbar.tsx`:

- Add `aria-label="Canvas tools"` to the toolbar container.
- Add `aria-pressed={active}` to each tool button.
- Add visible focus rings using existing tokens.
- Keep existing tool ids and behavior.
- Rename the `line` tool label from `Line/Arrow` to **`Line`** or **`Arrow`** — choose `Line` for the tool button, because `Line/Arrow` is ambiguous with Automation control flow. Keep the underlying `CanvasTool` value as `"line"` for backward compatibility.
- Do not change the `CanvasTool` union.

### 3.9 Shape selector accessibility

In `ShapeSelector.tsx`:

- Keep the existing label association.
- Ensure the `<select>` has a visible label.
- Ensure focus rings use existing tokens.
- Do not change the emitted shape values.

### 3.10 Properties panel accessibility

In `PropertiesPanel.tsx`:

- Ensure every input has an accessible name.
- Associate labels with inputs using `htmlFor` / `id` or `aria-label`.
- Keep the existing delete button accessible.
- Ensure the panel does not trap focus.
- Keep existing save/update behavior unchanged.

### 3.11 Canvas page accessibility and responsive layout

In `pages/Canvas.tsx`:

- Ensure the page header buttons have accessible names.
- Ensure the Canvas layout uses `flex` / `grid` without fixed widths that break mobile.
- At ≤780px:
  - The properties panel should become a bottom sheet or stack below the canvas.
  - The toolbar should remain reachable.
  - The page must not scroll horizontally.
- At ≥781px:
  - Keep the existing three-column layout: toolbar | canvas | inspector.
- Use CSS media queries or inline responsive styles consistent with the existing codebase.
- Do not introduce a new layout library.

### 3.12 Reduced motion

- Respect `prefers-reduced-motion: reduce`.
- Existing global reduced-motion CSS is already present in `index.css`; do not duplicate it.
- Do not add new animation libraries.

### 3.13 Focus visibility

- Every focusable element must have a visible focus ring.
- Use existing tokens:
  - `outline: 2px solid var(--pm-accent)`
  - `outline-offset: 2px`
- Do not remove focus outlines.

### 3.14 Input focus protection

- Keyboard shortcuts must not fire when the user is typing.
- Check `event.target` for `INPUT`, `TEXTAREA`, `SELECT`, and `isContentEditable`.
- Do not call `preventDefault()` in those cases.

---

## 4. Accessibility acceptance criteria

The implementation must satisfy **all** of these:

1. `Tab` reaches exactly one canvas item at a time (roving tabindex).
2. `Tab` reaches each connection after the items.
3. `Arrow` keys move the selected item by 1px.
4. `Shift + Arrow` moves the selected item by 10px.
5. `Delete` removes the selected item when focus is on the item.
6. `Escape` clears selection.
7. `Space` does not select or delete.
8. Typing in the properties panel does not move or delete items.
9. Every icon-only control has an accessible name.
10. Every focusable element has a visible focus ring.
11. The canvas viewport has `role="application"` and an accessible description.
12. Screen reader users receive selection feedback via `aria-live`.
13. The layout is usable at 375px, 768px, 1024px, 1280px, and 1440px.
14. There is no horizontal page scroll at 375px.

---

## 5. Technical constraints

- React 19 function components and hooks only.
- TypeScript strict mode (`noUncheckedIndexedAccess` is on).
- Do **not** add dependencies.
- Do **not** use `any` in new code unless the existing file already does.
- Do **not** change `useCanvas.ts` unless strictly necessary; if you do, keep its public API stable.
- Do **not** change API URLs or payload shapes.
- Do **not** change Automation Studio.
- Do **not** commit.

---

## 6. Files you may change

You may change only:

1. `frontend/src/components/canvas/CanvasViewport.tsx`
2. `frontend/src/components/canvas/CanvasItem.tsx`
3. `frontend/src/components/canvas/CanvasToolbar.tsx`
4. `frontend/src/components/canvas/ShapeSelector.tsx`
5. `frontend/src/components/canvas/PropertiesPanel.tsx`
6. `frontend/src/components/canvas/ConnectionLine.tsx`
7. `frontend/src/pages/Canvas.tsx`
8. `frontend/src/index.css` — only to add a small utility class (for example `.pm-visually-hidden-focusable`) if needed.

Do **not** change:

- `frontend/src/hooks/useCanvas.ts` (unless you must; explain why)
- `frontend/src/types/canvas.ts`
- `frontend/src/types/index.ts`
- Any backend file
- Any Automation Studio file

---

## 7. Verification commands

After the patch is applied, the following must pass:

```bash
npm run typecheck --prefix frontend
npm run build --prefix frontend
```

Do not run backend tests. Do not run git.

---

## 8. Files to return (complete replacement code)

Return complete replacement code for:

1. `frontend/src/components/canvas/CanvasViewport.tsx`
2. `frontend/src/components/canvas/CanvasItem.tsx`
3. `frontend/src/components/canvas/CanvasToolbar.tsx`
4. `frontend/src/components/canvas/ShapeSelector.tsx`
5. `frontend/src/components/canvas/PropertiesPanel.tsx`
6. `frontend/src/components/canvas/ConnectionLine.tsx`
7. `frontend/src/pages/Canvas.tsx`
8. `frontend/src/index.css` — only if you added a utility class; otherwise say “no CSS changes”.

If you believe another frontend file must change, **stop and explain why** instead of changing it.

---

## 9. Final response format

Return exactly:

```text
## Approach
<2-5 bullets>

## Files
FILE: frontend/src/components/canvas/CanvasViewport.tsx
<complete file>

FILE: frontend/src/components/canvas/CanvasItem.tsx
<complete file>

FILE: frontend/src/components/canvas/CanvasToolbar.tsx
<complete file>

FILE: frontend/src/components/canvas/ShapeSelector.tsx
<complete file>

FILE: frontend/src/components/canvas/PropertiesPanel.tsx
<complete file>

FILE: frontend/src/components/canvas/ConnectionLine.tsx
<complete file>

FILE: frontend/src/pages/Canvas.tsx
<complete file>

FILE: frontend/src/index.css
<complete file or "no CSS changes">

## Verification checklist
- [ ] npm run typecheck --prefix frontend
- [ ] npm run build --prefix frontend
- [ ] Keyboard model verified
- [ ] Responsive breakpoints verified
- [ ] No backend files changed
```

Do not include any other commentary outside that structure.


<!-- END PHASE6_CODEGEN_03_CANVAS_ACCESSIBILITY_DETAILED.md -->


---

# Part C — Complete Current Source Files

These files are the exact current source. Use them as the ground truth.


<!-- BEGIN FILE: backend/src/database/schema.sql -->

## FILE: backend/src/database/schema.sql

```sql
-- Project Manager — SQLite Schema
-- Generated per SCHEMA.md (web-ready: WAL mode + foreign keys enforced)

CREATE TABLE IF NOT EXISTS users (
    user_id         TEXT PRIMARY KEY,
    username        TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'viewer',
    status          TEXT NOT NULL DEFAULT 'active',
    created_at      DATETIME NOT NULL,
    last_login_at   DATETIME,
    ip_address      TEXT,
    device_fingerprint TEXT
);

CREATE TABLE IF NOT EXISTS projects (
    project_id   TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'active',
    created_by   TEXT NOT NULL REFERENCES users(user_id),
    metadata     TEXT,
    created_at   DATETIME NOT NULL,
    updated_at   DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    task_id        TEXT PRIMARY KEY,
    project_id     TEXT NOT NULL REFERENCES projects(project_id),
    title          TEXT NOT NULL,
    description    TEXT,
    status         TEXT NOT NULL DEFAULT 'todo',
    priority       TEXT NOT NULL DEFAULT 'normal',
    assignee_id    TEXT REFERENCES users(user_id),
    created_by     TEXT NOT NULL REFERENCES users(user_id),
    metadata       TEXT,
    due_date       DATETIME,
    created_at     DATETIME NOT NULL,
    updated_at     DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS task_dependencies (
    id              TEXT PRIMARY KEY,
    task_id         TEXT NOT NULL REFERENCES tasks(task_id),
    depends_on_id   TEXT NOT NULL REFERENCES tasks(task_id),
    dependency_type TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
    comment_id    TEXT PRIMARY KEY,
    task_id       TEXT NOT NULL REFERENCES tasks(task_id),
    author_id     TEXT NOT NULL REFERENCES users(user_id),
    body          TEXT NOT NULL,
    created_at    DATETIME NOT NULL,
    updated_at    DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS checklists (
    checklist_id   TEXT PRIMARY KEY,
    task_id        TEXT NOT NULL REFERENCES tasks(task_id),
    title          TEXT NOT NULL,
    is_completed   INTEGER NOT NULL DEFAULT 0,
    created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at     DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checklist_items (
    item_id       TEXT PRIMARY KEY,
    checklist_id  TEXT NOT NULL REFERENCES checklists(checklist_id),
    content       TEXT NOT NULL,
    is_completed  INTEGER NOT NULL DEFAULT 0,
    order_num     INTEGER NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at    DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id         TEXT PRIMARY KEY,
    user_id        TEXT REFERENCES users(user_id),
    agent_id       TEXT,
    action         TEXT NOT NULL,
    target_table   TEXT NOT NULL,
    target_id      TEXT NOT NULL,
    old_value      TEXT,
    new_value      TEXT,
    trigger        TEXT NOT NULL,
    reasoning_summary TEXT,
    ip_address     TEXT,
    created_at     DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
    agent_id      TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL,
    api_key_hash  TEXT NOT NULL,
    provider      TEXT NOT NULL,
    model         TEXT NOT NULL,
    permissions   TEXT NOT NULL,
    rate_limit    INTEGER NOT NULL DEFAULT 60,
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    DATETIME NOT NULL,
    updated_at    DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_activities (
    activity_id   TEXT PRIMARY KEY,
    agent_id      TEXT NOT NULL REFERENCES agents(agent_id),
    user_id       TEXT REFERENCES users(user_id),
    action        TEXT NOT NULL,
    target_id     TEXT NOT NULL,
    target_table  TEXT NOT NULL,
    trigger       TEXT NOT NULL,
    reasoning_summary TEXT,
    status        TEXT NOT NULL DEFAULT 'pending',
    created_at    DATETIME NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project          ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status           ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee         ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date         ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at       ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_deps_task              ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_task          ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_user             ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_target           ON audit_logs(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at       ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_agents_role            ON agents(role);
CREATE INDEX IF NOT EXISTS idx_agents_status          ON agents(status);

CREATE TABLE IF NOT EXISTS login_history (
    login_id         TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(user_id),
    ip_address       TEXT,
    device_fingerprint TEXT,
    logged_in_at     DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_history_user     ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_time     ON login_history(logged_in_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_title_project ON tasks(project_id, title);

CREATE TABLE IF NOT EXISTS git_commits (
    commit_id       TEXT PRIMARY KEY,
    commit_hash     TEXT NOT NULL UNIQUE,
    commit_message  TEXT NOT NULL,
    task_id         TEXT REFERENCES tasks(task_id),
    author          TEXT,
    committed_at    DATETIME NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_git_commits_task ON git_commits(task_id);
CREATE INDEX IF NOT EXISTS idx_git_commits_hash ON git_commits(commit_hash);

-- Canvas workspaces (linked to projects)
CREATE TABLE IF NOT EXISTS canvases (
    canvas_id     TEXT PRIMARY KEY,
    project_id    TEXT REFERENCES projects(project_id),
    name          TEXT NOT NULL,
    description   TEXT,
    created_by    TEXT NOT NULL REFERENCES users(user_id),
    created_at    DATETIME NOT NULL,
    updated_at    DATETIME NOT NULL
);

-- Canvas items (components placed on canvas)
CREATE TABLE IF NOT EXISTS canvas_items (
    item_id       TEXT PRIMARY KEY,
    canvas_id     TEXT NOT NULL REFERENCES canvases(canvas_id),
    item_type     TEXT NOT NULL,
    task_id       TEXT REFERENCES tasks(task_id),
    x             REAL NOT NULL DEFAULT 0,
    y             REAL NOT NULL DEFAULT 0,
    width         REAL NOT NULL DEFAULT 100,
    height        REAL NOT NULL DEFAULT 100,
    rotation      REAL NOT NULL DEFAULT 0,
    content       TEXT,
    style         TEXT,
    z_index       INTEGER NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL,
    updated_at    DATETIME NOT NULL
);

-- Canvas connections (lines/arrows between items)
CREATE TABLE IF NOT EXISTS canvas_connections (
    connection_id   TEXT PRIMARY KEY,
    canvas_id       TEXT NOT NULL REFERENCES canvases(canvas_id),
    from_item_id    TEXT NOT NULL REFERENCES canvas_items(item_id),
    to_item_id      TEXT NOT NULL REFERENCES canvas_items(item_id),
    connection_type TEXT NOT NULL DEFAULT 'line',
    style           TEXT,
    created_at      DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canvas_items_canvas ON canvas_items(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_conn_canvas ON canvas_connections(canvas_id);


-- Connector framework
CREATE TABLE IF NOT EXISTS connectors (
    connector_id    TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,
    provider        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'disconnected',
    config          TEXT,
    created_by      TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS connector_configs (
    config_id       TEXT PRIMARY KEY,
    connector_id    TEXT NOT NULL REFERENCES connectors(connector_id),
    key             TEXT NOT NULL,
    value           TEXT,
    is_secret       INTEGER NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(connector_id, key)
);

CREATE INDEX IF NOT EXISTS idx_connectors_provider ON connectors(provider);
CREATE INDEX IF NOT EXISTS idx_connectors_status ON connectors(status);
CREATE INDEX IF NOT EXISTS idx_connector_configs_connector ON connector_configs(connector_id);


-- UI Layout (Canvas-style designer)
CREATE TABLE IF NOT EXISTS ui_layouts (
    layout_id   TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    page        TEXT NOT NULL,
    elements    TEXT NOT NULL DEFAULT '[]',
    is_locked   INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, page)
);

CREATE INDEX IF NOT EXISTS idx_ui_layouts_user ON ui_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_ui_layouts_page ON ui_layouts(page);

```

<!-- END FILE: backend/src/database/schema.sql -->

<!-- BEGIN FILE: backend/src/middleware/auth.middleware.ts -->

## FILE: backend/src/middleware/auth.middleware.ts

```ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { user_id: string; email: string; role: string };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }
  try {
    const token = authHeader.split(" ")[1] as string;
    const secret = process.env.JWT_SECRET || "project-manager-jwt-secret";
    const decoded = jwt.verify(token, secret) as any;
    (req as AuthRequest).user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = (req as AuthRequest).user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
};

```

<!-- END FILE: backend/src/middleware/auth.middleware.ts -->

<!-- BEGIN FILE: backend/src/services/canvas.service.ts -->

## FILE: backend/src/services/canvas.service.ts

```ts
import { getDb } from "../database/index.ts";
import { randomUUID } from "node:crypto";

// --- Types ---

export interface Canvas {
  canvas_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasItem {
  item_id: string;
  canvas_id: string;
  item_type: string;
  task_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string | null;
  style: string | null;
  z_index: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasConnection {
  connection_id: string;
  canvas_id: string;
  from_item_id: string;
  to_item_id: string;
  connection_type: string;
  style: string | null;
  created_at: string;
}

export interface CanvasWithItems extends Canvas {
  items: CanvasItem[];
  connections: CanvasConnection[];
}

// --- Service ---

export function createCanvas(
  projectId: string | null,
  name: string,
  description: string | null,
  createdBy: string
): Canvas {
  const db = getDb();
  const now = new Date().toISOString();
  const canvasId = randomUUID();
  db.prepare(
    `INSERT INTO canvases (canvas_id, project_id, name, description, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(canvasId, projectId, name, description, createdBy, now, now);
  return getCanvasById(canvasId)!;
}

export function getCanvasById(canvasId: string): Canvas | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM canvases WHERE canvas_id = ?`).get(canvasId) as any;
  return row ? mapCanvas(row) : null;
}

export function getCanvasWithItems(canvasId: string): CanvasWithItems | null {
  const db = getDb();
  const canvas = getCanvasById(canvasId);
  if (!canvas) return null;

  const items = db
    .prepare(`SELECT * FROM canvas_items WHERE canvas_id = ? ORDER BY z_index ASC`)
    .all(canvasId) as any[];
  const connections = db
    .prepare(`SELECT * FROM canvas_connections WHERE canvas_id = ?`)
    .all(canvasId) as any[];

  return {
    ...canvas,
    items: items.map(mapCanvasItem),
    connections: connections.map(mapCanvasConnection),
  };
}

export function listCanvases(projectId: string | null): Canvas[] {
  const db = getDb();
  const rows = projectId
    ? db.prepare(`SELECT * FROM canvases WHERE project_id = ? ORDER BY updated_at DESC`).all(projectId)
    : db.prepare(`SELECT * FROM canvases ORDER BY updated_at DESC`).all();
  return (rows as any[]).map(mapCanvas);
}

export function updateCanvas(
  canvasId: string,
  updates: { name?: string; description?: string | null }
): Canvas | null {
  const db = getDb();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }

  if (fields.length === 0) return getCanvasById(canvasId);

  fields.push("updated_at = ?");
  values.push(now);
  values.push(canvasId);

  db.prepare(`UPDATE canvases SET ${fields.join(", ")} WHERE canvas_id = ?`).run(...values);
  return getCanvasById(canvasId);
}

export function deleteCanvas(canvasId: string): boolean {
  const db = getDb();
  // Delete connections and items first
  const items = db.prepare(`SELECT item_id FROM canvas_items WHERE canvas_id = ?`).all(canvasId) as any[];
  for (const item of items) {
    db.prepare(`DELETE FROM canvas_connections WHERE from_item_id = ? OR to_item_id = ?`).run(item.item_id, item.item_id);
  }
  db.prepare(`DELETE FROM canvas_items WHERE canvas_id = ?`).run(canvasId);
  const result = db.prepare(`DELETE FROM canvases WHERE canvas_id = ?`).run(canvasId);
  return result.changes > 0;
}

// --- Items ---

export function addItem(
  canvasId: string,
  item: {
    item_type: string;
    task_id?: string | null;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    content?: string | null;
    style?: string | null;
    z_index?: number;
  }
): CanvasItem {
  const db = getDb();
  const now = new Date().toISOString();
  const itemId = randomUUID();
  db.prepare(
    `INSERT INTO canvas_items (item_id, canvas_id, item_type, task_id, x, y, width, height, rotation, content, style, z_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    itemId,
    canvasId,
    item.item_type,
    item.task_id ?? null,
    item.x ?? 0,
    item.y ?? 0,
    item.width ?? 100,
    item.height ?? 100,
    item.rotation ?? 0,
    item.content ?? null,
    item.style ?? null,
    item.z_index ?? 0,
    now,
    now
  );
  return getCanvasItemById(itemId)!;
}

export function getCanvasItemById(itemId: string): CanvasItem | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM canvas_items WHERE item_id = ?`).get(itemId) as any;
  return row ? mapCanvasItem(row) : null;
}

export function updateItem(
  itemId: string,
  updates: {
    item_type?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    content?: string | null;
    style?: string | null;
    z_index?: number;
    task_id?: string | null;
  }
): CanvasItem | null {
  const db = getDb();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  const fieldMap: Record<string, any> = {
    item_type: updates.item_type,
    x: updates.x,
    y: updates.y,
    width: updates.width,
    height: updates.height,
    rotation: updates.rotation,
    content: updates.content,
    style: updates.style,
    z_index: updates.z_index,
    task_id: updates.task_id,
  };

  for (const [key, val] of Object.entries(fieldMap)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }

  if (fields.length === 0) return getCanvasItemById(itemId);

  fields.push("updated_at = ?");
  values.push(now);
  values.push(itemId);

  db.prepare(`UPDATE canvas_items SET ${fields.join(", ")} WHERE item_id = ?`).run(...values);
  return getCanvasItemById(itemId);
}

export function deleteItem(itemId: string): boolean {
  const db = getDb();
  // Delete connections involving this item
  db.prepare(`DELETE FROM canvas_connections WHERE from_item_id = ? OR to_item_id = ?`).run(itemId, itemId);
  const result = db.prepare(`DELETE FROM canvas_items WHERE item_id = ?`).run(itemId);
  return result.changes > 0;
}

// --- Connections ---

export function addConnection(
  canvasId: string,
  fromItemId: string,
  toItemId: string,
  connectionType: string = "line",
  style: string | null = null
): CanvasConnection {
  const db = getDb();
  const now = new Date().toISOString();
  const connId = randomUUID();
  db.prepare(
    `INSERT INTO canvas_connections (connection_id, canvas_id, from_item_id, to_item_id, connection_type, style, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(connId, canvasId, fromItemId, toItemId, connectionType, style, now);
  return getCanvasConnectionById(connId)!;
}

export function getCanvasConnectionById(connId: string): CanvasConnection | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM canvas_connections WHERE connection_id = ?`).get(connId) as any;
  return row ? mapCanvasConnection(row) : null;
}

export function deleteConnection(connId: string): boolean {
  const db = getDb();
  const result = db.prepare(`DELETE FROM canvas_connections WHERE connection_id = ?`).run(connId);
  return result.changes > 0;
}

// --- Mappers ---

function mapCanvas(row: any): Canvas {
  return {
    canvas_id: row.canvas_id,
    project_id: row.project_id,
    name: row.name,
    description: row.description,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCanvasItem(row: any): CanvasItem {
  return {
    item_id: row.item_id,
    canvas_id: row.canvas_id,
    item_type: row.item_type,
    task_id: row.task_id,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    content: row.content,
    style: row.style,
    z_index: row.z_index,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCanvasConnection(row: any): CanvasConnection {
  return {
    connection_id: row.connection_id,
    canvas_id: row.canvas_id,
    from_item_id: row.from_item_id,
    to_item_id: row.to_item_id,
    connection_type: row.connection_type,
    style: row.style,
    created_at: row.created_at,
  };
}

```

<!-- END FILE: backend/src/services/canvas.service.ts -->

<!-- BEGIN FILE: backend/src/services/project.service.ts -->

## FILE: backend/src/services/project.service.ts

```ts
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.ts";

export interface Project {
  project_id: string;
  name: string;
  description: string;
  status: "active" | "archived";
  created_by: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description: string;
  status?: "active" | "archived";
  created_by: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  status?: "active" | "archived";
  metadata?: Record<string, unknown>;
}

const db = getDb();

export class ProjectService {
  async create(data: ProjectCreate): Promise<Project> {
    const now = new Date().toISOString();
    const projectId = uuidv4();
    const metadata: Record<string, unknown> = data.metadata || {};

    const sql = `
      INSERT INTO projects (project_id, name, description, status, created_by, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.prepare(sql).run(
      projectId,
      data.name,
      data.description || null,
      data.status || "active",
      data.created_by,
      JSON.stringify(metadata),
      now,
      now,
    );

    const project = await this.get(projectId);
    if (!project) throw new Error("Failed to create project");
    return project;
  }

  async get(projectId: string): Promise<Project | null> {
    const rows = db.prepare("SELECT * FROM projects WHERE project_id = ?").all(projectId);
    if (rows.length === 0) return null;
    return this.rowToProject(rows[0] as any);
  }

  async getAll(status?: "active" | "archived"): Promise<Project[]> {
    let sql = "SELECT * FROM projects";
    const params: string[] = [];
    if (status) {
      sql += " WHERE status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(...params);
    return rows.map((r: any) => this.rowToProject(r));
  }

  async update(projectId: string, data: ProjectUpdate): Promise<Project | null> {
    const existing = await this.get(projectId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (data.name !== undefined) {
      updates.push("name = ?");
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push("description = ?");
      params.push(data.description || null);
    }
    if (data.status !== undefined) {
      updates.push("status = ?");
      params.push(data.status);
    }
    if (data.metadata !== undefined) {
      const current = existing.metadata;
      const mergedMetadata = { ...current, ...data.metadata };
      params.push(JSON.stringify(mergedMetadata) as string);
    }

    if (updates.length === 0) return existing;

    updates.push("updated_at = ?");
    params.push(now);
    params.push(projectId);

    const sql = `UPDATE projects SET ${updates.join(", ")} WHERE project_id = ?`;
    db.prepare(sql).run(...params);
    return this.get(projectId);
  }

  async delete(projectId: string): Promise<boolean> {
    const existing = await this.get(projectId);
    if (!existing) return false;
    const now = new Date().toISOString();
    db.prepare("UPDATE projects SET status = 'archived', updated_at = ? WHERE project_id = ?").run(now, projectId);
    return true;
  }

  private rowToProject(row: any): Project {
    return {
      project_id: row.project_id,
      name: row.name,
      description: row.description ?? "",
      status: row.status as "active" | "archived",
      created_by: row.created_by,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const projectService = new ProjectService();

```

<!-- END FILE: backend/src/services/project.service.ts -->

<!-- BEGIN FILE: backend/src/routes/canvas.routes.ts -->

## FILE: backend/src/routes/canvas.routes.ts

```ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import * as canvasService from "../services/canvas.service.ts";

const router = Router();

// All canvas routes require auth
router.use(requireAuth);

// Create canvas
router.post("/", (req, res) => {
  try {
    const { project_id, name, description } = req.body;
    const user = (req as any).user;
    const canvas = canvasService.createCanvas(
      project_id ?? null,
      name,
      description ?? null,
      user.user_id
    );
    res.status(201).json({ canvas });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List canvases
router.get("/", (req, res) => {
  try {
    const projectId = req.query.project_id as string | undefined;
    const canvases = canvasService.listCanvases(projectId ?? null);
    res.json({ canvases });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get canvas with items + connections
router.get("/:id", (req, res) => {
  try {
    const canvas = canvasService.getCanvasWithItems(req.params.id);
    if (!canvas) {
      return res.status(404).json({ error: "Canvas not found" });
    }
    res.json({ canvas });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update canvas metadata
router.put("/:id", (req, res) => {
  try {
    const { name, description } = req.body;
    const canvas = canvasService.updateCanvas(req.params.id, { name, description });
    if (!canvas) {
      return res.status(404).json({ error: "Canvas not found" });
    }
    res.json({ canvas });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete canvas
router.delete("/:id", (req, res) => {
  try {
    const deleted = canvasService.deleteCanvas(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Canvas not found" });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add item to canvas
router.post("/:id/items", (req, res) => {
  try {
    const item = canvasService.addItem(req.params.id, req.body);
    res.status(201).json({ item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update item
router.put("/items/:itemId", (req, res) => {
  try {
    const item = canvasService.updateItem(req.params.itemId, req.body);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json({ item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete item
router.delete("/items/:itemId", (req, res) => {
  try {
    const deleted = canvasService.deleteItem(req.params.itemId);
    if (!deleted) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add connection
router.post("/:id/connections", (req, res) => {
  try {
    const { from_item_id, to_item_id, connection_type, style } = req.body;
    const conn = canvasService.addConnection(
      req.params.id,
      from_item_id,
      to_item_id,
      connection_type ?? "line",
      style ?? null
    );
    res.status(201).json({ connection: conn });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete connection
router.delete("/connections/:connId", (req, res) => {
  try {
    const deleted = canvasService.deleteConnection(req.params.connId);
    if (!deleted) {
      return res.status(404).json({ error: "Connection not found" });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

```

<!-- END FILE: backend/src/routes/canvas.routes.ts -->

<!-- BEGIN FILE: backend/src/routes/projects.routes.ts -->

## FILE: backend/src/routes/projects.routes.ts

```ts
import { Router } from "express";
import { projectService, type ProjectCreate, type ProjectUpdate } from "../services/project.service.ts";
import { requireAuth } from "../middleware/auth.middleware.ts";
import type { AuthRequest } from "../middleware/auth.middleware.ts";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const status = (req.query.status as "active" | "archived") || undefined;
    const projects = await projectService.getAll(status);
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch projects" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const project = await projectService.get(req.params.id as string);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch project" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const body = req.body as ProjectCreate;
    if (!body.name) return res.status(400).json({ message: "Project name is required" });
    const project = await projectService.create({
      name: body.name,
      description: body.description || "",
      status: body.status || "active",
      created_by: (req as AuthRequest).user!.user_id,
      metadata: body.metadata || {},
    });
    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ message: "Failed to create project" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const body = req.body as ProjectUpdate;
    const project = await projectService.update(req.params.id as string, body);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ message: "Failed to update project" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await projectService.delete(req.params.id as string);
    if (!deleted) return res.status(404).json({ message: "Project not found" });
    res.json({ message: "Project archived" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete project" });
  }
});

export default router;

```

<!-- END FILE: backend/src/routes/projects.routes.ts -->

<!-- BEGIN FILE: backend/src/tests/backend.test.ts -->

## FILE: backend/src/tests/backend.test.ts

```ts
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { describe, test, before, after } from "node:test";
import { getDb } from "../database/index.ts";
let app: any;
const serverPort = await import("../index.ts");
import request from "supertest";

// Note: supertest is needed. We'll install it.
// For now, this is the test structure.

const TEST_PORT = process.env.TEST_PORT || 3001;
const baseUrl = `http://localhost:${TEST_PORT}`;

// Test data
const testUser = {
  username: "acceptance_test",
  email: "acceptance@test.com",
  password: "password123",
};

const testProject = {
  name: "Acceptance Test Project",
  description: "A test project",
  status: "active",
};

const testTask = {
  project_id: "test-project",
  title: "Acceptance Test Task",
};

let server: any = null;
let authToken: string | null = null;

// Start server before tests
before(async () => {
  await import("../database/index.ts");
  const serverModule = await import("../index.ts");
  app = serverModule.app;
  const serverPort = app.listen(TEST_PORT);
  await new Promise<void>((resolve) => {
    server = serverPort;
    const onError = (err: Error) => {
      serverPort.removeListener("listening", onReady);
      resolve();
    };
    const onReady = () => {
      serverPort.removeListener("error", onError);
      resolve();
    };
    serverPort.once("listening", onReady);
    serverPort.once("error", onError);
  });
});

after(() => {
  if (server) {
    server.close();
  }
});

// Helper to register and login
async function getAuthToken(): Promise<string> {
  if (authToken) return authToken;
  // Register (may already exist from previous run)
  const regRes = await request(app)
    .post("/api/auth/register")
    .send({
      username: "acceptance_test",
      email: "acceptance@test.com",
      password: "password123",
    });
  // Accept both 201 (created) and 409 (already exists)
  if (regRes.status !== 201 && regRes.status !== 409) {
    throw new Error(`Registration failed with status ${regRes.status}`);
  }

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "acceptance@test.com", password: "password123" });
  assert.equal(loginRes.status, 200);
  authToken = loginRes.body.token as string;
  return authToken;
}

describe("Project Manager MVP Acceptance Tests", () => {
  describe("Auth", () => {
    test("POST /api/auth/register creates a new user", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "test_user_" + randomUUID(),
          email: "test_" + randomUUID() + "@example.com",
          password: "password123",
        });
      assert.equal(res.status, 201);
      assert.ok(res.body.token);
    });

    test("POST /api/auth/login authenticates users", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          username: "login_test",
          email: "login@test.com",
          password: "password123",
        });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "login@test.com", password: "password123" });
      assert.equal(res.status, 200);
      assert.ok(res.body.token);
    });

    test("POST /api/auth/login rejects wrong password", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          username: "wrong_pass",
          email: "wrong@test.com",
          password: "correct",
        });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "wrong@test.com", password: "wrong" });
      assert.equal(res.status, 401);
    });
  });

  describe("Project CRUD", () => {
    test("POST /api/projects creates a project", async () => {
      const token = await getAuthToken();
      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send(testProject);
      assert.equal(res.status, 201);
      assert.ok(res.body.project);
    });

    test("GET /api/projects lists projects", async () => {
      const token = await getAuthToken();
      const res = await request(app)
        .get("/api/projects")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.projects));
    });

    test("GET /api/projects/:id retrieves a project", async () => {
      const token = await getAuthToken();
      const createRes = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send(testProject);
      const projectId = createRes.body.project.project_id;

      const getRes = await request(app)
        .get(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`);
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.project.project_id, projectId);
    });

    test("PUT /api/projects/:id updates a project", async () => {
      const token = await getAuthToken();
      const createRes = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send(testProject);
      const projectId = createRes.body.project.project_id;

      const updateRes = await request(app)
        .put(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Project", status: "active" });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.project.name, "Updated Project");
    });

    test("DELETE /api/projects/:id deletes a project", async () => {
      const token = await getAuthToken();
      const createRes = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send(testProject);
      const projectId = createRes.body.project.project_id;

      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.message, "Project archived");
    });
  });

  describe("Task CRUD", () => {
    test("POST /api/tasks creates a task", async () => {
      const token = await getAuthToken();
      const projectRes = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Task Project", status: "active" });
      const projectId = projectRes.body.project.project_id;

      const res = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: "Test Task",
          status: "todo",
        });
      assert.equal(res.status, 201);
      assert.ok(res.body.task);
    });

    test("GET /api/tasks/:id retrieves a task", async () => {
      const token = await getAuthToken();
      const projectRes = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Task retrieve", status: "active" });
      const projectId = projectRes.body.project.project_id;

      const createRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: "Task to retrieve",
          status: "todo",
        });
      const taskId = createRes.body.task.task_id;

      const res = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.task.task_id, taskId);
    });

    test("PUT /api/tasks/:id updates a task", async () => {
      const token = await getAuthToken();
      const projectRes = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Update Project", status: "active" });
      const projectId = projectRes.body.project.project_id;

      const createRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: "Task to update",
          status: "todo",
        });
      const taskId = createRes.body.task.task_id;

      const updateRes = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Updated Task", status: "in_progress" });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.task.title, "Updated Task");
    });

    test("DELETE /api/tasks/:id deletes a task", async () => {
      const token = await getAuthToken();
      const projectRes = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Delete Project", status: "active" });
      const projectId = projectRes.body.project.project_id;

      const createRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: "Task to delete",
          status: "todo",
        });
      const taskId = createRes.body.task.task_id;

      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.message, "Task deleted");
    });
  });

  describe("Dependency Management", () => {
    test("POST /api/dependencies creates a task dependency", async () => {
      const token = await getAuthToken();
      const projectRes = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Dep Project", status: "active" });
      const projectId = projectRes.body.project.project_id;

      const t1 = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({ project_id: projectId, title: "Task 1", status: "todo" });
      const t2 = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({ project_id: projectId, title: "Task 2", status: "todo" });

      const res = await request(app)
        .post("/api/dependencies")
        .set("Authorization", `Bearer ${token}`)
        .send({
          task_id: t1.body.task.task_id,
          depends_on_id: t2.body.task.task_id,
          dependency_type: "blocks",
        });
      assert.equal(res.status, 201);
      assert.ok(res.body.dependency);
    });
  });

  describe("Checklist CRUD", () => {
    test("POST /api/checklists creates a checklist with items", async () => {
      const token = await getAuthToken();
      const projectRes = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Checklist Project", status: "active" });
      const projectId = projectRes.body.project.project_id;

      const taskRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: "Checklist Task",
          status: "todo",
        });
      const taskId = taskRes.body.task.task_id;

      const res = await request(app)
        .post("/api/checklists")
        .set("Authorization", `Bearer ${token}`)
        .send({
          task_id: taskId,
          title: "Test Checklist",
          items: [
            { content: "Item 1", is_completed: false, order_num: 0 },
            { content: "Item 2", is_completed: true, order_num: 1 },
          ],
        });
      assert.equal(res.status, 201);
      assert.ok(res.body.checklist);
      assert.equal(res.body.checklist.items.length, 2);
    });
  });
});

```

<!-- END FILE: backend/src/tests/backend.test.ts -->

<!-- BEGIN FILE: backend/src/index.ts -->

## FILE: backend/src/index.ts

```ts
import "./env.ts";
import express from "express";
import { configureSecurity } from "./middleware/security.middleware.ts";
import { apiLimiter, authLimiter } from "./middleware/rateLimit.middleware.ts";
import { requireAuth } from "./middleware/auth.middleware.ts";
import authRouter from "./routes/auth.routes.ts";
import usersRouter from "./routes/users.routes.ts";
import dashboardRouter from "./routes/dashboard.routes.ts";
import agentsRouter from "./routes/agents.routes.ts";
import tasksRouter from "./routes/tasks.routes.ts";
import projectsRouter from "./routes/projects.routes.ts";
import checklistsRouter from "./routes/checklists.routes.ts";
import dependenciesRouter from "./routes/dependencies.routes.ts";
import gitRouter from "./routes/git.routes.ts";
import importExportRouter from "./routes/importExport.routes.ts";
import canvasRouter from "./routes/canvas.routes.ts";
import backupRouter from "./routes/backup.routes.ts";
import monitoringRouter from "./routes/monitoring.routes.ts";
import uiLayoutRouter from "./routes/uiLayout.routes.ts";
import connectorsRouter from "./routes/connectors.routes.ts";
import { getDb, closeDb } from "./database/index.ts";

const app = express();

// Security middleware
configureSecurity(app);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/checklists", checklistsRouter);
app.use("/api/dependencies", dependenciesRouter);
app.use("/api/git", gitRouter);
app.use("/api/import-export", importExportRouter);
app.use("/api/canvas", canvasRouter);
app.use("/api/backup", backupRouter);
app.use("/api/monitoring", monitoringRouter);
app.use("/api/ui-layout", uiLayoutRouter);
app.use("/api/connectors", connectorsRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", database: "connected" });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Initialize database on startup
getDb();

// Graceful shutdown
process.on("SIGINT", () => { closeDb(); process.exit(0); });
process.on("SIGTERM", () => { closeDb(); process.exit(0); });

export { app, getDb, closeDb };

```

<!-- END FILE: backend/src/index.ts -->

<!-- BEGIN FILE: backend/src/server.ts -->

## FILE: backend/src/server.ts

```ts
import "./env.ts";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { getDb, closeDb } from "./database/index.ts";
import { configureSecurity } from "./middleware/security.middleware.ts";
import { apiLimiter, authLimiter } from "./middleware/rateLimit.middleware.ts";
import { requireAuth } from "./middleware/auth.middleware.ts";
import authRouter from "./routes/auth.routes.ts";
import tasksRouter from "./routes/tasks.routes.ts";
import projectsRouter from "./routes/projects.routes.ts";
import agentsRouter from "./routes/agents.routes.ts";
import checklistsRouter from "./routes/checklists.routes.ts";
import dependenciesRouter from "./routes/dependencies.routes.ts";
import gitRouter from "./routes/git.routes.ts";
import importExportRouter from "./routes/importExport.routes.ts";
import canvasRouter from "./routes/canvas.routes.ts";
import backupRouter from "./routes/backup.routes.ts";
import monitoringRouter from "./routes/monitoring.routes.ts";
import uiLayoutRouter from "./routes/uiLayout.routes.ts";
import connectorsRouter from "./routes/connectors.routes.ts";
import dashboardRouter from "./routes/dashboard.routes.ts";
import usersRouter from "./routes/users.routes.ts";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Security middleware
configureSecurity(app);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/checklists", checklistsRouter);
app.use("/api/dependencies", dependenciesRouter);
app.use("/api/git", gitRouter);
app.use("/api/import-export", importExportRouter);
app.use("/api/canvas", canvasRouter);
app.use("/api/backup", backupRouter);
app.use("/api/monitoring", monitoringRouter);
app.use("/api/ui-layout", uiLayoutRouter);
app.use("/api/connectors", connectorsRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", database: "connected" });
});

// API 404 handler (only for /api/* routes)
app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Initialize database on startup
getDb();

// Start the unified server with Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode: Mount Vite dev server in middleware mode
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, "..", "..", "frontend", "vite.config.ts"),
      root: path.resolve(__dirname, "..", "..", "frontend"),
      server: { middlewareMode: true },
      appType: "spa",
    });

    // All non-API requests pass to Vite (MUST be before any catch-all handlers)
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve pre-built static bundle
    const distPath = path.join(__dirname, "..", "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = parseInt(process.env.NODE_PORT || "3000");
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Unified Full-Stack Server running on http://localhost:${PORT}`);
    console.log(`   API: /api/*`);
    console.log(`   Frontend: / (React + TypeScript via Vite HMR)`);
  });
}

// Graceful shutdown
process.on("SIGINT", () => { closeDb(); process.exit(0); });
process.on("SIGTERM", () => { closeDb(); process.exit(0); });

startServer();

```

<!-- END FILE: backend/src/server.ts -->

<!-- BEGIN FILE: backend/package.json -->

## FILE: backend/package.json

```json
{
  "name": "project-manager-backend",
  "version": "1.0.0",
  "description": "Project Manager backend API (Express + TypeScript)",
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:migrate": "tsx src/database/migrate.ts",
    "db:seed": "tsx src/database/seed.ts",
    "db:reset": "tsx src/database/reset.ts",
    "typecheck": "tsc -p tsconfig.typecheck.json --noEmit",
    "test": "node --test src/tests/",
    "dev:full": "tsx src/server.ts"
  },
  "license": "MIT",
  "dependencies": {
    "bcryptjs": "^3.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.21.2",
    "express-rate-limit": "^7.5.0",
    "helmet": "^8.1.0",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.3",
    "@types/express-rate-limit": "^6.0.2",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^24.0.0",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^5.2.0",
    "autoprefixer": "^10.6.2",
    "jest": "^30.5.2",
    "postcss": "^8.5.32",
    "supertest": "^7.3.1",
    "tailwindcss": "^3.4.11",
    "tsx": "^4.20.0",
    "typescript": "^5.9.3",
    "vite": "^6.4.5"
  },
  "type": "module"
}

```

<!-- END FILE: backend/package.json -->

<!-- BEGIN FILE: backend/tsconfig.json -->

## FILE: backend/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true,
    "types": [
      "node"
    ],
    "noUncheckedIndexedAccess": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "noImplicitOverride": true
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

<!-- END FILE: backend/tsconfig.json -->

<!-- BEGIN FILE: frontend/src/types/canvas.ts -->

## FILE: frontend/src/types/canvas.ts

```ts
// Canvas Type Definitions

export interface Canvas {
  canvas_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasItem {
  item_id: string;
  canvas_id: string;
  item_type: "task" | "square" | "rectangle" | "circle" | "diamond" | "triangle" | "line" | "arrow" | "text";
  task_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string | null;
  style: string | null;
  z_index: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasConnection {
  connection_id: string;
  canvas_id: string;
  from_item_id: string;
  to_item_id: string;
  connection_type: "line" | "arrow";
  style: string | null;
  created_at: string;
}

export interface CanvasWithItems extends Canvas {
  items: CanvasItem[];
  connections: CanvasConnection[];
}

export interface CanvasItemStyle {
  shape?: "square" | "rectangle" | "circle" | "diamond" | "triangle";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  color?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
  opacity?: number;
  borderRadius?: number;
}

export type CanvasTool = "select" | "square" | "line" | "arrow" | "text" | "task";

export interface DragState {
  isDragging: boolean;
  itemId: string | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface PanState {
  isPanning: boolean;
  startX: number;
  startY: number;
  translateX: number;
  translateY: number;
}

```

<!-- END FILE: frontend/src/types/canvas.ts -->

<!-- BEGIN FILE: frontend/src/types/index.ts -->

## FILE: frontend/src/types/index.ts

```ts
// Frontend Type Definitions
// Shared types between components - no external project imports

export interface User {
  user_id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  last_login_at: string | null;
  ip_address: string | null;
  device_fingerprint: string | null;
}

export interface Project {
  project_id: string;
  name: string;
  description: string;
  status: "active" | "archived";
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  task_id: string;
  project_id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  priority: "low" | "normal" | "high" | "urgent";
  assignee_id: string | null;
  created_by: string;
  metadata: Record<string, unknown>;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}


export interface DashboardStats {
  total_tasks: number;
  status_counts: {
    todo: number;
    in_progress: number;
    done: number;
    blocked: number;
  };
  priority_counts: {
    low: number;
    normal: number;
    high: number;
    urgent: number;
  };
  due_soon: Array<{
    task_id: string;
    title: string;
    due_date: string;
    days_until_due: number;
  }>;
  due_soon_count: number;
  overdue_count: number;
  overdue: Array<{
    task_id: string;
    title: string;
    due_date: string;
  }>;
}

export interface Checklist {
  checklist_id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  items?: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  item_id: string;
  checklist_id: string;
  content: string;
  is_completed: boolean;
  order_num: number;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_id: string;
  dependency_type: "blocks" | "blocked_by";
  created_at: string;
}

```

<!-- END FILE: frontend/src/types/index.ts -->

<!-- BEGIN FILE: frontend/src/hooks/useCanvas.ts -->

## FILE: frontend/src/hooks/useCanvas.ts

```ts
import { useCallback, useEffect, useState } from "react";
import type { CanvasItem, CanvasConnection, CanvasWithItems, CanvasTool } from "../types/canvas";
import type { Task } from "../types";
import { getToken } from "./useAuth";

export interface PanPoint {
  x: number;
  y: number;
}

interface UseCanvasReturn {
  canvas: CanvasWithItems | null;
  canvasId: string | null;
  items: CanvasItem[];
  connections: CanvasConnection[];
  selectedItemId: string | null;
  selectedConnectionId: string | null;
  tool: CanvasTool;
  pan: PanPoint;
  zoom: number;
  loading: boolean;
  error: string | null;
  tasks: Task[];
  enteringItemIds: Set<string>;
  deletingItemIds: Set<string>;
  refetchTasks: () => Promise<void>;
  setItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>;
  setConnections: React.Dispatch<React.SetStateAction<CanvasConnection[]>>;
  addItem: (item: Partial<CanvasItem> & { item_type: CanvasItem["item_type"] }) => Promise<CanvasItem | null>;
  updateItem: (itemId: string, updates: Partial<CanvasItem>) => Promise<CanvasItem | null>;
  updateItemLocal: (itemId: string, updates: Partial<CanvasItem>) => void;
  deleteItem: (itemId: string) => Promise<void>;
  addConnection: (fromItemId: string, toItemId: string, connectionType?: "line" | "arrow", style?: string | null) => Promise<CanvasConnection | null>;
  deleteConnection: (connectionId: string) => Promise<void>;
  selectItem: (itemId: string | null) => void;
  selectConnection: (connectionId: string | null) => void;
  setTool: (tool: CanvasTool) => void;
  setPan: (pan: PanPoint) => void;
  setZoom: (zoom: number) => void;
  saveItem: (itemId: string, updates: Partial<CanvasItem>) => Promise<CanvasItem | null>;
  refetch: () => Promise<void>;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function useCanvas(canvasId: string | undefined): UseCanvasReturn {
  const [canvas, setCanvas] = useState<CanvasWithItems | null>(null);
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [connections, setConnections] = useState<CanvasConnection[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [pan, setPan] = useState<PanPoint>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [enteringItemIds, setEnteringItemIds] = useState<Set<string>>(new Set());
  const [deletingItemIds, setDeletingItemIds] = useState<Set<string>>(new Set());

  const fetchTasks = useCallback(async (projectId: string | null) => {
    if (!projectId) {
      setTasks([]);
      return;
    }
    try {
      const res = await fetch(`/api/tasks?project_id=${encodeURIComponent(projectId)}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();
      setTasks((data.tasks as Task[]) || []);
    } catch (e: any) {
      setTasks([]);
    }
  }, []);

  const fetchCanvas = useCallback(async () => {
    if (!canvasId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/canvas/${canvasId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch canvas");
      const data = await res.json();
      const c = data.canvas as CanvasWithItems;
      setCanvas(c);
      setItems(c.items || []);
      setConnections(c.connections || []);
      if (c.project_id) {
        await fetchTasks(c.project_id);
      } else {
        setTasks([]);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to fetch canvas");
    } finally {
      setLoading(false);
    }
  }, [canvasId, fetchTasks]);

  useEffect(() => {
    fetchCanvas();
  }, [fetchCanvas]);

  const addItem = useCallback(
    async (item: Partial<CanvasItem> & { item_type: CanvasItem["item_type"] }) => {
      if (!canvasId) return null;
      try {
        const res = await fetch(`/api/canvas/${canvasId}/items`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(item),
        });
        if (!res.ok) throw new Error("Failed to add item");
        const data = await res.json();
        const created = data.item as CanvasItem;
        setItems((prev) => [...prev, created]);
        setEnteringItemIds((prev) => {
          const next = new Set(prev);
          next.add(created.item_id);
          return next;
        });
        setTimeout(() => {
          setEnteringItemIds((prev) => {
            const next = new Set(prev);
            next.delete(created.item_id);
            return next;
          });
        }, 400);
        return created;
      } catch (e: any) {
        setError(e?.message || "Failed to add item");
        return null;
      }
    },
    [canvasId]
  );

  const updateItemLocal = useCallback((itemId: string, updates: Partial<CanvasItem>) => {
    setItems((prev) => prev.map((it) => (it.item_id === itemId ? { ...it, ...updates } : it)));
  }, []);

  const persistItem = useCallback(
    async (itemId: string, updates: Partial<CanvasItem>) => {
      try {
        const res = await fetch(`/api/canvas/items/${itemId}`, {
          method: "PUT",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Failed to update item");
        const data = await res.json();
        const updated = data.item as CanvasItem;
        setItems((prev) => prev.map((it) => (it.item_id === itemId ? updated : it)));
        return updated;
      } catch (e: any) {
        setError(e?.message || "Failed to update item");
        return null;
      }
    },
    []
  );

  const updateItem = useCallback(
    async (itemId: string, updates: Partial<CanvasItem>) => {
      updateItemLocal(itemId, updates);
      return persistItem(itemId, updates);
    },
    [updateItemLocal, persistItem]
  );

  const saveItem = useCallback(
    async (itemId: string, updates: Partial<CanvasItem>) => {
      return persistItem(itemId, updates);
    },
    [persistItem]
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      setDeletingItemIds((prev) => {
        const next = new Set(prev);
        next.add(itemId);
        return next;
      });
      try {
        const res = await fetch(`/api/canvas/items/${itemId}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error("Failed to delete item");
      } catch (e: any) {
        setDeletingItemIds((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
        setError(e?.message || "Failed to delete item");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 220));
      setItems((prev) => prev.filter((it) => it.item_id !== itemId));
      setConnections((prev) =>
        prev.filter((c) => c.from_item_id !== itemId && c.to_item_id !== itemId)
      );
      if (selectedItemId === itemId) setSelectedItemId(null);
      setDeletingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    },
    [selectedItemId]
  );

  const addConnection = useCallback(
    async (fromItemId: string, toItemId: string, connectionType: "line" | "arrow" = "line", style: string | null = null) => {
      if (!canvasId) return null;
      try {
        const res = await fetch(`/api/canvas/${canvasId}/connections`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ from_item_id: fromItemId, to_item_id: toItemId, connection_type: connectionType, style }),
        });
        if (!res.ok) throw new Error("Failed to add connection");
        const data = await res.json();
        const created = data.connection as CanvasConnection;
        setConnections((prev) => [...prev, created]);
        return created;
      } catch (e: any) {
        setError(e?.message || "Failed to add connection");
        return null;
      }
    },
    [canvasId]
  );

  const deleteConnection = useCallback(async (connectionId: string) => {
    try {
      const res = await fetch(`/api/canvas/connections/${connectionId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete connection");
      setConnections((prev) => prev.filter((c) => c.connection_id !== connectionId));
      if (selectedConnectionId === connectionId) setSelectedConnectionId(null);
    } catch (e: any) {
      setError(e?.message || "Failed to delete connection");
    }
  }, [selectedConnectionId]);

  const selectItem = useCallback((itemId: string | null) => {
    setSelectedItemId(itemId);
    if (itemId !== null) setSelectedConnectionId(null);
  }, []);

  const selectConnection = useCallback((connectionId: string | null) => {
    setSelectedConnectionId(connectionId);
    if (connectionId !== null) setSelectedItemId(null);
  }, []);

  const refetch = useCallback(async () => {
    await fetchCanvas();
  }, [fetchCanvas]);

  const refetchTasks = useCallback(async () => {
    if (canvas?.project_id) await fetchTasks(canvas.project_id);
  }, [canvas?.project_id, fetchTasks]);

  return {
    canvas,
    canvasId: canvasId || null,
    items,
    connections,
    selectedItemId,
    selectedConnectionId,
    tool,
    pan,
    zoom,
    loading,
    error,
    tasks,
    enteringItemIds,
    deletingItemIds,
    setItems,
    setConnections,
    addItem,
    updateItem,
    updateItemLocal,
    deleteItem,
    addConnection,
    deleteConnection,
    selectItem,
    selectConnection,
    setTool,
    setPan,
    setZoom,
    saveItem,
    refetch,
    refetchTasks,
  };
}

```

<!-- END FILE: frontend/src/hooks/useCanvas.ts -->

<!-- BEGIN FILE: frontend/src/components/canvas/CanvasViewport.tsx -->

## FILE: frontend/src/components/canvas/CanvasViewport.tsx

```tsx
import { useEffect, useRef, useState } from "react";
import type { CanvasItem, CanvasConnection, CanvasTool } from "../../types/canvas";
import { CanvasItem as CanvasItemComp } from "./CanvasItem";
import { ConnectionLine } from "./ConnectionLine";

interface CanvasViewportProps {
  items: CanvasItem[];
  connections: CanvasConnection[];
  selectedItemId: string | null;
  selectedConnectionId: string | null;
  tool: CanvasTool;
  pan: { x: number; y: number };
  zoom: number;
  onPanChange: (pan: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onSelectItem: (id: string | null) => void;
  onSelectConnection: (id: string | null) => void;
  onUpdateItemLocal: (id: string, updates: Partial<CanvasItem>) => void;
  onSaveItem: (id: string, updates: Partial<CanvasItem>) => void;
  onDeleteItem?: (id: string) => void;
  onCanvasClick?: (point: { x: number; y: number }) => void;
  enteringItemIds?: Set<string>;
  deletingItemIds?: Set<string>;
  loading?: boolean;
}

const spring = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function CanvasViewport({
  items,
  connections,
  selectedItemId,
  selectedConnectionId,
  tool,
  pan,
  zoom,
  onPanChange,
  onZoomChange,
  onSelectItem,
  onSelectConnection,
  onUpdateItemLocal,
  onSaveItem,
  onDeleteItem,
  onCanvasClick,
  enteringItemIds,
  deletingItemIds,
  loading,
}: CanvasViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const spacePressed = useRef(false);
  const dragMoved = useRef(false);

  const panRef = useRef(pan);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const velocityRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0, t: 0 });
  const momentumRafRef = useRef<number | null>(null);
  const [momentumActive, setMomentumActive] = useState(false);

  const cancelMomentum = () => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
    setMomentumActive(false);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;

      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      spacePressed.current = true;
      e.preventDefault();
    };

    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spacePressed.current = false;
      }
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (momentumRafRef.current !== null) {
        cancelAnimationFrame(momentumRafRef.current);
        momentumRafRef.current = null;
      }
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const middle = e.button === 1;
    const spaceDrag = spacePressed.current && e.button === 0;

    if (middle || spaceDrag) {
      e.preventDefault();
      cancelMomentum();
      setIsPanning(true);
      dragMoved.current = false;

      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        tx: pan.x,
        ty: pan.y,
      };

      lastPointerRef.current = {
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
      };

      velocityRef.current = { x: 0, y: 0 };
    }
  };

  useEffect(() => {
    if (!isPanning) return;

    const onMove = (e: MouseEvent) => {
      dragMoved.current = true;

      const now = performance.now();
      const dt = now - lastPointerRef.current.t;

      if (dt > 0) {
        velocityRef.current = {
          x: ((e.clientX - lastPointerRef.current.x) / dt) * 16,
          y: ((e.clientY - lastPointerRef.current.y) / dt) * 16,
        };
      }

      lastPointerRef.current = {
        x: e.clientX,
        y: e.clientY,
        t: now,
      };

      onPanChange({
        x: panStart.current.tx + (e.clientX - panStart.current.x),
        y: panStart.current.ty + (e.clientY - panStart.current.y),
      });
    };

    const onUp = () => {
      setIsPanning(false);

      const velocity = velocityRef.current;

      if (Math.hypot(velocity.x, velocity.y) > 1.2) {
        setMomentumActive(true);

        let currentPan = { ...panRef.current };
        let velocityX = velocity.x;
        let velocityY = velocity.y;

        const step = () => {
          velocityX *= 0.9;
          velocityY *= 0.9;

          if (Math.abs(velocityX) < 0.05 && Math.abs(velocityY) < 0.05) {
            momentumRafRef.current = null;
            setMomentumActive(false);
            return;
          }

          currentPan = {
            x: currentPan.x + velocityX,
            y: currentPan.y + velocityY,
          };

          onPanChange(currentPan);
          momentumRafRef.current = requestAnimationFrame(step);
        };

        momentumRafRef.current = requestAnimationFrame(step);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isPanning, onPanChange]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    cancelMomentum();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(4, Math.max(0.2, zoom * delta));

    onZoomChange(newZoom);
  };

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMoved.current) return;

    if (tool !== "select" && onCanvasClick) {
      const rect = containerRef.current?.getBoundingClientRect();

      if (rect) {
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;

        onCanvasClick({ x, y });
      }

      return;
    }

    onSelectItem(null);
    onSelectConnection(null);
  };

  const itemMap = new Map(items.map((item) => [item.item_id, item]));

  return (
    <div
      ref={containerRef}
      className="pm-canvas-viewport"
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        backgroundColor: "var(--pm-canvas)",
        backgroundImage:
          "linear-gradient(to right, color-mix(in srgb, var(--pm-text-muted) 15%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--pm-text-muted) 15%, transparent) 1px, transparent 1px)",
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: isPanning
          ? "grabbing"
          : spacePressed.current
            ? "grab"
            : "default",
      }}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      onClick={handleBackgroundClick}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          transition:
            isPanning || momentumActive
              ? "none"
              : `transform 120ms ${spring}`,
        }}
      >
        <svg
          width={4000}
          height={4000}
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <defs>
            <marker
              id="canvas-arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="var(--pm-text-muted)"
              />
            </marker>
          </defs>

          {connections.map((connection) => {
            const fromItem = itemMap.get(connection.from_item_id);
            const toItem = itemMap.get(connection.to_item_id);

            if (!fromItem || !toItem) return null;

            return (
              <g
                key={connection.connection_id}
                style={{ pointerEvents: "auto" }}
              >
                <ConnectionLine
                  connection={connection}
                  fromItem={fromItem}
                  toItem={toItem}
                  selected={
                    selectedConnectionId === connection.connection_id
                  }
                  onClick={onSelectConnection}
                />
              </g>
            );
          })}
        </svg>

        {items.map((item) => (
          <CanvasItemComp
            key={item.item_id}
            item={item}
            selected={selectedItemId === item.item_id}
            zoom={zoom}
            pan={pan}
            tool={tool}
            entering={enteringItemIds?.has(item.item_id)}
            exiting={deletingItemIds?.has(item.item_id)}
            onSelect={onSelectItem}
            onUpdateLocal={onUpdateItemLocal}
            onSave={onSaveItem}
            onDelete={onDeleteItem}
          />
        ))}

        {loading && items.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
            }}
          >
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="canvas-skeleton"
                style={{
                  position: "absolute",
                  left: 80 + index * 150,
                  top: 80 + (index % 2) * 90,
                  width: 120,
                  height: 80,
                  borderRadius: "var(--pm-radius-sm)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className="pm-canvas-zoom-indicator"
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          padding: "4px 8px",
          border: "1px solid var(--pm-border)",
          borderRadius: "var(--pm-radius-sm)",
          color: "var(--pm-text-secondary)",
          background: "var(--pm-glass-strong)",
          boxShadow: "var(--pm-shadow)",
          fontSize: 11,
          fontVariantNumeric: "tabular-nums",
          pointerEvents: "none",
        }}
      >
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

export default CanvasViewport;

```

<!-- END FILE: frontend/src/components/canvas/CanvasViewport.tsx -->

<!-- BEGIN FILE: frontend/src/components/canvas/CanvasItem.tsx -->

## FILE: frontend/src/components/canvas/CanvasItem.tsx

```tsx
import { useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
} from "react";
import type {
  CanvasItem as CanvasItemType,
  CanvasTool,
  CanvasItemStyle,
} from "../../types/canvas";

interface CanvasItemProps {
  item: CanvasItemType;
  selected: boolean;
  zoom: number;
  pan: { x: number; y: number };
  tool: CanvasTool;
  entering?: boolean;
  exiting?: boolean;
  onSelect: (id: string) => void;
  onUpdateLocal: (id: string, updates: Partial<CanvasItemType>) => void;
  onSave: (id: string, updates: Partial<CanvasItemType>) => void;
  onDelete?: (id: string) => void;
}

const spring = "cubic-bezier(0.34, 1.56, 0.64, 1)";

function parseStyle(style: string | null): CanvasItemStyle {
  if (!style) {
    return {};
  }

  try {
    return JSON.parse(style) as CanvasItemStyle;
  } catch {
    return {};
  }
}

function resolveShape(item: CanvasItemType): string {
  const style = parseStyle(item.style);
  return (style.shape as string) || item.item_type;
}

const SHAPE_TYPES = new Set([
  "square",
  "rectangle",
  "circle",
  "diamond",
  "triangle",
]);

export function CanvasItem({
  item,
  selected,
  zoom,
  pan,
  tool,
  entering,
  exiting,
  onSelect,
  onUpdateLocal,
  onSave,
  onDelete,
}: CanvasItemProps) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [hovered, setHovered] = useState(false);

  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({
    w: 0,
    h: 0,
    mx: 0,
    my: 0,
  });
  const moved = useRef(false);

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (tool !== "select") {
      return;
    }

    e.stopPropagation();
    onSelect(item.item_id);
    setDragging(true);
    moved.current = false;

    dragOffset.current = {
      x: (e.clientX - pan.x) / zoom - item.x,
      y: (e.clientY - pan.y) / zoom - item.y,
    };
  };

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const onMove = (e: MouseEvent) => {
      moved.current = true;

      const x = (e.clientX - pan.x) / zoom - dragOffset.current.x;
      const y = (e.clientY - pan.y) / zoom - dragOffset.current.y;

      onUpdateLocal(item.item_id, { x, y });
    };

    const onUp = (e: MouseEvent) => {
      setDragging(false);

      if (moved.current) {
        const x = (e.clientX - pan.x) / zoom - dragOffset.current.x;
        const y = (e.clientY - pan.y) / zoom - dragOffset.current.y;

        onSave(item.item_id, { x, y });
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    dragging,
    item.item_id,
    pan.x,
    pan.y,
    zoom,
    onUpdateLocal,
    onSave,
  ]);

  const handleResizeMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (tool !== "select") {
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    moved.current = false;

    resizeStart.current = {
      w: item.width,
      h: item.height,
      mx: e.clientX,
      my: e.clientY,
    };
  };

  useEffect(() => {
    if (!resizing) {
      return;
    }

    const onMove = (e: MouseEvent) => {
      moved.current = true;

      const dw = (e.clientX - resizeStart.current.mx) / zoom;
      const dh = (e.clientY - resizeStart.current.my) / zoom;
      const width = Math.max(20, resizeStart.current.w + dw);
      const height = Math.max(20, resizeStart.current.h + dh);

      onUpdateLocal(item.item_id, { width, height });
    };

    const onUp = (e: MouseEvent) => {
      setResizing(false);

      if (moved.current) {
        const dw = (e.clientX - resizeStart.current.mx) / zoom;
        const dh = (e.clientY - resizeStart.current.my) / zoom;
        const width = Math.max(20, resizeStart.current.w + dw);
        const height = Math.max(20, resizeStart.current.h + dh);

        onSave(item.item_id, { width, height });
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, item.item_id, zoom, onUpdateLocal, onSave]);

  const scale = dragging ? 1.05 : exiting ? 0.85 : selected ? 1.02 : 1;
  const translateY = hovered && !dragging && !exiting ? -2 : 0;

  let boxShadow: string | undefined;

  if (dragging) {
    boxShadow = "var(--pm-shadow-float)";
  } else if (hovered && !exiting) {
    boxShadow = "var(--pm-shadow)";
  }

  const baseStyle: CSSProperties = {
    position: "absolute",
    left: item.x,
    top: item.y,
    width: item.width,
    height: item.height,
    transform: `translateY(${translateY}px) rotate(${item.rotation}deg) scale(${scale})`,
    transition:
      dragging || resizing
        ? "none"
        : `transform 200ms ${spring}, box-shadow 200ms ${spring}, border-color 200ms ${spring}`,
    zIndex: item.z_index || 1,
    boxShadow,
    pointerEvents: exiting ? "none" : undefined,
    userSelect: "none",
    cursor: tool === "select" ? (dragging ? "grabbing" : "grab") : "default",
  };

  const renderContent = () => {
    const type = item.item_type;
    const style = parseStyle(item.style);

    if (SHAPE_TYPES.has(type) || SHAPE_TYPES.has(resolveShape(item))) {
      const shape = resolveShape(item);
      const fill = style.fill ?? "var(--pm-glass-soft, #cbd5e1)";
      const stroke = style.stroke ?? "var(--pm-border-strong, #475569)";
      const strokeWidth = style.strokeWidth ?? 2;
      const opacity = style.opacity ?? 1;
      const radius = style.borderRadius ?? 8;

      let clipPath: string | undefined;

      if (shape === "diamond") {
        clipPath = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
      }

      if (shape === "triangle") {
        clipPath = "polygon(50% 0%, 100% 100%, 0% 100%)";
      }

      const borderRadius =
        shape === "circle"
          ? "50%"
          : shape === "diamond" || shape === "triangle"
            ? "0px"
            : `${radius}px`;

      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            boxSizing: "border-box",
            backgroundColor: fill,
            border: `${strokeWidth}px solid ${stroke}`,
            opacity,
            borderRadius,
            clipPath,
          }}
        >
          {item.content ? (
            <span
              style={{
                padding: "0 0.25rem",
                color: "var(--pm-text)",
                fontSize: "0.75rem",
                textAlign: "center",
                overflowWrap: "anywhere",
              }}
            >
              {item.content}
            </span>
          ) : null}
        </div>
      );
    }

    if (type === "text") {
      const color = style.textColor || style.color || "var(--pm-text)";
      const fontSize = style.fontSize || 14;
      const fontWeight = style.fontWeight || "normal";
      const textAlign = (style.textAlign || "center") as
        | "left"
        | "right"
        | "center"
        | "justify";
      const opacity = style.opacity ?? 1;

      const justify =
        textAlign === "left"
          ? "flex-start"
          : textAlign === "right"
            ? "flex-end"
            : "center";

      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            whiteSpace: "pre-wrap",
            padding: "0.5rem",
            boxSizing: "border-box",
            color,
            fontSize,
            fontWeight,
            opacity,
            justifyContent: justify,
            textAlign,
          }}
        >
          {item.content || "Text"}
        </div>
      );
    }

    if (type === "task") {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            padding: "0.5rem",
            overflow: "hidden",
            border: "1px solid var(--pm-accent)",
            borderRadius: "var(--pm-radius-sm)",
            background: "var(--pm-accent-soft)",
            color: "var(--pm-text)",
          }}
        >
          <div
            style={{
              color: "var(--pm-accent)",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            Task
          </div>

          <div
            style={{
              overflow: "hidden",
              color: "var(--pm-text)",
              fontSize: "0.875rem",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.content || "Untitled task"}
          </div>
        </div>
      );
    }

    if (type === "line" || type === "arrow") {
      const stroke =
        style.stroke ?? "var(--pm-border-strong, #475569)";
      const strokeWidth = style.strokeWidth ?? 2;
      const opacity = style.opacity ?? 1;

      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            opacity,
          }}
        >
          <div
            style={{
              width: "100%",
              borderTop: `${strokeWidth}px solid ${stroke}`,
            }}
          />
        </div>
      );
    }

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          border: "1px solid var(--pm-border)",
          borderRadius: "var(--pm-radius-sm)",
          background: "var(--pm-glass-soft)",
        }}
      />
    );
  };

  const itemClasses = [
    "canvas-item",
    selected ? "canvas-item-selected" : "",
    entering ? "canvas-item-enter" : "",
    exiting ? "canvas-item-exit" : "",
    dragging ? "canvas-item-dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const resizeHandleStyle: CSSProperties = {
    position: "absolute",
    width: "12px",
    height: "12px",
    border: "1px solid var(--pm-glass)",
    borderRadius: "2px",
    background: "var(--pm-accent)",
    boxSizing: "border-box",
  };

  return (
    <div
      style={baseStyle}
      className={itemClasses}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="canvas-item-inner">{renderContent()}</div>

      {selected && tool === "select" && (
        <>
          <div
            style={{
              ...resizeHandleStyle,
              right: "-6px",
              bottom: "-6px",
              cursor: "se-resize",
            }}
            onMouseDown={handleResizeMouseDown}
          />

          <div
            style={{
              ...resizeHandleStyle,
              top: "-6px",
              left: "-6px",
            }}
          />

          <div
            style={{
              ...resizeHandleStyle,
              top: "-6px",
              right: "-6px",
            }}
          />

          <div
            style={{
              ...resizeHandleStyle,
              bottom: "-6px",
              left: "-6px",
            }}
          />
        </>
      )}

      {selected && onDelete && (
        <button
          type="button"
          className="pm-button pm-button-secondary"
          style={{
            position: "absolute",
            top: "-1.5rem",
            right: 0,
            padding: "0.125rem 0.5rem",
            borderColor: "var(--pm-border)",
            background: "var(--pm-glass)",
            color: "var(--pm-danger)",
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.item_id);
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
}

export default CanvasItem;

```

<!-- END FILE: frontend/src/components/canvas/CanvasItem.tsx -->

<!-- BEGIN FILE: frontend/src/components/canvas/CanvasToolbar.tsx -->

## FILE: frontend/src/components/canvas/CanvasToolbar.tsx

```tsx
import type { CanvasTool } from "../../types/canvas";

interface CanvasToolbarProps {
  tool: CanvasTool;
  setTool: (tool: CanvasTool) => void;
}

const tools: { id: CanvasTool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "\u2196" },
  { id: "square", label: "Square", icon: "\u25A1" },
  { id: "line", label: "Line/Arrow", icon: "\u2192" },
  { id: "text", label: "Text", icon: "T" },
  { id: "task", label: "Task", icon: "\u2713" },
];

const spring = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function CanvasToolbar({ tool, setTool }: CanvasToolbarProps) {
  return (
    <div
      className="pm-glass-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "8px",
        borderRadius: 0,
        borderRight: "1px solid var(--pm-border)",
        borderTop: "none",
        borderBottom: "none",
        borderLeft: "none",
        flexShrink: 0,
      }}
    >
      {tools.map((t) => {
        const active = tool === t.id;
        return (
          <button
            key={t.id}
            title={t.label}
            onClick={() => setTool(t.id)}
            className={active ? "pm-button pm-button-primary" : "pm-button pm-button-quiet"}
            style={{
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              transitionTimingFunction: spring,
              padding: 0,
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                transition: `transform 200ms ${spring}`,
                transform: active
                  ? "rotate(8deg) scale(1.15)"
                  : "rotate(0deg) scale(1)",
              }}
            >
              {t.icon}
            </span>
          </button>
        );
      })}
      <div
        style={{
          fontSize: "9px",
          textAlign: "center",
          color: "var(--pm-text-muted)",
          marginTop: "4px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {tool}
      </div>
    </div>
  );
}

export default CanvasToolbar;

```

<!-- END FILE: frontend/src/components/canvas/CanvasToolbar.tsx -->

<!-- BEGIN FILE: frontend/src/components/canvas/ShapeSelector.tsx -->

## FILE: frontend/src/components/canvas/ShapeSelector.tsx

```tsx
import { useId, useMemo } from "react";

export type ShapeType =
  | "square"
  | "rectangle"
  | "circle"
  | "diamond"
  | "triangle";

interface ShapeSelectorProps {
  value: ShapeType | string;
  onChange: (shape: ShapeType) => void;
  className?: string;
  label?: string;
}

const SHAPES: { id: ShapeType; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rectangle", label: "Rectangle" },
  { id: "circle", label: "Circle" },
  { id: "diamond", label: "Diamond" },
  { id: "triangle", label: "Triangle" },
];

export function ShapeSelector({
  value,
  onChange,
  className,
  label = "Shape",
}: ShapeSelectorProps) {
  const selectId = useId();

  const current = useMemo(() => {
    const found = SHAPES.find((shape) => shape.id === value);
    return found ? found.id : "square";
  }, [value]);

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={selectId}
          style={{
            display: "block",
            marginBottom: 4,
            color: "var(--pm-text-muted)",
            fontSize: 11,
          }}
        >
          {label}
        </label>
      )}

      <select
        id={selectId}
        value={current}
        onChange={(event) => {
          const selectedShape = SHAPES.find(
            (shape) => shape.id === event.target.value,
          );

          if (selectedShape) {
            onChange(selectedShape.id);
          }
        }}
        className="pm-field"
        style={{
          width: "100%",
          minHeight: 32,
          padding: "5px 8px",
          border: "1px solid var(--pm-border)",
          borderRadius: "var(--pm-radius-sm)",
          background: "var(--pm-glass-strong)",
          color: "var(--pm-text)",
          fontSize: 12,
          fontFamily: "inherit",
        }}
      >
        {SHAPES.map((shape) => (
          <option key={shape.id} value={shape.id}>
            {shape.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ShapeSelector;

```

<!-- END FILE: frontend/src/components/canvas/ShapeSelector.tsx -->

<!-- BEGIN FILE: frontend/src/components/canvas/PropertiesPanel.tsx -->

## FILE: frontend/src/components/canvas/PropertiesPanel.tsx

```tsx
import { useMemo } from "react";
import type { CanvasItem, CanvasItemStyle } from "../../types/canvas";
import { ShapeSelector, type ShapeType } from "./ShapeSelector";

interface PropertiesPanelProps {
  item: CanvasItem | null;
  items?: CanvasItem[];
  onUpdateLocal: (id: string, updates: Partial<CanvasItem>) => void;
  onSave: (
    id: string,
    updates: Partial<CanvasItem>,
  ) => void | Promise<CanvasItem | null | void>;
  onDelete?: (id: string) => void;
  onAddConnection?: (
    fromId: string,
    toId: string,
    type?: "line" | "arrow",
  ) => void;
}

type CanvasTextAlign = "left" | "center" | "right";

interface StylePreset {
  name: string;
  fill: string;
  stroke: string;
}

const PRESETS: StylePreset[] = [
  {
    name: "Accent",
    fill: "var(--pm-accent)",
    stroke: "color-mix(in srgb, var(--pm-accent) 72%, black)",
  },
  {
    name: "Success",
    fill: "var(--pm-success)",
    stroke: "color-mix(in srgb, var(--pm-success) 72%, black)",
  },
  {
    name: "Warning",
    fill: "var(--pm-warning)",
    stroke: "color-mix(in srgb, var(--pm-warning) 72%, black)",
  },
  {
    name: "Danger",
    fill: "var(--pm-danger)",
    stroke: "color-mix(in srgb, var(--pm-danger) 72%, black)",
  },
];

const FIELD_STYLE: React.CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
  padding: "6px 8px",
  border: "1px solid var(--pm-border)",
  borderRadius: "var(--pm-radius-sm)",
  background: "var(--pm-glass-strong)",
  color: "var(--pm-text)",
  fontSize: 12,
  fontFamily: "inherit",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  marginBottom: 4,
  color: "var(--pm-text-muted)",
  fontSize: 10,
};

const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  marginBottom: 2,
  color: "var(--pm-text-secondary)",
  fontSize: 10,
  fontWeight: 600,
};

function parseStyle(style: string | null): CanvasItemStyle {
  if (!style) return {};

  try {
    return JSON.parse(style) as CanvasItemStyle;
  } catch {
    return {};
  }
}

function getColorInputValue(value: string | undefined, fallback: string): string {
  if (value && /^#[0-9a-fA-F]{6}$/.test(value)) {
    return value;
  }

  return fallback;
}

type CanvasShapeItemType = Extract<CanvasItem["item_type"], ShapeType>;

function isCanvasShapeItemType(
  value: string,
): value is CanvasShapeItemType {
  return (
    value === "square" ||
    value === "rectangle" ||
    value === "circle" ||
    value === "diamond" ||
    value === "triangle"
  );
}

export function PropertiesPanel({
  item,
  items,
  onUpdateLocal,
  onSave,
  onDelete,
  onAddConnection,
}: PropertiesPanelProps) {
  const style = useMemo(
    () => parseStyle(item?.style ?? null),
    [item?.style],
  );

  if (!item) {
    return (
      <div
        style={{
          color: "var(--pm-text-muted)",
          fontSize: 12,
        }}
      >
        Select an item to edit properties.
      </div>
    );
  }

  const updateStyle = (patch: Partial<CanvasItemStyle>) => {
    const current = parseStyle(item.style);
    const next = { ...current, ...patch };
    const styleStr = JSON.stringify(next);

    onUpdateLocal(item.item_id, { style: styleStr });
    onSave(item.item_id, { style: styleStr });
  };

  const handleShapeChange = (shape: ShapeType) => {
    const current = parseStyle(item.style);
    const next = { ...current, shape };
    const styleStr = JSON.stringify(next);

    // ShapeSelector only emits values in the supported shape union.
    if (!isCanvasShapeItemType(shape)) return;

    const updates: Partial<CanvasItem> = {
      item_type: shape,
      style: styleStr,
    };

    onUpdateLocal(item.item_id, updates);
    onSave(item.item_id, updates);
  };

  const isText = item.item_type === "text";

  const updateNumber = (
    field: "x" | "y" | "width" | "height",
    value: string,
  ) => {
    onUpdateLocal(item.item_id, { [field]: Number(value) });
  };

  const saveNumber = (
    field: "x" | "y" | "width" | "height",
    value: string,
  ) => {
    onSave(item.item_id, { [field]: Number(value) });
  };

  return (
    <div
      className="pm-properties-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minWidth: 0,
        color: "var(--pm-text)",
      }}
    >
      <section>
        <label style={LABEL_STYLE}>Type</label>
        <div
          style={{
            color: "var(--pm-text)",
            fontSize: 12,
            textTransform: "capitalize",
          }}
        >
          {item.item_type}
        </div>
      </section>

      <ShapeSelector
        value={style.shape || item.item_type}
        onChange={handleShapeChange}
      />

      <section>
        <label style={LABEL_STYLE}>Content</label>
        <textarea
          className="pm-field"
          style={{
            ...FIELD_STYLE,
            resize: "vertical",
          }}
          value={item.content || ""}
          onChange={(event) =>
            onUpdateLocal(item.item_id, { content: event.target.value })
          }
          onBlur={(event) =>
            onSave(item.item_id, { content: event.target.value })
          }
          rows={3}
        />
      </section>

      <section style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Style presets</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="pm-button"
              title={preset.name}
              aria-label={`${preset.name} style preset`}
              onClick={() => {
                const current = parseStyle(item.style);
                const next: Partial<CanvasItemStyle> = {
                  fill: preset.fill,
                  stroke: preset.stroke,
                };

                if (isText) {
                  next.textColor = preset.fill;
                }

                const styleStr = JSON.stringify({
                  ...current,
                  ...next,
                });

                onUpdateLocal(item.item_id, { style: styleStr });
                onSave(item.item_id, { style: styleStr });
              }}
              style={{
                minWidth: 0,
                height: 32,
                padding: 4,
                border: "1px solid var(--pm-border)",
                borderRadius: "var(--pm-radius-sm)",
                color: "var(--pm-accent-ink)",
                background: preset.fill,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {preset.name[0]}
            </button>
          ))}
        </div>
      </section>

      <section style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Fill &amp; Stroke</div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <label
            style={{
              color: "var(--pm-text-muted)",
              width: 64,
              flexShrink: 0,
              fontSize: 10,
            }}
          >
            Fill
          </label>

          <input
            type="color"
            aria-label="Fill color picker"
            value={getColorInputValue(style.fill, "#cbd5e1")}
            onChange={(event) => updateStyle({ fill: event.target.value })}
            style={{
              width: 40,
              height: 32,
              padding: 2,
              border: "1px solid var(--pm-border)",
              borderRadius: "var(--pm-radius-sm)",
              background: "var(--pm-glass-strong)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          />

          <input
            type="text"
            aria-label="Fill color value"
            value={style.fill || ""}
            onChange={(event) => updateStyle({ fill: event.target.value })}
            className="pm-field"
            style={{
              ...FIELD_STYLE,
              flex: 1,
              padding: "4px 8px",
              fontSize: 11,
            }}
            placeholder="#cbd5e1"
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <label
            style={{
              color: "var(--pm-text-muted)",
              width: 64,
              flexShrink: 0,
              fontSize: 10,
            }}
          >
            Stroke
          </label>

          <input
            type="color"
            aria-label="Stroke color picker"
            value={getColorInputValue(style.stroke, "#475569")}
            onChange={(event) => updateStyle({ stroke: event.target.value })}
            style={{
              width: 40,
              height: 32,
              padding: 2,
              border: "1px solid var(--pm-border)",
              borderRadius: "var(--pm-radius-sm)",
              background: "var(--pm-glass-strong)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          />

          <input
            type="text"
            aria-label="Stroke color value"
            value={style.stroke || ""}
            onChange={(event) => updateStyle({ stroke: event.target.value })}
            className="pm-field"
            style={{
              ...FIELD_STYLE,
              flex: 1,
              padding: "4px 8px",
              fontSize: 11,
            }}
            placeholder="#475569"
          />
        </div>

        <div>
          <label style={LABEL_STYLE}>
            Stroke width: {style.strokeWidth ?? 2}px
          </label>

          <input
            type="range"
            min={0}
            max={12}
            step={1}
            value={style.strokeWidth ?? 2}
            onChange={(event) =>
              updateStyle({ strokeWidth: Number(event.target.value) })
            }
            style={{
              width: "100%",
              accentColor: "var(--pm-accent)",
            }}
          />
        </div>

        <div>
          <label style={LABEL_STYLE}>
            Opacity: {Math.round((style.opacity ?? 1) * 100)}%
          </label>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={style.opacity ?? 1}
            onChange={(event) =>
              updateStyle({ opacity: Number(event.target.value) })
            }
            style={{
              width: "100%",
              accentColor: "var(--pm-accent)",
            }}
          />
        </div>

        <div>
          <label style={LABEL_STYLE}>Border radius</label>

          <input
            type="number"
            value={style.borderRadius ?? 8}
            onChange={(event) =>
              updateStyle({ borderRadius: Number(event.target.value) })
            }
            className="pm-field"
            style={FIELD_STYLE}
          />
        </div>
      </section>

      <section style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Text formatting</div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <label
            style={{
              color: "var(--pm-text-muted)",
              width: 64,
              flexShrink: 0,
              fontSize: 10,
            }}
          >
            Color
          </label>

          <input
            type="color"
            aria-label="Text color picker"
            value={getColorInputValue(
              style.textColor || style.color,
              "#1e293b",
            )}
            onChange={(event) =>
              updateStyle({
                textColor: event.target.value,
                color: event.target.value,
              })
            }
            style={{
              width: 40,
              height: 32,
              padding: 2,
              border: "1px solid var(--pm-border)",
              borderRadius: "var(--pm-radius-sm)",
              background: "var(--pm-glass-strong)",
              cursor: "pointer",
            }}
          />
        </div>

        <div>
          <label style={LABEL_STYLE}>Font size</label>

          <input
            type="number"
            value={style.fontSize ?? 14}
            onChange={(event) =>
              updateStyle({ fontSize: Number(event.target.value) })
            }
            className="pm-field"
            style={FIELD_STYLE}
          />
        </div>

        <div>
          <label style={LABEL_STYLE}>Font weight</label>

          <select
            value={style.fontWeight || "normal"}
            onChange={(event) =>
              updateStyle({ fontWeight: event.target.value })
            }
            className="pm-field"
            style={FIELD_STYLE}
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </div>

        <div>
          <label style={LABEL_STYLE}>Text align</label>

          <select
            value={style.textAlign || "center"}
            onChange={(event) =>
              updateStyle({
                textAlign: event.target.value as CanvasTextAlign,
              })
            }
            className="pm-field"
            style={FIELD_STYLE}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        <div>
          <label style={LABEL_STYLE}>X</label>
          <input
            type="number"
            className="pm-field"
            style={FIELD_STYLE}
            value={Math.round(item.x)}
            onChange={(event) => updateNumber("x", event.target.value)}
            onBlur={(event) => saveNumber("x", event.target.value)}
          />
        </div>

        <div>
          <label style={LABEL_STYLE}>Y</label>
          <input
            type="number"
            className="pm-field"
            style={FIELD_STYLE}
            value={Math.round(item.y)}
            onChange={(event) => updateNumber("y", event.target.value)}
            onBlur={(event) => saveNumber("y", event.target.value)}
          />
        </div>

        <div>
          <label style={LABEL_STYLE}>W</label>
          <input
            type="number"
            className="pm-field"
            style={FIELD_STYLE}
            value={Math.round(item.width)}
            onChange={(event) => updateNumber("width", event.target.value)}
            onBlur={(event) => saveNumber("width", event.target.value)}
          />
        </div>

        <div>
          <label style={LABEL_STYLE}>H</label>
          <input
            type="number"
            className="pm-field"
            style={FIELD_STYLE}
            value={Math.round(item.height)}
            onChange={(event) => updateNumber("height", event.target.value)}
            onBlur={(event) => saveNumber("height", event.target.value)}
          />
        </div>
      </section>

      {onAddConnection && items && items.length > 1 && (
        <button
          type="button"
          className="pm-button pm-button-quiet"
          style={{ width: "100%" }}
          onClick={() => {
            const target = items.find(
              (candidate) => candidate.item_id !== item.item_id,
            );

            if (target) {
              onAddConnection(item.item_id, target.item_id, "arrow");
            }
          }}
        >
          Connect to first other item
        </button>
      )}

      {onDelete && (
        <button
          type="button"
          className="pm-button"
          style={{
            width: "100%",
            borderColor: "var(--pm-danger)",
            color: "var(--pm-danger)",
            background: "var(--pm-glass-soft)",
          }}
          onClick={() => onDelete(item.item_id)}
        >
          Delete Item
        </button>
      )}
    </div>
  );
}

export default PropertiesPanel;

```

<!-- END FILE: frontend/src/components/canvas/PropertiesPanel.tsx -->

<!-- BEGIN FILE: frontend/src/components/canvas/ConnectionLine.tsx -->

## FILE: frontend/src/components/canvas/ConnectionLine.tsx

```tsx
import type { CanvasConnection, CanvasItem } from "../../types/canvas";

interface ConnectionLineProps {
  connection: CanvasConnection;
  fromItem: CanvasItem;
  toItem: CanvasItem;
  selected?: boolean;
  onClick?: (connectionId: string) => void;
}

function center(item: CanvasItem) {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
}

const spring = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function ConnectionLine({ connection, fromItem, toItem, selected, onClick }: ConnectionLineProps) {
  const from = center(fromItem);
  const to = center(toItem);
  const arrow = connection.connection_type === "arrow";

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(connection.connection_id);
      }}
      style={{ cursor: "pointer" }}
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={selected ? "#3b82f6" : "#64748b"}
        strokeWidth={selected ? 2.5 : 2}
        markerEnd={arrow ? "url(#canvas-arrowhead)" : undefined}
        className="transition-all duration-200"
        style={{
          strokeDasharray: length,
          strokeDashoffset: 0,
          ["--dash-len" as any]: length,
          animation: `canvas-draw-line 0.6s ${spring} both`,
          transitionTimingFunction: spring,
        }}
      />
    </g>
  );
}

export default ConnectionLine;

```

<!-- END FILE: frontend/src/components/canvas/ConnectionLine.tsx -->

<!-- BEGIN FILE: frontend/src/components/canvas/TaskPicker.tsx -->

## FILE: frontend/src/components/canvas/TaskPicker.tsx

```tsx
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Task } from "../../types";

interface TaskPickerProps {
  tasks: Task[];
  value?: string | null;
  onChange: (taskId: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function TaskPicker({
  tasks,
  value = null,
  onChange,
  placeholder = "Select a task...",
  className = "",
}: TaskPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = tasks.filter((task) => {
    const normalizedQuery = query.toLowerCase();

    return (
      task.title.toLowerCase().includes(normalizedQuery) ||
      (task.description || "").toLowerCase().includes(normalizedQuery)
    );
  });

  const selected = tasks.find((task) => task.task_id === value) || null;

  const triggerStyle: CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    padding: "0.625rem 0.75rem",
    border: "1px solid var(--pm-border)",
    borderRadius: "var(--pm-radius-sm)",
    background: "var(--pm-glass)",
    color: "var(--pm-text)",
    fontSize: "0.875rem",
    textAlign: "left",
    cursor: "pointer",
  };

  const dropdownStyle: CSSProperties = {
    position: "absolute",
    zIndex: 50,
    top: "calc(100% + 0.25rem)",
    left: 0,
    width: "100%",
    maxHeight: "16rem",
    overflowY: "auto",
    border: "1px solid var(--pm-border)",
    borderRadius: "var(--pm-radius-sm)",
    background: "var(--pm-glass-strong, var(--pm-glass))",
    boxShadow: "var(--pm-shadow-float)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  };

  const searchInputStyle: CSSProperties = {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "0.5rem 0.625rem",
    border: "1px solid var(--pm-border)",
    borderRadius: "var(--pm-radius-sm)",
    background: "var(--pm-glass-soft)",
    color: "var(--pm-text)",
    fontSize: "0.875rem",
    outlineColor: "var(--pm-accent)",
  };

  const optionStyle: CSSProperties = {
    width: "100%",
    display: "block",
    padding: "0.625rem 0.75rem",
    border: 0,
    borderRadius: "var(--pm-radius-sm)",
    background: "transparent",
    color: "var(--pm-text)",
    textAlign: "left",
    cursor: "pointer",
  };

  return (
    <div
      ref={containerRef}
      className={`pm-task-picker ${className}`.trim()}
      style={{ position: "relative", width: "100%" }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="pm-button pm-button-secondary"
        style={triggerStyle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
      >
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selected ? selected.title : placeholder}
        </span>

        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: "var(--pm-text-muted)",
          }}
        >
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="pm-glass-panel" style={dropdownStyle}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              padding: "0.5rem",
              borderBottom: "1px solid var(--pm-border)",
              background: "var(--pm-glass-strong, var(--pm-glass))",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
          >
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks..."
              aria-label="Search tasks"
              style={searchInputStyle}
            />
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label="Available tasks"
            style={{
              margin: 0,
              padding: "0.25rem",
              listStyle: "none",
            }}
          >
            {filtered.length === 0 && (
              <li
                style={{
                  padding: "0.625rem 0.75rem",
                  color: "var(--pm-text-muted)",
                  fontSize: "0.875rem",
                }}
              >
                No tasks found
              </li>
            )}

            {filtered.map((task) => {
              const isSelected = value === task.task_id;

              return (
                <li key={task.task_id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className="pm-task-picker-option"
                    style={{
                      ...optionStyle,
                      background: isSelected
                        ? "var(--pm-accent-soft)"
                        : "transparent",
                      color: isSelected
                        ? "var(--pm-accent)"
                        : "var(--pm-text)",
                    }}
                    onClick={() => {
                      onChange(task.task_id);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                      }}
                    >
                      {task.title}
                    </div>

                    <div
                      style={{
                        marginTop: "0.125rem",
                        color: "var(--pm-text-muted)",
                        fontSize: "0.75rem",
                      }}
                    >
                      {task.status} · {task.priority}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {value && (
            <div
              style={{
                padding: "0.5rem",
                borderTop: "1px solid var(--pm-border)",
              }}
            >
              <button
                type="button"
                className="pm-button pm-button-secondary"
                style={{
                  width: "100%",
                  padding: "0.375rem 0.75rem",
                  border: 0,
                  background: "transparent",
                  color: "var(--pm-danger)",
                  textAlign: "left",
                  fontSize: "0.75rem",
                }}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setQuery("");
                }}
              >
                Unlink task
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskPicker;

```

<!-- END FILE: frontend/src/components/canvas/TaskPicker.tsx -->

<!-- BEGIN FILE: frontend/src/components/canvas/TaskCard.tsx -->

## FILE: frontend/src/components/canvas/TaskCard.tsx

```tsx
import { useEffect, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { getToken } from "../../hooks/useAuth";
import type { Task } from "../../types";
import type { CanvasItem as CanvasItemType } from "../../types/canvas";

interface TaskCardProps {
  item: CanvasItemType;
  task?: Task | null;
  selected?: boolean;
  onClick?: () => void;
}

const statusStyles: Record<string, CSSProperties> = {
  todo: {
    background: "var(--pm-glass-soft)",
    color: "var(--pm-text-secondary)",
    border: "1px solid var(--pm-border)",
  },
  in_progress: {
    background: "var(--pm-accent-soft)",
    color: "var(--pm-accent)",
    border: "1px solid var(--pm-border)",
  },
  done: {
    background: "var(--pm-success)",
    color: "var(--pm-text)",
    border: "1px solid var(--pm-border)",
  },
  blocked: {
    background: "var(--pm-danger)",
    color: "var(--pm-text)",
    border: "1px solid var(--pm-border)",
  },
};

const priorityStyles: Record<string, CSSProperties> = {
  low: {
    background: "var(--pm-glass-soft)",
    color: "var(--pm-text-secondary)",
    border: "1px solid var(--pm-border)",
  },
  normal: {
    background: "var(--pm-accent-soft)",
    color: "var(--pm-accent)",
    border: "1px solid var(--pm-border)",
  },
  high: {
    background: "var(--pm-warning)",
    color: "var(--pm-text)",
    border: "1px solid var(--pm-border)",
  },
  urgent: {
    background: "var(--pm-danger)",
    color: "var(--pm-text)",
    border: "1px solid var(--pm-border)",
  },
};

export function TaskCard({
  item,
  task: taskProp,
  selected = false,
  onClick,
}: TaskCardProps) {
  const [task, setTask] = useState<Task | null>(taskProp ?? null);
  const [loading, setLoading] = useState(!taskProp && !!item.task_id);

  useEffect(() => {
    setTask(taskProp ?? null);

    if (taskProp) {
      setLoading(false);
      return;
    }

    if (!item.task_id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/tasks/${item.task_id}`, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });

        if (res.ok) {
          const data = (await res.json()) as { task?: Task };

          if (!cancelled && data.task) {
            setTask(data.task);
          }
        }
      } catch {
        // Ignore fetch errors; the canvas item content remains available.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item.task_id, taskProp]);

  const title = task?.title || item.content || "Untitled task";
  const status = task?.status || "todo";
  const priority = task?.priority || "normal";

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    onClick();
  };

  const cardStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
    padding: "0.5rem",
    overflow: "hidden",
    border: `1px solid ${
      selected ? "var(--pm-accent)" : "var(--pm-border)"
    }`,
    borderRadius: "var(--pm-radius-sm)",
    background: "var(--pm-accent-soft)",
    color: "var(--pm-text)",
    outline: selected ? "2px solid var(--pm-accent)" : "none",
    outlineOffset: "1px",
    cursor: onClick ? "pointer" : "default",
  };

  const badgeBaseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    maxWidth: "100%",
    padding: "0.125rem 0.375rem",
    borderRadius: "999px",
    fontSize: "0.625rem",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  return (
    <div
      className="pm-glass-panel pm-task-card"
      style={cardStyle}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.25rem",
          minWidth: 0,
        }}
      >
        <div
          style={{
            minWidth: 0,
            overflow: "hidden",
            color: "var(--pm-accent)",
            fontSize: "0.75rem",
            fontWeight: 700,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Task
        </div>

        {loading && (
          <div
            aria-label="Loading task"
            style={{
              flexShrink: 0,
              color: "var(--pm-text-muted)",
              fontSize: "0.625rem",
            }}
          >
            …
          </div>
        )}
      </div>

      <div
        style={{
          overflow: "hidden",
          color: "var(--pm-text)",
          fontSize: "0.875rem",
          fontWeight: 600,
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.25rem",
          minWidth: 0,
        }}
      >
        <span
          style={{
            ...badgeBaseStyle,
            ...(statusStyles[status] ?? statusStyles.todo),
          }}
        >
          {status}
        </span>

        <span
          style={{
            ...badgeBaseStyle,
            ...(priorityStyles[priority] ?? priorityStyles.normal),
          }}
        >
          {priority}
        </span>
      </div>
    </div>
  );
}

export default TaskCard;

```

<!-- END FILE: frontend/src/components/canvas/TaskCard.tsx -->

<!-- BEGIN FILE: frontend/src/pages/Canvas.tsx -->

## FILE: frontend/src/pages/Canvas.tsx

```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth, getToken } from "../hooks/useAuth";
import { useCanvas } from "../hooks/useCanvas";
import { CanvasToolbar } from "../components/canvas/CanvasToolbar";
import { CanvasViewport } from "../components/canvas/CanvasViewport";
import { PropertiesPanel } from "../components/canvas/PropertiesPanel";
import { TaskPicker } from "../components/canvas/TaskPicker";
import type { CanvasItem } from "../types/canvas";
import { Icon } from "../components/layout/Icon";

export default function CanvasPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const projectId = searchParams.get("project_id");

  const [creating, setCreating] = useState(false);
  const [taskToPlaceId, setTaskToPlaceId] = useState<string | null>(null);
  const canvasId = id;

  const {
    canvas,
    items,
    connections,
    selectedItemId,
    selectedConnectionId,
    tool,
    pan,
    zoom,
    loading,
    error,
    addItem,
    updateItemLocal,
    saveItem,
    tasks,
    enteringItemIds,
    deletingItemIds,
    deleteItem,
    selectItem,
    selectConnection,
    setTool,
    setPan,
    setZoom,
    addConnection,
  } = useCanvas(canvasId);

  // Create a canvas if none exists (no id provided)
  useEffect(() => {
    if (id) return;
    if (creating) return;
    setCreating(true);
    const run = async () => {
      try {
        const res = await fetch("/api/canvas", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            project_id: projectId,
            name: "Untitled Canvas",
            description: null,
          }),
        });
        if (!res.ok) throw new Error("Failed to create canvas");
        const data = await res.json();
        navigate(`/canvas/${data.canvas.canvas_id}`, { replace: true });
      } catch (e) {
        console.error(e);
        setCreating(false);
      }
    };
    run();
  }, [id, creating, projectId, navigate]);

  const handleCanvasClick = async (point: { x: number; y: number }) => {
    if (tool === "select") return;
    if (tool === "square") {
      await addItem({
        item_type: "square",
        x: point.x,
        y: point.y,
        width: 120,
        height: 120,
      });
    } else if (tool === "text") {
      await addItem({
        item_type: "text",
        x: point.x,
        y: point.y,
        width: 160,
        height: 40,
        content: "Text",
      });
    } else if (tool === "task") {
      const task =
        tasks?.find((t) => t.task_id === taskToPlaceId) || null;
      await addItem({
        item_type: "task",
        x: point.x,
        y: point.y,
        width: 160,
        height: 80,
        task_id: task?.task_id || null,
        content: task?.title || "New task",
      });
    } else if (tool === "line" || tool === "arrow") {
      await addItem({
        item_type: tool === "arrow" ? "arrow" : "line",
        x: point.x,
        y: point.y,
        width: 120,
        height: 20,
      });
    }
    setTool("select");
  };

  const selected = items.find((i) => i.item_id === selectedItemId) || null;

  const handleSaveItem = (id: string, updates: Partial<CanvasItem>) => {
    updateItemLocal(id, updates);
    saveItem(id, updates);
  };

  if (!id) {
    return (
      <div
        className="pm-view"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div className="pm-empty-state">
          <strong>Creating canvas...</strong>
        </div>
      </div>
    );
  }

  if (loading && !canvas) {
    return (
      <div
        className="pm-view"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div className="pm-skeleton-list">
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="pm-view"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div className="pm-state-card pm-error-state">
          <Icon name="shield" size={18} />
          <div>
            <strong>Canvas could not be loaded.</strong>
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="pm-button pm-button-small"
            onClick={() => navigate(-1)}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="pm-view"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        padding: 0,
        margin: 0,
        gap: 0,
      }}
    >
      <header
        className="pm-glass-panel"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderRadius: 0,
          borderBottom: "1px solid var(--pm-border)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            type="button"
            className="pm-button pm-button-quiet"
            onClick={() => navigate(-1)}
          >
            <Icon name="chevron" size={14} />
            Back
          </button>
          <span
            style={{
              fontWeight: 700,
              color: "var(--pm-text)",
              fontSize: "14px",
            }}
          >
            {canvas?.name || "Canvas"}
          </span>
          {tool === "task" && (
            <div style={{ width: "240px" }}>
              <TaskPicker
                tasks={tasks}
                value={taskToPlaceId}
                onChange={setTaskToPlaceId}
                placeholder="Choose task to place..."
              />
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--pm-text-muted)",
          }}
        >
          {user?.username}
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        <CanvasToolbar tool={tool} setTool={setTool} />

        <CanvasViewport
          items={items}
          connections={connections}
          selectedItemId={selectedItemId}
          selectedConnectionId={selectedConnectionId}
          tool={tool}
          pan={pan}
          zoom={zoom}
          onPanChange={setPan}
          onZoomChange={setZoom}
          onSelectItem={selectItem}
          onSelectConnection={selectConnection}
          onUpdateItemLocal={updateItemLocal}
          onSaveItem={handleSaveItem}
          onDeleteItem={deleteItem}
          onCanvasClick={handleCanvasClick}
          enteringItemIds={enteringItemIds}
          deletingItemIds={deletingItemIds}
          loading={loading}
        />

        <aside
          className="pm-glass-panel"
          style={{
            width: "288px",
            padding: "16px",
            overflowY: "auto",
            borderRadius: 0,
            borderLeft: "1px solid var(--pm-border)",
            borderTop: "none",
            borderBottom: "none",
            borderRight: "none",
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--pm-text-secondary)",
              marginBottom: "12px",
            }}
          >
            Properties
          </h2>
          <PropertiesPanel
            item={selected}
            items={items}
            onUpdateLocal={updateItemLocal}
            onSave={saveItem}
            onDelete={deleteItem}
            onAddConnection={(fromId, toId, type) =>
              addConnection(fromId, toId, type || "arrow")
            }
          />
        </aside>
      </div>
    </div>
  );
}

```

<!-- END FILE: frontend/src/pages/Canvas.tsx -->

<!-- BEGIN FILE: frontend/src/pages/CanvasList.tsx -->

## FILE: frontend/src/pages/CanvasList.tsx

```tsx
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "../hooks/useAuth";
import type { Canvas } from "../types/canvas";
import { Icon } from "../components/layout/Icon";

export default function CanvasListPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const projectId = params.projectId || searchParams.get("project_id") || null;

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["canvases", projectId],
    queryFn: async () => {
      const url = projectId
        ? `/api/canvas?project_id=${encodeURIComponent(projectId)}`
        : "/api/canvas";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch canvases");
      const json = await res.json();
      return (json.canvases || []) as Canvas[];
    },
  });

  const createCanvas = useMutation({
    mutationFn: async (canvasName: string) => {
      const res = await fetch("/api/canvas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          name: canvasName || "Untitled Canvas",
          description: null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create canvas");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["canvases", projectId] });
      setCreating(false);
      setName("");
      navigate(`/canvas/${data.canvas.canvas_id}`);
    },
  });

  const deleteCanvas = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/canvas/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to delete canvas");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvases", projectId] });
    },
  });

  return (
    <section className="pm-view">
      <div className="pm-view-heading">
        <div>
          <span className="pm-eyebrow">WORK · PROJECT CANVAS</span>
          <h1>Visual project mapping.</h1>
          <p>
            Create and manage canvas diagrams for your projects. Map tasks,
            connections, and workflows visually.
          </p>
        </div>

        <button
          type="button"
          className="pm-button pm-button-primary"
          onClick={() => setCreating(true)}
        >
          <Icon name="plus" size={15} />
          New canvas
        </button>
      </div>

      <section className="pm-glass-panel pm-task-surface">
        {creating && (
          <div
            className="pm-inline-form"
            style={{ marginBottom: "16px", padding: "12px" }}
          >
            <input
              className="pm-field"
              style={{ flex: 1 }}
              placeholder="Canvas name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="pm-button pm-button-primary"
              onClick={() => createCanvas.mutate(name)}
              disabled={createCanvas.isPending}
            >
              {createCanvas.isPending ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              className="pm-button pm-button-quiet"
              onClick={() => {
                setCreating(false);
                setName("");
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="pm-skeleton-list">
            <i />
            <i />
            <i />
            <i />
          </div>
        ) : error ? (
          <div className="pm-state-card pm-error-state">
            <Icon name="shield" size={18} />
            <div>
              <strong>Canvases could not be loaded.</strong>
              <span>Check the connection and try again.</span>
            </div>
            <button
              type="button"
              className="pm-button pm-button-small"
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["canvases", projectId],
                })
              }
            >
              Retry
            </button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="pm-empty-state">
            <strong>No canvases yet</strong>
            <p>Create one to get started mapping your project.</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "12px",
              padding: "4px",
            }}
          >
            {data.map((c) => (
              <article
                key={c.canvas_id}
                className="pm-task-row pm-glass-panel"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  cursor: "pointer",
                }}
                onClick={() => navigate(`/canvas/${c.canvas_id}`)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <h3
                    style={{
                      fontWeight: 600,
                      color: "var(--pm-text)",
                      fontSize: "12px",
                      margin: 0,
                    }}
                  >
                    {c.name}
                  </h3>
                  <button
                    type="button"
                    className="pm-table-action is-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete canvas?"))
                        deleteCanvas.mutate(c.canvas_id);
                    }}
                  >
                    Delete
                  </button>
                </div>
                <p
                  style={{
                    fontSize: "10px",
                    color: "var(--pm-text-muted)",
                    margin: 0,
                  }}
                >
                  {c.description || "No description"}
                </p>
                <p
                  style={{
                    fontSize: "9px",
                    color: "var(--pm-text-muted)",
                    margin: 0,
                  }}
                >
                  {new Date(c.updated_at).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

```

<!-- END FILE: frontend/src/pages/CanvasList.tsx -->

<!-- BEGIN FILE: frontend/src/index.css -->

## FILE: frontend/src/index.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  --pm-canvas: #090b0f;
  --pm-canvas-deep: #050609;
  --pm-rail: rgba(12, 15, 21, 0.74);
  --pm-glass: rgba(21, 27, 37, 0.56);
  --pm-glass-strong: rgba(28, 35, 47, 0.74);
  --pm-glass-soft: rgba(255, 255, 255, 0.045);
  --pm-glass-hover: rgba(255, 255, 255, 0.082);
  --pm-border: rgba(211, 228, 255, 0.13);
  --pm-border-strong: rgba(215, 234, 255, 0.22);
  --pm-text: #f4f8ff;
  --pm-text-secondary: #aebcd0;
  --pm-text-muted: #738197;
  --pm-accent: #54C8FF;
  --pm-accent-rgb: 84, 200, 255;
  --pm-accent-ink: #06131A;
  --pm-accent-soft: rgba(var(--pm-accent-rgb), 0.13);
  --pm-accent-glow: rgba(var(--pm-accent-rgb), 0.26);
  --pm-success: #73d6a3;
  --pm-warning: #f2be6e;
  --pm-danger: #f0838c;
  --pm-info: #95b9ff;
  --pm-radius-sm: 8px;
  --pm-radius: 14px;
  --pm-radius-lg: 20px;
  --pm-shadow: 0 18px 44px rgba(0, 0, 0, 0.28), inset 0 1px rgba(255, 255, 255, 0.055);
  --pm-shadow-float: 0 26px 70px rgba(0, 0, 0, 0.5), inset 0 1px rgba(255, 255, 255, 0.07);
  --pm-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --color-bg: var(--pm-canvas);
  --color-surface: var(--pm-glass);
  --color-primary: var(--pm-accent);
  --color-accent: var(--pm-accent);
  --color-text: var(--pm-text);
  --color-muted: var(--pm-text-secondary);
  --color-border: var(--pm-border);
  --color-error: var(--pm-danger);
  --color-success: var(--pm-success);
  --color-warning: var(--pm-warning);
}

html[data-pm-theme="violet"] {
  --pm-canvas: #0c0a12;
  --pm-canvas-deep: #07050a;
  --pm-rail: rgba(17, 12, 25, 0.76);
  --pm-glass: rgba(37, 27, 49, 0.57);
  --pm-glass-strong: rgba(45, 33, 60, 0.75);
  --pm-border: rgba(232, 217, 255, 0.14);
  --pm-border-strong: rgba(232, 217, 255, 0.24);
  --pm-text: #f9f3ff;
  --pm-text-secondary: #c2b5d0;
  --pm-text-muted: #877d96;
}

html[data-pm-theme="aurora"] {
  --pm-canvas: #07100e;
  --pm-canvas-deep: #040806;
  --pm-rail: rgba(9, 23, 18, 0.78);
  --pm-glass: rgba(18, 44, 35, 0.58);
  --pm-glass-strong: rgba(24, 56, 44, 0.76);
  --pm-border: rgba(208, 255, 229, 0.14);
  --pm-border-strong: rgba(208, 255, 229, 0.24);
  --pm-text: #effff7;
  --pm-text-secondary: #b2d0bf;
  --pm-text-muted: #789787;
}

html[data-pm-theme="ember"] {
  --pm-canvas: #100c08;
  --pm-canvas-deep: #080604;
  --pm-rail: rgba(26, 17, 10, 0.78);
  --pm-glass: rgba(50, 34, 21, 0.56);
  --pm-glass-strong: rgba(62, 42, 27, 0.75);
  --pm-border: rgba(255, 232, 207, 0.14);
  --pm-border-strong: rgba(255, 232, 207, 0.23);
  --pm-text: #fff7ee;
  --pm-text-secondary: #d1bda8;
  --pm-text-muted: #987f68;
}

html[data-pm-theme="emerald"] {
  --pm-canvas: #08100d;
  --pm-canvas-deep: #050806;
  --pm-rail: rgba(9, 19, 15, 0.77);
  --pm-glass: rgba(19, 41, 32, 0.58);
  --pm-glass-strong: rgba(25, 51, 39, 0.75);
  --pm-border: rgba(214, 255, 235, 0.14);
  --pm-border-strong: rgba(214, 255, 235, 0.23);
  --pm-text: #f1fff8;
  --pm-text-secondary: #b7d0c2;
  --pm-text-muted: #7a9788;
}

* { box-sizing: border-box; }
html, body, #root { min-height: 100%; }
body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at 84% -14%, rgba(var(--pm-accent-rgb), 0.19), transparent 33rem),
    radial-gradient(circle at -8% 105%, rgba(var(--pm-accent-rgb), 0.09), transparent 30rem),
    linear-gradient(145deg, var(--pm-canvas-deep), var(--pm-canvas) 48%, var(--pm-canvas-deep));
  color: var(--pm-text);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

button, input, textarea, select { font: inherit; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.55; }
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, a:focus-visible {
  outline: 2px solid var(--pm-accent);
  outline-offset: 2px;
}

.pm-app-shell {
  display: grid;
  grid-template-columns: 238px minmax(0, 1fr);
  min-height: 100vh;
  color: var(--pm-text);
}

.pm-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 19px 13px 14px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--pm-rail) 86%, transparent), color-mix(in srgb, var(--pm-rail) 94%, var(--pm-canvas-deep)));
  border-right: 1px solid var(--pm-border);
  backdrop-filter: blur(28px) saturate(145%);
  -webkit-backdrop-filter: blur(28px) saturate(145%);
  z-index: 20;
}

.pm-brand { display: flex; align-items: center; gap: 10px; padding: 0 8px; font-weight: 670; letter-spacing: -0.025em; }
.pm-brand-mark {
  display: grid; place-items: center; width: 29px; height: 29px; border-radius: 9px;
  color: var(--pm-accent); background: linear-gradient(135deg, rgba(var(--pm-accent-rgb), .23), rgba(255,255,255,.03));
  border: 1px solid rgba(var(--pm-accent-rgb), .44); box-shadow: 0 8px 23px rgba(var(--pm-accent-rgb), .16), inset 0 1px rgba(255,255,255,.22);
  font-size: 13px; font-weight: 800;
}
.pm-brand span { font-size: 13px; }
.pm-workspace-switcher {
  display: flex; align-items: center; gap: 9px; padding: 9px;
  border-radius: var(--pm-radius-sm); border: 1px solid var(--pm-border); background: rgba(255,255,255,.035);
  color: var(--pm-text);
}
.pm-workspace-icon { width: 27px; height: 27px; display: grid; place-items: center; border-radius: 7px; background: var(--pm-glass-strong); color: var(--pm-accent); border: 1px solid var(--pm-border); font: 700 9px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-workspace-switcher small { display: block; color: var(--pm-text-muted); font-size: 8px; letter-spacing: .11em; line-height: 1; }
.pm-workspace-switcher strong { display: block; font-size: 10px; font-weight: 580; margin-top: 4px; }
.pm-workspace-switcher .pm-chevron { margin-left: auto; color: var(--pm-text-muted); }
.pm-nav-group { display: grid; gap: 3px; }
.pm-nav-label { color: var(--pm-text-muted); font-size: 8px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; padding: 0 9px; margin-bottom: 3px; }
.pm-nav-link {
  width: 100%; height: 35px; display: flex; align-items: center; gap: 9px; padding: 0 9px; border: 0; border-radius: 7px;
  color: var(--pm-text-secondary); text-decoration: none; background: transparent; font-size: 10px; text-align: left; position: relative;
  transition: color 140ms ease, background 160ms var(--pm-spring), transform 160ms var(--pm-spring);
}
.pm-nav-link:hover { background: rgba(255,255,255,.055); color: var(--pm-text); }
.pm-nav-link:active { transform: scale(.985); }
.pm-nav-link svg { width: 15px; height: 15px; color: var(--pm-text-muted); flex: none; }
.pm-nav-link.is-active { color: var(--pm-text); background: linear-gradient(90deg, rgba(var(--pm-accent-rgb), .18), rgba(var(--pm-accent-rgb), .06)); box-shadow: inset 2px 0 var(--pm-accent); }
.pm-nav-link.is-active svg { color: var(--pm-accent); }
.pm-nav-link .pm-nav-count { margin-left: auto; color: var(--pm-text-muted); font: 9px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-nav-link .pm-nav-count.is-accent { color: var(--pm-accent); background: var(--pm-accent-soft); border-radius: 4px; padding: 2px 5px; }
.pm-nav-tag { margin-left: auto; color: var(--pm-text-muted); border: 1px solid var(--pm-border); border-radius: 4px; padding: 2px 4px; font: 7px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .04em; }
.pm-profile { margin-top: auto; display: flex; align-items: center; gap: 9px; padding: 13px 6px 0; border-top: 1px solid var(--pm-border); }
.pm-avatar { width: 29px; height: 29px; display: grid; place-items: center; border-radius: 50%; color: var(--pm-accent); border: 1px solid var(--pm-border-strong); background: var(--pm-glass-strong); font: 700 9px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-profile-name { display: block; font-size: 10px; font-weight: 600; }
.pm-profile-role { display: block; margin-top: 2px; color: var(--pm-text-muted); font-size: 8px; }
.pm-profile-more { margin-left: auto; color: var(--pm-text-muted); font-size: 16px; }

.pm-main { min-width: 0; display: grid; grid-template-rows: 58px minmax(0, 1fr); }
.pm-topbar {
  position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 15px;
  padding: 0 26px; border-bottom: 1px solid var(--pm-border); background: rgba(7, 9, 13, .46);
  backdrop-filter: blur(28px) saturate(145%); -webkit-backdrop-filter: blur(28px) saturate(145%);
}
.pm-breadcrumb { color: var(--pm-text-muted); font-size: 10px; }
.pm-breadcrumb strong { color: var(--pm-text-secondary); font-weight: 590; }
.pm-top-actions { display: flex; align-items: center; gap: 9px; }
.pm-command-trigger { height: 31px; width: min(318px, 34vw); display: flex; align-items: center; gap: 8px; padding: 0 9px; border: 1px solid var(--pm-border); border-radius: 7px; background: rgba(255,255,255,.045); color: var(--pm-text-muted); font-size: 9px; text-align: left; }
.pm-command-trigger:hover { border-color: var(--pm-border-strong); background: rgba(255,255,255,.075); }
.pm-command-trigger svg { width: 14px; height: 14px; }
.pm-keycap { margin-left: auto; border: 1px solid var(--pm-border); border-radius: 4px; padding: 2px 4px; color: var(--pm-text-muted); font: 8px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-icon-button { position: relative; width: 32px; height: 32px; padding: 0; display: grid; place-items: center; border: 1px solid var(--pm-border); border-radius: 7px; background: rgba(255,255,255,.04); color: var(--pm-text-secondary); }
.pm-icon-button:hover { background: rgba(255,255,255,.08); color: var(--pm-text); }
.pm-notification-dot { width: 6px; height: 6px; border-radius: 50%; position: absolute; right: 7px; top: 7px; background: var(--pm-warning); box-shadow: 0 0 0 2px var(--pm-canvas); }
.pm-theme-menu-trigger { height: 31px; display: flex; align-items: center; gap: 7px; padding: 0 9px; border: 1px solid var(--pm-border); border-radius: 7px; background: rgba(255,255,255,.04); color: var(--pm-text-secondary); font-size: 9px; }
.pm-theme-menu-trigger:hover { background: rgba(255,255,255,.08); }
.pm-theme-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pm-accent); box-shadow: 0 0 0 3px var(--pm-accent-soft), 0 0 14px var(--pm-accent-glow); }
.pm-page-host { min-width: 0; overflow: auto; }
.pm-page { max-width: 1480px; margin: 0 auto; padding: 28px 28px 40px; }
.pm-page-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin: 0 0 20px; }
.pm-page-heading h1 { margin: 0; font-size: 25px; letter-spacing: -0.045em; line-height: 1.08; font-weight: 660; }
.pm-page-heading p { margin: 6px 0 0; color: var(--pm-text-secondary); font-size: 10px; }
.pm-kicker { color: var(--pm-accent); font-size: 8px; line-height: 1; font-weight: 700; letter-spacing: .13em; margin: 0 0 8px; }
.pm-glass-panel {
  background: linear-gradient(138deg, rgba(255,255,255,.105), rgba(255,255,255,.03) 24%, rgba(255,255,255,.018) 65%), var(--pm-glass);
  border: 1px solid var(--pm-border); border-radius: var(--pm-radius); box-shadow: var(--pm-shadow);
  backdrop-filter: blur(22px) saturate(142%); -webkit-backdrop-filter: blur(22px) saturate(142%);
}
.pm-glass-panel:hover { border-color: color-mix(in srgb, var(--pm-border-strong) 86%, var(--pm-accent) 14%); }
.pm-panel-heading { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 17px 18px 14px; border-bottom: 1px solid var(--pm-border); }
.pm-panel-heading h2 { margin: 0; font-size: 13px; letter-spacing: -.025em; font-weight: 640; }
.pm-panel-heading p { color: var(--pm-text-secondary); font-size: 9px; line-height: 1.5; margin: 5px 0 0; }
.pm-button { min-height: 32px; padding: 0 11px; border-radius: 7px; border: 1px solid var(--pm-border); color: var(--pm-text-secondary); background: rgba(255,255,255,.04); font-size: 9px; font-weight: 590; transition: background 150ms ease, border-color 150ms ease, transform 150ms var(--pm-spring); }
.pm-button:hover { color: var(--pm-text); border-color: var(--pm-border-strong); background: rgba(255,255,255,.085); }
.pm-button:active { transform: scale(.98); }
.pm-button-primary { background: linear-gradient(135deg, color-mix(in srgb, var(--pm-accent) 94%, white 6%), var(--pm-accent)); border-color: color-mix(in srgb, var(--pm-accent) 78%, white 22%); color: var(--pm-accent-ink); box-shadow: 0 8px 22px var(--pm-accent-glow), inset 0 1px rgba(255,255,255,.35); }
.pm-button-primary:hover { color: var(--pm-accent-ink); background: var(--pm-accent); filter: brightness(1.05); }
.pm-button-secondary { background: rgba(255,255,255,.06); }
.pm-button-quiet { border-color: transparent; background: transparent; color: var(--pm-text-muted); }
.pm-button-quiet:hover { background: rgba(255,255,255,.055); }
.pm-empty { padding: 42px 18px; color: var(--pm-text-secondary); font-size: 10px; text-align: center; }
.pm-inline-feedback { color: var(--pm-accent); font-size: 9px; margin: 11px 18px 16px; }

/* Theme controls */
.pm-theme-customizer { overflow: hidden; }
.pm-theme-current { flex: none; display: inline-flex; align-items: center; gap: 7px; color: var(--pm-text-secondary); font-size: 8px; border: 1px solid var(--pm-border); border-radius: 999px; padding: 5px 8px; background: rgba(255,255,255,.035); }
.pm-theme-current i { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 0 3px var(--pm-accent-soft); }
.pm-theme-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 9px; padding: 15px 18px; }
.pm-theme-choice { min-width: 0; padding: 9px; text-align: left; border: 1px solid var(--pm-border); border-radius: 9px; background: rgba(255,255,255,.025); color: var(--pm-text); transition: transform 160ms var(--pm-spring), border-color 160ms ease, background 160ms ease; }
.pm-theme-choice:hover { transform: translateY(-2px); background: rgba(255,255,255,.07); border-color: var(--pm-border-strong); }
.pm-theme-choice.is-selected { border-color: var(--pm-accent); box-shadow: 0 0 0 2px var(--pm-accent-soft); }
.pm-theme-choice strong { font-size: 9px; font-weight: 620; display: block; margin-top: 8px; }
.pm-theme-choice small { color: var(--pm-text-muted); display: block; margin-top: 3px; font-size: 7px; line-height: 1.35; }
.pm-theme-swatch { height: 45px; display: grid; grid-template-columns: 31% 1fr; gap: 4px; padding: 5px; border-radius: 5px; overflow: hidden; background: linear-gradient(145deg, #06070a, #15191f); border: 1px solid rgba(255,255,255,.08); }
.pm-theme-swatch i { background: rgba(255,255,255,.07); border-radius: 2px; }
.pm-theme-swatch b { background: rgba(255,255,255,.1); border-radius: 2px; }
.pm-theme-swatch em { background: var(--theme-choice-accent); opacity: .9; border-radius: 2px; }
.pm-custom-accent { display: grid; grid-template-columns: minmax(180px, .8fr) minmax(400px, 1.2fr); align-items: center; gap: 16px; padding: 15px 18px; border-top: 1px solid var(--pm-border); background: rgba(0,0,0,.08); }
.pm-field-label { display: block; color: var(--pm-text); font-size: 9px; font-weight: 620; }
.pm-custom-accent p { color: var(--pm-text-muted); font-size: 8px; line-height: 1.5; margin: 4px 0 0; }
.pm-accent-controls { display: flex; align-items: center; gap: 7px; }
.pm-color-input { width: 34px; height: 32px; border: 1px solid var(--pm-border); border-radius: 7px; overflow: hidden; background: var(--pm-glass-strong); cursor: pointer; }
.pm-color-input input { width: 100%; height: 100%; padding: 3px; border: 0; background: transparent; cursor: pointer; }
.pm-hex-input { width: 112px; height: 32px; padding: 0 9px; border: 1px solid var(--pm-border); border-radius: 7px; background: rgba(0,0,0,.16); color: var(--pm-text); font: 9px ui-monospace, SFMono-Regular, Consolas, monospace; text-transform: uppercase; }
.pm-hex-input::placeholder { color: var(--pm-text-muted); }

/* Legacy application surfaces inherit the glass system while routes are rebuilt. */
.pm-app-shell .min-h-screen { min-height: 0 !important; background: transparent !important; }
.pm-app-shell .bg-white,
.pm-app-shell .dark\:bg-slate-800,
.pm-app-shell .dark\:bg-slate-900,
.pm-app-shell .bg-slate-50 {
  background: var(--pm-glass) !important;
  border-color: var(--pm-border) !important;
}
.pm-app-shell .border-slate-200,
.pm-app-shell .dark\:border-slate-700,
.pm-app-shell .dark\:border-slate-600,
.pm-app-shell .border-slate-300 { border-color: var(--pm-border) !important; }
.pm-app-shell .text-slate-900,
.pm-app-shell .dark\:text-slate-100,
.pm-app-shell .text-slate-800,
.pm-app-shell .dark\:text-slate-200 { color: var(--pm-text) !important; }
.pm-app-shell .text-slate-700,
.pm-app-shell .dark\:text-slate-300,
.pm-app-shell .text-slate-600,
.pm-app-shell .dark\:text-slate-400 { color: var(--pm-text-secondary) !important; }
.pm-app-shell .text-slate-500,
.pm-app-shell .dark\:text-slate-500,
.pm-app-shell .text-slate-400 { color: var(--pm-text-muted) !important; }
.pm-app-shell .bg-blue-600,
.pm-app-shell .dark\:bg-blue-500 { background: var(--pm-accent) !important; color: var(--pm-accent-ink) !important; border-color: var(--pm-accent) !important; }
.pm-app-shell .text-blue-600,
.pm-app-shell .dark\:text-blue-400 { color: var(--pm-accent) !important; }
.pm-app-shell .shadow,
.pm-app-shell .shadow-lg { box-shadow: var(--pm-shadow) !important; }
.pm-app-shell input:not([type="color"]),
.pm-app-shell textarea,
.pm-app-shell select { background: rgba(5, 7, 11, .31) !important; border-color: var(--pm-border) !important; color: var(--pm-text) !important; }
.pm-app-shell input::placeholder,
.pm-app-shell textarea::placeholder { color: var(--pm-text-muted) !important; }

/* Canvas-specific motion remains available under the new token system. */
.canvas-spring { transition-timing-function: var(--pm-spring); }
@keyframes canvas-pop-in { from { opacity: 0; transform: scale(.82); } to { opacity: 1; transform: scale(1); } }
@keyframes canvas-pop-out { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(.78); } }
@keyframes canvas-pulse-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(var(--pm-accent-rgb), .54); } 50% { box-shadow: 0 0 0 10px rgba(var(--pm-accent-rgb), 0); } }
@keyframes canvas-skeleton-pulse { 0%,100% { opacity:.35; } 50% { opacity:.85; } }
@keyframes canvas-draw-line { from { stroke-dashoffset: var(--dash-len, 1000); } to { stroke-dashoffset: 0; } }
.canvas-item { transition: transform 200ms var(--pm-spring), box-shadow 200ms var(--pm-spring), border-color 200ms var(--pm-spring); }
.canvas-item-inner { width: 100%; height: 100%; }
.canvas-item-enter .canvas-item-inner { animation: canvas-pop-in .32s var(--pm-spring) both; }
.canvas-item-exit .canvas-item-inner { animation: canvas-pop-out .2s var(--pm-spring) both; }
.canvas-item-exit { pointer-events: none; }
.canvas-item-selected { animation: canvas-pulse-glow 1.6s ease-in-out infinite; }
.canvas-item-dragging { z-index: 9999 !important; }
.canvas-skeleton { animation: canvas-skeleton-pulse 1.2s ease-in-out infinite; background-color: rgba(255,255,255,.13); }

@media (max-width: 1120px) {
  .pm-app-shell { grid-template-columns: 204px minmax(0, 1fr); }
  .pm-sidebar { padding-left: 10px; padding-right: 10px; }
  .pm-topbar { padding: 0 18px; }
  .pm-page { padding: 23px 18px 32px; }
  .pm-theme-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .pm-custom-accent { grid-template-columns: 1fr; }
}

@media (max-width: 780px) {
  body { min-width: 0; }
  .pm-app-shell { display: block; }
  .pm-sidebar { position: static; height: auto; display: grid; grid-template-columns: auto 1fr; gap: 12px; padding: 12px; border-right: 0; border-bottom: 1px solid var(--pm-border); }
  .pm-brand { grid-column: 1; }
  .pm-workspace-switcher { grid-column: 2; }
  .pm-sidebar .pm-nav-group { display: none; }
  .pm-profile { display: none; }
  .pm-topbar { padding: 0 12px; height: 52px; }
  .pm-command-trigger { width: 165px; }
  .pm-theme-menu-trigger span { display: none; }
  .pm-page { padding: 18px 12px 26px; }
  .pm-page-heading { align-items: flex-start; flex-direction: column; }
  .pm-theme-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 12px; }
  .pm-custom-accent { padding: 12px; }
  .pm-accent-controls { flex-wrap: wrap; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: 0.01ms !important; }
}


/* ── Rebuilt workspace surfaces ─────────────────────────────── */
.pm-main-column { min-width: 0; display: grid; grid-template-rows: 58px minmax(0, 1fr); }
.pm-main-column .pm-topbar { padding: 0 24px; }
.pm-topbar-actions { display: flex; align-items: center; gap: 8px; }
.pm-workspace { min-width: 0; overflow: auto; }
.pm-nav-item { width: 100%; height: 35px; display: flex; align-items: center; gap: 9px; padding: 0 9px; border: 0; border-radius: 7px; color: var(--pm-text-secondary); text-decoration: none; background: transparent; font-size: 10px; text-align: left; position: relative; transition: color 140ms ease, background 160ms var(--pm-spring), transform 160ms var(--pm-spring); }
.pm-nav-item:hover { background: rgba(255,255,255,.055); color: var(--pm-text); }
.pm-nav-item:active { transform: scale(.985); }
.pm-nav-item svg { flex: none; color: var(--pm-text-muted); }
.pm-nav-item.is-active { color: var(--pm-text); background: linear-gradient(90deg, rgba(var(--pm-accent-rgb), .18), rgba(var(--pm-accent-rgb), .06)); box-shadow: inset 2px 0 var(--pm-accent); }
.pm-nav-item.is-active svg { color: var(--pm-accent); }
.pm-nav-badge { margin-left: auto; padding: 2px 5px; border-radius: 4px; color: var(--pm-accent); background: var(--pm-accent-soft); font: 8px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-future-tag { margin-left: auto; color: var(--pm-text-muted); border: 1px solid var(--pm-border); border-radius: 4px; padding: 2px 4px; font: 7px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .04em; }
.pm-workspace-glyph { width: 27px; height: 27px; flex: none; display: grid; place-items: center; border-radius: 7px; background: var(--pm-glass-strong); color: var(--pm-accent); border: 1px solid var(--pm-border); font: 700 9px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-workspace-switcher > svg { margin-left: auto; color: var(--pm-text-muted); }
.pm-user-menu { margin-top: auto; padding: 13px 6px 0; border-top: 1px solid var(--pm-border); display: flex; align-items: center; gap: 8px; }
.pm-user-avatar { width: 29px; height: 29px; flex: none; display: grid; place-items: center; border-radius: 50%; color: var(--pm-accent); border: 1px solid var(--pm-border-strong); background: var(--pm-glass-strong); font: 700 9px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-user-menu strong { display:block; font-size:10px; font-weight:600; }
.pm-user-menu small { display:block; margin-top:2px; color:var(--pm-text-muted); font-size:8px; text-transform:capitalize; }
.pm-user-logout { margin-left:auto; width:28px; height:28px; opacity:.7; }
.pm-primary-button, .pm-secondary-button { min-height:32px; border-radius:7px; padding:0 10px; display:inline-flex; align-items:center; justify-content:center; gap:6px; font-size:9px; font-weight:600; transition: transform 150ms var(--pm-spring), background 150ms ease, border-color 150ms ease; }
.pm-primary-button { background:linear-gradient(135deg, color-mix(in srgb,var(--pm-accent) 93%,white 7%),var(--pm-accent)); border:1px solid color-mix(in srgb,var(--pm-accent) 78%,white 22%); color:var(--pm-accent-ink); box-shadow:0 8px 23px var(--pm-accent-glow),inset 0 1px rgba(255,255,255,.35); }
.pm-primary-button:hover { filter:brightness(1.06); transform:translateY(-1px); }
.pm-primary-button:active,.pm-secondary-button:active { transform:scale(.98); }
.pm-secondary-button { background:rgba(255,255,255,.045); color:var(--pm-text-secondary); border:1px solid var(--pm-border); }
.pm-secondary-button:hover { color:var(--pm-text); background:rgba(255,255,255,.085); border-color:var(--pm-border-strong); }

.pm-view { max-width:1480px; margin:0 auto; padding:28px 28px 40px; }
.pm-view-heading { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; margin-bottom:20px; }
.pm-view-heading h1 { margin:0; color:var(--pm-text); font-size:25px; line-height:1.08; letter-spacing:-.045em; font-weight:660; max-width:620px; }
.pm-view-heading p { margin:7px 0 0; color:var(--pm-text-secondary); font-size:10px; line-height:1.5; max-width:650px; }
.pm-heading-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap; }
.pm-eyebrow { display:block; color:var(--pm-accent); font-size:8px; line-height:1; letter-spacing:.13em; font-weight:720; margin-bottom:8px; }
.pm-panel-header { min-height:59px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border-bottom:1px solid var(--pm-border); }
.pm-panel-header h2 { margin:0; color:var(--pm-text); font-size:12px; letter-spacing:-.025em; font-weight:640; }
.pm-panel-header p { margin:4px 0 0; color:var(--pm-text-muted); font-size:8px; }
.pm-button-small { min-height:27px; padding:0 8px; font-size:8px; }
.pm-state-card { display:flex; align-items:center; gap:10px; margin-bottom:14px; padding:12px 14px; border-radius:var(--pm-radius-sm); border:1px solid var(--pm-border); background:rgba(255,255,255,.035); color:var(--pm-text-secondary); }
.pm-state-card > svg { color:var(--pm-warning); flex:none; }
.pm-state-card > div { display:grid; gap:2px; min-width:0; }
.pm-state-card strong { font-size:10px; color:var(--pm-text); }
.pm-state-card span { font-size:8px; }
.pm-state-card .pm-button { margin-left:auto; }
.pm-error-state { border-color:color-mix(in srgb,var(--pm-danger) 45%,var(--pm-border)); background:color-mix(in srgb,var(--pm-danger) 8%,var(--pm-glass)); }
.pm-error-state > svg { color:var(--pm-danger); }

.pm-overview-layout { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(272px,.74fr); gap:13px; }
.pm-focus-list { padding:4px 10px 9px; }
.pm-focus-row { width:100%; display:grid; grid-template-columns:26px minmax(0,1fr) auto 16px; align-items:center; gap:9px; padding:10px 6px; color:var(--pm-text); text-align:left; background:transparent; border:0; border-bottom:1px solid color-mix(in srgb,var(--pm-border) 68%,transparent); }
.pm-focus-row:last-child { border-bottom:0; }
.pm-focus-row:hover .pm-focus-copy strong { color:var(--pm-accent); }
.pm-focus-row > svg { color:var(--pm-text-muted); }
.pm-state-glyph { width:23px; height:23px; display:grid; place-items:center; border-radius:6px; color:var(--pm-text-muted); border:1px solid var(--pm-border); background:rgba(255,255,255,.035); }
.pm-state-glyph.blocked { color:var(--pm-danger); border-color:color-mix(in srgb,var(--pm-danger) 38%,var(--pm-border)); background:color-mix(in srgb,var(--pm-danger) 8%,transparent); }
.pm-state-glyph.in_progress { color:var(--pm-info); border-color:color-mix(in srgb,var(--pm-info) 38%,var(--pm-border)); background:color-mix(in srgb,var(--pm-info) 8%,transparent); }
.pm-focus-copy { min-width:0; display:grid; gap:2px; }
.pm-focus-copy strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:9px; font-weight:590; transition:color 150ms ease; }
.pm-focus-copy small { color:var(--pm-text-muted); font-size:8px; }
.pm-status { display:inline-flex; align-items:center; gap:5px; white-space:nowrap; color:var(--pm-text-secondary); font-size:8px; }
.pm-status i { width:5px; height:5px; border-radius:50%; background:var(--pm-text-muted); }
.pm-status.todo i { background:var(--pm-text-muted); }.pm-status.in_progress { color:var(--pm-info); }.pm-status.in_progress i { background:var(--pm-info); }.pm-status.done { color:var(--pm-success); }.pm-status.done i { background:var(--pm-success); }.pm-status.blocked { color:var(--pm-danger); }.pm-status.blocked i { background:var(--pm-danger); }
.pm-empty-row { min-height:92px; padding:16px; display:flex; align-items:center; gap:10px; color:var(--pm-text-secondary); }
.pm-empty-row > svg { color:var(--pm-success); flex:none; }.pm-empty-row > div { display:grid; gap:3px; }.pm-empty-row strong { color:var(--pm-text); font-size:10px; }.pm-empty-row span { font-size:8px; color:var(--pm-text-muted); }.pm-empty-row .pm-button { margin-left:auto; }
.pm-overview-dock { display:grid; gap:13px; align-content:start; }
.pm-live-marker { color:var(--pm-success); display:inline-flex; align-items:center; gap:5px; font:8px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-live-marker i { width:5px; height:5px; border-radius:50%; background:var(--pm-success); box-shadow:0 0 10px color-mix(in srgb,var(--pm-success) 65%,transparent); }
.pm-signal-grid { display:grid; grid-template-columns:1fr 1fr; }.pm-signal-grid > div { padding:14px 16px; border-right:1px solid var(--pm-border); border-bottom:1px solid var(--pm-border); }.pm-signal-grid > div:nth-child(2n) { border-right:0; }.pm-signal-grid > div:nth-last-child(-n+2) { border-bottom:0; }.pm-signal-grid small { display:block; color:var(--pm-text-muted); font-size:8px; }.pm-signal-grid strong { display:block; margin-top:4px; color:var(--pm-text); font-size:18px; letter-spacing:-.04em; font-weight:650; }.pm-signal-grid strong.is-danger { color:var(--pm-danger); }.pm-signal-grid strong.is-warning { color:var(--pm-warning); }
.pm-attention-panel { padding:16px; background:linear-gradient(135deg,rgba(var(--pm-accent-rgb),.13),rgba(255,255,255,.02) 60%),var(--pm-glass); }.pm-attention-panel h2 { margin:0; font-size:13px; letter-spacing:-.025em; }.pm-attention-panel p { color:var(--pm-text-secondary); margin:7px 0 11px; font-size:9px; line-height:1.5; }.pm-inline-link { display:inline-flex; gap:6px; align-items:center; padding:0; color:var(--pm-accent); font-size:9px; font-weight:600; }.pm-inline-link:hover { color:color-mix(in srgb,var(--pm-accent) 80%,white); }
.pm-activity-panel { margin-top:13px; }.pm-state-strip { display:grid; grid-template-columns:repeat(4,1fr); }.pm-state-strip>div { min-height:78px; display:flex; align-items:center; gap:9px; padding:14px 16px; border-right:1px solid var(--pm-border); }.pm-state-strip>div:last-child { border-right:0; }.pm-strip-icon { width:27px; height:27px; display:grid; place-items:center; border-radius:7px; border:1px solid var(--pm-border); color:var(--pm-accent); background:var(--pm-accent-soft); }.pm-state-strip small { display:block; color:var(--pm-text-muted); font-size:8px; }.pm-state-strip strong { display:block; margin-top:3px; font-size:15px; letter-spacing:-.035em; }.pm-skeleton-list { padding:14px 16px; display:grid; gap:9px; }.pm-skeleton-list i,.pm-signal-skeleton { display:block; height:35px; border-radius:7px; background:linear-gradient(90deg,rgba(255,255,255,.035),rgba(255,255,255,.1),rgba(255,255,255,.035)); background-size:200% 100%; animation:pm-shimmer 1.4s ease-in-out infinite; }.pm-signal-skeleton { height:146px; margin:14px; }
@keyframes pm-shimmer { to { background-position:-200% 0; } }

/* Task workspace */
.pm-task-surface { overflow:hidden; }.pm-task-toolbar { min-height:54px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 13px; border-bottom:1px solid var(--pm-border); }.pm-filter-tabs { display:flex; gap:4px; flex-wrap:wrap; }.pm-filter-tabs button { min-height:27px; padding:0 8px; border:1px solid transparent; border-radius:5px; background:transparent; color:var(--pm-text-muted); font-size:8px; }.pm-filter-tabs button:hover { color:var(--pm-text); background:rgba(255,255,255,.055); }.pm-filter-tabs button.is-active { color:var(--pm-accent); border-color:color-mix(in srgb,var(--pm-accent) 32%,var(--pm-border)); background:var(--pm-accent-soft); }.pm-task-count { color:var(--pm-text-muted); font:8px ui-monospace, SFMono-Regular, Consolas, monospace; white-space:nowrap; }.pm-task-table { min-width:700px; }.pm-task-head,.pm-task-row { display:grid; grid-template-columns:minmax(245px,1.72fr) minmax(130px,.82fr) 75px 100px 88px; gap:10px; align-items:center; padding:0 15px; }.pm-task-head { height:29px; color:var(--pm-text-muted); font:8px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing:.07em; text-transform:uppercase; border-bottom:1px solid var(--pm-border); }.pm-task-row { min-height:55px; border-bottom:1px solid color-mix(in srgb,var(--pm-border) 65%,transparent); }.pm-task-row:hover { background:rgba(255,255,255,.026); }.pm-task-title { min-width:0; display:flex; align-items:center; gap:8px; }.pm-priority-dot { width:7px; height:7px; flex:none; border-radius:50%; background:var(--pm-text-muted); }.pm-priority-dot.high { background:var(--pm-warning); }.pm-priority-dot.urgent { background:var(--pm-danger); }.pm-priority-dot.low { background:var(--pm-info); }.pm-task-title>div { min-width:0; display:grid; gap:2px; }.pm-task-title strong { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:9px; font-weight:590; }.pm-task-title small { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:var(--pm-text-muted); font-size:8px; }.pm-project-name,.pm-date { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--pm-text-secondary); font-size:8px; }.pm-date { color:var(--pm-text-muted); }.pm-row-actions { display:flex; justify-content:flex-end; gap:7px; }.pm-row-actions button { padding:0; color:var(--pm-accent); background:transparent; border:0; font-size:8px; }.pm-row-actions button:hover { text-decoration:underline; }.pm-row-actions button.is-danger { color:var(--pm-danger); }.pm-task-surface { overflow-x:auto; }
.pm-dialog-backdrop { position:fixed; inset:0; z-index:60; display:grid; place-items:center; padding:18px; background:rgba(1,3,7,.62); backdrop-filter:blur(10px); }.pm-task-dialog { width:min(680px,100%); max-height:calc(100vh - 36px); overflow:auto; background:linear-gradient(135deg,rgba(255,255,255,.10),rgba(255,255,255,.025)),var(--pm-glass-strong); border:1px solid var(--pm-border-strong); border-radius:16px; box-shadow:var(--pm-shadow-float); backdrop-filter:blur(28px) saturate(150%); }.pm-dialog-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding:17px 18px 14px; border-bottom:1px solid var(--pm-border); }.pm-dialog-heading h2 { margin:0; font-size:17px; letter-spacing:-.035em; }.pm-task-dialog form { padding:16px 18px 18px; }.pm-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }.pm-field { display:grid; gap:6px; }.pm-field-wide { grid-column:1 / -1; }.pm-field>span { color:var(--pm-text-secondary); font-size:8px; font-weight:600; }.pm-field input,.pm-field textarea,.pm-field select { width:100%; border:1px solid var(--pm-border); border-radius:7px; background:rgba(4,7,12,.28); padding:8px 9px; color:var(--pm-text); font-size:9px; }.pm-field textarea { resize:vertical; }.pm-dialog-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }.pm-inline-error { margin:12px 0 0; color:var(--pm-danger); font-size:9px; }

/* Review */
.pm-page { max-width:1480px; margin:0 auto; padding:28px 28px 40px; }.pm-page-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; margin-bottom:20px; }.pm-page-heading h1 { font-size:25px; line-height:1.08; letter-spacing:-.045em; margin:0; }.pm-page-heading p { margin:6px 0 0; color:var(--pm-text-secondary); font-size:10px; }.pm-data-status { color:var(--pm-text-muted); border:1px solid var(--pm-border); border-radius:999px; padding:5px 8px; font:8px ui-monospace, SFMono-Regular, Consolas, monospace; white-space:nowrap; }.pm-review-grid { display:grid; grid-template-columns:minmax(0,1fr) 305px; gap:13px; }.pm-review-list { padding:4px 10px 10px; }.pm-review-row { width:100%; display:grid; grid-template-columns:8px minmax(0,1fr) 14px; gap:9px; align-items:center; padding:12px 6px; color:var(--pm-text); background:transparent; border:0; border-bottom:1px solid color-mix(in srgb,var(--pm-border) 65%,transparent); text-align:left; }.pm-review-row:last-child { border-bottom:0; }.pm-review-row:hover strong { color:var(--pm-accent); }.pm-review-row>span { display:grid; gap:3px; min-width:0; }.pm-review-row strong { font-size:9px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.pm-review-row small { color:var(--pm-text-muted); font-size:8px; }.pm-review-row>svg { color:var(--pm-text-muted); }.pm-status-dot { width:7px; height:7px; border-radius:50%; display:inline-block; background:var(--pm-text-muted); }.pm-status-dot.danger { background:var(--pm-danger); }.pm-status-dot.warning { background:var(--pm-warning); }.pm-status-dot.success { background:var(--pm-success); }.pm-status-dot.info { background:var(--pm-info); }.pm-review-side { padding:17px; }.pm-transparency-icon { width:31px; height:31px; display:grid; place-items:center; border-radius:8px; border:1px solid color-mix(in srgb,var(--pm-accent) 30%,var(--pm-border)); background:var(--pm-accent-soft); color:var(--pm-accent); }.pm-review-side h2 { margin:12px 0 6px; font-size:13px; }.pm-review-side>p { margin:0 0 14px; color:var(--pm-text-secondary); font-size:9px; line-height:1.55; }.pm-review-stat { display:flex; justify-content:space-between; padding:9px 0; border-top:1px solid var(--pm-border); color:var(--pm-text-muted); font-size:8px; }.pm-review-stat strong { color:var(--pm-text); font-size:14px; letter-spacing:-.03em; }.pm-loading-state,.pm-empty-state { padding:26px 12px; color:var(--pm-text-secondary); text-align:center; font-size:9px; }.pm-empty-state strong { display:block; color:var(--pm-text); margin-bottom:4px; }.pm-empty-state p { margin:0; color:var(--pm-text-muted); font-size:8px; }

/* Appearance */
.pm-appearance-layout { display:grid; grid-template-columns:minmax(0,1fr) 310px; gap:13px; }.pm-appearance-main { overflow:hidden; }.pm-theme-card-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; padding:15px; }.pm-appearance-theme-card { min-height:91px; display:grid; grid-template-columns:83px minmax(0,1fr) 15px; align-items:center; gap:10px; padding:9px; text-align:left; background:rgba(255,255,255,.025); border:1px solid var(--pm-border); border-radius:8px; color:var(--pm-text); }.pm-appearance-theme-card:hover { background:rgba(255,255,255,.07); border-color:var(--pm-border-strong); }.pm-appearance-theme-card.is-selected { border-color:var(--pm-accent); box-shadow:0 0 0 2px var(--pm-accent-soft); }.pm-appearance-theme-card>span:not(.pm-theme-swatch) { min-width:0; display:grid; gap:3px; }.pm-appearance-theme-card strong { font-size:9px; }.pm-appearance-theme-card small { color:var(--pm-text-muted); font-size:7px; line-height:1.4; }.pm-appearance-theme-card>svg { color:var(--pm-accent); }.pm-theme-swatch { height:46px; display:grid; grid-template-columns:30% 1fr 1fr; gap:4px; padding:5px; border-radius:5px; overflow:hidden; background:linear-gradient(135deg,#07090c,#17212a); border:1px solid rgba(255,255,255,.07); }.pm-theme-swatch i { background:rgba(255,255,255,.07); border-radius:2px; }.pm-theme-swatch i:nth-child(2) { background:rgba(255,255,255,.12); }.pm-theme-swatch i:last-child { background:var(--swatch-accent); opacity:.9; }.pm-appearance-side { display:grid; gap:13px; align-content:start; }.pm-custom-accent-card { overflow:hidden; }.pm-custom-color-large { display:grid; grid-template-columns:31px 0 1fr auto; gap:7px; align-items:center; padding:14px 15px; }.pm-accent-preview { height:31px; border-radius:7px; border:1px solid var(--pm-border-strong); box-shadow:inset 0 1px rgba(255,255,255,.35); }.pm-custom-color-large input[type=color] { width:0; height:0; opacity:0; pointer-events:none; }.pm-custom-color-large input:not([type=color]) { min-width:0; height:31px; border:1px solid var(--pm-border); border-radius:7px; background:rgba(0,0,0,.18); color:var(--pm-text); padding:0 8px; font:9px ui-monospace, SFMono-Regular, Consolas, monospace; text-transform:uppercase; }.pm-color-help,.pm-color-error { margin:0 15px 13px; color:var(--pm-text-muted); font-size:8px; line-height:1.45; }.pm-color-error { color:var(--pm-danger); }.pm-text-button { display:inline-flex; align-items:center; gap:4px; padding:0; border:0; background:transparent; color:var(--pm-accent); font-size:8px; }.pm-text-button:hover { text-decoration:underline; }.pm-appearance-rule-card { padding:15px; }.pm-appearance-rule-card>svg { color:var(--pm-accent); }.pm-appearance-rule-card h2 { margin:10px 0 5px; font-size:12px; }.pm-appearance-rule-card p { color:var(--pm-text-secondary); font-size:9px; line-height:1.5; margin:0; }.pm-appearance-rule-card ul { display:grid; gap:6px; padding:11px 0 0; margin:11px 0 0; border-top:1px solid var(--pm-border); list-style:none; }.pm-appearance-rule-card li { display:flex; align-items:center; gap:7px; color:var(--pm-text-muted); font-size:8px; }

/* Modals + menus */
.pm-popover-backdrop,.pm-command-backdrop { position:fixed; inset:0; z-index:80; background:rgba(2,4,8,.4); backdrop-filter:blur(6px); }.pm-theme-menu { position:absolute; top:68px; right:23px; width:min(382px,calc(100vw - 28px)); max-height:calc(100vh - 88px); overflow:auto; background:linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.035)),var(--pm-glass-strong); border:1px solid var(--pm-border-strong); border-radius:14px; box-shadow:var(--pm-shadow-float); backdrop-filter:blur(30px) saturate(155%); }.pm-menu-header { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; padding:16px 16px 10px; }.pm-menu-header h2 { margin:3px 0 0; font-size:16px; letter-spacing:-.035em; }.pm-menu-kicker { color:var(--pm-accent); font-size:8px; letter-spacing:.12em; font-weight:700; }.pm-menu-copy { margin:0 16px 13px; color:var(--pm-text-secondary); font-size:9px; line-height:1.5; }.pm-theme-preset-list { display:grid; gap:5px; padding:0 11px 11px; }.pm-theme-preset { display:grid; grid-template-columns:47px minmax(0,1fr) 14px; align-items:center; gap:8px; width:100%; padding:6px; text-align:left; border:1px solid transparent; border-radius:7px; background:transparent; color:var(--pm-text); }.pm-theme-preset:hover { background:rgba(255,255,255,.06); }.pm-theme-preset.is-selected { border-color:var(--pm-accent); background:var(--pm-accent-soft); }.pm-theme-preview { height:27px; display:grid; grid-template-columns:20% 1fr 1fr; gap:3px; padding:4px; background:#090b0e; border:1px solid rgba(255,255,255,.08); border-radius:4px; }.pm-theme-preview i { background:rgba(255,255,255,.08); border-radius:1px; }.pm-theme-preview i:nth-child(2) { background:rgba(255,255,255,.13); }.pm-theme-preview i:last-child { background:var(--preview-accent); }.pm-theme-preset>span:not(.pm-theme-preview) { min-width:0; display:grid; gap:2px; }.pm-theme-preset strong { font-size:9px; }.pm-theme-preset small { color:var(--pm-text-muted); font-size:7px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.pm-theme-preset>svg { color:var(--pm-accent); }.pm-custom-color { padding:11px 16px 14px; border-top:1px solid var(--pm-border); background:rgba(0,0,0,.08); }.pm-custom-color-head { display:flex; justify-content:space-between; gap:10px; }.pm-custom-color-head strong { display:block; font-size:9px; }.pm-custom-color-head small { display:block; color:var(--pm-text-muted); font-size:8px; margin-top:3px; }.pm-color-input-row { display:flex; align-items:center; gap:7px; margin-top:9px; }.pm-color-input-row input[type=color] { width:30px; height:30px; border:1px solid var(--pm-border); border-radius:6px; padding:2px; background:transparent; }.pm-color-input-row input:not([type=color]) { min-width:0; flex:1; height:30px; border:1px solid var(--pm-border); border-radius:6px; padding:0 8px; background:rgba(0,0,0,.17); color:var(--pm-text); font:8px ui-monospace, SFMono-Regular, Consolas, monospace; text-transform:uppercase; }.pm-compact-button { height:30px; border:1px solid var(--pm-border); border-radius:6px; padding:0 8px; color:var(--pm-text-secondary); background:rgba(255,255,255,.06); font-size:8px; }.pm-color-feedback { margin-top:6px; color:var(--pm-text-muted); font-size:7px; }.pm-color-feedback.is-error { color:var(--pm-danger); }.pm-menu-note { display:flex; gap:6px; align-items:flex-start; padding:11px 16px 14px; color:var(--pm-text-muted); font-size:7.5px; line-height:1.45; }.pm-menu-note svg { color:var(--pm-accent); flex:none; }.pm-command-backdrop { display:grid; place-items:start center; padding-top:min(16vh,135px); }.pm-command-palette { width:min(620px,calc(100vw - 28px)); background:linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.03)),var(--pm-glass-strong); border:1px solid var(--pm-border-strong); border-radius:14px; box-shadow:var(--pm-shadow-float); overflow:hidden; backdrop-filter:blur(30px) saturate(155%); }.pm-command-input { height:51px; display:flex; align-items:center; gap:9px; padding:0 14px; border-bottom:1px solid var(--pm-border); color:var(--pm-accent); }.pm-command-input input { min-width:0; flex:1; border:0; outline:0; background:transparent; color:var(--pm-text); font-size:11px; }.pm-command-input input::placeholder { color:var(--pm-text-muted); }.pm-command-input kbd,.pm-command-item kbd { color:var(--pm-text-muted); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; border:1px solid var(--pm-border); border-radius:3px; padding:2px 4px; }.pm-command-label { padding:11px 14px 5px; color:var(--pm-text-muted); font:8px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing:.08em; text-transform:uppercase; }.pm-command-item { width:100%; display:grid; grid-template-columns:27px 1fr auto; align-items:center; gap:8px; padding:8px 14px; background:transparent; color:var(--pm-text-secondary); border:0; text-align:left; font-size:9px; }.pm-command-item:hover { color:var(--pm-text); background:var(--pm-accent-soft); }.pm-command-icon { width:24px; height:24px; display:grid; place-items:center; border-radius:5px; border:1px solid var(--pm-border); color:var(--pm-accent); background:rgba(var(--pm-accent-rgb),.08); }.pm-command-footer { display:flex; gap:13px; padding:10px 14px; border-top:1px solid var(--pm-border); color:var(--pm-text-muted); font-size:7px; }


/* Missing component classes added for UIUX-010 */
.pm-dialog-compact { padding: 12px 16px; border-radius: 12px; }
.pm-dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--pm-border); }
.pm-inline-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pm-checklist-items { display: flex; flex-direction: column; gap: 6px; }
.pm-relationship-arrow { display: inline-flex; align-items: center; color: var(--pm-text-muted); font-size: 12px; }
.pm-kanban-board { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.pm-project-switcher { position: relative; display: inline-block; }
.pm-project-switcher-menu { position: absolute; z-index: 50; margin-top: 4px; min-width: 200px; border: 1px solid var(--pm-border); border-radius: 8px; background: var(--pm-glass-strong); box-shadow: var(--pm-shadow); backdrop-filter: blur(22px) saturate(142%); }
.pm-automation-page { min-height: 100vh; padding: 24px; }
.pm-focus-panel { padding: 16px; border: 1px solid var(--pm-border); border-radius: 8px; background: var(--pm-glass); }
.pm-form-help { font-size: 12px; color: var(--pm-text-muted); margin-top: 4px; }

/* Automation Studio (intentionally non-live) */
.pm-future-notice { color:var(--pm-warning); border:1px solid color-mix(in srgb,var(--pm-warning) 38%,var(--pm-border)); border-radius:5px; padding:5px 7px; font:8px ui-monospace, SFMono-Regular, Consolas, monospace; background:color-mix(in srgb,var(--pm-warning) 9%,transparent); }.pm-automation-layout { min-height:690px; display:grid; grid-template-columns:177px minmax(0,1fr) 258px; grid-template-rows:minmax(0,1fr) 178px; overflow:hidden; border:1px solid var(--pm-border); border-radius:var(--pm-radius); background:var(--pm-glass); box-shadow:var(--pm-shadow); backdrop-filter:blur(22px) saturate(142%); }.pm-automation-library { grid-row:1 / 3; padding:13px 10px; border-right:1px solid var(--pm-border); background:rgba(3,6,11,.19); }.pm-library-title { color:var(--pm-text); font-size:10px; font-weight:620; margin:0 2px 10px; }.pm-library-search { height:28px; display:flex; align-items:center; gap:6px; color:var(--pm-text-muted); border:1px solid var(--pm-border); border-radius:6px; padding:0 7px; font-size:8px; background:rgba(0,0,0,.16); }.pm-automation-library section { display:grid; gap:3px; margin-top:14px; }.pm-automation-library section small { color:var(--pm-text-muted); font:8px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing:.08em; text-transform:uppercase; margin:0 3px 3px; }.pm-automation-library section button { display:flex; align-items:center; gap:7px; padding:6px; border:0; border-radius:5px; color:var(--pm-text-secondary); background:transparent; font-size:8px; text-align:left; }.pm-automation-library section button:hover { color:var(--pm-text); background:rgba(255,255,255,.06); }.pm-node-letter,.pm-node-symbol { width:20px; height:20px; flex:none; display:grid; place-items:center; border:1px solid var(--pm-border); border-radius:5px; color:var(--pm-accent); background:var(--pm-accent-soft); font:10px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-node-letter.warning,.pm-node-symbol.warning { color:var(--pm-warning); background:color-mix(in srgb,var(--pm-warning) 11%,transparent); }.pm-node-letter.success,.pm-node-symbol.success { color:var(--pm-success); background:color-mix(in srgb,var(--pm-success) 11%,transparent); }.pm-node-letter.danger { color:var(--pm-danger); background:color-mix(in srgb,var(--pm-danger) 11%,transparent); }.pm-automation-canvas { position:relative; overflow:hidden; background-color:rgba(4,7,12,.34); background-image:radial-gradient(color-mix(in srgb,var(--pm-text-muted) 33%,transparent) .65px,transparent .65px); background-size:17px 17px; }.pm-canvas-tools { position:absolute; z-index:4; top:11px; left:11px; display:flex; gap:5px; }.pm-canvas-tools button { height:26px; padding:0 7px; border:1px solid var(--pm-border); border-radius:5px; color:var(--pm-text-muted); background:rgba(14,18,26,.84); font-size:8px; }.pm-canvas-tools button.is-active { color:var(--pm-accent); border-color:color-mix(in srgb,var(--pm-accent) 45%,var(--pm-border)); background:var(--pm-accent-soft); }.pm-draft-tag { position:absolute; z-index:4; top:12px; right:12px; color:var(--pm-warning); border:1px solid color-mix(in srgb,var(--pm-warning) 40%,var(--pm-border)); border-radius:4px; padding:4px 5px; background:color-mix(in srgb,var(--pm-warning) 10%,rgba(12,15,20,.85)); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-workflow-lines { position:absolute; inset:0; z-index:0; width:100%; height:100%; overflow:visible; }.pm-workflow-lines path { fill:none; stroke:color-mix(in srgb,var(--pm-text-secondary) 55%,transparent); stroke-width:1.5; stroke-dasharray:5 5; }.pm-workflow-lines path.yes { stroke:var(--pm-success); stroke-dasharray:none; }.pm-workflow-lines path.no { stroke:var(--pm-text-muted); }.pm-flow-label { position:absolute; z-index:2; top:25%; left:57%; border:1px solid var(--pm-border); border-radius:4px; padding:3px 4px; color:var(--pm-success); background:var(--pm-glass-strong); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-flow-label.no { top:63%; color:var(--pm-text-muted); }.pm-flow-node { position:absolute; z-index:2; width:170px; display:grid; grid-template-columns:22px minmax(0,1fr); gap:7px; padding:8px; text-align:left; color:var(--pm-text); border:1px solid var(--pm-border-strong); border-radius:8px; background:linear-gradient(140deg,rgba(255,255,255,.09),rgba(255,255,255,.025)),var(--pm-glass-strong); box-shadow:0 10px 25px rgba(0,0,0,.23); }.pm-flow-node:hover { border-color:var(--pm-accent); }.pm-flow-node.is-selected { border-color:var(--pm-accent); box-shadow:0 0 0 2px var(--pm-accent-soft),0 10px 25px rgba(0,0,0,.24); }.pm-flow-node.trigger { left:6%; top:34%; }.pm-flow-node.condition { left:34%; top:34%; }.pm-flow-node.notify { left:65%; top:16%; }.pm-flow-node.review { left:65%; top:58%; }.pm-flow-node>span:nth-child(2) { min-width:0; display:grid; gap:2px; }.pm-flow-node strong { font-size:8px; font-weight:610; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.pm-flow-node small { color:var(--pm-text-muted); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-flow-node em { grid-column:1/-1; margin-top:2px; color:var(--pm-text-secondary); border:1px solid var(--pm-border); border-radius:4px; padding:4px; background:rgba(2,4,8,.19); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; font-style:normal; }.pm-flow-end { position:absolute; left:89%; top:40%; z-index:2; width:93px; display:grid; grid-template-columns:18px 1fr; gap:5px; align-items:center; padding:7px; border:1px solid var(--pm-border); border-radius:7px; background:var(--pm-glass-strong); }.pm-flow-end span { color:var(--pm-accent); font:12px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-flow-end strong { font-size:8px; }.pm-flow-end small { grid-column:2; color:var(--pm-text-muted); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-zoom { position:absolute; right:10px; bottom:10px; z-index:3; color:var(--pm-text-secondary); border:1px solid var(--pm-border); border-radius:5px; padding:6px 7px; background:var(--pm-glass-strong); font:8px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-node-inspector { grid-column:3; grid-row:1/3; min-width:0; border-left:1px solid var(--pm-border); background:rgba(3,6,11,.17); }.pm-node-inspector>header { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:12px; border-bottom:1px solid var(--pm-border); }.pm-node-inspector>header small { display:block; color:var(--pm-text-muted); font-size:8px; }.pm-node-inspector>header h2 { margin:3px 0 0; font-size:11px; letter-spacing:-.02em; }.pm-node-inspector>header>svg { color:var(--pm-text-muted); }.pm-node-inspector nav { display:flex; gap:11px; padding:0 12px; border-bottom:1px solid var(--pm-border); }.pm-node-inspector nav button { padding:9px 0; color:var(--pm-text-muted); border:0; border-bottom:2px solid transparent; background:transparent; font-size:8px; }.pm-node-inspector nav button.is-active { color:var(--pm-accent); border-color:var(--pm-accent); }.pm-inspector-content { padding:12px; }.pm-inspector-content label { display:grid; gap:5px; margin-bottom:10px; color:var(--pm-text-secondary); font-size:8px; }.pm-inspector-content input,.pm-inspector-content textarea { width:100%; border:1px solid var(--pm-border); border-radius:6px; background:rgba(2,4,8,.18); color:var(--pm-text); padding:7px; font-size:8px; resize:vertical; }.pm-inspector-divider { height:1px; background:var(--pm-border); margin:12px 0; }.pm-inspector-content h3 { margin:10px 0 5px; font-size:8px; }.pm-inspector-content pre { margin:0; border:1px solid var(--pm-border); border-radius:5px; padding:7px; color:var(--pm-text-secondary); background:rgba(2,4,8,.18); font:7px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; white-space:pre-wrap; }.pm-inspector-warning { color:var(--pm-warning); font-size:7px; line-height:1.5; }.pm-execution-drawer { grid-column:2; grid-row:2; display:grid; grid-template-columns:183px minmax(0,1fr); border-top:1px solid var(--pm-border); background:rgba(4,7,12,.2); }.pm-execution-drawer>aside { padding:10px; border-right:1px solid var(--pm-border); }.pm-execution-drawer>aside header { color:var(--pm-text); font-size:9px; font-weight:610; margin-bottom:7px; }.pm-execution-drawer>aside button { width:100%; display:flex; align-items:center; gap:6px; padding:6px; color:var(--pm-text-muted); background:transparent; border:0; border-radius:4px; font-size:7px; text-align:left; }.pm-execution-drawer>aside button.is-active { color:var(--pm-text); background:var(--pm-accent-soft); }.pm-execution-drawer>aside i { width:5px; height:5px; border-radius:50%; background:var(--pm-text-muted); }.pm-execution-drawer>aside button.is-active i { background:var(--pm-warning); }.pm-execution-drawer>aside span { margin-left:auto; color:var(--pm-text-muted); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-trace { padding:10px 12px; min-width:0; }.pm-trace>header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:7px; }.pm-trace>header>div { display:flex; align-items:center; gap:6px; }.pm-trace>header strong { font-size:9px; }.pm-trace>header span { color:var(--pm-warning); border:1px solid color-mix(in srgb,var(--pm-warning) 35%,var(--pm-border)); border-radius:3px; padding:3px 4px; font:7px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-trace>header button { color:var(--pm-text-muted); border:1px solid var(--pm-border); border-radius:4px; padding:4px 5px; background:transparent; font-size:7px; }.pm-trace-grid { display:grid; grid-template-columns:128px minmax(0,1fr); gap:8px; }.pm-step-list,.pm-output-box { border:1px solid var(--pm-border); border-radius:5px; padding:5px; background:rgba(2,4,8,.17); }.pm-step-list { display:grid; gap:2px; }.pm-step-list span { display:flex; align-items:center; gap:6px; color:var(--pm-text-muted); padding:4px; font-size:7px; }.pm-step-list i { width:5px; height:5px; border-radius:50%; background:var(--pm-text-muted); }.pm-step-list span.is-done i { background:var(--pm-success); }.pm-step-list span.is-active { color:var(--pm-text); }.pm-step-list span.is-active i { background:var(--pm-accent); box-shadow:0 0 0 3px var(--pm-accent-soft); }.pm-output-box>div { display:flex; justify-content:space-between; color:var(--pm-text-muted); font-size:7px; }.pm-output-box pre { margin:5px 0 0; color:var(--pm-text-secondary); font:7px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; white-space:pre-wrap; }.pm-output-box p { margin:4px 0 0; color:var(--pm-warning); font-size:7px; line-height:1.4; }

@media (max-width: 1120px) { .pm-main-column .pm-topbar{padding:0 17px}.pm-view,.pm-page{padding:22px 18px 32px}.pm-overview-layout{grid-template-columns:minmax(0,1.35fr) 255px}.pm-automation-layout{grid-template-columns:158px minmax(0,1fr) 225px}.pm-flow-node{width:150px}.pm-flow-end{display:none}.pm-appearance-layout{grid-template-columns:minmax(0,1fr) 280px} }
@media (max-width: 850px) { .pm-overview-layout,.pm-review-grid,.pm-appearance-layout{grid-template-columns:1fr}.pm-overview-dock{grid-template-columns:1fr 1fr}.pm-automation-layout{grid-template-columns:1fr;grid-template-rows:auto 430px auto auto}.pm-automation-library{grid-row:auto;border-right:0;border-bottom:1px solid var(--pm-border);display:flex;gap:10px;overflow:auto}.pm-automation-library .pm-library-title,.pm-automation-library .pm-library-search{display:none}.pm-automation-library section{display:flex;gap:3px;margin:0}.pm-automation-library section small{display:none}.pm-node-inspector{grid-column:auto;grid-row:auto;border-left:0;border-top:1px solid var(--pm-border)}.pm-execution-drawer{grid-column:auto;grid-row:auto}.pm-task-table{min-width:650px}.pm-theme-card-grid{grid-template-columns:1fr}.pm-state-strip{grid-template-columns:1fr 1fr}.pm-state-strip>div:nth-child(2){border-right:0}.pm-state-strip>div:nth-child(-n+2){border-bottom:1px solid var(--pm-border)} }
@media (max-width: 780px) { .pm-main-column .pm-topbar{padding:0 12px}.pm-view,.pm-page{padding:18px 12px 28px}.pm-view-heading,.pm-page-heading{align-items:flex-start;flex-direction:column}.pm-view-heading h1,.pm-page-heading h1{font-size:22px}.pm-overview-dock{grid-template-columns:1fr}.pm-topbar-actions .pm-theme-trigger span{display:none}.pm-primary-button{padding:0 8px}.pm-command-trigger{width:150px}.pm-form-grid{grid-template-columns:1fr}.pm-field-wide{grid-column:auto}.pm-theme-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pm-custom-accent{grid-template-columns:1fr}.pm-activity-panel{overflow:auto}.pm-state-strip{min-width:560px}.pm-topbar-actions{gap:5px}.pm-topbar-actions .pm-primary-button{font-size:0}.pm-topbar-actions .pm-primary-button svg{width:15px;height:15px} }


/* Authentication is part of the same glass system, outside the authenticated shell. */
.pm-auth-shell { min-height:100vh; position:relative; overflow:hidden; display:grid; place-items:center; padding:24px; background:radial-gradient(circle at 75% 8%,rgba(var(--pm-accent-rgb),.22),transparent 28rem),radial-gradient(circle at 15% 100%,rgba(var(--pm-accent-rgb),.09),transparent 26rem),linear-gradient(145deg,var(--pm-canvas-deep),var(--pm-canvas)); }
.pm-auth-orb { position:absolute; width:30rem; height:30rem; border-radius:50%; pointer-events:none; filter:blur(34px); opacity:.26; background:var(--pm-accent); }.pm-auth-orb-one { top:-22rem; right:-13rem; }.pm-auth-orb-two { bottom:-25rem; left:-16rem; opacity:.13; }
.pm-auth-card { position:relative; z-index:1; width:min(430px,100%); padding:25px; border:1px solid var(--pm-border-strong); border-radius:18px; background:linear-gradient(140deg,rgba(255,255,255,.15),rgba(255,255,255,.035) 32%,rgba(255,255,255,.025)),var(--pm-glass-strong); box-shadow:var(--pm-shadow-float); backdrop-filter:blur(32px) saturate(155%); }.pm-auth-card header h1 { margin:12px 0 5px; color:var(--pm-text); font-size:24px; letter-spacing:-.045em; line-height:1.1; }.pm-auth-card header>p { margin:0; color:var(--pm-text-secondary); font-size:10px; }.pm-auth-brand { display:flex; align-items:center; gap:8px; color:var(--pm-text); font-size:12px; font-weight:650; }.pm-auth-brand>span { width:25px; height:25px; display:grid; place-items:center; border:1px solid rgba(var(--pm-accent-rgb),.44); border-radius:7px; color:var(--pm-accent); background:var(--pm-accent-soft); font:700 11px ui-monospace,SFMono-Regular,Consolas,monospace; }.pm-auth-tabs { display:grid; grid-template-columns:1fr 1fr; gap:3px; margin:20px 0 16px; padding:3px; border:1px solid var(--pm-border); border-radius:8px; background:rgba(0,0,0,.14); }.pm-auth-tabs button { min-height:30px; border:0; border-radius:5px; color:var(--pm-text-muted); background:transparent; font-size:9px; }.pm-auth-tabs button.is-active { color:var(--pm-text); background:rgba(255,255,255,.09); box-shadow:inset 0 1px rgba(255,255,255,.08); }.pm-auth-card form { display:grid; gap:13px; }.pm-auth-card form>div { min-width:0; }.pm-auth-card label { display:block; margin-bottom:5px; color:var(--pm-text-secondary) !important; font-size:9px !important; font-weight:600 !important; }.pm-auth-card input { width:100%; height:37px; padding:0 10px; color:var(--pm-text) !important; border:1px solid var(--pm-border) !important; border-radius:7px !important; background:rgba(2,4,8,.26) !important; font-size:10px; }.pm-auth-card input::placeholder { color:var(--pm-text-muted); }.pm-auth-card form button[type=submit] { width:100%; min-height:37px; margin-top:3px; border:1px solid color-mix(in srgb,var(--pm-accent) 78%,white 22%); border-radius:7px; color:var(--pm-accent-ink); background:var(--pm-accent) !important; box-shadow:0 8px 22px var(--pm-accent-glow),inset 0 1px rgba(255,255,255,.3); font-size:10px; font-weight:650; }.pm-auth-card form button[type=submit]:hover { filter:brightness(1.06); }.pm-auth-card form .text-red-600,.pm-auth-card form .dark\:text-red-400 { color:var(--pm-danger) !important; font-size:8px; }.pm-auth-card footer { display:flex; align-items:center; gap:6px; margin-top:18px; padding-top:13px; color:var(--pm-text-muted); border-top:1px solid var(--pm-border); font-size:8px; }.pm-auth-card footer svg { color:var(--pm-accent); }.pm-auth-card .bg-red-500{background:var(--pm-danger)!important}.pm-auth-card .bg-yellow-500{background:var(--pm-warning)!important}.pm-auth-card .bg-blue-500{background:var(--pm-accent)!important}.pm-auth-card .bg-green-500{background:var(--pm-success)!important}


html[data-pm-theme="porcelain"] {
  color-scheme: light;
  --pm-canvas: #eef2f7;
  --pm-canvas-deep: #e3e9f2;
  --pm-rail: rgba(244, 247, 252, 0.82);
  --pm-glass: rgba(255, 255, 255, 0.72);
  --pm-glass-strong: rgba(255, 255, 255, 0.88);
  --pm-border: rgba(25, 42, 70, 0.14);
  --pm-border-strong: rgba(25, 42, 70, 0.24);
  --pm-text: #101826;
  --pm-text-secondary: #435268;
  --pm-text-muted: #6c7c93;
  --pm-shadow: 0 16px 38px rgba(15, 23, 42, 0.08), inset 0 1px rgba(255, 255, 255, 0.75);
  --pm-shadow-float: 0 24px 56px rgba(15, 23, 42, 0.16), inset 0 1px rgba(255, 255, 255, 0.85);
}

.pm-accent-picker-label {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 31px;
  cursor: pointer;
}
.pm-accent-picker-label .pm-accent-preview {
  display: block;
  width: 100%;
  height: 100%;
}
.pm-accent-picker-label input[type="color"] {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  opacity: 0 !important;
  pointer-events: auto !important;
  cursor: pointer;
}
.pm-custom-color-large {
  grid-template-columns: 34px 1fr auto !important;
}

.pm-mobile-nav-toggle { display: none; margin-left: auto; }
@media (max-width: 780px) {
  .pm-mobile-nav-toggle { display: inline-grid; }
  .pm-sidebar.is-mobile-open .pm-nav-group,
  .pm-sidebar.is-mobile-open .pm-user-menu { display: grid; grid-column: 1 / -1; }
  .pm-sidebar.is-mobile-open .pm-user-menu { display: flex; }
}

```

<!-- END FILE: frontend/src/index.css -->

<!-- BEGIN FILE: frontend/src/App.tsx -->

## FILE: frontend/src/App.tsx

```tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";

export default function App() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <Login />;
}

```

<!-- END FILE: frontend/src/App.tsx -->

<!-- BEGIN FILE: frontend/src/main.tsx -->

## FILE: frontend/src/main.tsx

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./theme/ThemeProvider";
import { AppShell } from "./components/layout/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ReviewQueue from "./pages/ReviewQueue";
import AutomationStudio from "./pages/AutomationStudio";
import Appearance from "./pages/Appearance";
import Users from "./pages/Users";
import GitCommits from "./pages/GitCommits";
import Canvas from "./pages/Canvas";
import CanvasList from "./pages/CanvasList";
import ImportExport from "./pages/ImportExport";
import Connectors from "./pages/Connectors";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } } });

function ProtectedWorkspace() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function Root() {
  const { user } = useAuth();
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<ProtectedWorkspace />}>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/review" element={<ReviewQueue />} />
      <Route path="/automation" element={<AutomationStudio />} />
      <Route path="/appearance" element={<Appearance />} />
      <Route path="/users" element={<Users />} />
      <Route path="/git-commits" element={<GitCommits />} />
      <Route path="/import-export" element={<ImportExport />} />
      <Route path="/connectors" element={<Connectors />} />
      <Route path="/canvas" element={<Canvas />} />
      <Route path="/canvas/:id" element={<Canvas />} />
      <Route path="/canvases" element={<CanvasList />} />
      <Route path="/canvases/:projectId" element={<CanvasList />} />
    </Route>
    <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
  </Routes>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><ThemeProvider><Root /></ThemeProvider></AuthProvider></BrowserRouter></QueryClientProvider></React.StrictMode>);

```

<!-- END FILE: frontend/src/main.tsx -->

<!-- BEGIN FILE: frontend/src/hooks/useAuth.tsx -->

## FILE: frontend/src/hooks/useAuth.tsx

```tsx
import { createContext, useContext, useState, type ReactNode } from "react";

interface User { user_id: string; username: string; email: string; role: string; status: string; created_at: string; }
interface AuthContextType { user: User | null; login: (user: User, token?: string) => void; logout: () => void; }
const AuthContext = createContext<AuthContextType | null>(null);

function readStoredUser(): User | null {
  try { const stored = localStorage.getItem("pm_user"); return stored ? JSON.parse(stored) as User : null; } catch { localStorage.removeItem("pm_user"); return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const login = (nextUser: User, token?: string) => { setUser(nextUser); localStorage.setItem("pm_user", JSON.stringify(nextUser)); if (token) localStorage.setItem("pm_token", token); };
  const logout = () => { setUser(null); localStorage.removeItem("pm_user"); localStorage.removeItem("pm_token"); };
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}
export function getToken(): string | null { return localStorage.getItem("pm_token"); }
export function useAuth() { const ctx = useContext(AuthContext); if (!ctx) throw new Error("useAuth must be used within AuthProvider"); return ctx; }

```

<!-- END FILE: frontend/src/hooks/useAuth.tsx -->

<!-- BEGIN FILE: frontend/package.json -->

## FILE: frontend/package.json

```json
{
  "name": "project-manager-frontend",
  "version": "1.0.0",
  "description": "Project Manager frontend (React 19 + TypeScript + Vite + Tailwind)",
  "type": "module",
  "scripts": {
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "dev:full": "concurrently \"cd ../backend && npm run dev\" \"npx vite --port 5173 --host 0.0.0.0\""
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/utilities": "^3.2.2",
    "@tanstack/react-query": "^5.83.0",
    "autoprefixer": "^10.6.2",
    "bcryptjs": "^3.0.2",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.2",
    "postcss": "^8.5.32",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.7.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@tailwindcss/forms": "^0.5.3",
    "@tailwindcss/typography": "^0.5.15",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^5.1.4",
    "tailwindcss": "^3.4.11",
    "typescript": "^5.9.3",
    "vite": "^6.3.5"
  }
}
```

<!-- END FILE: frontend/package.json -->
