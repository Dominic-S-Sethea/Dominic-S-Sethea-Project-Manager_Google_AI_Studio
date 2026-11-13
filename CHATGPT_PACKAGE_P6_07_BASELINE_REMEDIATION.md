# PM-P6-07 — Remediate residual Phase 2 critical baseline findings (C-2, C-3, C-4)
## Detailed implementation prompt for ChatGPT

You are implementing one card of an approved, stage-gated programme. Write real, complete,
production-quality code. Do not stub, do not summarize, do not ask questions, do not change
anything outside the authorized file list.

---

## 0. Context you must understand first

**Product.** "Project Manager" — a project/work management application.

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind |
| Backend | Express + TypeScript (ESM, `"type": "module"`) |
| Database | SQLite via Node's built-in `node:sqlite` (`DatabaseSync`) |
| Tests | `node --test` (no Jest/Vitest) |

**Backend conventions that matter here.**

- SQLite is accessed through `node:sqlite`'s `DatabaseSync`. There is no ORM and no query
  builder. Every query is a hand-written SQL string.
- `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL` are set on connection.
- Timestamps are stored in `DATETIME` columns holding ISO-8601 strings.
- Primary keys are UUID `TEXT` (generated in the service layer with the `uuid` package).
- The schema is a single file, `backend/src/database/schema.sql`, applied with `db.exec(...)`
  on first connection.

**Deployment.** The app is containerised with Docker. `Dockerfile` sets
`ENV NODE_ENV=production PORT=4000`, `EXPOSE 4000`, and `CMD ["node", "dist/server.js"]`.
`docker-compose.yml` maps `4000:4000`, sets `PORT=4000`, and health-checks
`http://localhost:4000/health`.

---

## 1. Current state (VERIFIED against the live source tree)

| Fact | Evidence |
|---|---|
| The app binds `NODE_PORT`, not `PORT` | `backend/src/server.ts:98` → `parseInt(process.env.NODE_PORT \|\| "3000")` |
| The container sets `PORT=4000` | `Dockerfile:25,28`, `docker-compose.yml:9,12,22` |
| The schema is read from a stale compiled copy | `backend/src/database/index.ts:9` → `readFileSync(path.join(__dirname, "schema.sql"))`; in production `__dirname` is `backend/dist/database`, whose `schema.sql` is stale (4,891 bytes vs the source 10,808 bytes) |
| `npm run build` no longer emits | `backend/tsconfig.json` sets `"noEmit": true`, so `dist/` can never be refreshed; `.dockerignore` excludes `dist/` |
| Agent registration is broken by schema drift | `backend/src/services/agentAuthService.ts` inserts into `agents (..., expires_at)` and into `agent_tokens`; the `agents` table has **no** `expires_at` column and there is **no** `agent_tokens` table |

---

## 2. The task

Fix the three critical findings. Each is independent.

### C-2 | Container port mismatch (config-only, no schema change)

**Finding.** The container sets `PORT` but the app reads `NODE_PORT`, so the app listens on
3000 while the container exposes and health-checks 4000. The Docker health check fails.

**Required fix.** Align the app with the container: bind `PORT` (default 3000 for local dev,
4000 in the container). Do not change the Dockerfile or compose file.

### C-3 | Runtime schema path is stale/unreproducible

**Finding.** `backend/src/database/index.ts` reads `path.join(__dirname, "schema.sql")`.
In production that resolves to `backend/dist/database/schema.sql`, which is stale and can
never be refreshed (`noEmit` + `.dockerignore`).

**Required fix.** Source the schema reproducibly from the committed source tree, so dev and
production read the same authoritative file. Pure path fix — no migration needed.

### C-4 | Agent registration broken by schema drift

**Finding.** `agentAuthService.ts` inserts into `agents (..., expires_at)` and into
`agent_tokens`, but `agents` has no `expires_at` column and `agent_tokens` does not exist.
Agent registration fails at runtime.

**Required fix.** Add the missing schema (the `expires_at` column on `agents` and the
`agent_tokens` table) to `schema.sql`, and make the change safe for **pre-existing databases**
(created from the old schema) as well as fresh ones. Then make the registration INSERT supply
every `NOT NULL` column the table requires.

---

## 3. Authorized deliverables — exactly these files

Return **complete replacement files** for:

