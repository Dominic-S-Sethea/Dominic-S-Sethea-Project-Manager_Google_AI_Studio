# PM-P3-03 — Project Canvas API, Data, Authorization & Failure Contract

- **Card:** PM-P3-03
- **Artifact type:** Planning / contract definition (read-only; no application source or DB schema modified)
- **Date:** 2026-11-10
- **Target surface:** `/api/canvas` (backend) and `frontend/src/hooks/useCanvas.ts` + `frontend/src/types/canvas.ts`
- **Status:** PROPOSED — target-state contract. Nothing in this document is implemented yet.

## 0. Evidence labels used in this document

| Label | Meaning |
|---|---|
| **VERIFIED** | Read directly from the repository at the cited path and line number. |
| **REPORTED** | Asserted by an existing document/test in the repo; not independently re-derived here. |
| **PROPOSED** | Target-state design defined by this contract; not present in code. |
| **UNKNOWN** | Insufficient evidence; must be investigated before implementation. |
| **DECISION-REQUIRED** | Owner/product decision needed; the contract cannot proceed without it. |

---

## 1. Current API & data model evidence

### 1.1 Route surface (VERIFIED)

Router mounted at `/api/canvas` in `backend/src/server.ts:51` and `backend/src/index.ts:47`.
Route file: `backend/src/routes/canvas.routes.ts`.

| Method | Path | Lines | Auth | Request body | Success | Error behavior |
|---|---|---|---|---|---|---|
| POST | `/api/canvas` | 11–25 | `requireAuth` (L8) | `{ project_id?, name, description? }` | `201 { canvas }` | `500 { error: err.message }` |
| GET | `/api/canvas?project_id=` | 28–36 | `requireAuth` | — | `200 { canvases }` | `500 { error }` |
| GET | `/api/canvas/:id` | 39–49 | `requireAuth` | — | `200 { canvas: { …, items, connections } }` | `404 { error: "Canvas not found" }`; `500 { error }` |
| PUT | `/api/canvas/:id` | 52–63 | `requireAuth` | `{ name?, description? }` | `200 { canvas }` | `404 { error: "Canvas not found" }`; `500 { error }` |
| DELETE | `/api/canvas/:id` | 66–76 | `requireAuth` | — | `200 { success: true }` | `404 { error: "Canvas not found" }`; `500 { error }` |
| POST | `/api/canvas/:id/items` | 79–86 | `requireAuth` | item fields (see 1.2) | `201 { item }` | `500 { error }` |
| PUT | `/api/canvas/items/:itemId` | 89–99 | `requireAuth` | item fields | `200 { item }` | `404 { error: "Item not found" }`; `500 { error }` |
| DELETE | `/api/canvas/items/:itemId` | 102–112 | `requireAuth` | — | `200 { success: true }` | `404 { error: "Item not found" }`; `500 { error }` |
| POST | `/api/canvas/:id/connections` | 115–129 | `requireAuth` | `{ from_item_id, to_item_id, connection_type?, style? }` | `201 { connection }` | `500 { error }` |
| DELETE | `/api/canvas/connections/:connId` | 132–142 | `requireAuth` | — | `200 { success: true }` | `404 { error: "Connection not found" }`; `500 { error }` |

Notes:
- `router.use(requireAuth)` at L8 is the **only** authorization on the router. There is no ownership, project-membership, or role check in any canvas route.
- All catch blocks return HTTP `500` with `{ error: err.message }` (L22–24, 33–35, 46–48, 60–62, 73–75, 83–85, 96–98, 109–111, 126–128, 139–141), so driver-level failures (e.g. `SQLITE_CONSTRAINT FOREIGN KEY failed`) are surfaced to clients verbatim.

### 1.2 Service behavior (VERIFIED)

File: `backend/src/services/canvas.service.ts`.

| Function | Lines | Behavior |
|---|---|---|
| `createCanvas(projectId, name, description, createdBy)` | 50–64 | `randomUUID()` id; `new Date().toISOString()` timestamps; `project_id` may be `null`; no validation of `name`. |
| `getCanvasById(canvasId)` | 66–70 | `SELECT * FROM canvases WHERE canvas_id = ?`; returns mapped `Canvas` or `null`. |
| `getCanvasWithItems(canvasId)` | 72–89 | Loads canvas, then `SELECT * FROM canvas_items WHERE canvas_id = ? ORDER BY z_index ASC` (L78) and all connections (L81); no pagination, no limit. |
| `listCanvases(projectId)` | 91–97 | Filtered by `project_id` when provided, else all canvases; `ORDER BY updated_at DESC`; no pagination. |
| `updateCanvas(canvasId, {name?, description?})` | 99–125 | Partial update; bumps `updated_at`; no optimistic concurrency; returns `null` if not found. |
| `deleteCanvas(canvasId)` | 127–137 | Manual cascade: deletes connections touching each item (L130–133), then items (L134), then canvas (L135). **Not wrapped in a transaction.** |
| `addItem(canvasId, item)` | 141–179 | Defaults: `x/y=0`, `width/height=100`, `rotation=0`, `z_index=0`; `item_type` accepted as any string; `task_id` accepted without checking the task's project; no check that `canvasId` exists. |
| `getCanvasItemById(itemId)` | 181–185 | Direct lookup. |
| `updateItem(itemId, updates)` | 187–235 | Partial update of `item_type, x, y, width, height, rotation, content, style, z_index, task_id`; bumps `updated_at`; no validation; no canvas-membership check. |
| `deleteItem(itemId)` | 237–243 | Deletes connections referencing the item first (L240), then the item. |
| `addConnection(canvasId, fromItemId, toItemId, connectionType="line", style=null)` | 247–262 | Inserts with `canvas_id` taken from the path; **never verifies that `fromItemId`/`toItemId` belong to `canvasId`**; no self-loop or duplicate check. |
| `getCanvasConnectionById(connId)` | 264–268 | Direct lookup. |
| `deleteConnection(connId)` | 270–274 | Deletes by id only; no canvas-membership check. |
| Mappers | 278–319 | `mapCanvas`, `mapCanvasItem`, `mapCanvasConnection`; `style` passed through as opaque TEXT. |

