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
