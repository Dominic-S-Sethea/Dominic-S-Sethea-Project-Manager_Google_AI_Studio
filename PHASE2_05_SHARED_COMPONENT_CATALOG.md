# PM-P2-05 — Shared Component & Interaction Catalog

| Field | Value |
|---|---|
| Kanban card | **PM-P2-05** |
| Title | Shared component and interaction catalog for Project Canvas and Automation Studio |
| Status | **PLANNING ARTIFACT — PROPOSED; NOT OWNER-APPROVED; NOT AN IMPLEMENTATION AUTHORIZATION** |
| Date | 2026-11-10 |
| Workspace | `<workspace>` |
| Scope | Read-only planning. **No application source was modified.** |
| Authoritative sources | `frontend/src/components/**`, `frontend/src/pages/**`, `frontend/src/index.css`, `frontend/src/types/**`, `frontend/src/hooks/**`, `frontend/src/theme/**`, `frontend/package.json`, `frontend/tailwind.config.js` |
| Related docs | `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md` (canonical tokens), `PHASE2_SHARED_FOUNDATIONS_DRAFT.md`, `UI_UX_REDESIGN_PLAN.md` §6–7/§9, `handoff_future_uiux.md` §3/§7, `design-system.md`, `KANBAN_BOARD.md` |

**Status legend used throughout**

| Tag | Meaning |
|---|---|
| **EXISTING** | Verified in live source at the cited path. Inspected directly. |
| **PROPOSED** | New shared component / contract. No implementation exists today. |
| **GAP** | Verified defect, duplication, inconsistency, or missing capability. |

Paths are relative to `frontend/src/` unless absolute. All CSS classes live in `frontend/src/index.css`. Tokens are CSS custom properties on `:root` / `html[data-pm-theme="…"]`; canonical token names follow `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md`.

---

## 1. Evidence base & method

Static inspection of 31 React component files, 14 pages, 4 hooks/providers, `index.css` (65,555 bytes, 248 unique class names), `types/`, `package.json`, `tailwind.config.js`, plus the planning docs listed above. Methods: full-file reads, interface/prop extraction, className↔CSS cross-reference, `role`/`aria-*`/`focus`/`tabIndex`/`Escape` audits, and z-index/motion-token scans. No runtime execution; no source edits.

**Key verified facts**

- No component library is installed. Dependencies are React 19, react-router-dom 7, TanStack Query 5, Tailwind 3, `@dnd-kit/core` + `@dnd-kit/utilities` (**never imported**).
- All UI is hand-rolled: either one-off React components or CSS-class compositions. There is **no shared React primitive layer**.
- `index.css` defines **248 unique class names**; 58 are never referenced in TSX and 14 class names used in TSX have **no CSS definition**.

---

## 2. Existing component inventory

### 2.1 React components — EXISTING

| # | Component | Path | Exports | Public API (props) | Role |
|---|---|---|---|---|---|
| 1 | `Icon` | `components/layout/Icon.tsx` | `Icon`, `IconName` | `{ name: IconName; className?: string; size?: number }` (default 16) | 36-glyph stroke icon set; always `aria-hidden` |
| 2 | `AppShell` | `components/layout/AppShell.tsx` | `AppShell` (+ internal `NavGroup`, `ThemeMenu`, `CommandPalette`) | none | App shell, sidebar nav, command palette, theme menu, mobile nav, Ctrl+K |
| 3 | `LoginForm` | `components/auth/LoginForm.tsx` | `LoginForm` | `{ onSuccess(user, token) }` | Email/password sign-in |
| 4 | `RegisterForm` | `components/auth/RegisterForm.tsx` | `RegisterForm` | `{ onSuccess(user, token) }` | Registration + password strength meter |
| 5 | `CanvasToolbar` | `components/canvas/CanvasToolbar.tsx` | `CanvasToolbar` | `{ tool: CanvasTool; setTool }` | 6-tool vertical rail (select/square/line/arrow/text/task) |
| 6 | `CanvasViewport` | `components/canvas/CanvasViewport.tsx` | `CanvasViewport` | 17 props (items, connections, selection, tool, pan, zoom, callbacks, entering/deleting sets, loading) | Pan/zoom/momentum canvas, grid, skeleton, zoom badge |
| 7 | `CanvasItem` | `components/canvas/CanvasItem.tsx` | `CanvasItem` | 12 props (item, selected, zoom, pan, tool, entering/exiting, select/update/save/delete) | Shape/text/task/line rendering, drag, resize, delete |
| 8 | `ConnectionLine` | `components/canvas/ConnectionLine.tsx` | `ConnectionLine` | `{ connection, fromItem, toItem, selected?, onClick? }` | SVG edge with arrow marker + draw animation |
| 9 | `PropertiesPanel` | `components/canvas/PropertiesPanel.tsx` | `PropertiesPanel` | `{ item, items?, onUpdateLocal, onSave, onDelete?, onAddConnection? }` | Canvas right inspector |
| 10 | `ShapeSelector` | `components/canvas/ShapeSelector.tsx` | `ShapeSelector`, `ShapeType` | `{ value, onChange, className?, label? }` | Native select for 5 shapes |
| 11 | `TaskCard` | `components/canvas/TaskCard.tsx` | `TaskCard` | `{ item, task?, selected?, onClick? }` | Canvas task card; fetches task; `role=button` + Enter/Space |
| 12 | `TaskPicker` | `components/canvas/TaskPicker.tsx` | `TaskPicker` | `{ tasks, value?, onChange, placeholder?, className? }` | Searchable listbox for placing tasks |
| 13 | `ChecklistForm` | `components/checklists/ChecklistForm.tsx` | `ChecklistForm` | `{ checklist, taskOptions, onSubmit, onCancel }` | Dialog form (`.pm-dialog .pm-dialog-compact`) |
| 14 | `ChecklistList` | `components/checklists/ChecklistList.tsx` | `ChecklistList` | `{ checklists, tasks?, onEdit, onDelete }` | Progress rows |
| 15 | `DependencyForm` | `components/dependencies/DependencyForm.tsx` | `DependencyForm` | `{ dependency, taskOptions, existingDependencies?, onSubmit, onCancel }` | Dialog + DFS cycle detection |
| 16 | `DependencyList` | `components/dependencies/DependencyList.tsx` | `DependencyList` | `{ dependencies, tasks?, onEdit, onDelete }` | Rows + cycle warning |
| 17 | `ContextMenu` | `components/design/ContextMenu.tsx` | `ContextMenu`, `ContextMenuItem` | `{ x, y, items, onClose }`; item `{ label, icon?, onClick, divider?, danger?, disabled? }` | Fixed-position context menu |
| 18 | `DesignCanvas` | `components/design/DesignCanvas.tsx` | `DesignCanvas` | `{ children, page }` | Design-mode canvas + add-element menu |
| 19 | `DesignModeContext` | `components/design/DesignModeContext.tsx` | `DesignModeProvider`, `useDesignMode`, types | `{ children, page }` | Design-mode state, history, z-order, lock, layout persistence |
| 20 | `DesignToolbar` | `components/design/DesignToolbar.tsx` | `DesignToolbar` | none | Floating design toolbar |
| 21 | `DraggableElement` | `components/design/DraggableElement.tsx` | `DraggableElement` | `{ element, children, positionMode? }` | Design-mode drag/resize/context menu |
| 22 | `GitCommitForm` | `components/git/GitCommitForm.tsx` | `GitCommitForm` | `{ onCommitRecorded? }` | Commit link form + result |
| 23 | `ProjectForm` | `components/projects/ProjectForm.tsx` | `ProjectForm` | `{ project, onSubmit(name, description), onCancel }` | Inline panel form (not a dialog) |
| 24 | `ProjectList` | `components/projects/ProjectList.tsx` | `ProjectList` | `{ projects, onEdit, onDelete }` | Table |
| 25 | `ProjectSwitcher` | `components/projects/ProjectSwitcher.tsx` | `ProjectSwitcher` | none | Project menu; full keyboard support |
| 26 | `TaskForm` | `components/tasks/TaskForm.tsx` | `TaskForm` | `{ task, onSubmit(data), onCancel }` | Dialog form (`.pm-dialog`) |
| 27 | `TaskList` | `components/tasks/TaskList.tsx` | `TaskList` | `{ tasks, onEdit, onDelete }` | Table with status/priority/date |
| 28 | `ThemeCustomizer` | `components/theme/ThemeCustomizer.tsx` | `ThemeCustomizer` | none (uses `useTheme`) | Theme grid + custom accent |
| 29 | `UserFormDialog` | `components/users/UserFormDialog.tsx` | `UserFormDialog` | `{ user, mode, onSave, onCancel }` | Dialog form (`.pm-task-dialog`) |
| 30 | `UserList` | `components/users/UserList.tsx` | `UserList` | `{ users, currentUserRole, loading, onEdit, onNotify?, onRefresh? }` | Sortable table + skeleton |
| 31 | `UserProfile` | `components/users/UserProfile.tsx` | `UserProfile` | `{ user, loading }` | Read-only profile |

