# Project Manager — Phase 6 Implementation Baseline (PM-P6-01)

**Status:** Baseline captured — safe implementation start  
**Phase:** 6 — Shared Foundation & Project Canvas Implementation  
**Repository:** `<workspace>`  
**Git branch:** `main`  
**Git HEAD:** `d705a364b2e845eb02f33d57475e0e3af15228c7`  
**Owner authorization:** Phase 6 implementation authorized (owner: “Yes, proceed”).

> **Labels:** **VERIFIED** = read directly from live source or generated artifacts. **REPORTED** = stated in a project document but not independently proved. **PROPOSED** = recommended but not approved. **DECISION-REQUIRED** = owner decision required.

---

## 1. Worktree state at baseline

- Branch: `main`
- HEAD: `d705a364b2e845eb02f33d57475e0e3af15228c7`
- Working tree: **dirty** — 55 tracked modifications, 1 deletion, 28 untracked paths (pre-existing UI/UX and Phase 1–5 planning artifacts).
- No branch reset, discard, or destructive git operation was performed.
- Rollback snapshot: `PHASE6_BASELINE_SNAPSHOT.patch` (tracked `git diff --binary`).
- Untracked planning artifacts are preserved in place and are not part of the implementation rollback patch.

### Tracked modification summary (pre-existing)

- Docs/UI: `CHECKLIST.md`, `HANDOVER*.md`, `KANBAN_BOARD.md`, `PRD.md`, `README.md`, `ROADMAP.md`, `TECH_STACK.md`, `design-system.md`, `hand-over-*.md`, `project-structure.md`, `rules.md`
- Backend: `schema.sql`, `index.ts`, `importExport.routes.ts`, `tasks.routes.ts`, `server.ts`, `importExport.service.ts`, `task.service.ts`
- Frontend: `index.html`, `App.tsx`, auth/canvas/checklist/dependency/git/project/task/user components, `useAuth.tsx`, `index.css`, `main.tsx`, pages, `vite.config.ts`
- Deleted: `CDES-Student-Instructor.md`
- Untracked implementation artifacts include Phase 1–5 `.md` files, `UI_UX_PROGRESS.md`, `UI_UX_REDESIGN_PLAN.md`, connector/uiLayout services and routes, layout/theme/ui components, and new pages.

---

## 2. Baseline verification gates

| Gate | Result | Evidence |
|---|---|---|
| Backend typecheck | **PASS** | `npm run typecheck` exit 0 |
| Frontend typecheck | **PASS** | `npm run typecheck` exit 0 |
| Frontend build | **PASS** | Vite 6.4.5 build, 123 modules, exit 0 |
| Backend tests | **PASS** | 15 tests / 15 pass / 0 fail |
| Backend build | **FAIL** | `tsconfig.json(19,35): error TS5096` — `allowImportingTsExtensions` requires `noEmit` or `emitDeclarationOnly` |

**Known blocking baseline defect:** backend build TS5096. This is a Phase 2 critical finding (C-1/C-4 class) and must be fixed before Phase 6 implementation is accepted.

---

## 3. Approved Phase 6 scope

| Card | Scope |
|---|---|
| `t_4e0a32ba` PM-P6-01 | Protect approved implementation baseline; record scope, files, rollback path |
| `t_87edf583` PM-P6-02 | Shared foundation gaps only — error normalization, focus/keyboard infrastructure, inspector/drawer behavior, token/accessibility rules |
| `t_99a7f1dd` PM-P6-03 | Canvas project scope, authorization, parent validation, item/task/connection consistency, explicit migration, normalized errors |
| `t_bc31ff40` PM-P6-04 | Canvas mutation, connection, viewport reliability |
| `t_c3f7b70f` PM-P6-05 | Canvas keyboard, pointer, touch, responsive behavior |
| `t_0d474b65` PM-P6-06 | Canvas contract, regression, integration coverage |

**Explicitly out of scope:** Automation runtime/Phase 7, connector credential provider changes, DB data migration without a separate card, unrelated redesign, and any change outside the approved Phase 6 scope.

---

## 4. Rollback path

1. Tracked changes introduced during Phase 6 are reverted with `git checkout -- <paths>` or a targeted reverse patch.
2. The pre-existing dirty state is restored from `PHASE6_BASELINE_SNAPSHOT.patch` using `git apply -R` only for Phase 6 files.
3. Untracked Phase 6 files are removed only after verifying they are not pre-existing planning artifacts.
4. No destructive git operation is performed without a separate owner approval.

---

## 5. Files and hashes at baseline

