# CHATGPT PACKAGE — PHASE 6 CANVAS CONTRACT, REGRESSION & INTEGRATION COVERAGE

> Rebuilt 2026-11-11 against the live tree after the Canvas reliability patch (PM-P6-04).
> Adds coverage for `PUT /api/canvas/connections/:connId` and refreshes `canvas.service.ts`
> and `canvas.routes.ts`. All ten embedded source blocks verified byte-identical to live source.

Paste this entire document into ChatGPT. It contains the detailed prompt plus the complete current source files.

---

# PART 1 — DETAILED PROMPT

# ChatGPT Code-Generation Prompt — Canvas Contract, Regression & Integration Coverage (Detailed)

**Paste this entire document into ChatGPT regular chat.**
**Do NOT shorten it. Do NOT ask clarifying questions. Return complete replacement files.**

---

## 0. Your role and output contract

You are adding backend test coverage to an existing TypeScript/Express/SQLite application.

- Return **complete replacement files** for every file listed in §7.
- Do **not** return snippets, diffs, or "here is the changed part".
- Do **not** change any application source file that is not listed in §7.
- Do **not** add dependencies.
- Do **not** run git, commits, or pushes.
- Do **not** invent APIs, tables, or environment variables.
- If something in this prompt is ambiguous, choose the **most conservative** interpretation that preserves existing behavior and state it in your final notes.

Your output must be a single response with:

1. A short summary of the approach.
2. Complete file contents, each in its own fenced code block with a header line like `FILE: backend/src/tests/canvas.contract.test.ts`.
3. A final "Verification checklist" section.

---

## 1. Project context

**Application:** Project Manager
**Repository root:** `<workspace>`
**Stack:**
- Backend: Express 4 + TypeScript
- Database: SQLite via `node:sqlite`
- Auth: JWT in `Authorization: Bearer ${token}` header
- Test runner: `node:test` + `supertest`

**Test command:** `npm test --prefix backend` → `node --test src/tests/`

**Existing tests:**
- `backend/src/tests/backend.test.ts` — MVP acceptance tests plus a `Canvas Authorization` block.
- `backend/src/tests/minimal.test.ts` — a minimal sanity test.

---

## 2. Approved scope (binding)

The owner accepted the Phase 3 Canvas specification and its deferred-item register. This card covers the **Phase 6 entry criterion P6-PC-09**: "Canvas API/hook/component test coverage; reconciled test count."

### 2.1 In scope

- **Canvas API contract coverage** for all eleven endpoint classes:
  1. `POST /api/canvas`
  2. `GET /api/canvas`
  3. `GET /api/canvas/:id`
  4. `PUT /api/canvas/:id`
  5. `DELETE /api/canvas/:id`
  6. `POST /api/canvas/:id/items`
  7. `PUT /api/canvas/items/:itemId`
  8. `DELETE /api/canvas/items/:itemId`
  9. `POST /api/canvas/:id/connections`
  10. `DELETE /api/canvas/connections/:connId`
  11. `PUT /api/canvas/connections/:connId`
- **Authorization coverage** for owner, editor, viewer, commenter, agent, and non-member.
- **Persistence coverage:** verify the database state after mutations.
- **Mutation-failure coverage:** 400 / 403 / 404 / 422 paths and structured error bodies.
- **Primary-journey integration coverage:** create project → create canvas → add items → connect → edit → delete.

### 2.2 Out of scope (do NOT implement)

- **Version-based conflict detection** (`version` column, `If-Match`, `409 VERSION_CONFLICT`) — DECISION-REQUIRED.
- **Pagination** (`limit` / `offset` / `page`) — not implemented in the API.
- **Audit-log assertions** — `audit_logs` has no writer in the current implementation.
- **Frontend tests** — the frontend has no test runner and adding one would require a new dependency. Do not add one.
- **Automation Studio** — never touched.

If a test case from the spec depends on an out-of-scope feature, **skip it with a comment** explaining why. Do not implement the feature.

---

## 3. Current code facts you must respect

### 3.1 `backend/src/tests/backend.test.ts`

- Uses `import { app } from "../index.ts";` and `import { getDb } from "../database/index.ts";`.
- Uses `before(() => { getDb(); });`.
- Has helpers: `registerAndLogin`, `getAuthToken`, `getUserIdByEmail`, `createProject`, `createCanvasViaApi`, `addProjectMember`.
- Has a `describe("Canvas Authorization")` block with 8 tests.

### 3.2 `backend/src/routes/canvas.routes.ts`

- All routes use `router.use(requireAuth)`.
- `requireCanvasAccess(canvasId, userId, permission, res)` returns the canvas or sends 404/403.
- `PUT /api/canvas/connections/:connId` updates `connection_type` and/or `style`; it
  requires at least one field and is authorized with `requireCanvasAccess(..., "write")`.
- `connection_type` is validated as `"line"` or `"arrow"` on both create and update.
- Errors use `{ error: string }`.
- `CanvasServiceError` carries `statusCode` 400 or 404.

### 3.3 `backend/src/services/canvas.service.ts`

- `createCanvas(projectId, name, description, createdBy)` — 404 if the project is missing.
- `listCanvases(projectId | null)`.
- `getCanvasById`, `getCanvasWithItems`.
- `updateCanvas(canvasId, { name?, description? })`.
- `deleteCanvas(canvasId)`.
- `addItem(canvasId, item)` — validates `item_type`, task link, canvas existence; 400 on failure.
- `updateItem(itemId, updates)` — validates fields and task link.
- `deleteItem(itemId)`.
- `addConnection(canvasId, fromItemId, toItemId, connectionType, style)` — validates canvas, endpoints, self/duplicate.
- `updateConnection(connId, { connection_type?, style? })` — validates and returns the updated connection.
- `deleteConnection(connId)`.
- `validateConnectionType` restricts `connection_type` to `"line"` or `"arrow"`.
- Every mutation bumps `canvases.updated_at`.

### 3.4 `backend/src/services/projectAccess.service.ts`

- `getProjectAccess(projectId, userId)` returns `{ role, canRead, canWrite, canDelete }` or `null`.
- Creator is always owner.

### 3.5 `backend/src/database/schema.sql`

- `project_members(project_id, user_id, role, created_at)`.
- `canvases(canvas_id, project_id, name, description, created_by, created_at, updated_at)`.
- `canvas_items(...)`, `canvas_connections(...)`.

---

## 4. Required implementation

### 4.1 Add a Canvas contract test file

Create `backend/src/tests/canvas.contract.test.ts` with a `describe("Canvas Contract")` block covering:

1. **POST /api/canvas**
   - 201 with a valid project.
   - 400 when `project_id` is missing or empty.
   - 400 when `name` is missing or empty.
   - 404 when the project does not exist.
   - 403 when the caller cannot write.
2. **GET /api/canvas**
   - 200 with `project_id` returns only that project's canvases.
   - 200 without `project_id` returns only canvases the caller can read.
   - 404 when the project does not exist.
   - 404 when the caller cannot read the project.
3. **GET /api/canvas/:id**
   - 200 with items and connections.
   - 404 when the canvas does not exist.
   - 404 when the caller cannot read the project.
4. **PUT /api/canvas/:id**
   - 200 updating name/description.
   - 400 for an empty name.
   - 404 when the canvas does not exist.
   - 403 when the caller cannot write.