**Re-export shim:** `components/ui/Icon.tsx` re-exports `Icon`/`IconName` from `layout/Icon.tsx`.
**Stale file:** `components/layout/AppShell.tsx.backup` (not imported anywhere).

### 2.2 CSS-class components — EXISTING (no React wrapper)

These are real, widely-used components — but they exist only as class names. Consumers compose them by hand; there is no props API, no state machine, and no accessibility contract.

**Button family**

| Class | Key properties |
|---|---|
| `.pm-button` | min-height 32, padding 0 11px, radius 7, border `--pm-border`, bg `rgba(255,255,255,.04)`, color `--pm-text-secondary`, font 9/590; hover border `--pm-border-strong`, bg .085; active scale .98 |
| `.pm-button-primary` | accent gradient, `--pm-accent-ink` text, accent glow shadow |
| `.pm-button-secondary` | bg `rgba(255,255,255,.06)` |
| `.pm-button-quiet` | transparent border/bg, muted color |
| `.pm-button-small` | min-height 27, padding 0 8, font 8 |
| `.pm-primary-button` / `.pm-secondary-button` | min-height 32, inline-flex, gap 6, font 9/600 |
| `.pm-compact-button` | height 30, radius 6, font 8 |
| `.pm-text-button` | no border/bg, accent color, font 8, underline hover |
| `.pm-icon-button` | 32×32 grid center, border, radius 7 |

**Panel / surface family**

| Class | Key properties |
|---|---|
| `.pm-glass-panel` | gradient + `--pm-glass`, border `--pm-border`, radius `--pm-radius`, shadow, backdrop blur; hover border accent mix |
| `.pm-panel-heading` | flex space-between, padding 17/18/14, border-bottom |
| `.pm-panel-header` | min-height 59, flex, space-between, padding 14/16, border-bottom |
| `.pm-task-surface` | overflow-x auto |
| `.pm-focus-panel` | padding 16, border, radius 8, `--pm-glass` |
| `.pm-attention-panel` | padding 16, accent gradient bg |
| `.pm-activity-panel` | margin-top 13 |
| `.pm-overview-layout` | grid 1.6fr / 272px; 1.35fr / 255px ≤1120; 1fr ≤850 |

**Dialog family**

| Class | Key properties |
|---|---|
| `.pm-dialog-backdrop` | fixed inset 0, z 60, grid center, bg `rgba(1,3,7,.62)`, blur 10 |
| `.pm-task-dialog` | width min(680px,100%), max-height calc(100vh-36px), `--pm-glass-strong`, radius 16, shadow-float |
| `.pm-dialog-heading` | flex space-between, padding 17/18/14, border-bottom |
| `.pm-dialog-actions` | flex end, gap 8, margin-top 16 |
| `.pm-dialog-compact` | padding 12/16, radius 12 |
| `.pm-dialog-header` | flex space-between, padding 12/16, border-bottom |
| `.pm-form-grid` | grid 1fr 1fr, gap 12 |
| `.pm-field` / `.pm-field-wide` | grid gap 6 / span all |
| `.pm-inline-error` | `--pm-danger`, font 9 |

**Menu / popover family**

| Class | Key properties |
|---|---|
| `.pm-popover-backdrop`, `.pm-command-backdrop` | fixed inset 0, z 80, bg `rgba(2,4,8,.4)`, blur 6 |
| `.pm-theme-menu` | absolute top 68 right 23, width min(382px,…), `--pm-glass-strong`, radius 14 |
| `.pm-menu-header` / `.pm-menu-kicker` / `.pm-menu-copy` | header flex; kicker accent 8px; copy secondary 9px |
| `.pm-command-palette` | width min(620px,…), `--pm-glass-strong`, radius 14 |
| `.pm-command-input` / `.pm-command-item` / `.pm-command-footer` | input row 51px; item grid 27/1fr/auto; footer hints |
| `.pm-project-switcher-menu` | absolute, width min(320px,…), `--pm-glass-strong`, radius `--pm-radius-lg` |

**Status family**

| Class | Key properties |
|---|---|
| `.pm-status` | inline-flex, gap 5, `--pm-text-secondary`, font 8 |
| `.pm-status-dot` | 7×7 circle, `--pm-text-muted`; `.danger` / `.warning` / `.success` / `.info` |
| `.pm-priority-dot` | 7×7 circle; `.high` → warning, `.urgent` → danger |
| `.pm-live-marker` | success color, 5×5 pulsing dot |
| `.pm-data-status` | pill, mono 8px, `--pm-text-muted` |
| `.pm-future-tag` / `.pm-future-notice` | muted/warning bordered tags |
| `.pm-draft-tag` | absolute top-right, warning mono tag |
| `.pm-nav-count` | mono count; `.is-accent` variant |

**Empty / loading / error family**

| Class | Key properties |
|---|---|
| `.pm-empty` | padding 42/18, secondary, font 10, center |
| `.pm-empty-state` | padding 26/12, secondary, font 9, center; strong + p |
| `.pm-empty-row` | min-height 92, flex, gap 10, secondary |
| `.pm-loading-state` | padding 26/12, secondary, font 9, center |
| `.pm-skeleton-list` | padding 14/16, grid gap 9; `<i>` shimmer bars (pm-shimmer 1.4s) |
| `.pm-signal-skeleton` | height 146, shimmer |
| `.canvas-skeleton` | shimmer block |
| `.pm-state-card` | flex, gap 10, padding 12/14, radius `--pm-radius-sm`, border, bg .035 |
| `.pm-error-state` | danger border/bg mix, danger icon |
| `.pm-inline-feedback` | accent, font 9 |

**Table family**

| Class | Key properties |
|---|---|
| `.pm-task-table` | min-width 700 |
| `.pm-task-head` / `.pm-task-row` | grid rows |
| `.pm-task-title` / `.pm-task-check` | title button / check glyph |
| `.pm-project-name` / `.pm-date` | ellipsis, secondary/muted, font 8 |
| `.pm-row-actions` | flex end, gap 7; buttons accent, font 8 |
| `.pm-kanban-board` | grid auto-fit minmax(280px,1fr), gap 12 |

**Tabs / toolbar family**

| Class | Key properties |
|---|---|
| `.pm-filter-tabs` | flex gap 4 wrap; buttons 27px; `.is-active` accent border + `--pm-accent-soft` |
| `.pm-task-toolbar` | min-height 54, flex space-between, padding 10/13, border-bottom |
| `.pm-task-count` | mono 8, muted |

**Canvas family**

| Class | Key properties |
|---|---|
| `.canvas-item` | transition transform/box-shadow/border 200ms `--pm-spring` |
| `.canvas-item-inner` | 100%×100% |
| `.canvas-item-selected` / `-enter` / `-exit` / `-dragging` | state modifiers |
| `.canvas-spring` | spring timing |
| `.pm-canvas-viewport` / `.pm-canvas-zoom-indicator` | **undefined in CSS** — inline styles only |
| `.pm-properties-panel` / `.pm-task-card` | **undefined in CSS** — inline styles only |

**Automation family — EXISTING (preview-only)**

| Class | Key properties |
|---|---|
| `.pm-automation-layout` | grid 177px / 1fr / 258px; rows 1fr / 178px |
| `.pm-automation-library` | left column, border-right |
| `.pm-automation-canvas` | relative, dot-grid background |
| `.pm-canvas-tools` | absolute top-left flex gap 5 |
| `.pm-flow-node` | absolute, 170px, grid 22px/1fr, glass-strong |
| `.pm-flow-end` | absolute result node |
| `.pm-workflow-lines` | absolute inset 0 SVG |
| `.pm-node-symbol` / `.pm-node-letter` | 20×20 grid center, accent-soft |
| `.pm-node-inspector` | right column, border-left, bg dark |
| `.pm-inspector-content` / `-divider` / `-warning` | padding 12 / divider / warning text |
| `.pm-execution-drawer` | bottom row, grid 183px/1fr, border-top |
| `.pm-trace` / `.pm-trace-grid` / `.pm-step-list` / `.pm-output-box` | trace layout |
| `.pm-draft-tag` / `.pm-zoom` | draft badge / zoom badge |

