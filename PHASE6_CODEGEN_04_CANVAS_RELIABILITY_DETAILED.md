# ChatGPT Code-Generation Prompt — Canvas Mutation, Connection & Viewport Reliability (Detailed)

**Paste this entire document into ChatGPT regular chat.**
**Do NOT shorten it. Do NOT ask clarifying questions. Return complete replacement files.**

---

## 0. Your role and output contract

You are generating a production patch for an existing React 19 + TypeScript + Vite frontend and an Express 4 + TypeScript + SQLite backend.

- Return **complete replacement files** for every file listed in §7.
- Do **not** return snippets, diffs, or "here is the changed part".
- Do **not** change any file that is not listed in §7.
- Do **not** add dependencies.
- Do **not** run git, commits, or pushes.
- Do **not** invent APIs, tables, or environment variables.
- If something in this prompt is ambiguous, choose the **most conservative** interpretation that preserves existing behavior and state it in your final notes.

Your output must be a single response with:

1. A short summary of the approach.
2. Complete file contents, each in its own fenced code block with a header line like `FILE: frontend/src/hooks/useCanvas.ts`.
3. A final "Verification checklist" section.

---

## 1. Project context

**Application:** Project Manager
**Repository root:** `<workspace>`
**Stack:**
- Frontend: React 19 + TypeScript + Vite + Tailwind
- Backend: Express 4 + TypeScript
- Database: SQLite via `node:sqlite`
- Auth: JWT in `Authorization: Bearer *** header

**Relevant frontend structure:**
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
```

**Relevant backend structure:**
```
backend/src/
  database/schema.sql
  services/canvas.service.ts
  routes/canvas.routes.ts
```

---

## 2. Approved design decisions (binding)

These decisions are already approved by the project owner and recorded in the Phase 3 Canvas specification. Implement them exactly.

### 2.1 Mutation & recovery (D-11, D-13)

- **Optimistic local-first** updates remain the default for drag/resize (save once on pointer-up).
- **Rollback on failure:** if a save fails, the optimistic local change must be reverted to the last known server state. The UI must never silently diverge from the server.
- **Retry with backoff:** on network failure / 5xx / 429, retry with exponential backoff (1s, 2s, 4s; max 3 attempts). Keep the optimistic patch and mark the item "syncing" during retries.
- **Error surfacing:** show the server's error message when one is available; never discard the response body. Use inline field-level errors where possible.
- **Error state:** the page-level error keeps a **Retry** action. Add a `clearError` helper.
- **Pending indicators:** items with an in-flight or failed save must show a visible pending/attention indicator.
- **Empty state:** a canvas with zero items must show an empty state, not just the grid.
- **Reduced motion:** the pan momentum animation must be disabled when `prefers-reduced-motion: reduce` is active.

### 2.2 Concurrency (D-11) — limited scope

- A `version` column with `If-Match` / `409 VERSION_CONFLICT` is **DECISION-REQUIRED** and is **out of scope** for this patch.
- Implement rollback and retry **without** version-based conflict detection.
- In your final notes, state that 409 conflict detection requires the owner's version-column decision.

### 2.3 Connection lifecycle (D-08, D-09)

- **Create:** keep the existing "Connect to first other item" fallback button. You may add a "connect to a chosen item" picker, but this is optional.
- **Select:** already implemented (click + keyboard). Preserve it.
- **Edit:** allow changing the selected connection's `connection_type` between `"line"` and `"arrow"`.
- **Delete:** connection deletion is currently unreachable from the UI. Make it reachable from the properties panel (or an equivalent visible control) for the selected connection, in addition to the existing keyboard Delete/Backspace path.
- **Guard:** the UI must not offer self-connections or duplicate connections. The backend already rejects them; the UI should disable or hide invalid choices.

### 2.4 Timestamp updates (D-17)

- Every Canvas mutation must bump `canvases.updated_at` so that `CanvasList` ordering (`ORDER BY updated_at DESC`) is truthful.
- Affected operations: create canvas, update canvas, delete canvas, add item, update item, delete item, add connection, delete connection.

### 2.5 Viewport persistence (D-03, optional view persistence)

- Persist `pan` and `zoom` per canvas in `localStorage`.
- Restore them when the canvas is loaded.
- Debounce writes so panning does not thrash storage.

---

## 3. Current code facts you must respect

### 3.1 `frontend/src/hooks/useCanvas.ts`

