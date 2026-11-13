# Project Manager — Phase 5 Final Design Handoff

**Status:** Complete handoff draft — owner acceptance required  
**Phase:** 5 — Integrated Validation & Final Design Handoff  
**Repository:** `<workspace>`  
**Git branch:** `main`  
**Git HEAD:** `d705a364b2e845eb02f33d57475e0e3af15228c7`  
**Implementation boundary:** This is the authoritative design handoff package. It does **not** authorize source, schema, migration, credential, connector, queue, or runtime changes.

> **Labels:** **VERIFIED** = read directly from live source or generated artifacts. **REPORTED** = stated in a project document but not independently proved. **PROPOSED** = recommended but not approved. **DECISION-REQUIRED** = owner decision required.

---

## 1. Handoff scope

This package consolidates the Phase 1–5 planning programme for **Project Canvas** and **Automation Studio** into one implementation-ready design handoff.

| Area | Status |
|---|---|
| Project Canvas | Existing planning/diagramming surface — preserve and improve |
| Automation Studio | Preview-only — no runtime authorized |
| Shared foundation | Proposed design baseline — implementation gated |
| Critical baseline defects | Open — blocking implementation |
| Implementation | **Not authorized** |

---

## 2. Authoritative source set

### 2.1 Phase 1 — Discovery

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `PHASE1_DISCOVERY_DECISION_PACK.md` | 16,975 | `0f9d5e4b75eb697d81c30ff444d36b921a231bb464527f59fc33bc96244c766e` |

### 2.2 Phase 2 — Shared foundation

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `PHASE2_01_SHARED_ARCHITECTURE.md` | 46,140 | `d46375f68b1f3c0f163498ba506501fdc81004bd21fff0ddd1e7e383a7c2f863` |
| `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md` | 16,396 | `a45747e154517fd2aeb4b05c3278d83c6bb8dc7b43ddb1a275f0c544282a779f` |
| `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md` | 46,171 | `ed604eb196e3fbef4d056d25d88bf96b0b18c376a10dd1c99f2abba62aaf6041` |
| `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md` (final) | 48,739 | `f326b180f53edf84f0c56e8197b749f653cfba9b5f8d0e66b6e7a721a4700bfd` |
| `PHASE2_05_SHARED_COMPONENT_CATALOG.md` | 60,504 | `42c0c5c245df4dbe4b3e2d8627f4693a9eb74e7d18a76b626d1fc2897e770f18` |
| `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md` | 13,710 | `7294c778d7443b8b26b6898e88dc497c0fdfd97e7bf21c1de998a3cc245e8924` |

### 2.3 Phase 3 — Canvas specification

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `PHASE3_01_CANVAS_IA_JOURNEYS.md` | 48,630 | `e2c1e80e39546ad5f54003b08794449c7896523e1bc8e10e085447740a360bbf` |
| `PHASE3_02_CANVAS_INTERACTIONS.md` | 34,901 | `5c56629b58f663111258706568691a87ff36ef1e8671325f3479fc55416c76a6` |
| `PHASE3_03_CANVAS_API_CONTRACT.md` | 42,129 | `d464d83abe235b1698289eff91eef4739ba1b2557a482e002a6fe8d82bcd1555` |
| `PHASE3_04_CANVAS_SPEC_APPROVAL.md` | 34,151 | `4e6c90fcf0bd92a2b78e9095b726e623d940db9aad6a096a209ab52874570060` |
| `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE_V2.md` | 8,397 | `95f2b3d54caa723ca1140c959f07748051a2b47c6fdefce532553b414ecf937a` |
| `PHASE3_CORRECTION_AUTHORIZATION.md` | 36,922 | `9d61e4ce9fd57a6be2fcd62e2181f4f224b0843b32ec0d14da1b08c9a2fde08e` |
| `PHASE3_CORRECTION_SCOPE.md` | 35,541 | `5f97e65e60df4c7feaeef99651930076850f76d707b02f56f670010a8afac828` |
| `PHASE3_CORRECTION_GOVERNANCE_ACCEPTANCE.md` | 36,116 | `19e8e6cabec283fd2ecbcfdce9392d13c9e08d43b6a93e3d6e8ea492d1dc72cd` |

### 2.4 Phase 4 — Automation specification

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `PHASE4_01_AUTOMATION_IA_REGIONS.md` | 51,361 | `e3f0b38c55745be81c1ee4b1381064df36fcb5f232139f0dd2253bf955be010d` |
| `PHASE4_02_AUTOMATION_NODES_LIFECYCLE.md` | 40,617 | `efd51dab0511e565f16d6f8cd8476078af92a1431cd2b893b00e1279e8d8507e` |
| `PHASE4_03_AUTOMATION_RUNTIME_CONTRACT.md` | 69,262 | `4b6935e29e7aff312dc81a8d96bafbcc11e01aea9380b4359f650b4b15ed784c` |
| `PHASE4_AUTOMATION_SPEC_APPROVAL_PACKAGE.md` | 11,214 | `ee6db26c020035e31f570d8ca119fe1772dd33703deafc3cb41df4919f2f731b` |

### 2.5 Phase 5 — Validation

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `PHASE5_01_CANVAS_AUTOMATION_SEPARATION.md` | 26,882 | `ecd6b6da2cc74c9e7fe479cba070322abbf89ef77eaaca3160c4e84a06241dff` |
| `PHASE5_02_INTEGRATED_VALIDATION.md` | 45,409 | `e811c6d33df7802b9b8c15819ed0d66a69faed540fd78e40e61218a51dad868b` |
| `PHASE5_INTEGRATED_VALIDATION_PACKAGE.md` | 9,105 | `f8655278168d5f67e36e91602ae5cc2a6e6ce5505c523ac5cbf402cbe4bf2485` |