**Auth / layout / responsive family**

| Class | Key properties |
|---|---|
| `.pm-auth-shell` / `.pm-auth-card` / `.pm-auth-tabs` / `.pm-auth-orb` / `.pm-auth-brand` | login surface |
| `.pm-app-shell` | grid 238px / 1fr; 204px ≤1120; block ≤780 |
| `.pm-sidebar` | sticky, 100vh, rail gradient, blur 28 |
| `.pm-nav-link` | 35px, radius 7; `.is-active` accent gradient + inset bar |
| `.pm-topbar` | sticky, 58px, blur 28 |
| `.pm-command-trigger` | width min(318px,34vw); 165px ≤780 |
| `.pm-mobile-nav-toggle` | hidden; inline-grid ≤780 |
| `.is-mobile-open` | sidebar nav groups display ≤780 |
| Breakpoints | `@media (max-width: 1120px)`, `850px`, `780px`; `prefers-reduced-motion: reduce` |

### 2.3 Pages — EXISTING

| Page | Path | Purpose | Notable states |
|---|---|---|---|
| `Dashboard` | `pages/Dashboard.tsx` | Thin wrapper around `WorkspaceOverview` with `onOpenWork` / `onNewTask` | — |
| `WorkspaceOverview` | `pages/WorkspaceOverview.tsx` | Focus queue, project pulse, attention panel, activity panel | skeleton / error / empty / live marker |
| `Projects` | `pages/Projects.tsx` | Project directory + task workspace mount | dialog, alert, aria-live, aria-pressed |
| `TaskWorkspace` | `pages/TaskWorkspace.tsx` | Largest page: tabs, filters, list/board, task dialog, checklist/dependency forms | skeleton / error / empty row / aria-live count |
| `ReviewQueue` | `pages/ReviewQueue.tsx` | Blocked tasks + approval readiness | loading / empty |
| `AutomationStudio` | `pages/AutomationStudio.tsx` | Preview-only workflow mock | static sample data, no runtime |
| `Canvas` | `pages/Canvas.tsx` | Canvas editor: header, toolbar, viewport, properties, task picker | creating / skeleton / error |
| `CanvasList` | `pages/CanvasList.tsx` | Canvas list + inline create | skeleton / error / empty |
| `Connectors` | `pages/Connectors.tsx` | Connector CRUD | inline message / error |
| `GitCommits` | `pages/GitCommits.tsx` | Commit list + record form | skeleton / error / empty |
| `ImportExport` | `pages/ImportExport.tsx` | Export/import | loading / error |
| `Appearance` | `pages/Appearance.tsx` | Theme + accent customization | alert |
| `Users` | `pages/Users.tsx` | User management + toast + dialog + profile | toast / error / status |
| `Login` | `pages/Login.tsx` | Auth shell with tabs | — |

### 2.4 Hooks & providers — EXISTING

| Hook / provider | Path | Returns / provides |
|---|---|---|
| `useCanvas(canvasId)` | `hooks/useCanvas.ts` | canvas, items, connections, selection, tool, pan, zoom, loading, error, tasks, entering/deleting sets, CRUD + connection methods, saveItem, refetch |
| `useAuth()` | `hooks/useAuth.tsx` | user, login/register/logout, getToken |
| `useTheme()` | `theme/ThemeProvider.tsx` | theme, accent, hasCustomAccent, preset, presetName, setters/reset |
| `useDesignMode()` | `components/design/DesignModeContext.tsx` | isDesignMode, elements, selection, history, undo/redo, z-order, lock, save/reset layout |
| `ThemeProvider` | `theme/ThemeProvider.tsx` | theme context, six presets, custom accent |
| `DesignModeProvider` | `components/design/DesignModeContext.tsx` | design-mode context, layout persistence |

### 2.5 Stale / orphan artifacts — GAP

- `components/layout/AppShell.tsx.backup` — not imported.
- `components/ui/Icon.tsx` — re-export shim only.
- **58 CSS classes never referenced in TSX**: `bg-blue-500/600`, `bg-green-500`, `bg-red-500`, `bg-yellow-500`, `bg-white`, `bg-slate-50`, `border-slate-200/300`, `text-slate-400…900`, `text-blue-600`, `text-red-600`, `shadow`, `shadow-lg`, `min-h-screen`, `dark`, `todo`, `done`, `blocked`, `in_progress`, `high`, `low`, `urgent`, `is-accent`, `is-error`, `is-mobile-open`, `pm-main`, `pm-page-host`, `pm-breadcrumb`, `pm-top-actions`, `pm-chevron`, `pm-avatar`, `pm-profile*`, `pm-workspace-icon`, `pm-nav-item`, `pm-nav-link`, `pm-nav-tag`, `pm-nav-count`, `pm-notification-dot`, `pm-theme-trigger`, `pm-empty`, `pm-menu-note`, `pm-appearance-theme-card`.
- **14 class names used in JSX but undefined in CSS:** `pm-dialog`, `pm-status-pill`, `pm-priority`, `pm-task-check`, `pm-table-actions`, `pm-task-table-wrap`, `pm-task-picker-option`, `pm-properties-panel`, `pm-task-card`, `pm-canvas-viewport`, `pm-canvas-zoom-indicator`, `pm-signal-panel`, `pm-input`, `design-canvas-bg`.
- **`@dnd-kit/core` + `@dnd-kit/utilities`** are dependencies in `frontend/package.json` but never imported.

---

## 3. Existing interaction patterns — EXISTING

### 3.1 Overlay stack (actual, hardcoded)

| Layer | z-index | Where |
|---|---|---|
| Workflow lines | 0 | `.pm-workflow-lines` |
| Flow node | 2 | `.pm-flow-node` |
| Zoom / canvas tools | 3–4 | `.pm-zoom`, `.pm-canvas-tools`, `.pm-draft-tag` |
| Topbar | 10 | `.pm-topbar` |
| Sidebar | 20 | `.pm-sidebar` |
| Task picker dropdown | 50 | `TaskPicker` inline style |
| Dialog backdrop | 60 | `.pm-dialog-backdrop` |
| Popover / command backdrop | 80 | `.pm-popover-backdrop`, `.pm-command-backdrop` |
| Project switcher | 81 / 82 | inline styles |
| Design toolbar | 9998 | `DesignToolbar` inline style |
| Context menu | 9999 | `ContextMenu` inline style |

**GAP:** 10+ ad-hoc values. `PHASE2_04` §7.6 proposes named `--pm-z-*` tokens; `UI_UX_REDESIGN_PLAN.md` §6 specifies a 0/10/20/30/50/60/70 stack. Neither is implemented.

### 3.2 Dialog patterns (5 inconsistent implementations)

| Consumer | Container classes | Backdrop dismiss | Escape | Focus trap | Initial focus | Scroll lock |
|---|---|---|---|---|---|---|
| `TaskWorkspace` task dialog | `.pm-task-dialog` + `.pm-dialog-heading` | No | No | No | `autoFocus` on title input | No |
| `UserFormDialog` | `.pm-task-dialog` + `.pm-dialog-header` | No | No | No | None | No |
| `TaskForm` | `.pm-dialog` (**undefined**) + `.pm-dialog-header` | Yes (`onMouseDown`) | No | No | `autoFocus` | No |
| `ChecklistForm` | `.pm-dialog .pm-dialog-compact` (**undefined**) | Yes | No | No | None | No |
| `DependencyForm` | `.pm-dialog .pm-dialog-compact` (**undefined**) | Yes | No | No | None | No |
| `Projects` project dialog | `.pm-task-dialog` + `.pm-dialog-heading` | Yes (target check) | No | No | `autoFocus` | No |

### 3.3 Menu patterns (4)