5. **DELETE /api/canvas/:id**
   - 200 and the canvas is gone.
   - 404 when the canvas does not exist.
   - 403 when the caller cannot delete.
6. **POST /api/canvas/:id/items**
   - 201 with a valid item.
   - 400 for an unsupported `item_type`.
   - 400 for a cross-project `task_id`.
   - 404 when the canvas does not exist.
   - 403 when the caller cannot write.
7. **PUT /api/canvas/items/:itemId**
   - 200 updating a field.
   - 404 when the item does not exist.
   - 403 when the caller cannot write.
8. **DELETE /api/canvas/items/:itemId**
   - 200 and the item is gone.
   - 404 when the item does not exist.
   - 403 when the caller cannot delete.
9. **POST /api/canvas/:id/connections**
   - 201 with valid endpoints.
   - 400 for a self-connection.
   - 400 for a cross-canvas endpoint.
   - 400 for a duplicate connection.
   - 404 when the canvas does not exist.
   - 403 when the caller cannot write.
10. **DELETE /api/canvas/connections/:connId**
    - 200 and the connection is gone.
    - 404 when the connection does not exist.
    - 403 when the caller cannot delete.
11. **PUT /api/canvas/connections/:connId**
    - 200 changing `connection_type` between `line` and `arrow`.
    - 200 changing `style`.
    - 400 for an invalid `connection_type`.
    - 400 when neither `connection_type` nor `style` is provided.
    - 404 when the connection does not exist.
    - 403 when the caller cannot write.

### 4.2 Add persistence assertions

After each successful mutation, verify the database state directly with `getDb()`:

- `canvases` row exists with the expected `project_id`, `name`, and `updated_at`.
- `canvas_items` row exists with the expected fields.
- `canvas_connections` row exists with the expected endpoints.
- Deletion removes the row (and cascades connections for items).

### 4.3 Add mutation-failure coverage

- 400 responses include `{ error: string }` and no raw SQL text.
- 404 responses do not leak resource existence.
- 403 responses are returned for authenticated non-writers.

### 4.4 Add primary-journey integration coverage

Add a `describe("Canvas Primary Journey")` block:

1. Owner creates a project.
2. Owner creates a canvas.
3. Owner adds two items.
4. Owner connects the items.
5. Owner updates an item.
6. Owner changes the connection type (if the endpoint exists).
7. Owner deletes the connection.
8. Owner deletes an item (cascade removes its connections).
9. Owner deletes the canvas.
10. Viewer can read but not write at each step.
11. Non-member gets 404 at each step.

### 4.5 Preserve the existing tests

- Keep the existing `backend.test.ts` content intact unless a minimal, clearly-stated adjustment is required.
- If you modify it, explain why in your final notes.

---

## 5. Constraints

- Do **not** change application source files (`routes`, `services`, `schema.sql`, `middleware`, `index.ts`).
- Do **not** add dependencies.
- Do **not** add a test runner or test configuration.
- Do **not** use `any` in new code unless the existing test file already does.
- Keep TypeScript strict-mode compatible (`noUncheckedIndexedAccess` is on).
- Use `.ts` import extensions exactly as the existing tests do.
- Do **not** run the tests; the project owner will run them.

---

## 6. Acceptance criteria

1. Every Canvas endpoint class has at least one success test and one failure test.
2. Authorization is verified for owner, editor, viewer, and non-member.
3. Persistence is verified by querying the database after mutations.
4. Mutation failures return structured `{ error: string }` bodies with the correct status codes.
5. A primary-journey integration test covers create → connect → edit → delete.
6. No application source file is changed.
7. No new dependencies are added.
8. `npm run typecheck --prefix backend` exits 0.
9. `npm test --prefix backend` exits 0 with all tests passing.

---

## 7. Files to return (complete replacement code)

Return complete replacement code for:

1. `backend/src/tests/canvas.contract.test.ts` (new file)
2. `backend/src/tests/backend.test.ts` (only if a minimal adjustment is required; otherwise say "no changes")

If you believe another file must change, **stop and explain why** instead of changing it.

---

## 8. Final response format

Return exactly:

```text
## Approach
<2-5 bullets>

## Files
FILE: backend/src/tests/canvas.contract.test.ts
<complete file>

FILE: backend/src/tests/backend.test.ts
<complete file or "no changes">

## Verification checklist
- [ ] npm run typecheck --prefix backend
- [ ] npm test --prefix backend
- [ ] All ten endpoint classes covered
- [ ] Authorization covered
- [ ] Persistence covered
- [ ] Mutation failures covered
- [ ] Primary journey covered
- [ ] No application source changed
- [ ] No new dependencies
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

-- Project-scoped membership. users.role is retained for compatibility
-- and is not used to authorize Canvas operations.
CREATE TABLE IF NOT EXISTS project_members (
    project_id   TEXT NOT NULL REFERENCES projects(project_id),
    user_id      TEXT NOT NULL REFERENCES users(user_id),
    role         TEXT NOT NULL DEFAULT 'viewer',
    created_at   DATETIME NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user
    ON project_members(user_id);

-- Backfill owner memberships for projects that existed before this table.
-- The service also recognizes projects.created_by as owner if a row is absent.
INSERT OR IGNORE INTO project_members (project_id, user_id, role)
SELECT project_id, created_by, 'owner'
FROM projects;

-- Ensure newly created projects also receive their creator's owner membership.
CREATE TRIGGER IF NOT EXISTS trg_projects_owner_membership_after_insert
AFTER INSERT ON projects
BEGIN
    INSERT OR IGNORE INTO project_members (project_id, user_id, role)
    VALUES (NEW.project_id, NEW.created_by, 'owner');
END;

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

CREATE INDEX IF NOT EXISTS idx_login_history_user
    ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_time
    ON login_history(logged_in_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_title_project
    ON tasks(project_id, title);

CREATE TABLE IF NOT EXISTS git_commits (
    commit_id       TEXT PRIMARY KEY,
    commit_hash     TEXT NOT NULL UNIQUE,
    commit_message  TEXT NOT NULL,
    task_id         TEXT REFERENCES tasks(task_id),
    author          TEXT,
    committed_at    DATETIME NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_git_commits_task
    ON git_commits(task_id);
CREATE INDEX IF NOT EXISTS idx_git_commits_hash
    ON git_commits(commit_hash);

-- Canvas workspaces (linked to projects).
--
-- NOT NULL applies to newly created databases. CREATE TABLE IF NOT EXISTS
-- does not modify an existing canvases table. Existing databases therefore
-- retain any legacy NULL project_id rows; the service rejects NULL on create
-- and the authorization routes hide those legacy rows.
CREATE TABLE IF NOT EXISTS canvases (
    canvas_id     TEXT PRIMARY KEY,
    project_id    TEXT NOT NULL REFERENCES projects(project_id),
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

CREATE INDEX IF NOT EXISTS idx_canvas_items_canvas
    ON canvas_items(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_conn_canvas
    ON canvas_connections(canvas_id);

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

CREATE INDEX IF NOT EXISTS idx_connectors_provider
    ON connectors(provider);
CREATE INDEX IF NOT EXISTS idx_connectors_status
    ON connectors(status);
CREATE INDEX IF NOT EXISTS idx_connector_configs_connector
    ON connector_configs(connector_id);

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

CREATE INDEX IF NOT EXISTS idx_ui_layouts_user
    ON ui_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_ui_layouts_page
    ON ui_layouts(page);
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

## FILE: backend/src/services/projectAccess.service.ts

```ts
import { getDb } from "../database/index.ts";

