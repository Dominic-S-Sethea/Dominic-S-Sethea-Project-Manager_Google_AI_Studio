# PM-P2-01 — Shared Architecture & Dependency Map (read-only)

**Artifact:** `PHASE2_01_SHARED_ARCHITECTURE.md`
**Project root:** `<workspace>`
**Phase:** 2 — Shared foundation / architecture baseline
**Boundary:** Read-only. No application source file was created, modified, or deleted except this artifact. No server was started, no build was run, no database was written, no commit was made.
**Method:** Direct file reads of the live working tree plus read-only SQLite inspection. Every claim below cites a file path and line number, or a command and its result.

> **Card note.** `PM-P2-01` does not appear anywhere in the repository. A repo-wide binary search for `PM-P2` returned 0 hits; `KANBAN_BOARD.md` and `PRD.md` contain no such card and are byte-identical to each other (both 11,866 bytes, SHA-256 `e53b9088c412fec5f5c73fcf5b0d9aeb834e34acb6306004796d81ed1327f4d2`). The card is therefore defined by the Phase 2 task order, not by an in-repo board entry. This artifact satisfies the card's stated deliverable.

## 0. Evidence labels

| Label | Meaning |
|---|---|
| **VERIFIED** | Read directly from the current working tree, a live command result, or the live SQLite file. |
| **REPORTED** | Stated in a project document but not independently proved, or contradicted by source. |
| **MIXED** | Partly implemented; the code exists but the claim overstates it. |

Live baseline (VERIFIED by command):

- `git -C "<root>" branch --show-current` → `main`
- `git -C "<root>" rev-parse HEAD` → `d705a364b2e845eb02f33d57475e0e3af15228c7`
- `git -C "<root>" status --short` → **78 entries** (dirty working tree; uncommitted work is present and untouched)

---

## 1. Frontend routing / query / state map (VERIFIED)

### 1.1 Runtime composition

`frontend/src/main.tsx:54` mounts the provider stack in this order:

```
React.StrictMode → QueryClientProvider → BrowserRouter → AuthProvider → ThemeProvider → Root
```

- `frontend/src/main.tsx:22` — QueryClient defaults: `staleTime: 60_000`, `refetchOnWindowFocus: false`.
- `frontend/src/main.tsx:24-28` — `ProtectedWorkspace` redirects to `/login` when `useAuth().user` is null.
- `frontend/src/main.tsx:30-51` — `Root` route table.
- `frontend/src/App.tsx:5-8` — a second, unused app component (not imported by `main.tsx`; dead entry point).

### 1.2 Route table (`frontend/src/main.tsx:32-51`)

| Path | Component | File | Notes |
|---|---|---|---|
| `/login` | `Login` | `frontend/src/pages/Login.tsx` | Public; redirects to `/dashboard` if already authed (`Login.tsx:11`) |
| `/` | `Navigate → /dashboard` | `main.tsx:35` | Protected |
| `/dashboard` | `Dashboard` | `frontend/src/pages/Dashboard.tsx` | Thin wrapper over `WorkspaceOverview` (`Dashboard.tsx:8-11`) |
| `/projects` | `Projects` | `frontend/src/pages/Projects.tsx` | Also serves `?scope=mine`, `?create=task`, `?project=`, `?task=` |
| `/review` | `ReviewQueue` | `frontend/src/pages/ReviewQueue.tsx` | Blocked-task queue, not agent approvals |
| `/automation` | `AutomationStudio` | `frontend/src/pages/AutomationStudio.tsx` | Preview-only (see §7) |
| `/appearance` | `Appearance` | `frontend/src/pages/Appearance.tsx` | Theme engine UI |
| `/users` | `Users` | `frontend/src/pages/Users.tsx` | People & access |
| `/git-commits` | `GitCommits` | `frontend/src/pages/GitCommits.tsx` | |
| `/import-export` | `ImportExport` | `frontend/src/pages/ImportExport.tsx` | |
| `/connectors` | `Connectors` | `frontend/src/pages/Connectors.tsx` | |
| `/canvas` | `Canvas` | `frontend/src/pages/Canvas.tsx` | Creates a canvas if no id (`Canvas.tsx:49-56`) |
| `/canvas/:id` | `Canvas` | `frontend/src/pages/Canvas.tsx` | |
| `/canvases` | `CanvasList` | `frontend/src/pages/CanvasList.tsx` | |
| `/canvases/:projectId` | `CanvasList` | `frontend/src/pages/CanvasList.tsx` | |
| `*` | `Navigate → /dashboard` or `/login` | `main.tsx:50` | |

### 1.3 Navigation model (`frontend/src/components/layout/AppShell.tsx:18-40`)

| Group | Items (line) |
|---|---|
| Workspace | `/dashboard` Overview (19), `/projects?scope=mine` My work (20), `/projects` Projects (21) |
| Control | `/review` Review queue (25), `/dashboard#activity` Activity (26) |
| Tools | `/canvases` Project Canvas (30), `/automation` Automation Studio **`future: true`** (31), `/git-commits` Git activity (32), `/connectors` Integrations (33) |
| Manage | `/users` People & access (37), `/appearance` Appearance (38), `/import-export` Import & export (39) |

- `AppShell.tsx:89` renders a `Preview` tag for `future` items.
- `AppShell.tsx:574-576` — shell state: `themeOpen`, `paletteOpen`, `mobileNavOpen`.
- `AppShell.tsx:578-598` — global `Ctrl/Cmd+K` opens the command palette; `Escape` closes palette/theme/drawer.
- `AppShell.tsx:285-443` — `CommandPalette` with live task/project search (`workspace-tasks` at 291, `workspace-projects` at 310; entries at 405-430).
- `AppShell.tsx:8` — imports `ProjectSwitcher`; `ProjectSwitcher.tsx:14` persists selection under `localStorage["pm-selected-project"]`.

### 1.4 State management

| State | Owner | Persistence | Evidence |
|---|---|---|---|
| Server state | TanStack Query v5 | Query cache only | `main.tsx:4,22`; keys below |
| Auth session | `AuthProvider` context | `localStorage["pm_user"]`, `localStorage["pm_token"]` | `frontend/src/hooks/useAuth.tsx:11-18` |
| Theme | `ThemeProvider` context | `localStorage["pm-theme-preference-v2"]` + legacy `pm-ui-theme` / `pm-ui-custom-accent` | `frontend/src/theme/ThemeProvider.tsx:71-72,119-162` |
| Pre-mount theme | Inline script in `index.html` | same keys | `frontend/index.html:8-62` |
| Selected project | `ProjectSwitcher` | `localStorage["pm-selected-project"]` | `ProjectSwitcher.tsx:14,75,99` |
| Selected UI layout | `DesignModeContext` | `ui_layouts` table via `/api/ui-layout` | `frontend/src/components/design/DesignModeContext.tsx:176,188,198` — **no live consumer** (orphaned, §6) |