| File | Bytes | SHA-256 |
|---|---:|---|
| `backend/src/routes/canvas.routes.ts` | 3,942 | `bc22544eb05b0bcb3856decc803dd6d06e6883dcab058279fa07e62ef9905cc8` |
| `backend/src/services/canvas.service.ts` | 8,988 | `91cd9a75ef6b66131b40249f751b731c1e659d2a0cbd2bc7b3b7facad1efb9ab` |
| `backend/src/database/schema.sql` | 9,599 | `5447d355c0da21f7475f2c4a8695d8394cbbb90618ba748345c54ad5fef1f272` |
| `backend/src/database/index.ts` | 840 | `772c9a3e74dca505469eaf62a0157eab2ce55f8782821fdb8eb2482f927c9dc9` |
| `backend/src/database/migrate.ts` | 208 | `53e428a9076ec4066daf91f45b4d9b02a1c3521f04ef3c68774c60b267f51d02` |
| `backend/src/middleware/auth.middleware.ts` | 1,159 | `002fdf31428ea049b038adc420de442ac737b255ae17425bc47426d1a9a7de59` |
| `backend/src/services/connector.service.ts` | 13,641 | `e23b3d86ac66bca5599b758d8280d6945b3531d257e95fba20893032559f9b37` |
| `backend/src/routes/connectors.routes.ts` | 5,746 | `21a090489108629fa56878ee698689b793e6a540d1f9da18c8487e3d6b3032a1` |
| `backend/src/tests/backend.test.ts` | 12,247 | `681279795b0385003f817c4bf729ca3e0026899abc8a1bec6f337ea2b83f28d6` |
| `backend/tsconfig.json` | 626 | `80c71c217aed7513600f0e1bb5493171b4e98c8a6a77a732b566a75fddb8b790` |
| `backend/package.json` | 1,343 | `65f52d48f029f86e2970b7f8c796471e32303fe95e8afe35c9e4ba677a6303e3` |
| `frontend/src/components/canvas/CanvasToolbar.tsx` | 2,386 | `8fc577c6938ba1518da2092b12a7d2b65f6a37f336c8e4891ad0d8c93b252eb0` |
| `frontend/src/components/canvas/CanvasViewport.tsx` | 11,260 | `05b07c3d428d7fdd5a511c7723827276a17f1f0cd5ca6895c8ed4710391f7e4d` |
| `frontend/src/components/canvas/CanvasItem.tsx` | 12,783 | `5f9c9a15fac8ad4a60a8daa01ab06395d6601407a9b9edbd88d74e0b93516817` |
| `frontend/src/components/canvas/PropertiesPanel.tsx` | 17,206 | `a2938c2e89ddbba3a0516cf2f6d36ea6153c5bcbca7ff90102ab2f33c9ab26ea` |
| `frontend/src/components/canvas/ConnectionLine.tsx` | 1,568 | `9894bc42420590539643556764f938122ab4720bd363f042d0db317a99243fa2` |
| `frontend/src/components/canvas/ShapeSelector.tsx` | 2,122 | `d5c793bf3859b7f64a31c1293fb31c35ae55809017a1bd8b85741b24fd61f4b6` |
| `frontend/src/pages/Canvas.tsx` | 8,800 | `dcead286a1a5a2e404ca1857f86e6964fa278fa2558d115a15ce5fdb40834fcf` |
| `frontend/src/pages/CanvasList.tsx` | 7,619 | `3e817c379471760b38816d55b78a2b931ad1b9852f010d020b8ba31a66dd1d07` |
| `frontend/src/hooks/useCanvas.ts` | 10,540 | `4d61f82272f5281dae0f811d4c1740239cccca4160429cbd74e12b8ab88ed948` |
| `frontend/src/types/index.ts` | 2,002 | `85efeec01ab5fa75c5725fb4b9a805b3e39bf3262c7ccbb854ed40ad35f8a132` |
| `frontend/src/index.css` | 66,111 | `1773a74a7a23c6cfb51c8a8740df6617e121cbdcb92bcf402aec7be3cd1def47` |
| `frontend/package.json` | 1,116 | `9a00da382815e9c13e5a5974821d1d00bf9e08f32aa43bfa31ae26f261fcff94` |

---

## 6. Implementation rules for Phase 6

1. One card at a time, ≤3 files per step.
2. Fix the backend build TS5096 first.
3. No unrelated redesign.
4. No DB/schema change without an explicit migration decision.
5. No credential/provider change without a separate security decision.
6. Verify backend typecheck, backend build, frontend typecheck, frontend build, and backend tests after each step.
7. No commits without explicit owner approval.

---

*Prepared as the Phase 6 implementation baseline record. This document authorizes implementation work only within the recorded scope.*
