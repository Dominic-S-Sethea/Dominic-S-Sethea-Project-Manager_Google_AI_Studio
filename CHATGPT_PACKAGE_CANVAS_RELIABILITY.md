# CHATGPT PACKAGE — PHASE 6 CANVAS MUTATION, CONNECTION & VIEWPORT RELIABILITY

Paste this entire document into ChatGPT. It contains the detailed prompt plus the complete current source files.

---

# PART 1 — DETAILED PROMPT

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
- Auth: JWT in `Authorization: Bearer ${token}` header

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


---

# PART 2 — CURRENT SOURCE FILES


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

## FILE: frontend/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "allowImportingTsExtensions": false,
    "baseUrl": ".",
    "paths": {}
  },
  "include": [
    "src"
  ],
  "references": [
    {
      "path": "./tsconfig.node.json"
    }
  ]
}
```

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

## FILE: frontend/src/components/canvas/CanvasToolbar.tsx

```tsx
import type { CanvasTool } from "../../types/canvas";

interface CanvasToolbarProps {
  tool: CanvasTool;
  setTool: (tool: CanvasTool) => void;
  orientation?: "vertical" | "horizontal";
}

const tools: { id: CanvasTool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "\u2196" },
  { id: "square", label: "Square", icon: "\u25A1" },
  { id: "line", label: "Line", icon: "\u2192" },
  { id: "text", label: "Text", icon: "T" },
  { id: "task", label: "Task", icon: "\u2713" },
];