### 1.5 React Query key map (VERIFIED)

| Query key | Declared at | Endpoint |
|---|---|---|
| `["workspace-dashboard"]` | `WorkspaceOverview.tsx:31`; `TaskWorkspace.tsx:255,284,324` | `GET /api/dashboard` |
| `["workspace-tasks"]` | `AppShell.tsx:291`; `WorkspaceOverview.tsx:39`; `TaskWorkspace.tsx:112,251,280,320` | `GET /api/tasks` |
| `["workspace-projects"]` | `AppShell.tsx:310`; `ProjectSwitcher.tsx:33`; `Projects.tsx:38,123,173`; `TaskWorkspace.tsx:144` | `GET /api/projects` |
| `["canvases", projectId]` | `CanvasList.tsx:19,51,67,147` | `GET /api/canvas?project_id=` |
| `["connectors-available"]` | `Connectors.tsx:38` | `GET /api/connectors/available` |
| `["connectors"]` | `Connectors.tsx:49,70,91,106` | `GET/POST/PATCH/DELETE /api/connectors` |
| `["git-commits"]` | `GitCommits.tsx:22,58` | `GET /api/git/commits` |
| `["tasks","blocked"]` | `ReviewQueue.tsx:9` | `GET /api/tasks?status=blocked` |
| `["dashboard"]` | `ReviewQueue.tsx:10` | `GET /api/dashboard` |
| `["workspace-checklists"]` | `TaskWorkspace.tsx:166,362,387` | `GET/POST/PUT/DELETE /api/checklists` |
| `["workspace-dependencies"]` | `TaskWorkspace.tsx:188,425,450` | `GET/POST/PUT/DELETE /api/dependencies` |

### 1.6 API access convention (VERIFIED)

There is **no typed API client and no shared fetch wrapper**. Every call is a direct `fetch("/api/...")` with a manually built `Authorization: Bearer <token>` header from `getToken()` — e.g. `WorkspaceOverview.tsx:33,41`; `TaskForm.tsx:37`; `Users.tsx:54,76,132`; `useCanvas.ts:73,87,114,151,192,225,245`. Base URL is always relative (no `VITE_*` env, no `import.meta.env`, no proxy in `frontend/vite.config.ts:9-15`); the unified Express server is the intended same-origin host (`backend/src/server.ts:78-88`).

### 1.7 Build / dev configuration (VERIFIED)

- `frontend/vite.config.ts:8` — `outDir: "dist"`, `sourcemap: true`.
- `frontend/vite.config.ts:9-15` — dev server `hmr: true`, `allowedHosts: true`, **no `/api` proxy**.
- `frontend/package.json:6-11` — scripts: `build`, `preview`, `typecheck`, `dev:full`. **No `dev` script**, but root `package.json:11` calls `npm run dev --prefix frontend` → root `npm run dev` fails for the frontend half.
- `frontend/package.json:10` — `dev:full` uses `concurrently`, which is only a root devDependency (`package.json:18`), not a frontend dependency.

---

## 2. Backend route / service conventions (VERIFIED)

### 2.1 Two Express apps

| Entry | File | Role |
|---|---|---|
| App factory (no `listen`) | `backend/src/index.ts` | Exports `app`, `getDb`, `closeDb` (line 76); used by tests (`backend/src/tests/backend.test.ts:39-41`) |
| Unified server | `backend/src/server.ts` | `listen`s; mounts Vite middleware in dev (78-88) or static `dist` in prod (89-96) |

Both register the same 15 routers (`index.ts:37-51`; `server.ts:41-55`).

Shared middleware order: `configureSecurity` (`index.ts:26`) → `express.json` / `urlencoded` (29-30) → rate limits on `/api/auth` and `/api` (33-34) → routers (37-51) → health (54-56) → 404 → error handler.

### 2.2 Route table

Base path prefix is applied in the entry files; sub-paths below are from each router file.

| Mount | Router file | Endpoints (method, path, line) |
|---|---|---|
| `/api/auth` | `backend/src/routes/auth.routes.ts` | POST `/login` (6); GET `/me` (7); POST `/register` (10) |
| `/api/users` | `backend/src/routes/users.routes.ts` | GET `/me` (14); GET `/me/login-history` (29); GET `/` (43, `requireRole("owner","editor")`); POST `/` (56, role-gated); PUT `/:id` (79, role-gated) |
| `/api/dashboard` | `backend/src/routes/dashboard.routes.ts` | GET `/` (7) |
| `/api/agents` | `backend/src/routes/agents.routes.ts` | POST `/register` (12); POST `/login` (18); GET `/me` (24, `verifyAgentAuth`) |
| `/api/projects` | `backend/src/routes/projects.routes.ts` | GET `/` (8); GET `/:id` (18); POST `/` (28); PUT `/:id` (45); DELETE `/:id` (56) |
| `/api/tasks` | `backend/src/routes/tasks.routes.ts` | GET `/` (8, filters `status`/`project_id`); GET `/:id` (25); POST `/` (35); PUT `/:id` (58); DELETE `/:id` (73) |
| `/api/checklists` | `backend/src/routes/checklists.routes.ts` | GET `/` (8); GET `/task/:taskId` (18); GET `/:id` (28); POST `/` (39); PUT `/:id` (57); DELETE `/:id` (72) |
| `/api/dependencies` | `backend/src/routes/dependencies.routes.ts` | GET `/` (8); GET `/task/:taskId` (18); GET `/:id` (28); POST `/` (39); PUT `/:id` (57); DELETE `/:id` (72) |
| `/api/git` | `backend/src/routes/git.routes.ts` | POST `/commits` (12); GET `/commits` (46); GET `/commits/task/:taskId` (60); POST `/commits/:commitId/link` (73); POST `/parse` (93) |
| `/api/import-export` | `backend/src/routes/importExport.routes.ts` | GET `/export/json` (8); GET `/export/csv` (21); GET `/export/markdown` (34); POST `/import/json` (47); GET `/export/pdf` (62); GET `/export/xlsx` (74); GET `/export/project/:id` (86); POST `/import/csv` (99); POST `/import/project` (112) |
| `/api/canvas` | `backend/src/routes/canvas.routes.ts` | POST `/` (11); GET `/` (28); GET `/:id` (39); PUT `/:id` (52); DELETE `/:id` (66); POST `/:id/items` (79); PUT `/items/:itemId` (89); DELETE `/items/:itemId` (102); POST `/:id/connections` (115); DELETE `/connections/:connId` (132) |
| `/api/backup` | `backend/src/routes/backup.routes.ts` | POST `/` (9); GET `/` (19); DELETE `/:filename` (29); POST `/prune` (42); router-wide `requireAuth` (6) |
| `/api/monitoring` | `backend/src/routes/monitoring.routes.ts` | GET `/health` (8, no auth); GET `/metrics` (15, auth) |
| `/api/ui-layout` | `backend/src/routes/uiLayout.routes.ts` | GET `/:page` (8); POST `/:page` (19); DELETE `/:page` (31) |
| `/api/connectors` | `backend/src/routes/connectors.routes.ts` | GET `/available` (8); GET `/` (13); GET `/:id` (23); POST `/` (34); PATCH `/:id/config` (46); PATCH `/:id/status` (56); DELETE `/:id` (70); POST `/:id/test` (81); GET `/:id/github/repos` (93); GET `/:id/github/issues` (103); POST `/:id/github/issues` (116); POST `/:id/hermes/message` (128); GET `/:id/hermes/models` (140) |

