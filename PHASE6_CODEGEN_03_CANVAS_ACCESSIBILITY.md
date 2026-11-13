# Code Generation Prompt — Phase 6 Step 3 (Canvas Accessibility)

**Tool:** ChatGPT regular chat (external code generator)  
**Project:** Project Manager — `<workspace>`  
**Stack:** React 19 + TypeScript + Vite + Tailwind; Express + TypeScript backend; SQLite via `node:sqlite`.  
**Phase:** 6 — Shared Foundation & Project Canvas Implementation  
**Card:** PM-P6-05 — Canvas keyboard, pointer, touch and responsive behavior  
**Owner authorization:** Phase 6 implementation authorized.

## Objective

Make the existing Canvas surface keyboard-accessible and responsive **without changing backend routes, services, schema, or API contracts**. Return complete replacement files only for the files listed below.

## Files to return (complete replacement code)

1. `frontend/src/components/canvas/CanvasViewport.tsx`
2. `frontend/src/components/canvas/CanvasItem.tsx`
3. `frontend/src/components/canvas/CanvasToolbar.tsx`
4. `frontend/src/components/canvas/ShapeSelector.tsx`
5. `frontend/src/components/canvas/PropertiesPanel.tsx`
6. `frontend/src/components/canvas/ConnectionLine.tsx`
7. `frontend/src/pages/Canvas.tsx`
8. `frontend/src/index.css` — only if a new utility class is truly required; otherwise return no CSS changes.

## Current behavior to preserve

- Existing Canvas state, hooks, API calls, item/connection models, zoom/pan, drag/resize, selection, and save flows.
- Existing glass design tokens (`var(--pm-*)`) and visual language.
- Existing component props and public exports.

## Required changes

1. **Keyboard support**
   - Arrow keys nudge the selected item by 1px (Shift = 10px).
   - Delete/Backspace deletes the selected item only when focus is not in an input/textarea/contentEditable.
   - Escape clears selection and closes any open popover.
   - Space is not a selection shortcut; keep it for pan only when not typing.
   - Canvas items must be focusable (`tabIndex={0}`) with visible focus rings.

2. **Pointer/touch**
   - Keep mouse drag/resize.
   - Add Pointer Events support so touch drag works without blocking page scroll unexpectedly.
   - Do not break the existing `onMouseDown`/`onWheel` behavior.

3. **Accessibility**
   - Add accessible names to icon-only buttons.
   - Add `aria-label` / `role` where the current markup is ambiguous.
   - Ensure focus is not trapped and focus order remains sensible.
   - Preserve reduced-motion behavior.

4. **Responsive**
   - Canvas remains usable at 375px, 768px, 1024px, 1280px, 1440px.
   - No horizontal page scroll.
   - Inspector/toolbar collapse or reflow sensibly on small screens.

5. **Code quality**
   - No new dependencies.
   - No `any` unless already present; do not widen types.
   - Keep changes minimal and focused.

## Acceptance criteria

1. `npm run typecheck --prefix frontend` exits 0.
2. `npm run build --prefix frontend` exits 0.
3. No backend file is changed.
4. No hardcoded colors — use existing CSS variables.
5. Keyboard can select, nudge, and delete a Canvas item.
6. Touch can drag a Canvas item.
7. Focus rings are visible.
8. No horizontal scroll at 375px.

## Constraints

- Do not invent new APIs or change existing component props unless strictly necessary.
- Do not add a backend route or service.
- Do not change the database schema.
- Do not change Automation Studio.
- Do not commit.

Return the complete replacement files with filename headers, then a short explanation of the changes and any remaining limitations.
