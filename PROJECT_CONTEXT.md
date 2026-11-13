# Project Manager — Context Summary

## Purpose
Complete context for any new Hermes session to understand the current state of the
Project Manager project. Injected automatically by the `pre_llm_call` shell hook
when a new chat asks to continue/resume this project.

---

## Project Overview

**Name:** Project Manager — multi-project management tool (local-first, web-hostable)
**Owner:** Sethea Oudom Soy (CTO-side stakeholder)
**Workspace:** `<workspace>\`
**Git branch:** `main` (local only, no remote)
**Vision:** A local-first, web-hostable multi-project management tool with AI-agent integration.

---

## Technology Stack (Verified)

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v26.7.0 (user PATH) / v26.12.1 (Hermes tools) |
| Frontend | React 19 + TypeScript + Vite 6 + Tailwind CSS 4 |
| Backend | Express 4 + TypeScript (tsx) |
| Database | SQLite (WAL mode, `node:sqlite` `DatabaseSync`) |
| AI | Gemini AI (future) |
| Auth | JWT Bearer tokens + RBAC (owner, editor, viewer, commenter) |

---

## Project Structure (Confirmed)

```
Project Manager/
├── frontend/                  # React 19 + TS + Vite + Tailwind
│   ├── src/
│   │   ├── components/        # layout, ui, projects, tasks, canvas, connectors, ...
│   │   ├── pages/             # Route pages
│   │   ├── theme/             # ThemeProvider.tsx (glass theme engine)
│   │   ├── hooks/             # useAuth, useCanvas, ...
│   │   ├── types/             # Shared frontend types (index.ts)
│   │   ├── App.tsx            # Auth-gated content
│   │   ├── main.tsx           # React entry (single router + providers)
│   │   └── index.css          # Global styles (66 KB, pm-* tokens)
│   ├── vite.config.ts         # Vite config (root, HMR)
│   ├── tailwind.config.js     # Tailwind content paths (absolute)
│   └── postcss.config.js      # PostCSS → Tailwind
├── backend/                   # Express + TS
│   ├── src/
│   │   ├── server.ts          # Unified Express + Vite middleware server
│   │   ├── index.ts           # Legacy Express app (API only)
│   │   ├── database/          # schema.sql, index.ts, migrate.ts
│   │   ├── routes/            # auth, tasks, checklists, dependencies, canvas, connectors, ...
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # auth.middleware.ts, rateLimiter.ts
│   │   └── tests/             # backend.test.ts
│   └── data/app.db            # SQLite database (WAL mode)
├── docs/                      # Documentation
├── scripts/                   # Build & deployment scripts
├── tests/                     # Test cases
├── design-system.md           # UI/UX design system (36 sections, 49 KB)
├── UI_UX_PROGRESS.md          # UI/UX redesign progress tracker
├── PRD.md, KANBAN_BOARD.md    # Superseded — pointer files only
├── ROADMAP.md                 # Roadmap & status (authoritative narrative)
├── CHECKLIST.md               # Achievement checklist
├── SCHEMA.md                  # Database schema doc
├── TECH_STACK.md              # Tech stack spec
├── memory.md                  # Project memory
├── rules.md                   # Development rules & conventions
├── team.md                    # Team roster
└── HANDOVER-CORRECTED.md      # Latest hand-over (2026-11-08)
```

---

## Current State (Live Kanban, verified 2026-11-13)

**Board totals:** **118 done · 0 open** (118 further cards archived historically)

| Phase | Name | Status |
|---|---|---|
| Phase 0 | Blueprint | ✅ DONE |
| Phase 1 | Discovery, Authority & Scope Baseline | ✅ DONE |
| Phase 2 | Shared Architecture, Security & Design System | ✅ DONE |
| Phase 3 | Project Canvas Specification | ✅ DONE |
| Phase 4 | Automation Studio Specification & Runtime Boundary | ✅ DONE |
| Phase 5 | Integrated Validation & Final Design Handoff | ✅ DONE |
| Phase 6 | Shared Foundation & Project Canvas Implementation | ✅ DONE |
| Phase 7 | Automation Studio Runtime & Builder Implementation | ✅ DONE |
| Phase 8 | Integrated QA, Release & Final Acceptance | ✅ DONE |

**Open work: none.** The defect register is empty — QA013-D0 and D2 were fixed in
`a923c75`, and QA013-D1 was resolved as accepted-as-designed (soft archive is
intentional; the acceptance text was amended).

**Verified gates (2026-11-13):** backend typecheck rc=0 · backend build rc=0 ·
backend tests 185/185 · frontend typecheck rc=0 · frontend build rc=0 · live DB
migrations 0→4 with 0 FK violations.

**Non-board follow-ups:** no `DELETE /api/users` route (§6.6 marks user-delete as
required); `environment.service.ts` writes `workflow.*` audit actions instead of
`environment.*`; `main` has no git remote.

---

## UI/UX Glass Redesign (Locked Owner Decisions)

1. **Default Theme:** Obsidian Signal — graphite-black glass (`#080B11` / `#090B0F`,
   never navy) with crystal-bright-blue accent (`#54C8FF`).
