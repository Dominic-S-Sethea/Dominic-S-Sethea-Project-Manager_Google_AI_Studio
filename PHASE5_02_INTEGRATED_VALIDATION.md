# PM-P5-02 — Integrated UX, Accessibility, Security & Feasibility Validation

| Field | Value |
|---|---|
| Kanban card | **PM-P5-02** |
| Title | Integrated UX, accessibility, security, and feasibility review of the Phase 1–4 planning packages |
| Status | **COMPLETE — REQUEST CHANGES / NOT APPROVAL-READY** |
| Date | 2026-11-10 |
| Repository | `<workspace>` |
| Git branch / HEAD | `main` / `d705a364b2e845eb02f33d57475e0e3af15228c7` (REPORTED by Phase 1–4 packages; not re-run in this review) |
| Scope | Read-only validation. **No application source, schema, data, credential, environment, or configuration was modified.** |
| Method | Full reads of the four phase approval packages and their sibling artifacts; targeted re-reads of cited live source; independent recomputation of contrast ratios; SHA-256 verification of all recorded artifact hashes; targeted greps for card provenance, dead code, audit writes, and test coverage. No server started, no build run, no DB/schema change. |
| Evidence labels | **VERIFIED** = read directly from the current working tree or independently re-derived in this review. **REPORTED** = stated in a project document but not independently proved here. **PROPOSED** = recommended, not approved. **UNKNOWN** = not currently verifiable. **DECISION-REQUIRED** = owner decision needed. |

---

## 1. Executive summary and verdict

The Phase 1–4 planning programme is **evidence-dense and internally honest**: every package labels its claims, cites exact paths and line numbers, and correctly refuses to authorize implementation. The live source confirms the central current-state claims: Project Canvas is materially implemented but mouse-only and unaudited; Automation Studio is a labelled preview-only mock with no runtime; the connector layer returns plaintext secrets; RBAC is not enforced; and no migration ledger, audit writer, or automation tables exist.

**Verdict: REQUEST CHANGES — the integrated set is not approval-ready.** The individual phases are strong, but the programme as a whole cannot be approved until the blocking cross-phase conflicts, governance gaps, and prerequisite defects below are resolved and recorded.

### Blocking findings (summary)

1. **Role-model conflict (cross-phase):** Phase 3 proposes global `admin|manager|editor|viewer` roles on `users.role`; Phase 2 mandates project-scoped five-actor membership and explicitly excludes `users.role` from project decisions. Phase 3 also omits `commenter`.
2. **Global-canvas conflict:** Phase 3 proposes admin-only `project_id = null` canvases; Phase 2 requires every Canvas to resolve to exactly one project; Phase 1 permits null + "All projects".
3. **Phantom membership model:** Phase 3 interaction text references an "existing project membership model"; no `project_members` table exists.
4. **Export/import scope conflict:** `design-system.md` requires Canvas export/import; Phase 3 IA treats it as required; Phase 3 interactions defer it; Phase 3 API contract lists it as a non-goal.
5. **Card provenance gap:** `PM-P2-*`, `PM-P3-*`, `PM-P4-*`, and `PM-P5-02` do not appear in `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, or `CHECKLIST.md`; acceptance definitions are unverifiable.
6. **Phase 2 approval package indexes a superseded draft:** the package lists `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY_DRAFT.md` (21,615 bytes) as P2-04, while the canonical final `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md` (48,739 bytes) is the token reference used by P2-05 and P4-01. The owner would be approving the wrong artifact.
7. **Prerequisite foundation is absent:** the Phase 2 foundation (RBAC enforcement, migration ledger, outbox, audit writer, connector redaction) is not built; Phase 3/4 implementation is not feasible until it is.

### Non-blocking findings (summary)

- Phase 3 package records an incorrect SHA-256 for `PHASE3_03_CANVAS_API_CONTRACT.md` (one hex character).
- Phase 1 reports 15 backend tests; the current file contains 14 `test(...)` cases.
- Canvas hardcoded colours, non-canonical spring constant, undefined CSS classes, dead code.
- Porcelain theme status/muted contrast failures (independently recomputed).
- Accessibility infrastructure gaps (skip link, focus trap, `sr-only`, page title, keyboard canvas).
- Build/deploy blockers (TS5096, Docker port mismatch, stale `dist` schema, CI omits backend build).

---

## 2. Reviewed artifacts and hash verification

### 2.1 Artifact set

| Phase | Artifact | Bytes | Recorded SHA-256 | Hash check |
|---|---|---:|---|---|
| 1 | `PHASE1_DISCOVERY_DECISION_PACK.md` | 16,975 | `0f9d5e4b75eb697d…` | MATCH (first 16, per P4-03 index) |
| 2 | `PHASE2_01_SHARED_ARCHITECTURE.md` | 46,140 | `d46375f68b1f3c0f…` | MATCH |
| 2 | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md` | 16,396 | `a45747e154517fd2…` | MATCH |
| 2 | `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md` | 46,171 | `ed604eb196e3fbef…` | MATCH |
| 2 | `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY_DRAFT.md` | 21,615 | `108772a3024c70ba…` | MATCH (draft — superseded) |
| 2 | `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md` | 48,739 | not listed in Phase 2 package | **NOT INDEXED** |
| 2 | `PHASE2_05_SHARED_COMPONENT_CATALOG.md` | 60,504 | `42c0c5c245df4dbe…` | MATCH |
| 2 | `PHASE2_SHARED_FOUNDATIONS_DRAFT.md` | 28,000 | `19121aa8fc06329f…` | MATCH |
| 3 | `PHASE3_01_CANVAS_IA_JOURNEYS.md` | 48,630 | `e2c1e80e39546ad5…` | MATCH |
| 3 | `PHASE3_02_CANVAS_INTERACTIONS.md` | 34,901 | `5c56629b58f66311…` | MATCH |
| 3 | `PHASE3_03_CANVAS_API_CONTRACT.md` | 42,129 | `d464d83abe235b16…` | **MISMATCH (full hash)** |
| 3 | `PHASE3_04_CANVAS_SPEC_APPROVAL.md` | 34,151 | `4e6c90fcf0bd92a2…` | MATCH |
| 4 | `PHASE4_01_AUTOMATION_IA_REGIONS.md` | 51,361 | `e3f0b38c55745be8…` | MATCH |
| 4 | `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md` | 40,617 | `efd51dab0511e565…` | MATCH |
| 4 | `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md` | 69,262 | `4b6935e29e7aff31…` | MATCH |