- Owns `canvas`, `items`, `connections`, `selectedItemId`, `selectedConnectionId`, `tool`, `pan`, `zoom`, `loading`, `error`, `tasks`, `enteringItemIds`, `deletingItemIds`.
- `updateItemLocal(itemId, updates)` patches local state only.
- `persistItem(itemId, updates)` performs the `PUT` and replaces local state with the server response. On failure it sets `error` and returns `null` — **it does not roll back**.
- `deleteItem` optimistically removes the item and its connections after a 220ms delay.
- `addConnection` / `deleteConnection` perform the API calls and update local state.
- `pan` and `zoom` are plain state initialised to `{x:0,y:0}` and `1`; they are **not persisted**.
- There is no `clearError`.

### 3.2 `frontend/src/pages/Canvas.tsx`

- Renders the header, `CanvasToolbar`, `CanvasViewport`, and the properties `<aside>`.
- The error branch replaces the entire page with a "Canvas could not be loaded" card and only a **Go back** button.
- `handleDeleteItem` implements focus restoration after deletion.
- `handleDeleteConnection` focuses the viewport after deletion.

### 3.3 `frontend/src/components/canvas/CanvasViewport.tsx`

- Owns pan/zoom, space-pan, momentum, wheel zoom, and the keyboard handler.
- Renders items and the SVG connection layer.
- `role="application"`, `aria-live` status, roving `tabIndex`, and connection keyboard support were added in the accessibility patch.

### 3.4 `frontend/src/components/canvas/CanvasItem.tsx`

- Implements drag (mouse), resize, selection, delete button, and the hidden focusable delete button.
- Drag saves once on pointer-up via `onSave`.

### 3.5 `frontend/src/components/canvas/ConnectionLine.tsx`

- Renders an SVG `<g role="button">` with a `<line>`.
- Supports click and keyboard selection; Delete/Backspace deletes when `onDelete` is provided.

### 3.6 `frontend/src/components/canvas/PropertiesPanel.tsx`

- Edits the selected item's content, style, colors, text formatting, position, and size.
- Has a "Connect to first other item" button and a "Delete Item" button.
- **No connection editing or deletion controls.**

### 3.7 `backend/src/services/canvas.service.ts`

- `updateCanvas`, `addItem`, `updateItem`, `deleteItem`, `addConnection`, `deleteConnection` currently do **not** bump `canvases.updated_at`.
- `CanvasServiceError` carries a `statusCode` of 400 or 404.
- `createCanvas` returns `getCanvasOrThrow(canvasId)`.

### 3.8 `backend/src/routes/canvas.routes.ts`

- Uses `requireCanvasAccess` for authorization and `sendCanvasError` for error responses.
- Returns `{ error: string }` on failure.

---

## 4. Required implementation

### 4.1 Frontend: rollback and retry in `useCanvas.ts`

1. Keep a `lastServerItems` / `lastServerConnections` snapshot (or per-item server state) representing the last confirmed server state.
2. In `persistItem`, on failure:
   - Revert the optimistic local change to the last confirmed server state.
   - Surface the server's error message (parse the response body when possible).
   - Mark the item as needing attention.
3. Add a retry helper that retries the failed request with exponential backoff (1s, 2s, 4s; max 3 attempts) on network failure / 5xx / 429.
4. Add `clearError`.
5. Track dirty/pending item ids (e.g., `pendingItemIds`, `failedItemIds`) and expose them.
6. On 401/403: clear pending edits, refetch the canvas, and show the auth message.
7. On 404: remove the item locally and notify.

### 4.2 Frontend: error state, empty state, pending indicators

1. In `Canvas.tsx`, add a **Retry** action to the error state that calls `refetch`.
2. Add an empty state for `items.length === 0` (a message and a hint, using existing design tokens).
3. Surface pending/attention indicators on items (e.g., a small badge or outline) using existing tokens.
4. Add inline field-level errors in `PropertiesPanel.tsx` where practical.

### 4.3 Frontend: connection lifecycle

1. In `PropertiesPanel.tsx`, when a connection is selected, show:
   - The connection type (line / arrow) with a control to change it.
   - A delete button for the selected connection.
2. Add a `updateConnection` operation to `useCanvas.ts` (`PUT /api/canvas/connections/:connId` or an equivalent approved endpoint) that updates `connection_type` and/or `style`.
3. Ensure the backend supports the connection update (see §4.5).
4. Keep the keyboard Delete/Backspace path working.
5. Hide or disable self/duplicate connection choices in the UI.

### 4.4 Frontend: viewport persistence

1. Persist `{ pan, zoom }` to `localStorage` under a per-canvas key (e.g., `pm-canvas-view-${canvasId}`).
2. Restore on load.
3. Debounce writes (e.g., 300ms).
4. Validate restored values (finite numbers, zoom within the 0.2–4 range).