### 2.3 Service layer convention (VERIFIED)

- Services are **classes instantiated as singletons** and imported into routes: `taskService` (`backend/src/services/task.service.ts:44,185`), `projectService` (`project.service.ts:32,135`), `checklistService` (`checklist.service.ts:36,186`), `dependencyService` (`dependency.service.ts:25,143`), `gitService` (`git.service.ts:14,129`), `importExportService` (`importExport.service.ts:15,508`), `connectorService` (`connector.service.ts:67,338`), `UserService` (`user.service.ts:33`, instantiated per-route at `users.routes.ts:8`), `UILayoutService` (`uiLayout.service.ts:28,71`), `MonitoringService` functions (`monitoring.service.ts:30,59`), `BackupService` functions (`backup.service.ts:16-100`).
- Data access is `node:sqlite` `DatabaseSync` with prepared statements (`backend/src/database/index.ts:1,14`); no ORM, no query builder.
- Routes own HTTP concerns (validation, status codes, envelopes); services own SQL and mapping (`rowToTask` `task.service.ts:167-182`; `rowToProject` `project.service.ts:121-132`).
- **No transactions anywhere.** A repo-wide search for `db.transaction` / `BEGIN` / `COMMIT` / `ROLLBACK` found no service usage. Multi-step writes (checklist + items, connector + configs) are not atomic.

### 2.4 Response envelope convention (VERIFIED, with inconsistency)

- Success: `res.json({ <resource> })` or `{ <resource>: [...] }` — `{projects}` (`projects.routes.ts:12`), `{tasks}` (`tasks.routes.ts:19`), `{task}` (`tasks.routes.ts:29,52`), `{checklists}` (`checklists.routes.ts:11`), `{dependencies}` (`dependencies.routes.ts:11`), `{canvases}` (`canvas.routes.ts:32`), `{canvas}` (`canvas.routes.ts:21,45,59`), `{commits}` (`git.routes.ts:50`), `{connectors}` (`connectors.routes.ts:9,16`), `{users}` (`users.routes.ts:46`), `{metrics}` (`monitoring.routes.ts:18`).
- Create: `201` with the created resource (`projects.routes.ts:39`, `tasks.routes.ts:52`, `canvas.routes.ts:21,82,125`, `connectors.routes.ts:39`, `git.routes.ts:27`, `users.routes.ts:69`).
- Errors: **inconsistent shape** — `{message}` in auth/projects/tasks/checklists/dependencies/users/importExport/dashboard/uiLayout/git; `{error}` in canvas/backup/monitoring. Example `{message}`: `projects.routes.ts:14`; example `{error}`: `canvas.routes.ts:23`, `backup.routes.ts:14`, `monitoring.routes.ts:20`.
- Status codes by router (VERIFIED): `auth` 201/400/409/500; `users` 201/400/404/409/500; `projects` 201/400/404/500; `tasks` 201/400/404/500; `checklists` 201/400/404/500; `dependencies` 201/400/404/500; `git` 201/400/404/500; `canvas` 201/404/500; `connectors` 201/400/404/500; `backup` 201/404/500; `importExport` 400/500; `uiLayout` 400/500; `dashboard` 500 only.
- `DELETE /api/projects/:id` is a **soft delete / archive** (`project.service.ts:113-119`), and the response message is `"Project archived"` (`projects.routes.ts:60`).
- `DELETE /api/tasks/:id` is a hard delete (`task.service.ts:160-165`).

### 2.5 Auth conventions (VERIFIED)

| Concern | Evidence |
|---|---|
| Human auth | JWT bearer, `requireAuth` (`backend/src/middleware/auth.middleware.ts:8-22`); `AuthRequest.user = {user_id,email,role}` (4-6) |
| JWT secret | `process.env.JWT_SECRET` with fallback `"project-manager-jwt-secret"` — `auth.middleware.ts:15`; same fallback in `auth.service.ts:37,62,86,123` and `agentLoginService.ts:35` |
| Token TTL | 7 days (`auth.service.ts:38,63,124`; `agentLoginService.ts:36`) |
| Role gate | `requireRole(...roles)` (`auth.middleware.ts:24-32`); **only used in `users.routes.ts:43,56,79`** |
| Agent auth | SHA-256 API key hash (`agentAuthMiddleware.ts:22-26`); `verifyAgentRole` (`40-51`); agent JWT `type:"agent"` (`agentLoginService.ts:29-37`) |
| Rate limiting | `apiLimiter` 100 req / 15 min (`rateLimit.middleware.ts:3-12`); `authLimiter` 1000 req / 15 min (`15-21`) |
| Security headers | `helmet`, CSP only when `NODE_ENV=production` (`security.middleware.ts:7-12`); CORS default `http://localhost:5173`, `http://localhost:4000` (`15-26`) |
| Demo accounts | Hardcoded in-memory `DEMO_USERS` with bcrypt hashes (`auth.service.ts:8-12`); demo login mints a **fresh `uuidv4()` user_id each login** (`auth.service.ts:61,68`) |
| Duplicated middleware | `requireAuth` also defined in `auth.service.ts:79-92`; `requireRole` also in `auth.service.ts:130-138` |

---

## 3. SQLite schema / table map (VERIFIED)

### 3.1 Schema source

`backend/src/database/schema.sql` — 246 lines, **18 tables**, `CREATE TABLE IF NOT EXISTS` (idempotent), applied on first connection (`backend/src/database/index.ts:9,18`). WAL mode and foreign keys are enabled per connection (`database/index.ts:15-16`).

