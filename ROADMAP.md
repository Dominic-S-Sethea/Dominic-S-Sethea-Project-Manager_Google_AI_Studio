# Project Manager — Roadmap & Status

> **Project:** Project Manager — local-first, web-hostable multi-project management tool with AI-agent integration
> **Workspace:** `<workspace>`
> **Stack:** React 19 + TypeScript + Vite + Tailwind (frontend) · Express + TypeScript (backend) · SQLite via `node:sqlite` · JWT auth + RBAC
> **Separation:** 100% separate from CDES Student Instructor V1.2.0 — no shared artifacts.

---

## 0. Authority

**The live Kanban board (`kanban.db`, board `default`) is the only reliable source of task status.**

This file is a narrative summary and can lag. Before acting on any status claim, verify with:

```
hermes kanban stats
hermes kanban list
```

Last synced: **2026-11-13** (post §6.6 audit closeout).

---

## 1. Programme — 8 phases, 7 approval gates

| # | Phase | State |
|---|---|---|
| 0 | Blueprint (PRD / SCHEMA / TECH_STACK / RULES) | ✅ complete |
| 1 | Discovery, authority & scope baseline | ✅ complete |
| 2 | Shared architecture, security & design system (Obsidian Signal Glass) | ✅ complete |
| 3 | Project Canvas specification | ✅ complete — design approved |
| 4 | Automation Studio specification & runtime boundary | ✅ complete — preview-only boundary |
| 5 | Integrated validation & final design handoff (15 files) | ✅ complete — parity gates green |
| 6 | Shared foundation & Project Canvas implementation | ✅ complete |
| 7 | Automation Studio runtime & builder implementation | ✅ complete |
| 8 | Integrated QA, release & final acceptance | ✅ complete |

**Direction:** Obsidian Signal Glass, six `--pm-*` CSS tokens as the single source of truth.

**Runtime boundary:** Automation Studio is *preview-only*. Its preview never implies a live runtime; publish / execute / replay return `423 RUNTIME_DISABLED`.

---

## 2. Current board state (2026-11-13)

| Status | Count |
|---|---|
| done | **118** |
| running | 0 |
| triage / todo / scheduled / ready / blocked / review | **0** |

There are also **118 archived** historical cards (earlier recon/dispatch cycles), which are terminal and do not gate anything.

**Open work: none.** The board is empty.

---

## 3. Defect register — closed

| ID | Severity | Summary | Outcome |
|---|---|---|---|
| QA013-D0 | High | `POST /api/users` stored the password in plaintext, so API-created users could not log in | ✅ **Fixed** — `userService.create()` now bcrypt-hashes (commit `a923c75`); regression test asserts the `$2` hash and a successful login |
| QA013-D2 | High | `PUT /api/projects/:id` could not persist metadata (500 when combined, silent no-op otherwise) | ✅ **Fixed** — missing `metadata = ?` assignment restored (commit `a923c75`); regression test covers combined + metadata-only PUT |
| QA013-D1 | Medium | Project `DELETE` is a soft archive; `GET` after delete returned `200 status=archived` instead of `404` | ✅ **Resolved — accepted as designed.** Soft archive is intentional across schema, backend and frontend; the acceptance text was amended. No source change. |

---

## 4. MVP feature status

| Card | Feature | Status |
|---|---|---|
| MC-001 | Project CRUD | ✅ done |
| MC-002 | Task CRUD | ✅ done (metadata fix applied) |
| MC-003 | Checklist CRUD | ✅ done (delete-with-items fixed) |
| MC-004 | Dependency management | ✅ done (validation + per-task retrieval fixed) |
| MC-005 | Comments on tasks | ✅ done |
| MC-006 | RBAC implementation | ✅ done — viewer read-only enforced |
| MC-007 | Audit log system | ✅ done — full §6.6 coverage, see §5 |
| MC-008 | Agent authentication | ✅ done |
| MC-009 | Human approval flow | ✅ done — records only, preview-only |
| MC-010 | Multi-provider AI model | ⚪ no dedicated card |
| MC-011 | Export (JSON + CSV) | ✅ done via IE-001 / IE-002 |
| MC-012 | Offline sync | ⚪ no dedicated card |
| MC-013 | MVP acceptance tests | ✅ done — QA-013: 66/69, all three defects closed (§3) |

Supporting feature cards also complete: VP-003/004/005, EX-001…004, DM-001…004, CN-001/002/005, IE-001/002, AC-001, UIUX-001…010.

---

## 5. Known gaps

- **Audit coverage (`PHASE2_03` §6.6) — complete.** `users`, `projects`, `tasks`, `checklists`, `dependencies`, `comments`, `connectors`, `executions`, `auth/login`, `import/export`, `migrations` and `backups` are all instrumented (commits `2c54e38` and `8ea7c91`). The one exception is **user delete**: §6.6 marks it required, but `users.routes.ts` has no `DELETE` endpoint at all, so there is nothing to attach the audit to. That is a missing feature, not missing audit.
- **`environment.service.ts` audit naming.** It still writes `workflow.created/updated` for environments — the same defect corrected for connectors in `8ea7c91`. Environments are outside the §6.6 matrix, so it was left; worth correcting for audit-trail accuracy.
- **No git remote.** `main` is local-only; every commit is unpushed.

---

## 6. Verified gates (2026-11-13)

| Gate | Result |
|---|---|
| Backend `npm run typecheck` | ✅ rc=0 |
| Backend `npm run build` | ✅ rc=0 |
| Backend `node --test src/tests/` | ✅ **185 / 185** |
| Frontend `npm run typecheck` | ✅ rc=0 |
| Frontend `npm run build` | ✅ rc=0 |
| Live DB migrations | ✅ 0→4 applied, **0 FK violations** |

Live DB: `backend/data/app.db` — 1169 projects, 477 tasks, 72 checklists, 69 dependencies. `audit_logs` is empty because no audited write has hit the live database since instrumentation; the coverage is proven against an isolated scratch DB by `tests/audit.coverage.test.ts`.

---

## 7. Document map

| File | Role |
|---|---|
| `ROADMAP.md` | This file — narrative programme status |
| `CHECKLIST.md` | Gate-by-gate achievement tracker (reconciled) |
| `THINK.md` | Session hand-over memory (reconciled) |
| `ProjectManager.md` | Project summary (reconciled) |
| `PRD.md`, `KANBAN_BOARD.md` | Superseded — pointer files only |
| `PROJECT_CONTEXT.md` | Session context injection for this project |
| `PHASE1_*` … `PHASE8_*` | Phase specs, decision packs and implementation logs |
| `UI_UX_PROGRESS.md` | UI/UX programme tracker |