### 4.5 Backend: timestamp updates

1. In `canvas.service.ts`, bump `canvases.updated_at` in:
   - `createCanvas`
   - `updateCanvas`
   - `deleteCanvas`
   - `addItem`
   - `updateItem`
   - `deleteItem`
   - `addConnection`
   - `deleteConnection`
2. Use a single SQL statement per operation where practical.
3. Return the updated canvas where the existing response shape already includes it.

### 4.6 Backend: connection update endpoint (if required)

1. Add `PUT /api/canvas/connections/:connId` to `canvas.routes.ts` to update `connection_type` and/or `style`.
2. Add a `updateConnection(connId, updates)` function to `canvas.service.ts`.
3. Authorize with `requireCanvasAccess(..., "write")`.
4. Validate `connection_type` is `"line"` or `"arrow"`.
5. Return `{ connection }` to match the existing create response shape.

---

## 5. Constraints

- Do **not** change `backend/src/index.ts`, `backend/src/server.ts`, or `backend/src/middleware/auth.middleware.ts`.
- Do **not** add a `version` column or implement `If-Match` / `409 VERSION_CONFLICT`.
- Do **not** add dependencies.
- Do **not** change Automation Studio.
- Do **not** remove existing columns or tables.
- Do **not** use `any` in new code unless the existing file already does.
- Keep TypeScript strict-mode compatible (`noUncheckedIndexedAccess` is on).
- Keep Express 4 compatible.
- Use `.ts` import extensions exactly as the existing code does.
- Preserve the existing Canvas visual design and the accessibility behavior added in the previous patch.
- Do **not** change `frontend/src/index.css`; use inline styles consistent with the existing canvas components.

---

## 6. Acceptance criteria

1. A failed item save rolls back the optimistic change and shows the server's message.
2. Transient failures retry with exponential backoff (1s, 2s, 4s; max 3).
3. The canvas error state has a working Retry action.
4. A canvas with zero items shows an empty state.
5. Items with a pending/failed save show a visible indicator.
6. Connection deletion is reachable from the UI.
7. The selected connection's type can be changed between line and arrow.
8. `canvases.updated_at` is bumped on every Canvas mutation.
9. `pan` and `zoom` persist across reloads.
10. Pan momentum is disabled under `prefers-reduced-motion: reduce`.
11. No new dependencies.
12. `npm run typecheck --prefix frontend` exits 0.
13. `npm run build --prefix frontend` exits 0.
14. `npm run typecheck --prefix backend` exits 0.
15. `npm run build --prefix backend` exits 0.

---

## 7. Files to return (complete replacement code)

Return complete replacement code for:

1. `frontend/src/hooks/useCanvas.ts`
2. `frontend/src/pages/Canvas.tsx`
3. `frontend/src/components/canvas/CanvasViewport.tsx`
4. `frontend/src/components/canvas/CanvasItem.tsx`
5. `frontend/src/components/canvas/ConnectionLine.tsx`
6. `frontend/src/components/canvas/PropertiesPanel.tsx`
7. `frontend/src/components/canvas/CanvasToolbar.tsx`
8. `frontend/src/types/canvas.ts`
9. `backend/src/services/canvas.service.ts`
10. `backend/src/routes/canvas.routes.ts`

If you believe another file must change, **stop and explain why** instead of changing it.

---

## 8. Final response format

Return exactly:

```text
## Approach
<2-5 bullets>

## Files
FILE: frontend/src/hooks/useCanvas.ts
<complete file>

FILE: frontend/src/pages/Canvas.tsx
<complete file>

FILE: frontend/src/components/canvas/CanvasViewport.tsx
<complete file>

FILE: frontend/src/components/canvas/CanvasItem.tsx
<complete file>

FILE: frontend/src/components/canvas/ConnectionLine.tsx
<complete file>

FILE: frontend/src/components/canvas/PropertiesPanel.tsx
<complete file>

FILE: frontend/src/components/canvas/CanvasToolbar.tsx
<complete file>

FILE: frontend/src/types/canvas.ts
<complete file>

FILE: backend/src/services/canvas.service.ts
<complete file>

FILE: backend/src/routes/canvas.routes.ts
<complete file>

## Verification checklist
- [ ] npm run typecheck --prefix frontend
- [ ] npm run build --prefix frontend
- [ ] npm run typecheck --prefix backend
- [ ] npm run build --prefix backend
- [ ] Rollback verified
- [ ] Retry/backoff verified
- [ ] Connection lifecycle verified
- [ ] Viewport persistence verified
- [ ] No new dependencies
```

Do not include any other commentary outside that structure.