2. **Full Glassmorphism System:** translucent frosted glass panels
   (`backdrop-filter: blur(22px) saturate(142%)`), 1px translucent borders, inset
   specular highlights, ambient light orbs.
3. **Theme & Color Customization:** 6 presets (crystal/Obsidian Signal default,
   violet/Carbon Orchid, aurora/Aurora Mint, ember/Forge Amber, emerald/Emerald
   Circuit, porcelain/Porcelain Glass) + custom `#RRGGBB` hex picker persisted in
   `localStorage` (`pm-theme-preference-v2`).
4. **Design Mode Excluded from Main Workspace:** visual free-placement lives only in
   Project Canvas and Automation Studio.
5. **Strict Canvas Separation:** Project Canvas (`/canvases`, `/canvas/:id`,
   `/api/canvas`) vs Automation Studio (`/automation`, preview-only until backend
   runtime is authorized).

**Progress:** UIUX-001..UIUX-010 all DONE. Tracker: `UI_UX_PROGRESS.md`.

---

## Working Process (Standing)

1. One Kanban card at a time.
2. Decompose into ≤3 files per step.
3. Verify with `npm run typecheck` (`tsc --noEmit`, exit 0) in `frontend/`.
4. Update `UI_UX_PROGRESS.md` (for UI/UX work).
5. Commit — requires explicit owner approval.

---

## Development Rules (Standing)

- **Separation:** Project Manager is 100% separate from CDES Student Instructor V1.2.0
  (historical, must NOT be modified). Zero shared artifacts.
- **Approval gates:** No irreversible changes (DB, env, commits, history rewrite,
  credentials) without explicit owner approval.
- **Evidence-only:** Report what real execution returned; no fabricated output.
- **One topic at a time:** sequential Q&A; 5-item status briefs when requested.
- **Escalation:** security → owner immediately; blocked/time/quality → CEO with evidence.

---

## Known Issues / Risks

- Backend build TS5096 (`allowImportingTsExtensions` requires `noEmit`) — recorded in
  `PHASE6_IMPLEMENTATION_BASELINE.md`.
- MC-006 RBAC enforcement failed QA (viewer writes succeeded despite documented
  matrix) — remediation card `t_10b90995`.
- Kanban worker harness instability (rate limits, `Kanban owner refused`,
  `managed_worker_failed`) — retry loops observed.
- Terminal tool hits `0xC0000142` fork errors on Windows — use `execute_code`
  (Python) for file I/O.

---

## Document Authority

- **Status authority:** the live Kanban board (`kanban.db`) is the source of truth.
- **Reconciled 2026-11-13:** `ROADMAP.md`, `CHECKLIST.md`, `THINK.md` and
  `ProjectManager.md` were rewritten against the live board. `PRD.md` and
  `KANBAN_BOARD.md` are superseded pointer files.
- **UI/UX:** `UI_UX_PROGRESS.md`.
- **Never trust a doc over the live board.**

---

## Key Files to Know

| File | Purpose |
|---|---|
| `backend/src/server.ts` | Unified Express + Vite middleware server |
| `backend/src/database/schema.sql` | DB schema |
| `backend/src/database/index.ts` | SQLite connection (`DatabaseSync`) |
| `frontend/src/main.tsx` | React entry (single router + providers) |
| `frontend/src/App.tsx` | Auth-gated content |
| `frontend/src/types/index.ts` | Shared frontend types |
| `frontend/src/theme/ThemeProvider.tsx` | Glass theme engine |
| `frontend/src/index.css` | Global styles (`pm-*` tokens) |
| `UI_UX_PROGRESS.md` | UI/UX redesign tracker |
| `design-system.md` | UI/UX design system |
| `rules.md` | Development rules |
| `HANDOVER-CORRECTED.md` | Latest hand-over |

---

## Environment Setup

| Item | Value |
|---|---|
| Hermes root | `<USER>\AppData\Local\hermes` |
| Node (Hermes) | `<USER>\AppData\Local\hermes\tools\node-26.12.1-win32-x64\node.exe` |
| npm (Hermes) | `<USER>\AppData\Local\hermes\tools\npm-12.0.2-win32-x64\npm.cmd` |
| Git (Hermes) | `<USER>\AppData\Local\hermes\tools\git-2.53.0+3-win32-x64\cmd\git.exe` |
| DB file | `backend/data/app.db` (SQLite, WAL mode) |
| Install | `npm run install:all` |
| Migrate | `npm run db:migrate` |
| Dev | `npm run dev` (or `start-dev.bat`) |
| Typecheck (frontend) | `npm run typecheck` |
