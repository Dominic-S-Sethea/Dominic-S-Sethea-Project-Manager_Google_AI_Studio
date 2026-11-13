# THINK.md — Project Manager

Project hand-over memory & pending intentions. A new session reads this file
(in addition to PROJECT_CONTEXT.md) via the `pre_llm_call` shell hook so that a
fresh chat box opens with the project context by default — no manual action.

## Origin & motivation
- Project Manager is a **local-first, web-hostable multi-project management tool**
  with AI-agent integration.
- It was built by adapting the CDES Student Instructor V1.2.0 **11-agent team**
  structure (CEO, CPO, CTO, DELIVERY_PM, ENGINEER, QA_SECURITY, UX/UI, DB Architect,
  DevOps, Performance, EDU_RESEARCH).
- The project follows a **6-phase reconstruction plan** (Discovery → Shared
  Architecture → Canvas Spec → Automation Spec → Integrated Validation →
  Implementation), extended with Phase 7 (Automation Studio runtime) and
  Phase 8 (Integrated QA, Release & Final Acceptance).
- **All 8 phases are complete. The board is empty: 118 done, 0 open** (verified 2026-11-13).

## Owner direction captured (standing)
- **Separation:** Project Manager is 100% separate from CDES Student Instructor V1.2.0
  (historical, must NOT be modified). Zero shared memory, data, source, or resources.
- **UI/UX:** Obsidian Signal glass theme, crystal-bright-blue accent (`#54C8FF`),
  6 presets + custom hex persisted in `localStorage` (`pm-theme-preference-v2`).
- **Canvas separation:** Project Canvas (visual diagramming) vs Automation Studio
  (workflow node editor, explicitly preview-only until backend runtime is authorized).
- **Phase 7 code-generation boundary:** Automation Studio code must come from
  ChatGPT-generated packages (audited and applied by the assistant). Workers do not
  write application code for Phase 7.
- **Approval gates:** No irreversible changes (DB, env, commits, history rewrite,
  credentials) without explicit owner approval.
- **Evidence-only:** Report what real execution returned; never fabricate output.

## Status (verified live 2026-11-13)
- **Board:** 118 done · 0 running · 0 triage/todo/ready/blocked/review. **No open work.**
- **Phases 0–8:** complete.
- **MVP MC-001…MC-013:** done (MC-010 and MC-012 never had dedicated cards).
- **Defect register:** empty. QA013-D0 and D2 fixed (`a923c75`); QA013-D1 resolved as
  accepted-as-designed (soft archive is intentional; acceptance text amended).
- **Audit (`PHASE2_03` §6.6):** complete across users, projects, tasks, checklists,
  dependencies, comments, connectors, executions, auth/login, import/export,
  migrations and backups (commits `2c54e38`, `8ea7c91`).

## Decisions log
| Date | Decision | Source |
|---|---|---|
| 2026-10-30 | Model B operating model (humans + AI agents) | `project-structure.md` |
| 2026-10-30 | SQLite single-node at 100k users (read-heavy, <20 concurrent writers) | `team.md` |
| 2026-11-08 | Unified Vite middleware server (one process, one port, HMR) | `HANDOVER-CORRECTED.md` |
| 2026-11-08 | Glass redesign (Obsidian Signal, 6 presets, `pm-*` tokens) | `UI_UX_PROGRESS.md` |
| 2026-11-10 | Phase 6 Canvas implementation complete (PM-P6-01..07) | live Kanban board |
| 2026-11-13 | QA013-D1 accepted as designed — soft archive is intentional | `ROADMAP.md` §3 |
| 2026-11-13 | `engineer` profile granted `KILOCODE_API_KEY` (its `.env` was empty, so workers could not resolve any model) | live verification |

## Open questions / next steps
1. **`users` delete** — §6.6 marks it required for audit, but no `DELETE /api/users`
   route exists. A missing feature, not missing audit.
2. **`environment.service.ts` audit naming** — writes `workflow.*` instead of
   `environment.*` (corrected for connectors in `8ea7c91`).
3. **No git remote** — `main` is local-only; every commit is unpushed.
4. **Commit pending doc work** — requires explicit owner approval.

## Hand-over prompt
- `HANDOVER-CORRECTED.md` — corrected hand-over document for the next chat session.
- `UI_UX_PROGRESS.md` — zero-token-waste UI/UX tracker (read first after a model switch).

See also: `PROJECT_CONTEXT.md` (canonical), `kanban.db` (live board), `rules.md` (rules).
