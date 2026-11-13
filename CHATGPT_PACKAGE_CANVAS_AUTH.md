# CHATGPT PACKAGE — PHASE 6 CANVAS AUTHORIZATION (BACKEND)

Paste this entire document into ChatGPT. It contains the detailed prompt plus the complete current source files.

---

# PART 1 — DETAILED PROMPT

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


---

# PART 2 — CURRENT SOURCE FILES


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


## FILE: backend/src/database/index.ts

```ts
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let db: InstanceType<typeof DatabaseSync> | null = null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(path.join(__dirname, "schema.sql"), "utf-8");

export function getDb(): InstanceType<typeof DatabaseSync> {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "app.db");
    db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    // Apply schema on first connection
    db.exec(schemaSql);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

```


## FILE: backend/src/database/migrate.ts

```ts
import { getDb } from "./index.ts";

// Run schema initialization
getDb();

console.log("Database initialized successfully.");
process.on("SIGINT", () => {
  getDb().close();
  process.exit(0);
});

```


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