### 1.3 Schema (VERIFIED)

File: `backend/src/database/schema.sql`.

**`canvases` (L161–169)**
```
canvas_id   TEXT PRIMARY KEY
project_id  TEXT REFERENCES projects(project_id)   -- nullable (L163)
name        TEXT NOT NULL                          -- no length limit (L164)
description TEXT
created_by  TEXT NOT NULL REFERENCES users(user_id) -- L166
created_at  DATETIME NOT NULL
updated_at  DATETIME NOT NULL
```

**`canvas_items` (L172–187)**
```
item_id     TEXT PRIMARY KEY
canvas_id   TEXT NOT NULL REFERENCES canvases(canvas_id)  -- L174
item_type   TEXT NOT NULL                                -- L175; free TEXT, no CHECK/enum
task_id     TEXT REFERENCES tasks(task_id)               -- L176; nullable; no project-match rule
x           REAL NOT NULL DEFAULT 0                      -- L177
y           REAL NOT NULL DEFAULT 0                      -- L178
width       REAL NOT NULL DEFAULT 100                    -- L179
height      REAL NOT NULL DEFAULT 100                    -- L180
rotation    REAL NOT NULL DEFAULT 0                      -- L181
content     TEXT                                         -- L182
style       TEXT                                         -- L183; opaque JSON string
z_index     INTEGER NOT NULL DEFAULT 0                   -- L184
created_at  DATETIME NOT NULL
updated_at  DATETIME NOT NULL
```

**`canvas_connections` (L190–198)**
```
connection_id   TEXT PRIMARY KEY
canvas_id       TEXT NOT NULL REFERENCES canvases(canvas_id)   -- L192
from_item_id    TEXT NOT NULL REFERENCES canvas_items(item_id) -- L193
to_item_id      TEXT NOT NULL REFERENCES canvas_items(item_id) -- L194
connection_type TEXT NOT NULL DEFAULT 'line'                   -- L195; free TEXT, no CHECK/enum
style           TEXT                                           -- L196
created_at      DATETIME NOT NULL
```

Indexes: `idx_canvas_items_canvas` (L200), `idx_canvas_conn_canvas` (L201). No unique constraint on `(canvas_id, from_item_id, to_item_id)`; no `CHECK` constraints; no `ON DELETE CASCADE` (all FKs are plain `REFERENCES`).

Database pragmas (VERIFIED): `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON` in `backend/src/database/index.ts:15-16`; schema applied via `db.exec(schemaSql)` at L18.

### 1.4 Frontend contract (VERIFIED)

- `frontend/src/types/canvas.ts`
  - L16 `item_type` union: `"task" | "square" | "rectangle" | "circle" | "diamond" | "triangle" | "line" | "arrow" | "text"`.
  - L35 `connection_type` union: `"line" | "arrow"`.
  - L45–57 `CanvasItemStyle` (shape, fill, stroke, strokeWidth, color, textColor, fontSize, fontWeight, textAlign, opacity, borderRadius).
  - L59 `CanvasTool`: `"select" | "square" | "line" | "arrow" | "text" | "task"`.
- `frontend/src/hooks/useCanvas.ts`
  - L87 `GET /api/canvas/${canvasId}`; L90–93 hydrates `canvas`, `items`, `connections`; L94–98 loads tasks for `project_id`.
  - L114 `POST /api/canvas/${canvasId}/items`; L121–127 appends created item.
  - L144–146 `updateItemLocal` — optimistic state patch.
  - L148–167 `persistItem` — `PUT /api/canvas/items/${itemId}`; **on failure returns `null` but does not roll back the optimistic local state**.
  - L169–175 `updateItem` — local patch first, then persist (no version, no rollback).
  - L184–219 `deleteItem` — `DELETE`; filters local state only after success (L207–210).
  - L221–241 `addConnection` — `POST /api/canvas/${canvasId}/connections` with `{ from_item_id, to_item_id, connection_type, style }`.
  - L243–255 `deleteConnection` — `DELETE /api/canvas/connections/${connectionId}`.
  - Error handling is generic: `throw new Error("Failed to …")` (L88, 119, 156, 196, 230, 249) — HTTP status and server message are discarded, so 401/403/404/409 are indistinguishable from network errors.
- `frontend/src/components/canvas/CanvasItem.tsx`
  - L95–127 drag lifecycle: `onUpdateLocal(item_id, {x, y})` on every pointer move (L106); `onSave(item_id, {x, y})` once on pointer-up (L116). No debounce, no version token.
- `frontend/src/pages/Canvas.tsx`
  - L49–77 creates a canvas via `POST /api/canvas` when no `:id` is present; L56 uses raw `fetch` with `getToken()`.
- `frontend/src/pages/CanvasList.tsx`
  - L18–31 lists canvases (`/api/canvas?project_id=…`); L33–56 create; L58–69 delete.
- Routes registered in `frontend/src/main.tsx:45-48`: `/canvas`, `/canvas/:id`, `/canvases`, `/canvases/:projectId`.

### 1.5 Authentication & authorization primitives (VERIFIED)