| Table | Lines | Key columns / notes |
|---|---|---|
| `users` | 4-15 | `user_id` PK, `email` UNIQUE, `password_hash`, `role` default `viewer`, `status`, `last_login_at`, `ip_address`, `device_fingerprint` |
| `projects` | 17-26 | `project_id` PK, `created_by` FK→users, `status` default `active`, `metadata` JSON text |
| `tasks` | 28-41 | `task_id` PK, `project_id` FK, `status` default `todo`, `priority` default `normal`, `assignee_id` FK, `created_by` FK, `metadata`, `due_date` |
| `task_dependencies` | 43-49 | `id` PK, `task_id`/`depends_on_id` FKs, `dependency_type` |
| `comments` | 51-58 | `comment_id` PK, `task_id` FK, `author_id` FK, `body` |
| `checklists` | 60-67 | `checklist_id` PK, `task_id` FK, `is_completed` |
| `checklist_items` | 69-77 | `item_id` PK, `checklist_id` FK, `order_num` |
| `audit_logs` | 79-92 | `log_id` PK, `user_id` FK, `agent_id`, `action`, `target_table/id`, `old_value`/`new_value`, `trigger` |
| `agents` | 94-106 | `agent_id` PK, `name`/`role`/`provider`/`model`/`permissions` NOT NULL, `api_key_hash`, `rate_limit`, `status` |
| `agent_activities` | 108-119 | `activity_id` PK, `agent_id` FK, `user_id` FK, `action`, `target_id/table`, `status` |
| `login_history` | 135-141 | `login_id` PK, `user_id` FK, `ip_address`, `device_fingerprint`, `logged_in_at` |
| `git_commits` | 147-155 | `commit_id` PK, `commit_hash` UNIQUE, `task_id` FK |
| `canvases` | 161-169 | `canvas_id` PK, `project_id` FK, `created_by` FK |
| `canvas_items` | 172-187 | `item_id` PK, `canvas_id` FK, `item_type`, `task_id` FK, x/y/w/h/rotation/z_index, `content`, `style` |
| `canvas_connections` | 190-198 | `connection_id` PK, `canvas_id` FK, `from_item_id`/`to_item_id` FKs, `connection_type` |
| `connectors` | 205-215 | `connector_id` PK, `provider`, `status` default `disconnected`, `config` JSON text, `created_by` |
| `connector_configs` | 217-226 | `config_id` PK, `connector_id` FK, `key`/`value`, `is_secret`, UNIQUE(`connector_id`,`key`) |
| `ui_layouts` | 234-243 | `layout_id` PK, `user_id`, `page`, `elements` JSON, `is_locked`, UNIQUE(`user_id`,`page`) |

Indexes (VERIFIED): `idx_tasks_project` (122), `idx_tasks_status` (123), `idx_tasks_assignee` (124), `idx_tasks_due_date` (125), `idx_tasks_created_at` (126), `idx_deps_task` (127), `idx_comments_task` (128), `idx_audit_user` (129), `idx_audit_target` (130), `idx_audit_created_at` (131), `idx_agents_role` (132), `idx_agents_status` (133), `idx_login_history_user` (143), `idx_login_history_time` (144), `idx_task_title_project` UNIQUE (145), `idx_git_commits_task` (157), `idx_git_commits_hash` (158), `idx_canvas_items_canvas` (200), `idx_canvas_conn_canvas` (201), `idx_connectors_provider` (228), `idx_connectors_status` (229), `idx_connector_configs_connector` (230), `idx_ui_layouts_user` (245), `idx_ui_layouts_page` (246).

### 3.2 Live database (VERIFIED, read-only)

Command: Python `sqlite3` opened `backend/data/app.db` with a read-only URI (`file:...?mode=ro`). Result: **18 tables**, `journal_mode = wal`.

| Table | Live rows | Table | Live rows |
|---|---:|---|---:|
| `users` | 36 | `canvases` | 0 |
| `projects` | 70 | `canvas_items` | 0 |
| `tasks` | 42 | `canvas_connections` | 0 |
| `task_dependencies` | 7 | `connectors` | 0 |
| `checklists` | 7 | `connector_configs` | 0 |
| `checklist_items` | 14 | `agents` | 0 |
| `comments` | 0 | `agent_activities` | 0 |
| `audit_logs` | 0 | `login_history` | 0 |
| `git_commits` | 0 | `ui_layouts` | 1 |

- All 36 live users have `role = 'viewer'`; **no owner/editor exists in the database** (verified by `SELECT email, role, status FROM users`).
- Tasks by status: `todo 34`, `in_progress 8` (no `done`/`blocked`).
- Dependencies by type: `blocks 7`.
- One `ui_layouts` row exists (`user_id 102f25a4-207b-4586-a12e-1e9dc69ae47d`, `page 'projects'`, `is_locked 1`, 2 chars of elements) — evidence the excluded Design Mode path was exercised once.
- **No automation/workflow/execution/approval/environment tables exist** — consistent with `PHASE1_DISCOVERY_DECISION_PACK.md:61`.

### 3.3 Schema/service alignment gaps (VERIFIED)

- `agentAuthService.ts:33-36` inserts into `agents (agent_id, api_key_hash, role, status, created_at, expires_at)` — **`expires_at` is not a column** in the `agents` table (schema.sql:94-106), and `name`/`provider`/`model`/`permissions` are NOT NULL without defaults. The insert cannot succeed.
- `agentAuthService.ts:40-43` inserts into **`agent_tokens`, which does not exist** in `schema.sql` or the live DB (18-table list above). `POST /api/agents/register` is broken at runtime.
- `audit_logs` and `agent_activities` are never written by any service — a repo-wide search found references only in `schema.sql` (4 and 1 hits respectively).
- `comments` is only **read** by export (`backend/src/services/importExport.service.ts:23,312-322`); no comments route exists.

---

## 4. Docker / CI / backup / monitoring evidence

### 4.1 Docker (VERIFIED by file read)

`Dockerfile` (30 lines, multi-stage):

| Lines | Stage | Action |
|---|---|---|
| 5-10 | `frontend-builder` (`node:22-alpine`) | `npm ci --omit=dev`; `npm run build` |
| 12-17 | `backend-builder` | `npm ci --omit=dev`; `npm run build` (i.e. `tsc`, `backend/package.json:8`) |
| 19-30 | `runtime` | copies `backend/dist` (22), `backend/node_modules` (23), **frontend `dist` into `./backend/dist`** (24); `ENV NODE_ENV=production PORT=4000` (25); `DB_PATH=/app/backend/data/app.db` (26); `EXPOSE 4000` (28); `CMD ["node","dist/server.js"]` (30) |

`docker-compose.yml` (29 lines): `target: runtime` (7); `ports "4000:4000"` (9); env `NODE_ENV=production`, `PORT=4000`, `CORS_ORIGIN=http://localhost:4000`, `DB_PATH`, `JWT_SECRET` fallback (10-17); named volume `app_data:/app/backend/data` (18-19); `restart: unless-stopped` (20); healthcheck `curl -f http://localhost:4000/health` every 30s (21-26).