export type ProjectRole =
  | "owner"
  | "editor"
  | "viewer"
  | "commenter"
  | "agent";

export interface ProjectAccess {
  role: ProjectRole;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

interface ProjectCreatorRow {
  created_by: string;
}

interface ProjectMemberRow {
  role: string;
}

const PROJECT_ROLES = new Set<ProjectRole>([
  "owner",
  "editor",
  "viewer",
  "commenter",
  "agent",
]);

function isProjectRole(role: string): role is ProjectRole {
  return PROJECT_ROLES.has(role as ProjectRole);
}

function accessForRole(role: ProjectRole): ProjectAccess {
  const canManage = role === "owner" || role === "editor";

  return {
    role,
    canRead: true,
    canWrite: canManage,
    canDelete: canManage,
  };
}

/**
 * Check whether a project exists.
 *
 * Kept separate from getProjectAccess so routes that accept a project ID
 * can distinguish a missing project (404) from an existing project on which
 * the caller lacks write access (403).
 */
export function projectExists(projectId: string): boolean {
  if (!projectId.trim()) return false;

  const db = getDb();
  const row = db
    .prepare("SELECT project_id FROM projects WHERE project_id = ?")
    .get(projectId);

  return row !== undefined;
}

/**
 * Resolve the caller's access to a project.
 *
 * Project creators are always owners, even if their membership row is absent
 * or contains a different role. Otherwise, access is determined exclusively
 * by project_members; users.role is deliberately not consulted.
 */
export async function getProjectAccess(
  projectId: string,
  userId: string,
): Promise<ProjectAccess | null> {
  if (!projectId.trim() || !userId.trim()) return null;

  const db = getDb();

  const project = db
    .prepare(
      "SELECT created_by FROM projects WHERE project_id = ?",
    )
    .get(projectId) as ProjectCreatorRow | undefined;

  if (!project) return null;

  if (project.created_by === userId) {
    return accessForRole("owner");
  }

  const membership = db
    .prepare(
      `SELECT role
       FROM project_members
       WHERE project_id = ? AND user_id = ?`,
    )
    .get(projectId, userId) as ProjectMemberRow | undefined;

  if (!membership || !isProjectRole(membership.role)) {
    return null;
  }

  return accessForRole(membership.role);
}
```

## FILE: backend/src/services/canvas.service.ts

```ts
import { getDb } from "../database/index.ts";
import { randomUUID } from "node:crypto";

// --- Types ---

export interface Canvas {
  canvas_id: string;
  project_id: string;
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

type CanvasServiceStatus = 400 | 404;

export class CanvasServiceError extends Error {
  public readonly statusCode: CanvasServiceStatus;

