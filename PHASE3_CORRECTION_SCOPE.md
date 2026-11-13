# PHASE3_CORRECTION_SCOPE — Phase 3 Canvas Specification Corrections B-3, B-4, B-5

**Status:** Corrected scope appendix — **PROPOSED** for owner application  
**Phase:** 3 — Project Canvas Specification  
**Repository:** `<workspace>`  
**Git branch:** `main`  
**Git HEAD:** `d705a364b2e845eb02f33d57475e0e3af15228c7`  
**Source of corrections:** `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` §2 “Blocking corrections (B-1–B-9)” (lines 40–52)  
**Scope of this appendix:** B-3, B-4, B-5 only. B-1, B-2, B-6–B-9 are out of scope.  
**Implementation boundary:** Read-only planning artifact. This appendix does not modify application source, schema, API, database, or any other file. Every replacement below is a proposal for the owner to apply to the named file; none has been applied.

> **Labels:** **VERIFIED** = read directly from live source or a generated artifact. **REPORTED** = stated in a project document but not independently proved. **PROPOSED** = recommended but not approved. **DECISION-REQUIRED** = owner decision required.

---

## 1. Correction summary

| # | Blocking finding (package) | Corrected policy | Primary affected sources | Status |
|---|---|---|---|---|
| **B-3** | Global-canvas conflict — P3-03 D2 proposes admin-only `project_id = null`; P3-01 D11 allows null; `PHASE2_02` §3 requires exactly one project. | **Require `project_id`.** Every Canvas resolves to exactly one project. `project_id = null` (global canvases) is not permitted; the admin-only null proposal is removed. “All projects” is a filter, not an unassigned-canvas container. | `PHASE3_03` §3.3/§3.4/§3.5.1/§6 D2; `PHASE3_01` §4.2/D11; `PHASE3_04` C-02/DF-12/OD-04/B-2; package B-3/CD-07 | PROPOSED |
| **B-4** | Membership model does not exist — P3-02 §7.2/D-12 says “existing project membership model”; no `project_members` table exists. | **Proposed Phase 2 model.** Authorization is project-scoped membership (`project_members`; Owner/Editor/Viewer/Commenter per `PHASE2_02` §2–§3). The model is proposed, not existing; no migration is approved; access fails closed. | `PHASE3_02` §7.2/D-12; `PHASE3_04` C-03/OD-03/B-3; package B-4 | PROPOSED |
| **B-5** | Export/import scope conflict — `design-system.md:302` requires it; P3-01 AC-19/D8 requires it; P3-02 §7.3 says Extend/needs approval; P3-03 §7 says non-goal. | **Deferred to a separate approved card.** Not in Phase 3 Canvas scope. Save/load of canvas layouts remains in scope. JSON only if the separate card approves; PNG/SVG only with explicit owner approval. | `design-system.md:302`; `PHASE3_01` §2.9/§2.10/§4.2/§4.11/AC-11/AC-19/D8; `PHASE3_02` §5/§7.3/D-14; `PHASE3_03` §7; `PHASE3_04` C-04/G-03/OD-18/B-4/PC-05; package B-5/CD-06 | PROPOSED |

---

## 2. B-3 — Corrected global-canvas policy

### 2.1 Policy (PROPOSED)

1. **Every Canvas resolves to exactly one project.** `canvases.project_id` is required for every canvas, including canvases created through `POST /api/canvas`.
2. **Global canvases are disallowed.** `project_id = null` is not a permitted state for any canvas. The admin-only global-canvas proposal in `PHASE3_03` §3.3/D2 is removed.
3. **No cross-project visibility.** A canvas, its items, and its connections are readable/writable only by principals with access to the owning project. There is no “all projects” or global read path.
4. **“All projects” is a filter, not a container.** `GET /api/canvas?project_id=` and the `/canvases` list scope are query filters over project-scoped canvases. They must not surface unassigned canvases because unassigned canvases cannot exist.
5. **Fail closed.** Until the Phase 2 project-scoped membership model is implemented, canvas access must not be granted on account role or `projects.created_by` inference alone; unresolved access is denied.
6. **Schema migration is separate.** Making `project_id` `NOT NULL` requires a reviewed migration and an owner decision; this appendix does not authorize it.

### 2.2 Verified baseline (live source)

| Fact | Evidence | Label |
|---|---|---|
| `canvases.project_id` is nullable — `TEXT REFERENCES projects(project_id)` with no `NOT NULL`. | `backend/src/database/schema.sql:163` | VERIFIED |
| `POST /api/canvas` accepts `project_id ?? null` and passes it straight to the service. | `backend/src/routes/canvas.routes.ts:13-20` | VERIFIED |
| `createCanvas(projectId: string \| null, ...)` inserts the null directly. | `backend/src/services/canvas.service.ts:50-64` | VERIFIED |
| Canvas routes have only `requireAuth`; no project/membership check. | `backend/src/routes/canvas.routes.ts:8`; `backend/src/middleware/auth.middleware.ts:8-22` | VERIFIED |
| `PHASE2_02` §3: “every Canvas must resolve to exactly one project. A Canvas with no project mapping is inaccessible to ordinary members and must not become globally readable.” | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:61` | VERIFIED |
| `PHASE2_02` §1: no `project_members` table in the reviewed schema. | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:11`; `schema.sql` table list (18 tables, no `project_members`) | VERIFIED |

