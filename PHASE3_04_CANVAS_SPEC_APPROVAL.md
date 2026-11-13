# PM-P3-04 — Project Canvas Specification Approval Gate

| Field | Value |
|---|---|
| Card | PM-P3-04 — Project Canvas specification approval gate |
| Artifact | Specification review, consistency/gap findings, defect register, owner decisions, recommendation |
| Date | 2026-11-10 |
| Repository | `<workspace>` |
| Method | Read-only static inspection of the three sibling artifacts plus the live working tree. No servers started, no builds, no DB/schema change, no application source edit. |
| Read-only boundary | Only this artifact was written. No application source file, schema, or data was modified. |
| Review snapshot | 2026-11-10 21:38–21:45 (local). Sibling and Phase 2 artifacts were being written concurrently; see §2. |

## Evidence legend

| Label | Meaning |
|---|---|
| **VERIFIED** | Read directly from the cited file/line in the current working tree, or independently re-derived during this review. |
| **REPORTED** | Asserted by a project document or sibling artifact; not independently re-derived here. |
| **PROPOSED** | Recommended target state; not present in code and not yet approved. |
| **UNKNOWN** | Not currently verifiable. |
| **DECISION-REQUIRED** | Owner decision needed before implementation. |

---

## 1. Executive summary

The three Phase 3 Canvas specification artifacts were reviewed against the live source and against the Phase 2 shared-foundation artifacts:

- `PHASE3_01_CANVAS_IA_JOURNEYS.md` — IA, roles, journeys, target screen spec, acceptance criteria AC-01…AC-26, decisions D1…D15.
- `PHASE3_02_CANVAS_INTERACTIONS.md` — interaction inventory, behaviour spec, preserve/improve/extend map, decisions D-01…D-19.
- `PHASE3_03_CANVAS_API_CONTRACT.md` — current API/data/authz evidence, gap analysis F1…F15, target contract, test cases T01…T25, decisions D1…D15.

**Overall quality:** high. The three artifacts are evidence-dense, correctly label VERIFIED vs PROPOSED, cite exact paths and line numbers, and their line-number citations were spot-checked and found accurate. The current-state findings are trustworthy and consistent with each other.

**Why the gate is not a pass:** the specifications are not yet internally and cross-phase consistent, and the Phase 3 acceptance criteria are not all met by the shipped Canvas.

