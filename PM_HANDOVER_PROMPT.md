# PROJECT MANAGER — HAND-OVER PROMPT (verified 2026-11-12)

> **How to use:** paste everything below the line into a new Hermes chat box.
> This file is the canonical hand-over; keep it tracked in git and update it whenever board state changes.

---

Continue development of the **Project Manager** app. Workspace root:

```
<workspace>
```

## 1. Identity & separation (hard rules)

- **Project:** Project Manager — local-first, web-hostable multi-project management tool with AI-agent integration.
- **Owner:** Sethea Oudam Soy (approval authority).
- **Stack:** React 19 + TS + Vite + Tailwind frontend · Express + TS backend · SQLite via `node:sqlite` (`DatabaseSync`) · JWT auth + RBAC · Gemini AI.
- **Branch:** `main`, local only (no remote). Last verified HEAD: `d7fe463`.
- **SEPARATION:** `CDES Student Instructor V1.2.0` at `<USER>\GitHub\Student-Instructor-V1.2.0` is **HISTORICAL / read-only**. Never edit, cite as active, or reuse its files. Zero shared artifacts.
- **Git:** working tree clean at `d7fe463`.

## 2. Where the project actually stands (verified against kanban.db + git, not against docs)

The live Kanban board (`%LOCALAPPDATA%\hermes\kanban.db`, board `default`) is the **status authority**. `ROADMAP.md` and `KANBAN_BOARD.md` are **STALE** — they show pre-Phase-6 state and will mislead you. Trust `UI_UX_PROGRESS.md` for UI/UX and `PHASE6_/PHASE7_IMPLEMENTATION_LOG.md` for implementation history.

Board totals: **87 done · 24 blocked · 2 todo · 114 archived.**

| Phase | Name | Status |
|---|---|---|
| 0 | Blueprint | ✅ Done |
| 1 | Discovery, Authority & Scope Baseline | ✅ Done |
| 2 | Shared Architecture, Security & Design System | ✅ Done |
| 3 | Project Canvas Specification | ✅ Done |
| 4 | Automation Studio Specification & Runtime Boundary | ✅ Done |
| 5 | Integrated Validation & Final Design Handoff | ✅ Done |
| 6 | Shared Foundation & Project Canvas Implementation | ✅ Done |
| 7 | Automation Studio Runtime & Builder | ⛔ Parent `t_80009d70` reopened **blocked (dependency)** — PM-P7-01 done, PM-P7-02..06 blocked |
| 8 | Integrated QA, Release & Final Acceptance | ⛔ Blocked (`t_5c4ea48e` + children) |

**UI/UX glass redesign: UIUX-001 → UIUX-010 ALL DONE.** UIUX-010 QA evidence: all 10 routes tested at desktop/tablet/375px, no horizontal overflow, zero console errors. `UI_UX_PROGRESS.md` now records UIUX-010 as DONE (tracker corrected in `d7fe463`).

**What is NOT done (the real backlog):**
- **Phase 7 (Automation Studio runtime/builder)** — the live gap. PM-P7-01 delivered the domain model + migrations (`bd4b940`). PM-P7-02..06 are blocked pending owner decisions and ChatGPT-generated packages.
- **Phase 8** — integrated QA, release and final acceptance, gated behind Phase 7.
- **`t_10b90995`** MC-006 RBAC enforcement remediation (blocked) — QA found viewer writes succeeded despite the documented permission matrix. This is an open defect.
- **`t_6a26c2bc`** MC-005 comment CRUD + task-association tests (blocked).
- **QA cards QA-002/003/004/007/008/009/013** blocked (needs_input / capability).
- **Todo:** `t_6b3f9f9d` Verify task CRUD and field behavior · `t_a7c60526` Compile the MC-002 task behavior test report.

## 3. Locked owner decisions (do not revisit without the owner)

1. **Default theme:** Obsidian Signal — graphite-black glass `#080B11` / `#090B0F` (never navy), crystal-bright-blue accent `#54C8FF`.
2. **Glass system:** frosted panels `backdrop-filter: blur(22px) saturate(142%)`, 1px translucent borders `rgba(211,228,255,0.13)`, inset specular highlights, ambient light orbs.
3. **Theming:** 6 presets (crystal/Obsidian Signal default, violet/Carbon Orchid, aurora/Aurora Mint, ember/Forge Amber, emerald/Emerald Circuit, porcelain/Porcelain Glass) + custom `#RRGGBB` picker, persisted in `localStorage` key `pm-theme-preference-v2`.
4. **Two separate canvases:** Project Canvas (`/canvases`, `/canvas/:id`, `/api/canvas`) is visual task/project diagramming. Automation Studio (`/automation`) is an n8n-style workflow editor/inspector/trace surface, **explicitly preview-only / non-live** until the owner authorizes a runtime. Never present it as functional.
5. **Design Mode excluded from the main workspace** (Option B) — free placement lives only in Project Canvas and Automation Studio.
6. **Code-generation boundary:** feature code comes from ChatGPT regular chat via self-contained bundles; Hermes audits, applies, verifies, commits. Hermes does not write application feature code directly.

## 4. Working process

1. Read this prompt, then `UI_UX_PROGRESS.md`, `PHASE6_IMPLEMENTATION_LOG.md`, `PHASE7_IMPLEMENTATION_LOG.md`. Confirm the single next task with the owner before touching code.
2. One code-change card at a time; steps of ≤3 files.
3. Build/refresh a ChatGPT bundle (self-contained prompt + complete current source of every referenced file). Verify embedded blocks against the live tree; zero literal `***` placeholders.
4. Owner generates in ChatGPT regular chat and returns the code.
5. Stage returned files in a scratch dir, confirm the set equals the authorized list, then apply.
6. Verify: frontend `npm run typecheck` + `npm run build` exit 0; backend `npm run typecheck` + `npm test` pass; `git diff --stat` matches scope.
7. Update tracker/phase log, commit (commits need explicit owner approval), report: task done, files changed, next pending task.