---

## 3. Recorded owner decisions

### 3.1 Phase 5 / cross-phase (approved)

- **UD-01** Live-source authority; PRD/Kanban stale; ROADMAP historical.
- **UD-02** Project-scoped five-actor roles.
- **UD-03** Require a project for every Canvas.
- **UD-04** Defer Canvas export/import.
- **UD-05** Use the final P2-04 artifact; freeze hashes.
- **UD-06** Record PM-P2/P3/P4/P5 cards and acceptance definitions.
- **UD-08** Versioned migrations with checksums/dry-run/rollback.
- **UD-10** Automation runtime **preview-only**.
- **UD-11** `/api/v1/automation`.
- **UD-13** Autosave with visible status + version precondition.
- **UD-14** Session-local undo/redo first.
- **UD-15** Canvas connections purely visual.
- **UD-16** WCAG 2.2 AA across all six themes.
- **UD-18** Single-host SQLite topology.
- **UD-19** Phase 2 remediation first; do not implement Phase 3/4 until B-1–B-9 are closed.

### 3.2 Phase 4

- **AD-01** Automation runtime boundary: **preview-only** (recorded and accepted).

### 3.3 Phase 3 corrections

- Owner approved revising **B-1–B-9**.
- Corrections are complete at the specification level.
- Residual decisions **CV-01–CV-09** remain open.

---

## 4. Design baseline

### 4.1 Shared architecture

- React 19 + TypeScript + Vite + Tailwind frontend.
- Express + TypeScript backend.
- SQLite via `node:sqlite`.
- `index.ts` and `server.ts` both register all routes.
- Live source tree is authoritative for shipped behavior.

### 4.2 RBAC and security

- Five-actor project-scoped model: owner, editor, viewer, commenter, agent.
- Canvas access is project-scoped.
- Automation publish/execute/replay disabled for every role until runtime approval.
- Connector credentials are references only; redact in API, logs, exports, UI, traces, and screenshots.
- No secret readback for any role.

### 4.3 Data, events, audit

- Versioned migration ledger with checksums, dry-run, and rollback.
- Transactional outbox for domain events.
- Structured audit with actor, object, before/after, request/trace IDs, and redaction.
- Idempotency, retry, timeout, cancellation, dead-letter, and replay restrictions.

### 4.4 Design tokens and accessibility

- Canonical six-core namespace: `--pm-canvas`, `--pm-rail`, `--pm-glass`, `--pm-border`, `--pm-accent`, `--pm-text`.
- Supporting tokens governed in tiers.
- Six themes; preserve live values where documentation conflicts.
- WCAG 2.2 AA; fix Porcelain status contrast; add focus trap, skip link, `.sr-only`, and reduced-motion gating.

### 4.5 Shared components

- Button, Panel, Inspector, Drawer, Dialog, Menu, Toolbar, Status, Toast, EmptyState, Loading, ErrorState.
- Accessible names, focus management, keyboard behavior, responsive rules, semantic tokens.

### 4.6 Canvas

- Preserve as visual planning/diagramming.
- Project-scoped authorization.
- Autosave with visible status + version precondition.
- Session-local undo/redo.
- Port-to-port connection authoring with reachable deletion.
- Keyboard, Pointer Events/touch, responsive behavior.
- Canvas connections purely visual.

### 4.7 Automation Studio

- Preview-only.
- Six node types: trigger, transform, decision, action, human gate, error handler.
- Workflow lifecycle: draft, test, published, paused, archived, rollback.
- Execution traces, human gates, test-mode isolation, redaction.
- No live execution, publish, replay, or connector side effects.

---

## 5. Responsive matrix

| Breakpoint | Target |
|---:|---|
| 640px | Mobile: stacked regions, touch targets, no horizontal scroll |
| 768px | Tablet: collapsible inspector, adaptive toolbar |
| 850px | Small desktop: two-column builder where applicable |
| 1120px | Desktop: full Canvas/Automation builder |
| 1280px | Large desktop: expanded inspector and execution drawer |

---

## 6. Implementation constraints

1. Do not implement before CV-01–CV-09, D-01–D-10, and AD-02–AD-18 are recorded.
2. Do not implement before critical baseline remediation is authorized.
3. Keep Canvas and Automation semantics separate.
4. Keep Automation preview-only.
5. Use semantic tokens only; no hardcoded colors.
6. Add tests before extending Canvas or Automation.
7. Run backend typecheck, backend build, frontend typecheck, frontend build, and backend tests before any commit.
8. No schema changes without an explicit migration decision.
9. No credential changes without an explicit provider decision.
10. No runtime/queue/worker implementation until the owner selects test-only or live.

---

## 7. Open decisions

| Gate | Open items |
|---|---|
| Phase 2 `t_7ac0e3a2` | D-01–D-10 |
| Phase 3 `t_76f95792` | CV-01–CV-09 |
| Phase 4 `t_97963e0d` | AD-02–AD-18 |
| Phase 5 `t_58def713` | Implementation authorization |

---

## 8. Handoff acceptance

This package is ready for owner acceptance as the **design handoff**. It is not an implementation authorization.

Acceptance requires:
1. CV-01–CV-09 recorded;
2. D-01–D-10 recorded;
3. AD-02–AD-18 recorded;
4. Critical baseline remediation authorized;
5. Phase 6/7 implementation separately authorized.

---

## 9. Evidence index

All artifacts listed in §2, plus live source files cited with exact paths and line numbers inside each artifact.

---

*Prepared as the Phase 5 final design handoff. This package is a design baseline and decision register, not an implementation authorization.*