### 2.3 Conflicting sections and concrete replacement text

#### B-3-R1 — `PHASE3_03_CANVAS_API_CONTRACT.md:233` (§3.3, Create canvas row)

**Old:**
```
| Create canvas | Authenticated user with access to the target project (`projects.created_by = user` **or** role in admin/manager set). Global canvases (`project_id = null`): **DECISION-REQUIRED** (proposed: admin/manager only). |
```
**New:**
```
| Create canvas | Authenticated user with access to the target project (role clause pending B-1). `project_id` is **required** and must reference an existing project; global canvases (`project_id = null`) are **not permitted**. |
```

#### B-3-R2 — `PHASE3_03_CANVAS_API_CONTRACT.md:234` (§3.3, Read canvas / list row)

**Old:**
```
| Read canvas / list | Any authenticated user with access to the canvas's project. Global canvases: **DECISION-REQUIRED** (proposed: all authenticated users). |
```
**New:**
```
| Read canvas / list | Any authenticated user with read access to the canvas's project. Every canvas has exactly one `project_id`; there is no global-canvas or cross-project visibility path. `project_id` filtering is a query filter over project-scoped canvases. |
```

#### B-3-R3 — `PHASE3_03_CANVAS_API_CONTRACT.md:253` (§3.4 Canvas schema, `project_id`)

**Old:**
```
| `project_id` | string(UUID) \| null | Must reference an existing project; nullable only for global canvases (see DECISION-REQUIRED). |
```
**New:**
```
| `project_id` | string(UUID) | **Required.** Must reference an existing project; `null` is not permitted (no global canvases). |
```

#### B-3-R4 — `PHASE3_03_CANVAS_API_CONTRACT.md:300` (§3.5.1 `POST /api/canvas` body)

**Old:**
```
  { "project_id": "uuid | null", "name": "string (1-120)", "description": "string | null" }
```
**New:**
```
  { "project_id": "uuid (required)", "name": "string (1-120)", "description": "string | null" }
```
Also update the same subsection's error list at line 307 to state that a missing/null `project_id` returns `400 VALIDATION_ERROR` and a non-existent project returns `404 PROJECT_NOT_FOUND` (already present).

#### B-3-R5 — `PHASE3_03_CANVAS_API_CONTRACT.md:526` (§6 D2)

**Old:**
```
| D2 | Global canvases (`project_id = null`) | (a) admin-only, (b) all authenticated, (c) disallow | (a) |
```
**New:**
```
| D2 | Global canvases (`project_id = null`) | (a) admin-only, (b) all authenticated, (c) disallow | **(c) disallow** — every Canvas resolves to exactly one project; `project_id` is required. Recorded as owner decision CD-07. |
```

#### B-3-R6 — `PHASE3_01_CANVAS_IA_JOURNEYS.md:517` (§10 D11)

**Old:**
```
| **D11** | Unassigned canvases | Allow `project_id: null` and show in "All projects" (current de-facto) or require a project | `schema.sql:163`; `CanvasList.tsx:13` |
```
**New:**
```
| **D11** | Unassigned canvases | **Require a project** — `project_id: null` is not permitted; "All projects" is a filter over project-scoped canvases, not a container for unassigned canvases | `schema.sql:163`; `CanvasList.tsx:13`; `PHASE2_02` §3 |
```

#### B-3-R7 — `PHASE3_01_CANVAS_IA_JOURNEYS.md:249` (§4.2 Canvas list, scope indicator)

**Old:**
```
  - Scope indicator showing "All projects" vs the selected project; keep `/canvases` and `/canvases/:projectId` (`main.tsx:47-48`).
```
**New:**
```
  - Scope indicator showing "All projects" vs the selected project; keep `/canvases` and `/canvases/:projectId` (`main.tsx:47-48`). "All projects" is a filter over project-scoped canvases only; no canvas may be unassigned.
```

#### B-3-R8 — `PHASE3_04_CANVAS_SPEC_APPROVAL.md` (C-02, DF-12, OD-04, B-2)

**Old (C-02, line 105):**
```
| **C-02** | **Global-canvas conflict.** `PHASE3_03` D2 proposes admin-only `project_id = null` canvases; `PHASE3_01` D11 option (a) allows null + "All projects"; `PHASE2_02` §3 says every Canvas must resolve to exactly one project and must not become globally readable. | `PHASE3_03` D2; `PHASE3_01` D11; `PHASE2_02` §3 | **VERIFIED** — blocking |
```
**New:**
```
| **C-02** | **Global-canvas conflict — RESOLVED.** Corrected policy: `project_id` is required; global canvases (`project_id = null`) are disallowed; "All projects" is a filter, not an unassigned-canvas container. | `PHASE3_03` D2; `PHASE3_01` D11; `PHASE2_02` §3; `PHASE3_CORRECTION_SCOPE.md` §2 | **RESOLVED** (PROPOSED) |
```