| Component | Role / ARIA | Keyboard | Focus management |
|---|---|---|---|
| `ProjectSwitcher` | `role=menu`, `aria-haspopup/expanded/controls` | Escape, ArrowUp/Down, Home/End | Focus selected item on open; **returns focus to trigger on close** |
| `TaskPicker` | `role=listbox`, `aria-haspopup/expanded/controls/selected` | Native Tab/Enter only; **no arrow-key navigation** | `autoFocus` on search input |
| `ContextMenu` | **none** (`div` + `button`) | Escape, outside mousedown | **No focus management** |
| `ThemeMenu` / `CommandPalette` | `role=dialog`, `aria-modal=true` | Escape via AppShell global handler; palette has ArrowUp/Down/Enter | `autoFocus` on input |

### 3.4 Focus management matrix — GAP

| Component | Initial focus | Focus trap | Focus return | Escape closes |
|---|---|---|---|---|
| `ProjectSwitcher` | selected item | No (menu) | **Yes** | Yes |
| `CommandPalette` | search input | No | No | Yes (global) |
| `ThemeMenu` | none | No | No | Yes (global) |
| `TaskPicker` | search input | No | No | No |
| `ContextMenu` | none | No | No | Yes |
| All dialogs | first input or none | **No** | **No** | **No** |

### 3.5 Keyboard support matrix — GAP

| Component | Keyboard support |
|---|---|
| `TaskCard` | `tabIndex=0`, `role=button`, Enter/Space |
| `ProjectSwitcher` | Full menu pattern |
| `CommandPalette` | ArrowUp/Down/Enter/Escape |
| `ContextMenu` | Escape only |
| `TaskPicker` | Tab/Enter (native buttons); no list arrow nav |
| `CanvasToolbar` / `DesignToolbar` | Tab/Enter (native buttons) |
| `CanvasViewport` / `CanvasItem` | **None** — pan/zoom/drag/resize mouse-only |
| `AutomationStudio` nodes | Tab/Enter as plain buttons; no canvas semantics, no arrow-key node nav |
| Dialogs | Tab/Enter native; **no Escape, no trap** |

### 3.6 Motion tokens — EXISTING

- `--pm-spring: cubic-bezier(0.22, 1, 0.36, 1)` — nav, buttons, theme controls.
- Local springs `cubic-bezier(0.34, 1.56, 0.64, 1)` in `CanvasViewport`, `CanvasItem`, `CanvasToolbar`, `ConnectionLine` — **not centralized**.
- Keyframes: `canvas-pop-in`, `canvas-pop-out`, `canvas-pulse-glow`, `canvas-skeleton-pulse`, `canvas-draw-line`, `pm-shimmer`.
- Global `prefers-reduced-motion: reduce` kill-switch (all animations/transitions → 0.01ms).
- **GAP:** no per-component duration tokens, no shared spring config, no interruptible-animation contract. `PHASE2_04` §7.8 proposes `--pm-ease-*` / `--pm-duration-*`.

### 3.7 Theme tokens — EXISTING

`:root` (Obsidian Signal default): `--pm-canvas #090b0f`, `--pm-canvas-deep #050609`, `--pm-rail`, `--pm-glass`, `--pm-glass-strong`, `--pm-glass-soft`, `--pm-glass-hover`, `--pm-border`, `--pm-border-strong`, `--pm-text #f4f8ff`, `--pm-text-secondary #aebcd0`, `--pm-text-muted #738197`, `--pm-accent #54C8FF`, `--pm-accent-rgb`, `--pm-accent-ink`, `--pm-accent-soft`, `--pm-accent-glow`, `--pm-success #73d6a3`, `--pm-warning #f2be6e`, `--pm-danger #f0838c`, `--pm-info #95b9ff`, `--pm-radius-sm 8`, `--pm-radius 14`, `--pm-radius-lg 20`, `--pm-shadow`, `--pm-shadow-float`, `--pm-spring`.

Theme presets: `violet`, `aurora`, `ember`, `emerald` (override canvas/rail/glass/border/text). `--color-*` bridge aliases exist for `design-system.md` compatibility.

**GAP:** no focus-ring token, no z-index tokens, no duration tokens, no toast/drawer surface tokens, no elevation scale (design-system.md §30 levels 0–3 not implemented as tokens). Canonical names and values: `PHASE2_04` §5/§7.

---

## 4. Findings & gaps

| ID | Severity | Finding | Evidence | Required action |
|---|---|---|---|---|
| F-01 | High | **No shared React primitive layer.** 31 components, none under a shared/ui directory; every overlay is hand-rolled. | `components/**` | Build shared primitives (§6). |
| F-02 | High | **Dialog implementations inconsistent** — 5 variants; 2 use undefined `.pm-dialog`. | `TaskWorkspace`, `UserFormDialog`, `TaskForm`, `ChecklistForm`, `DependencyForm`, `Projects` | One `Dialog` primitive + migration. |
| F-03 | High | **No focus trap or focus return in any dialog.** Only `ProjectSwitcher` calls `.focus()`. | grep: `focus()` only in `ProjectSwitcher.tsx` | FocusTrap utility + Dialog/Drawer integration. |
| F-04 | High | **No Escape handling in dialogs.** Only the AppShell global handler closes palette/theme/mobile nav. | grep: `Escape` absent from all dialog components | Escape contract in overlay stack. |
| F-05 | High | **No Toast component.** Inline style blocks; hardcoded `#22c55e`/`#ef4444`; 4000ms timeout; no stacking/close/pause. | `Users.tsx`, `Connectors.tsx`, `ImportExport.tsx` | Toast provider + `Toast` component. |
| F-06 | High | **No Drawer component.** AutomationStudio `.pm-execution-drawer` is a static grid region with no focus/Escape/aria/scroll-lock. | `AutomationStudio.tsx`, `index.css` | Drawer primitive (modal + non-modal modes). |
| F-07 | High | **No Menu component.** `ContextMenu` lacks `role=menu`, arrow keys, focus; `TaskPicker` lacks arrow-key nav; only `ProjectSwitcher` is complete. | `ContextMenu.tsx`, `TaskPicker.tsx`, `ProjectSwitcher.tsx` | Menu primitive with menu/listbox modes. |
| F-08 | Medium | **No Toolbar component.** `CanvasToolbar`, `DesignToolbar`, `.pm-task-toolbar`, `.pm-canvas-tools`, `.pm-top-actions` all hand-rolled. | `components/**`, `index.css` | Toolbar primitive (rail/bar/floating/inline). |
| F-09 | Medium | **No Status component.** `.pm-status`, `.pm-status-dot`, `.pm-priority-dot`, `.pm-live-marker`, `.pm-data-status`, `.pm-future-tag`, `.pm-draft-tag`; `.pm-status-pill` used but undefined; colors hardcoded in places. | `index.css`, `Users.tsx`, `TaskList.tsx` | Status primitive with tone/variant API. |
| F-10 | Medium | **No Empty component.** `.pm-empty`, `.pm-empty-state`, `.pm-empty-row` plus inline empty markup in 8+ files. | `index.css`, `ReviewQueue`, `GitCommits`, `Connectors`, `CanvasList`, `Users`, `UserProfile`, `TaskList` | Empty primitive. |
| F-11 | Medium | **No Loading component.** `.pm-skeleton-list`, `.pm-signal-skeleton`, `.canvas-skeleton`, `.pm-loading-state`; inline skeletons duplicated. | `index.css`, pages | Loading primitive (skeleton/spinner/text). |
| F-12 | Medium | **No Error component.** `.pm-state-card.pm-error-state` plus inline error blocks in 8+ files. | `index.css`, `Users`, `Connectors`, `ImportExport`, `WorkspaceOverview`, `ReviewQueue`, `GitCommits`, `CanvasList`, `TaskWorkspace`, `DependencyList` | Error primitive + error boundary. |
| F-13 | High | **No Inspector component.** Canvas `PropertiesPanel` and AutomationStudio `.pm-node-inspector` are separate implementations with different tab models. | `PropertiesPanel.tsx`, `AutomationStudio.tsx` | Inspector primitive (tabs/sections). |
| F-14 | Medium | **No Panel component.** `.pm-glass-panel` is the only shared surface; header/body/footer composed ad hoc; `.pm-panel-heading` vs `.pm-panel-header` duplication. | `index.css`, pages | Panel primitive. |
| F-15 | Medium | **No Button component.** 10 class variants; no loading/success/error/icon-only API; no shared `aria-busy`/disabled semantics; no size scale. | `index.css`, all pages | Button primitive. |
| F-16 | Medium | **Overlay z-index chaos.** 10+ hardcoded values; no token stack. | §3.1 | Adopt `PHASE2_04` §7.6 `--pm-z-*` tokens. |
| F-17 | Medium | **Undefined class names used in JSX (14).** | §2.5 | Define or remove; migrate to primitives. |
| F-18 | Low | **58 unused CSS classes** (legacy slate/Tailwind overrides, duplicate nav classes). | §2.5 | Delete in cleanup pass. |
| F-19 | Medium | **No focus-ring token.** Only global `outline: 2px solid var(--pm-accent)`; design-system.md §9 requires high-contrast focus. | `index.css` | Adopt `PHASE2_04` §7.7 `--pm-focus-*`. |
| F-20 | Medium | **Hardcoded colors bypass tokens.** `#3b82f6`/`#64748b` in `ConnectionLine`; `#3b82f6` in `DraggableElement`; `#22c55e`/`#ef4444` in `Users.tsx`; strength colors in `RegisterForm`. | source | Tokenize all colors. |
| F-21 | Medium | **`@dnd-kit/core` + utilities are unused dependencies.** Drag is hand-rolled with no keyboard alternative. | `package.json`, import scan | Remove or adopt; add keyboard drag. |
| F-22 | High | **Canvas is not keyboard operable.** `CanvasViewport` (pan/zoom/drag/resize) and `CanvasItem` have no keyboard handlers. | `CanvasViewport.tsx`, `CanvasItem.tsx` | Keyboard canvas contract. |
| F-23 | High | **AutomationStudio has no accessibility semantics.** Plain buttons; no `role=tablist`, no arrow-key node nav, no live region. | `AutomationStudio.tsx` | A11y pass + Inspector/Menu primitives. |
| F-24 | Medium | **No overlay scroll locking or dedicated responsive drawer rules.** Dialogs don't lock body scroll; drawer has no mobile treatment beyond grid reflow. | dialogs, `.pm-execution-drawer` | Scroll lock + Drawer responsive rules. |
| F-25 | Medium | **No error boundaries or Suspense.** | `main.tsx`, `App.tsx` | Add ErrorBoundary + Suspense. |
| F-26 | Low | **Toast timeout hardcoded; no action button; no error/success semantics beyond color.** | `Users.tsx` `setTimeout(..., 4000)` | Toast API with tone/action/duration. |
| F-27 | High | **AutomationStudio semantics risk.** Preview shares visual language with Canvas; must preserve control-flow vs visual-relationship distinction. | `handoff_future_uiux.md` §3, §7 | Semantic separation rules (§7). |
| F-28 | Medium | **No shared Tabs component.** `.pm-filter-tabs`, `.pm-auth-tabs`, AutomationStudio inspector nav, TaskWorkspace tabs all hand-rolled; no `role=tablist`. | `index.css`, pages | Tabs primitive (can ride on Inspector). |
| F-29 | Medium | **No command registry / shortcut layer beyond Ctrl+K and Escape.** DesignToolbar shows Ctrl+Z/Y titles but has no handler; palette entries are static. | `AppShell.tsx`, `DesignToolbar.tsx` | Command registry. |
| F-30 | Low | **Token naming split.** `design-system.md` documents `--color-*`; implementation uses `--pm-*` with aliases. | `index.css`, `design-system.md` | Document `--pm-*` as source of truth (`PHASE2_04` §5.4). |