  constructor(statusCode: CanvasServiceStatus, message: string) {
    super(message);
    this.name = "CanvasServiceError";
    this.statusCode = statusCode;
  }
}

interface CanvasDbRow {
  canvas_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CanvasItemDbRow {
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

interface CanvasConnectionDbRow {
  connection_id: string;
  canvas_id: string;
  from_item_id: string;
  to_item_id: string;
  connection_type: string;
  style: string | null;
  created_at: string;
}

interface TaskProjectRow {
  project_id: string;
}

interface CanvasItemInput {
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

interface CanvasItemUpdates {
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

interface CanvasConnectionUpdates {
  connection_type?: string;
  style?: string | null;
}

const SUPPORTED_ITEM_TYPES = new Set([
  "square",
  "rectangle",
  "circle",
  "diamond",
  "triangle",
  "text",
  "task",
  "line",
  "arrow",
]);

// --- Validation and internal helpers ---

function badRequest(message: string): never {
  throw new CanvasServiceError(400, message);
}

function notFound(message: string): never {
  throw new CanvasServiceError(404, message);
}

function validateNonEmptyString(
  value: unknown,
  fieldName: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    badRequest(`${fieldName} is required`);
  }

  return value;
}

function validateNullableString(
  value: unknown,
  fieldName: string,
): string | null {
  if (value === null) return null;

  if (typeof value !== "string") {
    badRequest(`${fieldName} must be a string or null`);
  }

  return value;
}

function validateFiniteNumber(
  value: unknown,
  fieldName: string,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    badRequest(`${fieldName} must be a finite number`);
  }

  return value;
}

function validateItemType(itemType: unknown): string {
  if (
    typeof itemType !== "string" ||
    !SUPPORTED_ITEM_TYPES.has(itemType)
  ) {
    badRequest("Unsupported canvas item type");
  }

  return itemType;
}

function validateConnectionType(value: unknown): "line" | "arrow" {
  if (value !== "line" && value !== "arrow") {
    badRequest('connection_type must be "line" or "arrow"');
  }

  return value;
}

function validateTaskLink(
  canvas: Canvas,
  taskId: string | null | undefined,
): void {
  if (taskId === undefined || taskId === null) return;

  if (typeof taskId !== "string" || !taskId.trim()) {
    badRequest("task_id must be a non-empty string or null");
  }

  const db = getDb();
  const task = db
    .prepare("SELECT project_id FROM tasks WHERE task_id = ?")
    .get(taskId) as TaskProjectRow | undefined;

  if (!task) {
    badRequest("Task does not exist");
  }

  if (task.project_id !== canvas.project_id) {
    badRequest("Task must belong to the same project as the canvas");
  }
}

function getCanvasOrThrow(canvasId: string): Canvas {
  const canvas = getCanvasById(canvasId);

  if (!canvas) {
    notFound("Canvas not found");
  }

  return canvas;
}

function getCanvasItemOrThrow(itemId: string): CanvasItem {
  const item = getCanvasItemById(itemId);

  if (!item) {
    notFound("Canvas item not found");
  }

  return item;
}

function getCanvasConnectionOrThrow(
  connectionId: string,
): CanvasConnection {
  const connection = getCanvasConnectionById(connectionId);

  if (!connection) {
    notFound("Canvas connection not found");
  }

  return connection;
}

function assertItemBelongsToCanvas(
  itemId: string,
  canvasId: string,
): CanvasItem {
  const item = getCanvasItemOrThrow(itemId);

  if (item.canvas_id !== canvasId) {
    badRequest("Both connection items must belong to the requested canvas");
  }

  return item;
}

function assertConnectionBelongsToCanvas(
  connectionId: string,
  canvasId: string,
): CanvasConnection {
  const connection = getCanvasConnectionOrThrow(connectionId);

  if (connection.canvas_id !== canvasId) {
    badRequest("Connection does not belong to the requested canvas");
  }

  return connection;
}

// --- Canvas operations ---

export function createCanvas(
  projectId: string,
  name: string,
  description: string | null,
  createdBy: string,
): Canvas {
  validateNonEmptyString(projectId, "project_id");
  validateNonEmptyString(name, "name");
  validateNonEmptyString(createdBy, "created_by");

  const db = getDb();
  const project = db
    .prepare("SELECT project_id FROM projects WHERE project_id = ?")
    .get(projectId);

  if (!project) {
    notFound("Project not found");
  }

  const now = new Date().toISOString();
  const canvasId = randomUUID();

  db.prepare(
    `INSERT INTO canvases
      (canvas_id, project_id, name, description, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    canvasId,
    projectId,
    name,
    validateNullableString(description, "description"),
    createdBy,
    now,
    now,
  );

  return getCanvasOrThrow(canvasId);
}

export function getCanvasById(canvasId: string): Canvas | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM canvases WHERE canvas_id = ?")
    .get(canvasId) as CanvasDbRow | undefined;

  return row ? mapCanvas(row) : null;
}

export function getCanvasWithItems(
  canvasId: string,
): CanvasWithItems | null {
  const db = getDb();
  const canvas = getCanvasById(canvasId);

  if (!canvas) return null;

  const items = db
    .prepare(
      `SELECT * FROM canvas_items
       WHERE canvas_id = ?
       ORDER BY z_index ASC`,
    )
    .all(canvasId) as unknown as CanvasItemDbRow[];

  const connections = db
    .prepare(
      "SELECT * FROM canvas_connections WHERE canvas_id = ?",
    )
    .all(canvasId) as unknown as CanvasConnectionDbRow[];

  return {
    ...canvas,
    items: items.map(mapCanvasItem),
    connections: connections.map(mapCanvasConnection),
  };
}

/**
 * With a project ID, return only that project's canvases.
 *
 * A null project ID retains the old service behavior and returns all canvases.
 * The Canvas routes must filter that result by project membership and omit
 * legacy canvases whose project_id is NULL.
 */
export function listCanvases(projectId: string | null): Canvas[] {
  const db = getDb();

  const rows = projectId
    ? db
        .prepare(
          `SELECT * FROM canvases
           WHERE project_id = ?
           ORDER BY updated_at DESC`,
        )
        .all(projectId)
    : db
        .prepare(
          "SELECT * FROM canvases ORDER BY updated_at DESC",
        )
        .all();

  return (rows as unknown as CanvasDbRow[]).map(mapCanvas);
}

export function updateCanvas(
  canvasId: string,
  updates: { name?: string; description?: string | null },
): Canvas | null {
  const db = getDb();
  const existing = getCanvasById(canvasId);

  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(validateNonEmptyString(updates.name, "name"));
  }

  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(
      validateNullableString(updates.description, "description"),
    );
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(canvasId);

  db.prepare(
    `UPDATE canvases
     SET ${fields.join(", ")}
     WHERE canvas_id = ?`,
  ).run(...values);

  return getCanvasById(canvasId);
}

export function deleteCanvas(canvasId: string): boolean {
  const db = getDb();
  const existingCanvas = getCanvasById(canvasId);

  if (!existingCanvas) return false;

  // The row is deleted below, so this timestamp bump is necessarily
  // transient and cannot affect subsequent CanvasList ordering.
  db.prepare(
    "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
  ).run(new Date().toISOString(), canvasId);

  const items = db
    .prepare("SELECT item_id FROM canvas_items WHERE canvas_id = ?")
    .all(canvasId) as unknown as Array<{ item_id: string }>;

  // Preserve the existing cleanup behavior: remove every connection
  // involving a canvas item before deleting the items and canvas.
  for (const item of items) {
    db.prepare(
      `DELETE FROM canvas_connections
       WHERE from_item_id = ? OR to_item_id = ?`,
    ).run(item.item_id, item.item_id);
  }

  db.prepare(
    "DELETE FROM canvas_items WHERE canvas_id = ?",
  ).run(canvasId);

  const result = db
    .prepare("DELETE FROM canvases WHERE canvas_id = ?")
    .run(canvasId);

  return result.changes > 0;
}

// --- Items ---

export function addItem(
  canvasId: string,
  item: CanvasItemInput,
): CanvasItem {
  const canvas = getCanvasOrThrow(canvasId);
  const db = getDb();

  const itemType = validateItemType(item.item_type);
  validateTaskLink(canvas, item.task_id);

  const x =
    item.x === undefined ? 0 : validateFiniteNumber(item.x, "x");
  const y =
    item.y === undefined ? 0 : validateFiniteNumber(item.y, "y");
  const width =
    item.width === undefined
      ? 100
      : validateFiniteNumber(item.width, "width");
  const height =
    item.height === undefined
      ? 100
      : validateFiniteNumber(item.height, "height");
  const rotation =
    item.rotation === undefined
      ? 0
      : validateFiniteNumber(item.rotation, "rotation");
  const zIndex =
    item.z_index === undefined
      ? 0
      : validateFiniteNumber(item.z_index, "z_index");

  if (width <= 0 || height <= 0) {
    badRequest("Canvas item width and height must be greater than zero");
  }

  if (!Number.isInteger(zIndex)) {
    badRequest("z_index must be an integer");
  }

  const content =
    item.content === undefined
      ? null
      : validateNullableString(item.content, "content");
  const style =
    item.style === undefined
      ? null
      : validateNullableString(item.style, "style");

  const now = new Date().toISOString();
  const itemId = randomUUID();

  db.prepare(
    `INSERT INTO canvas_items
      (item_id, canvas_id, item_type, task_id, x, y, width, height,
       rotation, content, style, z_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    itemId,
    canvasId,
    itemType,
    item.task_id ?? null,
    x,
    y,
    width,
    height,
    rotation,
    content,
    style,
    zIndex,
    now,
    now,
  );

  db.prepare(
    "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
  ).run(now, canvasId);

  return getCanvasItemOrThrow(itemId);
}

export function getCanvasItemById(itemId: string): CanvasItem | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM canvas_items WHERE item_id = ?")
    .get(itemId) as CanvasItemDbRow | undefined;

  return row ? mapCanvasItem(row) : null;
}

export function updateItem(
  itemId: string,
  updates: CanvasItemUpdates,
): CanvasItem | null {
  const db = getDb();
  const existingItem = getCanvasItemById(itemId);

  if (!existingItem) return null;

  // Resolve the item's parent canvas before validating task links. The route
  // separately authorizes access against this exact parent canvas.
  const canvas = getCanvasOrThrow(existingItem.canvas_id);

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.item_type !== undefined) {
    fields.push("item_type = ?");
    values.push(validateItemType(updates.item_type));
  }

  if (updates.x !== undefined) {
    fields.push("x = ?");
    values.push(validateFiniteNumber(updates.x, "x"));
  }

  if (updates.y !== undefined) {
    fields.push("y = ?");
    values.push(validateFiniteNumber(updates.y, "y"));
  }

  if (updates.width !== undefined) {
    const width = validateFiniteNumber(updates.width, "width");
    if (width <= 0) {
      badRequest("Canvas item width must be greater than zero");
    }
    fields.push("width = ?");
    values.push(width);
  }

  if (updates.height !== undefined) {
    const height = validateFiniteNumber(updates.height, "height");
    if (height <= 0) {
      badRequest("Canvas item height must be greater than zero");
    }
    fields.push("height = ?");
    values.push(height);
  }

  if (updates.rotation !== undefined) {
    fields.push("rotation = ?");
    values.push(validateFiniteNumber(updates.rotation, "rotation"));
  }

  if (updates.content !== undefined) {
    fields.push("content = ?");
    values.push(validateNullableString(updates.content, "content"));
  }

  if (updates.style !== undefined) {
    fields.push("style = ?");
    values.push(validateNullableString(updates.style, "style"));
  }

  if (updates.z_index !== undefined) {
    const zIndex = validateFiniteNumber(updates.z_index, "z_index");

    if (!Number.isInteger(zIndex)) {
      badRequest("z_index must be an integer");
    }

    fields.push("z_index = ?");
    values.push(zIndex);
  }

  if (updates.task_id !== undefined) {
    validateTaskLink(canvas, updates.task_id);
    fields.push("task_id = ?");
    values.push(updates.task_id);
  }

  if (fields.length === 0) return existingItem;

  const now = new Date().toISOString();
  fields.push("updated_at = ?");
  values.push(now);
  values.push(itemId);

  db.prepare(
    `UPDATE canvas_items
     SET ${fields.join(", ")}
     WHERE item_id = ?`,
  ).run(...values);

  db.prepare(
    "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
  ).run(now, canvas.canvas_id);

  return getCanvasItemById(itemId);
}

export function deleteItem(itemId: string): boolean {
  const db = getDb();
  const existingItem = getCanvasItemById(itemId);

  if (!existingItem) return false;

  // Delete connections involving this item before deleting the item.
  db.prepare(
    `DELETE FROM canvas_connections
     WHERE from_item_id = ? OR to_item_id = ?`,
  ).run(itemId, itemId);

  const result = db
    .prepare("DELETE FROM canvas_items WHERE item_id = ?")
    .run(itemId);

  if (result.changes > 0) {
    db.prepare(
      "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
    ).run(new Date().toISOString(), existingItem.canvas_id);
  }

  return result.changes > 0;
}

// --- Connections ---

export function addConnection(
  canvasId: string,
  fromItemId: string,
  toItemId: string,
  connectionType = "line",
  style: string | null = null,
): CanvasConnection {
  getCanvasOrThrow(canvasId);

  validateNonEmptyString(fromItemId, "from_item_id");
  validateNonEmptyString(toItemId, "to_item_id");
  validateConnectionType(connectionType);
  validateNullableString(style, "style");

  if (fromItemId === toItemId) {
    badRequest("A canvas item cannot be connected to itself");
  }

  assertItemBelongsToCanvas(fromItemId, canvasId);
  assertItemBelongsToCanvas(toItemId, canvasId);

  const db = getDb();
  const duplicate = db
    .prepare(
      `SELECT connection_id
       FROM canvas_connections
       WHERE canvas_id = ?
         AND from_item_id = ?
         AND to_item_id = ?
       LIMIT 1`,
    )
    .get(canvasId, fromItemId, toItemId);

  if (duplicate) {
    badRequest("A connection already exists between these items");
  }

  const now = new Date().toISOString();
  const connectionId = randomUUID();

  db.prepare(
    `INSERT INTO canvas_connections
      (connection_id, canvas_id, from_item_id, to_item_id,
       connection_type, style, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    connectionId,
    canvasId,
    fromItemId,
    toItemId,
    connectionType,
    style,
    now,
  );

  db.prepare(
    "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
  ).run(now, canvasId);

  return getCanvasConnectionOrThrow(connectionId);
}

export function getCanvasConnectionById(
  connId: string,
): CanvasConnection | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM canvas_connections WHERE connection_id = ?",
    )
    .get(connId) as CanvasConnectionDbRow | undefined;

  return row ? mapCanvasConnection(row) : null;
}

export function updateConnection(
  connId: string,
  updates: CanvasConnectionUpdates,
): CanvasConnection | null {
  const existing = getCanvasConnectionById(connId);

  if (!existing) return null;

  assertConnectionBelongsToCanvas(connId, existing.canvas_id);

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.connection_type !== undefined) {
    fields.push("connection_type = ?");
    values.push(validateConnectionType(updates.connection_type));
  }

  if (updates.style !== undefined) {
    fields.push("style = ?");
    values.push(validateNullableString(updates.style, "style"));
  }

  if (fields.length === 0) {
    return existing;
  }

  const now = new Date().toISOString();
  values.push(connId);

  getDb()
    .prepare(
      `UPDATE canvas_connections
       SET ${fields.join(", ")}
       WHERE connection_id = ?`,
    )
    .run(...values);

  getDb()
    .prepare(
      "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
    )
    .run(now, existing.canvas_id);

  return getCanvasConnectionOrThrow(connId);
}

export function deleteConnection(connId: string): boolean {
  const existing = getCanvasConnectionById(connId);

  if (!existing) return false;

  // Keep the connection ownership assertion in the deletion path so this
  // helper remains the single place where connection-to-canvas scope is
  // checked inside the service.
  assertConnectionBelongsToCanvas(connId, existing.canvas_id);

  const db = getDb();
  const result = db
    .prepare(
      "DELETE FROM canvas_connections WHERE connection_id = ?",
    )
    .run(connId);

  if (result.changes > 0) {
    db.prepare(
      "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
    ).run(new Date().toISOString(), existing.canvas_id);
  }

  return result.changes > 0;
}

// --- Mappers ---

function mapCanvas(row: CanvasDbRow): Canvas {
  return {
    canvas_id: row.canvas_id,

    // Existing databases may still contain legacy NULL project_id rows.
    // An empty string keeps the new TypeScript contract non-nullable; routes
    // treat an empty project_id as unscoped and return 404 for those records.
    project_id: row.project_id ?? "",

    name: row.name,
    description: row.description,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCanvasItem(row: CanvasItemDbRow): CanvasItem {
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

function mapCanvasConnection(
  row: CanvasConnectionDbRow,
): CanvasConnection {
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
import type { Response } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import type { AuthRequest } from "../middleware/auth.middleware.ts";
import * as canvasService from "../services/canvas.service.ts";
import { CanvasServiceError } from "../services/canvas.service.ts";
import {
  getProjectAccess,
  projectExists,
} from "../services/projectAccess.service.ts";

const router = Router();

type CanvasPermission = "read" | "write" | "delete";

// All Canvas routes require authentication.
router.use(requireAuth);

function getBody(req: AuthRequest): Record<string, unknown> {
  const body: unknown = req.body;

  if (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body)
  ) {
    return body as Record<string, unknown>;
  }

  return {};
}

function getUserId(
  req: AuthRequest,
  res: Response,
): string | null {
  const userId = req.user?.user_id;

  if (!userId) {
    res.status(401).json({ error: "Missing or invalid token" });
    return null;
  }

  return userId;
}

function sendCanvasError(res: Response, error: unknown): void {
  if (error instanceof CanvasServiceError) {
    res
      .status(error.statusCode)
      .json({ error: error.message });
    return;
  }

  // Do not expose SQL errors, stack traces, or unexpected internal details.
  console.error("Canvas route error:", error);
  res.status(500).json({ error: "Internal server error" });
}

/**
 * Load a canvas and authorize the caller against its project.
 *
 * If the canvas is missing, has no project, or the caller cannot read its
 * project, return 404. This deliberately avoids disclosing the existence
 * of resources outside the caller's accessible projects.
 *
 * A caller who can read the project but lacks the requested write/delete
 * permission receives 403.
 */
async function requireCanvasAccess(
  canvasId: string,
  userId: string,
  permission: CanvasPermission,
  res: Response,
): Promise<canvasService.Canvas | null> {
  const canvas = canvasService.getCanvasById(canvasId);

  if (!canvas || !canvas.project_id) {
    res.status(404).json({ error: "Canvas not found" });
    return null;
  }

  const access = await getProjectAccess(canvas.project_id, userId);

  if (!access || !access.canRead) {
    res.status(404).json({ error: "Canvas not found" });
    return null;
  }

  if (permission === "write" && !access.canWrite) {
    res.status(403).json({ error: "Insufficient permissions" });
    return null;
  }

  if (permission === "delete" && !access.canDelete) {
    res.status(403).json({ error: "Insufficient permissions" });
    return null;
  }

  return canvas;
}

// Create canvas.
router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const body = getBody(req as AuthRequest);
    const projectId = body.project_id;
    const name = body.name;
    const description = body.description;

    if (typeof projectId !== "string" || !projectId.trim()) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      res.status(400).json({
        error: "description must be a string or null",
      });
      return;
    }

    if (!projectExists(projectId)) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const access = await getProjectAccess(projectId, userId);

    if (!access || !access.canWrite) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const canvas = canvasService.createCanvas(
      projectId,
      name,
      description ?? null,
      userId,
    );

    res.status(201).json({ canvas });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// List canvases.
router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const rawProjectId = req.query.project_id;

    if (
      rawProjectId !== undefined &&
      typeof rawProjectId !== "string"
    ) {
      res.status(400).json({ error: "Invalid project_id" });
      return;
    }

    if (typeof rawProjectId === "string") {
      if (!rawProjectId.trim()) {
        res.status(400).json({ error: "Invalid project_id" });
        return;
      }

      if (!projectExists(rawProjectId)) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const access = await getProjectAccess(rawProjectId, userId);

      if (!access || !access.canRead) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const canvases = canvasService.listCanvases(rawProjectId);
      res.json({ canvases });
      return;
    }

    // Preserve the service's existing no-project filter behavior, but never
    // expose its unfiltered result directly. Include only canvases whose
    // projects the caller can read; omit legacy NULL-project canvases.
    const allCanvases = canvasService.listCanvases(null);
    const visibleCanvases: canvasService.Canvas[] = [];

    for (const canvas of allCanvases) {
      if (!canvas.project_id) continue;

      const access = await getProjectAccess(
        canvas.project_id,
        userId,
      );

      if (access?.canRead) {
        visibleCanvases.push(canvas);
      }
    }

    res.json({ canvases: visibleCanvases });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Get canvas with items and connections.
router.get("/:id", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "read",
      res,
    );

    if (!canvas) return;

    const result = canvasService.getCanvasWithItems(canvasId);

    if (!result) {
      res.status(404).json({ error: "Canvas not found" });
      return;
    }

    res.json({ canvas: result });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Update canvas metadata.
router.put("/:id", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);
    const updates: {
      name?: string;
      description?: string | null;
    } = {};

    if (Object.hasOwn(body, "name")) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        res.status(400).json({ error: "name must be a non-empty string" });
        return;
      }

      updates.name = body.name;
    }

    if (Object.hasOwn(body, "description")) {
      if (
        body.description !== null &&
        typeof body.description !== "string"
      ) {
        res.status(400).json({
          error: "description must be a string or null",
        });
        return;
      }

      updates.description = body.description;
    }

    const updatedCanvas = canvasService.updateCanvas(
      canvasId,
      updates,
    );

    if (!updatedCanvas) {
      res.status(404).json({ error: "Canvas not found" });
      return;
    }

    res.json({ canvas: updatedCanvas });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Delete canvas.
router.delete("/:id", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "delete",
      res,
    );

    if (!canvas) return;

    const deleted = canvasService.deleteCanvas(canvasId);

    if (!deleted) {
      res.status(404).json({ error: "Canvas not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Add item to canvas.
router.post("/:id/items", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);
    const item = canvasService.addItem(
      canvasId,
      body as unknown as Parameters<typeof canvasService.addItem>[1],
    );

    res.status(201).json({ item });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Update item. Authorization is resolved using the item's actual parent canvas.
router.put("/items/:itemId", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const itemId = req.params.itemId as string;
    const existingItem = canvasService.getCanvasItemById(itemId);

    if (!existingItem) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const canvas = await requireCanvasAccess(
      existingItem.canvas_id,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);
    const item = canvasService.updateItem(
      itemId,
      body as Parameters<typeof canvasService.updateItem>[1],
    );

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json({ item });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Delete item.
router.delete("/items/:itemId", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const itemId = req.params.itemId as string;
    const item = canvasService.getCanvasItemById(itemId);

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const canvas = await requireCanvasAccess(
      item.canvas_id,
      userId,
      "delete",
      res,
    );

    if (!canvas) return;

    const deleted = canvasService.deleteItem(itemId);

    if (!deleted) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Add connection.
router.post("/:id/connections", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);

    if (
      typeof body.from_item_id !== "string" ||
      !body.from_item_id.trim()
    ) {
      res.status(400).json({
        error: "from_item_id is required",
      });
      return;
    }

    if (
      typeof body.to_item_id !== "string" ||
      !body.to_item_id.trim()
    ) {
      res.status(400).json({
        error: "to_item_id is required",
      });
      return;
    }

    if (
      body.connection_type !== undefined &&
      body.connection_type !== "line" &&
      body.connection_type !== "arrow"
    ) {
      res.status(400).json({
        error: 'connection_type must be "line" or "arrow"',
      });
      return;
    }

    if (
      body.style !== undefined &&
      body.style !== null &&
      typeof body.style !== "string"
    ) {
      res.status(400).json({
        error: "style must be a string or null",
      });
      return;
    }

    const connection = canvasService.addConnection(
      canvasId,
      body.from_item_id,
      body.to_item_id,
      body.connection_type === "arrow" ? "arrow" : "line",
      (body.style as string | null | undefined) ?? null,
    );

    res.status(201).json({ connection });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Update connection.
router.put("/connections/:connId", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const connectionId = req.params.connId as string;
    const existingConnection =
      canvasService.getCanvasConnectionById(connectionId);

    if (!existingConnection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    const canvas = await requireCanvasAccess(
      existingConnection.canvas_id,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);
    const updates: {
      connection_type?: string;
      style?: string | null;
    } = {};

    if (Object.hasOwn(body, "connection_type")) {
      if (
        body.connection_type !== "line" &&
        body.connection_type !== "arrow"
      ) {
        res.status(400).json({
          error: 'connection_type must be "line" or "arrow"',
        });
        return;
      }

      updates.connection_type = body.connection_type;
    }

    if (Object.hasOwn(body, "style")) {
      if (
        body.style !== null &&
        typeof body.style !== "string"
      ) {
        res.status(400).json({
          error: "style must be a string or null",
        });
        return;
      }

      updates.style = body.style;
    }

    if (
      updates.connection_type === undefined &&
      updates.style === undefined
    ) {
      res.status(400).json({
        error: "At least one connection field must be provided",
      });
      return;
    }

    const connection = canvasService.updateConnection(
      connectionId,
      updates,
    );

    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    res.json({ connection });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Delete connection.
router.delete("/connections/:connId", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const connectionId = req.params.connId as string;
    const connection =
      canvasService.getCanvasConnectionById(connectionId);

    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    const canvas = await requireCanvasAccess(
      connection.canvas_id,
      userId,
      "delete",
      res,
    );

    if (!canvas) return;

    const deleted = canvasService.deleteConnection(connectionId);

    if (!deleted) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

export default router;
```

## FILE: backend/src/tests/backend.test.ts

```ts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, test } from "node:test";
import request from "supertest";
import { app } from "../index.ts";
import { getDb } from "../database/index.ts";

// Test data and shared authentication helpers.
const testProject = {
  name: "Acceptance Test Project",
  description: "A test project",
  status: "active" as const,
};

let authToken: string | null = null;

const editorCredentials = {
  username: "canvas_editor",
  email: "canvas-editor@test.com",
  password: "password123",
};

const viewerCredentials = {
  username: "canvas_viewer",
  email: "canvas-viewer@test.com",
  password: "password123",
};

const nonMemberCredentials = {
  username: "canvas_nonmember",
  email: "canvas-nonmember@test.com",
  password: "password123",
};

before(() => {
  // The application import initializes the database; this ensures the
  // connection is available before the test cases execute.
  getDb();
});

async function registerAndLogin(
  username: string,
  email: string,
  password: string,
): Promise<string> {
  const registration = await request(app)
    .post("/api/auth/register")
    .send({ username, email, password });

  // Permit re-use of a test account from a previous test run.
  if (registration.status !== 201 && registration.status !== 409) {
    throw new Error(
      `Registration failed for ${email} with status ${registration.status}`,
    );
  }

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  assert.equal(login.status, 200);
  assert.equal(typeof login.body.token, "string");
  assert.ok(login.body.token);

  return login.body.token as string;
}

async function getAuthToken(): Promise<string> {
  if (authToken) return authToken;

  authToken = await registerAndLogin(
    "acceptance_test",
    "acceptance@test.com",
    "password123",
  );

  return authToken;
}

async function getUserIdByEmail(email: string): Promise<string> {
  const row = getDb()
    .prepare("SELECT user_id FROM users WHERE email = ?")
    .get(email) as { user_id: string } | undefined;

  if (!row) {
    throw new Error(`Test user not found: ${email}`);
  }

  return row.user_id;
}

async function createProject(
  token: string,
  name = `Canvas Test Project ${randomUUID()}`,
): Promise<string> {
  const response = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name,
      description: "Project created by backend tests",
      status: "active",
    });

  assert.equal(response.status, 201);
  assert.ok(response.body.project?.project_id);

  return response.body.project.project_id as string;
}

async function createCanvasViaApi(
  token: string,
  projectId: string,
  name = `Canvas ${randomUUID()}`,
): Promise<string> {
  const response = await request(app)
    .post("/api/canvas")
    .set("Authorization", `Bearer ${token}`)
    .send({
      project_id: projectId,
      name,
      description: "Canvas created by backend tests",
    });

  assert.equal(response.status, 201);
  assert.ok(response.body.canvas?.canvas_id);

  return response.body.canvas.canvas_id as string;
}

function addProjectMember(
  projectId: string,
  userId: string,
  role: "owner" | "editor" | "viewer" | "commenter" | "agent",
): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO project_members
        (project_id, user_id, role)
       VALUES (?, ?, ?)`,
    )
    .run(projectId, userId, role);
}

describe("Project Manager MVP Acceptance Tests", () => {
  describe("Auth", () => {
    test("POST /api/auth/register creates a new user", async () => {
      const uniqueId = randomUUID();

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: `test_user_${uniqueId}`,
          email: `test_${uniqueId}@example.com`,
          password: "password123",
        });

      assert.equal(response.status, 201);
      assert.ok(response.body.token);
    });

    test("POST /api/auth/login authenticates users", async () => {
      const uniqueId = randomUUID();
      const email = `login_${uniqueId}@test.com`;

      await request(app)
        .post("/api/auth/register")
        .send({
          username: `login_test_${uniqueId}`,
          email,
          password: "password123",
        });

      const response = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" });

      assert.equal(response.status, 200);
      assert.ok(response.body.token);
    });

    test("POST /api/auth/login rejects a wrong password", async () => {
      const uniqueId = randomUUID();
      const email = `wrong_${uniqueId}@test.com`;

      await request(app)
        .post("/api/auth/register")
        .send({
          username: `wrong_pass_${uniqueId}`,
          email,
          password: "correct",
        });

      const response = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "wrong" });

      assert.equal(response.status, 401);
    });
  });

