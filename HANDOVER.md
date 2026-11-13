# HAND-OVER: Project Manager — Session 2026-11-07

> **Purpose:** Complete hand-over prompt for a NEW chat session to continue this project.
> **From:** Session that built the Instant UI/UX unified architecture.
> **Verified against:** git log, git status, file system on 2026-11-07.

---

## 1. PROJECT IDENTITY

| Field | Value |
|---|---|
| **Project** | Project Manager — multi-project management tool (local-first, web-hostable) |
| **Workspace** | `<workspace>\` |
| **Git branch** | `main` |
| **Remote repo** | Dominic-S-Sethea/Student-Instructor-V1.2.0.git (canonical: `student-audit` workspace) |
| **Tech stack** | React 19 + TS + Vite + Tailwind (frontend) · Express + TS (backend) · SQLite via `node:sqlite` · Gemini AI (future) |
| **Owner** | Sethea Oudam Soy (CTO-side stakeholder) |

### CRITICAL SEPARATION RULES (standing)
- Project **"CDES Student Instructor V1.2.0"** is COMPLETE and MUST NOT be modified.
- Zero shared memory, data, source code, or resources with CDES Student Instructor V1.2.0.
- All work is exclusively for **Project Manager**.

### Standing rules (owner's hard gates)
1. **No irreversible change without explicit approval** (DB, env, commits, pushes, history rewrite, credentials).
2. One topic at a time, sequential Q&A; 5-item status briefs when requested.
3. Evidence-only, no fabricated output. Never assume when unclear — ask first.
4. Aesthetic preference: "Clean and sharp" / "Elite" theme.

---

## 2. WHAT WAS ACCOMPLISHED (this session)

### A. MVP Core features — committed
| Card | Feature | Commits |
|---|---|---|
| MC-001 | Project CRUD (backend service/routes + frontend UI) | `d850fdc` |
| MC-002 | Task CRUD (status, priority, due date, assignee) | `eff5a97` / `3e99e41` |
| MC-003 | Checklist CRUD (items inside tasks) | `435351c`, `a16e493`, `1a1bfd7` |
| MC-004 | Dependency management (blocks / blocked-by) | `841cbb7`, `421180f` |
| MC-013 | MVP acceptance tests + `/api/auth/register` endpoint | `1d75e4c`, `50564ec`, `de24788` |

### B. Instant UI/UX unified architecture — UNCOMMITTED (see §4)
Per the document `<USER>\Downloads\Instant_UI_UX_Architecture_Guide.docx`:
- **Unified server**: Express mounts Vite in middleware mode → ONE process, ONE port (3000).
- Frontend + API served from `http://localhost:3000`.
- Vite HMR → edit any `.tsx` → browser auto-refreshes (no `npm run build`, no manual refresh).
- CORS eliminated (same origin).

**Files created/modified for this:**
- `backend/src/server.ts` (NEW, untracked) — unified Express + Vite middleware server
- `backend/src/database/index.ts` — `DatabaseSync` import (Node v26.7.0 compat)
- `backend/src/database/migrate.ts` — removed non-existent `initDatabase` import
- `frontend/vite.config.ts` — added `root`, HMR config
- `frontend/postcss.config.js` — explicit tailwind config path (absolute)
- `frontend/tailwind.config.js` — absolute content paths
- `frontend/src/main.tsx` — single router, wildcard route, AuthProvider
- `frontend/src/App.tsx` — removed nested `<Routes>` (was causing router warning)
- `frontend/src/types/index.ts` (NEW, untracked) — shared frontend types
- `frontend/src/pages/Login.tsx` — fixed import paths
- `frontend/src/pages/Projects.tsx` — uses shared types
- `frontend/src/components/*` — backend imports replaced with local types
- `backend/package.json` — added tailwindcss/postcss/autoprefixer devDeps
- `start-dev.bat` / `start-dev.ps1` (NEW, untracked) — double-click launcher

### C. Bugs found & fixed this session
1. **Double router conflict** — `main.tsx` + `App.tsx` both had `<Routes>` → fixed (single router in main.tsx).
2. **AuthProvider not wrapping routes** → fixed (wraps `<Routes>` in main.tsx).
3. **Frontend importing backend types** (`../../../backend/src/services/...`) → replaced with `src/types/index.ts`.
4. **`useAuth` not imported** in App.tsx → fixed.
5. **Wrong relative import paths** in Login.tsx (`../../` vs `../`) → fixed.
6. **`node:sqlite` named export `Database` missing** on Node v26.7.0 → switched to `DatabaseSync`.
7. **`initDatabase` not exported** in migrate.ts → fixed.
8. **Tailwind utilities not generated** (content paths resolved against backend CWD) → absolute paths + explicit postcss config.
9. **Vite 404 handler blocking frontend** → scoped 404 to `/api/*` only.

---

## 3. HOW TO RUN (verified working)

### Option A — Double-click (easiest)
Double-click `start-dev.bat` in the project root → opens server + browser at `http://localhost:3000`.

### Option B — One command
```cmd
cd "<workspace>\backend"
npm run dev
```
Then open `http://localhost:3000`.