const spring = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function CanvasToolbar({
  tool,
  setTool,
  orientation = "vertical",
}: CanvasToolbarProps) {
  const horizontal = orientation === "horizontal";

  return (
    <div
      className="pm-glass-panel"
      role="toolbar"
      aria-label="Canvas tools"
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      style={{
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        alignItems: "center",
        justifyContent: horizontal ? "flex-start" : "flex-start",
        gap: "4px",
        padding: "8px",
        borderRadius: 0,
        borderRight: horizontal
          ? "none"
          : "1px solid var(--pm-border)",
        borderBottom: horizontal
          ? "1px solid var(--pm-border)"
          : "none",
        borderTop: "none",
        borderLeft: "none",
        flexShrink: 0,
        width: horizontal ? "100%" : "56px",
        minWidth: horizontal ? 0 : "56px",
      }}
    >
      {tools.map((t) => {
        const active = tool === t.id;

        return (
          <button
            key={t.id}
            type="button"
            title={t.label}
            aria-label={t.label}
            aria-pressed={active}
            onClick={() => setTool(t.id)}
            className={
              active
                ? "pm-button pm-button-primary"
                : "pm-button pm-button-quiet"
            }
            style={{
              width: "40px",
              height: "40px",
              minWidth: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              transitionTimingFunction: spring,
              padding: 0,
            }}
          >
            <span
              aria-hidden="true"
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
        aria-live="polite"
        style={{
          fontSize: "9px",
          textAlign: "center",
          color: "var(--pm-text-muted)",
          marginTop: horizontal ? 0 : "4px",
          marginLeft: horizontal ? "4px" : 0,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          minWidth: horizontal ? "44px" : 0,
        }}
      >
        {tool}
      </div>
    </div>
  );
}

export default CanvasToolbar;
```

## FILE: frontend/src/components/canvas/CanvasViewport.tsx

```tsx
import { useEffect, useRef, useState } from "react";
import type {
  CanvasItem,
  CanvasConnection,
  CanvasTool,
} from "../../types/canvas";
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
  onDeleteConnection?: (id: string) => void;
  onCanvasClick?: (point: { x: number; y: number }) => void;
  enteringItemIds?: Set<string>;
  deletingItemIds?: Set<string>;
  loading?: boolean;
}

const spring = "cubic-bezier(0.34, 1.56, 0.64, 1)";

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'))
  );
}

function getVisualItemOrder(items: CanvasItem[]): CanvasItem[] {
  return [...items].sort(
    (a, b) =>
      a.y - b.y ||
      a.x - b.x ||
      a.z_index - b.z_index ||
      a.item_id.localeCompare(b.item_id),
  );
}

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
  onDeleteConnection,
  onCanvasClick,
  enteringItemIds,
  deletingItemIds,
  loading,
}: CanvasViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [spacePanActive, setSpacePanActive] = useState(false);

  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const spacePressed = useRef(false);
  const dragMoved = useRef(false);
  const panRef = useRef(pan);

  const velocityRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0, t: 0 });
  const momentumRafRef = useRef<number | null>(null);
  const [momentumActive, setMomentumActive] = useState(false);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const cancelMomentum = () => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }

    setMomentumActive(false);
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }

      const root = containerRef.current;
      const target = event.target;

      if (!root || !(target instanceof Node) || !root.contains(target)) {
        return;
      }

      if (isTextEntryTarget(target)) {
        return;
      }

      // Connections handle Space as their own activation key.
      if (
        target instanceof Element &&
        target.closest("[data-canvas-connection-id]")
      ) {
        return;
      }

      spacePressed.current = true;
      setSpacePanActive(true);
      event.preventDefault();
    };

    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spacePressed.current = false;
        setSpacePanActive(false);
      }
    };

    const blur = () => {
      spacePressed.current = false;
      setSpacePanActive(false);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
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

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const middle = event.button === 1;
    const spaceDrag = spacePressed.current && event.button === 0;

    if (!middle && !spaceDrag) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    cancelMomentum();
    setIsPanning(true);
    dragMoved.current = false;

    panStart.current = {
      x: event.clientX,
      y: event.clientY,
      tx: pan.x,
      ty: pan.y,
    };

    lastPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      t: performance.now(),
    };

    velocityRef.current = { x: 0, y: 0 };
  };

  useEffect(() => {
    if (!isPanning) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      dragMoved.current = true;

      const now = performance.now();
      const dt = now - lastPointerRef.current.t;

      if (dt > 0) {
        velocityRef.current = {
          x:
            ((event.clientX - lastPointerRef.current.x) / dt) * 16,
          y:
            ((event.clientY - lastPointerRef.current.y) / dt) * 16,
        };
      }

      lastPointerRef.current = {
        x: event.clientX,
        y: event.clientY,
        t: now,
      };

      onPanChange({
        x: panStart.current.tx + (event.clientX - panStart.current.x),
        y: panStart.current.ty + (event.clientY - panStart.current.y),
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

          if (
            Math.abs(velocityX) < 0.05 &&
            Math.abs(velocityY) < 0.05
          ) {
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

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    cancelMomentum();

    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(4, Math.max(0.2, zoom * delta));

    onZoomChange(newZoom);
  };

  const handleBackgroundClick = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (dragMoved.current) {
      return;
    }

    if (tool !== "select" && onCanvasClick) {
      const rect = containerRef.current?.getBoundingClientRect();

      if (rect) {
        const x = (event.clientX - rect.left - pan.x) / zoom;
        const y = (event.clientY - rect.top - pan.y) / zoom;

        onCanvasClick({ x, y });
      }

      return;
    }

    onSelectItem(null);
    onSelectConnection(null);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (isTextEntryTarget(event.target)) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onSelectItem(null);
      onSelectConnection(null);
      return;
    }

    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const itemElement = target.closest<HTMLElement>(
      "[data-canvas-item-id]",
    );

    if (!itemElement || target.closest("button")) {
      return;
    }

    const itemId = itemElement.dataset.canvasItemId;

    if (!itemId) {
      return;
    }

    const item = items.find((candidate) => candidate.item_id === itemId);

    if (!item) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      onSelectItem(itemId);
      onSelectConnection(null);
      return;
    }

    if (
      event.key === "Delete" ||
      event.key === "Backspace"
    ) {
      if (!onDeleteItem) {
        return;
      }

      event.preventDefault();
      onDeleteItem(itemId);
      return;
    }

    const movement = event.shiftKey ? 10 : 1;

    let x = item.x;
    let y = item.y;

    switch (event.key) {
      case "ArrowLeft":
        x -= movement;
        break;
      case "ArrowRight":
        x += movement;
        break;
      case "ArrowUp":
        y -= movement;
        break;
      case "ArrowDown":
        y += movement;
        break;
      default:
        return;
    }

    event.preventDefault();

    const updates = { x, y };

    onSelectItem(itemId);
    onSelectConnection(null);
    onUpdateItemLocal(itemId, updates);
    onSaveItem(itemId, updates);
  };

  const visualItems = getVisualItemOrder(items);
  const visualItemIndex = new Map(
    visualItems.map((item, index) => [item.item_id, index]),
  );

  const itemMap = new Map(
    items.map((item) => [item.item_id, item]),
  );

  const visualConnections = [...connections].sort((a, b) => {
    const aFrom = itemMap.get(a.from_item_id);
    const bFrom = itemMap.get(b.from_item_id);
    const aTo = itemMap.get(a.to_item_id);
    const bTo = itemMap.get(b.to_item_id);

    return (
      (aFrom?.y ?? 0) - (bFrom?.y ?? 0) ||
      (aFrom?.x ?? 0) - (bFrom?.x ?? 0) ||
      (aTo?.y ?? 0) - (bTo?.y ?? 0) ||
      (aTo?.x ?? 0) - (bTo?.x ?? 0) ||
      a.connection_id.localeCompare(b.connection_id)
    );
  });

  const selectedItemIndex =
    selectedItemId === null
      ? -1
      : visualItemIndex.get(selectedItemId) ?? -1;

  const selectedConnectionIndex = visualConnections.findIndex(
    (connection) =>
      connection.connection_id === selectedConnectionId,
  );

  const selectionAnnouncement =
    selectedItemIndex >= 0
      ? `Selected item ${selectedItemIndex + 1} of ${items.length}.`
      : selectedConnectionIndex >= 0
        ? `Connection ${selectedConnectionIndex + 1} of ${connections.length} selected.`
        : "";

  const firstVisualItemId = visualItems[0]?.item_id ?? null;

  return (
    <div
      ref={containerRef}
      className="pm-canvas-viewport"
      role="application"
      aria-label="Canvas workspace"
      aria-describedby="canvas-viewport-instructions"
      tabIndex={-1}
      onMouseDownCapture={handleMouseDown}
      onWheel={handleWheel}
      onClick={handleBackgroundClick}
      onKeyDown={handleKeyDown}
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
          : spacePanActive
            ? "grab"
            : "default",
      }}
    >
      <div
        id="canvas-viewport-instructions"
        className="pm-visually-hidden"
      >
        Canvas keyboard controls. Tab moves through the canvas item and
        then each connection. When an item is focused, use the arrow keys
        to move it by one pixel. Hold Shift with an arrow key to move it
        by ten pixels. Delete or Backspace deletes the focused item.
        Escape clears the current selection. Hold Space and drag to pan
        the canvas. Connection controls can be selected with Enter or
        Space. When a connection is focused, Delete or Backspace deletes
        it when deletion is available.
      </div>

      <div
        className="pm-visually-hidden"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {selectionAnnouncement}
      </div>

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
        {items.map((item) => {
          const orderIndex = visualItemIndex.get(item.item_id) ?? 0;
          const isSelected = selectedItemId === item.item_id;
          const isRovingItem =
            isSelected ||
            (selectedItemId === null &&
              item.item_id === firstVisualItemId);

          return (
            <CanvasItemComp
              key={item.item_id}
              item={item}
              selected={isSelected}
              tabIndex={isRovingItem ? 0 : -1}
              ariaLabel={`Canvas item ${orderIndex + 1} of ${items.length}: ${
                item.content || item.item_type
              }`}
              zoom={zoom}
              pan={pan}
              tool={tool}
              entering={enteringItemIds?.has(item.item_id)}
              exiting={deletingItemIds?.has(item.item_id)}
              onSelect={(id) => {
                onSelectItem(id);
                onSelectConnection(null);
              }}
              onUpdateLocal={onUpdateItemLocal}
              onSave={onSaveItem}
              onDelete={onDeleteItem}
            />
          );
        })}

        <svg
          width={4000}
          height={4000}
          role="group"
          aria-label="Canvas connections"
          style={{
            position: "absolute",
            zIndex: 0,
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

          {visualConnections.map((connection, index) => {
            const fromItem = itemMap.get(connection.from_item_id);
            const toItem = itemMap.get(connection.to_item_id);

            if (!fromItem || !toItem) {
              return null;
            }

            const fromIndex =
              (visualItemIndex.get(connection.from_item_id) ?? 0) + 1;
            const toIndex =
              (visualItemIndex.get(connection.to_item_id) ?? 0) + 1;

            return (
              <ConnectionLine
                key={connection.connection_id}
                connection={connection}
                fromItem={fromItem}
                toItem={toItem}
                selected={
                  selectedConnectionId === connection.connection_id
                }
                ariaLabel={`Connection ${index + 1} of ${connections.length}: from item ${fromIndex} to item ${toIndex}`}
                onClick={(id) => {
                  onSelectConnection(id);
                  onSelectItem(null);
                }}
                onDelete={onDeleteConnection}
              />
            );
          })}
        </svg>

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
  tabIndex?: 0 | -1;
  ariaLabel?: string;
  zoom: number;
  pan: { x: number; y: number };
  tool: CanvasTool;
  entering?: boolean;
  exiting?: boolean;
  onSelect: (id: string) => void;
  onUpdateLocal: (
    id: string,
    updates: Partial<CanvasItemType>,
  ) => void;
  onSave: (
    id: string,
    updates: Partial<CanvasItemType>,
  ) => void;
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
  tabIndex = -1,
  ariaLabel,
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

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (tool !== "select") {
      return;
    }

    event.stopPropagation();
    onSelect(item.item_id);
    setDragging(true);
    moved.current = false;

    dragOffset.current = {
      x: (event.clientX - pan.x) / zoom - item.x,
      y: (event.clientY - pan.y) / zoom - item.y,
    };
  };

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      moved.current = true;

      const x =
        (event.clientX - pan.x) / zoom - dragOffset.current.x;
      const y =
        (event.clientY - pan.y) / zoom - dragOffset.current.y;

      onUpdateLocal(item.item_id, { x, y });
    };

    const onUp = (event: MouseEvent) => {
      setDragging(false);

      if (moved.current) {
        const x =
          (event.clientX - pan.x) / zoom - dragOffset.current.x;
        const y =
          (event.clientY - pan.y) / zoom - dragOffset.current.y;

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

  const handleResizeMouseDown = (
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    if (tool !== "select") {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    setResizing(true);
    moved.current = false;

    resizeStart.current = {
      w: item.width,
      h: item.height,
      mx: event.clientX,
      my: event.clientY,
    };
  };

  useEffect(() => {
    if (!resizing) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      moved.current = true;

      const dw =
        (event.clientX - resizeStart.current.mx) / zoom;
      const dh =
        (event.clientY - resizeStart.current.my) / zoom;
      const width = Math.max(20, resizeStart.current.w + dw);
      const height = Math.max(20, resizeStart.current.h + dh);

      onUpdateLocal(item.item_id, { width, height });
    };

    const onUp = (event: MouseEvent) => {
      setResizing(false);

      if (moved.current) {
        const dw =
          (event.clientX - resizeStart.current.mx) / zoom;
        const dh =
          (event.clientY - resizeStart.current.my) / zoom;
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

  const scale = dragging
    ? 1.05
    : exiting
      ? 0.85
      : selected
        ? 1.02
        : 1;

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
    cursor: tool === "select"
      ? dragging
        ? "grabbing"
        : "grab"
      : "default",
  };

  const renderContent = () => {
    const type = item.item_type;
    const style = parseStyle(item.style);

    if (
      SHAPE_TYPES.has(type) ||
      SHAPE_TYPES.has(resolveShape(item))
    ) {
      const shape = resolveShape(item);
      const fill = style.fill ?? "var(--pm-glass-soft, #cbd5e1)";
      const stroke =
        style.stroke ?? "var(--pm-border-strong, #475569)";
      const strokeWidth = style.strokeWidth ?? 2;
      const opacity = style.opacity ?? 1;
      const radius = style.borderRadius ?? 8;

      let clipPath: string | undefined;

      if (shape === "diamond") {
        clipPath =
          "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
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
      const color =
        style.textColor || style.color || "var(--pm-text)";
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
    "pm-canvas-item",
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
      data-canvas-item-id={item.item_id}
      data-canvas-item-selected={selected ? "true" : "false"}
      role="group"
      aria-roledescription="canvas item"
      aria-label={
        ariaLabel ||
        `Canvas item: ${item.content || item.item_type}`
      }
      aria-current={selected ? "true" : undefined}
      tabIndex={tabIndex}
      style={baseStyle}
      className={itemClasses}
      onMouseDown={handleMouseDown}
      onClick={(event) => event.stopPropagation()}
      onFocus={() => {
        if (!selected) {
          onSelect(item.item_id);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="canvas-item-inner">{renderContent()}</div>

      {selected && tool === "select" && (
        <>
          <div
            aria-hidden="true"
            style={{
              ...resizeHandleStyle,
              right: "-6px",
              bottom: "-6px",
              cursor: "se-resize",
            }}
            onMouseDown={handleResizeMouseDown}
          />

          <div
            aria-hidden="true"
            style={{
              ...resizeHandleStyle,
              top: "-6px",
              left: "-6px",
            }}
          />

          <div
            aria-hidden="true"
            style={{
              ...resizeHandleStyle,
              top: "-6px",
              right: "-6px",
            }}
          />

          <div
            aria-hidden="true"
            style={{
              ...resizeHandleStyle,
              bottom: "-6px",
              left: "-6px",
            }}
          />
        </>
      )}

      {selected && onDelete && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
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
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item.item_id);
            }}
          >
            Delete
          </button>

          <button
            type="button"
            className="pm-visually-hidden-focusable"
            aria-label="Delete selected canvas item"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item.item_id);
            }}
          >
            Delete selected canvas item
          </button>
        </>
      )}
    </div>
  );
}

export default CanvasItem;
```

## FILE: frontend/src/components/canvas/PropertiesPanel.tsx

```tsx
import { useId, useMemo } from "react";
import type {
  CanvasItem,
  CanvasItemStyle,
} from "../../types/canvas";
import { ShapeSelector, type ShapeType } from "./ShapeSelector";

interface PropertiesPanelProps {
  item: CanvasItem | null;
  items?: CanvasItem[];
  onUpdateLocal: (
    id: string,
    updates: Partial<CanvasItem>,
  ) => void;
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
  if (!style) {
    return {};
  }

  try {
    return JSON.parse(style) as CanvasItemStyle;
  } catch {
    return {};
  }
}

function getColorInputValue(
  value: string | undefined,
  fallback: string,
): string {
  if (value && /^#[0-9a-fA-F]{6}$/.test(value)) {
    return value;
  }

  return fallback;
}

type CanvasShapeItemType = Extract<
  CanvasItem["item_type"],
  ShapeType
>;

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
  const idPrefix = useId();

  const ids = {
    content: `${idPrefix}-content`,
    fillColor: `${idPrefix}-fill-color`,
    fillValue: `${idPrefix}-fill-value`,
    strokeColor: `${idPrefix}-stroke-color`,
    strokeValue: `${idPrefix}-stroke-value`,
    strokeWidth: `${idPrefix}-stroke-width`,
    opacity: `${idPrefix}-opacity`,
    borderRadius: `${idPrefix}-border-radius`,
    textColor: `${idPrefix}-text-color`,
    fontSize: `${idPrefix}-font-size`,
    fontWeight: `${idPrefix}-font-weight`,
    textAlign: `${idPrefix}-text-align`,
    x: `${idPrefix}-x`,
    y: `${idPrefix}-y`,
    width: `${idPrefix}-width`,
    height: `${idPrefix}-height`,
  };

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

    if (!isCanvasShapeItemType(shape)) {
      return;
    }

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
        <div
          style={{
            ...LABEL_STYLE,
            marginBottom: 4,
          }}
        >
          Type
        </div>
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
        <label htmlFor={ids.content} style={LABEL_STYLE}>
          Content
        </label>
        <textarea
          id={ids.content}
          className="pm-field"
          style={{
            ...FIELD_STYLE,
            resize: "vertical",
          }}
          value={item.content || ""}
          onChange={(event) =>
            onUpdateLocal(item.item_id, {
              content: event.target.value,
            })
          }
          onBlur={(event) =>
            onSave(item.item_id, {
              content: event.target.value,
            })
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

                onUpdateLocal(item.item_id, {
                  style: styleStr,
                });
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
            htmlFor={ids.fillColor}
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
            id={ids.fillColor}
            type="color"
            aria-label="Fill color picker"
            value={getColorInputValue(style.fill, "#cbd5e1")}
            onChange={(event) =>
              updateStyle({ fill: event.target.value })
            }
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
            id={ids.fillValue}
            type="text"
            aria-label="Fill color value"
            value={style.fill || ""}
            onChange={(event) =>
              updateStyle({ fill: event.target.value })
            }
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
            htmlFor={ids.strokeColor}
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
            id={ids.strokeColor}
            type="color"
            aria-label="Stroke color picker"
            value={getColorInputValue(style.stroke, "#475569")}
            onChange={(event) =>
              updateStyle({ stroke: event.target.value })
            }
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
            id={ids.strokeValue}
            type="text"
            aria-label="Stroke color value"
            value={style.stroke || ""}
            onChange={(event) =>
              updateStyle({ stroke: event.target.value })
            }
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
          <label htmlFor={ids.strokeWidth} style={LABEL_STYLE}>
            Stroke width: {style.strokeWidth ?? 2}px
          </label>

          <input
            id={ids.strokeWidth}
            type="range"
            min={0}
            max={12}
            step={1}
            value={style.strokeWidth ?? 2}
            onChange={(event) =>
              updateStyle({
                strokeWidth: Number(event.target.value),
              })
            }
            style={{
              width: "100%",
              accentColor: "var(--pm-accent)",
            }}
          />
        </div>

        <div>
          <label htmlFor={ids.opacity} style={LABEL_STYLE}>
            Opacity: {Math.round((style.opacity ?? 1) * 100)}%
          </label>

          <input
            id={ids.opacity}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={style.opacity ?? 1}
            onChange={(event) =>
              updateStyle({
                opacity: Number(event.target.value),
              })
            }
            style={{
              width: "100%",
              accentColor: "var(--pm-accent)",
            }}
          />
        </div>

        <div>
          <label htmlFor={ids.borderRadius} style={LABEL_STYLE}>
            Border radius
          </label>

          <input
            id={ids.borderRadius}
            type="number"
            value={style.borderRadius ?? 8}
            onChange={(event) =>
              updateStyle({
                borderRadius: Number(event.target.value),
              })
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
            htmlFor={ids.textColor}
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
            id={ids.textColor}
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
          <label htmlFor={ids.fontSize} style={LABEL_STYLE}>
            Font size
          </label>

          <input
            id={ids.fontSize}
            type="number"
            value={style.fontSize ?? 14}
            onChange={(event) =>
              updateStyle({
                fontSize: Number(event.target.value),
              })
            }
            className="pm-field"
            style={FIELD_STYLE}
          />
        </div>

        <div>
          <label htmlFor={ids.fontWeight} style={LABEL_STYLE}>
            Font weight
          </label>

          <select
            id={ids.fontWeight}
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
          <label htmlFor={ids.textAlign} style={LABEL_STYLE}>
            Text align
          </label>

          <select
            id={ids.textAlign}
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
          <label htmlFor={ids.x} style={LABEL_STYLE}>
            X
          </label>
          <input
            id={ids.x}
            type="number"
            className="pm-field"
            style={FIELD_STYLE}
            value={Math.round(item.x)}
            onChange={(event) =>
              updateNumber("x", event.target.value)
            }
            onBlur={(event) =>
              saveNumber("x", event.target.value)
            }
          />
        </div>

        <div>
          <label htmlFor={ids.y} style={LABEL_STYLE}>
            Y
          </label>
          <input
            id={ids.y}
            type="number"
            className="pm-field"
            style={FIELD_STYLE}
            value={Math.round(item.y)}
            onChange={(event) =>
              updateNumber("y", event.target.value)
            }
            onBlur={(event) =>
              saveNumber("y", event.target.value)
            }
          />
        </div>

        <div>
          <label htmlFor={ids.width} style={LABEL_STYLE}>
            W
          </label>
          <input
            id={ids.width}
            type="number"
            className="pm-field"
            style={FIELD_STYLE}
            value={Math.round(item.width)}
            onChange={(event) =>
              updateNumber("width", event.target.value)
            }
            onBlur={(event) =>
              saveNumber("width", event.target.value)
            }
          />
        </div>

        <div>
          <label htmlFor={ids.height} style={LABEL_STYLE}>
            H
          </label>
          <input
            id={ids.height}
            type="number"
            className="pm-field"
            style={FIELD_STYLE}
            value={Math.round(item.height)}
            onChange={(event) =>
              updateNumber("height", event.target.value)
            }
            onBlur={(event) =>
              saveNumber("height", event.target.value)
            }
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
              onAddConnection(
                item.item_id,
                target.item_id,
                "arrow",
              );
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
          aria-label={`Delete canvas item: ${
            item.content || item.item_type
          }`}
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

## FILE: frontend/src/components/canvas/ConnectionLine.tsx

```tsx
import type {
  CanvasConnection,
  CanvasItem,
} from "../../types/canvas";

interface ConnectionLineProps {
  connection: CanvasConnection;
  fromItem: CanvasItem;
  toItem: CanvasItem;
  selected?: boolean;
  ariaLabel?: string;
  onClick?: (connectionId: string) => void;
  onDelete?: (connectionId: string) => void;
}

function center(item: CanvasItem) {
  return {
    x: item.x + item.width / 2,
    y: item.y + item.height / 2,
  };
}

const spring = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function ConnectionLine({
  connection,
  fromItem,
  toItem,
  selected = false,
  ariaLabel,
  onClick,
  onDelete,
}: ConnectionLineProps) {
  const from = center(fromItem);
  const to = center(toItem);
  const arrow = connection.connection_type === "arrow";

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));

  const handleKeyDown = (
    event: React.KeyboardEvent<SVGGElement>,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onClick?.(connection.connection_id);
      return;
    }

    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      onDelete &&
      selected
    ) {
      event.preventDefault();
      event.stopPropagation();
      onDelete(connection.connection_id);
    }
  };

  return (
    <g
      data-canvas-connection-id={connection.connection_id}
      className="pm-canvas-connection"
      role="button"
      tabIndex={0}
      aria-label={
        ariaLabel ||
        `Connection from item ${connection.from_item_id} to item ${connection.to_item_id}`
      }
      aria-pressed={selected}
      aria-keyshortcuts={
        onDelete ? "Enter Space Delete Backspace" : "Enter Space"
      }
      onFocus={() => {
        if (!selected) {
          onClick?.(connection.connection_id);
        }
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(connection.connection_id);
      }}
      onKeyDown={handleKeyDown}
      style={{
        cursor: "pointer",
        pointerEvents: "auto",
        outlineOffset: "2px",
      }}
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={selected ? "var(--pm-accent)" : "var(--pm-text-muted)"}
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

## FILE: frontend/src/pages/Canvas.tsx

```tsx
import { useEffect, useRef, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuth, getToken } from "../hooks/useAuth";
import { useCanvas } from "../hooks/useCanvas";
import { CanvasToolbar } from "../components/canvas/CanvasToolbar";
import { CanvasViewport } from "../components/canvas/CanvasViewport";
import { PropertiesPanel } from "../components/canvas/PropertiesPanel";
import { TaskPicker } from "../components/canvas/TaskPicker";
import type { CanvasItem } from "../types/canvas";
import { Icon } from "../components/layout/Icon";

function getVisualItemOrder(items: CanvasItem[]): CanvasItem[] {
  return [...items].sort(
    (a, b) =>
      a.y - b.y ||
      a.x - b.x ||
      a.z_index - b.z_index ||
      a.item_id.localeCompare(b.item_id),
  );
}

export default function CanvasPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const projectId = searchParams.get("project_id");

  const pageRef = useRef<HTMLDivElement>(null);

  const [creating, setCreating] = useState(false);
  const [taskToPlaceId, setTaskToPlaceId] = useState<string | null>(
    null,
  );
  const [isNarrowCanvas, setIsNarrowCanvas] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 780px)").matches
      : false,
  );

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
    deleteConnection,
    selectItem,
    selectConnection,
    setTool,
    setPan,
    setZoom,
    addConnection,
  } = useCanvas(canvasId);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 780px)");

    const updateLayout = () => {
      setIsNarrowCanvas(mediaQuery.matches);
    };

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);

    return () => {
      mediaQuery.removeEventListener("change", updateLayout);
    };
  }, []);

  // Create a canvas if none exists (no id provided).
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

        if (!res.ok) {
          throw new Error("Failed to create canvas");
        }

        const data = await res.json();

        navigate(`/canvas/${data.canvas.canvas_id}`, {
          replace: true,
        });
      } catch (e) {
        console.error(e);
        setCreating(false);
      }
    };

    run();
  }, [id, creating, projectId, navigate]);

  const handleCanvasClick = async (
    point: { x: number; y: number },
  ) => {
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

  const selected =
    items.find((item) => item.item_id === selectedItemId) || null;

  const handleSaveItem = (
    itemId: string,
    updates: Partial<CanvasItem>,
  ) => {
    updateItemLocal(itemId, updates);
    saveItem(itemId, updates);
  };

  const handleDeleteItem = (itemId: string) => {
    const visualItems = getVisualItemOrder(items);
    const itemIndex = visualItems.findIndex(
      (item) => item.item_id === itemId,
    );

    const nextItem =
      itemIndex >= 0
        ? visualItems[itemIndex + 1] || visualItems[itemIndex - 1] || null
        : null;

    selectConnection(null);
    selectItem(nextItem?.item_id ?? null);
    deleteItem(itemId);

    window.requestAnimationFrame(() => {
      const itemElements =
        pageRef.current?.querySelectorAll<HTMLElement>(
          "[data-canvas-item-id]",
        );

      const nextElement = nextItem
        ? Array.from(itemElements || []).find(
            (element) =>
              element.dataset.canvasItemId === nextItem.item_id,
          )
        : null;

      if (nextElement) {
        nextElement.focus();
        return;
      }

      pageRef.current
        ?.querySelector<HTMLElement>(".pm-canvas-viewport")
        ?.focus();
    });
  };

  const handleDeleteConnection = (connectionId: string) => {
    deleteConnection(connectionId);
    selectConnection(null);

    window.requestAnimationFrame(() => {
      pageRef.current
        ?.querySelector<HTMLElement>(".pm-canvas-viewport")
        ?.focus();
    });
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
      ref={pageRef}
      className="pm-view pm-canvas-page"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        height: "100vh",
        padding: 0,
        margin: 0,
        gap: 0,
        overflow: "hidden",
      }}
    >
      <header
        className="pm-glass-panel"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          minWidth: 0,
          padding: isNarrowCanvas ? "8px 12px" : "8px 16px",
          borderRadius: 0,
          borderBottom: "1px solid var(--pm-border)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            minWidth: 0,
            flex: "1 1 auto",
          }}
        >
          <button
            type="button"
            className="pm-button pm-button-quiet"
            aria-label="Go back"
            onClick={() => navigate(-1)}
          >
            <Icon name="chevron" size={14} />
            Back
          </button>

          <span
            style={{
              fontWeight: 700,
              color: "var(--pm-text)",
              fontSize: 14,
              minWidth: 0,
              overflowWrap: "anywhere",
            }}
          >
            {canvas?.name || "Canvas"}
          </span>

          {tool === "task" && (
            <div
              style={{
                width: isNarrowCanvas
                  ? "min(240px, 100%)"
                  : "240px",
                minWidth: 0,
                flex: "0 1 240px",
              }}
            >
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
            fontSize: 12,
            color: "var(--pm-text-muted)",
            minWidth: 0,
            overflowWrap: "anywhere",
          }}
        >
          {user?.username}
        </div>
      </header>

      <main
        className="pm-canvas-page-main"
        aria-label="Canvas editor"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: "100%",
          display: "flex",
          flexDirection: isNarrowCanvas ? "column" : "row",
          overflow: "hidden",
        }}
      >
        <CanvasToolbar
          tool={tool}
          setTool={setTool}
          orientation={isNarrowCanvas ? "horizontal" : "vertical"}
        />

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
          onDeleteItem={handleDeleteItem}
          onDeleteConnection={handleDeleteConnection}
          onCanvasClick={handleCanvasClick}
          enteringItemIds={enteringItemIds}
          deletingItemIds={deletingItemIds}
          loading={loading}
        />

        <aside
          className="pm-glass-panel"
          aria-label="Canvas properties"
          style={{
            width: isNarrowCanvas ? "100%" : "288px",
            minWidth: 0,
            maxWidth: "100%",
            height: isNarrowCanvas ? "34vh" : "auto",
            maxHeight: isNarrowCanvas ? "280px" : "none",
            minHeight: isNarrowCanvas ? "150px" : 0,
            flex: isNarrowCanvas
              ? "0 1 34vh"
              : "0 0 288px",
            padding: "16px",
            overflowY: "auto",
            overflowX: "hidden",
            borderRadius: 0,
            borderLeft: isNarrowCanvas
              ? "none"
              : "1px solid var(--pm-border)",
            borderTop: isNarrowCanvas
              ? "1px solid var(--pm-border)"
              : "none",
            borderBottom: "none",
            borderRight: "none",
          }}
        >
          <h2
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--pm-text-secondary)",
              marginBottom: 12,
            }}
          >
            Properties
          </h2>

          <PropertiesPanel
            item={selected}
            items={items}
            onUpdateLocal={updateItemLocal}
            onSave={saveItem}
            onDelete={handleDeleteItem}
            onAddConnection={(fromId, toId, type) =>
              addConnection(fromId, toId, type || "arrow")
            }
          />
        </aside>
      </main>
    </div>
  );
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

function validateNonEmptyString(value: unknown, fieldName: string): string {
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

function validateFiniteNumber(value: unknown, fieldName: string): number {
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

  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(itemId);

  db.prepare(
    `UPDATE canvas_items
     SET ${fields.join(", ")}
     WHERE item_id = ?`,
  ).run(...values);

  return getCanvasItemById(itemId);
}

export function deleteItem(itemId: string): boolean {
  const db = getDb();

  // Delete connections involving this item before deleting the item.
  db.prepare(
    `DELETE FROM canvas_connections
     WHERE from_item_id = ? OR to_item_id = ?`,
  ).run(itemId, itemId);

  const result = db
    .prepare("DELETE FROM canvas_items WHERE item_id = ?")
    .run(itemId);

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
  validateNonEmptyString(connectionType, "connection_type");
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
      (typeof body.connection_type !== "string" ||
        !body.connection_type.trim())
    ) {
      res.status(400).json({
        error: "connection_type must be a non-empty string",
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
      typeof body.connection_type === "string"
        ? body.connection_type
        : "line",
      (body.style as string | null | undefined) ?? null,
    );

    res.status(201).json({ connection });
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
