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
- Auth: JWT in `Authorization: Bearer *** header
- Test runner: `node:test` + `supertest`

**Test command:** `npm test --prefix backend` → `node --test src/tests/`

**Existing tests:**
- `backend/src/tests/backend.test.ts` — MVP acceptance tests plus a `Canvas Authorization` block.
- `backend/src/tests/minimal.test.ts` — a minimal sanity test.

---

## 2. Approved scope (binding)

The owner accepted the Phase 3 Canvas specification and its deferred-item register. This card covers the **Phase 6 entry criterion P6-PC-09**: "Canvas API/hook/component test coverage; reconciled test count."

### 2.1 In scope

- **Canvas API contract coverage** for all ten endpoint classes:
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
- `deleteConnection(connId)`.

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
