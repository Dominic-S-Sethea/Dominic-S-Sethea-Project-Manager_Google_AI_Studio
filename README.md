# Project Manager

Multi-project management tool for managing Project Manager and future projects.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express + TypeScript (REST API)
- **Database**: SQLite (local-first, env-configurable path, WAL mode)

## Programme Status — all 8 phases complete

| Gate | Status |
|---|---|
| PB-001 Initialize git repo | ✅ Done |
| PB-002 Install dependencies | ✅ Done |
| PB-003 Setup SQLite database | ✅ Done |
| PB-004 Create folder structure | ✅ Done |
| PB-005 Configure ESLint + Prettier | ✅ Done |
| PB-006 Configure CI/CD pipeline | ✅ Done |
| MC-001 → MC-009, MC-013 | ✅ Done |
| MC-011 Export (via IE-001/IE-002) | ✅ Done |
| VP-003 → VP-005 | ✅ Done |
| EX-001 → EX-004 | ✅ Done |
| DM-001 → DM-004 | ✅ Done |
| Phases 0–8 | ✅ Complete |

Board: **118 done · 0 open** (verified 2026-11-13). The live Kanban board is the
status authority — see `ROADMAP.md` for the narrative.

## Getting Started
1. Copy `.env.example` to `.env` and fill in your values.
2. Install dependencies: `npm run install:all`
3. Run database migrations: `npm run db:migrate`
4. Start dev servers: `npm run dev`

## Git notes
- This repo is dedicated to **Project Manager** only.
- CDES Student Instructor V1.2.0 lives in a separate repo — do not commit into it.
- No irreversible changes (DB, env, commits) without owner approval.
