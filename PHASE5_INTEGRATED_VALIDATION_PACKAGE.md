# Project Manager — Phase 5 Integrated Validation Package

**Status:** Complete validation — **request changes**  
**Phase:** 5 — Integrated Validation & Final Design Handoff  
**Repository:** `<workspace>`  
**Git branch:** `main`  
**Git HEAD:** `d705a364b2e845eb02f33d57475e0e3af15228c7`  
**Implementation boundary:** Validation and design-handoff planning only. No application source, schema, migration, credential, connector, queue, or runtime change is authorized by this package.

> **Labels:** **VERIFIED** = read directly from live source or generated artifacts. **REPORTED** = stated in a project document but not independently proved. **PROPOSED** = recommended but not approved. **DECISION-REQUIRED** = owner decision required.

---

## 1. Phase 5 result

| ID | Artifact | Bytes | SHA-256 |
|---|---|---:|---|
| P5-01 | `PHASE5_01_CANVAS_AUTOMATION_SEPARATION.md` | 26,882 | `ecd6b6da2cc74c9e7fe479cba070322abbf89ef77eaaca3160c4e84a06241dff` |
| P5-02 | `PHASE5_02_INTEGRATED_VALIDATION.md` | 45,409 | `e811c6d33df7802b9b8c15819ed0d66a69faed540fd78e40e61218a51dad868b` |

Both artifacts exist in the project workspace. No application source, database, schema, credential, or runtime configuration was changed by Phase 5.

### What each artifact covers

- **P5-01 — Canvas/Automation semantic separation:** current-state separation evidence (routes, tables, components, docs, icons); target-state separation evidence; conflicts and risks; binding terminology/data-model/permission/runtime separation matrix; concrete corrections; acceptance criteria; unresolved decisions.
- **P5-02 — Integrated validation:** cross-phase consistency; UX/accessibility; security/permission/redaction; feasibility and dependencies; defect register; blocking vs non-blocking findings; acceptance criteria; unresolved decisions.

---

## 2. Validation verdict

**Recommendation: REQUEST CHANGES.**

Current Canvas/Automation separation is **largely intact** at the route, table, component, icon, and runtime-absence level. However, the target-state separation contract is not yet owner-approved, and the integrated validation found blocking cross-phase conflicts plus verified critical baseline defects.

---

## 3. Blocking findings

