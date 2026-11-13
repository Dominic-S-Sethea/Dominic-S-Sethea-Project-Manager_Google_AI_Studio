# Hand-off Prompt — Project Manager: Future UI/UX Development

Paste the block below into a new chatbox to hand over future development of **Project Canvas** and **Automation Studio** UI/UX.

---

## 1. Project context

- **Project:** Project Manager — a local-first, web-hostable multi-project management tool with AI-agent integration.
- **Workspace:** `<workspace>\`
- **Separation:** 100% separate from CDES Student Instructor V1.2.0. No shared resources. Do NOT touch/modify anything under Student-Instructor-V1.2.0.
- **User:** Sethea Oudam Soy — project owner (approval authority).

### Tech stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind → migrated to Obsidian Signal glass tokens.
- **Backend:** Express + TypeScript, SQLite via `node:sqlite` (`backend/src/database/index.ts` uses `node:sqlite`).
- **Type-safe checks:** `npm run typecheck` (tsc --noEmit) and `npm run build` (tsc && vite build) — must both exit 0.
- **Dev servers:** backend on port **3000** (`cd backend && npm run dev`), frontend on port **5173** (`npx vite --port 5173 --host 0.0.0.0`).
- **Auth:** token stored in `localStorage` key `pm_token`; `Authorization: Bearer ***` header. Use `getToken()` from `frontend/src/hooks/useAuth.tsx`.

---

## 2. Current state (what is already done)

| Area | Status |
|---|---|
| Obsidian Signal Glass migration | 17 components migrated across 6 batches; all `--pm-*` glass classes in use; no Tailwind color classes remaining. |
| Frontend verification | `npm run typecheck` exit 0; `npm run build` exit 0. |
| Backend | `tsc --noEmit` exit 0; 15/15 backend tests pass. |
| Project Canvas (EX-001..EX-004) | Implemented — planning/diagramming canvas (`canvases`, `canvas_items`, `canvas_connections` tables; full CRUD + connections API + `useCanvas` hook). |
| Automation Studio | **Design preview only.** Frontend `AutomationStudio.tsx` is a mock: "no runtime connected", "Draft · test only", Publish disabled. No backend runtime exists. |

### Key project files (do not lose these)

- **Design system / scope:** `design-system.md`, `UI_UX_REDESIGN_PLAN.md`, `UI_UX_PROGRESS.md`
- **Scope docs:** `PRD.md`, `KANBAN_BOARD.md`, `ROADMAP.md` (ROADMAP is stale — treat PRD/Kanban as current)
- **Backend:** `backend/src/database/schema.sql` (canvases, canvas_items, canvas_connections), `backend/src/routes/canvas.routes.ts`, `backend/src/services/canvas.service.ts`, `backend/src/routes/tasks.routes.ts`, `backend/src/middleware/auth.middleware.ts`, `backend/src/middleware/agentAuthMiddleware.ts`
- **Frontend:** `frontend/src/types/canvas.ts`, `frontend/src/hooks/useCanvas.ts`, `frontend/src/pages/CanvasList.tsx`, `Canvas.tsx`, `AutomationStudio.tsx`, `frontend/src/components/canvas/*`, `frontend/src/components/design/*`
- **Design tokens:** `--pm-accent`, `--pm-text-muted`, `--pm-border`, `--pm-bg`, `--pm-glass`, `--pm-canvas` plus six theme presets (Obsidian Signal Glass default #080B11/#54C8FF, Prism Violet, Aurora Teal, Forge Amber, Juniper, Porcelain). Six preset persisted via `localStorage key pm-theme-preference-v2`.

---

## 3. Future scope: two distinct product areas (must stay separate)

### 3.1 Project Canvas — existing feature (done, extend only)
A flexible visual planning/diagramming environment. Scope: canvas navigation/zoom/pan, shape + task components, connections, properties panel, selection states, complexity management. **Do not turn it into an execution engine.**

### 3.2 Automation Studio — future feature (not started)
An executable workflow system. Current frontend is a **preview only — no backend automation runtime exists**. Scope (per `UI_UX_REDESIGN_PLAN.md` §7): workflow node library, directional connections + decision branches, node configuration inspector, execution history + step traces, approval gates + permission states, draft/test/published/paused/archived states.

**Hard rule:** never imply Automation Studio has a functioning runtime in any design, mockup, prototype, or screenshot.

---

## 4. Ground rules

1. **Evidence only.** Before any design decision, read the actual files. Do not assume based on stale docs (the roadmap `ROADMAP.md` is stale — PRD/Kanban are current).
2. **Design-system-first.** Establish standards before producing many screens. No design-breaking change without owner review.
3. **No design-system breaking change** without explicit owner approval.
4. **No frontend implementation before the relevant design is approved.**
5. **No live automation behavior presented as functional** until the backend runtime exists.
6. **No secrets/credentials/sensitive execution data** in any design or mockup. Credentials live in `connectors` table; never render secrets in logs/canvas/exports/screenshots.
7. **Keep the Canvas vs. Automation semantic boundary:** canvas connection = visual relationship; automation connection = workflow control flow. Different icons/terms even if visually similar.
8. **One topic at a time.** Work in small, reviewable stages. Explain each stage before proceeding.
9. **No irreversible changes** (DB schema, env, credentials, documented decisions) without explicit owner approval.
10. **Preserve the six `--pm-*` tokens** as the single source of truth. Map to documented tokens; do not create a competing system.

---

## 5. Delivery principles

- Build a **design-system-first workflow** (audit → tokens → components → feature UX → prototype → handoff → QA), not a "screens soon" approach.
- Preserve existing visual language and components; improve/standardize rather than generate an unrelated new design.
- Use **one tool per responsibility**: ChatGPT (design strategy, docs, feasibility, review), MagicPath/HTML (visual exploration + clickable prototypes), Figma (final asset spec), Hermes/Codex (implementation after approval).
- Label every gate that requires human approval explicitly.
- Verify at each stage: `npm run typecheck` and `npm run build` pass (frontend), backend `tsc --noEmit` + tests pass.

---

## 6. Human decision gates (who approves)

| Decision | Who approves |
|---|---|
| Global design direction | Owner |
| Major design-system changes | Owner |
| Feature UX requirements | Owner |
| Final feature designs | Owner |
| Frontend implementation release | Owner |
| Live automation publishing | Authorized owner |

---

## 7. Recommended starting point

Do **not** start by redesigning screens. First:

1. Assess the existing design system and frontend components.
2. Identify existing design tokens, theme presets and component variants.
3. Audit Project Canvas and the Automation Studio preview.
4. Identify inconsistencies, duplicated patterns, and accessibility problems.
5. Determine which components to preserve, improve, or replace.
6. Propose the design-system architecture.
7. Produce a prioritized implementation plan.

Deliverables: existing UI/UX audit, design-token inventory, component inventory, UX issues + recommendations, proposed design-system structure, shared component architecture, feature-specific design requirements, accessibility requirements, design QA + approval process.

---

## 8. Open questions to resolve during the audit

- What existing component states are duplicated or inconsistent?
- Accessibility gaps (contrast, keyboard nav, focus visibility) in canvas/inspector/views?
- The stale `ROADMAP.md` vs. current PRD/Kanban — confirm the current source of truth with the owner before finalizing scope.
- Whether Automation Studio first needs a backend API contract (workflow nodes, executions, approvals) **before** the UI — recommend yes.

---

## 9. Evidence appended

For reference, the key audit evidence already gathered:
- Backend canvas API + DB schema (see §2).
- `useCanvas` hook + `types/canvas.ts` (CanvasItem `item_type` union, `CanvasTool` union, `CanvasItemStyle`, connections).
- `AutomationStudio.tsx` exists but is a preview-only mock.
- Design tokens: `--pm-*` CSS vars + six presets.

Continue only after the owner approves this hand-off and clears any open questions.
