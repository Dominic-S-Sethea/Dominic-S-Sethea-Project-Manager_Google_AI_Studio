# Project Manager — Phase 3 Canvas Specification Approval Package (V2, Corrected)

**Status:** Corrected draft — owner acceptance required  
**Phase:** 3 — Project Canvas Specification  
**Repository:** `<workspace>`  
**Git branch:** `main`  
**Git HEAD:** `d705a364b2e845eb02f33d57475e0e3af15228c7`  
**Implementation boundary:** Planning/design only. No Canvas source, schema, API, database, or Automation runtime change is authorized by this package.

> **Labels:** **VERIFIED** = read directly from live source or generated artifacts. **REPORTED** = stated in a project document but not independently proved. **PROPOSED** = recommended but not approved. **DECISION-REQUIRED** = owner decision required.

---

## 1. Correction result

The original Phase 3 review returned **REQUEST CHANGES** with nine blocking corrections. The owner approved revising B-1–B-9. Three correction appendices were produced and verified:

| ID | Artifact | Bytes | SHA-256 |
|---|---|---:|---|
| C-B1/B2 | `PHASE3_CORRECTION_AUTHORIZATION.md` | 36,922 | `9d61e4ce9fd57a6be2fcd62e2181f4f224b0843b32ec0d14da1b08c9a2fde08e` |
| C-B3/B4/B5 | `PHASE3_CORRECTION_SCOPE.md` | 35,541 | `5f97e65e60df4c7feaeef99651930076850f76d707b02f56f670010a8afac828` |
| C-B6/B7/B8/B9 | `PHASE3_CORRECTION_GOVERNANCE_ACCEPTANCE.md` | 36,116 | `19e8e6cabec283fd2ecbcfdce9392d13c9e08d43b6a93e3d6e8ea492d1dc72cd` |

All three files exist in the project workspace. No application source, database, schema, credential, or runtime configuration was changed by the corrections.

### Original Phase 3 artifacts (superseded where corrected)

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `PHASE3_01_CANVAS_IA_JOURNEYS.md` | 48,630 | `e2c1e80e39546ad5f54003b08794449c7896523e1bc8e10e085447740a360bbf` |
| `PHASE3_02_CANVAS_INTERACTIONS.md` | 34,901 | `5c56629b58f663111258706568691a87ff36ef1e8671325f3479fc55416c76a6` |
| `PHASE3_03_CANVAS_API_CONTRACT.md` | 42,129 | `d464d83abe235b1698289eff91eef4739ba1b2557a482e002a6fe8d82bcd1555` |
| `PHASE3_04_CANVAS_SPEC_APPROVAL.md` | 34,151 | `4e6c90fcf0bd92a2b78e9095b726e623d940db9aad6a096a209ab52874570060` |

---

## 2. Blocking corrections — status

| # | Correction | Status | Corrected by |
|---:|---|---|---|
| B-1 | Replace global `admin|manager|editor|viewer` roles with Phase 2 project-scoped five-actor model | **CLOSED** | `PHASE3_CORRECTION_AUTHORIZATION.md` §2, §8 |
| B-2 | Add `commenter` to the Canvas role matrix and route policy | **CLOSED** | `PHASE3_CORRECTION_AUTHORIZATION.md` §2, §6 |
| B-3 | Require a project for every Canvas; remove admin-only global-canvas proposal | **CLOSED** | `PHASE3_CORRECTION_SCOPE.md` B-3 |
| B-4 | Correct “existing project membership model” to “proposed Phase 2 model” | **CLOSED** | `PHASE3_CORRECTION_SCOPE.md` B-4 |
| B-5 | Align Canvas export/import scope (defer to separate approved card) | **CLOSED** | `PHASE3_CORRECTION_SCOPE.md` B-5 |
| B-6 | Record PM-P3-01/02/03/04 provenance and acceptance definitions | **CLOSED at specification level**; authority-document edit remains OPEN task G-6 | `PHASE3_CORRECTION_GOVERNANCE_ACCEPTANCE.md` §2 |
| B-7 | Close PC-02/03/04/05/08/09/11/12 partial/not-met criteria | **CLOSED** — 4 MET, 8 owner-accepted deferrals with Phase 6 entry criteria, 0 NOT MET | `PHASE3_CORRECTION_GOVERNANCE_ACCEPTANCE.md` §3 |
| B-8 | Freeze Phase 2 artifact hashes; correct P3-03 hash typo; re-confirm cross-phase citations | **CLOSED** | `PHASE3_CORRECTION_GOVERNANCE_ACCEPTANCE.md` §7 |
| B-9 | Add Canvas tests and accessibility/performance gates before implementation | **CLOSED at specification level**; implementation remains OPEN as Phase 6 entry criteria | `PHASE3_CORRECTION_GOVERNANCE_ACCEPTANCE.md` §4–§6 |

---

## 3. Corrected Canvas authorization model

