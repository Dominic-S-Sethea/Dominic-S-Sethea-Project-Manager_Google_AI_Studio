# Project Manager — Phase 3 Canvas Specification Approval Package

**Status:** Complete draft — **request changes** recommended  
**Phase:** 3 — Project Canvas Specification  
**Repository:** `<workspace>`  
**Git branch:** `main`  
**Git HEAD:** `d705a364b2e845eb02f33d57475e0e3af15228c7`  
**Implementation boundary:** Planning/design only. No Canvas source, schema, API, database, or Automation runtime change is authorized by this package.

> **Labels:** **VERIFIED** = read directly from live source or generated artifacts. **REPORTED** = stated in a project document but not independently proved. **PROPOSED** = recommended but not approved. **DECISION-REQUIRED** = owner decision required.

---

## 1. Phase 3 result

| ID | Artifact | Bytes | SHA-256 |
|---|---|---:|---|
| P3-01 | `PHASE3_01_CANVAS_IA_JOURNEYS.md` | 48,630 | `e2c1e80e39546ad5f54003b08794449c7896523e1bc8e10e085447740a360bbf` |
| P3-02 | `PHASE3_02_CANVAS_INTERACTIONS.md` | 34,901 | `5c56629b58f663111258706568691a87ff36ef1e8671325f3479fc55416c76a6` |
| P3-03 | `PHASE3_03_CANVAS_API_CONTRACT.md` | 42,129 | `d464d83abe235b1698289eff91eef4739ba1b2557a482e002a6fe8d82bcd1555` |
| P3-04 | `PHASE3_04_CANVAS_SPEC_APPROVAL.md` | 34,151 | `4e6c90fcf0bd92a2b78e9095b726e623d940db9aad6a096a209ab52874570060` |

All four artifacts exist in the project workspace. No application source or database was changed by Phase 3.

### What each artifact covers

- **P3-01 — IA and journeys:** current Canvas IA inventory, roles, primary/secondary journeys, navigation, canvas list/detail, viewport, toolbar, inspector, properties, selection, connection, task picker, save/load, undo/redo, error/recovery, empty/loading states, accessibility/responsive requirements, Canvas-vs-Automation separation, 26 acceptance criteria, 15 unresolved decisions.
- **P3-02 — Interactions and scope:** 20 current interaction entry points, drag/resize/pan/zoom/selection/connection/task-linking/undo-redo/keyboard/touch behavior, complexity management, state/validation/error/recovery rules, preserve/improve/extend classification, non-goals, and a 19-item decision register.
- **P3-03 — API, data, authorization and failure contract:** current route/schema/service/frontend evidence, F1–F15 gaps, proposed request/response/error schemas, project isolation and ownership rules, item/connection validation, optimistic-update and conflict/recovery behavior, pagination/versioning, T01–T25 tests, and 15 decision-required items.
- **P3-04 — Specification approval gate:** acceptance-criteria mapping, consistency/gap findings, 26 defects, 18 gaps, 17 consistency findings, 32 owner decisions, and the review recommendation.

---

## 2. Review verdict

**Recommendation: REQUEST CHANGES.**

The review verified the three sibling artifacts and spot-checked their line-number citations against source. It found the specifications materially useful but not approval-ready because of unresolved cross-phase conflicts and governance gaps.

### Blocking corrections (B-1–B-9)