| # | Blocking finding | Required correction |
|---:|---|---|
| CC-01 | **Role-model conflict:** P3-03 proposes global `admin|manager|editor|viewer` roles on `users.role`; Phase 2 mandates project-scoped five-actor membership and excludes `users.role`; commenter is omitted. | Align Canvas/Automation authorization to the Phase 2 project-scoped model; remove the global-role proposal. |
| CC-02 | **Global-canvas conflict:** P3-03 D2 proposes admin-only `project_id = null` canvases; P3-01 D11 allows null + “All projects”; Phase 2 requires every Canvas to resolve to exactly one project. | Require a project for every Canvas, or gate global canvases as a separate explicit owner decision. |
| CC-03 | **Phantom membership model:** P3-02 references an “existing project membership model”; no `project_members` table exists. | Correct to “proposed Phase 2 model”; do not assume an unapproved migration. |
| CC-04 | **Export/import scope conflict:** `design-system.md` requires Canvas export/import; P3-01 requires it; P3-02 defers it; P3-03 lists it as a non-goal. | Choose one scope and align all four sources. |
| CC-05 | **Card provenance gap:** PM-P2/P3/P4/P5 cards are absent from `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, and `CHECKLIST.md`; acceptance definitions are unverifiable. | Record the phase cards and acceptance definitions in the current authority documents. |
| CC-06 | **Phase 2 artifact-of-record conflict:** the Phase 2 approval package indexes the superseded P2-04 draft (21,615 bytes, “not yet ratified”), while the canonical final P2-04 is 48,739 bytes. | Re-issue the Phase 2 package with the final P2-04 artifact and a frozen hash set. |
| CC-07 | **Documentation hash typo:** the Phase 3 package records a one-character SHA-256 mismatch for P3-03. | Correct the hash and verify all sibling citations. |
| CC-08 | **Test-count discrepancy:** Phase 1 reports 15 backend tests; the backend test file contains 14 `test(...)` cases. | Reconcile the recorded test count and re-run the suite before any implementation gate. |
| CC-09 | **CI does not gate the backend build:** CI omits the backend build, so TS5096 is not caught. | Add backend build/typecheck/test to CI before implementation. |
| B-7 | **Critical baseline defects remain live:** canvas authorization, connector secret exposure, TS5096, port mismatch, stale dist schema, hardcoded JWT fallback, agent schema drift, dead audit tables, no migration ledger. | Authorize and complete critical baseline remediation before Phase 3/4 implementation. |
| B-9 / FEAS-01 | **Phase 3/4 implementation is not feasible on the current foundation:** RBAC enforcement, migration ledger, outbox, audit writer, and connector redaction are proposed only. | Land the shared foundation and critical fixes first. |

---

## 4. Verified accessibility findings

- **Porcelain theme fails WCAG AA** on panel surfaces: success 1.72, warning 1.65, danger 2.45, info 1.92; muted text 4.14. Root cause: the porcelain block defines only surface/text/shadow tokens and inherits dark-theme status colors.
- **Crystal muted text fails AA** at 4.09 on panel.
- **Accessibility infrastructure gaps:** no skip link, no `.sr-only`, no focus trap/focus return, static page title, inline `outline:none`, Canvas not keyboard-operable, JS momentum not reduced-motion gated, mobile nav lacks `aria-expanded`/`aria-controls`.

---

## 5. Verified separation findings

- **Intact:** Canvas and Automation have separate routes, backend mounts, tables, components, icons, and no shared runtime.
- **Failures:** CanvasList uses Automation vocabulary (“workflows”), the Canvas toolbar uses “Line/Arrow” (ambiguous with control flow), and Automation Studio uses a Canvas-domain CSS class name.
- **Risk:** Canvas authorization is semantic only; no permission enforcement.
- **Risk:** `canvases.project_id` is nullable and creation accepts null.

---

## 6. Owner decisions required

| Decision | Recommendation |
|---|---|
| **UD-01** Document authority model | Live tree + `UI_UX_REDESIGN_PLAN.md`; PRD/Kanban stale; ROADMAP historical. |
| **UD-02** Role model | Project-scoped five-actor membership. |
| **UD-03** Global canvases | Require a project. |
| **UD-04** Canvas export/import scope | Decide once and align all sources. |
| **UD-05** Phase 2 artifact of record | Use the final P2-04 artifact; freeze hashes. |
| **UD-06** Card provenance | Record PM-P2/P3/P4/P5 cards and acceptance definitions. |
| **UD-07** Critical baseline remediation | Authorize C-1–C-4 / DF-01–DF-11 before Phase 3/4 implementation. |
| **UD-08** Migration policy | Versioned ledger with checksums, dry-run, rollback. |
| **UD-09** Connector credential provider | Owner + security decision; never store keys beside ciphertext. |
| **UD-10** Automation runtime boundary | **Preview-only** (already recorded). |
| **UD-11** Automation API versioning | `/api/v1/automation`. |
| **UD-12** Audit retention and legal hold | Owner + legal. |
| **UD-13** Canvas persistence/save model | Autosave with visible status + version precondition. |
| **UD-14** Undo/redo scope | Session-local first. |
| **UD-15** Connection semantics | Purely visual; never map to `task_dependencies`. |
| **UD-16** Accessibility conformance | WCAG 2.2 AA across all six themes. |
| **UD-17** Test coverage gate | Canvas/Automation tests + accessibility/performance gates before implementation. |
| **UD-18** Deployment topology | Single-host SQLite for now. |
| **UD-19** Phase ordering | Phase 2 remediation first; do not implement Phase 3/4 until B-1–B-9 are closed. |
| **UD-20** Artifact verification | Byte size and SHA-256 reported by the card completion report. |

---

## 7. Phase 5 exit gate

Phase 5 is complete as a **validation phase**. It does **not** authorize:

- Canvas or Automation implementation;
- schema/migration changes;
- credential or connector changes;
- runtime/queue/worker changes;
- commits or pushes.

The next executable step is the Phase 5 handoff package `t_7c6f3a92`, which remains blocked until:

1. Phase 3 corrections **B-1–B-9** and decisions **CD-01–CD-12** are closed;
2. Phase 4 decisions **AD-02–AD-18** are recorded (AD-01 is already preview-only);
3. Phase 2 decisions **D-01–D-10** are recorded;
4. Critical baseline remediation is authorized.

---

## 8. Evidence index

- `PHASE5_01_CANVAS_AUTOMATION_SEPARATION.md`
- `PHASE5_02_INTEGRATED_VALIDATION.md`
- `PHASE4_AUTOMATION_SPEC_APPROVAL_PACKAGE.md`
- `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md`
- `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md`
- `PHASE1_DISCOVERY_DECISION_PACK.md`
- Live source files cited in each artifact with exact paths and line numbers.

---

*Prepared as a Phase 5 owner-gate artifact. This package is a validation report and decision register, not an implementation authorization.*