- `backend/src/middleware/auth.middleware.ts`
  - L8–22 `requireAuth`: requires `Authorization: Bearer <jwt>`; verifies with `JWT_SECRET` (default fallback `"project-manager-jwt-secret"`); sets `req.user = { user_id, email, role }`; 401 `{ message: "Missing or invalid token" }` / `{ message: "Invalid or expired token" }`.
  - L24–32 `requireRole(...roles)`: 403 `{ message: "Insufficient permissions" }`. **Defined but not referenced by any canvas route.**
- `users.role` exists (`schema.sql:9`, default `'viewer'`). There is no role enum, permission matrix, or project-membership table anywhere in the schema (VERIFIED by table list in `backend/data/app.db`: `users`, `projects`, `tasks`, `task_dependencies`, `comments`, `checklists`, `checklist_items`, `audit_logs`, `agents`, `agent_activities`, `login_history`, `git_commits`, `canvases`, `canvas_items`, `canvas_connections`, `connectors`, `connector_configs`, `ui_layouts`).
- Rate limiting: `apiLimiter` applied to all `/api` (`server.ts:38`, `index.ts:34`); `authLimiter` on `/api/auth`. No canvas-specific limit.

### 1.6 What is NOT implemented (VERIFIED)

- No Canvas tests: `backend/src/tests/backend.test.ts` contains no canvas/item/connection test (only a checklist test matched the search at L328–359). REPORTED by `PHASE1_DISCOVERY_DECISION_PACK.md:45` and `:124`.
- No automation/workflow/execution/approval tables or routes (VERIFIED; `PHASE1_DISCOVERY_DECISION_PACK.md:53,61`).
- No audit writes from the canvas service (VERIFIED: `canvas.service.ts` never inserts into `audit_logs`).
- No version/ETag/If-Match anywhere in the canvas stack (VERIFIED by reading routes, service, schema).
- No pagination anywhere in the canvas stack (VERIFIED).
- No transaction wrapper in the canvas service (VERIFIED).

---

## 2. Gap analysis

Each item is a finding with evidence. Severity is PROPOSED.

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| F1 | **Critical** | **No authorization beyond authentication.** Any authenticated user can read, update, or delete any canvas, item, or connection, regardless of project or creator. | `canvas.routes.ts:8` (only `requireAuth`); no `created_by`/project check in any handler; `requireRole` exists but unused (`auth.middleware.ts:24-32`). |
| F2 | **Critical** | **No canvas-membership validation on item/connection writes.** `POST /:id/items` never checks the canvas exists; `POST /:id/connections` never checks `from_item_id`/`to_item_id` belong to `:id`; item/connection update/delete never scope to a canvas. Cross-canvas connections are therefore possible, and FK failures surface as 500 with raw driver text. | `canvas.routes.ts:79-86, 89-99, 102-112, 115-129, 132-142`; `canvas.service.ts:141-179, 187-243, 247-262, 270-274`. |
| F3 | **High** | **No input validation.** `item_type` and `connection_type` are free TEXT; no bounds on coordinates/size/rotation/z-index; no length limits on `name`/`content`/`style`; `style` is opaque and parsed client-side with a silent `{}` fallback. | `schema.sql:164, 175, 182-183, 195-196`; `canvas.service.ts:141-179, 187-235, 247-262`; `PropertiesPanel.tsx:85-93`; `CanvasItem.tsx:28-39`. |
| F4 | **High** | **Inconsistent, leaking error contract.** Canvas routes return `{ error: message }` with HTTP 500 for every failure; other modules return `{ message }`; auth returns `{ message }`. Raw SQLite messages are exposed. | `canvas.routes.ts:22-24` (and every catch block); `projects.routes.ts:14,24,41,52,62`; `auth.middleware.ts:11,20,28`. |
| F5 | **High** | **No optimistic concurrency / versioning.** No version column, no ETag/If-Match; last-write-wins on canvas and item updates. The frontend patches local state optimistically and never rolls back on failure, so a failed save looks successful. | `schema.sql:161-198` (no version column); `canvas.service.ts:99-125, 187-235`; `useCanvas.ts:144-146, 148-175`. |
| F6 | **Medium** | **No pagination.** `GET /api/canvas` returns every canvas; `GET /api/canvas/:id` returns every item and connection. | `canvas.routes.ts:28-36, 39-49`; `canvas.service.ts:72-89, 91-97`. |
| F7 | **Medium** | **No audit trail.** `audit_logs` exists but canvas mutations write nothing, so actor identity and before/after state are lost. | `schema.sql:79-92`; `canvas.service.ts` (no `audit_logs` insert). |
| F8 | **Medium** | **No transactionality.** `deleteCanvas` runs 3+ statements without a transaction; concurrent operations can observe partial state. | `canvas.service.ts:127-137`. |
| F9 | **Low** | **Canvas `updated_at` is not bumped by item/connection mutations**, so the list ordering (`ORDER BY updated_at DESC`) does not reflect content edits. | `canvas.service.ts:91-97` vs `187-243, 247-274`. |
| F10 | **Medium** | **No FK cascades.** Deleting a canvas depends on a hand-written cascade; any future delete path that skips it is blocked by FK. | `schema.sql:174, 192-194` (no `ON DELETE`); `canvas.service.ts:127-137`. |
| F11 | **High** | **Cross-project task linking is possible.** `canvas_items.task_id` references `tasks` but nothing checks the task belongs to the canvas's project. | `schema.sql:176`; `canvas.service.ts:141-179`. |
| F12 | **Medium** | **Global canvases are undefined.** `project_id` is nullable and `POST` accepts `null`, but no rule defines who may create/read them. | `schema.sql:163`; `canvas.routes.ts:13-20`; `canvas.service.ts:50-64`. |
| F13 | **Low** | **No canvas-specific rate limiting** beyond the global `/api` limiter. | `server.ts:38`; `index.ts:34`. |
| F14 | **Medium** | **Frontend error handling is generic** and discards status codes, so 401/403/404/409 cannot be distinguished from network failure; no conflict UI exists. | `useCanvas.ts:88, 119, 156, 196, 230, 249`; `Canvas.tsx:68, 71-74`. |
| F15 | **Medium** | **No Canvas test coverage** (backend or frontend). | `backend.test.ts` (no canvas cases); `PHASE1_DISCOVERY_DECISION_PACK.md:45,124`. |