1. **Cross-phase authorization conflict (blocking).** `PHASE3_03` §3.3/D1 proposes a *global* role model (`admin | manager | editor | viewer`) built on `users.role` + `requireRole`. `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md` §2.1/§3 mandates *project-scoped membership* with `Owner / Editor / Viewer / Commenter` and explicitly says to keep `users.role` out of project permission decisions. `PHASE3_03` also omits `commenter`. **VERIFIED**
2. **Global-canvas conflict (blocking).** `PHASE3_03` D2 proposes admin-only canvases with `project_id = null`; `PHASE3_01` D11 option (a) allows null + "All projects"; `PHASE2_02` §3 says every Canvas must resolve to exactly one project and must not become globally readable. **VERIFIED**
3. **Phantom membership model (blocking).** `PHASE3_02` §7.2 says "align with the existing project membership model"; `PHASE2_02` §1 verifies no `project_members` table exists. **VERIFIED**
4. **Export/import scope conflict (blocking).** `design-system.md:296,302` requires save/load and export/import; `PHASE3_01` AC-19/D8 treats it as required; `PHASE3_02` §7.3 lists it as an Extend requiring explicit approval; `PHASE3_03` §7 lists canvas export/import as a non-goal. **VERIFIED**
5. **Card provenance is unverifiable (blocking governance).** `PM-P3-01/02/03/04` do not appear in `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, or `CHECKLIST.md` (0 hits; only self-references inside the sibling artifacts). All three siblings flag this. **VERIFIED**
6. **Acceptance criteria not all met.** EX-004 icon morphing is absent; EX-003 `arrow` item type is unreachable from the toolbar; save/load UI and export/import are absent; Canvas has zero automated test coverage; WCAG 2.2 AA is not met. **VERIFIED**
7. **Cross-phase drift in flight.** Phase 2 artifacts were rewritten during this review (e.g. `PHASE2_05` changed from 27,895 to 60,187 bytes), so cross-phase citations are snapshot-dependent. **VERIFIED**

**Recommendation: REQUEST CHANGES.** The specifications are a strong baseline but cannot be approved as the implementation contract until the blocking items in §8 are resolved and recorded.

---

## 2. Review scope and snapshot

### 2.1 Artifacts reviewed

| Artifact | Bytes | SHA-256 (first 16) | mtime | Reviewed |
|---|---:|---|---|---|
| `PHASE3_01_CANVAS_IA_JOURNEYS.md` | 48,630 | `e2c1e80e39546ad5` | 21:36:28 | Yes — full read |
| `PHASE3_02_CANVAS_INTERACTIONS.md` | 34,901 | `5c56629b58f66311` | 21:24:15 | Yes — full read |
| `PHASE3_03_CANVAS_API_CONTRACT.md` | 42,129 | `d464d83abe235b16` | 21:23:12 | Yes — full read |

Full SHA-256 values (snapshot):

- `PHASE3_01_CANVAS_IA_JOURNEYS.md` — `e2c1e80e39546ad5f54003b08794449c7896523e1bc8e10e085447740a360bbf`
- `PHASE3_02_CANVAS_INTERACTIONS.md` — `5c56629b58f663111258706568691a87ff36ef1e8671325f3479fc55416c76a6`
- `PHASE3_03_CANVAS_API_CONTRACT.md` — `d464d83abe235b1698289eff91eef4739ba1b2557a482e002a6fe4d82bcd1555`

### 2.2 Source inspected

`frontend/src/pages/Canvas.tsx`, `CanvasList.tsx`; `frontend/src/hooks/useCanvas.ts`; `frontend/src/types/canvas.ts`; `frontend/src/components/canvas/{CanvasViewport,CanvasItem,CanvasToolbar,PropertiesPanel,TaskPicker,ConnectionLine,ShapeSelector,TaskCard}.tsx`; `frontend/src/components/design/DesignCanvas.tsx`; `frontend/src/main.tsx`; `frontend/src/index.css`; `backend/src/routes/canvas.routes.ts`; `backend/src/services/canvas.service.ts`; `backend/src/services/task.service.ts`; `backend/src/database/schema.sql`; `backend/src/database/index.ts`; `backend/src/middleware/auth.middleware.ts`; `backend/src/tests/backend.test.ts`; `backend/src/index.ts`; `backend/src/server.ts`; `design-system.md`; `ROADMAP.md`; `KANBAN_BOARD.md`; `PRD.md`; `CHECKLIST.md`; `UI_UX_REDESIGN_PLAN.md`; `UI_UX_PROGRESS.md`; `PHASE1_DISCOVERY_DECISION_PACK.md`; `PHASE2_01…PHASE2_05` artifacts.

### 2.3 Concurrent-write caveat

**VERIFIED** — Phase 2 artifacts were modified while this review was running (`PHASE2_05_SHARED_COMPONENT_CATALOG.md` 27,895 → 60,187 bytes; `PHASE2_01/03/04` also touched). Cross-phase citations in §4 and §7 are therefore valid for the snapshot in §2.1 and must be re-confirmed once the Phase 2 set is frozen. This is a process finding, not a defect in the Phase 3 artifacts.

---

## 3. Phase 3 acceptance criteria — evidence checklist

Criteria are taken from the project's own Phase 3 definitions: `design-system.md:312` (Phase 3 deliverables + acceptance criteria), `design-system.md:289-302` (§12 Custom Canvas rules), `ROADMAP.md:79-88` (EX-001…EX-004 + Phase 3 deliverable), `KANBAN_BOARD.md:63-66` (EX-001…EX-004), `KANBAN_BOARD.md:129-135` (verification gates). `PRD.md` is byte-identical to `KANBAN_BOARD.md` (`PHASE1_DISCOVERY_DECISION_PACK.md:80`).

| ID | Criterion (source) | Sibling evidence | Source evidence | Status |
|---|---|---|---|---|
| **PC-01** | Drag-and-drop canvas, Canva-like (`ROADMAP.md:83`; `KANBAN_BOARD.md:63`; `design-system.md:292`) | `PHASE3_01` §2.7, §3.2 step 7, §4.4; `PHASE3_02` §4.1; `PHASE3_03` §1.4 | `CanvasItem.tsx:79-135` (drag lifecycle, save-on-release); `CanvasViewport.tsx:116-213` (pan + momentum) | **MET** (VERIFIED). Improvements PROPOSED: snap, bounds, multi-drag (`PHASE3_02` §7.2). |
| **PC-02** | Task connections — link task cards (`ROADMAP.md:84`; `KANBAN_BOARD.md:64`; `design-system.md:294`) | `PHASE3_01` §3.2 steps 5-6, §4.10; `PHASE3_02` §4.7; `PHASE3_03` §3.4 | `Canvas.tsx:88-109,244-253`; `TaskPicker.tsx`; `useCanvas.ts:110-142`; `CanvasItem.tsx:326-364`; `types/canvas.ts:16-17` | **PARTIAL** (VERIFIED). Linking is creation-time only; no relink/unlink on existing items; connection target is "first other item"; `TaskCard.tsx` orphaned so live status/priority are not shown. |
| **PC-03** | Component library — square, line, arrow, text (`ROADMAP.md:85`; `KANBAN_BOARD.md:65`; `design-system.md:293`) | `PHASE3_01` §2.8, §4.5; `PHASE3_02` §3 items 3-4; `PHASE3_03` §3.4 | `CanvasToolbar.tsx:8-14`; `Canvas.tsx:79-120`; `ShapeSelector.tsx`; `types/canvas.ts:16`; `CanvasItem.tsx` renderContent | **PARTIAL** (VERIFIED). Square/line/text/task present; `arrow` item type is unreachable from the toolbar (toolbar offers only `line`); ShapeSelector adds rectangle/circle/diamond/triangle beyond the required set; no image component (`design-system.md:293` lists image). |
| **PC-04** | Advanced motion — spring-based, icon morphing (`ROADMAP.md:86`; `KANBAN_BOARD.md:66`; `design-system.md` §3.1) | `PHASE3_01` §4.5, §7.6; `PHASE3_02` §3 item 17, §4.3; `PHASE3_03` §1.4 | `index.css:284-298` (pop-in/out, draw-line, pulse, skeleton); `useCanvas.ts:123-134,186-216`; `CanvasViewport.tsx` momentum loop | **PARTIAL** (VERIFIED). Spring-based motion **MET**; **icon morphing NOT IMPLEMENTED** — 0 "morph" occurrences in canvas code (only "Glassmorphism" in `Appearance.tsx`); local `spring` constant duplicates and differs from `--pm-spring`; JS momentum is not gated by `prefers-reduced-motion`. |
| **PC-05** | Save/load canvas layouts (`design-system.md:296,302`) | `PHASE3_01` §4.11, AC-19, D3, D8; `PHASE3_02` §5, §7.3; `PHASE3_03` §3.5.2-3.5.5, §3.7 | `canvas.routes.ts:11-76`; `canvas.service.ts:50-137`; `useCanvas.ts:82-104`; `importExport.service.ts` (0 canvas mentions) | **PARTIAL** (VERIFIED). Canvas CRUD persists; no explicit Save control, no dirty/pending indicator, no export/import. `design-system.md:302` requires export/import for custom designs. |
| **PC-06** | Custom UI/UX editing — edit any component (`ROADMAP.md:88`; `design-system.md:295`) | `PHASE3_01` §4.7; `PHASE3_02` §3 item 14; `PHASE3_03` §3.4 | `PropertiesPanel.tsx:143-636`; `ShapeSelector.tsx`; `CanvasItem.tsx` | **MET** (VERIFIED), with accessibility and validation gaps (unlabelled fields, no range checks). |
| **PC-07** | Backend: 10 REST endpoints, 3 SQLite tables (`ROADMAP.md:88`) | `PHASE3_01` §2.3; `PHASE3_02` §1; `PHASE3_03` §1.1 | `canvas.routes.ts:11-142` (10 routes at L11/28/39/52/66/79/89/102/115/132); `schema.sql:161-198` (3 tables) | **MET** (VERIFIED). |
| **PC-08** | Frontend: 13 components/hooks/pages (`ROADMAP.md:88`) | `PHASE3_01` §2.5; `PHASE3_02` §1 | 13 files counted: `Canvas.tsx`, `CanvasList.tsx`, `useCanvas.ts`, `types/canvas.ts`, 8 `components/canvas/*`, `DesignCanvas.tsx` | **PARTIAL** (VERIFIED). 13 files exist, but `TaskCard.tsx` and `DesignCanvas.tsx` are orphaned (0 imports); 11 are wired. |
| **PC-09** | All typechecks and tests pass (`ROADMAP.md:88`) | `PHASE3_01` AC-26, §2.9 item 13; `PHASE3_02` evidence index; `PHASE3_03` F15 | `backend.test.ts` (363 lines, 0 canvas mentions); frontend typecheck/build pass is REPORTED via `PHASE1_DISCOVERY_DECISION_PACK.md:30-31` | **PARTIAL** (VERIFIED absence). Existing suite passes (REPORTED), but Canvas has zero automated coverage — no API, hook, or component tests. |
| **PC-10** | Canvas is a planning surface, not an automation runtime (`UI_UX_REDESIGN_PLAN.md:175,222,240`; `PHASE1_DISCOVERY_DECISION_PACK.md:122,144`) | `PHASE3_01` §5; `PHASE3_02` §8; `PHASE3_03` §4 | `AutomationStudio.tsx:29-30,231` (preview-only, disabled Publish, no fetch); no automation routes/tables; canvas service has no side effects | **MET** (VERIFIED). Residual blur: toolbar tool named "Line/Arrow" (`CanvasToolbar.tsx:11`) is PROPOSED for rename. |
| **PC-11** | Accessibility and responsive baseline (`PHASE2_04` K-06/SR-06/AC-17/AC-22; `PHASE3_01` §6/§7) | `PHASE3_01` §6, §7, AC-23, AC-24; `PHASE3_02` §4.9, §4.10, §7.2; `PHASE3_03` has no accessibility content | `CanvasViewport.tsx:248-271` (no role/label); `CanvasItem.tsx` (no tabIndex); `ConnectionLine.tsx:27-33` (pointer-only); `PropertiesPanel.tsx` labels without `htmlFor`; `TaskPicker.tsx` keyboard model | **NOT MET** (VERIFIED). WCAG 2.2 AA not met: no keyboard item operations, no touch/pan/zoom, no accessible names on the viewport, selection not announced. |
| **PC-12** | Verification gates — tsc, tests, lint, build, manual QA, 10 ms performance budget (`KANBAN_BOARD.md:129-135`) | `PHASE3_01` §2.9, AC-26; `PHASE3_02` §5 (performance UNKNOWN); `PHASE3_03` §5 (T01–T25) | No canvas tests; no performance measurement recorded; lint config exists per `ROADMAP.md` PB-005 (REPORTED) | **PARTIAL / UNKNOWN** (VERIFIED). No canvas test or performance evidence exists. |

**Checklist result:** 3 MET, 6 PARTIAL, 1 NOT MET, 1 PARTIAL/UNKNOWN, 1 MET with a residual naming defect. No criterion is fully blocked, but PC-02/03/04/05/08/09/11/12 are not satisfied as written.

---

## 4. Consistency findings

Each finding is marked **VERIFIED** (read/derived here) or **PROPOSED** (recommended).

| ID | Finding | Evidence | Class |
|---|---|---|---|
| **C-01** | **Role-model conflict across phases.** `PHASE3_03` §3.3/D1 proposes global roles `admin | manager | editor | viewer` on `users.role` + `requireRole`; `PHASE2_02` §2.1/§3 mandates project-scoped membership (`Owner/Editor/Viewer/Commenter`) and says keep `users.role` out of project permission decisions; `PHASE3_03` omits `commenter`. | `PHASE3_03` §3.3, D1; `PHASE2_02` §2.1, §3; `PHASE2_01` §2.5 (`requireRole` only used in `users.routes.ts:43,56,79`) | **VERIFIED** — blocking |
| **C-02** | **Global-canvas conflict.** `PHASE3_03` D2 proposes admin-only `project_id = null` canvases; `PHASE3_01` D11 option (a) allows null + "All projects"; `PHASE2_02` §3 says every Canvas must resolve to exactly one project and must not become globally readable. | `PHASE3_03` D2; `PHASE3_01` D11; `PHASE2_02` §3 | **VERIFIED** — blocking |
| **C-03** | **Phantom membership model.** `PHASE3_02` §7.2 says "align with the existing project membership model"; no `project_members` table exists. | `PHASE3_02` §7.2; `PHASE2_02` §1; `schema.sql` table list | **VERIFIED** — blocking (wording/contract must be corrected) |
| **C-04** | **Export/import scope conflict.** `design-system.md:296,302` requires save/load and export/import; `PHASE3_01` AC-19/D8 treats it as required; `PHASE3_02` §7.3 lists it as Extend requiring explicit approval; `PHASE3_03` §7 lists canvas export/import as a non-goal. | `design-system.md:296,302`; `PHASE3_01` AC-19, D8; `PHASE3_02` §7.3; `PHASE3_03` §7 | **VERIFIED** — blocking scope decision |
| **C-05** | **Canvas audit events absent from the Phase 2 audit coverage matrix.** `PHASE3_03` §3.9 proposes canvas audit events; `PHASE2_03` §6.6 coverage matrix has no canvas row and states none are written today. | `PHASE3_03` §3.9; `PHASE2_03` §6.6 | **VERIFIED** — non-blocking, must be reconciled |
| **C-06** | **Hardcoded colours and a non-canonical spring curve.** Canvas components hardcode `#3b82f6`, `#64748b`, `#475569`, `#cbd5e1`, `#1e293b` and define a local `spring = cubic-bezier(0.34,1.56,0.64,1)`, while the canonical token is `--pm-spring: cubic-bezier(0.22,1,0.36,1)`. `PHASE2_04` AC-11 forbids hardcoded colours; `PHASE2_05` §9 names `ConnectionLine`. | `ConnectionLine.tsx:39`; `CanvasItem.tsx`; `PropertiesPanel.tsx`; `index.css` `--pm-spring`; `PHASE2_04` AC-11; `PHASE2_05` §9 | **VERIFIED** — non-blocking defect |
| **C-07** | **Undefined CSS classes in Canvas.** `pm-canvas-viewport`, `pm-properties-panel`, `pm-task-picker-option`, `pm-task-card`, `pm-canvas-zoom-indicator` are used but not defined in `index.css`. | `index.css` (absence verified); `PHASE2_05` Appendix B | **VERIFIED** — non-blocking defect |
| **C-08** | **Task-deletion FK blocker not covered by the API contract.** `PHASE3_02` §4.7/D-18 identifies `canvas_items.task_id` FK + `taskService.delete` with no cleanup; `PHASE3_03` §3.4 covers project-match but not delete behaviour. | `PHASE3_02` §4.7, D-18; `PHASE3_03` §3.4; `task.service.ts:163`; `schema.sql:176`; `database/index.ts:16` | **VERIFIED** — gap |
| **C-09** | **AC-11 list counts not supported by the proposed list schema.** `PHASE3_01` AC-11 requires item/connection counts on canvas cards; `PHASE3_03` §3.5.2 list response has no counts. | `PHASE3_01` AC-11; `PHASE3_03` §3.5.2 | **VERIFIED** — gap |
| **C-10** | **Pagination / versioning / ETag decisions are not referenced by the IA or interaction packs.** `PHASE3_03` D9/D10/§3.6 introduce API versioning, pagination, and ETags; `PHASE3_01` and `PHASE3_02` acceptance criteria do not account for paginated canvas detail or version conflicts. | `PHASE3_03` §3.6, D9, D10; `PHASE3_01` §9; `PHASE3_02` §7 | **VERIFIED** — gap |
| **C-11** | **Idempotency-Key decision is isolated.** `PHASE3_03` §3.1/D14 proposes `Idempotency-Key`; `PHASE3_01`/`PHASE3_02` do not reference it. | `PHASE3_03` §3.1, D14 | **VERIFIED** — minor gap |
| **C-12** | **Persistence/save model tension.** `PHASE3_01` D3/AC-19 proposes autosave with visible status; `PHASE3_02` D-11 proposes debounced batch + version precondition; `PHASE3_03` §3.7 proposes per-request `If-Match`. These must be reconciled into one model. | `PHASE3_01` D3, AC-19; `PHASE3_02` D-11; `PHASE3_03` §3.7 | **VERIFIED** — non-blocking, must be unified |
| **C-13** | **Connection label vocabulary tension.** `PHASE3_01` §4.9 proposes labels "relates to / blocks / depends on"; `PHASE3_03` §4.2 forbids `dependency`/`blocks`/`triggers` types; `PHASE3_01` §5 J6 forbids execution vocabulary. "blocks/depends on" are dependency vocabulary that overlaps `task_dependencies` and risks semantic conflation with Automation. | `PHASE3_01` §4.9, §5; `PHASE3_03` §4.2; `PHASE2_05` §7 | **VERIFIED** — decision required (PHASE3_01 D5) |
| **C-14** | **Arrow item type inconsistency.** `PHASE3_02` D-15 proposes deprecating arrow items; `PHASE3_01` §2.8 says the toolbar creates line/arrow items (imprecise — only `line` is reachable); `PHASE3_03` §3.4 keeps `arrow` in the enum. | `PHASE3_02` D-15; `PHASE3_01` §2.8; `PHASE3_03` §3.4; `CanvasToolbar.tsx:8-14`; `Canvas.tsx:110-118` | **VERIFIED** — decision required |
| **C-15** | **Card provenance unverifiable.** `PM-P3-01/02/03/04` do not appear in `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, or `CHECKLIST.md` (0 hits; only self-references in the sibling artifacts). | Repo-wide search; `PHASE3_01` D1; `PHASE3_02` §10.7 | **VERIFIED** — blocking governance |
| **C-16** | **Phase 2 artifacts are moving during the review.** Cross-phase citations are snapshot-dependent. | §2.3 | **VERIFIED** — non-blocking, re-confirm at implementation |
| **C-17** | **Phase 3 status conflict in the source documents.** `ROADMAP.md:79-88` marks Phase 3 complete; `KANBAN_BOARD.md:63-66` and `PRD.md` mark EX-001…EX-004 Pending; `PHASE1_DISCOVERY_DECISION_PACK.md:80` flags PRD/KANBAN as stale. The acceptance criteria are therefore sourced from conflicting documents. | `ROADMAP.md:79-88`; `KANBAN_BOARD.md:63-66`; `PRD.md`; `PHASE1_DISCOVERY_DECISION_PACK.md:80` | **VERIFIED** — governance (PHASE1 Decision A still open) |

---

## 5. Gap findings

| ID | Gap | Evidence | Class |
|---|---|---|---|
| **G-01** | No Canvas test coverage (backend or frontend). | `backend.test.ts` 363 lines, 0 canvas mentions; `PHASE3_01` AC-26; `PHASE3_03` F15 | **VERIFIED** |
| **G-02** | No performance budget or stress test for Canvas. | `PHASE3_02` §5 (UNKNOWN); no measurement recorded | **VERIFIED** |
| **G-03** | No canvas export/import. | `importExport.service.ts` / `importExport.routes.ts` 0 canvas mentions; `design-system.md:302` | **VERIFIED** |
| **G-04** | No explicit Save control, dirty flag, or pending state. | `Canvas.tsx`; `useCanvas.ts`; `PHASE3_01` §4.11 | **VERIFIED** |
| **G-05** | No undo/redo for Canvas. | `useCanvas.ts` (no history); `DesignModeContext.tsx` undo/redo is orphaned | **VERIFIED** |
| **G-06** | No multi-select / marquee / group operations. | `useCanvas.ts:257-265`; `PHASE3_02` §4.5 | **VERIFIED** |
| **G-07** | No keyboard item operations (Delete, Escape, arrows, shortcuts). | `CanvasViewport.tsx:74-105` (Space-pan only); `PHASE3_02` §4.9 | **VERIFIED** |
| **G-08** | No touch / Pointer Events support. | `CanvasViewport.tsx:268-270`; `CanvasItem.tsx` mouse handlers; `PHASE3_02` §4.10-4.11 | **VERIFIED** |
| **G-09** | No connection deletion UI. | `useCanvas.ts:243-255` returned but never called; `canvas.routes.ts:132-142` | **VERIFIED** |
| **G-10** | No connection endpoint choice or direction authoring. | `PropertiesPanel.tsx:603-620` ("first other item"); `PHASE3_02` §4.6 | **VERIFIED** |
| **G-11** | No task relink/unlink on existing items. | `Canvas.tsx:244-253` (picker only while tool = task); `PropertiesPanel.tsx` has no task field | **VERIFIED** |
| **G-12** | No canvas rename/description UI. | `canvas.routes.ts:52-63` exists but unused; `PHASE3_01` D7 | **VERIFIED** |
| **G-13** | No retry or rollback on failed mutations; optimistic state diverges silently. | `useCanvas.ts:144-167`; `Canvas.tsx:167-194`; `PHASE3_02` §6.2 | **VERIFIED** |
| **G-14** | No empty state for a zero-item canvas. | `Canvas.tsx`; `CanvasViewport.tsx`; `PHASE3_02` §6.4 | **VERIFIED** |
| **G-15** | No pagination. | `canvas.service.ts:72-97`; `PHASE3_03` F6 | **VERIFIED** |
| **G-16** | No audit writes from the canvas service. | `canvas.service.ts` (no `audit_logs` insert); `PHASE3_03` F7 | **VERIFIED** |
| **G-17** | No transactionality in canvas mutations. | `canvas.service.ts:127-137`; `PHASE3_03` F8 | **VERIFIED** |
| **G-18** | No ownership / RBAC enforcement on canvas routes. | `canvas.routes.ts:8` (only `requireAuth`); `PHASE3_03` F1 | **VERIFIED** |

---

## 6. Defect register

Verified source defects (each reproducible from the cited path/line). Severity is **PROPOSED**.

| ID | Sev | Defect | Evidence | Source |
|---|---|---|---|---|
| **DF-01** | Critical | No authorization beyond authentication; any authenticated user can read/modify/delete any canvas. | `canvas.routes.ts:8`; no ownership check | `PHASE3_03` F1 |
| **DF-02** | Critical | No canvas-membership validation on item/connection writes; cross-canvas connections possible. | `canvas.service.ts:141-179,187-243,247-262,270-274` | `PHASE3_03` F2 |
| **DF-03** | High | No input validation (`item_type`, geometry, `style` JSON, lengths). | `canvas.service.ts:141-179,187-235,247-262`; `schema.sql:164,175,182-183,195-196` | `PHASE3_03` F3 |
| **DF-04** | High | Inconsistent, leaking error contract (`{error: err.message}` + HTTP 500 everywhere; raw SQLite text). | `canvas.routes.ts:22-24` and every catch; `PHASE2_01` §2.4 | `PHASE3_03` F4 |
| **DF-05** | High | No optimistic concurrency; last-write-wins; failed saves look successful. | `schema.sql:161-198`; `canvas.service.ts:99-125,187-235`; `useCanvas.ts:144-175` | `PHASE3_03` F5 |
| **DF-06** | Medium | No pagination. | `canvas.routes.ts:28-49`; `canvas.service.ts:72-97` | `PHASE3_03` F6 |
| **DF-07** | Medium | No audit trail for canvas mutations. | `canvas.service.ts`; `PHASE2_03` §6.6 (no canvas row) | `PHASE3_03` F7 |
| **DF-08** | Medium | No transactionality in `deleteCanvas`. | `canvas.service.ts:127-137` | `PHASE3_03` F8 |
| **DF-09** | Low | `canvases.updated_at` not bumped by item/connection mutations; list ordering is stale. | `canvas.service.ts:91-97` vs `187-274` | `PHASE3_03` F9 |
| **DF-10** | Medium | No FK cascades; hand-written cascade only. | `schema.sql:174,192-194`; `canvas.service.ts:127-137` | `PHASE3_03` F10 |
| **DF-11** | High | Cross-project task linking possible. | `schema.sql:176`; `canvas.service.ts:141-179` | `PHASE3_03` F11 |
| **DF-12** | Medium | Global canvases (`project_id = null`) are representable but undefined. | `schema.sql:163`; `canvas.routes.ts:13-20` | `PHASE3_03` F12 |
| **DF-13** | Low | No canvas-specific rate limiting. | `server.ts:38`; `index.ts:34` | `PHASE3_03` F13 |
| **DF-14** | Medium | Frontend discards HTTP status; 401/403/404/409 indistinguishable from network failure. | `useCanvas.ts:88,119,156,196,230,249`; `Canvas.tsx:68` | `PHASE3_03` F14 |
| **DF-15** | Medium | No Canvas test coverage. | `backend.test.ts` (0 canvas mentions) | `PHASE3_03` F15 |
| **DF-16** | High | Task-deletion FK blocker: deleting a task linked on a canvas raises an FK error and surfaces as a generic 500. | `schema.sql:176`; `task.service.ts:163`; `database/index.ts:16` | `PHASE3_02` §4.7, D-18 |
| **DF-17** | Low | Dead code: `TaskCard.tsx` (0 imports), `DesignCanvas.tsx` (0 imports), `updateItem` (never consumed), `deleteConnection` (never called), `DragState`/`PanState` (unreferenced). | Import scan; `useCanvas.ts:169-175,243-255,293,297`; `types/canvas.ts:61-76` | `PHASE3_01` §2.5, §2.8; `PHASE3_02` D-19 |
| **DF-18** | Medium | Hardcoded colours and a non-canonical spring constant in canvas components. | `ConnectionLine.tsx:39`; `CanvasItem.tsx`; `PropertiesPanel.tsx`; `index.css` `--pm-spring` | `PHASE2_04` AC-11; `PHASE2_05` §9 |
| **DF-19** | Low | Undefined CSS classes used by Canvas. | `index.css` (absence); `PHASE2_05` Appendix B | **VERIFIED** |
| **DF-20** | Medium | `arrow` item type is unreachable from the toolbar. | `CanvasToolbar.tsx:8-14`; `Canvas.tsx:110-118` | `PHASE3_02` D-15 |
| **DF-21** | Medium | Connection deletion is unreachable from the UI. | `useCanvas.ts:243-255`; `canvas.routes.ts:132-142` | `PHASE3_02` §3 item 13 |
| **DF-22** | Medium | JS pan momentum is not gated by `prefers-reduced-motion`. | `CanvasViewport.tsx:171-204`; `index.css:327-329` | `PHASE3_02` §4.3; `PHASE2_04` AC-22 |
| **DF-23** | High | A single failed mutation blanks the whole editor with a load-error card and no Retry. | `Canvas.tsx:167-194`; `useCanvas.ts:99-103` | `PHASE3_01` §3.3; `PHASE3_02` §6.4 |
| **DF-24** | Medium | Task-picker empty state is indistinguishable from a task-fetch failure. | `useCanvas.ts:67-80`; `TaskPicker.tsx:179-189` | `PHASE3_01` §4.10 |
| **DF-25** | Low | Toolbar tool named "Line/Arrow" blurs the Canvas/Automation boundary. | `CanvasToolbar.tsx:11`; `PHASE3_01` §5 | `PHASE3_01` §5 |
| **DF-26** | Medium | EX-004 icon morphing is not implemented. | 0 "morph" occurrences in canvas code; `design-system.md` §3.1 | **VERIFIED** |

---

## 7. Owner decisions required

Consolidated from the three siblings plus this review. Each is **DECISION-REQUIRED**; the recommended option is shown where the sibling made one.

| ID | Decision | Recommended | Source |
|---|---|---|---|
| **OD-01** | Card provenance and acceptance definition for PM-P3-01/02/03/04 | Confirm the board/tool and paste the card text | `PHASE3_01` D1; `PHASE3_02` §10.7; C-15 |
| **OD-02** | Document authority model (PHASE1 Decision A) | A1 — live tree + `UI_UX_REDESIGN_PLAN.md` authority; PRD/KANBAN stale; ROADMAP historical | `PHASE1_DISCOVERY_DECISION_PACK.md` §6; C-17 |
| **OD-03** | Role model and permission matrix | Project-scoped membership (`Owner/Editor/Viewer/Commenter`) per `PHASE2_02`; do not use `users.role` | `PHASE3_03` D1; `PHASE3_01` D2; `PHASE3_02` D-12; C-01 |
| **OD-04** | Global canvases (`project_id = null`) | Require a project (disallow null) per `PHASE2_02` §3 | `PHASE3_03` D2; `PHASE3_01` D11; C-02 |
| **OD-05** | 403 vs 404 for unauthorized access | 404 read / 403 write | `PHASE3_03` D3 |
| **OD-06** | Self-loops on connections | Reject with 422 | `PHASE3_03` D4 |
| **OD-07** | Duplicate connections | Dedupe idempotently | `PHASE3_03` D5 |
| **OD-08** | Limits (items/connections per canvas, field lengths) | Adopt proposed values in `PHASE3_03` §3.4 | `PHASE3_03` D6 |
| **OD-09** | Versioning mechanism | Add `version` column | `PHASE3_03` D7; `PHASE3_02` D-11 |
| **OD-10** | Delete response shape | 204 + one-release compat | `PHASE3_03` D8 |
| **OD-11** | API versioning | `/api/v1/canvas` | `PHASE3_03` D9 |
| **OD-12** | Pagination style | Offset/limit for v1; cursor follow-up | `PHASE3_03` D10 |
| **OD-13** | Cross-project task linking | Forbid | `PHASE3_03` D11 |
| **OD-14** | Audit scope and coverage | Successes + failures; add canvas row to `PHASE2_03` §6.6 | `PHASE3_03` D12, §3.9; C-05 |
| **OD-15** | Batch endpoints | None in v1 | `PHASE3_03` D13 |
| **OD-16** | `Idempotency-Key` | Later (v1 unless create-retry is a known problem) | `PHASE3_03` D14 |
| **OD-17** | `item_type` change after creation | Allowed with `task_id` cleanup | `PHASE3_03` D15 |
| **OD-18** | Canvas export/import scope | Decide and align all three siblings | `design-system.md:302`; `PHASE3_01` D8; `PHASE3_02` §7.3; `PHASE3_03` §7; C-04 |
| **OD-19** | Persistence / save model | Autosave with visible status + version precondition; reconcile the three proposals | `PHASE3_01` D3; `PHASE3_02` D-11; `PHASE3_03` §3.7; C-12 |
| **OD-20** | Undo/redo scope and retention | Session-local client history | `PHASE3_01` D4; `PHASE3_02` D-05 |
| **OD-21** | Connection semantics — map to `task_dependencies`? | Keep purely visual | `PHASE3_01` D5; `PHASE3_02` §8; `PHASE3_03` §4; C-13 |
| **OD-22** | Arrow item type | Deprecate arrow items; keep `connection_type: arrow` | `PHASE3_02` D-15; C-14 |
| **OD-23** | Rotation field | Add a control or remove the field | `PHASE3_02` D-16 |
| **OD-24** | Task-deletion FK handling | Unlink canvas items on task delete (or `SET NULL`) | `PHASE3_02` D-18; C-08 |
| **OD-25** | Orphaned assets | Revive `TaskCard`; keep `DesignCanvas` excluded; do not delete without approval | `PHASE3_01` D6; `PHASE3_02` D-19 |
| **OD-26** | Canvas metadata editing | Expose rename/description in the UI | `PHASE3_01` D7 |
| **OD-27** | Connection authoring model | Drag port-to-port with endpoint picker | `PHASE3_01` D9; `PHASE3_02` D-08 |
| **OD-28** | Zoom / fit / minimap / touch | Cursor-anchored zoom + fit + buttons; Pointer Events; minimap when scale requires | `PHASE3_01` D10; `PHASE3_02` D-03, D-06, D-10 |
| **OD-29** | Validation and duplicate prevention | Add service/route validation; prevent duplicate connections | `PHASE3_01` D12 |
| **OD-30** | Automation boundary ownership | Confirm Decision C (preview-only) remains in force | `PHASE3_01` D13 |
| **OD-31** | Accessibility conformance level | Adopt WCAG 2.2 AA for Canvas | `PHASE3_01` D14 |
| **OD-32** | Test coverage | Add Canvas API/hook/component tests before extending | `PHASE3_01` D15 |

---

## 8. Recommendation

### REQUEST CHANGES

The three specifications are a strong, evidence-based baseline and are recommended as the starting point for Phase 3 implementation — but they are **not approved** as the implementation contract until the blocking items below are resolved and recorded. Approving now would freeze a role model, a canvas-scope rule, and an export/import scope that contradict the Phase 2 shared-foundation artifacts, and would leave the Phase 3 acceptance criteria unmet.

### 8.1 Blocking changes (must be resolved before approval)

| # | Required change | Finds |
|---|---|---|
| **B-1** | Resolve the role-model conflict: align `PHASE3_03` §3.3/D1 with `PHASE2_02` project-scoped membership, or record an explicit owner override of `PHASE2_02`. | C-01, OD-03 |
| **B-2** | Resolve the global-canvas conflict: choose one rule for `project_id = null` that is consistent with `PHASE2_02` §3. | C-02, OD-04 |
| **B-3** | Correct `PHASE3_02` §7.2: there is no existing project membership model; state the target model instead. | C-03 |
| **B-4** | Decide canvas export/import scope and align `PHASE3_01` AC-19/D8, `PHASE3_02` §7.3, and `PHASE3_03` §7. | C-04, OD-18 |
| **B-5** | Establish card provenance and the acceptance definition (OD-01) and the document authority model (OD-02). | C-15, C-17 |
| **B-6** | Reconcile the persistence/save model (autosave vs debounced batch vs `If-Match`) into one contract. | C-12, OD-19 |
| **B-7** | Decide connection semantics and label vocabulary (visual-only vs dependency mapping). | C-13, OD-21 |
| **B-8** | Add the canvas audit row to `PHASE2_03` §6.6 (or record why Canvas is excluded). | C-05, OD-14 |
| **B-9** | Add Canvas test coverage to the Phase 3 acceptance criteria; currently zero. | PC-09, PC-12, G-01 |

### 8.2 Non-blocking changes (fix before implementation)

| # | Required change | Finds |
|---|---|---|
| **N-1** | Replace hardcoded colours and the local `spring` constant with `--pm-*` tokens. | DF-18, C-06 |
| **N-2** | Define or remove the undefined Canvas CSS classes. | DF-19, C-07 |
| **N-3** | Add task-deletion FK handling to the API contract. | DF-16, C-08 |
| **N-4** | Add item/connection counts to the canvas list schema. | C-09 |
| **N-5** | Reference pagination/versioning/ETag decisions in `PHASE3_01` and `PHASE3_02`. | C-10, C-11 |
| **N-6** | Decide the arrow item type and correct `PHASE3_01` §2.8. | DF-20, C-14 |
| **N-7** | Rename the "Line/Arrow" toolbar tool. | DF-25 |
| **N-8** | Implement icon morphing or amend the EX-004 acceptance criterion. | DF-26 |
| **N-9** | Re-confirm all cross-phase citations after the Phase 2 artifacts are frozen. | C-16 |

### 8.3 Conditions to approve

Approval can be granted once: (a) B-1…B-9 are recorded as owner decisions; (b) the three siblings are updated to reflect them; (c) the Phase 2 artifact set is frozen and cross-phase citations re-confirmed; and (d) the Phase 3 acceptance criteria in §3 are re-scored against the updated specifications.

---

## 9. Verification

- This artifact exists at `<workspace>\PHASE3_04_CANVAS_SPEC_APPROVAL.md`.
- Byte size and SHA-256 are reported in the PM-P3-04 card completion report (the parent artifact log), because a file cannot contain its own final hash. This follows the convention used by `PHASE3_02` §12.
- No application source file was modified by this review. No server was started. No build, DB, or schema change was made.
- Review snapshot: sibling artifacts at the hashes in §2.1; Phase 2 artifacts are concurrently moving (§2.3).

---

*Prepared as a read-only Phase 3 planning artifact. This is a specification approval gate, not an implementation authorization and not a source-code change.*