**Old (DF-12, line 166):**
```
| **DF-12** | Medium | Global canvases (`project_id = null`) are representable but undefined. | `schema.sql:163`; `canvas.routes.ts:13-20` | `PHASE3_03` F12 |
```
**New:**
```
| **DF-12** | Medium | Global canvases (`project_id = null`) are representable but undefined. **Resolution:** disallow null; require `project_id` (B-3). | `schema.sql:163`; `canvas.routes.ts:13-20` | `PHASE3_03` F12; `PHASE3_CORRECTION_SCOPE.md` §2 |
```

**Old (OD-04, line 193):**
```
| **OD-04** | Global canvases (`project_id = null`) | Require a project (disallow null) per `PHASE2_02` §3 | `PHASE3_03` D2; `PHASE3_01` D11; C-02 |
```
**New:**
```
| **OD-04** | Global canvases (`project_id = null`) | **DECIDED: require a project (disallow null)** per `PHASE2_02` §3; recorded in `PHASE3_CORRECTION_SCOPE.md` §2 | `PHASE3_03` D2; `PHASE3_01` D11; C-02 |
```

**Old (B-2, line 236):**
```
| **B-2** | Resolve the global-canvas conflict: choose one rule for `project_id = null` that is consistent with `PHASE2_02` §3. | C-02, OD-04 |
```
**New:**
```
| **B-2** | **CLOSED.** Rule chosen: require `project_id`; disallow null. See `PHASE3_CORRECTION_SCOPE.md` §2. | C-02, OD-04 |
```

#### B-3-R9 — `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` (B-3, CD-07)

**Old (B-3, line 46):**
```
| B-3 | **Global-canvas conflict:** P3-03 D2 proposes admin-only global canvases (`project_id = null`), conflicting with P3-01 D11 and Phase 2’s “every Canvas resolves to exactly one project” rule. | Remove global-canvas option or explicitly gate it as a separate owner decision; do not silently permit cross-project visibility. |
```
**New:**
```
| B-3 | **Global-canvas conflict — CLOSED.** Corrected policy: require `project_id`; global canvases (`project_id = null`) are disallowed; admin-only null proposal removed. | Resolved by `PHASE3_CORRECTION_SCOPE.md` §2. |
```

**Old (CD-07, line 131):**
```
| **CD-07 — Unassigned canvases** | Allow `project_id = null` / require a project. | Require a project. |
```
**New:**
```
| **CD-07 — Unassigned canvases** | Allow `project_id = null` / require a project. | **Require a project** (decided; see `PHASE3_CORRECTION_SCOPE.md` §2). |
```

---

## 3. B-4 — Corrected membership-model wording

### 3.1 Policy (PROPOSED)

1. **Authorization is project-scoped membership**, per `PHASE2_02` §2–§3: `project_members` with roles `Owner / Editor / Viewer / Commenter`.
2. **The membership model is proposed, not existing.** No `project_members` table exists in the reviewed schema (VERIFIED). No membership migration is approved.
3. **Do not assume a migration.** Canvas implementation must not read or write a `project_members` table until the Phase 2 membership migration is separately approved and applied.
4. **Fail closed until then.** Canvas access must not be inferred from `users.role`, `projects.created_by`, or any client-supplied role. Unresolved membership is denied.
5. **Backend remains authoritative.** The client never decides authorization.

### 3.2 Verified baseline