  describe("Project CRUD", () => {
    test("POST /api/projects creates a project", async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send(testProject);

      assert.equal(response.status, 201);
      assert.ok(response.body.project);
    });

    test("GET /api/projects lists projects", async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .get("/api/projects")
        .set("Authorization", `Bearer ${token}`);

      assert.equal(response.status, 200);
      assert.ok(Array.isArray(response.body.projects));
    });

    test("GET /api/projects/:id retrieves a project", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const response = await request(app)
        .get(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.project.project_id, projectId);
    });

    test("PUT /api/projects/:id updates a project", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Project", status: "active" });

      assert.equal(response.status, 200);
      assert.equal(response.body.project.name, "Updated Project");
    });

    test("DELETE /api/projects/:id archives a project", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const response = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, "Project archived");
    });
  });

  describe("Task CRUD", () => {
    test("POST /api/tasks creates a task", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const response = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Test Task ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(response.status, 201);
      assert.ok(response.body.task);
    });

    test("GET /api/tasks/:id retrieves a task", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const createResponse = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Task to retrieve ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(createResponse.status, 201);
      const taskId = createResponse.body.task.task_id as string;

      const response = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set("Authorization", `Bearer ${token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.task.task_id, taskId);
    });

    test("PUT /api/tasks/:id updates a task", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const createResponse = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Task to update ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(createResponse.status, 201);
      const taskId = createResponse.body.task.task_id as string;

      const updateResponse = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Updated Task", status: "in_progress" });

      assert.equal(updateResponse.status, 200);
      assert.equal(updateResponse.body.task.title, "Updated Task");
    });

    test("DELETE /api/tasks/:id deletes a task", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const createResponse = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Task to delete ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(createResponse.status, 201);
      const taskId = createResponse.body.task.task_id as string;

      const response = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set("Authorization", `Bearer ${token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, "Task deleted");
    });
  });

  describe("Dependency Management", () => {
    test("POST /api/dependencies creates a task dependency", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const firstTask = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Dependency Task 1 ${randomUUID()}`,
          status: "todo",
        });

      const secondTask = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Dependency Task 2 ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(firstTask.status, 201);
      assert.equal(secondTask.status, 201);

      const response = await request(app)
        .post("/api/dependencies")
        .set("Authorization", `Bearer ${token}`)
        .send({
          task_id: firstTask.body.task.task_id,
          depends_on_id: secondTask.body.task.task_id,
          dependency_type: "blocks",
        });

      assert.equal(response.status, 201);
      assert.ok(response.body.dependency);
    });
  });

  describe("Checklist CRUD", () => {
    test("POST /api/checklists creates a checklist with items", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const taskResponse = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Checklist Task ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(taskResponse.status, 201);
      const taskId = taskResponse.body.task.task_id as string;

      const response = await request(app)
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

      assert.equal(response.status, 201);
      assert.ok(response.body.checklist);
      assert.equal(response.body.checklist.items.length, 2);
    });
  });

  describe("Canvas Authorization", () => {
    test("Owner can create a canvas in their project", async () => {
      const ownerToken = await getAuthToken();
      const projectId = await createProject(ownerToken);

      const response = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          project_id: projectId,
          name: "Owner Canvas",
          description: "Created by project owner",
        });

      assert.equal(response.status, 201);
      assert.equal(response.body.canvas.project_id, projectId);
    });

    test("Editor can create, update, and delete a canvas", async () => {
      const ownerToken = await getAuthToken();
      const editorToken = await registerAndLogin(
        editorCredentials.username,
        editorCredentials.email,
        editorCredentials.password,
      );

      const projectId = await createProject(ownerToken);
      const editorId = await getUserIdByEmail(editorCredentials.email);

      addProjectMember(projectId, editorId, "editor");

      const createResponse = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          project_id: projectId,
          name: "Editor Canvas",
        });

      assert.equal(createResponse.status, 201);
      const canvasId = createResponse.body.canvas.canvas_id as string;

      const updateResponse = await request(app)
        .put(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${editorToken}`)
        .send({ name: "Editor Updated Canvas" });

      assert.equal(updateResponse.status, 200);
      assert.equal(
        updateResponse.body.canvas.name,
        "Editor Updated Canvas",
      );

      const deleteResponse = await request(app)
        .delete(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${editorToken}`);

      assert.equal(deleteResponse.status, 200);
      assert.equal(deleteResponse.body.success, true);
    });

    test("Viewer cannot create, update, or delete a canvas, but can read it", async () => {
      const ownerToken = await getAuthToken();
      const viewerToken = await registerAndLogin(
        viewerCredentials.username,
        viewerCredentials.email,
        viewerCredentials.password,
      );

      const projectId = await createProject(ownerToken);
      const viewerId = await getUserIdByEmail(viewerCredentials.email);

      addProjectMember(projectId, viewerId, "viewer");

      const canvasId = await createCanvasViaApi(
        ownerToken,
        projectId,
        "Viewer Readonly Canvas",
      );

      const createResponse = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          project_id: projectId,
          name: "Viewer Attempted Canvas",
        });

      assert.equal(createResponse.status, 403);

      const readResponse = await request(app)
        .get(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      assert.equal(readResponse.status, 200);
      assert.equal(readResponse.body.canvas.canvas_id, canvasId);

      const updateResponse = await request(app)
        .put(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ name: "Viewer Attempted Update" });

      assert.equal(updateResponse.status, 403);

      const deleteResponse = await request(app)
        .delete(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      assert.equal(deleteResponse.status, 403);
    });

    test("Non-member cannot read or write another project's canvas", async () => {
      const ownerToken = await getAuthToken();
      const nonMemberToken = await registerAndLogin(
        nonMemberCredentials.username,
        nonMemberCredentials.email,
        nonMemberCredentials.password,
      );

      const projectId = await createProject(ownerToken);
      const canvasId = await createCanvasViaApi(
        ownerToken,
        projectId,
        "Private Canvas",
      );

      const readResponse = await request(app)
        .get(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${nonMemberToken}`);

      assert.equal(readResponse.status, 404);

      const updateResponse = await request(app)
        .put(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${nonMemberToken}`)
        .send({ name: "Unauthorized Update" });

      assert.equal(updateResponse.status, 404);

      const deleteResponse = await request(app)
        .delete(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${nonMemberToken}`);

      assert.equal(deleteResponse.status, 404);

      const createResponse = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${nonMemberToken}`)
        .send({
          project_id: projectId,
          name: "Unauthorized Canvas",
        });

      assert.equal(createResponse.status, 403);
    });

    test("Canvas create rejects a null or missing project_id", async () => {
      const token = await getAuthToken();

      const nullProjectResponse = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: null,
          name: "Invalid Canvas",
        });

      assert.equal(nullProjectResponse.status, 400);

      const missingProjectResponse = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Missing Project Canvas" });

      assert.equal(missingProjectResponse.status, 400);
    });

    test("Canvas item cannot link to a task from another project", async () => {
      const token = await getAuthToken();
      const canvasProjectId = await createProject(token);
      const otherProjectId = await createProject(token);

      const canvasId = await createCanvasViaApi(
        token,
        canvasProjectId,
        "Task Scope Canvas",
      );

      const taskResponse = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: otherProjectId,
          title: `Task in another project ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(taskResponse.status, 201);
      const otherProjectTaskId =
        taskResponse.body.task.task_id as string;

      const itemResponse = await request(app)
        .post(`/api/canvas/${canvasId}/items`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          item_type: "task",
          task_id: otherProjectTaskId,
          content: "Cross-project task item",
        });

      assert.equal(itemResponse.status, 400);
    });

    test("Connection cannot be created between items from different canvases", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const firstCanvasId = await createCanvasViaApi(
        token,
        projectId,
        "Connection Canvas One",
      );

      const secondCanvasId = await createCanvasViaApi(
        token,
        projectId,
        "Connection Canvas Two",
      );

      const firstItemResponse = await request(app)
        .post(`/api/canvas/${firstCanvasId}/items`)
        .set("Authorization", `Bearer ${token}`)
        .send({ item_type: "square", content: "First item" });

      const secondItemResponse = await request(app)
        .post(`/api/canvas/${secondCanvasId}/items`)
        .set("Authorization", `Bearer ${token}`)
        .send({ item_type: "circle", content: "Second item" });

      assert.equal(firstItemResponse.status, 201);
      assert.equal(secondItemResponse.status, 201);

      const connectionResponse = await request(app)
        .post(`/api/canvas/${firstCanvasId}/connections`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          from_item_id: firstItemResponse.body.item.item_id,
          to_item_id: secondItemResponse.body.item.item_id,
          connection_type: "line",
        });

      assert.equal(connectionResponse.status, 400);
    });

    test("Unauthorized item update returns 404", async () => {
      const ownerToken = await getAuthToken();
      const nonMemberToken = await registerAndLogin(
        nonMemberCredentials.username,
        nonMemberCredentials.email,
        nonMemberCredentials.password,
      );

      const projectId = await createProject(ownerToken);
      const canvasId = await createCanvasViaApi(
        ownerToken,
        projectId,
        "Unauthorized Item Update Canvas",
      );

      const itemResponse = await request(app)
        .post(`/api/canvas/${canvasId}/items`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          item_type: "text",
          content: "Protected item",
        });

      assert.equal(itemResponse.status, 201);
      const itemId = itemResponse.body.item.item_id as string;

      const updateResponse = await request(app)
        .put(`/api/canvas/items/${itemId}`)
        .set("Authorization", `Bearer ${nonMemberToken}`)
        .send({ content: "Unauthorized content change" });

      assert.equal(updateResponse.status, 404);
    });
  });
});
```

## FILE: backend/src/tests/minimal.test.ts

```ts

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import express from "express";

describe("Minimal Test", () => {
  test("should pass", () => {
    assert.equal(1 + 1, 2);
    console.log("Minimal test passed!");
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