`.dockerignore` (18 lines): excludes `node_modules/` (1), `dist/` (3), `data/` (6), `.env` (7), `*.db*` (16-18).

### 4.2 CI (VERIFIED by file read)

`.github/workflows/ci-cd.yml` (98 lines): triggers push to `main`, tags `v*`, PRs to `main`, manual (3-9); `NODE_VERSION: "22"` (12); `validate` job — install, typecheck backend + frontend, backend tests, frontend build (16-35); `build-and-push` to GHCR tagged `sha` + `latest` (37-64); `deploy-staging` on push to main (66-80) — `docker compose up -d --pull always` (75), `curl -fsS http://localhost:4000/health` (78); `deploy-prod` on `v*` tags (82-98) — same compose up (91), health (94), SPA title check (96).

Absent from the workflow (contrary to `docs/ci-cd-pipeline.md`): Trivy/image scan, cleanup/retention job, staging/prod compose overlays, smoke tests.

### 4.3 Backup (VERIFIED)

- API: `POST/GET/DELETE /api/backup`, `POST /api/backup/prune` (`backend/src/routes/backup.routes.ts:9,19,29,42`); service copies DB + `-wal` + `-shm` after `PRAGMA wal_checkpoint(PASSIVE)` (`backend/src/services/backup.service.ts:22-59`), lists (61-76), deletes (78-90), prunes to N=30 (92-100). Default dir `process.cwd()/backups` (6) → `backend/backups/` in dev (two backup sets present on disk, dated 2026-11-09).
- CLI: `scripts/backup.sh` (42 lines), `scripts/restore.sh` (44), `scripts/rollback.sh` (41). `backup.sh` checkpoints WAL (15-17), copies DB/WAL/SHM (20-35), prunes to 30 (37-40). `restore.sh` stops compose (21-23), snapshots current DB to `.pre-restore` (26-29), restores (32-42). `rollback.sh` requires an image tag, pulls, `docker compose up -d`, polls `/health` (30-41).
- `docs/backup-config.md:7` claims a **nightly 00:00 UTC cron/GitHub Actions workflow** — **no such workflow exists** (only `.github/workflows/ci-cd.yml`, triggers at lines 3-9).
- `docs/backup-config.md:10` claims optional **S3/Azure cloud bucket** — no cloud config exists in the repo.
- Docker note: the named volume mounts only `/app/backend/data` (`docker-compose.yml:18-19`); API-created backups under `/app/backend/backups` are **not** on the volume and are ephemeral.

### 4.4 Monitoring (VERIFIED, with documentation mismatch)

- `GET /health` (no auth) returns **only** `{ status, database }` — `backend/src/server.ts:58-60` and `backend/src/index.ts:54-56`.
- `GET /api/monitoring/health` returns the full health object (uptime, memory, cpu, timestamp) — `backend/src/routes/monitoring.routes.ts:8-12`; shape defined at `backend/src/services/monitoring.service.ts:5-18,30-57`; HTTP 503 when status ≠ ok (10).
- `GET /api/monitoring/metrics` requires auth and returns `{ metrics: {...} }` — `monitoring.routes.ts:15-22`; metrics shape `monitoring.service.ts:20-28,59-98`.
- `docs/monitoring-config.md:5-6` claims `GET /health` returns `{ status, database, uptime, memory, cpu, timestamp }` — **incorrect**; that is `/api/monitoring/health`.
- `docs/monitoring-config.md:9-10` claims `/api/monitoring/metrics` returns the metrics object directly — actual response is wrapped in `{ metrics }`.
- `docs/monitoring-config.md:12-37` defines 5 alert rules and `:39-42` JSON log aggregation — **no implementation exists** (no alert config, no structured logger; the only logging is `console.error` in the Express error handlers, e.g. `server.ts:69`).
- Docker healthcheck (`docker-compose.yml:21-26`) and CI (`ci-cd.yml:78,94`) both target `http://localhost:4000/health`.

### 4.5 Deployment documentation status

- `docs/ci-cd-pipeline.md` is a **plan**, partly superseded: it specifies `NODE_VERSION: "20"` (line 60) while the real workflow uses `22` (`ci-cd.yml:12`); it specifies Trivy (line 32), cleanup job (163-173), and `docker-compose.staging.yml` / `docker-compose.prod.yml` overlays (33-34, 154) — none of those files exist.
- `docs/deployment-checklist.md` references `docker-compose.dev.yml`, `docker-compose.staging.yml`, `docker-compose.prod.yml` (lines 34, 40, 46) — none exist.
- `docs/environment-variables.md:10` states `index.ts` reads `TEST_PORT || 0` — `backend/src/index.ts` contains **no `listen` call at all** (76 lines, exports only).

---

## 5. Dependency map

### 5.1 Manifests

| Manifest | Path | Key contents |
|---|---|---|
| Root | `package.json` | Scripts `install:all`, `build:all`, `typecheck:all`, `test:all`, `dev`, `docker:*` (6-16); devDep `concurrently ^9.0.0` (17-19) |
| Frontend | `frontend/package.json` | React `^19.2.0`, `react-dom ^19.2.0`, `react-router-dom ^7.7.0`, `@tanstack/react-query ^5.83.0`, `@dnd-kit/core ^6.3.1`, `@dnd-kit/utilities ^3.2.2`, `bcryptjs ^3.0.2`, `cors ^2.8.5`, `express ^4.21.2`, `jsonwebtoken ^9.0.2`, `uuid ^9.0.0` (12-26); dev: `tailwindcss ^3.4.11`, `vite ^6.3.5`, `typescript ^5.9.3`, `@vitejs/plugin-react ^5.1.4` (27-36) |
| Backend | `backend/package.json` | `express ^4.21.2`, `bcryptjs ^3.0.2`, `cors ^2.8.5`, `dotenv ^16.3.1`, `express-rate-limit ^7.5.0`, `helmet ^8.1.0`, `jsonwebtoken ^9.0.2`, `uuid ^9.0.0` (18-27); dev: `tsx ^4.20.0`, `typescript ^5.9.3`, `vite ^6.4.5`, `jest ^30.5.2`, `supertest ^7.3.1`, `tailwindcss`, `postcss`, `autoprefixer`, `@vitejs/plugin-react` (28-45) |

### 5.2 Runtime platform