---

## 5. Proposed shared foundation — PROPOSED

### 5.1 Token contract

**Existing tokens (source of truth, per `PHASE2_04` §5):** six core `--pm-canvas`, `--pm-rail`, `--pm-glass`, `--pm-border`, `--pm-accent`, `--pm-text`; plus supporting surface/ink/accent/status/shape/motion tokens.

**Proposed additions (aligned to `PHASE2_04` §7.6–7.8):**

| Token | Value | Usage |
|---|---|---|
| `--pm-z-base` | `0` | Canvas, workflow lines |
| `--pm-z-raised` | `10` | Topbar, floating toolbars |
| `--pm-z-nav` | `20` | Sidebar |
| `--pm-z-menu` | `50` | Menus, popovers, context menus, pickers |
| `--pm-z-dialog` | `60` | Modal dialogs |
| `--pm-z-popover` | `80` | Command palette |
| `--pm-z-canvas-drag` | `9999` | Canvas dragging |
| `--pm-focus-width` / `--pm-focus-offset` / `--pm-focus-color` / `--pm-focus-ring` | `2px` / `2px` / `var(--pm-accent)` / `0 0 0 2px var(--pm-focus-color)` | Focus-visible on all interactive elements |
| `--pm-ease-spring` | `cubic-bezier(0.22, 1, 0.36, 1)` | Shared spring (replaces local springs) |
| `--pm-ease-standard` | `ease` | Standard transitions |
| `--pm-duration-instant` / `-fast` / `-normal` / `-slow` / `-emphasis` | `100ms` / `150ms` / `200ms` / `320ms` / `470ms` | Component motion |
| `--pm-shadow-sm` | `0 4px 12px rgba(0,0,0,.18)` | Subtle elevation |

### 5.2 Overlay stack (proposed)

| Layer | Token | Existing mapping |
|---|---|---|
| Base | `--pm-z-base` (0) | workflow lines, canvas |
| Raised | `--pm-z-raised` (10) | topbar (10), design toolbar (9998→10) |
| Nav | `--pm-z-nav` (20) | sidebar (20) |
| Menu | `--pm-z-menu` (50) | task picker (50), project switcher (81/82→50), context menu (9999→local) |
| Dialog | `--pm-z-dialog` (60) | dialog backdrop (60) |
| Popover | `--pm-z-popover` (80) | popover/command backdrop (80) |
| Canvas drag | `--pm-z-canvas-drag` (9999) | canvas dragging |

Menus live in their trigger's stacking context, so local values are safe; tokens make them predictable.

### 5.3 Shared behavior contracts — PROPOSED

| Contract | Rule |
|---|---|
| FocusTrap | On open: store `document.activeElement`; focus first focusable or container (`tabIndex={-1}`). On close: restore stored focus. |
| Escape | Closes the **topmost** overlay only; `stopPropagation` so it does not cascade. |
| Outside click | Menus/popovers only. Dialogs require explicit action or backdrop click. |
| Typeahead | Menus support printable-character typeahead to jump to matching item. |
| Roving tabindex | Menu/toolbar/tablist items use roving `tabIndex`; only one stop in the group. |
| Title linking | Every overlay uses `useId()` for `aria-labelledby` / `aria-controls`. |
| Scroll lock | Modal overlays lock body scroll; non-modal drawers do not. |
| Live regions | Toasts: `role=status` (polite) for success/info, `role=alert` (assertive) for error. |
| Reduced motion | All motion tokens collapse to 0.01ms; pulse/spinner animations stop. |

---

## 6. Proposed shared components — PROPOSED

All 12 components below are **PROPOSED**. None exists today. Each replaces the existing class compositions and hand-rolled implementations listed in §2–§4.

### 6.1 Button

```ts
type ButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;      // default "secondary"
  size?: ButtonSize;            // default "md"
  loading?: boolean;            // spinner + aria-busy
  success?: boolean;            // check morph (transient)
  error?: boolean;              // danger treatment (transient)
  icon?: IconName;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  children: React.ReactNode;    // label; required for a11y
}
```

**Variants → existing classes:** primary → `.pm-button-primary` / `.pm-primary-button`; secondary → `.pm-button-secondary` / `.pm-secondary-button`; quiet → `.pm-button-quiet`; ghost → `.pm-text-button`; danger → new (color-mix `--pm-danger`); icon → `.pm-icon-button`.

**Sizes:** sm → 27px (`.pm-button-small`); md → 32px (default); lg → 37px (auth); icon → 32×32.

**Interaction states:** default → hover (border `--pm-border-strong`, bg .085) → active (scale .98) → focus-visible (`--pm-focus-ring`) → loading (spinner + `aria-busy`, label kept) → success (check morph 470ms) → error (danger border/text) → disabled (`disabled`, opacity .55, removed from tab order).

**Keyboard behavior:** native `<button>`; Enter/Space activate; focus-visible ring; disabled removes from tab order. No arrow-key behavior.

**Focus management:** no special management; visible focus ring on all variants. Icon-only buttons require `aria-label`.

**Responsive rules:** ≤780px — topbar primary button may collapse to icon-only (existing CSS behavior); min target 32px (current) should move toward 44px touch per `design-system.md` §9 — flag as GAP F-15.

**Accessibility:** `<button>` element; `aria-label` required for icon-only; `aria-busy` when loading; `aria-disabled` for soft-disabled; never `<div onClick>`; never color-only state.