---

## 3. Proposed target contract

> Everything in this section is **PROPOSED**. Items marked **DECISION-REQUIRED** must be resolved before implementation.

### 3.1 Conventions

- **Base path:** `/api/canvas` (unchanged for now). API versioning strategy is **DECISION-REQUIRED** (see §3.6).
- **Auth:** `Authorization: Bearer <jwt>` on every request (unchanged; `requireAuth`).
- **Content type:** `application/json; charset=utf-8` for bodies.
- **IDs:** UUID v4 strings (unchanged; `randomUUID()`).
- **Timestamps:** ISO 8601 UTC strings (unchanged; `new Date().toISOString()`).
- **Style payload:** JSON object serialized to TEXT, validated server-side against the `CanvasItemStyle` shape (PROPOSED; currently opaque).
- **Idempotency:** `POST` create endpoints accept an optional `Idempotency-Key` header (PROPOSED). On replay with the same key, the server returns the original response without creating a second resource. Keys are retained for 24h. **DECISION-REQUIRED** on whether this is in scope for v1.
- **Unified error envelope (PROPOSED):**
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Human-readable summary",
      "details": [
        { "field": "name", "code": "REQUIRED", "message": "name is required" }
      ],
      "request_id": "req_01H…"
    }
  }
  ```
  - The current `{ error: "string" }` shape is retained as a fallback for one release, then removed. Other modules' `{ message }` shape is out of scope for this card.
  - Server never returns stack traces, SQL, or driver messages. The full error is logged server-side with `request_id`.

### 3.2 Error codes and HTTP status mapping (PROPOSED)

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed body or field constraint violation (see `details`). |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired token (unchanged behavior, new body shape). |
| 403 | `FORBIDDEN` | Authenticated but not permitted (owner/admin rule failed). |
| 404 | `CANVAS_NOT_FOUND` / `ITEM_NOT_FOUND` / `CONNECTION_NOT_FOUND` / `PROJECT_NOT_FOUND` | Resource does not exist **or** is not visible to the caller. |
| 409 | `VERSION_CONFLICT` | `If-Match`/`expected_version` mismatch; body includes the current resource. |
| 409 | `CONFLICT` | Uniqueness/semantic conflict (e.g. duplicate connection, if duplicates are rejected). |
| 422 | `SEMANTIC_ERROR` | Well-formed but invalid in context (e.g. item from another canvas, cross-project task). |
| 429 | `RATE_LIMITED` | Too many requests; includes `Retry-After`. |
| 500 | `INTERNAL_ERROR` | Unexpected failure; generic message only. |

**DECISION-REQUIRED:** whether unauthorized access returns `403` or `404` (this contract proposes **404 for reads, 403 for writes**, to avoid existence probing while still giving writers a clear signal).

### 3.3 Authorization model (PROPOSED)

**Principle:** Canvas is a project-scoped visual planning surface. Access follows project access; ownership is `canvases.created_by`.

| Action | Rule |
|---|---|
| Create canvas | Authenticated user with access to the target project (`projects.created_by = user` **or** role in admin/manager set). Global canvases (`project_id = null`): **DECISION-REQUIRED** (proposed: admin/manager only). |
| Read canvas / list | Any authenticated user with access to the canvas's project. Global canvases: **DECISION-REQUIRED** (proposed: all authenticated users). |
| Update canvas metadata | `canvases.created_by = user` **or** admin/manager role. |
| Delete canvas | `canvases.created_by = user` **or** admin/manager role. |
| Create/update/delete item or connection | Must have edit rights on the parent canvas (same rule as update canvas). Server **must** verify the item/connection belongs to the canvas named in the path. |
| Read item/connection | Same as read canvas. |

**Role model is DECISION-REQUIRED.** The only evidence is `users.role` (default `'viewer'`, `schema.sql:9`) and the unused `requireRole` helper. The contract proposes the set `admin | manager | editor | viewer`, where:
- `admin`/`manager`: full control, including canvases they do not own.
- `editor`: create/edit canvases in projects they can access; cannot delete others' canvases.
- `viewer`: read-only.

**Ownership rule:** `canvases.created_by` is immutable after creation. There is no transfer mechanism in v1.

### 3.4 Resource schemas and constraints (PROPOSED)

#### Canvas
| Field | Type | Constraints |
|---|---|---|
| `canvas_id` | string(UUID) | Server-generated; immutable. |
| `project_id` | string(UUID) \| null | Must reference an existing project; nullable only for global canvases (see DECISION-REQUIRED). |
| `name` | string | Required; 1–120 chars after trim; non-empty. |
| `description` | string \| null | 0–2000 chars. |
| `created_by` | string(UUID) | Immutable; set from JWT. |
| `created_at` | string(ISO) | Server-set; immutable. |
| `updated_at` | string(ISO) | Server-set; bumped on any canvas mutation **and** on item/connection mutations (fixes F9). |
| `version` | integer | **DECISION-REQUIRED** (schema change); proposed `INTEGER NOT NULL DEFAULT 1`, incremented on every write. |

#### Canvas item
| Field | Type | Constraints |
|---|---|---|
| `item_id` | string(UUID) | Server-generated; immutable. |
| `canvas_id` | string(UUID) | Immutable after creation. |
| `item_type` | enum | `task \| square \| rectangle \| circle \| diamond \| triangle \| line \| arrow \| text` (aligns with `types/canvas.ts:16`). |
| `task_id` | string(UUID) \| null | Required when `item_type = "task"`; must be null otherwise; **must belong to the canvas's project** (fixes F11). |
| `x`, `y` | number | Finite; \|value\| ≤ 1,000,000. |
| `width`, `height` | number | Finite; > 0 and ≤ 10,000. |
| `rotation` | number | Finite; normalized to [0, 360). |
| `content` | string \| null | ≤ 5,000 chars. |
| `style` | string(JSON) \| null | ≤ 4,000 chars; must parse to an object conforming to `CanvasItemStyle`; unknown keys rejected or stripped (**DECISION-REQUIRED**). |
| `z_index` | integer | −10,000 … 10,000. |
| `created_at`, `updated_at` | string(ISO) | Server-set. |
| `version` | integer | Proposed as above. |

#### Canvas connection
| Field | Type | Constraints |
|---|---|---|
| `connection_id` | string(UUID) | Server-generated; immutable. |
| `canvas_id` | string(UUID) | Immutable after creation. |
| `from_item_id`, `to_item_id` | string(UUID) | Must exist **and belong to `canvas_id`** (fixes F2). |
| `connection_type` | enum | `line \| arrow` (aligns with `types/canvas.ts:35`). |
| `style` | string(JSON) \| null | ≤ 2,000 chars; proposed `{ stroke, strokeWidth, opacity, color }`. |
| `created_at` | string(ISO) | Server-set. |
| `version` | integer | Proposed as above. |

**DECISION-REQUIRED constraints:**
- Self-loops (`from_item_id = to_item_id`): proposed **rejected** with `422 SELF_CONNECTION`.
- Duplicate connections (same unordered pair, same canvas): proposed **rejected** with `409 CONFLICT`; alternatively deduplicate idempotently.
- Maximum items per canvas (proposed 500) and connections per canvas (proposed 1,000). Exceeding returns `409 LIMIT_REACHED`.
- Whether `item_type` may be changed after creation (proposed: allowed, but `task_id` must be cleared when changing away from `task`).

### 3.5 Endpoint specifications (PROPOSED)

#### 3.5.1 `POST /api/canvas`
- **Auth:** authenticated; must have create rights on the target project.
- **Body:**
  ```json
  { "project_id": "uuid | null", "name": "string (1-120)", "description": "string | null" }
  ```
- **201:**
  ```json
  { "canvas": { "canvas_id": "…", "project_id": "…", "name": "…", "description": "…",
               "created_by": "…", "created_at": "…", "updated_at": "…", "version": 1 } }
  ```
- **Errors:** 400 `VALIDATION_ERROR`; 401; 403; 404 `PROJECT_NOT_FOUND`; 409 `LIMIT_REACHED` (canvases per project, if a limit is adopted); 429; 500.

#### 3.5.2 `GET /api/canvas`
- **Auth:** authenticated.
- **Query:** `project_id` (optional UUID), `limit` (default 50, max 200), `offset` (default 0), `include_archived` (proposed, default false).
- **200:**
  ```json
  {
    "canvases": [ { …Canvas… } ],
    "page": { "limit": 50, "offset": 0, "total": 123, "has_more": true }
  }
  ```
- **Errors:** 400 `VALIDATION_ERROR` (bad query); 401; 429; 500.

#### 3.5.3 `GET /api/canvas/:id`
- **Auth:** authenticated; must have read rights on the canvas.
- **Query (PROPOSED):** `items_limit`/`items_offset`, `connections_limit`/`connections_offset`. Default: return all items and connections when counts are below the threshold (proposed 200 items / 500 connections); paginate above.
- **200:**
  ```json
  {
    "canvas": { …Canvas… },
    "items": [ …CanvasItem… ],
    "connections": [ …CanvasConnection… ],
    "page": {
      "items": { "limit": 200, "offset": 0, "total": 42, "has_more": false },
      "connections": { "limit": 500, "offset": 0, "total": 7, "has_more": false }
    }
  }
  ```
- **Errors:** 401; 404 `CANVAS_NOT_FOUND`; 429; 500.

#### 3.5.4 `PUT /api/canvas/:id`
- **Auth:** owner or admin/manager.
- **Headers:** `If-Match: "<version>"` or body `expected_version` (PROPOSED; see §3.7).
- **Body:** `{ "name"?: string, "description"?: string | null }` (at least one field).
- **200:** `{ "canvas": { …Canvas… } }` with incremented `version`.
- **Errors:** 400; 401; 403; 404; 409 `VERSION_CONFLICT` (body includes current canvas); 429; 500.

#### 3.5.5 `DELETE /api/canvas/:id`
- **Auth:** owner or admin/manager.
- **Behavior:** transactional cascade (connections → items → canvas) — fixes F8/F10.
- **204 No Content** (PROPOSED). **DECISION-REQUIRED:** keep `200 { success: true }` for backward compatibility with `CanvasList.tsx:58-69` and `useCanvas` (which do not read the body). Proposed migration: return 204 and update the two call sites.
- **Errors:** 401; 403; 404; 409 `VERSION_CONFLICT` (if `If-Match` supplied); 429; 500.

#### 3.5.6 `POST /api/canvas/:id/items`
- **Auth:** edit rights on the canvas.
- **Body:**
  ```json
  {
    "item_type": "task | square | rectangle | circle | diamond | triangle | line | arrow | text",
    "task_id": "uuid | null",
    "x": 0, "y": 0, "width": 100, "height": 100, "rotation": 0,
    "content": "string | null", "style": "string | null", "z_index": 0
  }
  ```
- **201:** `{ "item": { …CanvasItem… } }`.
- **Errors:** 400; 401; 403; 404 `CANVAS_NOT_FOUND`; 409 `LIMIT_REACHED`; 422 `SEMANTIC_ERROR` (bad `task_id` / cross-project task / `task_id` on non-task item); 429; 500.

#### 3.5.7 `PUT /api/canvas/items/:itemId`
- **Auth:** edit rights on the parent canvas.
- **Headers:** `If-Match: "<version>"` or body `expected_version`.
- **Server rule:** `itemId` must belong to a canvas the caller can edit (fixes F2).
- **Body:** any subset of item fields (same constraints as create).
- **200:** `{ "item": { …CanvasItem… } }`.
- **Errors:** 400; 401; 403; 404 `ITEM_NOT_FOUND`; 409 `VERSION_CONFLICT`; 422; 429; 500.

#### 3.5.8 `DELETE /api/canvas/items/:itemId`
- **Auth:** edit rights on the parent canvas.
- **Behavior:** transactional; deletes connections referencing the item, then the item (already the current behavior at `canvas.service.ts:240`, but now transactional and authorized).
- **204 No Content** (same DECISION-REQUIRED as canvas delete).
- **Errors:** 401; 403; 404 `ITEM_NOT_FOUND`; 429; 500.

#### 3.5.9 `POST /api/canvas/:id/connections`
- **Auth:** edit rights on the canvas.
- **Body:**
  ```json
  {
    "from_item_id": "uuid",
    "to_item_id": "uuid",
    "connection_type": "line | arrow",
    "style": "string | null"
  }
  ```
- **Server rules:** both items must exist and belong to `:id` (fixes F2); no self-loop (proposed); duplicate policy per DECISION-REQUIRED.
- **201:** `{ "connection": { …CanvasConnection… } }`.
- **Errors:** 400; 401; 403; 404 `CANVAS_NOT_FOUND` / `ITEM_NOT_FOUND`; 409 `CONFLICT` (duplicate) or `LIMIT_REACHED`; 422 `SELF_CONNECTION` / `CROSS_CANVAS_ITEM`; 429; 500.

#### 3.5.10 `DELETE /api/canvas/connections/:connId`
- **Auth:** edit rights on the parent canvas.
- **Server rule:** connection must belong to a canvas the caller can edit.
- **204 No Content** (same DECISION-REQUIRED).
- **Errors:** 401; 403; 404 `CONNECTION_NOT_FOUND`; 429; 500.

### 3.6 Pagination & versioning (PROPOSED)

**Pagination**
- Offset/limit is proposed for v1 because it is the simplest fit for the existing `ORDER BY updated_at DESC` list and `ORDER BY z_index ASC` item ordering.
- Cursor-based pagination (`cursor` = opaque `(updated_at, canvas_id)` tuple) is the recommended follow-up for very large canvases; **DECISION-REQUIRED** if v1 should ship cursors instead.
- Defaults: `limit=50`, `max limit=200` for lists; items default `limit=200`, connections default `limit=500` for the canvas detail response.
- Every paginated response includes `page: { limit, offset, total, has_more }`.

**API versioning**
- **DECISION-REQUIRED.** Options:
  1. Path prefix `/api/v1/canvas` (clean, breaks existing clients).
  2. Content negotiation `Accept: application/vnd.pm.canvas.v1+json` (no path change).
  3. Unversioned with documented deprecation (current state; not recommended given the contract changes above).
- This contract is written to be implementable under any of the three; the endpoint tables above keep `/api/canvas` for readability.

**Caching / ETag**
- `GET /api/canvas/:id` returns `ETag: "<canvas.version>:<items_updated_at>:<connections_updated_at>"` and honors `If-None-Match` with `304 Not Modified` (PROPOSED).
- `GET /api/canvas` returns `ETag` derived from the list's `updated_at` maximum.

### 3.7 Optimistic updates, conflict & recovery (PROPOSED)

**Goal:** keep the current responsive drag/pan UX (`CanvasItem.tsx:95-127` already saves only on pointer-up) while making concurrent edits safe.

**Server-side**
1. Every mutable resource carries `version` (integer, starts at 1, incremented on each write). Schema change is **DECISION-REQUIRED**; without it, fall back to `updated_at` as a weak ETag (not recommended: ISO strings have millisecond precision and two writes in the same millisecond collide).
2. Mutating requests must send `If-Match: "<version>"` (preferred) or `expected_version` in the body.
3. On mismatch the server returns `409 VERSION_CONFLICT` with the **current** resource so the client can resync without a second round trip:
   ```json
   {
     "error": { "code": "VERSION_CONFLICT", "message": "Resource changed since last read", "request_id": "…" },
     "current": { …CanvasItem… }
   }
   ```
4. All writes are wrapped in a transaction; the version check and the update are atomic (`UPDATE … WHERE id = ? AND version = ?`; if `changes = 0`, re-read and return 409).

**Client-side (`useCanvas` / `CanvasItem` / `PropertiesPanel`)**
1. Store the `version` of each item/connection as loaded.
2. Optimistic local patch remains (current behavior at `useCanvas.ts:144-146`), but the pending patch is queued with its `expected_version`.
3. On success: replace local state with the server response (authoritative) and update the cached version.
4. On `409`: discard the optimistic patch, replace local state with `error.current`, and surface a non-blocking conflict notice: *"This canvas changed elsewhere. Your edit was not saved — review and retry."* The user's intent is preserved in a pending-edits buffer they can re-apply.
5. On network failure / 5xx / 429: keep the optimistic patch, mark the item "syncing", retry with exponential backoff (1s, 2s, 4s; max 3 attempts), then surface "Could not save — will retry when the connection returns."
6. On 401/403: clear pending edits, refetch the canvas, and show the appropriate auth message.
7. On 404 (item deleted elsewhere): remove the item locally and notify.
8. Drag operations send exactly one `PUT` per gesture (pointer-up), already the case at `CanvasItem.tsx:110-117`; the request carries the version captured at gesture start.

**Recovery:** `GET /api/canvas/:id` is always the authoritative resync point; clients can call it at any time. The `refetch` helper already exists (`useCanvas.ts:267-269`).

### 3.8 Failure & retry contract (PROPOSED)

- **Safe methods:** `GET` is safe and idempotent; clients may retry freely.
- **Idempotent methods:** `PUT` and `DELETE` are idempotent only when the client supplies `If-Match`/`expected_version` (PUT) or the resource is already gone (DELETE → 404 is treated as success by the client).
- **Create (`POST`):** retried only with the same `Idempotency-Key`; otherwise a network failure leaves the create ambiguous and the client must refetch.
- **Retry policy:** exponential backoff on 5xx and 429, max 3 attempts, `Retry-After` honored on 429. Never retry 4xx except 409 (after refetching and re-applying).
- **Mapping driver errors:** `SQLITE_CONSTRAINT FOREIGN KEY` → 404/422 (never 500 with raw text); `SQLITE_BUSY` → 429 or 503 with `Retry-After`.
- **Partial failure:** no batch endpoints are proposed in v1. If a batch endpoint is added later, it must be atomic or return per-item results with a `207 Multi-Status` envelope.
- **Timeouts:** server responds within 5s for reads and 10s for writes; clients time out at 15s and treat the result as unknown (refetch).
- **Audit:** every successful mutation writes an `audit_logs` row with `user_id`, `action`, `target_table`, `target_id`, `old_value`, `new_value`, `trigger = 'user'`, `ip_address`, `created_at` (fixes F7). **DECISION-REQUIRED** on whether failed attempts are also audited.

### 3.9 Audit (PROPOSED)

| Event | target_table | action |
|---|---|---|
| Canvas created / updated / deleted | `canvases` | `canvas.created` / `canvas.updated` / `canvas.deleted` |
| Item created / updated / deleted | `canvas_items` | `canvas_item.created` / `…updated` / `…deleted` |
| Connection created / deleted | `canvas_connections` | `canvas_connection.created` / `…deleted` |

Actor is always the JWT `user_id`; `old_value`/`new_value` store JSON snapshots (redacted — no secrets exist on canvas resources).

---

## 4. Explicit boundaries from Automation

These boundaries are **VERIFIED** from the repository's own decision documents and are **PROPOSED** as binding constraints on this contract.

1. **Canvas is a visual planning surface, not an execution engine.** `PHASE1_DISCOVERY_DECISION_PACK.md:144` (Decision B1) recommends preserving Canvas as a visual planning/diagramming surface; `:107` says "Extend only; do not convert to an execution engine"; `UI_UX_REDESIGN_PLAN.md:222` says "retain as planning canvas, not automation runtime".
2. **A Canvas connection is a visual relationship, not a control-flow edge.** `PHASE1_DISCOVERY_DECISION_PACK.md:122`: "A Canvas connection is a visual relationship, not an Automation control-flow edge. Shared visuals must not blur this boundary." Accordingly:
   - The Canvas API MUST NOT expose `execute`, `run`, `trigger`, `workflow`, `execution`, or `order` semantics on connections.
   - `connection_type` remains strictly `line | arrow` (`types/canvas.ts:35`); no `dependency`, `blocks`, or `triggers` types are permitted.
   - Canvas ordering (`z_index`, item coordinates) MUST NOT be interpreted as execution order.
3. **Automation Studio is preview-only and must stay out of scope.** `AutomationStudio.tsx:29` renders "Preview only · no runtime connected"; `:30` disables Publish; `:231` states "Live run history is deliberately not simulated. It must be powered by a separately approved backend runtime." `PHASE1_DISCOVERY_DECISION_PACK.md:19,150-153` (Decision C1) and `UI_UX_REDESIGN_PLAN.md:240-241` confirm no runtime is authorized.
4. **No automation data model may ride on Canvas.** `UI_UX_REDESIGN_PLAN.md:175`: "Project Canvas visualizes work. Automation Studio executes approved workflow definitions. They must never share a misleading name, a data model, or an implied execution engine." The Canvas tables (`schema.sql:161-201`) MUST NOT gain automation columns (e.g. `workflow_id`, `execution_id`, `trigger_config`).
5. **Canvas item content is data, not instructions.** `content` and `style` MUST NOT be parsed as commands, expressions, or workflow definitions; they are rendered as inert text/graphics (`CanvasItem.tsx:268-321`).
6. **No connector side effects from Canvas operations.** `PHASE1_DISCOVERY_DECISION_PACK.md:108,123` require connector scope/safety decisions before any Automation action; Canvas CRUD MUST NOT invoke connectors or external systems.
7. **Automation runtime remains a separate, later decision.** `PHASE1_DISCOVERY_DECISION_PACK.md:112,121` mark the runtime as DECISION-REQUIRED; if a future phase links Automation to Canvas, it requires its own specification, schema, authorization, audit, and owner approval. Any such integration MUST be additive and MUST NOT change the Canvas contract above without a new card.

---

## 5. Test cases (PROPOSED)

Backend tests should be added to `backend/src/tests/` (currently no Canvas coverage, F15). Each case maps to a contract rule.

| # | Area | Case | Expected |
|---|---|---|---|
| T01 | Auth | `GET /api/canvas/:id` without token | 401 `UNAUTHENTICATED` |
| T02 | Auth | `GET /api/canvas/:id` with invalid token | 401 |
| T03 | Isolation | User B reads User A's private canvas | 404 `CANVAS_NOT_FOUND` (proposed 404-over-403) |
| T04 | Isolation | User B updates/deletes User A's canvas | 403 `FORBIDDEN` |
| T05 | Isolation | User B updates an item belonging to User A's canvas | 404 `ITEM_NOT_FOUND` (or 403 if the canvas is visible) |
| T06 | Isolation | User B deletes a connection in User A's canvas | 403/404 per policy |
| T07 | Validation | Create canvas with empty `name` | 400 `VALIDATION_ERROR` with `details[0].field = "name"` |
| T08 | Validation | Create item with `item_type = "hexagon"` | 400 `VALIDATION_ERROR` |
| T09 | Validation | Create item with `width = 0` / non-finite `x` | 400 `VALIDATION_ERROR` |
| T10 | Validation | Create item with malformed `style` JSON | 400 `VALIDATION_ERROR` |
| T11 | Semantic | Create connection with `from_item_id` in a different canvas | 422 `CROSS_CANVAS_ITEM` |
| T12 | Semantic | Create connection with `from_item_id = to_item_id` | 422 `SELF_CONNECTION` (if adopted) |
| T13 | Semantic | Create `task` item with `task_id` from another project | 422 `SEMANTIC_ERROR` |
| T14 | Semantic | Create `square` item with non-null `task_id` | 422 `SEMANTIC_ERROR` |
| T15 | Conflict | `PUT /api/canvas/items/:id` with stale `If-Match` | 409 `VERSION_CONFLICT` with `current` |
| T16 | Conflict | Two concurrent item updates, same version | exactly one 200; the other 409 |
| T17 | Pagination | `GET /api/canvas?limit=1&offset=0` | `page.total` = full count; `has_more = true` |
| T18 | Pagination | `GET /api/canvas/:id` with > 200 items | items paginated; `page.items.has_more = true` |
| T19 | Failure | POST item to a non-existent canvas | 404 `CANVAS_NOT_FOUND` (not 500 with SQL text) |
| T20 | Failure | FK violation on connection create | 422/404, never raw `SQLITE_CONSTRAINT` |
| T21 | Audit | Update canvas name | `audit_logs` row with `target_table = "canvases"`, old/new values |
| T22 | Automation boundary | Canvas connection payload containing `{"execute": true}` | ignored/rejected; never triggers execution (static assertion: no automation import in canvas service) |
| T23 | Automation boundary | Canvas item `content` containing a workflow expression | rendered as plain text; never evaluated |
| T24 | Frontend | Simulate 409 on drag save | local state replaced by `current`; conflict notice shown; no silent success |
| T25 | Frontend | Simulate network failure on save | item marked "syncing"; retry with backoff; state preserved |

---

## 6. DECISION-REQUIRED register

| # | Decision | Options | Recommended |
|---|---|---|---|
| D1 | Role model & permission matrix | (a) owner-only, (b) owner + admin, (c) full RBAC with `admin/manager/editor/viewer` | (c), using existing `users.role` and `requireRole` |
| D2 | Global canvases (`project_id = null`) | (a) admin-only, (b) all authenticated, (c) disallow | (a) |
| D3 | 403 vs 404 for unauthorized access | (a) 404 everywhere, (b) 403 everywhere, (c) 404 read / 403 write | (c) |
| D4 | Self-loops on connections | (a) reject, (b) allow | (a) |
| D5 | Duplicate connections | (a) reject, (b) dedupe idempotently, (c) allow | (b) |
| D6 | Limits (items/connections per canvas, field lengths) | adopt proposed values or adjust | proposed values in §3.4 |
| D7 | Versioning mechanism | (a) add `version` column, (b) `updated_at` ETag, (c) no concurrency control | (a) |
| D8 | Delete response shape | (a) 204, (b) keep `200 {success:true}` | (a) + one-release compat |
| D9 | API versioning | (a) `/api/v1/canvas`, (b) content negotiation, (c) unversioned | (a) |
| D10 | Pagination style | (a) offset/limit, (b) cursor | (a) for v1, (b) follow-up |
| D11 | Cross-project task linking | (a) forbid, (b) allow | (a) |
| D12 | Audit scope | (a) successes only, (b) successes + failures | (b) |
| D13 | Batch endpoints | (a) none in v1, (b) atomic batch, (c) 207 multi-status | (a) |
| D14 | Idempotency-Key support | (a) v1, (b) later | (b) unless create-retry is a known problem |
| D15 | `item_type` change after creation | (a) allowed, (b) immutable | (a) with `task_id` cleanup |

---

## 7. Implementation notes & non-goals

- **No source or schema changes were made by this card.** This document is the contract; implementation requires a separate card per DECISION-REQUIRED outcome.
- **Order of work (PROPOSED):** (1) authorization + membership checks (F1, F2, F11 — critical); (2) validation + error envelope (F3, F4); (3) versioning + conflict handling (F5); (4) pagination (F6); (5) audit + transactions (F7, F8, F10); (6) frontend conflict UI (F14); (7) tests (T01–T25).
- **Non-goals:** automation execution, connector invocation, real-time collaboration (WebSockets/CRDT), canvas templates, export/import of canvases, and any change to the Automation Studio preview.
- **Compatibility:** the existing frontend (`useCanvas.ts`, `Canvas.tsx`, `CanvasList.tsx`) is the primary client; any contract change must either be backward-compatible or shipped with a matching frontend change in the same release.