### 2.2 Hash verification result (VERIFIED)

- **`PHASE3_03_CANVAS_API_CONTRACT.md` full-hash mismatch.** `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:20` records `d464d83abe235b1698289eff91eef4739ba1b2557a482e002a6fe8d82bcd1555`; the actual file hash is `d464d83abe235b1698289eff91eef4739ba1b2557a482e002a6fe4d82bcd1555` (one hex character: `fe8d` vs `fe4d`). The sibling gate `PHASE3_04_CANVAS_SPEC_APPROVAL.md:63` records the **correct** `…fe4d…` value. Byte size matches exactly (42,129), so this is a transcription error in the Phase 3 approval package, not a content change of differing length. **Classification: documentation-integrity defect (non-blocking; correct before the owner gate).**
- **All other recorded sizes and hashes match the current working tree.** The Phase 2 snapshot drift reported in `PHASE3_04_CANVAS_SPEC_APPROVAL.md:43,71` (`PHASE2_05` 27,895 → 60,187 bytes; `PHASE2_04` draft → final) has settled: the current set is stable at the hashes above.

### 2.3 Phase 2 package indexes a superseded draft (VERIFIED)

`PHASE2_FOUNDATION_APPROVAL_PACKAGE.md:23` lists P2-04 as `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY_DRAFT.md` (21,615 bytes) and `:148` cites the draft in its evidence index. The final `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md` (48,739 bytes) exists, is titled "Canonical `--pm-*` Design-Token Dictionary & Accessibility Rules", and is the token reference actually used by `PHASE2_05_SHARED_COMPONENT_CATALOG.md:12` and `PHASE4_01_AUTOMATION_IA_REGIONS.md` (both cite the final, not the draft). The draft's own header says it is an "Owner-review draft; … not yet ratified" (`PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY_DRAFT.md:3`). **The Phase 2 approval package therefore points the owner at a superseded artifact.** This is a governance/approval-integrity defect, not a design defect.

---

## 3. Cross-phase consistency findings