**Token usage:** `--pm-accent`, `--pm-accent-ink`, `--pm-border`, `--pm-border-strong`, `--pm-text`, `--pm-text-secondary`, `--pm-danger`, `--pm-radius-sm`, `--pm-shadow`, `--pm-ease-spring`, `--pm-focus-ring`.

**Canvas usage:** `CanvasToolbar` tool buttons, `CanvasItem` delete, `TaskPicker` trigger, zoom controls.
**Automation usage:** node library items, inspector actions, save/test/publish, approval gate actions.

### 6.2 Panel

```ts
interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  variant?: "glass" | "solid" | "attention" | "flush";
  padding?: "none" | "sm" | "md" | "lg";
  as?: "section" | "aside" | "div";
  className?: string;
}
```

**Variants:** glass → `.pm-glass-panel`; solid → `--pm-glass-strong`; attention → `.pm-attention-panel`; flush → borderless (tables, rows).

**Interaction states:** default; hover (border accent mix); elevated (`--pm-shadow-float`); selected (accent border + ring).

**Keyboard behavior:** none — container only.

**Focus management:** none; title is linked via `aria-labelledby` when present.

**Responsive rules:** ≤850px — panels stack; ≤780px — padding 12; `.pm-overview-layout` / `.pm-review-grid` / `.pm-appearance-layout` collapse to 1fr.

**Accessibility:** `role="region"` + `aria-labelledby` when title present; heading level follows page outline; `aria-label` when no visible title; decorative separators `aria-hidden`.

**Token usage:** `--pm-glass`, `--pm-glass-strong`, `--pm-border`, `--pm-shadow`, `--pm-radius`, `--pm-accent`.

**Canvas usage:** Canvas header, properties column wrapper, canvas list rows.
**Automation usage:** studio layout regions, inspector container, execution drawer, node cards.

### 6.3 Inspector

```ts
interface InspectorProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: { id: string; label: React.ReactNode; content: React.ReactNode }[];
  sections?: { id: string; title?: React.ReactNode; content: React.ReactNode }[];
  empty?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  width?: "sm" | "md" | "lg" | number;
  position?: "right" | "left" | "inline";
}
```

**Variants:** tabs (AutomationStudio inspector settings/input/output); sections (canvas PropertiesPanel); combined; empty state.

**Interaction states:** default; tab-active; empty; warning (`.pm-inspector-warning`); loading.

**Keyboard behavior:** tabs — ArrowLeft/Right/Home/End move, Enter/Space select, `role=tablist`/`tab`/`tabpanel`; sections — no special keys.

**Focus management:** focus active tab on open; focus panel heading or first control; `onClose` returns focus to trigger.

**Responsive rules:** ≤850px — inspector becomes full-width section below canvas; ≤780px — stacked; canvas inspector 288px → 100%.

**Accessibility:** `role=tablist` with `aria-selected`/`aria-controls`; `aria-labelledby` for the inspector region; warnings `role="note"` or `aria-live="polite"`; close button labelled.

**Token usage:** `--pm-glass`, `--pm-border`, `--pm-text-secondary`, `--pm-accent`, `--pm-warning`, `--pm-radius-sm`.

**Canvas usage:** `PropertiesPanel` (selection-driven; empty state "Select an item to edit properties").
**Automation usage:** node inspector (settings/input/output), workflow settings, permission warnings.

### 6.4 Drawer

```ts
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "left" | "bottom";
  size?: "sm" | "md" | "lg";
  dismissable?: boolean;          // backdrop + Escape
  modal?: boolean;                // false = non-modal (execution drawer)
  closeLabel?: string;
}
```

**Variants:** bottom (execution history/trace); right (future node detail); left (future library).

**Interaction states:** closed; open; entering/leaving (slide + fade 320ms); collapsed (non-modal bottom); peek.

**Keyboard behavior:** Escape closes when `dismissable`; Tab cycles within when `modal`; arrow keys do not close.

**Focus management:** on open focus drawer container (`tabIndex=-1`) or first control; trap when `modal`; on close return focus to trigger. Non-modal drawer does not steal focus permanently.

**Responsive rules:** ≤780px — bottom drawer full-width, drag handle, max-height 70vh, backdrop; ≥781px — bottom drawer full width × 320px, right drawer 360px.

**Accessibility:** `role="dialog"` + `aria-modal="true"` when modal; `role="complementary"` + `aria-label` when non-modal; `aria-labelledby`; focus trap when modal; scroll lock when modal; background `inert` when modal.

**Token usage:** `--pm-glass-strong`, `--pm-border-strong`, `--pm-shadow-float`, `--pm-radius-lg`, `--pm-ease-spring`, `--pm-z-dialog`.

**Canvas usage:** not used today (canvas uses inline panels); future item detail.
**Automation usage:** execution drawer (history + step trace) — **non-modal** by default so users can inspect nodes while viewing the trace.

### 6.5 Dialog

```ts
interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  dismissable?: boolean;   // backdrop + Escape
  closeLabel?: string;
}
```

**Variants:** sm (user form ~448px); md (task ~680px); lg (future); compact (checklist/dependency).

**Interaction states:** closed; open; entering (scale .96→1 + fade); leaving.

**Keyboard behavior:** Escape closes when `dismissable`; Tab cycles within (focus trap); Enter submits when wrapped in a form; arrow keys no-op.

**Focus management:** on open store trigger, focus first input or primary action; trap Tab; on close restore focus to trigger.

**Responsive rules:** ≤780px — width 100%, max-height 100dvh, sheet-style from bottom, sticky footer, radius 16 top only.

**Accessibility:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`; focus trap; body scroll lock; labelled close button; error summary `role="alert"`; `aria-busy` while submitting.

**Token usage:** `--pm-glass-strong`, `--pm-border-strong`, `--pm-shadow-float`, `--pm-radius-lg`, `--pm-accent`, `--pm-z-dialog`.

**Canvas usage:** not used (canvas uses inline properties panel).
**Automation usage:** publish confirmation, approval gate decision, template picker, destructive-action confirmation.

### 6.6 Menu

```ts
interface MenuItem {
  id: string;
  label: React.ReactNode;
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  shortcut?: string;
  onSelect: () => void;
}