### What works right now
| Check | Status |
|---|---|
| Port 3000 listening | ✅ (when server running) |
| Frontend HTML (React + Vite HMR) | ✅ |
| Tailwind CSS utilities | ✅ (all classes generated) |
| API `/health` | ✅ `{"status":"ok","database":"connected"}` |
| Login UI | ✅ renders styled |

### Known environment limitations
- **Windows fork error 0xC0000142**: the Hermes CLI cannot spawn persistent background servers. The server must be started by the user (CMD or `start-dev.bat`).
- **Node version mismatch**: user's PATH node is v26.7.0 (no `Database` export); Hermes-managed node is v26.12.1. Code now uses `DatabaseSync` which works on both.

---

## 4. UNCOMMITTED WORK — needs decision

`git status` shows **15 modified + 4 untracked** files (all the Instant UI/UX work in §2B):

```
 M backend/package.json, backend/package-lock.json
 M backend/src/database/index.ts, backend/src/database/migrate.ts
 M frontend/package.json, frontend/package-lock.json
 M frontend/postcss.config.js, frontend/tailwind.config.js, frontend/vite.config.ts
 M frontend/src/App.tsx, frontend/src/main.tsx
 M frontend/src/pages/Login.tsx, frontend/src/pages/Projects.tsx
 M frontend/src/components/{projects,tasks,dependencies}/*
?? backend/src/server.ts
?? frontend/src/types/
?? start-dev.bat, start-dev.ps1
```

**Next session should:** ask the owner whether to commit these (per standing rule #1 — commits need explicit approval). Suggested commit message: `Instant UI/UX: unified Vite middleware architecture + Tailwind fixes`.

---

## 5. ROADMAP STATUS

| Phase | Name | Status |
|---|---|---|
| 0 | Blueprint (PRD/SCHEMA/TECH_STACK/RULES) | ✅ Done |
| 1 | Core MVP (toolchain, DB, login/auth, Docker, security) | ✅ Done (`3c0e0a2`) |
| 2 | Views & Power (VP-001..VP-005) | ⏳ Pending |
| 3 | Extras: Custom Canvas (EX-001..EX-004) | ⏳ Pending |
| 4 | Deployment & Monitoring (DM-001..DM-004) | ⏳ Pending |

**MVP Core (MC-001..MC-013)**: 5 of 9 cards done & committed (MC-001, 002, 003, 004, 013). Remaining: MC-005 (comments), MC-006 (RBAC), MC-007 (audit log), MC-008 (agent auth), MC-009 (approval flow), MC-010 (multi-provider AI), MC-011 (export), MC-012 (offline sync).

**Roadmap progress: ~39% (11/28 gates).**

---

## 6. NEXT SESSION — START HERE

1. **Read this file** (`HANDOVER.md`).
2. **Verify state**: `git -C "<workspace>" log --oneline -5` and `git status`.
3. **Ask the owner**: commit the uncommitted Instant UI/UX work? (needs explicit approval)
4. **Then continue**: next recommended card is **MC-005 (Comments on tasks)** or **VP-001 (User profile + access tracking)** — ask the owner which.
5. **Do NOT** touch anything under CDES Student Instructor V1.2.0.

---

## 7. KEY FILE LOCATIONS

| File | Purpose |
|---|---|
| `backend/src/server.ts` | Unified Express + Vite middleware server (entry point) |
| `backend/src/index.ts` | Legacy Express app (API only) — kept for reference |
| `backend/src/database/index.ts` | SQLite connection (`DatabaseSync`) |
| `backend/src/routes/*.ts` | API routes (auth, tasks, checklists, dependencies) |
| `backend/src/services/*.ts` | Business logic services |
| `frontend/src/main.tsx` | React entry — single router + providers |
| `frontend/src/App.tsx` | Auth-gated content |
| `frontend/src/pages/Login.tsx` | Login page |
| `frontend/src/pages/Projects.tsx` | Projects page (tabs: tasks/checklists/dependencies) |
| `frontend/src/types/index.ts` | Shared frontend types |
| `frontend/vite.config.ts` | Vite config (root, HMR) |
| `frontend/postcss.config.js` | PostCSS → Tailwind (explicit config path) |
| `frontend/tailwind.config.js` | Tailwind content paths (absolute) |
| `start-dev.bat` | Double-click launcher |
| `ROADMAP.md`, `CHECKLIST.md` | Planning documents |

---

## 8. ENVIRONMENT FACTS

| Fact | Value |
|---|---|
| Hermes root | `<USER>\AppData\Local\hermes` |
| Node (Hermes) | `<USER>\AppData\Local\hermes\tools\node-26.12.1-win32-x64\node.exe` |
| npm (Hermes) | `<USER>\AppData\Local\hermes\tools\npm-12.0.2-win32-x64\npm.cmd` |
| Git | `<USER>\AppData\Local\hermes\tools\git-2.53.0+3-win32-x64\cmd\git.exe` |
| User's PATH node | v26.7.0 (use `DatabaseSync`, not `Database`) |
| DB file | `backend/data/app.db` (SQLite, WAL mode) |
| Terminal quirk | `terminal` tool hits 0xC0000142 fork errors on Windows — use `execute_code` (Python) for file I/O; start servers via user's CMD/`start-dev.bat` |

---

*Hand-over prepared 2026-11-07. Verify all facts before acting — do not trust this document blindly.*