- Node built-in SQLite: `node:sqlite` `DatabaseSync` (`backend/src/database/index.ts:1`). Requires **Node ≥ 22**; Docker base is `node:22-alpine` (`Dockerfile:5,12,19`). `docs/ci-cd-pipeline.md:178` correctly flags the Node-20 incompatibility that the old plan had.
- Backend is ESM (`backend/package.json:46`), `module: NodeNext` (`backend/tsconfig.json:4-5`), imports use `.ts` extensions with `allowImportingTsExtensions` (`backend/tsconfig.json:19`).
- Dev runner: `tsx src/server.ts` (`backend/package.json:7`); production: `node dist/server.js` (`backend/package.json:9`).
- No shared types package: frontend mirrors domain types in `frontend/src/types/index.ts:4-95` and `frontend/src/types/canvas.ts:3-76`; backend defines its own interfaces (e.g. `task.service.ts:4-40`, `project.service.ts:4-28`).
- No API client library; no frontend test runner or test files (root `tests/` directory is empty; `frontend/package.json` has no `test` script).

### 5.3 Declared-but-unused dependencies (VERIFIED by import scan)

| Package | Declared in | Imported? |
|---|---|---|
| `@dnd-kit/core`, `@dnd-kit/utilities` | `frontend/package.json:13-14` | **Not imported anywhere** |
| `bcryptjs`, `jsonwebtoken`, `cors`, `express`, `uuid` | `frontend/package.json:17-20,25` | **Not imported anywhere** |
| `autoprefixer`, `postcss` | `frontend/package.json:16,21` | Not imported (Tailwind handles CSS) |
| `jest` | `backend/package.json:38` | Not imported; test script is `node --test` (`backend/package.json:14`) |
| `tailwindcss`, `autoprefixer`, `postcss`, `@vitejs/plugin-react` | `backend/package.json:37,39,41,44` | Not imported |
| `tsx` | `backend/package.json:42` | CLI only, not imported |

### 5.4 Missing scripts / files (VERIFIED)

- `backend/package.json:11-12` references `src/database/seed.ts` and `src/database/reset.ts` — **neither file exists** (`backend/src/database/` contains only `index.ts/.js`, `migrate.ts/.js`, `schema.sql`).
- `frontend/package.json` has **no `dev` script**, but root `package.json:11` runs `npm run dev --prefix frontend`.
- Compiled JS orphans in source: `backend/src/database/index.js` and `backend/src/database/migrate.js` (the latter imports `Database` from `node:sqlite`, which the module does not export — it exports `DatabaseSync`). These are stale artifacts, not referenced by any `.ts` import.
- Stale build output: `backend/dist/` exists locally but `backend/dist/database/schema.sql` is 128 lines / 10 tables (dated 2026-11-06), while `backend/src/database/schema.sql` is 246 lines / 18 tables (2026-11-09). `tsc` does not copy `.sql`, so this file is a leftover.

### 5.5 Component wiring map (VERIFIED by import graph)

| Component | Imported by |
|---|---|
| `components/layout/AppShell.tsx` | `main.tsx` |
| `components/layout/Icon.tsx` | 14 files (AppShell, Appearance, Canvas, CanvasList, Connectors, GitCommits, Login, ReviewQueue, Users, ProjectSwitcher, TaskForm, ChecklistForm, DependencyForm, `components/ui/Icon.tsx`) |
| `components/ui/Icon.tsx` | re-exports `layout/Icon` (1 line) |
| `components/projects/ProjectSwitcher.tsx` | `AppShell.tsx:8` |
| `components/canvas/*` (CanvasViewport, CanvasToolbar, PropertiesPanel, ShapeSelector, TaskPicker, ConnectionLine, CanvasItem) | `pages/Canvas.tsx`, `CanvasViewport.tsx`, `PropertiesPanel.tsx` |
| `components/checklists/*`, `components/dependencies/*` | `pages/TaskWorkspace.tsx` |
| `components/users/*` (UserFormDialog, UserList, UserProfile) | `pages/Users.tsx` |
| `components/git/GitCommitForm.tsx` | `pages/GitCommits.tsx` |
| `components/auth/*` (LoginForm, RegisterForm) | `pages/Login.tsx` |
| **`components/canvas/TaskCard.tsx`** | **orphan — no importer** |
| **`components/design/DesignCanvas.tsx`** | **orphan — only imported by the design subtree itself** |
| **`components/design/DesignModeContext.tsx`, `DesignToolbar.tsx`, `DraggableElement.tsx`, `ContextMenu.tsx`** | only within `components/design/*` — no page imports them |
| **`components/projects/ProjectForm.tsx`, `ProjectList.tsx`** | **orphan — no importer** |
| **`components/tasks/TaskForm.tsx`, `TaskList.tsx`** | **orphan — no importer** |
| **`components/theme/ThemeCustomizer.tsx`** | **orphan — no importer** |
| **`App.tsx`** | **orphan — `main.tsx` does not import it** |

Consequence: `ui-layout` endpoints (`uiLayout.routes.ts`) have **no live frontend consumer** — the only caller is the orphaned `DesignModeContext.tsx:176,188,198`.

---

## 6. VERIFIED shipped capability vs REPORTED / documentation-only intent

### 6.1 VERIFIED shipped (code present and wired)

| Capability | Evidence |
|---|---|
| React 19 + Vite SPA, 15 routers registered | `main.tsx:32-51`; `frontend/package.json:22-24` |
| TanStack Query server state, 11 key families | `main.tsx:22`; §1.5 |
| JWT auth (register/login/me), bcrypt hashing | `auth.routes.ts:6-25`; `auth.service.ts:14-128` |
| Projects CRUD + archive (soft delete) | `projects.routes.ts:8-64`; `project.service.ts:113-119` |
| Tasks CRUD + filtering + dashboard aggregation | `tasks.routes.ts:8-81`; `dashboard.routes.ts:7-49` |
| Checklists + items CRUD | `checklists.routes.ts:8-81`; `checklist.service.ts:36-186` |
| Dependencies CRUD + blocking/blocked-by queries | `dependencies.routes.ts:8-81`; `dependency.service.ts:25-143` |
| Canvas CRUD + items + connections + task cards | `canvas.routes.ts:11-142`; `canvas.service.ts:50-319`; `useCanvas.ts`; `Canvas.tsx` |
| Connectors: definitions, instances, config, status, test, GitHub/Hermes actions | `connectors.routes.ts:8-147`; `connector.service.ts:27-338` |
| Git commit record/list/by-task/link/parse | `git.routes.ts:12-104`; `git.service.ts:15-129` |
| Import/export JSON, CSV, Markdown, PDF, XLSX; project-scoped export/import | `importExport.routes.ts:8-122`; `importExport.service.ts:15-508` |
| Users list/create/update + login history | `users.routes.ts:14-92`; `user.service.ts:34-122` |
| UI layout get/save/delete | `uiLayout.routes.ts:8-38`; `uiLayout.service.ts:29-71` |
| Agent register/login/me endpoints | `agents.routes.ts:12-26`; `agentAuthService.ts:8-55`; `agentLoginService.ts:8-54` |
| Backup create/list/delete/prune (API + CLI) | `backup.routes.ts:9-50`; `backup.service.ts:16-100`; `scripts/backup.sh` |
| Monitoring health + metrics | `monitoring.routes.ts:8-22`; `monitoring.service.ts:30-98` |
| Theme engine: 6 presets, custom `#RRGGBB`, pre-mount bootstrap | `ThemeProvider.tsx:12-49,71-206`; `index.html:8-62`; `Appearance.tsx:14-25` |
| Command palette (Ctrl/Cmd+K) with live task/project search | `AppShell.tsx:285-443,578-598` |
| Kanban board view + quick status move in Task Workspace | `TaskWorkspace.tsx:20-21,508-509`; `UI_UX_PROGRESS.md:19` |
| Glass design system, 27 `--pm-*` tokens | `frontend/src/index.css` (27 custom properties, verified by regex count) |
| SQLite 18 tables, WAL, FK-on, live data | `schema.sql`; `database/index.ts:15-16`; live DB query §3.2 |
| Docker multi-stage + compose + GHCR CI/CD | `Dockerfile`; `docker-compose.yml`; `ci-cd.yml` |
| 32-icon unified icon set | `components/layout/Icon.tsx` (`IconName` union) |