- **Five-actor project-scoped model:** owner, editor, viewer, commenter, agent.
- **Canvas access:** project-scoped read/manage/admin rights.
- **Commenter:** read-only on Canvas.
- **Agent:** defined separately; no self-approval; no live execution.
- **403 vs 404:** membership-aware policy; 404 for reads when the caller cannot establish access, 403 for writes.
- **Publish/execute:** disabled until a separate Automation runtime decision.
- **Tests:** BA-01–BA-28 plus revised T01–T06.

---

## 4. Corrected Canvas scope

- Every Canvas must resolve to exactly one project; `project_id` is required.
- The membership model is the **proposed Phase 2 project-scoped model**, not an existing table.
- Canvas export/import is deferred to a separate approved card.
- Canvas connections remain **purely visual**; they never map to `task_dependencies`.
- Canvas remains a non-execution surface.

---

## 5. Corrected acceptance status

| Criterion | Status |
|---|---|
| PC-01 drag-and-drop | MET |
| PC-02 multi-select/marquee | DEFERRED — Phase 6 entry criterion |
| PC-03 keyboard/touch | DEFERRED — Phase 6 entry criterion |
| PC-04 undo/redo | DEFERRED — Phase 6 entry criterion |
| PC-05 connection authoring | DEFERRED — Phase 6 entry criterion |
| PC-06 custom editing | MET |
| PC-07 10 routes / 3 tables | MET |
| PC-08 task linking | DEFERRED — Phase 6 entry criterion |
| PC-09 validation/duplicates | DEFERRED — Phase 6 entry criterion |
| PC-10 planning-surface boundary | MET |
| PC-11 export/import | DEFERRED — separate approved card |
| PC-12 accessibility/performance | DEFERRED — Phase 6 entry criterion |

---

## 6. Critical baseline defects (still open)

The following remain open and blocking for implementation. They are owner-accepted deferrals to Phase 2 remediation, not Canvas specification defects.

| ID | Defect |
|---:|---|
| DF-01 | Canvas routes use `requireAuth` only |
| DF-02 | Connector secrets returned unredacted with no ownership check |
| DF-03 | Canvas item/connection writes lack validation |
| DF-04 | Backend build fails (TS5096) |
| DF-05 | Container port mismatch (3000 vs 4000) |
| DF-06 | Stale `dist/database/schema.sql` |
| DF-07 | Hardcoded JWT fallback secret |
| DF-08 | Agent schema drift (`agents.expires_at`, `agent_tokens`) |
| DF-09 | `audit_logs` has no writer |
| DF-10 | No migration ledger |
| DF-11 | CI does not gate the backend build |

---

## 7. Phase 2 artifact-of-record correction

The Phase 2 approval package must index the **final** P2-04 artifact, not the superseded draft:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md` (final) | 48,739 | `f326b180f53edf84f0c56e8197b749f653cfba9b5f8d0e66b6e7a721a4700bfd` |
| `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY_DRAFT.md` (superseded) | 21,615 | `108772a3024c70baec4d841cfaecf06af906be7e21165147a926d35a23b96706` |

---

## 8. Owner decisions required

| Decision | Recommendation |
|---|---|
| **CV-01** | Accept the corrected Canvas specification package V2 as the Canvas design baseline. |
| **CV-02** | Ratify the corrected authorization model as the replacement for P3-03 §3.3/§3.5/D1. |
| **CV-03** | Ratify the membership-aware 403/404 policy. |
| **CV-04** | Confirm Editor may delete canvases (Phase 2 says yes). |
| **CV-05** | Settle agent grant persistence shape and agent identity mechanism on Canvas routes. |
| **CV-06** | Authorize the Phase 2 `project_members` migration (RB-3). |
| **CV-07** | Decide disposition of existing `project_id = null` rows (RB-5). |
| **CV-08** | Record PM-P3-01/02/03/04 in the authority documents (G-6). |
| **CV-09** | Re-issue the Phase 2 package with the final P2-04 artifact (G-8). |

---

## 9. Phase 3 exit gate

Phase 3 corrections are complete at the specification level. Implementation remains blocked until:

1. CV-01–CV-09 are recorded;
2. Phase 2 decisions D-01–D-10 are recorded;
3. Phase 4 decisions AD-02–AD-18 are recorded;
4. Critical baseline remediation is authorized;
5. The Phase 5 handoff package is approved.

---

## 10. Evidence index

- `PHASE3_CORRECTION_AUTHORIZATION.md`
- `PHASE3_CORRECTION_SCOPE.md`
- `PHASE3_CORRECTION_GOVERNANCE_ACCEPTANCE.md`
- `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` (V1, superseded)
- `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md`
- `PHASE1_DISCOVERY_DECISION_PACK.md`
- Live source files cited in each artifact with exact paths and line numbers.

---

*Prepared as a corrected Phase 3 owner-gate artifact. This package is a specification and decision register, not an implementation authorization.*