1. `backend/src/server.ts`
2. `backend/src/database/index.ts`
3. `backend/src/database/schema.sql`
4. `backend/src/services/agentAuthService.ts`

Do **not** change any other file. Do **not** add dependencies. Do **not** run git, commits, or
pushes.

---

## 4. Constraints — do not violate

- **No unrelated redesign.** These are three targeted fixes. Do not refactor, rename, or
  restructure anything else.
- **No new dependencies.** Use only what is already in `backend/package.json`.
- **No secrets, API keys, or environment values** in the code beyond what already exists.
- **Schema changes must be safe for existing databases.** A database created from the old
  `schema.sql` must keep working after the fix (idempotent migration, not a drop/recreate).
- **`schema.sql` stays the single authoritative schema.** Do not introduce a second schema
  source of truth.
- **Preserve existing behaviour** for everything not named above.

---

## 5. Acceptance criteria

- **C-2:** the app binds `PORT` (4000 in the container, 3000 locally). The compose health check
  passes against the port the app actually binds.
- **C-3:** production reads the same schema file as development; the schema source is the
  committed `src/database/schema.sql`.
- **C-4:** agent registration succeeds against both a fresh database and a pre-existing
  database created from the old schema.
- **Gates after the change:** backend typecheck, backend build, backend tests, frontend
  typecheck, frontend build — all must pass.

---

## 6. Output format

Return the four files **in the order listed in §3**, each as a complete replacement file in a
fenced code block, prefixed by its path. Do not return snippets or diffs.

---

## 7. Current source files (authoritative — pre-fix state)

The files below are the **current** state of the tree. They contain the defects described in
§1. Return corrected versions of the four deliverables.


### SOURCE FILE: `backend/src/server.ts`

```typescript
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

### SOURCE FILE: `backend/src/database/index.ts`

```typescript
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

### SOURCE FILE: `backend/src/database/schema.sql`

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

### SOURCE FILE: `backend/src/services/agentAuthService.ts`

```typescript
import type { Request, Response } from "express";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.ts";

const db = getDb();

export const registerAgent = async (req: Request, res: Response) => {
  try {
    const { apiKey, role = "viewer" } = req.body;
    if (!apiKey) {
      return res.status(400).json({ message: "API key is required" });
    }

    const validRoles = ["admin", "editor", "viewer"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Valid roles: ${validRoles.join(", ")}` });
    }

    const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    const existing = db.prepare(
      "SELECT agent_id FROM agents WHERE api_key_hash = ?"
    ).get(apiKeyHash) as { agent_id: string } | undefined;

    if (existing) {
      return res.status(409).json({ message: "Agent with this API key already exists" });
    }

    const agentId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO agents (agent_id, api_key_hash, role, status, created_at, expires_at)
       VALUES (?, ?, ?, 'active', ?, ?)`
    ).run(agentId, apiKeyHash, role, now, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    db.prepare(
      `INSERT INTO agent_tokens (token_hash, agent_id, role, expires_at)
       VALUES (?, ?, ?, ?)`
    ).run(tokenHash, agentId, role, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

    return res.status(201).json({
      agent_id: agentId,
      api_key: apiKey,
      token,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err: any) {
    console.error("Agent registration error:", err);
    return res.status(500).json({ message: "Agent registration failed" });
  }
};

```

### SOURCE FILE: `Dockerfile`

```
# ============================
# Project Manager — Dockerfile
# Multi-stage build
# ============================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --omit=dev
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev
COPY backend/ ./
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache ca-certificates curl
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=frontend-builder /app/frontend/dist ./backend/dist
ENV NODE_ENV=production PORT=4000
ENV DB_PATH=/app/backend/data/app.db
RUN mkdir -p /app/backend/data
EXPOSE 4000
WORKDIR /app/backend
CMD ["node", "dist/server.js"]

```

### SOURCE FILE: `docker-compose.yml`

```yaml
version: "3.8"
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - PORT=4000
      - CORS_ORIGIN=http://localhost:4000
      - DB_PATH=/app/backend/data/app.db
      - JWT_SECRET=${JWT_SECRET:-change-me-in-production}
      - RATE_LIMIT_WINDOW_MS=900000
      - RATE_LIMIT_MAX=100
    volumes:
      - app_data:/app/backend/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  app_data:

```