### 6.2 REPORTED / documentation-only / not shipped

| Claim | Source | Reality (VERIFIED) |
|---|---|---|
| Automation Studio is an executable workflow tool | `UI_UX_REDESIGN_PLAN.md:173-214`; `UI_UX_PROGRESS.md:22` | **Preview-only mock.** `AutomationStudio.tsx:29` "Preview only · no runtime connected"; `:30` Publish disabled; `:80` "Sample data"; `:216` "Replay node · future" disabled; no `fetch` in the file |
| Agent approval / proposal review queue | `UI_UX_REDESIGN_PLAN.md:109,226`; `KANBAN_BOARD.md:45` | `ReviewQueue.tsx:9-10` reads `/api/tasks?status=blocked` + `/api/dashboard`; **no agent approval API exists**; `agents` and `agent_activities` tables are empty |
| Audit trail | `KANBAN_BOARD.md:43`; `schema.sql:79-92` | Table exists but **never written**; no audit service/route |
| Agent activity log | `schema.sql:108-119` | Table exists but **never written** |
| Comments on tasks | `KANBAN_BOARD.md:41`; `schema.sql:51-58` | **No comments route**; table read only during export (`importExport.service.ts:23,312-322`) |
| Offline sync | `KANBAN_BOARD.md:48` | No code, no schema |
| Multi-provider AI / token cost control | `KANBAN_BOARD.md:46`; `.env.example:26-28` | Keys are commented out; no provider code; connectors have Hermes/GitHub actions only |
| Nightly backups + cloud bucket | `docs/backup-config.md:7,10` | No scheduled workflow, no cloud config; only manual API + `scripts/backup.sh` |
| Monitoring alerts + JSON log aggregation | `docs/monitoring-config.md:12-42` | No alert rules, no logger; only `console.error` |
| Trivy scan, image cleanup job, staging/prod compose overlays | `docs/ci-cd-pipeline.md:31-35,154,163-173` | Absent from `ci-cd.yml`; overlay files do not exist |
| `docker-compose.dev/staging/prod.yml` | `docs/deployment-checklist.md:34,40,46` | Do not exist |
| `db:seed` / `db:reset` | `backend/package.json:11-12` | Scripts reference non-existent files |
| Design Mode in main workspace | `UI_UX_PROGRESS.md:9` (excluded), `UI_UX_REDESIGN_PLAN.md:112-152` (proposed hierarchy) | Design components orphaned; `ui-layout` API has no live consumer; one leftover `ui_layouts` row |
| Full health payload at `/health` | `docs/monitoring-config.md:5-6` | `/health` returns `{status, database}` only (`server.ts:58-60`); full payload is `/api/monitoring/health` |
| `PORT`/`NODE_PORT` = 4000 in production | `Dockerfile:25`; `docker-compose.yml:12`; `docs/environment-variables.md:10` | `server.ts:98` reads `NODE_PORT` with default `3000`; nothing sets `NODE_PORT` → container listens on **3000** |
| Backend production build works | Implied by `Dockerfile:17`; `docs/ci-cd-pipeline.md:176-180` | `backend/tsconfig.json:19` sets `allowImportingTsExtensions: true` with no `noEmit`/`emitDeclarationOnly` → `tsc` fails (TS5096); `backend/dist` is stale |
| RBAC across the product | `KANBAN_BOARD.md:42`; `UI_UX_REDESIGN_PLAN.md:170` | `requireRole` is used **only** in `users.routes.ts:43,56,79`; all other routes are auth-only; all 36 live users are `viewer` |

---

## 7. Architecture risks and gaps

Ranked by severity. Each item cites its evidence.