| # | Blocking finding | Required correction |
|---:|---|---|
| B-1 | **RBAC model conflict:** P3-03 §3.3/D1 proposes global roles (`admin|manager|editor|viewer`) on `users.role`, conflicting with P3-02 §2 and Phase 2’s project-scoped five-actor model. | Align Canvas authorization to the Phase 2 project-scoped model; remove global-role proposal. |
| B-2 | **Missing actor:** P3-03 omits the `commenter` actor required by Phase 2 and the original permission matrix. | Add commenter to the Canvas role matrix and route policy. |
| B-3 | **Global-canvas conflict:** P3-03 D2 proposes admin-only global canvases (`project_id = null`), conflicting with P3-01 D11 and Phase 2’s “every Canvas resolves to exactly one project” rule. | Remove global-canvas option or explicitly gate it as a separate owner decision; do not silently permit cross-project visibility. |
| B-4 | **Membership model does not exist:** P3-02 §7.2 references an “existing project membership model,” but no `project_members` table exists. | Correct the text to “proposed Phase 2 model”; implementation must not assume a migration that has not been approved. |
| B-5 | **Export/import scope conflict:** `design-system.md:302` requires Canvas export/import, P3-01 AC-19/D8 requires it, P3-02 §7.3 says Extend/needs approval, and P3-03 §7 says non-goal. | Choose one scope and update all four sources consistently. |
| B-6 | **Governance gap:** PM-P3-01/02/03/04 do not appear in `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, or `CHECKLIST.md`; card acceptance definitions are unverifiable. | Record the Phase 3 cards and acceptance definitions in the current authority documents. |
| B-7 | **Acceptance criteria incomplete:** PC-01/06/07/10 MET; PC-02/03/04/05/08/09 PARTIAL; PC-11 NOT MET; PC-12 PARTIAL/UNKNOWN. | Close the partial/not-met criteria or explicitly defer them with an owner decision. |
| B-8 | **Cross-phase snapshot drift:** Phase 2 artifact sizes changed during Phase 3 review; cross-phase citations are snapshot-dependent. | Freeze Phase 2 artifact hashes and re-confirm every cross-phase citation against the frozen set. |
| B-9 | **No automated Canvas coverage:** backend tests contain zero Canvas coverage; no performance or accessibility verification exists. | Add Canvas API/hook/component tests and a performance/accessibility gate before implementation approval. |

### Non-blocking corrections (N-1–N-9)

- Reconcile the exact wording of Canvas scope in P3-01/P3-02/P3-03.
- Confirm the project-linked versus unselected-canvas policy.
- Confirm undo/redo scope and retention.
- Confirm whether Canvas connections map to `task_dependencies` (recommend: keep purely visual).
- Confirm orphaned `TaskCard.tsx` / `DesignCanvas.tsx` disposition.
- Confirm Canvas rename/description UI exposure.
- Confirm connection authoring model (recommend port-to-port with picker fallback).
- Confirm zoom/fit/minimap and touch support scope.
- Confirm unassigned-canvas handling and validation/duplicate-prevention rules.

---

## 3. Verified Canvas baseline findings

| # | Severity | Finding | Evidence |
|---:|---|---|---|
| CB-1 | **Critical** | Canvas routes use only `requireAuth`; any authenticated user can read/update/delete any canvas, item, or connection by ID. | `backend/src/routes/canvas.routes.ts:8`; `backend/src/middleware/auth.middleware.ts` |
| CB-2 | **Critical** | No canvas-membership validation: item/connection writes do not verify the canvas exists or that endpoints belong to the same canvas; cross-canvas connections are possible. | `backend/src/services/canvas.service.ts:141-179,247-262` |
| CB-3 | **High** | No input validation: `item_type` and `connection_type` are free TEXT; self-connections, duplicate edges, orphan endpoints, and arbitrary values are possible. | `schema.sql:175,195`; `canvas.service.ts` |
| CB-4 | **High** | Error contract leaks raw SQLite messages and returns HTTP 500 for all failures; frontend replaces the whole editor with a Go-back-only card. | `canvas.routes.ts:22-24`; `Canvas.tsx:167-194` |
| CB-5 | **High** | No optimistic concurrency/versioning: last-write-wins; frontend keeps optimistic state even when a save fails. | `useCanvas.ts:144-175`; no version column |
| CB-6 | **High** | Cross-project task linking is possible: `canvas_items.task_id` is not checked against the canvas project. | `schema.sql:176`; `canvas.service.ts` |
| CB-7 | **High** | Task deletion FK blocker: deleting a task linked on a canvas raises a foreign-key error and surfaces as a generic 500. | `schema.sql:176`; `database/index.ts:14-16`; `task.service.ts:160-165` |
| CB-8 | **Medium** | No Canvas tests; no performance budget; no accessibility/reduced-motion verification. | `backend/src/tests/backend.test.ts`; repository-wide search |
| CB-9 | **Medium** | No keyboard support beyond Space-pan; no Delete/Escape/arrow-nudge/Ctrl+Z; viewport has no role/tabIndex/aria-label. | `CanvasViewport.tsx:74-105`; `CanvasItem.tsx:429`; `ConnectionLine.tsx:27-33` |
| CB-10 | **Medium** | No touch/Pointer Events; touch devices cannot pan, zoom, drag, or resize. | `CanvasViewport.tsx:268-270`; `CanvasItem.tsx:429` |
| CB-11 | **Medium** | Connection authoring is broken: the only UI path creates an arrow to an arbitrary first item; `connection_type = line` is unreachable; `deleteConnection` has no UI caller. | `PropertiesPanel.tsx:603-620`; `useCanvas.ts:243-255`; `Canvas.tsx:110-118` |
| CB-12 | **Medium** | No undo/redo, no explicit Save control, no canvas rename UI, no export/import. | `Canvas.tsx`; `useCanvas.ts`; `importExport.service.ts` |
| CB-13 | **Medium** | Canvas mutations do not bump `canvases.updated_at`, so list ordering is stale. | `canvas.service.ts:91-97` |
| CB-14 | **Medium** | Design-token violations: hardcoded colors and a non-canonical spring constant in Canvas components. | `CanvasViewport.tsx`; `CanvasItem.tsx`; `frontend/src/index.css` |
| CB-15 | **Medium** | Dead code: `TaskCard.tsx` and `DesignCanvas.tsx` have zero imports; `updateItem`/`deleteConnection` are unused. | repository-wide import graph |

---

## 4. Proposed Canvas target specification (summary)

### 4.1 Preserve

- Canvas as a visual planning/diagramming surface, not an execution engine.
- Existing DOM + CSS transform rendering model.
- Existing Canvas routes/service/schema tables as the extension baseline.
- Existing project Canvas and Automation Studio semantic separation.

### 4.2 Improve

- Project-scoped authorization with backend enforcement.
- Input validation, normalized error envelopes, optimistic concurrency, and retry/rollback.
- Inline mutation errors with Retry; full-page error only for fatal load failure.
- Save status, dirty indicator, and debounced batch saves.
- Keyboard map, Pointer Events/touch support, focus management, and accessible names.
- Canvas tests, performance budget, and accessibility/reduced-motion verification.
- Bump `canvases.updated_at` on every Canvas mutation.

### 4.3 Extend (only after approval)

- Undo/redo (session-local first).
- Multi-select and marquee.
- Port-to-port connection authoring with direction choice and reachable deletion.
- Task linking editable on existing items, with `TaskCard` revived.
- Zoom-to-cursor, fit-to-content, zoom controls, optional view persistence.
- Culling/virtualization first; minimap only when scale requires it.
- Canvas export/import (JSON first) if the owner confirms scope.

---

## 5. Owner decisions required

| Decision | Options | Recommendation |
|---|---|---|
| **CD-01 — Canvas specification** | Approve / request changes. | **Request changes** until B-1–B-9 are closed. |
| **CD-02 — Authorization model** | Any authenticated user / project members / owner-admin only / read-only role. | Project members with backend-enforced role matrix. |
| **CD-03 — Persistence model** | Autosave with visible status / explicit Save / versioned snapshots. | Autosave with visible status plus explicit Save for major changes. |
| **CD-04 — Undo/redo** | Session-local / persisted / none. | Session-local first. |
| **CD-05 — Connection semantics** | Purely visual / map to task dependencies. | Purely visual. |
| **CD-06 — Export/import scope** | Required now / deferred / non-goal. | Defer to a separate approved card; JSON only if approved. |
| **CD-07 — Unassigned canvases** | Allow `project_id = null` / require a project. | Require a project. |
| **CD-08 — Validation and duplicates** | Add service/route validation and duplicate prevention. | Add; include self-loop and cross-canvas checks. |
| **CD-09 — Task deletion FK** | Unlink canvas items / `ON DELETE SET NULL` / block deletion. | Unlink on delete; requires schema decision. |
| **CD-10 — Dead code** | Remove / revive / keep. | Revive `TaskCard`; keep `DesignCanvas` excluded. |
| **CD-11 — Automation boundary** | Confirm Canvas remains non-execution. | Confirm preview-only Automation boundary. |
| **CD-12 — Accessibility target** | WCAG 2.2 AA / other. | WCAG 2.2 AA across all six themes. |

---

## 6. Phase 3 exit gate

Phase 3 is complete as a **discovery/specification phase**. It does **not** authorize Canvas source, schema, API, database, or Automation runtime changes.

The next executable step is the Phase 3 approval gate `t_76f95792`. After corrections B-1–B-9 and owner decisions CD-01–CD-12, the owner may separately authorize Phase 6 Canvas implementation.

---

## 7. Evidence index

- `PHASE3_01_CANVAS_IA_JOURNEYS.md`
- `PHASE3_02_CANVAS_INTERACTIONS.md`
- `PHASE3_03_CANVAS_API_CONTRACT.md`
- `PHASE3_04_CANVAS_SPEC_APPROVAL.md`
- `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md` — Phase 2 design baseline and owner decisions.
- `PHASE1_DISCOVERY_DECISION_PACK.md` — authority register and capability inventory.
- Live source files cited in each artifact with exact paths and line numbers.

---

*Prepared as a Phase 3 owner-gate artifact. This package is a specification and decision register, not an implementation authorization.*