| Fact | Evidence | Label |
|---|---|---|
| No `project_members` table; no `membership` anywhere in the schema. | `backend/src/database/schema.sql` table list (18 tables); string search for `project_members`/`membership` = 0 hits | VERIFIED |
| `PHASE2_02` §2–§3 defines the proposed membership model and permission matrix (`Owner/Editor/Viewer/Commenter`). | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:20-61` | VERIFIED |
| `PHASE2_02` §1 states the reviewed schema has no `project_members` table. | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:11` | VERIFIED |
| `users.role` is a global column, default `viewer`; not evidence of project membership. | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:11`; `schema.sql:9` | VERIFIED |
| Canvas routes have no membership check. | `backend/src/routes/canvas.routes.ts:8` | VERIFIED |

### 3.3 Conflicting sections and concrete replacement text

#### B-4-R1 — `PHASE3_02_CANVAS_INTERACTIONS.md:239` (§7.2 Improve, Permissions bullet)

**Old:**
```
- Permissions: project-scoped access for canvas reads/writes (DECISION-REQUIRED — see D-12).
```
**New:**
```
- Permissions: project-scoped access for canvas reads/writes, enforced against the **proposed Phase 2 project-scoped membership model** (`project_members`; Owner/Editor/Viewer/Commenter per `PHASE2_02` §2–§3) — see D-12. No `project_members` table exists today and no membership migration is approved; access must fail closed until one is.
```

#### B-4-R2 — `PHASE3_02_CANVAS_INTERACTIONS.md:283` (§9 D-12)

**Old:**
```
| **D-12** | Canvas permissions | Any authenticated user / project-scoped RBAC | **Project-scoped RBAC** — align with the existing project membership model; backend remains authoritative | DECISION-REQUIRED |
```
**New:**
```
| **D-12** | Canvas permissions | Any authenticated user / project-scoped RBAC | **Project-scoped RBAC** — enforce against the **proposed Phase 2 project-scoped membership model** (`project_members`; Owner/Editor/Viewer/Commenter per `PHASE2_02` §2–§3). The model is **proposed, not existing**: no `project_members` table exists in the reviewed schema and no membership migration is approved. Backend remains authoritative; access fails closed until the migration is approved. | DECISION-REQUIRED |
```

#### B-4-R3 — `PHASE3_04_CANVAS_SPEC_APPROVAL.md` (C-03, OD-03, B-3)

**Old (C-03, line 106):**
```
| **C-03** | **Phantom membership model.** `PHASE3_02` §7.2 says "align with the existing project membership model"; no `project_members` table exists. | `PHASE3_02` §7.2; `PHASE2_02` §1; `schema.sql` table list | **VERIFIED** — blocking (wording/contract must be corrected) |
```
**New:**
```
| **C-03** | **Phantom membership model — RESOLVED.** Corrected wording: the model is the **proposed Phase 2 project-scoped membership model** (`project_members`); no such table exists and no migration is approved. | `PHASE3_02` §7.2/D-12; `PHASE2_02` §1; `schema.sql` table list; `PHASE3_CORRECTION_SCOPE.md` §3 | **RESOLVED** (PROPOSED) |
```

**Old (OD-03, line 192):**
```
| **OD-03** | Role model and permission matrix | Project-scoped membership (`Owner/Editor/Viewer/Commenter`) per `PHASE2_02`; do not use `users.role` | `PHASE3_03` D1; `PHASE3_01` D2; `PHASE3_02` D-12; C-01 |
```
**New:**
```
| **OD-03** | Role model and permission matrix | **Project-scoped membership** (`Owner/Editor/Viewer/Commenter`) per `PHASE2_02`; do not use `users.role`. The membership table is **proposed, not existing**; no migration is approved and access fails closed (B-4). | `PHASE3_03` D1; `PHASE3_01` D2; `PHASE3_02` D-12; C-01; `PHASE3_CORRECTION_SCOPE.md` §3 |
```

**Old (B-3, line 237):**
```
| **B-3** | Correct `PHASE3_02` §7.2: there is no existing project membership model; state the target model instead. | C-03 |
```
**New:**
```
| **B-3** | **CLOSED.** Corrected to the proposed Phase 2 project-scoped membership model. See `PHASE3_CORRECTION_SCOPE.md` §3. | C-03 |
```

#### B-4-R4 — `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:47` (B-4)

**Old:**
```
| B-4 | **Membership model does not exist:** P3-02 §7.2 references an “existing project membership model,” but no `project_members` table exists. | Correct the text to “proposed Phase 2 model”; implementation must not assume a migration that has not been approved. |
```
**New:**
```
| B-4 | **Membership model does not exist — CLOSED.** Corrected to the “proposed Phase 2 model”; implementation must not assume a migration that has not been approved. | Resolved by `PHASE3_CORRECTION_SCOPE.md` §3. |
```

### 3.4 Citation note (REPORTED)

The blocking finding cites `PHASE3_02` §7.2 for the phrase “existing project membership model.” The phrase is actually at `PHASE3_02_CANVAS_INTERACTIONS.md:283` (§9, D-12); §7.2 line 239 contains the permissions bullet that points to D-12. Both locations are corrected above. **VERIFIED** (read directly).

---

## 4. B-5 — Corrected Canvas export/import scope

### 4.1 Policy (PROPOSED)

1. **Canvas export/import is deferred to a separate, explicitly approved card.** It is not part of the Phase 3 Canvas card scope (PM-P3-01/02/03/04).
2. **Canvas layout save/load remains in scope.** Persistence (autosave/explicit save, load) is unaffected.
3. **JSON first, if the separate card approves it.** PNG/SVG/binary export requires explicit owner approval in that card.
4. **No canvas export/import UI or service work in Phase 3.** The existing `importExport.service.ts` / `importExport.routes.ts` remain canvas-free.
5. **Design-system requirement is amended.** `design-system.md:302` is restated so the export/import requirement is a deferred follow-up, not an MVP acceptance criterion of the Canvas card.
6. **All four sources agree.** `design-system.md`, `PHASE3_01`, `PHASE3_02`, `PHASE3_03` (and the approval-gate records) state the same deferred scope.

### 4.2 Verified baseline

| Fact | Evidence | Label |
|---|---|---|
| `design-system.md:302` requires export/import for custom designs. | `design-system.md:302` | VERIFIED |
| `design-system.md:296` requires canvas layout save/load. | `design-system.md:296` | VERIFIED |
| Import/export service and routes contain zero canvas references. | `backend/src/services/importExport.service.ts`; `backend/src/routes/importExport.routes.ts` (0 matches, case-insensitive) | VERIFIED |
| P3-01 treats export/import as required (AC-19, D8, §4.2, §4.11, AC-11). | `PHASE3_01_CANVAS_IA_JOURNEYS.md:253,348,484,492,514` | VERIFIED |
| P3-02 treats export/import as Extend requiring approval / later phase. | `PHASE3_02_CANVAS_INTERACTIONS.md:167,245,285` | VERIFIED |
| P3-03 lists export/import as a non-goal. | `PHASE3_03_CANVAS_API_CONTRACT.md:547` | VERIFIED |

### 4.3 Conflicting sections and concrete replacement text

#### B-5-R1 — `design-system.md:302` (§12 Design System Rules for Customization)

**Old:**
```
- Export/import must work for custom designs
```
**New:**
```
- Export/import for custom designs is **deferred to a separate approved card** (Phase 3 Canvas card PM-P3-01/02/03/04 does not include it; see `PHASE3_CORRECTION_SCOPE.md` B-5). Canvas layout save/load remains in scope.
```

#### B-5-R2 — `PHASE3_01_CANVAS_IA_JOURNEYS.md:147` (§2.9 item 9)

**Old:**
```
9. No canvas export/import; `importExport.service.ts` and `importExport.routes.ts` contain zero references to canvas.
```
**New:**
```
9. No canvas export/import; `importExport.service.ts` and `importExport.routes.ts` contain zero references to canvas. **Scope decision (B-5):** canvas export/import is deferred to a separate approved card; this is a deferred capability, not an unmet in-scope acceptance criterion.
```

#### B-5-R3 — `PHASE3_01_CANVAS_IA_JOURNEYS.md:162` (§2.10 Documentation evidence)

**Old:**
```
| Canvas save/load and export/import are required by the design system | `design-system.md:289-302` | REPORTED (not implemented) |
```
**New:**
```
| Canvas save/load is required by the design system; canvas export/import is deferred to a separate approved card | `design-system.md:296` (save/load); `design-system.md:302` as amended by B-5 | REPORTED (not implemented; deferred) |
```

#### B-5-R4 — `PHASE3_01_CANVAS_IA_JOURNEYS.md:253` (§4.2 Canvas list, changes)

**Old:**
```
  - Expose canvas export/import (design-system.md:296,302).
