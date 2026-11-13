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