interface MenuProps {
  trigger: React.ReactNode | ((state: { open: boolean }) => React.ReactNode);
  items: MenuItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "end";
  role?: "menu" | "listbox";
  label?: string;
  searchable?: boolean;
}
```

**Variants:** dropdown (ProjectSwitcher); context (right-click); listbox (TaskPicker); command (CommandPalette — separate component but same primitives).

**Interaction states:** closed; open; hover; focus; selected; disabled; danger.

**Keyboard behavior:** ArrowUp/Down move; Home/End jump; Enter/Space select; Escape close; typeahead jump; Tab closes (menu pattern) or moves (listbox pattern).

**Focus management:** on open focus active item; roving tabindex; on close return focus to trigger; context menu focuses first item.

**Responsive rules:** ≤780px — dropdowns become full-width bottom sheets; context menu clamps to viewport edges.

**Accessibility:** `role="menu"`/`menuitem` or `role="listbox"`/`option`; `aria-haspopup`/`aria-expanded`/`aria-controls`; `aria-activedescendant` for listbox; visible focus; danger items announced; disabled items `aria-disabled`.

**Token usage:** `--pm-glass-strong`, `--pm-border`, `--pm-shadow-float`, `--pm-radius-sm`, `--pm-accent-soft`, `--pm-danger`, `--pm-z-menu`.

**Canvas usage:** `TaskPicker` (listbox), future canvas context menu.
**Automation usage:** node library, workflow context menu, approval actions.

### 6.7 Toolbar

```ts
interface ToolbarProps {
  children: React.ReactNode;
  variant?: "rail" | "bar" | "floating" | "inline";
  label?: string;
  alignment?: "start" | "center" | "end";
  gap?: "sm" | "md";
}
```

**Variants:** rail (`CanvasToolbar` vertical); bar (`.pm-task-toolbar` horizontal); floating (`DesignToolbar`); inline (topbar actions); compact.

**Interaction states:** default; scrolled/collapsed (per design-system.md §27 "shrink, don't vanish"); sticky; active tool (`aria-pressed`).

**Keyboard behavior:** Tab/Enter native; arrow-key group navigation for tool buttons (`role="toolbar"`, `aria-orientation`).

**Focus management:** roving tabindex for tool groups; visible focus ring.

**Responsive rules:** ≤780px — rail collapses to horizontal scroll; floating toolbar max-width `calc(100vw - 24px)`; topbar actions compress.

**Accessibility:** `role="toolbar"` + `aria-label`; `aria-orientation`; toggle buttons use `aria-pressed`; group labels visible or `aria-label`.

**Token usage:** `--pm-glass`, `--pm-border`, `--pm-radius`, `--pm-accent-soft`, `--pm-z-raised`.

**Canvas usage:** `CanvasToolbar`, canvas zoom controls.
**Automation usage:** studio top bar, canvas tools, execution drawer toolbar.

### 6.8 Status

```ts
interface StatusProps {
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "accent";
  size?: "sm" | "md";
  variant?: "dot" | "pill" | "badge" | "text";
  pulse?: boolean;
  label: React.ReactNode;
  icon?: IconName;
}
```

**Variants:** dot → `.pm-status-dot`; pill → `.pm-status-pill` (new — currently undefined); badge → `.pm-data-status`; text → `.pm-status`; live → `.pm-live-marker`; draft/future → `.pm-draft-tag` / `.pm-future-tag`.

**Interaction states:** neutral; success; warning; danger; info; accent; loading (pulse); offline.

**Keyboard behavior:** none.

**Focus management:** none.

**Responsive rules:** no change; pill text truncates with ellipsis.

**Accessibility:** never color-only — always a text label; `aria-label` for dot-only; `role="status"` for live regions; pulse animation disabled under reduced motion.

**Token usage:** `--pm-success`, `--pm-warning`, `--pm-danger`, `--pm-info`, `--pm-accent`, `--pm-text-muted`.

**Canvas usage:** task status badges, live sync indicator, connection state.
**Automation usage:** workflow state (draft/test/published/paused/archived), node state, execution outcome.

### 6.9 Toast

```ts
interface ToastItem {
  id: string;
  tone: "success" | "error" | "info" | "warning";
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: { label: React.ReactNode; onClick: () => void };
  duration?: number;   // default 4000; 0 = persistent
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  position?: "top-right" | "bottom-right" | "bottom-center";
  maxVisible?: number;   // default 3
}
```

**Variants:** success; error; info; warning; with-action; persistent.

**Interaction states:** entering (slide + fade); visible; exiting; paused (hover/focus); stacked.

**Keyboard behavior:** Escape dismisses topmost; Tab reaches close/action controls; focus moves into toast only when it has an action.

**Focus management:** no focus steal for passive toasts; focus close button when action present; return focus on dismiss.

**Responsive rules:** ≤780px — full-width bottom, stacked, max 3 visible.

**Accessibility:** `role="status"` (polite) for success/info; `role="alert"` (assertive) for error; `aria-live`; labelled close button; no color-only; duration ≥4000ms; persistent for errors; pause on hover/focus; respect reduced motion.

**Token usage:** `--pm-success`, `--pm-danger`, `--pm-warning`, `--pm-info`, `--pm-glass-strong`, `--pm-border`, `--pm-radius`, `--pm-shadow-float`, `--pm-z-popover`.

**Canvas usage:** save feedback, connection added/removed.
**Automation usage:** publish result, test run result, approval needed.

### 6.10 Empty

```ts
interface EmptyProps {
  icon?: IconName;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "inline" | "row" | "page";
  size?: "sm" | "md" | "lg";
}
```

**Variants:** inline → `.pm-empty-state`; row → `.pm-empty-row` (with action); page → `.pm-empty`; compact.

**Interaction states:** default only (loading uses `Loading`).

**Keyboard behavior:** action is a native button.

**Focus management:** none.

**Responsive rules:** padding scales; icon hides ≤780px.

**Accessibility:** text is real text (not icon); action button labelled; no `aria-live` needed.

**Token usage:** `--pm-text-secondary`, `--pm-text-muted`, `--pm-accent`, `--pm-radius-sm`.

**Canvas usage:** "Select an item to edit properties"; empty canvas.
**Automation usage:** "No executions yet"; "No workflows"; "No nodes selected".

### 6.11 Loading

```ts
interface LoadingProps {
  variant?: "skeleton" | "spinner" | "text";
  rows?: number;
  height?: number | string;
  width?: number | string;
  label?: string;
}
```

**Variants:** skeleton list → `.pm-skeleton-list`; skeleton signal → `.pm-signal-skeleton`; skeleton card → `.canvas-skeleton`; spinner; text → `.pm-loading-state`.

**Interaction states:** loading; indeterminate (never fabricated progress); error (switch to `Error`).

**Keyboard behavior:** none.

**Focus management:** none; `aria-busy` on the container.

**Responsive rules:** row count reduces ≤780px.

**Accessibility:** `aria-busy="true"` on the region; `aria-live="polite"` with label "Loading…"; skeleton markup `aria-hidden="true"`; never fake progress (design-system.md §8).

**Token usage:** shimmer uses token-derived white overlays, `--pm-radius-sm`, `--pm-ease-spring`, `--pm-duration-normal`.

**Canvas usage:** viewport skeleton, item loading.
**Automation usage:** workflow list skeleton, execution trace skeleton.

### 6.12 Error

```ts
interface ErrorProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "inline" | "state-card" | "page";
  tone?: "danger" | "warning";
  onRetry?: () => void;
  retryLabel?: string;
}
```

**Variants:** state-card → `.pm-state-card.pm-error-state`; inline (inline error blocks); page (canvas load error); warning (dependency cycle).

**Interaction states:** default; retrying (`aria-busy`); recovered.

**Keyboard behavior:** retry is a native button.

**Focus management:** focus error container (`role="alert"`, assertive) or move focus to it; return focus after recovery.

**Responsive rules:** padding scales.

**Accessibility:** `role="alert"` for errors; `role="status"` for warnings; descriptive text; no color-only; retry button labelled; ErrorBoundary fallback uses this component.

**Token usage:** `--pm-danger`, `--pm-warning`, `--pm-glass`, `--pm-border`, `--pm-radius-sm`.

**Canvas usage:** canvas load failure, item fetch failure.
**Automation usage:** execution failure, publish validation, connector errors.

---

## 7. Canvas vs Automation semantic separation

Project Canvas **visualizes** work. Automation Studio **executes approved workflow definitions**. They must never share a misleading name, a data model, or an implied execution engine (`UI_UX_REDESIGN_PLAN.md` §7, `handoff_future_uiux.md` §3).

| Concept | Project Canvas | Automation Studio |
|---|---|---|
| Surface | Infinite 2D canvas; pan/zoom; freeform placement | Node-graph workflow builder; directional flow; fixed grid |
| Connection | **Visual relationship** (line/arrow) between items | **Control flow** (trigger → transform → decision → action → gate) |
| Primitive | Item (shape, text, task card, line) | Node (trigger, transform, decision, action, human gate, error handler) |
| Selection | Item + properties inspector | Node + inspector + execution trace |
| Inspector | Geometry / style / content | Settings / input / output / validation / permissions |
| Task meaning | Task card is a **visual reference** to a task | Task event is a **trigger payload / action target** |
| Status | Selection / drag / save state | Workflow state (draft/test/published/paused/archived) + execution outcome |
| Empty | "Select an item to edit properties" | "No executions" / "No workflow selected" |
| Loading | Canvas/items skeleton | Workflow/execution skeleton |
| Error | Canvas load failure | Execution failure / publish validation |
| Dialog | Not used (inline properties) | Publish confirmation, approval gate, destructive confirm |
| Drawer | Not used | Execution history + step trace (non-modal) |
| Menu | TaskPicker listbox | Node library, workflow context menu |
| Toolbar | Canvas tool rail | Studio top bar + canvas tools |
| Toast | Save feedback | Test/publish result |
| Forbidden | "run", "execute", "trigger", control-flow wording | "shape", "canvas item", visual-relationship wording |

**Terminology rules (binding):**

1. Canvas uses **item / connection / shape / canvas / properties / place / link visually**.
2. Automation uses **node / flow / workflow / execution / run / trigger / branch / publish**.
3. Never use "task" as a Canvas primitive name — use **task card** (visual reference).
4. Never use "run"/"execute" in Canvas contexts.
5. Automation must always display draft/test/published state and never imply live execution without the backend runtime (`handoff_future_uiux.md` hard rule).
6. Shared components (Button, Panel, Inspector, Toolbar, Status, Toast, Empty, Loading, Error, Menu, Dialog, Drawer) are reused by both surfaces — but their **content, labels, icons, and consequences** must differ.
7. Visual similarity is allowed; semantic conflation is not.

---

## 8. Implementation priorities

### P0 — Foundation (blocks everything)

| # | Component / work | Depends on | Consumers | Effort | Acceptance |
|---|---|---|---|---|---|
| P0-1 | Token additions + overlay stack | none | all | S | All `--pm-z-*` / `--pm-focus-*` / `--pm-duration-*` tokens defined; no hardcoded z-index outside tokens |
| P0-2 | `Button` + `Panel` | P0-1 | CanvasToolbar, DesignToolbar, topbars, all pages | M | All `.pm-button*` composition replaced; single variant/size API |
| P0-3 | `Dialog` + FocusTrap + scroll lock | P0-1 | TaskWorkspace, UserFormDialog, TaskForm, ChecklistForm, DependencyForm, Projects | M | Escape closes; focus trapped + restored; backdrop dismiss consistent |
| P0-4 | `Status` + `Empty` + `Loading` + `Error` | P0-1 | Canvas, Automation, all pages | M | Unified tone/variant API; no inline state markup |
| P0-5 | `Toast` provider | P0-1 | Users, Connectors, ImportExport | S | Inline toasts removed; role=alert/status correct |

### P1 — Work surfaces

| # | Component / work | Depends on | Consumers | Effort | Acceptance |
|---|---|---|---|---|---|
| P1-1 | `Menu` (menu + listbox modes) | P0-2, P0-3 | ProjectSwitcher, TaskPicker, ContextMenu, ThemeMenu | M | Arrow-key nav, typeahead, focus return, aria roles |
| P1-2 | `Toolbar` | P0-2 | CanvasToolbar, DesignToolbar, `.pm-task-toolbar`, `.pm-canvas-tools` | M | `role=toolbar`, roving tabindex, `aria-pressed` toggles |
| P1-3 | `Inspector` | P0-2, P0-4 | Canvas `PropertiesPanel`, AutomationStudio inspector | L | One component; tabs + sections; responsive |
| P1-4 | `Drawer` | P0-3 | AutomationStudio execution drawer | M | Non-modal bottom; responsive; labelled |
| P1-5 | Canvas keyboard operability | P0-2 | CanvasViewport, CanvasItem | L | Select, arrow-nudge, Delete, Escape, zoom via keyboard |
| P1-6 | AutomationStudio a11y pass | P1-1, P1-2, P1-3 | AutomationStudio | M | tablist, node arrow nav, live regions |

### P2 — Hardening

| # | Component / work | Depends on | Consumers | Effort | Acceptance |
|---|---|---|---|---|---|
| P2-1 | Error boundaries + Suspense | P0-4 | App root | S | ErrorBoundary renders `Error` |
| P2-2 | Command registry | P0-2 | AppShell palette, DesignToolbar | M | Ctrl+K + shortcuts centralized |
| P2-3 | Reduced-motion per-component tokens | P0-1 | all | S | All motion collapses under reduced motion |
| P2-4 | Dead CSS + undefined class cleanup | P0-2 | index.css | S | 58 unused + 14 undefined classes resolved |
| P2-5 | Remove unused `dnd-kit` (or adopt) | P1-5 | package.json | S | Dependency audit clean |

**Phase mapping** (per `UI_UX_REDESIGN_PLAN.md` §9): P0 = Phase 1 Foundation + start of Phase 2; P1 = Phases 2–3 work surfaces; P2 = Phases 4–6 validation/hardening. Automation Studio UI work (P1-3/P1-4/P1-6) must follow the backend automation contract (Phase 4) before any publish path.

---

## 9. Acceptance criteria & verification checklist

**Component contract**
- [ ] Every existing consumer migrated; no `.pm-button*` class composition outside `Button`.
- [ ] Every overlay uses token z-index; no hardcoded z-index values.
- [ ] Every interactive element has a visible focus ring (`--pm-focus-ring`).
- [ ] No hardcoded colors outside tokens (audit `ConnectionLine`, `DraggableElement`, `Users`, `RegisterForm`).

**Focus & keyboard**
- [ ] Focus trap + focus return verified in every Dialog and modal Drawer.
- [ ] Escape closes the topmost overlay only.
- [ ] Keyboard-only pass: canvas select/move/delete; automation node navigate/configure/publish.
- [ ] Menus support ArrowUp/Down, Home/End, Enter/Space, Escape, typeahead.
- [ ] Tabs support ArrowLeft/Right and `role=tablist`.

**Accessibility**
- [ ] axe/Lighthouse: no critical violations.
- [ ] Contrast WCAG AA across all six themes.
- [ ] Toasts: `role=status` / `role=alert` correct; errors persistent.
- [ ] Status never color-only.
- [ ] Reduced motion: all animations disabled.

**Responsive**
- [ ] Breakpoints 1120 / 850 / 780 verified.
- [ ] No horizontal scroll except tables.
- [ ] Drawer/dialog become sheets ≤780px.

**Engineering**
- [ ] `npm run typecheck` and `npm run build` pass (frontend).
- [ ] `tsc --noEmit` + backend tests pass (if backend touched).
- [ ] Automation preview still clearly non-functional (no implied runtime).
- [ ] Canvas vs Automation terminology audit passes.

---

## Appendix A — Existing class family → proposed component mapping

| Existing class family | Proposed component |
|---|---|
| `.pm-button*`, `.pm-primary-button`, `.pm-secondary-button`, `.pm-compact-button`, `.pm-text-button`, `.pm-icon-button` | `Button` |
| `.pm-glass-panel`, `.pm-panel-heading`, `.pm-panel-header`, `.pm-focus-panel`, `.pm-attention-panel`, `.pm-activity-panel` | `Panel` |
| `.pm-dialog-backdrop`, `.pm-task-dialog`, `.pm-dialog*`, `.pm-form-grid`, `.pm-field`, `.pm-inline-error` | `Dialog` |
| `.pm-popover-backdrop`, `.pm-theme-menu`, `.pm-command-*`, `.pm-project-switcher-menu`, `ContextMenu` | `Menu` |
| `.pm-filter-tabs`, `.pm-task-toolbar`, `.pm-canvas-tools`, `.pm-top-actions`, `CanvasToolbar`, `DesignToolbar` | `Toolbar` |
| `.pm-status*`, `.pm-priority-dot`, `.pm-live-marker`, `.pm-data-status`, `.pm-future-tag`, `.pm-draft-tag` | `Status` |
| inline toast blocks | `Toast` |
| `.pm-empty`, `.pm-empty-state`, `.pm-empty-row` | `Empty` |
| `.pm-skeleton-list`, `.pm-signal-skeleton`, `.canvas-skeleton`, `.pm-loading-state` | `Loading` |
| `.pm-state-card.pm-error-state`, inline error blocks | `Error` |
| `PropertiesPanel`, `.pm-node-inspector` | `Inspector` |
| `.pm-execution-drawer` | `Drawer` |

## Appendix B — Undefined class names (must be fixed)

`pm-dialog`, `pm-status-pill`, `pm-priority`, `pm-task-check`, `pm-table-actions`, `pm-task-table-wrap`, `pm-task-picker-option`, `pm-properties-panel`, `pm-task-card`, `pm-canvas-viewport`, `pm-canvas-zoom-indicator`, `pm-signal-panel`, `pm-input`, `design-canvas-bg`.

## Appendix C — Accessibility matrix (existing)

| Component | role / aria | Keyboard | Focus management |
|---|---|---|---|
| `ProjectSwitcher` | menu, haspopup, expanded, controls | Escape, Arrows, Home/End | Focus selected; returns focus |
| `TaskPicker` | listbox, haspopup, expanded, controls, selected | Tab/Enter only | autoFocus search |
| `ContextMenu` | none | Escape | none |
| `CommandPalette` | dialog, modal, label | Arrows, Enter, Escape | autoFocus input |
| `ThemeMenu` | dialog, modal, label | Escape (global) | none |
| `TaskCard` | button | Enter/Space | tabIndex 0 |
| Dialogs (6) | dialog, modal, labelledby | Tab/Enter | none |
| `CanvasViewport` / `CanvasItem` | none | none | none |
| `AutomationStudio` nodes | none | Tab/Enter | none |

---

**End of catalog.** Prepared for PM-P2-05. No application source was modified.