| ID | Severity | Finding | Evidence | Label |
|---|---|---|---|---|
| **CC-01** | **Blocking** | **Role-model conflict.** P3-03 §3.3/D1 proposes global roles `admin\|manager\|editor\|viewer` on `users.role` + `requireRole`; P2-02 §2.1/§3 mandates project-scoped membership (`Owner/Editor/Viewer/Commenter`) and says keep `users.role` out of project permission decisions. P3-03 omits `commenter`. | `PHASE3_03_CANVAS_API_CONTRACT.md:227-245,521-539`; `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:20-59`; `PHASE3_04_CANVAS_SPEC_APPROVAL.md:104` | VERIFIED |
| **CC-02** | **Blocking** | **Global-canvas conflict.** P3-03 D2 proposes admin-only `project_id = null` canvases; P3-01 D11 option (a) allows null + "All projects"; P2-02 §3 says every Canvas must resolve to exactly one project and must not become globally readable. | `PHASE3_03_CANVAS_API_CONTRACT.md:233-234,526`; `PHASE3_01_CANVAS_IA_JOURNEYS.md:517`; `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:61` | VERIFIED |
| **CC-03** | **Blocking** | **Phantom membership model.** P3-02 §7.2 says "align with the existing project membership model"; no `project_members` table exists. | `PHASE3_02_CANVAS_INTERACTIONS.md:239`; `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:11`; `backend/src/database/schema.sql` (18 tables, no `project_members`) | VERIFIED |
| **CC-04** | **Blocking** | **Export/import scope conflict.** `design-system.md` requires Canvas save/load and export/import; P3-01 AC-19/D8 treats it as required; P3-02 §7.3 lists it as Extend requiring approval; P3-03 §7 lists it as a non-goal. | `PHASE3_01_CANVAS_IA_JOURNEYS.md:492,514`; `PHASE3_02_CANVAS_INTERACTIONS.md:245`; `PHASE3_03_CANVAS_API_CONTRACT.md:547`; `design-system.md:296,302` (REPORTED) | VERIFIED |
| **CC-05** | **Blocking (governance)** | **Card provenance gap.** `PM-P2-*`, `PM-P3-*`, `PM-P4-*`, `PM-P5-02` do not appear in `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, or `CHECKLIST.md`; only self-references inside the phase artifacts. | Repo-wide search (0 hits in the four authority docs); `PHASE3_04_CANVAS_SPEC_APPROVAL.md:118`; `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md:160-162` | VERIFIED |
| **CC-06** | **Blocking (governance)** | **Phase 2 package indexes the superseded P2-04 draft.** The owner gate would approve the draft, not the canonical final used by later phases. | `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md:23,148`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY_DRAFT.md:3`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md:12` | VERIFIED |
| **CC-07** | Non-blocking | **Phase 3 package P3-03 hash is wrong by one hex character.** | `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:20` vs actual `d464d83abe235b16…fe4d…`; `PHASE3_04_CANVAS_SPEC_APPROVAL.md:63` | VERIFIED |
| **CC-08** | Non-blocking | **Phase 2 snapshot drift has settled but is not re-confirmed by the Phase 2 package.** P3-04 §2.3 recorded concurrent rewrites; the current set matches the recorded hashes, but the Phase 2 package still cites the draft. | `PHASE3_04_CANVAS_SPEC_APPROVAL.md:49-71`; §2.1/2.2 above | VERIFIED |
| **CC-09** | Non-blocking | **Phase 1 test count discrepancy.** Phase 1 reports "15 pass, 0 fail"; the current `backend/src/tests/backend.test.ts` contains **14** `test(...)` cases and 0 canvas mentions. The file is unmodified since commit `e2b4944`. | `PHASE1_DISCOVERY_DECISION_PACK.md:41,188`; `backend/src/tests/backend.test.ts` (14 literal test names) | VERIFIED count / UNKNOWN cause |
| **CC-10** | Non-blocking | **PRD and KANBAN are byte-identical** (same SHA-256 `e53b9088c412fec5…`), so they are not independent authority sources. | `PRD.md`; `KANBAN_BOARD.md`; `PHASE1_DISCOVERY_DECISION_PACK.md:78` | VERIFIED |
| **CC-11** | Non-blocking | **Automation boundary is consistent across phases.** All four packages keep Automation preview-only and keep Canvas non-execution. | `PHASE1_DISCOVERY_DECISION_PACK.md:148-153`; `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:63`; `PHASE3_03_CANVAS_API_CONTRACT.md:470-483`; `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md:846-859` | VERIFIED |
| **CC-12** | Non-blocking | **Phase 4 depends on Phase 2 foundation and Phase 3 approval; the dependency is stated but unscheduled.** | `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md:238,763-775`; `PHASE4_AUTOMATION_SPEC_APPROVAL_PACKAGE.md:121-125` | VERIFIED |
---

## 4. UX review — Phase 2 token/component contracts and Phase 3/4 interaction contracts

### 4.1 Token-contract compliance (Phase 2 contract: P2-04 §5, §7; P2-05 §5.1)

| ID | Severity | Finding | Evidence | Label |
|---|---|---|---|---|
| **UX-01** | Medium | **Canvas hardcodes colours** (`#3b82f6`, `#64748b`) instead of `--pm-*` tokens; P2-04 AC-11 forbids hardcoded values. | `frontend/src/components/canvas/ConnectionLine.tsx:39`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:605`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md:371` | VERIFIED |
| **UX-02** | Medium | **Non-canonical spring constant** in Canvas components (`cubic-bezier(0.34,1.56,0.64,1)`) vs canonical `--pm-spring: cubic-bezier(0.22,1,0.36,1)`. | `ConnectionLine.tsx:47-48`; `frontend/src/index.css:33`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md:333-336` | VERIFIED |
| **UX-03** | Medium | **Undefined CSS classes** used by Canvas (`pm-canvas-viewport`, `pm-properties-panel`, `pm-task-card`, `pm-canvas-zoom-indicator`, `pm-input`, `pm-status-pill`, `pm-task-check`, etc.); P2-05 Appendix B lists 14. | `frontend/src/index.css` (absence verified for all 14); `PHASE2_05_SHARED_COMPONENT_CATALOG.md:969-971` | VERIFIED |
| **UX-04** | Low | **Dead bridge tokens** `--color-*` (10) are unused outside `index.css`; P2-04 F-08/G-12 unresolved. | `frontend/src/index.css:34-43`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:97,217-219,283` | VERIFIED |
| **UX-05** | Low | **Documentation references nonexistent tokens** `--pm-bg`, `--pm-glass-border`; P2-04 proposes read-only aliases. | `docs/AI_CONTEXT.md:16`; `handoff_future_uiux.md:39`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:188-199,285-293` | VERIFIED |

### 4.2 Component-contract compliance (Phase 2 contract: P2-05 §6)

| ID | Severity | Finding | Evidence | Label |
|---|---|---|---|---|
| **UX-06** | High | **No shared React primitive layer.** 31 components (32 `.tsx` files including the `ui/Icon.tsx` re-export shim); every overlay is hand-rolled; 5 inconsistent dialog implementations; no focus trap or focus return anywhere except `ProjectSwitcher`. | `frontend/src/components/**`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md:32-34,285-314,350-381` | VERIFIED |
| **UX-07** | High | **Canvas is not keyboard operable.** The only keyboard behaviour is Space-pan; no Delete/Escape/arrow-nudge/Ctrl+Z; viewport is a plain `div` with no `role`, `tabIndex`, or `aria-label`; items are not focusable. | `frontend/src/components/canvas/CanvasViewport.tsx:74-105`; `PHASE3_02_CANVAS_INTERACTIONS.md:134-139`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md:326,373` | VERIFIED |
| **UX-08** | High | **Canvas has no touch/Pointer Events support.** All gestures are mouse-only; touch devices cannot pan, zoom, drag, or resize. | `PHASE3_02_CANVAS_INTERACTIONS.md:141-150`; `CanvasViewport.tsx:268-270`; `CanvasItem.tsx:429` | VERIFIED |
| **UX-09** | Medium | **Connection authoring is broken.** The only UI path connects to an arbitrary first item; `connection_type = line` is unreachable; `deleteConnection` has no UI caller. | `frontend/src/components/canvas/PropertiesPanel.tsx:603-620`; `frontend/src/hooks/useCanvas.ts:243-255`; `PHASE3_02_CANVAS_INTERACTIONS.md:110-118` | VERIFIED |
| **UX-10** | Medium | **Task linking is creation-time only**; `TaskCard.tsx` is dead code, so live status/priority are not shown on the canvas. | `frontend/src/pages/Canvas.tsx:244-253`; `frontend/src/components/canvas/TaskCard.tsx` (0 imports); `PHASE3_02_CANVAS_INTERACTIONS.md:120-127` | VERIFIED |
| **UX-11** | Medium | **Automation Studio preview is a 4-of-6 node mock.** `NodeId` union is `trigger\|condition\|notify\|review`; `transform` is absent; the error-handler button is non-functional. | `frontend/src/pages/AutomationStudio.tsx:4,7-12,68-71`; `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md:151-164` | VERIFIED |
| **UX-12** | Medium | **Canvas error/recovery UX is inconsistent.** A failed mutation blanks the editor with a Go-back-only card; `CanvasList` has Retry but `Canvas` does not; no `clearError`, no rollback, no pending indicators. | `frontend/src/pages/Canvas.tsx:167-194`; `frontend/src/hooks/useCanvas.ts:99-103,148-167`; `PHASE3_02_CANVAS_INTERACTIONS.md:204-211` | VERIFIED |
| **UX-13** | Low | **Terminology blur.** Canvas toolbar tool is named "Line/Arrow"; P2-05 §7 forbids Automation vocabulary in Canvas contexts. | `frontend/src/components/canvas/CanvasToolbar.tsx:11`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md:866-876` | VERIFIED |
| **UX-14** | Low | **Dead code.** `TaskCard.tsx` and `DesignCanvas.tsx` have zero imports; `updateItem`/`deleteConnection` hook methods are unused; `@dnd-kit/*` dependencies are never imported. | Import scan; `frontend/package.json` (`@dnd-kit/core`, `@dnd-kit/utilities`); `PHASE2_05_SHARED_COMPONENT_CATALOG.md:261,372` | VERIFIED |

### 4.3 Phase 3/4 interaction-contract compliance

| ID | Severity | Finding | Evidence | Label |
|---|---|---|---|---|
| **UX-15** | Medium | **Phase 3 proposed interaction contracts are not implemented** (multi-select, marquee, cursor-anchored zoom, fit-to-content, port-to-port connections, undo/redo, keyboard map, touch). The shipped model remains mouse-first, single-select. | `PHASE3_02_CANVAS_INTERACTIONS.md:228-248`; `PHASE3_04_CANVAS_SPEC_APPROVAL.md:81-94` | VERIFIED |
| **UX-16** | Medium | **Phase 4 proposed interaction contracts are not implemented** (node library, validation states, execution traces, approval gates, test mode). The preview is static sample data with no `fetch`. | `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md:580-604`; `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md:677-759`; `AutomationStudio.tsx:1-18,29-30,216,231` | VERIFIED |
| **UX-17** | Low | **Automation Studio has no accessibility semantics** (no `role=tablist`, no arrow-key node nav, no live region); P2-05 F-23 flags the same. | `frontend/src/pages/AutomationStudio.tsx`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md:327,374` | VERIFIED |

---

## 5. Accessibility review

### 5.1 Contrast (VERIFIED by independent recomputation)

P2-04 §8.1 measured values were reproduced with the WCAG relative-luminance formula on the actual token values (panel = glass over canvas + `rgba(255,255,255,0.055)` sheen). Results match within rounding:

| Pair | P2-04 | Recomputed | Verdict |
|---|---:|---:|---|
| crystal muted on panel | 4.09 ✗ | 4.09 ✗ | FAIL AA |
| violet muted on panel | 4.01 ✗ | — | FAIL AA |
| ember muted on panel | 3.97 ✗ | — | FAIL AA |
| porcelain muted on panel | 4.10 ✗ | 4.14 ✗ | FAIL AA |
| porcelain success on panel | 1.71 ✗ | 1.72 ✗ | FAIL AA |
| porcelain warning on panel | 1.64 ✗ | 1.65 ✗ | FAIL AA |
| porcelain danger on panel | 2.43 ✗ | 2.45 ✗ | FAIL AA |
| porcelain info on panel | 1.90 ✗ | 1.92 ✗ | FAIL AA |
| porcelain accent ink on accent | 4.31 ✗ | 4.22 ✗ | FAIL AA |

**Finding A11-01 (High):** Porcelain status colours fail AA by a wide margin because the porcelain theme block (`frontend/src/index.css:443-457`) defines only 12 surface/text/shadow tokens and inherits dark-theme status colours from `:root`. P2-04 §7.1/C-05 correctly identifies this as a P1 defect. **VERIFIED.**

**Finding A11-02 (Medium):** Muted text fails AA on panel in crystal, violet, ember, and porcelain. **VERIFIED.**

### 5.2 Keyboard, focus, and screen-reader findings

| ID | Severity | Finding | Evidence | Label |
|---|---|---|---|---|
| **A11-03** | High | **No skip-to-content link; no `.sr-only`/visually-hidden utility.** | `frontend/src/index.css` (0 matches); `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:233-240,526` | VERIFIED |
| **A11-04** | High | **No focus trap or focus return in any dialog.** Only `ProjectSwitcher.tsx` calls `.focus()`; `TaskWorkspace.tsx:1235` uses `autoFocus` but no trap/return. | Import/focus scan; `PHASE2_05_SHARED_COMPONENT_CATALOG.md:305-314,354`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:525` | VERIFIED |
| **A11-05** | High | **Canvas is not keyboard operable** and has no accessible name/role; selection changes are not announced. | `CanvasViewport.tsx:74-105,248-271`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:527,543`; `PHASE3_04_CANVAS_SPEC_APPROVAL.md:91` | VERIFIED |
| **A11-06** | Medium | **No Escape handling in dialogs**; only the AppShell global handler closes the palette/theme/mobile nav. | `frontend/src/components/layout/AppShell.tsx:588-592`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md:355` | VERIFIED |
| **A11-07** | Medium | **Mobile nav toggle lacks `aria-expanded`/`aria-controls`.** | `AppShell.tsx:609-616`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:531` | VERIFIED |
| **A11-08** | Medium | **Horizontally scrollable task region is not keyboard-focusable or labelled.** `.pm-task-surface` has `overflow-x:auto` and `.pm-task-table` has `min-width:700px`, but no `tabIndex`/`aria-label`. | `frontend/src/index.css:403`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:239,532` | VERIFIED |
| **A11-09** | Medium | **Inline `outline: "none"`** at `ProjectSwitcher.tsx:264` removes focus indication without a replacement. | `ProjectSwitcher.tsx:264`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:423,530` | VERIFIED |
| **A11-10** | Medium | **Static page `<title>`** ("Project Manager") does not update per route. | `frontend/index.html:7`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:238,547` | VERIFIED |
| **A11-11** | Medium | **JS pan momentum is not gated by `prefers-reduced-motion`.** The CSS kill-switch exists (`index.css:327-329`) but the `requestAnimationFrame` momentum loop is unconditional. | `CanvasViewport.tsx:171-204`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:450-460`; `PHASE3_04_CANVAS_SPEC_APPROVAL.md:176` | VERIFIED |
| **A11-12** | Medium | **Touch targets below the project 44px standard** (controls 27–37px); meets the 24px AA minimum but fails the documented standard. | `frontend/src/index.css:162,193,214,352,403`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:373-385,551` | VERIFIED |
| **A11-13** | Low | **Theme switcher uses inconsistent ARIA patterns** (`aria-pressed` in `ThemeCustomizer`, `aria-checked` in `ProjectSwitcher`). | `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:545` | REPORTED |
| **A11-14** | Low | **No error boundaries or Suspense.** | `frontend/src/main.tsx`; `frontend/src/App.tsx`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md:376` | REPORTED |
---

## 6. Security, permission, and secret-redaction review

### 6.1 Live-source security findings (all VERIFIED)

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| **SEC-01** | **Critical** | **Canvas routes use only `requireAuth`.** Any authenticated user can read/update/delete any canvas, item, or connection by ID. | `backend/src/routes/canvas.routes.ts:8`; no ownership/role check in any canvas route |
| **SEC-02** | **Critical** | **Connector secrets are returned unredacted and without ownership checks.** `listInstances` returns `config: JSON.parse(row.config)`; `getInstance` has no ownership check; `createInstance` writes the full config JSON and plaintext `connector_configs.value` with only an `is_secret` flag. | `backend/src/services/connector.service.ts:76-97,99-114,116-139`; `backend/src/routes/connectors.routes.ts:8,13`; `backend/src/database/schema.sql:205-226` |
| **SEC-03** | **High** | **RBAC is not enforced.** `requireRole` exists but is used only in `users.routes.ts`; canvas and connector routes apply `requireAuth` only. | `backend/src/middleware/auth.middleware.ts:24-32`; `canvas.routes.ts:8`; `connectors.routes.ts:8,13` |
| **SEC-04** | **High** | **Hardcoded JWT fallback secret** `"project-manager-jwt-secret"` in auth code paths. | `backend/src/middleware/auth.middleware.ts:15`; `backend/src/services/auth.service.ts` (REPORTED by P4-03 §2.3) |
| **SEC-05** | **High** | **Agent registration is broken by schema drift.** Code inserts `agents.expires_at` and an `agent_tokens` table; neither exists in the schema or live DB. | `backend/src/services/agentAuthService.ts:33-43`; `backend/src/database/schema.sql:94-106` (no `expires_at`) |
| **SEC-06** | **High** | **No audit writer.** `audit_logs` exists but no `INSERT INTO audit_logs` exists anywhere in `backend/src`. | `backend/src/database/schema.sql:79-92`; repository-wide search (0 hits) |
| **SEC-07** | **High** | **No migration ledger.** `backend/src/database/migrations/` is empty; `migrate.ts` is a no-op; `db:seed`/`db:reset` scripts reference missing files. | `backend/src/database/migrations/` (`[]`); `backend/src/database/migrate.ts:1-10`; `backend/package.json` scripts |
| **SEC-08** | **High** | **Backend production build fails** (`allowImportingTsExtensions` without `noEmit`/`emitDeclarationOnly` → TS5096). | `backend/tsconfig.json:19` |
| **SEC-09** | **High** | **Container port mismatch.** App listens on `NODE_PORT \|\| "3000"`; Docker/Compose/CI use `4000`. Compose sets `PORT=4000` (not `NODE_PORT`), so the app still binds 3000. | `backend/src/server.ts:98`; `Dockerfile:25,28`; `docker-compose.yml:9,12,22` |
| **SEC-10** | **High** | **Runtime schema path is stale/unreproducible.** Backend reads `dist/database/schema.sql`; `tsc` does not copy SQL and `.dockerignore` excludes `dist/`; the existing `dist/database/schema.sql` is stale (4,891 bytes, 2026-11-06 vs src 9,599 bytes, 2026-11-09). | `backend/src/database/index.ts:9`; `backend/tsconfig.json`; `.dockerignore:3`; `backend/dist/database/schema.sql` vs `backend/src/database/schema.sql` |
| **SEC-11** | Medium | **Static health check** returns `{status:"ok", database:"connected"}` without a DB probe. | `backend/src/index.ts:54-56`; `backend/src/server.ts:58-60` |
| **SEC-12** | Medium | **Bearer token stored in `localStorage`** (`pm_token`, `pm_user`). | `frontend/src/hooks/useAuth.tsx:13-17` |
| **SEC-13** | Medium | **CI does not run the backend build**, so TS5096 is not gated. | `.github/workflows/ci-cd.yml:28-35` |
| **SEC-14** | Medium | **No canvas-specific rate limiting** beyond the global `/api` limiter. | `backend/src/server.ts:38`; `backend/src/index.ts:34` |
| **SEC-15** | Medium | **Task-deletion FK blocker.** `canvas_items.task_id` has no `ON DELETE` action; `taskService.delete` performs a raw delete with no dependent cleanup; `PRAGMA foreign_keys = ON`. Deleting a linked task raises an FK error and surfaces as a generic 500. | `backend/src/database/schema.sql:176`; `backend/src/services/task.service.ts:160-165`; `backend/src/database/index.ts:16` |
| **SEC-16** | Medium | **Raw driver errors leak to clients.** Every canvas catch returns HTTP 500 with `{ error: err.message }`. | `backend/src/routes/canvas.routes.ts:22-24` and every catch; `connectors.routes.ts:18` |
| **SEC-17** | Medium | **Frontend discards HTTP status codes**, so 401/403/404/409 are indistinguishable from network failure. | `frontend/src/hooks/useCanvas.ts:88,119,156,196,230,249` |
| **SEC-18** | Low | **No Canvas tests** (backend or frontend); backend suite has 0 canvas mentions. | `backend/src/tests/backend.test.ts` (0 canvas mentions); `frontend/package.json` (no test script) |

### 6.2 Policy-vs-implementation gap

The Phase 2/4 security policies (P2-02 §3–5; P4-03 §5–7) are **PROPOSED only**. The live implementation does not enforce them:

- Project-scoped RBAC and membership: **not implemented** (no `project_members` table).
- Connector credential references, write-only UX, redaction: **not implemented** (plaintext secrets returned).
- Audit writer, outbox, idempotency, retry/timeout/cancellation: **not implemented**.
- Redaction module: **not implemented**; the connector leak path is verified live (SEC-02).

**Finding SEC-19 (Critical):** The connector layer is not safe to automate. Any Automation action node would inherit SEC-02/SEC-03. P4-03 §2.4 and P4-02 §9.4 correctly record this as a prerequisite. **VERIFIED.**

---

## 7. Feasibility and dependency review

### 7.1 Dependency map (VERIFIED from the packages)

| Dependency | Status | Evidence |
|---|---|---|
| Phase 2 token/component foundation → Phase 3 Canvas implementation | **Not built.** The shared primitive layer, focus trap, z-index tokens, and canonical token families are all PROPOSED. | `PHASE2_05_SHARED_COMPONENT_CATALOG.md:880-913`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md:563-585` |
| Phase 2 RBAC/migration/outbox/audit/redaction → Phase 3/4 implementation | **Not built.** All are PROPOSED; live enforcement is absent. | `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md:79-99`; `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md:238,763-775` |
| Phase 2 approval → Phase 3 specification approval → Phase 4 runtime decision | **Sequence stated, not recorded.** Phase 3 is at REQUEST CHANGES; Phase 4 is at a runtime DECISION-REQUIRED gate. | `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:36-52,125`; `PHASE4_AUTOMATION_SPEC_APPROVAL_PACKAGE.md:85-107` |
| Backend automation contract → Automation Studio UI work | **Stated; no contract exists.** | `PHASE2_05_SHARED_COMPONENT_CATALOG.md:913`; `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md:623` |
| Production build/deploy → any release claim | **Blocked.** TS5096, port mismatch, stale dist schema, CI gap. | SEC-08/09/10/13 |

### 7.2 Feasibility findings

| ID | Severity | Finding | Evidence | Label |
|---|---|---|---|---|
| **FEAS-01** | **Blocking** | **Phase 3/4 implementation is not feasible on the current foundation.** RBAC, migrations, audit, and connector redaction are prerequisites and are absent. | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:76-86`; `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md:238` | VERIFIED |
| **FEAS-02** | High | **The preview-only Automation boundary is the only feasible current state.** No runtime, tables, worker, or safe connector path exists. | `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md:166-238`; `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md:508-535` | VERIFIED |
| **FEAS-03** | High | **Production build/deploy is not feasible until SEC-08/09/10 are fixed.** | §6.1 | VERIFIED |
| **FEAS-04** | Medium | **No automated verification gate exists for Canvas/Automation/accessibility.** No frontend test runner; no Canvas tests; no axe/Lighthouse evidence; no performance budget. | `frontend/package.json`; `backend/src/tests/backend.test.ts`; `PHASE3_04_CANVAS_SPEC_APPROVAL.md:89,92` | VERIFIED |
| **FEAS-05** | Medium | **The Phase 2 package's implementation-authorization boundary is clear, but the Phase 2→3→4 sequencing is not recorded as owner decisions.** | `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md:103-118`; `PHASE3_04_CANVAS_SPEC_APPROVAL.md:184-221`; `PHASE4_AUTOMATION_SPEC_APPROVAL_PACKAGE.md:85-107` | VERIFIED |
| **FEAS-06** | Low | **`@dnd-kit/*` are unused dependencies; drag is hand-rolled with no keyboard alternative.** | `frontend/package.json`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md:372` | VERIFIED |
---

## 8. Defect register (consolidated)

Severity is **PROPOSED** by this review. Status labels: **BLOCKING** / **NON-BLOCKING**.

| ID | Sev | Defect | Evidence | Status |
|---|---|---|---|---|
| DF-01 | Critical | Canvas authorization absent (any authenticated user can access any canvas). | `canvas.routes.ts:8` | BLOCKING |
| DF-02 | Critical | Connector secrets returned unredacted; no ownership check; plaintext storage. | `connector.service.ts:76-114,116-139`; `schema.sql:205-226` | BLOCKING |
| DF-03 | Critical | No canvas-membership validation; cross-canvas connections possible. | `canvas.service.ts:141-179,247-262` | BLOCKING |
| DF-04 | Critical | Backend production build fails (TS5096). | `backend/tsconfig.json:19` | BLOCKING |
| DF-05 | Critical | Container port mismatch (3000 vs 4000). | `server.ts:98`; `Dockerfile:25`; `docker-compose.yml:9,12,22` | BLOCKING |
| DF-06 | Critical | Runtime schema path stale/unreproducible. | `database/index.ts:9`; `.dockerignore:3`; `dist/database/schema.sql` vs `src/database/schema.sql` | BLOCKING |
| DF-07 | High | RBAC not enforced beyond user administration. | `auth.middleware.ts:24-32`; `canvas.routes.ts:8`; `connectors.routes.ts:8,13` | BLOCKING |
| DF-08 | High | Hardcoded JWT fallback secret. | `auth.middleware.ts:15` | BLOCKING |
| DF-09 | High | Agent registration broken by schema drift. | `agentAuthService.ts:33-43`; `schema.sql:94-106` | BLOCKING |
| DF-10 | High | Audit tables exist but have no writer. | `schema.sql:79-92`; repo search | BLOCKING |
| DF-11 | High | No versioned migration ledger. | `migrations/` empty; `migrate.ts:1-10` | BLOCKING |
| DF-12 | High | No input validation on canvas items/connections. | `canvas.service.ts:141-179,247-262` | NON-BLOCKING |
| DF-13 | High | Leaking error contract (raw SQLite messages, HTTP 500 everywhere). | `canvas.routes.ts:22-24` | NON-BLOCKING |
| DF-14 | High | No optimistic concurrency; last-write-wins; failed saves look successful. | `schema.sql:161-198`; `canvas.service.ts:99-125,187-235`; `useCanvas.ts:144-175` | NON-BLOCKING |
| DF-15 | High | Cross-project task linking possible. | `schema.sql:176`; `canvas.service.ts:141-179` | NON-BLOCKING |
| DF-16 | High | Task-deletion FK blocker. | `schema.sql:176`; `task.service.ts:160-165` | NON-BLOCKING |
| DF-17 | High | Canvas not keyboard operable; no touch support. | `CanvasViewport.tsx:74-105,268-270` | NON-BLOCKING |
| DF-18 | Medium | Porcelain status/muted contrast failures. | `index.css:443-457`; recomputed 1.65–2.45:1 | NON-BLOCKING |
| DF-19 | Medium | No focus trap/return; no skip link; no `sr-only`; static title. | `index.css`; `ProjectSwitcher.tsx:264`; `TaskWorkspace.tsx:1235` | NON-BLOCKING |
| DF-20 | Medium | Hardcoded colours and non-canonical spring in Canvas. | `ConnectionLine.tsx:39,47-48` | NON-BLOCKING |
| DF-21 | Medium | Undefined CSS classes used in JSX (14). | `index.css` absence; `PHASE2_05_SHARED_COMPONENT_CATALOG.md:969-971` | NON-BLOCKING |
| DF-22 | Medium | JS momentum not gated by reduced motion. | `CanvasViewport.tsx:171-204` | NON-BLOCKING |
| DF-23 | Medium | No pagination on canvas list/detail. | `canvas.routes.ts:28-49` | NON-BLOCKING |
| DF-24 | Medium | No transactionality in `deleteCanvas`. | `canvas.service.ts:127-137` | NON-BLOCKING |
| DF-25 | Medium | `canvases.updated_at` not bumped by item/connection mutations. | `canvas.service.ts:91-97` vs `187-274` | NON-BLOCKING |
| DF-26 | Medium | Frontend discards HTTP status; no conflict UI. | `useCanvas.ts:88,119,156,196,230,249` | NON-BLOCKING |
| DF-27 | Medium | No Canvas/Automation test coverage. | `backend.test.ts`; `frontend/package.json` | NON-BLOCKING |
| DF-28 | Medium | Phase 2 package indexes superseded P2-04 draft. | `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md:23,148` | BLOCKING (governance) |
| DF-29 | Low | Phase 3 package P3-03 hash wrong by one hex character. | `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:20` | NON-BLOCKING |
| DF-30 | Low | Dead code: `TaskCard.tsx`, `DesignCanvas.tsx`, unused hook methods, unused `@dnd-kit/*`. | Import scan; `frontend/package.json` | NON-BLOCKING |
| DF-31 | Low | `arrow` item type unreachable from toolbar. | `CanvasToolbar.tsx:8-14`; `Canvas.tsx:110-118` | NON-BLOCKING |
| DF-32 | Low | Connection deletion unreachable from UI. | `useCanvas.ts:243-255` | NON-BLOCKING |
| DF-33 | Low | EX-004 icon morphing not implemented. | 0 "morph" occurrences in canvas code | NON-BLOCKING |
| DF-34 | Low | Phase 1 test count 15 vs static 14. | `PHASE1_DISCOVERY_DECISION_PACK.md:41`; `backend.test.ts` | NON-BLOCKING |

---

## 9. Blocking vs non-blocking findings

### 9.1 Blocking (must be resolved before any Phase 3/4 implementation approval)

| # | Blocking finding | Required correction | Source |
|---|---|---|---|
| **B-1** | Role-model conflict (global vs project-scoped; commenter omitted). | Align Phase 3 authorization to the Phase 2 project-scoped five-actor model, or record an explicit owner override. | CC-01 |
| **B-2** | Global-canvas conflict. | Choose one rule for `project_id = null` consistent with Phase 2 §3. | CC-02 |
| **B-3** | Phantom membership model. | Correct Phase 3 text to the proposed Phase 2 model; do not assume an unmigrated table. | CC-03 |
| **B-4** | Export/import scope conflict. | Decide one scope and update `design-system.md`, P3-01, P3-02, P3-03 consistently. | CC-04 |
| **B-5** | Card provenance gap. | Record PM-P2/P3/P4/P5 cards and acceptance definitions in the current authority documents. | CC-05 |
| **B-6** | Phase 2 package indexes the superseded P2-04 draft. | Re-issue the Phase 2 package against the final P2-04, or record the final as the approved artifact. | CC-06 |
| **B-7** | Critical baseline defects (DF-01, DF-02, DF-04, DF-05, DF-06, DF-07, DF-08, DF-09, DF-10, DF-11). | Authorize and complete the Phase 2 baseline-remediation workstream before Phase 3/4 implementation. | §6.1 |
| **B-8** | No Canvas/Automation test or accessibility gate. | Add Canvas API/hook/component tests, an accessibility pass, and a performance budget before implementation approval. | FEAS-04; `PHASE3_04_CANVAS_SPEC_APPROVAL.md:243` |
| **B-9** | Prerequisite foundation absent. | Build and verify the Phase 2 foundation (RBAC, migrations, outbox, audit, connector redaction) before Phase 3/4 implementation. | FEAS-01 |

### 9.2 Non-blocking (fix before or during implementation)

CC-07, CC-08, CC-09, CC-10, UX-01…UX-17 (as applicable), A11-01…A11-14, DF-12…DF-17, DF-18…DF-27, DF-29…DF-34, FEAS-02…FEAS-06.

---

## 10. Acceptance criteria for PM-P5-02

| ID | Criterion | Verification | Status |
|---|---|---|---|
| AC-01 | This artifact exists at the assigned path and is the integrated validation record for PM-P5-02. | File present; byte size and SHA-256 reported by the card completion report. | MET (this review) |
| AC-02 | All four phase approval packages and their sibling artifacts were reviewed and their recorded hashes verified. | §2.1–2.2 | MET |
| AC-03 | Cross-phase consistency findings are recorded with exact citations and labels. | §3 | MET |
| AC-04 | UX review against Phase 2 token/component contracts is recorded. | §4.1–4.2 | MET |
| AC-05 | UX review against Phase 3/4 interaction contracts is recorded. | §4.3 | MET |
| AC-06 | Accessibility review is recorded, including independently recomputed contrast evidence. | §5 | MET |
| AC-07 | Security/permission/secret-redaction review is recorded against live source. | §6 | MET |
| AC-08 | Feasibility and dependency review is recorded. | §7 | MET |
| AC-09 | A consolidated defect register is recorded. | §8 | MET |
| AC-10 | Blocking and non-blocking findings are separated. | §9 | MET |
| AC-11 | Unresolved decisions are recorded. | §11 | MET |
| AC-12 | No application source, schema, data, credential, environment, or configuration was modified by this review. | Read-only boundary | MET |
| AC-13 | The integrated verdict is recorded. | §1 | MET |

---

## 11. Unresolved decisions (DECISION-REQUIRED)

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **UD-01** | Document authority model (Phase 1 Decision A) | A1 live tree + `UI_UX_REDESIGN_PLAN.md`; A2 PRD master; A3 other | **A1**; mark PRD/KANBAN stale; ROADMAP historical |
| **UD-02** | Role model and permission matrix | Global `users.role` / project-scoped five-actor | **Project-scoped five-actor**; resolve CC-01 |
| **UD-03** | Global canvases (`project_id = null`) | Allow admin-only / require a project | **Require a project**; resolve CC-02 |
| **UD-04** | Canvas export/import scope | Required now / deferred / non-goal | **Decide and align all sources**; resolve CC-04 |
| **UD-05** | Phase 2 artifact of record for P2-04 | Draft / final | **Final**; re-issue the Phase 2 package; resolve CC-06 |
| **UD-06** | Card provenance and acceptance definitions | Record in authority docs / accept series IDs | **Record** PM-P2/P3/P4/P5; resolve CC-05 |
| **UD-07** | Critical baseline remediation | Authorize now / defer | **Authorize DF-01…DF-11 first** |
| **UD-08** | Migration policy | Versioned ledger with checksums/dry-run/rollback / ad-hoc | **Versioned ledger** |
| **UD-09** | Connector credential provider | OS store / managed vault / KMS | **Owner + security decision**; never store key beside ciphertext |
| **UD-10** | Automation runtime boundary | Preview-only / test-only / live | **Preview-only** until a separate runtime specification and owner authorization exist |
| **UD-11** | Automation API versioning | `/api/v1/automation` / content negotiation / unversioned | `/api/v1/automation` |
| **UD-12** | Audit retention and legal hold | 90 days hot / 7 years cold / other | **Owner + legal** |
| **UD-13** | Canvas persistence/save model | Autosave + status / explicit Save / versioned snapshots | **Autosave with visible status + version precondition**; reconcile P3-01/P3-02/P3-03 |
| **UD-14** | Undo/redo scope | Session-local / persisted / none | **Session-local first** |
| **UD-15** | Connection semantics | Purely visual / map to `task_dependencies` | **Purely visual** |
| **UD-16** | Accessibility conformance level | WCAG 2.2 AA / other | **WCAG 2.2 AA across all six themes** |
| **UD-17** | Test coverage gate | Add before implementation / defer | **Add Canvas/Automation tests + a11y/performance gates before implementation** |
| **UD-18** | Deployment topology | Single-host SQLite / external broker | **Single-host for now**; gate external infrastructure separately |
| **UD-19** | Phase ordering | Phase 2 remediation → Phase 3 corrections → Phase 4 runtime decision | **Phase 2 remediation first**; do not implement Phase 3/4 until B-1…B-9 are closed |
| **UD-20** | Artifact verification | Record byte size and SHA-256 in the card completion report | **Report** (a file cannot contain its own final hash) |

---

## 12. Evidence index

### 12.1 Planning artifacts (paths and hashes in §2.1)

- `PHASE1_DISCOVERY_DECISION_PACK.md` — authority register, Decisions A–E, capability inventory.
- `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md` — Phase 2 design baseline, C-1…C-13, D-01…D-10.
- `PHASE2_01_SHARED_ARCHITECTURE.md`; `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md`; `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY_DRAFT.md`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md`; `PHASE2_SHARED_FOUNDATIONS_DRAFT.md`.
- `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md`; `PHASE3_01_CANVAS_IA_JOURNEYS.md`; `PHASE3_02_CANVAS_INTERACTIONS.md`; `PHASE3_03_CANVAS_API_CONTRACT.md`; `PHASE3_04_CANVAS_SPEC_APPROVAL.md`.
- `PHASE4_AUTOMATION_SPEC_APPROVAL_PACKAGE.md`; `PHASE4_01_AUTOMATION_IA_REGIONS.md`; `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md`; `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md`.

### 12.2 Live source verified in this review

- `backend/src/routes/canvas.routes.ts:8,22-24,79-99`
- `backend/src/services/canvas.service.ts:141-179,247-262`
- `backend/src/services/connector.service.ts:76-114,116-139`
- `backend/src/routes/connectors.routes.ts:1-20`
- `backend/src/middleware/auth.middleware.ts:1-32`
- `backend/src/services/agentAuthService.ts:25-50`
- `backend/src/services/task.service.ts:155-170`
- `backend/src/database/schema.sql:79-106,161-198,205-226`
- `backend/src/database/index.ts:1-25`
- `backend/src/database/migrate.ts:1-10`; `backend/src/database/migrations/` (empty)
- `backend/src/index.ts:30-60`; `backend/src/server.ts:35-62,90-105`
- `backend/tsconfig.json:1-25`; `backend/package.json`
- `backend/dist/database/schema.sql` (stale) vs `backend/src/database/schema.sql`
- `Dockerfile:1-30`; `docker-compose.yml:1-29`; `.dockerignore`
- `.github/workflows/ci-cd.yml:1-35`
- `frontend/src/index.css:7-33,327-329,403,443-457`
- `frontend/src/pages/AutomationStudio.tsx:1-35,210-235`
- `frontend/src/hooks/useAuth.tsx:1-25`
- `frontend/src/components/canvas/ConnectionLine.tsx:26-52`
- `frontend/src/components/canvas/CanvasViewport.tsx` (cited by siblings)
- `frontend/src/components/projects/ProjectSwitcher.tsx:258-268`
- `frontend/src/pages/TaskWorkspace.tsx:1230-1245`
- `frontend/src/components/layout/AppShell.tsx:585-620`
- `frontend/package.json`
- `backend/src/tests/backend.test.ts` (14 test cases, 0 canvas mentions)
- `PRD.md` / `KANBAN_BOARD.md` (identical SHA-256 `e53b9088c412fec5…`)

### 12.3 Commands / checks run (read-only)

- Full-file reads via Python (`os` + line extraction).
- SHA-256 computation of all phase artifacts (`hashlib`).
- Regex scans: `--pm-bg`, `dnd-kit`, `INSERT INTO audit_logs`, `.focus(`, `PM-P2/P3/P4/P5` in authority docs, `test(` count.
- WCAG relative-luminance recomputation on actual token values.
- `git status --short` / `git log` for the backend test file (read-only).

---

## 13. Artifact verification

- **Path:** `<workspace>\PHASE5_02_INTEGRATED_VALIDATION.md`
- **Byte size:** _recorded by the card completion report (a file cannot contain its own final size)_
- **SHA-256:** _recorded by the card completion report_
- **Read-only boundary:** No application source file, schema, data, credential, environment, or configuration was modified by this review. The only file written is this artifact.
- **Recommended next step:** Record the owner decisions UD-01…UD-20 and correct blocking findings B-1…B-9 before authorizing any Phase 3/4 implementation.

---

*Prepared as a read-only integrated validation artifact for Kanban card PM-P5-02. This document is a review and decision register, not an implementation authorization and not a source-code change.*