```
**New:**
```
  - Canvas export/import is out of scope for this card (deferred to a separate approved card, B-5). Do not add export/import controls here; canvas layout save/load remains in scope.
```

#### B-5-R5 — `PHASE3_01_CANVAS_IA_JOURNEYS.md:348` (§4.11 Save/load, changes)

**Old:**
```
  - Add canvas export/import (JSON) so layouts survive project export and can be reused; `design-system.md:296,302` already requires save/load and export/import.
```
**New:**
```
  - Canvas export/import is deferred to a separate approved card (B-5; JSON only if that card approves it). Do not add export/import here.
```

#### B-5-R6 — `PHASE3_01_CANVAS_IA_JOURNEYS.md:484` (AC-11)

**Old:**
```
- **AC-11 (List):** The list shows project scope, item/connection counts, and supports create, rename, delete-with-confirmation, and export. No native `confirm()` remains. (Basis: `CanvasList.tsx:199-209`.)
```
**New:**
```
- **AC-11 (List):** The list shows project scope, item/connection counts, and supports create, rename, and delete-with-confirmation. No native `confirm()` remains. (Export is deferred to a separate approved card, B-5.) (Basis: `CanvasList.tsx:199-209`.)
```

#### B-5-R7 — `PHASE3_01_CANVAS_IA_JOURNEYS.md:492` (AC-19)

**Old:**
```
- **AC-19 (Save/load):** Autosave status is visible and announced; canvas metadata is editable; canvas export/import exists. (Basis: `canvas.routes.ts:52-63`; `design-system.md:296,302`.)
```
**New:**
```
- **AC-19 (Save/load):** Autosave status is visible and announced; canvas metadata is editable. Canvas export/import is out of scope for this card and deferred to a separate approved card (B-5). (Basis: `canvas.routes.ts:52-63`; `design-system.md:296`.)
```

#### B-5-R8 — `PHASE3_01_CANVAS_IA_JOURNEYS.md:514` (§10 D8)

**Old:**
```
| **D8** | Canvas export/import | Required by `design-system.md:296,302`; currently absent from import/export | `importExport.service.ts` has 0 canvas mentions |
```
**New:**
```
| **D8** | Canvas export/import | **Deferred to a separate approved card** (B-5). Not required by this card; `design-system.md:302` is amended accordingly. JSON only if that card approves it. | `importExport.service.ts` has 0 canvas mentions; `design-system.md:302` |
```

#### B-5-R9 — `PHASE3_02_CANVAS_INTERACTIONS.md:167` (§5 Complexity table)

**Old:**
```
| Export / import | **Zero canvas coverage** in import/export service and routes | `importExport.service.ts`, `importExport.routes.ts` (0 matches) | Extend (PROPOSED) |
```
**New:**
```
| Export / import | **Zero canvas coverage** in import/export service and routes | `importExport.service.ts`, `importExport.routes.ts` (0 matches) | **Deferred** to a separate approved card (B-5); not an Extend item for this card |
```

#### B-5-R10 — `PHASE3_02_CANVAS_INTERACTIONS.md:245` (§7.3 Extend)

**Old:**
```
- Canvas export/import (JSON at minimum; PNG/SVG only with owner approval).
```
**New:**
```
- ~~Canvas export/import~~ — **deferred to a separate approved card** (B-5). Not part of this card. If that card is approved, JSON first; PNG/SVG only with explicit owner approval.
```

#### B-5-R11 — `PHASE3_02_CANVAS_INTERACTIONS.md:285` (§9 D-14)

**Old:**
```
| **D-14** | Canvas export/import | Excluded / JSON export / JSON + PNG/SVG | **JSON export/import** in a later phase; binary export only with owner approval | PROPOSED |
```
**New:**
```
| **D-14** | Canvas export/import | Excluded / JSON export / JSON + PNG/SVG | **Deferred to a separate approved card** (B-5). Not in this card's scope. If approved there, JSON first; binary export only with owner approval. | PROPOSED (deferred) |
```

#### B-5-R12 — `PHASE3_03_CANVAS_API_CONTRACT.md:547` (§7 Non-goals)

**Old:**
```
- **Non-goals:** automation execution, connector invocation, real-time collaboration (WebSockets/CRDT), canvas templates, export/import of canvases, and any change to the Automation Studio preview.
```
**New:**
```
- **Non-goals:** automation execution, connector invocation, real-time collaboration (WebSockets/CRDT), canvas templates, and any change to the Automation Studio preview. **Canvas export/import is not a non-goal; it is deferred to a separate approved card** (B-5; see `PHASE3_CORRECTION_SCOPE.md` §4).
```

#### B-5-R13 — `PHASE3_04_CANVAS_SPEC_APPROVAL.md` (PC-05, C-04, G-03, OD-18, B-4)

**Old (PC-05, line 85):**
```
| **PC-05** | Save/load canvas layouts (`design-system.md:296,302`) | `PHASE3_01` §4.11, AC-19, D3, D8; `PHASE3_02` §5, §7.3; `PHASE3_03` §3.5.2-3.5.5, §3.7 | `canvas.routes.ts:11-76`; `canvas.service.ts:50-137`; `useCanvas.ts:82-104`; `importExport.service.ts` (0 canvas mentions) | **PARTIAL** (VERIFIED). Canvas CRUD persists; no explicit Save control, no dirty/pending indicator, no export/import. `design-system.md:302` requires export/import for custom designs. |
```
**New:**
```
| **PC-05** | Save/load canvas layouts (`design-system.md:296`) | `PHASE3_01` §4.11, AC-19, D3; `PHASE3_02` §5, §7.2; `PHASE3_03` §3.5.2-3.5.5, §3.7 | `canvas.routes.ts:11-76`; `canvas.service.ts:50-137`; `useCanvas.ts:82-104`; `importExport.service.ts` (0 canvas mentions) | **PARTIAL** (VERIFIED). Canvas CRUD persists; no explicit Save control, no dirty/pending indicator. Export/import is deferred (B-5) and is not part of this criterion. |
```

**Old (C-04, line 107):**
```
| **C-04** | **Export/import scope conflict.** `design-system.md:296,302` requires save/load and export/import; `PHASE3_01` AC-19/D8 treats it as required; `PHASE3_02` §7.3 lists it as Extend requiring explicit approval; `PHASE3_03` §7 lists canvas export/import as a non-goal. | `design-system.md:296,302`; `PHASE3_01` AC-19, D8; `PHASE3_02` §7.3; `PHASE3_03` §7 | **VERIFIED** — blocking scope decision |
```
**New:**
```
| **C-04** | **Export/import scope conflict — RESOLVED.** One scope chosen: deferred to a separate approved card. `design-system.md:302` amended; `PHASE3_01` AC-19/D8/AC-11/§4.2/§4.11 corrected; `PHASE3_02` §5/§7.3/D-14 corrected; `PHASE3_03` §7 reworded from non-goal to deferred. | `design-system.md:302`; `PHASE3_01` AC-19, D8; `PHASE3_02` §7.3; `PHASE3_03` §7; `PHASE3_CORRECTION_SCOPE.md` §4 | **RESOLVED** (PROPOSED) |
```

**Old (G-03, line 130):**
```
| **G-03** | No canvas export/import. | `importExport.service.ts` / `importExport.routes.ts` 0 canvas mentions; `design-system.md:302` | **VERIFIED** |
```
**New:**
```
| **G-03** | No canvas export/import. **Reclassified:** deferred to a separate approved card (B-5); not a Phase 3 gap. | `importExport.service.ts` / `importExport.routes.ts` 0 canvas mentions; `design-system.md:302`; `PHASE3_CORRECTION_SCOPE.md` §4 | **VERIFIED** — deferred |
```

**Old (OD-18, line 207):**
```
| **OD-18** | Canvas export/import scope | Decide and align all three siblings | `design-system.md:302`; `PHASE3_01` D8; `PHASE3_02` §7.3; `PHASE3_03` §7; C-04 |
```
**New:**
```
| **OD-18** | Canvas export/import scope | **DECIDED: deferred to a separate approved card**; all four sources aligned (B-5). | `design-system.md:302`; `PHASE3_01` D8; `PHASE3_02` §7.3; `PHASE3_03` §7; C-04; `PHASE3_CORRECTION_SCOPE.md` §4 |
```

**Old (B-4, line 238):**
```
| **B-4** | Decide canvas export/import scope and align `PHASE3_01` AC-19/D8, `PHASE3_02` §7.3, and `PHASE3_03` §7. | C-04, OD-18 |
```
**New:**
```
| **B-4** | **CLOSED.** Scope decided: deferred to a separate approved card; all sources aligned. See `PHASE3_CORRECTION_SCOPE.md` §4. | C-04, OD-18 |
```

#### B-5-R14 — `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md` (B-5, §4.3, CD-06)

**Old (B-5, line 48):**
```
| B-5 | **Export/import scope conflict:** `design-system.md:302` requires Canvas export/import, P3-01 AC-19/D8 requires it, P3-02 §7.3 says Extend/needs approval, and P3-03 §7 says non-goal. | Choose one scope and update all four sources consistently. |
```
**New:**
```
| B-5 | **Export/import scope conflict — CLOSED.** One scope chosen: deferred to a separate approved card; all four sources updated consistently. | Resolved by `PHASE3_CORRECTION_SCOPE.md` §4. |
```

**Old (§4.3, line 117):**
```
- Canvas export/import (JSON first) if the owner confirms scope.
```
**New:**
```
- Canvas export/import — **deferred to a separate approved card** (B-5); JSON first if that card approves it.
```

**Old (CD-06, line 130):**
```
| **CD-06 — Export/import scope** | Required now / deferred / non-goal. | Defer to a separate approved card; JSON only if approved. |
```
**New:**
```
| **CD-06 — Export/import scope** | Required now / deferred / non-goal. | **Deferred** to a separate approved card; JSON only if approved (decided; see `PHASE3_CORRECTION_SCOPE.md` §4). |
```

---

## 5. Change log mapping B-3 / B-4 / B-5

| Change | B | File:line | Section | Change | Label |
|---|---|---|---|---|---|
| B-3-R1 | B-3 | `PHASE3_03_CANVAS_API_CONTRACT.md:233` | §3.3 Create canvas | Remove admin-only global-canvas proposal; require `project_id` | PROPOSED |
| B-3-R2 | B-3 | `PHASE3_03_CANVAS_API_CONTRACT.md:234` | §3.3 Read/list | Remove global-canvas option; state one-project rule | PROPOSED |
| B-3-R3 | B-3 | `PHASE3_03_CANVAS_API_CONTRACT.md:253` | §3.4 Canvas schema | `project_id` non-nullable | PROPOSED |
| B-3-R4 | B-3 | `PHASE3_03_CANVAS_API_CONTRACT.md:300` | §3.5.1 body | `project_id` required in request body | PROPOSED |
| B-3-R5 | B-3 | `PHASE3_03_CANVAS_API_CONTRACT.md:526` | §6 D2 | Decision (c) disallow | PROPOSED |
| B-3-R6 | B-3 | `PHASE3_01_CANVAS_IA_JOURNEYS.md:517` | §10 D11 | Require a project | PROPOSED |
| B-3-R7 | B-3 | `PHASE3_01_CANVAS_IA_JOURNEYS.md:249` | §4.2 list | “All projects” is a filter only | PROPOSED |
| B-3-R8 | B-3 | `PHASE3_04_CANVAS_SPEC_APPROVAL.md:105,166,193,236` | C-02, DF-12, OD-04, B-2 | Mark resolved/decided | PROPOSED |
| B-3-R9 | B-3 | `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:46,131` | B-3, CD-07 | Mark closed/decided | PROPOSED |
| B-4-R1 | B-4 | `PHASE3_02_CANVAS_INTERACTIONS.md:239` | §7.2 Permissions | Proposed Phase 2 model; no migration assumed | PROPOSED |
| B-4-R2 | B-4 | `PHASE3_02_CANVAS_INTERACTIONS.md:283` | §9 D-12 | Proposed Phase 2 model; fail closed | PROPOSED |
| B-4-R3 | B-4 | `PHASE3_04_CANVAS_SPEC_APPROVAL.md:106,192,237` | C-03, OD-03, B-3 | Mark resolved | PROPOSED |
| B-4-R4 | B-4 | `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:47` | B-4 | Mark closed | PROPOSED |
| B-5-R1 | B-5 | `design-system.md:302` | §12 Customization rules | Defer export/import | PROPOSED |
| B-5-R2 | B-5 | `PHASE3_01_CANVAS_IA_JOURNEYS.md:147` | §2.9 item 9 | Mark deferred | PROPOSED |
| B-5-R3 | B-5 | `PHASE3_01_CANVAS_IA_JOURNEYS.md:162` | §2.10 evidence | Separate save/load from export/import | PROPOSED |
| B-5-R4 | B-5 | `PHASE3_01_CANVAS_IA_JOURNEYS.md:253` | §4.2 list | Remove export/import | PROPOSED |
| B-5-R5 | B-5 | `PHASE3_01_CANVAS_IA_JOURNEYS.md:348` | §4.11 save/load | Remove export/import | PROPOSED |
| B-5-R6 | B-5 | `PHASE3_01_CANVAS_IA_JOURNEYS.md:484` | AC-11 | Remove export | PROPOSED |
| B-5-R7 | B-5 | `PHASE3_01_CANVAS_IA_JOURNEYS.md:492` | AC-19 | Remove export/import | PROPOSED |
| B-5-R8 | B-5 | `PHASE3_01_CANVAS_IA_JOURNEYS.md:514` | §10 D8 | Deferred | PROPOSED |
| B-5-R9 | B-5 | `PHASE3_02_CANVAS_INTERACTIONS.md:167` | §5 table | Deferred, not Extend | PROPOSED |
| B-5-R10 | B-5 | `PHASE3_02_CANVAS_INTERACTIONS.md:245` | §7.3 Extend | Deferred | PROPOSED |
| B-5-R11 | B-5 | `PHASE3_02_CANVAS_INTERACTIONS.md:285` | §9 D-14 | Deferred | PROPOSED |
| B-5-R12 | B-5 | `PHASE3_03_CANVAS_API_CONTRACT.md:547` | §7 non-goals | Deferred, not non-goal | PROPOSED |
| B-5-R13 | B-5 | `PHASE3_04_CANVAS_SPEC_APPROVAL.md:85,107,130,207,238` | PC-05, C-04, G-03, OD-18, B-4 | Mark resolved/reclassified | PROPOSED |
| B-5-R14 | B-5 | `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:48,117,130` | B-5, §4.3, CD-06 | Mark closed/decided | PROPOSED |

---

## 6. Cross-artifact consistency check (after applying the replacements)

| Rule | `design-system.md` | `PHASE3_01` | `PHASE3_02` | `PHASE3_03` | Approval records |
|---|---|---|---|---|---|
| Every Canvas has exactly one project; `project_id` required | n/a (no canvas-scope statement) | D11 corrected | §7.2/D-12 corrected | §3.3/§3.4/§3.5.1/D2 corrected | C-02/OD-04/B-2 resolved |
| Membership is the proposed Phase 2 model, not existing | n/a | D2 pending B-1 | §7.2/D-12 corrected | §3.3/D1 pending B-1/B-2 | C-03/OD-03/B-3 resolved |
| Export/import deferred to a separate approved card | line 302 amended | AC-19/D8/AC-11/§4.2/§4.11 corrected | §5/§7.3/D-14 corrected | §7 reworded | C-04/G-03/OD-18/B-4 resolved |
| Save/load remains in scope | line 296 unchanged | §4.11/AC-19 unchanged | §7.1/§7.2 unchanged | §3.7 unchanged | PC-05 re-scored |

---

## 7. Residual decisions and unknowns

| ID | Item | Why it remains | Label |
|---|---|---|---|
| RB-1 | Owner must apply the replacement text to the named files. | This appendix is read-only; it does not edit them. | DECISION-REQUIRED |
| RB-2 | Schema migration to make `canvases.project_id NOT NULL`. | Requires a reviewed migration and owner approval; not authorized here. | DECISION-REQUIRED |
| RB-3 | Phase 2 `project_members` migration approval. | Needed before Canvas authorization can be implemented; B-4 only corrects wording. | DECISION-REQUIRED |
| RB-4 | The separate Canvas export/import card (scope, JSON/PNG/SVG, PII, signed URL). | Deferred by B-5; not specified here. | DECISION-REQUIRED |
| RB-5 | Whether existing rows with `project_id = null` are migrated, deleted, or blocked. | The current schema permits null; no data inventory was performed. | UNKNOWN |
| RB-6 | B-1/B-2 role-model and commenter corrections. | Out of scope for this appendix; they interact with B-4 wording. | DECISION-REQUIRED |

---

## 8. Verification

- This artifact exists at `<workspace>\PHASE3_CORRECTION_SCOPE.md`.
- Byte size and SHA-256 are reported by the producing agent in the task result (a file cannot contain its own final hash). Convention follows `PHASE3_04_CANVAS_SPEC_APPROVAL.md:268`.
- No application source, schema, API, database, or other file was modified by this appendix. `git status` before writing showed a pre-existing dirty working tree; the only file added by this task is this artifact.
- Live-source citations were read directly at the line numbers shown in §2.2, §3.2, and §4.2.
- Review snapshot: Git HEAD `d705a364b2e845eb02f33d57475e0e3af15228c7` (branch `main`).

---

*Prepared as a read-only Phase 3 planning artifact. This is a corrected scope appendix, not an implementation authorization and not a source-code change.*