1. **Critical — container port mismatch.** `Dockerfile:25` and `docker-compose.yml:12` set `PORT=4000`, but `backend/src/server.ts:98` reads `process.env.NODE_PORT || "3000"`. Nothing in the repo sets `NODE_PORT` (repo-wide search: only `server.ts:98` and `docs/environment-variables.md:10`). The container listens on 3000 while `docker-compose.yml:22` healthcheck and `ci-cd.yml:78,94` curl `localhost:4000` → healthcheck fails and deploy verification fails. Local evidence agrees: `backend/server.log:3` shows `http://localhost:3000`.
2. **Critical — backend build is broken.** `backend/tsconfig.json:19` `"allowImportingTsExtensions": true` with no `noEmit`/`emitDeclarationOnly` (the full file has neither) → TypeScript emits TS5096 and `npm run build` (`backend/package.json:8`) fails. `Dockerfile:17` runs that build in `backend-builder`, so the image build fails.
3. **Critical — runtime `schema.sql` missing from a clean image.** `backend/src/database/index.ts:9` does `readFileSync(path.join(__dirname, "schema.sql"))`. In production `dist/database/index.js` resolves that to `dist/database/schema.sql`. `tsc` does not copy `.sql`; `.dockerignore:3` excludes local `dist/`; the only `dist/database/schema.sql` is a stale 128-line/10-table leftover (§5.4). A clean image would throw `ENOENT` at startup.
4. **Critical — agent registration is broken SQL.** `agentAuthService.ts:34` inserts an `expires_at` column that does not exist in `agents` (schema.sql:94-106), and `agentAuthService.ts:41` inserts into `agent_tokens`, which does not exist in the schema or live DB. `POST /api/agents/register` cannot succeed.
5. **High — demo users cannot create records.** `auth.service.ts:8-12` hardcodes three demo accounts with known passwords (`owner123`, `editor123`, `viewer123`); demo login returns a fresh `uuidv4()` user_id (`auth.service.ts:61,68`) that is never inserted into `users`. With `PRAGMA foreign_keys = ON` (`database/index.ts:16`), any `POST /api/projects` or `/api/tasks` from a demo session violates the `created_by` FK → 500.
6. **High — hardcoded JWT fallback secret.** `auth.middleware.ts:15`, `auth.service.ts:37,62,86,123`, `agentLoginService.ts:35` all fall back to `"project-manager-jwt-secret"`. If `JWT_SECRET` is unset, tokens are forgeable. `docker-compose.yml:15` ships a `change-me-in-production` default.
7. **High — connector secrets exposed.** Secrets are stored plaintext twice: `connectors.config` JSON (`connector.service.ts:126`) and `connector_configs.value` with only an `is_secret` flag (`connector.service.ts:135,166`). `getInstance` (`connector.service.ts:99-114`) and `listInstances` (`76-97`) return the full `config`, and `GET /api/connectors/:id` (`connectors.routes.ts:23-31`) returns it to any authenticated user. `getInstance`/`updateConfig`/`deleteInstance`/`testConnection` perform **no ownership check**, while `listInstances` filters by `created_by` only when a userId is passed.
8. **High — RBAC is effectively absent and the People UI cannot work.** `requireRole` appears only in `users.routes.ts:43,56,79`; every other router is auth-only. All 36 live users are `viewer` (§3.2), so no DB account can list/create/update users — only the hardcoded demo accounts can, and those cannot create records (item 5).
9. **High — no audit trail.** `audit_logs` (schema.sql:79-92) and `agent_activities` (108-119) are never written, contradicting the plan's audit requirements (`UI_UX_REDESIGN_PLAN.md:212-213`).
10. **Medium — no transactions.** Multi-step writes (checklist + items, connector + configs, user + login_history) can partially fail; no rollback path.
11. **Medium — dead and duplicate code.** Seven orphan components plus the entire `components/design/*` subtree and `App.tsx` (§5.5). `TaskForm.tsx`, `TaskList.tsx`, `ProjectForm.tsx`, `ProjectList.tsx` duplicate form/list logic that pages re-implement inline (`Projects.tsx`, `TaskWorkspace.tsx`).
12. **Medium — UI layout API unreachable.** `uiLayout.routes.ts` is mounted, but its only caller is the orphaned `DesignModeContext.tsx:176,188,198`.
13. **Medium — frontend dev workflow is broken.** Root `package.json:11` calls `npm run dev --prefix frontend`, but `frontend/package.json` has no `dev` script; `dev:full` needs `concurrently`, which is not a frontend dependency.
14. **Medium — no frontend tests; backend coverage is narrow.** Backend tests (`backend/src/tests/backend.test.ts`, 362 lines) cover auth, projects, tasks, dependencies, checklists only. Canvas, connectors, import/export, UI layout, backup, monitoring, RBAC, and agents are untested. No frontend test runner exists.
15. **Medium — documentation authority conflict.** `PRD.md` and `KANBAN_BOARD.md` are byte-identical (SHA-256 `e53b9088…`, §0) and mark live features as Pending; `docs/ci-cd-pipeline.md:60` says Node 20 while `ci-cd.yml:12` says 22; `docs/environment-variables.md:10` claims `index.ts` listens on `TEST_PORT` but it never listens.
16. **Low — API error-shape drift.** `{message}` vs `{error}` envelopes (§2.4) and no typed API client make frontend error handling ad hoc.
17. **Low — dependency bloat.** Frontend ships server-only packages (`express`, `bcryptjs`, `jsonwebtoken`, `cors`, `uuid`) and unused drag-and-drop packages; backend ships frontend tooling (`tailwindcss`, `postcss`, `autoprefixer`, `@vitejs/plugin-react`, `jest`) (§5.3).
18. **Low — Vite dev proxy absent.** `frontend/vite.config.ts:9-15` has no `/api` proxy and `allowedHosts: true`; running Vite alone (as `dev:full` does) leaves `/api` calls unresolvable. Only the unified server (`server.ts:78-88`) works.
19. **Low — backup durability in Docker.** `docker-compose.yml:18-19` mounts only `/app/backend/data`; API backups written under `/app/backend/backups` (`backup.service.ts:6`) are ephemeral.
20. **Low — auth rate limit is permissive.** `authLimiter` allows 1000 requests / 15 min (`rateLimit.middleware.ts:15-21`), which is not a meaningful brute-force control.

---

## 8. Evidence index (commands and identifiers)

| Evidence | Command / path | Result |
|---|---|---|
| Branch | `git -C "<root>" branch --show-current` | `main` |
| Commit | `git -C "<root>" rev-parse HEAD` | `d705a364b2e845eb02f33d57475e0e3af15228c7` |
| Working tree | `git -C "<root>" status --short` | 78 entries |
| PRD/Kanban identity | `hashlib.sha256` on both files | both `e53b9088c412fec5f5c73fcf5b0d9aeb834e34acb6306004796d81ed1327f4d2`, 11,866 bytes |
| PM-P2-01 search | repo-wide binary search for `PM-P2` (excluding `node_modules`, `.git`) | 0 hits |
| Live schema | Python `sqlite3` read-only URI on `backend/data/app.db` | 18 tables, WAL mode; counts in §3.2 |
| Token count | regex over `frontend/src/index.css` | 27 `--pm-*` custom properties |
| Dependency usage | import scan over `frontend/src` and `backend/src` | §5.3 |
| Component wiring | import-graph scan over `frontend/src` | §5.5 |
| Route inventory | regex extraction over `backend/src/routes/*.ts` | §2.2 |
| Service inventory | regex extraction over `backend/src/services/*.ts` | §2.3 |
| Schema/table counts | line-numbered read of `backend/src/database/schema.sql` | 246 lines, 18 tables |
| Build config defect | read of `backend/tsconfig.json:19` | `allowImportingTsExtensions: true`, no `noEmit` |
| Stale dist schema | `os.path.getsize` + line count | `backend/dist/database/schema.sql` 4,891 bytes / 128 lines / 10 tables vs source 9,599 bytes / 246 lines / 18 tables |

---

## 9. Scope and limitations

- This is a **static, read-only architecture map**. No runtime endpoints were exercised; no build, typecheck, test, or server start was performed, per the task boundary. Claims about runtime behavior (for example, the demo-user FK failure in risk 5) are inferred from source and schema, not observed.
- Live-data facts (§3.2) come from a read-only SQLite connection; the database was not modified.
- `backend/.env` was read only to confirm which variable names exist; secret values are not reproduced in this artifact.
- The artifact itself is the only file created by this task.

*Prepared as a Phase 2 read-only planning artifact. Not an implementation authorization and not a source-code change.*