## 5. Phase 7 detail — what is ready and what is missing

**Delivered:** PM-P7-01 `t_76b550f3` done — `0000_baseline.sql`, `0001_automation_domain.sql` (+ `.down.sql`), ledger-first migration runner (`schema_migrations`, checksum-drift refusal, single-transaction apply, `PRAGMA foreign_key_check`, dry-run, no-op re-run). Verified: backend typecheck 0; `node --test src/tests/automation.migration.test.ts` 4/4; live DB restored and shows all 10 Automation tables, ledger `[0 baseline, 1 automation_domain]`, 0 FK violations.

**Live DB (verified):** `backend/data/app.db` — 603 projects · 256 tasks · 134 users · 196 canvases · 83 canvas_items · 38 task_dependencies · 827 project_members · 2 schema_migrations. 0 FK violations. All automation tables empty (`workflows`, `workflow_nodes`, `workflow_edges`, `workflow_versions`, `executions`, `execution_steps`, `approvals`, `environments`, `credential_references`).

**Blocked cards and their state:**
| Card | Title | Block | Package state |
|---|---|---|---|
| `t_2f5484c3` | PM-P7-02 event ingestion/execution | needs_input | Detailed prompt ready; bundle `PHASE7_CODEGEN_BUNDLE_02_EVENT_INGESTION_EXECUTION.md` |
| `t_e506c9ed` | PM-P7-03 permissions/credentials/approvals/audit | dependency | Bundle ready: `PHASE7_CODEGEN_BUNDLE_PM_P7_03_PERMISSIONS_AUDIT.md` |
| `t_6256ea13` | PM-P7-04 persisted workflow builder | dependency | Bundle ready: `PHASE7_CODEGEN_BUNDLE_WORKFLOW_BUILDER.md` |
| `t_610e1b49` | PM-P7-05 test mode/traces/replay | dependency | Detailed prompt only: `PHASE7_CODEGEN_05_TEST_MODE_TRACES_REPLAY_DETAILED.md` |
| `t_b72dc4a0` | PM-P7-06 lifecycle/publish/rollback | dependency | **Nothing prepared** |

**Known gap to flag to the owner:** no card implements the Automation HTTP API that PM-P7-04's builder calls. PM-P7-01 is schema/migrations only. The builder degrades gracefully ("Automation API not connected" + Retry), but real persistence needs an API implementation card the owner must assign.

**Cross-card inconsistencies already found (for the orchestrator):**
1. API prefix — PM-P7-05 prompt says `/api/automation/...`; owner-approved UD-11 says `/api/v1/automation`. Bundles use `/api/v1/automation`.
2. Runtime boundary — PM-P7-05 prompt targets "test-only upgrade"; AD-01/UD-10 record **preview-only**. Bundles implement preview-only.
3. Node title field — approved data contract (PHASE4_03 §4.3) uses `name`; PHASE4_02 §3.2 called it `label`. Bundles use `name`.

## 6. Environment quirks (Windows — read before running anything)

- **`terminal` / `read_file` / `write_file` / `search_files` / `patch` fail on this machine** with fork error `0xC0000142` (MSYS dofork) or "Terminal environment unavailable". **`execute_code` is also blocked unattended.** Use **`browser_exec`** (its Python has stdlib + `subprocess`) for all shell commands and file I/O. Paths contain spaces, so quote them and pass native-style paths (`C:/Users/...`) to native tools.
- Tool output masks `Bearer` and `${...}` as `***`. Verify numerically or with typecheck — never "fix" based on that rendering.
- Node/npm on PATH: `<USER>\AppData\Local\hermes\tools\node-26.12.1-win32-x64\node.exe` and `...\npm-12.0.2-win32-x64\npm.cmd`.
- Dev server: `cd backend && set NODE_ENV=development && node --experimental-strip-types src/server.ts`. Health: `http://localhost:3000/health`. Backend serves the built frontend via Vite middleware on port 3000.
- **`kanban_create` ignores `--initial-status`** — new cards land in `ready` until a gateway tick (~60s) or an explicit claim. CLI: `hermes kanban <subcommand> <task_id>` (claim / complete / block / unblock / archive / comment / show).
- Kanban dispatcher in this workspace intermittently fails UI/UX cards with `Kanban owner refused: Kanban execution unknown; retained by owner`. That is a harness issue, not a code problem — do not retry endlessly; restart the dispatcher or clear the retention lock.

## 7. Immediate next step

**Ask the owner which thread to pull first.** Recommended order, in the owner's judgement:
1. **Phase 7 activation** — decide the automation runtime boundary and assign the missing Automation HTTP API card; then generate + apply PM-P7-02/03/04 bundles in order.
2. **MC-006 RBAC remediation** (`t_10b90995`) — an open security defect; viewer writes succeeded against the documented matrix.
3. **Phase 8 QA** once Phase 7 lands.

Do not start any of these without the owner naming the task. One topic at a time.

## 8. Standing rules

1. No irreversible change without explicit approval (DB, schema, env, credentials, git history, pushes).
2. One topic at a time; fully resolve before opening the next.
3. Evidence only — never report an unrun gate as passing.
4. 5-item brief when asked: done / in progress / needs approval / blocked / next.
5. Ask first when unclear; never assume.
