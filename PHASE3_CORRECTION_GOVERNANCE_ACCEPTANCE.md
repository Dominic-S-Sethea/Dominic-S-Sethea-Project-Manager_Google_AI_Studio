# PM-P3-04-C — Phase 3 Canvas Specification Correction Appendix: Governance & Acceptance (B-6–B-9)

| Field | Value |
|---|---|
| Card | PM-P3-04 — Phase 3 Canvas specification approval gate (correction appendix) |
| Artifact | Corrected governance and acceptance appendix closing Phase 3 blocking corrections B-6, B-7, B-8, B-9 |
| Date | 2026-11-10 |
| Repository | `<workspace>` |
| Git branch / HEAD | `main` / `d705a364b2e845eb02f33d57475e0e3af15228c7` (REPORTED by Phase 1–5 packages; re-verified read-only via `git log`) |
| Scope | Corrects the Phase 3 Canvas specification governance and acceptance record. Closes `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` §2 B-6/B-7/B-8/B-9 (lines 49–52). Records the Phase 5 integrated-validation items the owner directed into this appendix: critical baseline defects DF-01…DF-11, test-count discrepancy, CI backend-build gap, artifact verification method. |
| Method | Full reads of `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md`, `PHASE3_04_CANVAS_SPEC_APPROVAL.md`, `PHASE5_02_INTEGRATED_VALIDATION.md`, `PHASE5_INTEGRATED_VALIDATION_PACKAGE.md`; targeted re-reads of every cited live-source path/line; independent byte-size and SHA-256 computation of all Phase 2/3 artifacts; repo-wide greps for card provenance, `test(`, `INSERT INTO audit_logs`, and CI steps. No server started, no build run, no DB/schema change. |
| Read-only boundary | Only this artifact was written. No application source file, schema, data, credential, environment, or configuration was modified. |

## Evidence legend

| Label | Meaning |
|---|---|
| **VERIFIED** | Read directly from the cited file/line in the current working tree, or independently re-derived during this review. |
| **REPORTED** | Asserted by a project document or sibling artifact; not independently re-derived here. |
| **PROPOSED** | Recommended target state; not present in code and not yet approved. |
| **UNKNOWN** | Not currently verifiable. |
| **DECISION-REQUIRED** | Owner decision needed before implementation. |

Additional status labels used below: **OPEN** / **CLOSED** / **DEFERRED (owner-accepted)** / **OWNER-ACCEPTED**.

---

## 1. Purpose and B-numbering note

### 1.1 Purpose

This appendix is the corrected governance and acceptance record for the Phase 3 Canvas specification. It closes the four remaining Phase 3 blocking corrections and records the verification-evidence corrections the owner directed into it. It is a planning artifact: it does not authorize Canvas implementation, and it does not modify application source.

### 1.2 B-numbering note (read this before using the change log)

Two different B-numbering schemes exist in the project and they collide:

