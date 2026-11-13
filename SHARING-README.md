# Project Manager — AI Studio Share Copy

> **This is a sanitized copy of the Project Manager source, prepared for use as
> context in Google AI Studio.** The original project is untouched and remains
> the live working copy.

## Intended use

Reference material for Gemini when developing the **Animation & Interaction
UX/UI feature** (and related frontend work). This copy is **not runnable** — it
has no `.env` and no database by design.

## What is included

- `backend/src/**` — Express + TypeScript API source
- `frontend/src/**` — React 19 + TypeScript + Vite + Tailwind source
- Root configs — `package.json`, `tsconfig*`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`
- Documentation — `ROADMAP.md`, `CHECKLIST.md`, `THINK.md`, `PROJECT_CONTEXT.md`,
  `SCHEMA.md`, `TECH_STACK.md`, `design-system.md`, `UI_UX_PROGRESS.md`, phase specs
- Tests — `backend/src/tests/**`

277 files, ~4.7 MB.

## What was deliberately excluded (and why)

| Excluded | Reason |
|---|---|
| `backend/.env` | Contains the real `JWT_SECRET` and runtime configuration |
| `.env.example` | Excluded at the owner's request — it lists the env var names and provider key slots |
| `backend/data/app.db` | Live database — 1169 projects and 477 tasks of real owner data |
| `*/node_modules` | 200 MB of dependencies; reinstall with `npm install` |
| `*/dist` | Build output; regenerate with `npm run build` |
| `.git/` | Repository history and commit metadata |
| `logs/`, `*.log` | Runtime logs |

## Redactions applied

- The absolute workspace path (which contained the Windows username and the
  OneDrive Desktop layout) was replaced with `<workspace>` throughout the docs
  and packages — 130 occurrences.
- No real credentials or personal email addresses were found in the tracked
  files. The only secret-like strings are test fixtures (a fake `ghp_…` canary
  token and placeholder `JWT_SECRET` values); none are real.

## Script portability fix

The two dev-server launchers (`start-dev-server.bat`, `start-dev-server.ps1`)
originally hardcoded this machine's user profile and the Hermes-bundled Node
binary, so they could never run elsewhere. They have been rewritten to resolve
paths relative to the script (`%~dp0` / `$PSScriptRoot`) and to call `node` from
PATH, with a clear error if Node.js is missing. No machine paths remain.

## CI workflow note

`.github/workflows/ci-cd.yml` had two defects that broke GitHub Actions:

1. `actions/setup-node@v4` was given `cache: npm`, which looks for a lock file at
   the repository root. This project keeps its lock files in `backend/` and
   `frontend/`, so the job aborted with *"Dependencies lock file is not found"*.
   The `cache: npm` line has been removed.
2. The backend tests import the app, which opens the SQLite database at module
   load. A fresh clone has no `backend/data/` directory, so `getDb()` failed with
   *"unable to open database file"*. `backend/data/.gitkeep` has been added so the
   directory always exists; the database file itself stays gitignored.
3. `npm run test` ran `node --test src/tests/` (a directory argument), which fails
   on Node 22 with *"Cannot find module '.../backend/src/tests'"* (Node treats the
   directory as a module to load rather than a test directory to scan). Changed the
   script to `node --test`, which scans from cwd and works on both Node 22 and Node
   26.

## To run locally (outside AI Studio)

This copy cannot start as-is. From the original project:

```
cp .env.example .env     # then fill in JWT_SECRET and provider keys
npm run install:all
npm run db:migrate
npm run dev
```

Those commands run in the **original** workspace, which retains its `.env`.