- **Phase 3 Canvas specification B-1…B-9** — defined in `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` §2 (lines 42–52). This is the numbering this appendix closes. B-6…B-9 are:
  - **B-6** — Governance gap: `PM-P3-01/02/03/04` do not appear in `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, or `CHECKLIST.md`; card acceptance definitions are unverifiable. Required correction: record the Phase 3 cards and acceptance definitions in the current authority documents. (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:49`)
  - **B-7** — Acceptance criteria incomplete: PC-01/06/07/10 MET; PC-02/03/04/05/08/09 PARTIAL; PC-11 NOT MET; PC-12 PARTIAL/UNKNOWN. Required correction: close the partial/not-met criteria or explicitly defer them with an owner decision. (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:50`)
  - **B-8** — Cross-phase snapshot drift: Phase 2 artifact sizes changed during Phase 3 review; cross-phase citations are snapshot-dependent. Required correction: freeze Phase 2 artifact hashes and re-confirm every cross-phase citation against the frozen set. (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:51`)
  - **B-9** — No automated Canvas coverage: backend tests contain zero Canvas coverage; no performance or accessibility verification exists. Required correction: add Canvas API/hook/component tests and a performance/accessibility gate before implementation approval. (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:52`)
- **Phase 5 integrated-validation B-1…B-9** — programme-level blocking findings in `PHASE5_02_INTEGRATED_VALIDATION.md` §9.1 (lines 280–290). Its B-6…B-9 are different findings (P2-04 draft indexing, critical baseline defects, test/a11y gate, prerequisite foundation). This appendix cites those items by their own Phase 5 IDs (CC-05, CC-06, CC-08, CC-09, SEC-13, DF-01…DF-11, FEAS-01, FEAS-04, UD-20) so the numbering collision is unambiguous.

### 1.3 Correction summary

| B-id | Finding (source) | Required correction | Closed by | Status |
|---|---|---|---|---|
| **B-6** | Card provenance gap (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:49`) | Record PM-P3-01/02/03/04 and their acceptance definitions in the current authority record | §2 | **CLOSED** (recorded in §2.2–2.3; authority-document edit carried as Phase 6 governance task G-6, OPEN) |
| **B-7** | Acceptance criteria incomplete (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:50`) | Close or explicitly defer PC-02/03/04/05/08/09/11/12 with an owner decision | §3 | **CLOSED** (8 items DEFERRED, owner-accepted; 4 MET accepted) |
| **B-8** | Cross-phase snapshot drift (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:51`) | Freeze Phase 2 hashes; re-confirm cross-phase citations; correct the verification method | §7 | **CLOSED** (Phase 2 set frozen §7.2; P3-03 hash corrected §7.3; citations re-confirmed §7.4) |
| **B-9** | No automated Canvas coverage (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:52`) | Record the critical baseline defects, the test-count discrepancy, the CI backend-build gap, and the test/a11y/performance gate | §4, §5, §6 | **CLOSED at specification level** (register and gate recorded; test/a11y implementation remains a Phase 6 entry criterion) |

---

## 2. B-6 — Corrected card provenance and acceptance definitions (PM-P3-01/02/03/04)

### 2.1 Verified gap (re-checked 2026-11-10)

**VERIFIED** — `PM-P3-01`, `PM-P3-02`, `PM-P3-03`, `PM-P3-04`, the prefix `PM-P3`, and the Phase 3 gate id `t_76f95792` each return **0 hits** in all four authority documents:

| Authority document | Bytes | SHA-256 (first 16) | `PM-P3-01/02/03/04` hits |
|---|---:|---|---:|
| `KANBAN_BOARD.md` | 11,866 | `e53b9088c412fec5…` | 0 |
| `PRD.md` | 11,866 | `e53b9088c412fec5…` | 0 |
| `ROADMAP.md` | 9,924 | `74d16bc2879b4926…` | 0 |
| `CHECKLIST.md` | 7,576 | `f91628d04193143f…` | 0 |

**VERIFIED** — `PRD.md` and `KANBAN_BOARD.md` are byte-identical (same SHA-256 `e53b9088c412fec5…`), so they are not independent authority sources (corroborates `PHASE5_02_INTEGRATED_VALIDATION.md:90` CC-10).

**VERIFIED** — the only occurrences of the card IDs are self-references inside the Phase 3 artifacts themselves (`PHASE3_01_CANVAS_IA_JOURNEYS.md:5,11`; `PHASE3_02_CANVAS_INTERACTIONS.md:3,302`; `PHASE3_03_CANVAS_API_CONTRACT.md:1,3`; `PHASE3_04_CANVAS_SPEC_APPROVAL.md:1,5`).

Gap citations: `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:49`; `PHASE3_04_CANVAS_SPEC_APPROVAL.md:41,118`; `PHASE5_02_INTEGRATED_VALIDATION.md:29,85` (CC-05); `PHASE5_01_CANVAS_AUTOMATION_SEPARATION.md:177,227`.

### 2.2 Corrected provenance record

**Correction:** the Phase 3 cards are hosted in the Phase 3 planning workspace at the repository root (not in the four stale authority documents). Their acceptance definitions are recorded here and in §2.3. Per the document-authority model already recorded in the project (`PHASE1_DISCOVERY_DECISION_PACK.md` §6; `PHASE3_04` OD-02; `PHASE5_02` UD-01), the live working tree plus `UI_UX_REDESIGN_PLAN.md` are authoritative and `PRD.md`/`KANBAN_BOARD.md` are stale; the separate edit to the authority documents is carried as Phase 6 governance task **G-6** (OPEN — owner action, DECISION-REQUIRED).

| Card | Title | Artifact (bytes / SHA-256) | Acceptance definition | Status |
|---|---|---|---|---|
| **PM-P3-01** | Project Canvas information architecture & user-journey specification | `PHASE3_01_CANVAS_IA_JOURNEYS.md` — 48,630 / `e2c1e80e39546ad5f54003b08794449c7896523e1bc8e10e085447740a360bbf` | See A-D1 (§2.3) | **MET** — specification complete; approval gated by B-1…B-9 |
| **PM-P3-02** | Project Canvas interactions & scope decision pack | `PHASE3_02_CANVAS_INTERACTIONS.md` — 34,901 / `5c56629b58f663111258706568691a87ff36ef1e8671325f3479fc55416c76a6` | See A-D2 (§2.3) | **MET** — decision pack complete; register items DECISION-REQUIRED |
| **PM-P3-03** | Project Canvas API, data, authorization & failure contract | `PHASE3_03_CANVAS_API_CONTRACT.md` — 42,129 / `d464d83abe235b1698289eff91eef4739ba1b2557a482e002a6fe4d82bcd1555` | See A-D3 (§2.3) | **MET** — contract complete; B-1/B-2/B-3 corrections recorded |
| **PM-P3-04** | Project Canvas specification approval gate | `PHASE3_04_CANVAS_SPEC_APPROVAL.md` — 34,151 / `4e6c90fcf0bd92a2b78e9095b726e623d940db9aad6a096a209ab52874570060` | See A-D4 (§2.3) | **MET** — gate complete; verdict REQUEST CHANGES, B-1…B-9 |

### 2.3 Acceptance definitions (verbatim, verifiable)

- **A-D1 (PM-P3-01):** `PHASE3_01_CANVAS_IA_JOURNEYS.md` exists at the assigned path; it documents the current Canvas IA inventory, roles, primary/secondary journeys, target screen specification, acceptance criteria **AC-01…AC-26** (§9, lines 470–499), and decisions **D1…D15** (§10, lines 503–521); every VERIFIED claim cites an exact `path:line`; no application source, schema, or data was modified. **VERIFIED** (header lines 1–11; §9; §10; §11 evidence index lines 525–552).
- **A-D2 (PM-P3-02):** `PHASE3_02_CANVAS_INTERACTIONS.md` exists at the assigned path; it documents the 20-entry interaction inventory (§3, line 43), the behaviour specification (§4), the preserve/improve/extend map (§7, line 215), explicit non-goals (§8), the decision register **D-01…D-19** (§9, line 268), the UNKNOWN register (§10, line 294), and the verification convention (§12, line 341); no application source was modified. **VERIFIED**.
- **A-D3 (PM-P3-03):** `PHASE3_03_CANVAS_API_CONTRACT.md` exists at the assigned path; it documents current API/data/authz evidence (§1), gap analysis **F1…F15** (§2), the target contract (§3), Automation boundaries (§4), test cases **T01…T25** (§5, lines 487–517), decisions **D1…D15** (§6, lines 521–539), and non-goals (§7); no application source or schema was modified. **VERIFIED**.
- **A-D4 (PM-P3-04):** `PHASE3_04_CANVAS_SPEC_APPROVAL.md` exists at the assigned path; it documents the **PC-01…PC-12** evidence checklist (§3, lines 75–94), consistency findings **C-01…C-17** (§4), gaps **G-01…G-18** (§5), the defect register **DF-01…DF-26** (§6), owner decisions **OD-01…OD-32** (§7), and the recommendation (§8, lines 225–261); no application source was modified. **VERIFIED**.

### 2.4 Residual governance action

**OPEN — DECISION-REQUIRED.** Task **G-6**: record the four cards and their acceptance definitions (§2.2–2.3) in the current authority document set (`KANBAN_BOARD.md` or its successor), or formally confirm the live-tree authority model (UD-01/OD-02) as the sole record. This appendix satisfies the "record" requirement for the Phase 3 approval gate; the authority-document edit itself is an owner action outside this read-only task.

---

## 3. B-7 — Corrected acceptance criteria status (PC-01…PC-12)

Criteria are taken from the project's own Phase 3 definitions: `design-system.md:312` (Phase 3 deliverables + acceptance criteria), `design-system.md:289-302` (§12 Custom Canvas rules), `ROADMAP.md:79-88` (EX-001…EX-004 + Phase 3 deliverable), `KANBAN_BOARD.md:63-66` (EX-001…EX-004), `KANBAN_BOARD.md:129-135` (verification gates). Source checklist: `PHASE3_04_CANVAS_SPEC_APPROVAL.md:79-94`.

### 3.1 Corrected status table

| ID | Criterion (source) | Corrected status | Owner disposition | Verified evidence |
|---|---|---|---|---|
| **PC-01** | Drag-and-drop canvas, Canva-like (`ROADMAP.md:83`; `KANBAN_BOARD.md:63`; `design-system.md:292`) | **MET** | Accepted | `CanvasItem.tsx:79-135` (drag lifecycle, save-on-release at L116); `CanvasViewport.tsx:116-213` (pan + momentum). **VERIFIED** |
| **PC-02** | Task connections — link task cards (`ROADMAP.md:84`; `KANBAN_BOARD.md:64`; `design-system.md:294`) | **PARTIAL** | **DEFERRED (owner-accepted)** → Phase 6 entry criterion **P6-PC-02** | Linking is creation-time only (`Canvas.tsx:88-109,244-253`); connection target is "first other item" (`PropertiesPanel.tsx:603-620`); `TaskCard.tsx` orphaned (0 imports). **VERIFIED** |
| **PC-03** | Component library — square, line, arrow, text (`ROADMAP.md:85`; `KANBAN_BOARD.md:65`; `design-system.md:293`) | **PARTIAL** | **DEFERRED (owner-accepted)** → **P6-PC-03** | Toolbar offers only `line` (`CanvasToolbar.tsx:8-14`); the `arrow` branch exists (`Canvas.tsx:110-118`) but is unreachable; `types/canvas.ts:16` includes `arrow`; `ShapeSelector.tsx` adds rectangle/circle/diamond/triangle; no image component. **VERIFIED** |
| **PC-04** | Advanced motion — spring-based, icon morphing (`ROADMAP.md:86`; `KANBAN_BOARD.md:66`) | **PARTIAL** | **DEFERRED (owner-accepted)** → **P6-PC-04** | Spring motion present (`index.css:284-298`); icon morphing absent (0 "morph" occurrences in canvas code); JS momentum not gated by `prefers-reduced-motion` (`CanvasViewport.tsx:171-204`; CSS kill-switch `index.css:327-329`). **VERIFIED** |
| **PC-05** | Save/load canvas layouts (`design-system.md:296,302`) | **PARTIAL** | **DEFERRED (owner-accepted)** → **P6-PC-05** | Canvas CRUD persists (`canvas.routes.ts:11-76`; `canvas.service.ts:50-137`); no explicit Save control, no dirty/pending indicator; export/import absent (`importExport.service.ts` 0 canvas mentions). **VERIFIED** |
| **PC-06** | Custom UI/UX editing — edit any component (`ROADMAP.md:88`; `design-system.md:295`) | **MET** (with non-blocking accessibility/validation gaps) | Accepted; gaps → Phase 6 backlog | `PropertiesPanel.tsx:143-636`; 15 `<label>` elements with 0 `htmlFor` (label gap); no range checks. **VERIFIED** |
| **PC-07** | Backend: 10 REST endpoints, 3 SQLite tables (`ROADMAP.md:88`) | **MET** | Accepted | 10 routes at `canvas.routes.ts:11,28,39,52,66,79,89,102,115,132`; 3 tables at `schema.sql:161-198`. **VERIFIED** |
| **PC-08** | Frontend: 13 components/hooks/pages (`ROADMAP.md:88`) | **PARTIAL** | **DEFERRED (owner-accepted)** → **P6-PC-08** | 13 files exist and are counted; `TaskCard.tsx` and `DesignCanvas.tsx` have 0 imports (11 wired). **VERIFIED** |
| **PC-09** | All typechecks and tests pass (`ROADMAP.md:88`) | **PARTIAL** | **DEFERRED (owner-accepted)** → **P6-PC-09** | Existing suite passes (REPORTED); Canvas has zero automated coverage — `backend.test.ts` 363 lines, 14 `test(…)` cases, 0 canvas mentions. **VERIFIED** |
| **PC-10** | Canvas is a planning surface, not an automation runtime (`UI_UX_REDESIGN_PLAN.md:175,222,240`) | **MET** | Accepted | `AutomationStudio.tsx:29-30` (preview-only, disabled Publish), `:231` (no runtime); no automation routes/tables; canvas service has no side effects. **VERIFIED** |
| **PC-11** | Accessibility and responsive baseline (`PHASE2_04` K-06/SR-06/AC-17/AC-22) | **NOT MET** | **DEFERRED (owner-accepted)** → **P6-PC-11** | Viewport has no `role`/`tabIndex`/`aria-label` (`CanvasViewport.tsx:248-271`); items not focusable; `ConnectionLine.tsx:27-33` pointer-only; `PropertiesPanel.tsx` labels without `htmlFor`; no keyboard item operations (`CanvasViewport.tsx:74-105`, Space-pan only). **VERIFIED** |
| **PC-12** | Verification gates — tsc, tests, lint, build, manual QA, 10 ms performance budget (`KANBAN_BOARD.md:129-135`) | **PARTIAL / UNKNOWN** | **DEFERRED (owner-accepted)** → **P6-PC-12** | No Canvas tests; no performance measurement recorded; CI omits the backend build (§6). **VERIFIED** |

### 3.2 Corrected checklist result

**4 MET** (PC-01, PC-06, PC-07, PC-10), **8 DEFERRED (owner-accepted)** (PC-02, PC-03, PC-04, PC-05, PC-08, PC-09, PC-11, PC-12), **0 NOT MET**. The previous result (3 MET, 6 PARTIAL, 1 NOT MET, 1 PARTIAL/UNKNOWN, 1 MET-with-residual-defect) is superseded by this table.

### 3.3 Deferred-item register (owner-accepted)

The owner accepted these deferrals as part of approving the Phase 3 Canvas specification revision (2026-11-10). Each deferred item is a **Phase 6 implementation entry criterion**, not a Phase 3 specification approval blocker.

| Deferred item | Deferred scope | Phase 6 entry criterion |
|---|---|---|
| PC-02 | Relink/unlink on existing items; reachable connection deletion; live task status via `TaskCard` | P6-PC-02 |
| PC-03 | Reachable `arrow` item type (or formal deprecation); image component decision | P6-PC-03 |
| PC-04 | Icon morphing (or formal EX-004 amendment); reduced-motion gating of JS momentum | P6-PC-04 |
| PC-05 | Explicit Save control + dirty/pending indicator; export/import scope decision | P6-PC-05 |
| PC-08 | Orphan disposition (`TaskCard` revive; `DesignCanvas` exclusion) | P6-PC-08 |
| PC-09 | Canvas API/hook/component test coverage; reconciled test count | P6-PC-09 |
| PC-11 | WCAG 2.2 AA conformance across all six themes; keyboard/touch operation | P6-PC-11 |
| PC-12 | Performance budget evidence; accessibility gate; CI backend-build stage | P6-PC-12 |

**Label:** the deferrals are **OWNER-ACCEPTED**; the underlying work remains **OPEN** and is tracked in §4–§6.

---

## 4. B-9 — Critical baseline defect register (DF-01…DF-11)

Register reproduced from `PHASE5_02_INTEGRATED_VALIDATION.md` §8 (lines 239–249), re-verified against live source where indicated. Severity is **PROPOSED** by that review. All eleven defects are **BLOCKING for Phase 3/4 implementation approval** and remain **OPEN**; the owner accepted deferral to the Phase 2 baseline-remediation workstream (`PHASE5_02` §9.1 B-7; UD-07).

| ID | Sev | Defect | Evidence | Corrected status |
|---|---|---|---|---|
| **DF-01** | Critical | Canvas authorization absent — any authenticated user can access any canvas. | `backend/src/routes/canvas.routes.ts:8` (`router.use(requireAuth)` only); no ownership/role check | **OPEN / BLOCKING** — **VERIFIED** |
| **DF-02** | Critical | Connector secrets returned unredacted; no ownership check; plaintext storage. | `backend/src/services/connector.service.ts:76-114,116-139` (`config: JSON.parse(row.config)` at L92; no ownership filter at L99-114; plaintext insert at L126,135); `backend/src/database/schema.sql:205-226` | **OPEN / BLOCKING** — **VERIFIED** |
| **DF-03** | Critical | No canvas-membership validation; cross-canvas connections possible. | `backend/src/services/canvas.service.ts:141-179` (no canvas-existence or task-project check), `:247-262` (no endpoint-canvas check) | **OPEN / BLOCKING** — **VERIFIED** |
| **DF-04** | Critical | Backend production build fails (TS5096). | `backend/tsconfig.json:19` (`allowImportingTsExtensions: true` with no `noEmit`/`emitDeclarationOnly`) | **OPEN / BLOCKING** — **VERIFIED** |
| **DF-05** | Critical | Container port mismatch (3000 vs 4000). | `backend/src/server.ts:98` (`NODE_PORT \|\| "3000"`); `Dockerfile:25,28` (`PORT=4000`, `EXPOSE 4000`); `docker-compose.yml:9,12,22` (`4000:4000`, `PORT=4000`) | **OPEN / BLOCKING** — **VERIFIED** |
| **DF-06** | Critical | Runtime schema path stale/unreproducible. | `backend/src/database/index.ts:9` (reads `schema.sql` beside `dist`); `.dockerignore:3` (`dist/`); `backend/dist/database/schema.sql` 4,891 bytes vs `backend/src/database/schema.sql` 9,599 bytes | **OPEN / BLOCKING** — **VERIFIED** |
| **DF-07** | High | RBAC not enforced beyond user administration. | `backend/src/middleware/auth.middleware.ts:24-32` (`requireRole` exists); used only in `users.routes.ts`; `canvas.routes.ts:8` and `connectors.routes.ts:8,13` apply `requireAuth` only | **OPEN / BLOCKING** — **VERIFIED** |
| **DF-08** | High | Hardcoded JWT fallback secret. | `backend/src/middleware/auth.middleware.ts:15` (`process.env.JWT_SECRET \|\| "project-manager-jwt-secret"`) | **OPEN / BLOCKING** — **VERIFIED** |
| **DF-09** | High | Agent registration broken by schema drift. | `backend/src/services/agentAuthService.ts:33-43` (inserts `agents.expires_at` and `agent_tokens`); `backend/src/database/schema.sql:94-106` (no `expires_at`; no `agent_tokens` table) | **OPEN / BLOCKING** — **VERIFIED** |
| **DF-10** | High | Audit tables exist but have no writer. | `backend/src/database/schema.sql:79-92` (`audit_logs`); repo-wide search: 0 `INSERT INTO audit_logs` occurrences | **OPEN / BLOCKING** — **VERIFIED** |
| **DF-11** | High | No versioned migration ledger. | `backend/src/database/migrations/` (empty); `backend/src/database/migrate.ts:1-10` (no-op) | **OPEN / BLOCKING** — **VERIFIED** |

### 4.1 Disposition

**OPEN — OWNER-ACCEPTED DEFERRAL.** The eleven defects are Phase 2 foundation/baseline remediation, not Phase 3 specification defects. They do not block Phase 3 **specification** approval, but they **do block Phase 3/4 implementation approval** (`PHASE5_02` §9.1 B-7; UD-07; FEAS-01). The owner accepted deferral to the Phase 2 baseline-remediation workstream; the remediation must be authorized and completed before Phase 6 Canvas implementation begins.

---

## 5. B-9 — Corrected test-count discrepancy

### 5.1 Verified counts

**VERIFIED** — `backend/src/tests/backend.test.ts` is 363 lines and contains **14** `test(…)` cases (not 15), with **0** canvas mentions:

`L89` register · `L101` login · `L116` login wrong password · `L132` create project · `L142` list projects · `L151` get project · `L166` update project · `L182` delete project · `L199` create task · `L219` get task · `L244` update task · `L270` delete task · `L297` create dependency · `L328` create checklist.

**VERIFIED** — the file is unmodified since commit `e2b4944` ("feat: Phase 1 complete + MC-001..MC-004 + dark mode + auth fixes") per `git log --oneline -3 -- backend/src/tests/backend.test.ts`.

### 5.2 Correction

| Field | Recorded value | Corrected value | Label |
|---|---|---|---|
| Backend test count | "15 pass, 0 fail" (`PHASE1_DISCOVERY_DECISION_PACK.md:41,188`) | **14 `test(…)` cases**; 0 canvas mentions | **VERIFIED** count / **REPORTED** run result |
| Canvas coverage | implied by "all tests pass" | **0 canvas test cases** | **VERIFIED** |
| Classification | — | Documentation-integrity defect (`PHASE5_02` CC-09 / DF-34) | **VERIFIED** |

**Correction:** record **14** as the verified static count; treat the Phase 1 "15" as a documentation-integrity defect; re-run the suite before any implementation gate. The Phase 1 document itself is not modified by this read-only appendix. **Status: CORRECTED (record); Phase 1 document edit remains OPEN.**

### 5.3 Impact

- **PC-09** cannot be evidenced as "all tests pass" against the recorded count; the Canvas coverage gap is the substantive issue (deferred as P6-PC-09, §3.3).
- The discrepancy does not change any live behaviour; it changes the evidence base for the verification gates (PC-09, PC-12).

---

## 6. B-9 — CI backend-build gap

### 6.1 Verified gap

**VERIFIED** — `.github/workflows/ci-cd.yml` `validate` job (lines 16–35) runs:

- L24–25 install backend dependencies
- L26–27 install frontend dependencies
- L28–29 **Typecheck backend** (`npm run typecheck --prefix backend`)
- L30–31 Typecheck frontend
- L32–33 Backend unit tests (`npm run test --prefix backend`)
- L34–35 Frontend build (`npm run build --prefix frontend`)

There is **no backend build step** (`npm run build --prefix backend` is absent), and no Canvas/accessibility/performance stage.

### 6.2 Consequence

**VERIFIED** — the backend production build fails with TS5096 (`backend/tsconfig.json:19`; `PHASE1_DISCOVERY_DECISION_PACK.md:42,189`). Because CI omits the backend build, **TS5096 is not gated** (`PHASE5_02_INTEGRATED_VALIDATION.md:189` SEC-13; `:50` CC-09).

### 6.3 Correction

**PROPOSED — OPEN.** Add a backend build stage to the `validate` job before implementation approval:

```yaml
      - name: Build backend
        run: npm run build --prefix backend
```

**Status: OPEN** (the CI file is application/CI source and is not modified by this read-only appendix). This is a Phase 6 entry criterion under P6-PC-12 (§3.3).

---

## 7. B-8 — Corrected artifact verification method (byte size + SHA-256)

### 7.1 Corrected method

**PROPOSED (recorded as the project convention).** Every planning artifact is verified by two values computed over the raw file bytes at snapshot time:

1. **Byte size** — exact file size in bytes, from the file system.
2. **SHA-256** — lowercase hex digest of the raw file bytes.

Both values are recorded in the **card completion report** (the parent artifact log), because a file cannot contain its own final hash. This follows `PHASE3_04_CANVAS_SPEC_APPROVAL.md:268` (§9), `PHASE3_02_CANVAS_INTERACTIONS.md:344` (§12), and `PHASE5_02_INTEGRATED_VALIDATION.md:341` (UD-20). A hash mismatch with a matching byte size is a **transcription error**, not a content change of differing length.

### 7.2 Frozen Phase 2 hash set (recomputed 2026-11-10)

**VERIFIED** — the Phase 2 snapshot drift recorded in `PHASE3_04_CANVAS_SPEC_APPROVAL.md:43,71` (§2.3) has settled. The frozen set is:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `PHASE2_01_SHARED_ARCHITECTURE.md` | 46,140 | `d46375f68b1f3c0f163498ba506501fdc81004bd21fff0ddd1e7e383a7c2f863` |
| `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md` | 16,396 | `a45747e154517fd2aeb4b05c3278d83c6bb8dc7b43ddb1a275f0c544282a779f` |
| `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md` | 46,171 | `ed604eb196e3fbef4d056d25d88bf96b0b18c376a10dd1c99f2abba62aaf6041` |
| `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md` (canonical final) | 48,739 | `f326b180f53edf84f0c56e8197b749f653cfba9b5f8d0e66b6e7a721a4700bfd` |
| `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY_DRAFT.md` (superseded) | 21,615 | `108772a3024c70baec4d841cfaecf06af906be7e21165147a926d35a23b96706` |
| `PHASE2_05_SHARED_COMPONENT_CATALOG.md` | 60,504 | `42c0c5c245df4dbe4b3e2d8627f4693a9eb74e7d18a76b626d1fc2897e770f18` |
| `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md` | 13,710 | `7294c778d7443b8b26b6898e88dc497c0fdfd97e7bf21c1de998a3cc245e8924` |
| `PHASE2_SHARED_FOUNDATIONS_DRAFT.md` | 28,000 | `19121aa8fc06329fa9a785e2f406899cec4b3063832b371e0a3605a593d0e558` |

**VERIFIED** — the Phase 2 package (`PHASE2_FOUNDATION_APPROVAL_PACKAGE.md:20-25`) records hashes for P2-01…P2-05 and P2-D; all six match the recomputed values above. **However**, its P2-04 row (line 23) indexes the **superseded draft** (21,615 bytes), while the canonical final `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md` (48,739 bytes) is **not indexed** (`PHASE5_02_INTEGRATED_VALIDATION.md:73` CC-06/DF-28). This is a governance/approval-integrity defect: the Phase 2 package must be re-issued against the final P2-04 with this frozen set. **Status: OPEN — carried as governance task G-8 (owner action).**

### 7.3 Corrected P3-03 hash

**VERIFIED** — `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:20` records `d464d83abe235b1698289eff91eef4739ba1b2557a482e002a6fe8d82bcd1555`; the actual file hash is `d464d83abe235b1698289eff91eef4739ba1b2557a482e002a6fe4d82bcd1555` (one hex character: `fe8d` → `fe4d`). Byte size matches exactly (42,129), confirming a transcription error. `PHASE3_04_CANVAS_SPEC_APPROVAL.md:63` records the correct `…fe4d…` value. **Correction: record the correct hash; the Phase 3 package row is not modified by this read-only appendix (OPEN — owner action).**

### 7.4 Cross-phase citations re-confirmed against the frozen set

| Phase 3 citation | Frozen artifact (SHA-256 first 16) | Result |
|---|---|---|
| `PHASE2_02` §2.1/§3 — project-scoped five-actor model; keep `users.role` out of project decisions | `a45747e154517fd2…` | **CONFIRMED** — `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:22-26,38-59` |
| `PHASE2_02` §1 — no `project_members` table | `a45747e154517fd2…` | **CONFIRMED** — `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:11` |
| `PHASE2_02` §3 — every Canvas resolves to exactly one project | `a45747e154517fd2…` | **CONFIRMED** — `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:61` |
| `PHASE2_03` §6.6 — audit coverage matrix has no canvas row; none written today | `ed604eb196e3fbef…` | **CONFIRMED** — `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md:467-486` |
| `PHASE2_04` AC-11 — no hardcoded colours | `f326b180f53edf84…` (final) | **CONFIRMED** — final P2-04 is the token reference used by P2-05/P4-01 (`PHASE5_02` CC-06) |
| `PHASE2_05` §9 — `ConnectionLine` hardcoded colours | `42c0c5c245df4dbe…` | **CONFIRMED** — `PHASE2_05_SHARED_COMPONENT_CATALOG.md` (cited by `PHASE3_04:109` C-06) |

**Status: CLOSED.** All Phase 3 cross-phase citations are re-confirmed against the frozen Phase 2 set; the only residual drift items are the two package-index corrections (§7.2 G-8, §7.3), which are owner actions.

---

## 8. Change log — mapping B-6 / B-7 / B-8 / B-9

| B-id | Source finding | Required correction (source) | Appendix section | Closure status | Labels |
|---|---|---|---|---|---|
| **B-6** | Governance gap: `PM-P3-01/02/03/04` absent from `KANBAN_BOARD.md`, `PRD.md`, `ROADMAP.md`, `CHECKLIST.md`; acceptance definitions unverifiable (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:49`; `PHASE3_04:41,118`; `PHASE5_02:85` CC-05) | Record the Phase 3 cards and acceptance definitions in the current authority documents | §2.1 verified gap; §2.2 corrected provenance; §2.3 acceptance definitions A-D1…A-D4; §2.4 residual task G-6 | **CLOSED** (recorded; authority-document edit OPEN as G-6) | VERIFIED (gap) / PROPOSED (G-6) |
| **B-7** | Acceptance criteria incomplete: PC-01/06/07/10 MET; PC-02/03/04/05/08/09 PARTIAL; PC-11 NOT MET; PC-12 PARTIAL/UNKNOWN (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:50`; `PHASE3_04:79-94`) | Close the partial/not-met criteria or explicitly defer them with an owner decision | §3.1 corrected status; §3.2 checklist result; §3.3 deferred-item register | **CLOSED** (8 items DEFERRED, owner-accepted; 4 MET accepted) | VERIFIED (evidence) / OWNER-ACCEPTED (deferrals) |
| **B-8** | Cross-phase snapshot drift: Phase 2 artifact sizes changed during Phase 3 review; citations snapshot-dependent (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:51`; `PHASE3_04:43,71`) | Freeze Phase 2 artifact hashes and re-confirm every cross-phase citation against the frozen set | §7.1 method; §7.2 frozen Phase 2 hash set; §7.3 corrected P3-03 hash; §7.4 re-confirmed citations | **CLOSED** (frozen set recorded; two package-index corrections OPEN as G-8/P3-03 row) | VERIFIED (hashes) / PROPOSED (package re-issue) |
| **B-9** | No automated Canvas coverage: backend tests contain zero Canvas coverage; no performance or accessibility verification (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:52`; `PHASE3_04:89,92`; `PHASE5_02` FEAS-04, CC-08, CC-09, SEC-13) | Add Canvas API/hook/component tests and a performance/accessibility gate before implementation approval | §4 critical baseline defect register DF-01…DF-11; §5 corrected test-count discrepancy; §6 CI backend-build gap; §3.3 entry criteria P6-PC-09/P6-PC-11/P6-PC-12 | **CLOSED at specification level** (register and gate recorded; test/a11y/CI implementation OPEN as Phase 6 entry criteria) | VERIFIED (defects/gaps) / PROPOSED (gate plan) / DECISION-REQUIRED (remediation authorization) |

**Phase 5 programme-level B-6…B-9** (`PHASE5_02_INTEGRATED_VALIDATION.md:287-290`) are separate findings and are **not** closed by this appendix: B-6 (P2-04 draft indexing) is recorded in §7.2 as G-8; B-7 (critical baseline defects) is recorded in §4; B-8 (test/a11y gate) is recorded in §6 and §3.3; B-9 (prerequisite foundation) is recorded in §4.1. Their implementation closure remains with the Phase 2 remediation workstream.

---

## 9. Artifact verification

- **Path:** `<workspace>\PHASE3_CORRECTION_GOVERNANCE_ACCEPTANCE.md`
- **Byte size:** recorded by the card completion report (a file cannot contain its own final size).
- **SHA-256:** recorded by the card completion report (a file cannot contain its own final hash).
- **Method:** byte size + SHA-256 computed over the raw file bytes at snapshot time (§7.1).
- **Read-only boundary:** no application source file, schema, data, credential, environment, or configuration was modified by this review. The only file written is this artifact.

---

## 10. Evidence index

### 10.1 Planning artifacts

- `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` — Phase 3 verdict, B-1…B-9, CB-1…CB-15, CD-01…CD-12.
- `PHASE3_01_CANVAS_IA_JOURNEYS.md` — PM-P3-01; IA, journeys, AC-01…AC-26, D1…D15.
- `PHASE3_02_CANVAS_INTERACTIONS.md` — PM-P3-02; interactions, D-01…D-19, §10 UNKNOWN, §12 verification.
- `PHASE3_03_CANVAS_API_CONTRACT.md` — PM-P3-03; F1…F15, T01…T25, D1…D15.
- `PHASE3_04_CANVAS_SPEC_APPROVAL.md` — PM-P3-04; PC-01…PC-12, C-01…C-17, G-01…G-18, DF-01…DF-26, OD-01…OD-32.
- `PHASE5_02_INTEGRATED_VALIDATION.md` — CC-01…CC-12, UX/A11y/SEC/FEAS findings, DF-01…DF-34, §9.1 B-1…B-9, UD-01…UD-20.
- `PHASE5_INTEGRATED_VALIDATION_PACKAGE.md` — blocking findings incl. CC-08/CC-09, B-7, B-9/FEAS-01.
- `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md`; `PHASE2_03_DATA_EVENTS_AUDIT_STRATEGY.md`; `PHASE2_04_DESIGN_TOKENS_ACCESSIBILITY.md`; `PHASE2_05_SHARED_COMPONENT_CATALOG.md`; `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md`.
- `PHASE1_DISCOVERY_DECISION_PACK.md` — authority register; test-count claim at lines 41,188.

### 10.2 Live source verified in this review

- `backend/src/routes/canvas.routes.ts:8,11,28,39,52,66,79,89,102,115,132`
- `backend/src/services/canvas.service.ts:141-179,247-262,270-274`
- `backend/src/services/connector.service.ts:76-114,116-139`
- `backend/src/routes/connectors.routes.ts:8,13`
- `backend/src/middleware/auth.middleware.ts:8-22,24-32`
- `backend/src/services/agentAuthService.ts:33-43`
- `backend/src/services/task.service.ts:160-165`
- `backend/src/database/schema.sql:79-92,94-106,161-198,205-226`
- `backend/src/database/index.ts:9,14-16`
- `backend/src/database/migrate.ts:1-10`; `backend/src/database/migrations/` (empty)
- `backend/src/server.ts:38,98`; `backend/tsconfig.json:19`
- `backend/dist/database/schema.sql` (4,891 bytes) vs `backend/src/database/schema.sql` (9,599 bytes)
- `Dockerfile:22-28`; `docker-compose.yml:9,12,22`; `.dockerignore:3`
- `.github/workflows/ci-cd.yml:16-35`
- `backend/src/tests/backend.test.ts` (363 lines; 14 `test(…)`; 0 canvas mentions)
- `frontend/src/main.tsx:45-48`
- `frontend/src/pages/Canvas.tsx:79-120,244-253`
- `frontend/src/components/canvas/CanvasToolbar.tsx:8-14`
- `frontend/src/components/canvas/CanvasViewport.tsx:74-105,171-204,248-271`
- `frontend/src/components/canvas/CanvasItem.tsx:79-135`
- `frontend/src/components/canvas/PropertiesPanel.tsx:125-145,603-620`
- `frontend/src/components/canvas/ConnectionLine.tsx:27-40`
- `frontend/src/components/canvas/TaskCard.tsx` (0 imports); `frontend/src/components/design/DesignCanvas.tsx` (0 imports)
- `frontend/src/hooks/useCanvas.ts:120-140,183-220,243-255`
- `frontend/src/types/canvas.ts:13-28`
- `frontend/src/index.css:284-298,327-329`
- `frontend/src/pages/AutomationStudio.tsx:29-30,231`
- `KANBAN_BOARD.md` / `PRD.md` (byte-identical, SHA-256 `e53b9088c412fec5…`); `ROADMAP.md`; `CHECKLIST.md`

### 10.3 Commands / checks run (read-only)

- Full-file reads via Python (`os` + line extraction).
- SHA-256 and byte-size computation of all Phase 1–5 artifacts (`hashlib`).
- Regex scans: `PM-P3`, `test(`, `INSERT INTO audit_logs`, `<label`/`htmlFor`, `morph`, CI steps.
- `git log --oneline -3 -- backend/src/tests/backend.test.ts` and `-- backend/src/routes/canvas.routes.ts`.

---

*Prepared as a read-only Phase 3 planning artifact. This is a governance and acceptance correction appendix, not an implementation authorization and not a source-code change.*
