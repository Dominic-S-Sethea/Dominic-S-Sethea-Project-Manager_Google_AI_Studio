# PM-P3-CORR-AUTHZ — Phase 3 Canvas Authorization Correction (B-1 / B-2)

**Status:** Correction draft — owner approval required  
**Phase:** 3 — Project Canvas Specification (correction appendix)  
**Repository:** `<workspace>`  
**Git branch / HEAD:** `main` / `d705a364b2e845eb02f33d57475e0e3af15228c7`  
**Implementation boundary:** Specification only. No application source, schema, API, database, credential, or Automation runtime change is authorized by this artifact.  
**Method:** Read-only inspection of the Phase 3 artifacts, the Phase 2 RBAC artifact, the Phase 2 approval package, and the live source files cited below. No server was started; no build or migration was run.

> **Labels:** **VERIFIED** = read directly from live source or a project artifact. **REPORTED** = stated in a project document but not independently proved. **PROPOSED** = recommended target contract, not approved. **UNKNOWN** = not currently verifiable. **DECISION-REQUIRED** = owner decision required.

---

## 0. Correction scope and numbering note

This appendix closes **B-1** and **B-2** as defined in `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:44-45`:

| # | Blocking finding (package) | Required correction (package) |
|---|---|---|
| **B-1** | **RBAC model conflict:** P3-03 §3.3/D1 proposes global roles (`admin|manager|editor|viewer`) on `users.role`, conflicting with P3-02 §2 and Phase 2's project-scoped five-actor model. | Align Canvas authorization to the Phase 2 project-scoped model; remove global-role proposal. |
| **B-2** | **Missing actor:** P3-03 omits the `commenter` actor required by Phase 2 and the original permission matrix. | Add commenter to the Canvas role matrix and route policy. |

**Numbering discrepancy (VERIFIED):** `PHASE3_04_CANVAS_SPEC_APPROVAL.md` uses a different B-numbering. Its `B-1` (`PHASE3_04_CANVAS_SPEC_APPROVAL.md:235`) is the role-model conflict (same subject as package B-1); its `B-2` (`:236`) is the global-canvas conflict (package `B-3`). This appendix targets the **package** B-1/B-2 as instructed. The global-canvas conflict remains open as **B-3**; this appendix only constrains it (see §4 rule 7).

**Out of scope:** B-3 through B-9. This appendix does not resolve global canvases (`project_id = null`), the phantom membership-model wording in `PHASE3_02_CANVAS_INTERACTIONS.md:283`, export/import scope, card provenance, acceptance-criteria scoring, Phase 2 hash freezing, or the test-coverage gate.

**Phase 2 authority used for this correction:**

- `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:24-30` — project-scoped human membership; `users.role` excluded from project permission decisions; owner authority over membership.
- `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:34-36` — agent is a non-human service principal; default access none; explicit allow-list; persisted grant shape is DECISION-REQUIRED.
- `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:42-57` — the five-actor permission matrix (Owner / Editor / Viewer / Commenter / Agent).
- `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:59` — inheritance and boundaries (Viewer read-only; Commenter = Viewer + own comments; Editor = Commenter + CRUD on project content and Canvas).
- `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:61` — every Canvas resolves to exactly one project; children inherit the Canvas project; never authorize a child by its supplied ID alone.
- `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:78-86` — backend enforcement, IDOR protection, 403/404 semantics, fail-closed, audit, and testing requirements.

---

## 1. Corrected authorization principle

**PROPOSED (supersedes `PHASE3_03_CANVAS_API_CONTRACT.md:229`):**

> Canvas is a project-scoped visual planning surface. Access follows **active project membership and the membership role**. `canvases.created_by` is provenance, not an authorization source. `users.role` is not consulted.

Rules:

1. **Authorization source is the project membership record**, not a client-supplied role, request-body `user_id`, stale role claim, or `canvases.created_by` (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:26`).
2. **Authentication and authorization are separate checks.** `requireAuth` establishes identity; a service-boundary policy check establishes permission (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:78,80`).
3. **Roles are per-project.** A member may be an owner in one project and a viewer in another; access to one project grants nothing in another (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:24`).
4. **Five actors only:** `owner`, `editor`, `viewer`, `commenter` (human membership roles) and `agent` (non-human service principal). No `admin` or `manager` role exists or is introduced.
5. **`users.role` (`backend/src/database/schema.sql:9`, default `'viewer'`) is a global account attribute.** It MUST NOT be used for Canvas or project permission decisions (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:26`). **VERIFIED:** the only functional use of `requireRole` is in `backend/src/routes/users.routes.ts` (account administration); it is not referenced by any Canvas route (`backend/src/middleware/auth.middleware.ts:24-32`; `backend/src/routes/canvas.routes.ts:8`).
6. **No user may elevate their own role** through a request payload or by editing project data (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:30`).

---

## 2. Corrected project-scoped five-actor role matrix

**PROPOSED.** Derived from `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:42-57` and `:59`. `R` = read; `C` = create; `U` = update; `D` = delete; `M` = membership/project administration; `own` = authored by that principal.

| Canvas capability | Owner | Editor | Viewer | Commenter | Agent (default; explicit grant required) |
|---|---|---|---|---|---|
| Read canvas / items / connections | R | R | R | R | No access by default; explicit `canvas.read` |
| Create canvas | C | C | — | — | Only with an explicit `canvas.create` grant |
| Update canvas metadata (name, description) | U | U | — | — | Only with an explicit named update grant |
| Delete canvas | D | D | — | — | Only with an explicit named delete grant |
| Create item / connection | C | C | — | — | Only with an explicit named create grant |
| Update item / connection | U | U | — | — | Only with an explicit named update grant |
| Delete item / connection | D | D | — | — | Only with an explicit named delete grant |
| Read comments | R | R | R | R | Only with an explicit comment-read grant |
| Create / update / delete own comment | R/C/U/D own; may moderate or remove any | R/C/U/D own | R | R/C/U/D own | Only with an explicit `comment.create` or narrower grant; attributable to the agent |
| Membership, role changes, project settings, ownership transfer | M | — | — | — | Never |
| Manage agents or their grants | M | — | — | — | Never |
| Read a credential / secret value | Never | Never | Never | Never | Never |
| Publish / execute a workflow | Disabled for every role now | No | No | No | Never |

**Canvas rights by actor (summary):**

| Actor | Canvas rights | Basis |
|---|---|---|
| **Owner** | R/C/U/D | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:46,59` |
| **Editor** | R/C/U/D | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:46,59` |
| **Viewer** | R (read-only) | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:46,59` |
| **Commenter** | R (read-only) | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:46,59` |
| **Agent** | Default none; named grants only | `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:34,46` |

**B-2 correction — explicit statement:** adding the `commenter` actor grants **read-only** Canvas access. It does **not** grant Canvas edit rights. `commenter` is `Viewer` plus the ability to create, edit, and delete **its own comments**; an owner may moderate comments (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:47,59`).

**Inheritance and boundaries (PROPOSED, from `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:59`):** Viewer is read-only. Commenter is Viewer plus own-comment CRUD. Editor is Commenter plus CRUD on project content and Canvas, but not membership, project administration, credentials, or workflow publication/execution. Owner is the project administrator and content owner. Connector secrets are an exception: no role receives plaintext readback, including Owner.

**Editor deletion note (PROPOSED):** `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:46` grants Editor `R/C/U/D` on Canvas, so an Editor may delete a canvas in a project where they hold an active Editor membership. The P3-03 proposal that an editor "cannot delete others' canvases" (`PHASE3_03_CANVAS_API_CONTRACT.md:242`) has no basis in the Phase 2 matrix and is removed. **DECISION-REQUIRED:** if the owner wants creator-only or owner-only canvas deletion, that is a new decision that amends Phase 2 §3, not a Canvas-spec detail.

---

## 3. Canvas route/method authorization matrix

**PROPOSED.** Every route is mounted under `/api/canvas` and already guarded by `router.use(requireAuth)` (`backend/src/routes/canvas.routes.ts:8`). The table below is the **additional** authorization rule that must be enforced at the service boundary for each route. "Active membership" means a membership record for the resolved project with an active status.

| # | Method | Path | Corrected authorization rule | Supersedes |
|---:|---|---|---|---|
| 1 | `POST` | `/api/canvas` | Active membership in the target project with role **owner** or **editor**. `project_id` must resolve to exactly one existing project. Agent: only with an explicit `canvas.create` grant for that project. | `PHASE3_03_CANVAS_API_CONTRACT.md:233`, `:297` |
| 2 | `GET` | `/api/canvas` | Authenticated; the list is scoped server-side to projects where the caller has active membership. No role beyond membership. | `PHASE3_03_CANVAS_API_CONTRACT.md:310` |
| 3 | `GET` | `/api/canvas/:id` | Active membership in the canvas's project; read role (owner/editor/viewer/commenter). Agent: `canvas.read` grant. Non-member or absent → `404`. | `PHASE3_03_CANVAS_API_CONTRACT.md:322` |
| 4 | `PUT` | `/api/canvas/:id` | Active membership; role **owner** or **editor**. Not creator-only. | `PHASE3_03_CANVAS_API_CONTRACT.md:235`, `:339` |
| 5 | `DELETE` | `/api/canvas/:id` | Active membership; role **owner** or **editor**. | `PHASE3_03_CANVAS_API_CONTRACT.md:236`, `:346` |
| 6 | `POST` | `/api/canvas/:id/items` | Active membership; role **owner** or **editor**; the canvas must resolve to a project. Agent: explicit item-create grant. | `PHASE3_03_CANVAS_API_CONTRACT.md:237`, `:352` |
| 7 | `PUT` | `/api/canvas/items/:itemId` | Active membership; role **owner** or **editor**; server resolves `itemId → canvas_id → project_id → membership`. | `PHASE3_03_CANVAS_API_CONTRACT.md:366-368` |
| 8 | `DELETE` | `/api/canvas/items/:itemId` | Same resolution and role rule as #7. | `PHASE3_03_CANVAS_API_CONTRACT.md:374` |
| 9 | `POST` | `/api/canvas/:id/connections` | Active membership; role **owner** or **editor**; both endpoints must belong to `:id`. | `PHASE3_03_CANVAS_API_CONTRACT.md:380` |
| 10 | `DELETE` | `/api/canvas/connections/:connId` | Active membership; role **owner** or **editor**; server resolves `connId → canvas_id → project_id → membership`. | `PHASE3_03_CANVAS_API_CONTRACT.md:395` |

**Notes on the route matrix:**

- Reads of items and connections are embedded in `GET /api/canvas/:id`; they inherit rule #3. There are no separate item/connection read routes.
- Rules #7, #8, and #10 do not carry the canvas id in the path. The server MUST resolve the parent canvas from the child id before authorizing; a supplied child id alone is never sufficient (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:61`).
- `viewer` and `commenter` are valid only for rule #2 and rule #3. They are denied rules #1 and #4-#10.
- The old `owner or admin/manager` wording (`PHASE3_03_CANVAS_API_CONTRACT.md:339,346`) and the old `edit rights` wording (`:366,374,380,395`) are replaced by the explicit role column above.
- Rate limiting, validation, versioning, and error-envelope behavior are unchanged from `PHASE3_03_CANVAS_API_CONTRACT.md` §3.1, §3.2, §3.4, §3.6, §3.7, §3.8.

---

## 4. Canvas item/connection ownership and project-membership rules

**PROPOSED, with VERIFIED schema facts.**

1. **Authorization source.** Use the project membership record — not `users.role`, not a request-body `user_id`, not `canvases.created_by` (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:26`).
2. **`canvases.created_by` is provenance, not authorization.** **VERIFIED:** the column exists and is `NOT NULL` (`backend/src/database/schema.sql:166`). It is recorded for audit and is immutable after creation, but it does not grant or restrict Canvas access. This corrects `PHASE3_03_CANVAS_API_CONTRACT.md:229,235-236,245`.
3. **Items and connections have no creator column.** **VERIFIED:** `canvas_items` (`backend/src/database/schema.sql:172-187`) and `canvas_connections` (`:190-198`) contain no `created_by`. Item/connection "ownership" is therefore derived, not stored: `child → canvas → project → active membership role`.
4. **Never authorize a child by its supplied ID alone.** The server resolves the canonical child-to-canvas-to-project relationship before checking membership and action (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:61,79`).
5. **Cross-canvas connections are forbidden.** Both `from_item_id` and `to_item_id` must belong to the canvas named in the path (`PHASE3_03_CANVAS_API_CONTRACT.md:390`; finding F2 at `:165`).
6. **Cross-project task links are forbidden.** `canvas_items.task_id` must belong to the canvas's project (`PHASE3_03_CANVAS_API_CONTRACT.md:267`; finding F11 at `:174`).
7. **A Canvas must resolve to exactly one project.** A Canvas with no project mapping is inaccessible to ordinary members and must not become globally readable (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:61`). The product decision on whether `project_id = null` is representable at all remains **B-3** (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:46`); this appendix does not settle it.
8. **Membership must be active.** Inactive, expired, or revoked membership means deny (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:79,82`).
9. **Membership changes require owner authority and an audit record.** Ownership transfer, owner removal/demotion, and membership changes are owner-only; no self-elevation (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:30`).
10. **A project must retain at least one active owner** (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:30`).
11. **Fail closed** on missing, null, conflicting, or unscoped ownership (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:79`).
12. **No user-supplied owner, role, membership, creator, or audit-actor overrides.** A resource's project id from the payload must not replace its stored relationship (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:81`).
13. **One shared policy check at the service boundary.** Every Canvas route and child route calls `authorize(actor, project, resource, action)` before mutation or response (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:80`).
14. **Deny-by-default cutover.** Unmapped project data, Canvas, connectors, or agent grants remain inaccessible until explicitly resolved (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:92`).

---

## 5. 403-vs-404 policy

**PROPOSED.** This refines `PHASE3_03_CANVAS_API_CONTRACT.md:225` and decision D3 (`:527`), and aligns with `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:81,86`.

| Situation | HTTP | Code |
|---|---:|---|
| Missing, invalid, or expired token | `401` | `UNAUTHENTICATED` |
| Resource does not exist | `404` | `CANVAS_NOT_FOUND` / `ITEM_NOT_FOUND` / `CONNECTION_NOT_FOUND` / `PROJECT_NOT_FOUND` |
| Resource exists but the caller has **no active membership** in its project (existence/visibility concealed) | `404` | same as above |
| Caller has active membership but the **role/action is not permitted** (e.g. viewer/commenter write; editor attempting membership admin) | `403` | `FORBIDDEN` |
| Agent without an explicit grant for the action | `403` | `FORBIDDEN` |
| Inactive, expired, or revoked membership or agent grant | `403` | `FORBIDDEN` |
| Malformed body or field-constraint violation | `400` | `VALIDATION_ERROR` |
| `If-Match` / `expected_version` mismatch | `409` | `VERSION_CONFLICT` |
| Duplicate or limit conflict | `409` | `CONFLICT` / `LIMIT_REACHED` |
| Well-formed but contextually invalid (cross-canvas item, cross-project task) | `422` | `SEMANTIC_ERROR` / `CROSS_CANVAS_ITEM` |
| Rate limit exceeded | `429` | `RATE_LIMITED` |
| Unexpected failure | `500` | `INTERNAL_ERROR` |

**Policy rules:**

1. **The rule is membership-aware and applies to reads and writes.** A write by a non-member returns `404`, not `403`, so the response does not confirm that the resource exists. A write by a member with an insufficient role returns `403`.
2. **List endpoints never return `403` for non-member projects.** `GET /api/canvas` scopes its query to projects where the caller has active membership and simply omits the rest (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:79`).
3. **`403` never discloses protected details.** The body is the standard safe error envelope with a `request_id` (`PHASE3_03_CANVAS_API_CONTRACT.md:195-209`; `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:86`).
4. **`404` is used consistently** for absent and deliberately concealed resources, including child ids whose parent canvas is not visible (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:81`).
5. **DECISION-REQUIRED:** ratify this policy as the replacement for P3-03 D3 option (c) "404 read / 403 write" (`PHASE3_03_CANVAS_API_CONTRACT.md:527`). The Phase 2 rule (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:81`) is the governing authority if the two conflict.

---

## 6. Read-only / viewer rules

**PROPOSED.**

1. **Viewer is read-only on Canvas, items, and connections** (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:46,59`).
2. **Commenter has the same Canvas read rights as Viewer** (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:46`). Adding commenter does not add Canvas edit rights (B-2).
3. **Viewer and commenter are denied:** canvas create/update/delete; item create/update/delete; connection create/delete; task linking; membership and project-settings changes.
4. **Read-only is enforced on the backend even when the UI hides or disables a control** (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:78`). A direct API call by a viewer or commenter must fail.
5. **Failure status:** `403 FORBIDDEN` when the caller is an active member with a read-only role; `404` when the caller has no active membership in the project (§5).
6. **Comments:** Viewer may read comments only. Commenter may create, edit, and delete **its own** comments. An owner may moderate or remove any comment (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:47,59`).
7. **Current state (VERIFIED):** no read-only mode exists; every authenticated user can mutate (`PHASE3_01_CANVAS_IA_JOURNEYS.md:175`; `PHASE3_02_CANVAS_INTERACTIONS.md:197`). This section defines the target, not the shipped behavior.

---

## 7. Agent rules

**PROPOSED, from `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:34-36,46,54-57`.**

1. **An agent is a non-human service principal, not a human project role** (`:34`). It is a separate column in the matrix, not a membership role.
2. **Default access is none.** Every Canvas route denies an agent unless an explicit project/resource/action grant exists (`:34`).
3. **Grants are explicit allow-lists.** Each grant names the project, resource, and action, and carries an owner, purpose, expiry/revocation path, and audit attribution. Wildcard access is not granted by default (`:34`).
4. **Canvas grants are narrowly named.** Only `canvas.read` or narrowly named item/connection actions are permitted (`:46`). A read grant never implies a write grant, and no `canvas.*` wildcard is permitted.
5. **Prohibited for agents:** manage membership; grant permissions; read credential values; impersonate a user; publish a workflow; approve their own proposed action (`:34`).
6. **Workflow publish/execute is disabled for every role now**, including agents (`:54-55`).
7. **Agent identity on Canvas routes.** **PROPOSED:** an agent token resolves to an agent identity plus a grant lookup; it MUST NOT be accepted as a human JWT role or a `users.role` value. **DECISION-REQUIRED:** the persisted shape and lifecycle for project-scoped agent grants is not settled; the current `agents.permissions` field alone does not prove such isolation (`:36`).
8. **Audit attribution.** Record the agent actor kind/ID, project, action, outcome, and request/correlation ID. Where a human initiated or delegated the action, record both identities (`:34,83`).
9. **Current state (VERIFIED):** `agentAuthMiddleware` exists but is not wired to Canvas; no Canvas route mentions agents (`PHASE3_01_CANVAS_IA_JOURNEYS.md:176`). This section defines the target integration contract, not shipped behavior.
10. **No self-approval.** An agent cannot approve or execute an action it proposed (`:34`).

---

## 8. Global-role proposal removal (repeal list)

**PROPOSED.** The following P3-03/P3-01 text is repealed and must be removed or rewritten in the sibling artifacts:

| # | Repealed text | Location | Replacement |
|---:|---|---|---|
| R-1 | "The contract proposes the set `admin | manager | editor | viewer`" | `PHASE3_03_CANVAS_API_CONTRACT.md:240` | §2 five-actor matrix |
| R-2 | "`admin`/`manager`: full control, including canvases they do not own." | `PHASE3_03_CANVAS_API_CONTRACT.md:241` | No such roles exist |
| R-3 | "`editor`: create/edit canvases in projects they can access; cannot delete others' canvases." | `PHASE3_03_CANVAS_API_CONTRACT.md:242` | Editor = R/C/U/D per `PHASE2_02:46` |
| R-4 | "`viewer`: read-only." | `PHASE3_03_CANVAS_API_CONTRACT.md:243` | §2 (Viewer read-only; Commenter added) |
| R-5 | Create rule using "`projects.created_by = user` **or** role in admin/manager set" | `PHASE3_03_CANVAS_API_CONTRACT.md:233` | §3 row 1 |
| R-6 | Update rule using "`canvases.created_by = user` **or** admin/manager role" | `PHASE3_03_CANVAS_API_CONTRACT.md:235` | §3 row 4 |
| R-7 | Delete rule using "`canvases.created_by = user` **or** admin/manager role" | `PHASE3_03_CANVAS_API_CONTRACT.md:236` | §3 row 5 |
| R-8 | "Access follows project access; ownership is `canvases.created_by`." | `PHASE3_03_CANVAS_API_CONTRACT.md:229` | §1 principle |
| R-9 | D1 option "(c) full RBAC with `admin/manager/editor/viewer`" | `PHASE3_03_CANVAS_API_CONTRACT.md:525` | §2 + §3 |
| R-10 | Role label "**Owner / Admin**" | `PHASE3_01_CANVAS_IA_JOURNEYS.md:173` | §2 (project-scoped Owner) |
| R-11 | Role label "**Editor / Member**" | `PHASE3_01_CANVAS_IA_JOURNEYS.md:174` | §2 (project-scoped Editor) |
| R-12 | "align with the existing project membership model" (role-model half) | `PHASE3_02_CANVAS_INTERACTIONS.md:283` | §2; the "existing" wording is B-4 |

**Standing rules after repeal:**

- `users.role` (`backend/src/database/schema.sql:9`) remains a global account attribute. It MUST NOT be used for Canvas or project permission decisions (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:26`).
- `requireRole` (`backend/src/middleware/auth.middleware.ts:24-32`) remains for platform-level account administration (currently `backend/src/routes/users.routes.ts`). It MUST NOT be applied to Canvas routes.
- No `admin` or `manager` role is introduced anywhere in the Canvas contract.

---

## 9. Test cases

**PROPOSED.** Table-driven API/service tests. Each case maps to a corrected rule. Add to `backend/src/tests/` (currently zero Canvas coverage — **VERIFIED**, `PHASE3_03_CANVAS_API_CONTRACT.md:149,178`).

| ID | Area | Case | Expected |
|---|---|---|---|
| BA-01 | Role matrix | Owner reads a canvas in their project | `200` |
| BA-02 | Role matrix | Editor reads a canvas in their project | `200` |
| BA-03 | Role matrix | Viewer reads a canvas in their project | `200` |
| BA-04 | Role matrix (B-2) | Commenter reads a canvas in their project | `200` |
| BA-05 | Role matrix | Viewer creates a canvas | `403 FORBIDDEN` |
| BA-06 | Role matrix (B-2) | Commenter creates an item | `403 FORBIDDEN` |
| BA-07 | Role matrix | Viewer updates an item | `403 FORBIDDEN` |
| BA-08 | Role matrix (B-2) | Commenter deletes a connection | `403 FORBIDDEN` |
| BA-09 | Role matrix | Editor creates, updates, and deletes a canvas and its items | `201` / `200` / `204` |
| BA-10 | Membership | Owner changes a role; non-owner editor attempts the same | `200` / `403` |
| BA-11 | Global-role removal | User with global `users.role = 'admin'` but no project membership reads a canvas | `404` (no global bypass) |
| BA-12 | Global-role removal | User with global `users.role = 'viewer'` but active editor membership writes an item | `200`/`201` (global role ignored) |
| BA-13 | Isolation | Non-member reads a canvas | `404 CANVAS_NOT_FOUND` |
| BA-14 | Isolation / 403-vs-404 | Non-member updates a canvas | `404` (not `403`) |
| BA-15 | Isolation / 403-vs-404 | Member with viewer role updates a canvas | `403 FORBIDDEN` |
| BA-16 | Ownership | `PUT /api/canvas/items/:itemId` with an item from another project's canvas | `404` |
| BA-17 | Ownership | `DELETE /api/canvas/connections/:connId` with a connection from another project's canvas | `404` |
| BA-18 | Ownership | `POST` connection with an endpoint from another canvas | `422 CROSS_CANVAS_ITEM` |
| BA-19 | Ownership | `POST` task item with `task_id` from another project | `422 SEMANTIC_ERROR` |
| BA-20 | Membership | Inactive membership reads a canvas | `404` |
| BA-21 | Agent | Agent token with no grant reads a canvas | `403 FORBIDDEN` |
| BA-22 | Agent | Agent with explicit `canvas.read` grant reads a canvas | `200` |
| BA-23 | Agent | Agent with `canvas.read` attempts a write | `403 FORBIDDEN` |
| BA-24 | Agent | Agent attempts a membership change | `403` / never |
| BA-25 | Agent / audit | Agent write with a delegating human | audit row records both agent and human identities |
| BA-26 | List scoping | `GET /api/canvas` as a member of project A | only project A canvases returned |
| BA-27 | Backend enforcement | Direct API write by a viewer (control hidden in UI) | `403 FORBIDDEN` |
| BA-28 | Commenter | Commenter creates its own comment; edits another user's comment | `201` / `403` |

**Revision of existing P3-03 tests T01-T06 (`PHASE3_03_CANVAS_API_CONTRACT.md:493-498`):**

| Old ID | Old expectation | Corrected expectation |
|---|---|---|
| T01 | `GET /api/canvas/:id` without token → `401` | Unchanged |
| T02 | `GET /api/canvas/:id` with invalid token → `401` | Unchanged |
| T03 | User B reads User A's private canvas → `404` | Specify membership: non-member → `404`; member with read role → `200` (Canvas is project-scoped, not private) |
| T04 | User B updates/deletes User A's canvas → `403` | Non-member → `404`; member with viewer/commenter role → `403` |
| T05 | User B updates an item in User A's canvas → `404` (or `403` if visible) | Non-member → `404`; member with read-only role → `403`; member editor/owner → `200` |
| T06 | User B deletes a connection in User A's canvas → `403`/`404` per policy | Non-member → `404`; member with read-only role → `403` |

T07-T25 are unchanged except where they reference the old role model or the old 403/404 split; update their setup to use project membership fixtures.

---

## 10. Change log — B-1 / B-2 to exact corrected text

**CORRECTED.** Each row maps a blocking finding to the exact superseded text and the exact corrected text in this artifact. Pipe characters inside quoted table rows are escaped as `\|` so this markdown table stays well-formed; the quoted text is otherwise verbatim. Line numbers refer to the artifacts as reviewed.

| ID | Finding | Exact superseded text | Exact corrected text |
|---|---|---|---|
| **B-1a** | Global role set proposed | `PHASE3_03_CANVAS_API_CONTRACT.md:240`: "**Role model is DECISION-REQUIRED.** The only evidence is `users.role` (default `'viewer'`, `schema.sql:9`) and the unused `requireRole` helper. The contract proposes the set `admin \| manager \| editor \| viewer`, where:" | §2: "**B-2 correction — explicit statement:** adding the `commenter` actor grants **read-only** Canvas access." and the five-actor matrix header "Owner / Editor / Viewer / Commenter / Agent". |
| **B-1b** | `admin`/`manager` roles | `PHASE3_03_CANVAS_API_CONTRACT.md:241`: "- `admin`/`manager`: full control, including canvases they do not own." | §2 summary: "**Owner** \| R/C/U/D", "**Editor** \| R/C/U/D", "**Viewer** \| R (read-only)", "**Commenter** \| R (read-only)", "**Agent** \| Default none; named grants only". No admin/manager row exists. |
| **B-1c** | Editor cannot delete | `PHASE3_03_CANVAS_API_CONTRACT.md:242`: "- `editor`: create/edit canvases in projects they can access; cannot delete others' canvases." | §2 matrix: Editor "Delete canvas \| D" and "Delete item / connection \| D"; §2 note: "an Editor may delete a canvas in a project where they hold an active Editor membership". |
| **B-1d** | Viewer only role defined | `PHASE3_03_CANVAS_API_CONTRACT.md:243`: "- `viewer`: read-only." | §2 matrix adds the Commenter column and the Agent column; §6 defines read-only enforcement. |
| **B-1e** | Create rule uses global roles | `PHASE3_03_CANVAS_API_CONTRACT.md:233`: "\| Create canvas \| Authenticated user with access to the target project (`projects.created_by = user` **or** role in admin/manager set). Global canvases (`project_id = null`): **DECISION-REQUIRED** (proposed: admin/manager only). \|" | §3 row 1: "Active membership in the target project with role **owner** or **editor**. `project_id` must resolve to exactly one existing project. Agent: only with an explicit `canvas.create` grant for that project." |
| **B-1f** | Update rule uses global roles | `PHASE3_03_CANVAS_API_CONTRACT.md:235`: "\| Update canvas metadata \| `canvases.created_by = user` **or** admin/manager role. \|" | §3 row 4: "Active membership; role **owner** or **editor**. Not creator-only." |
| **B-1g** | Delete rule uses global roles | `PHASE3_03_CANVAS_API_CONTRACT.md:236`: "\| Delete canvas \| `canvases.created_by = user` **or** admin/manager role. \|" | §3 row 5: "Active membership; role **owner** or **editor**." |
| **B-1h** | Ownership is `created_by` | `PHASE3_03_CANVAS_API_CONTRACT.md:229`: "**Principle:** Canvas is a project-scoped visual planning surface. Access follows project access; ownership is `canvases.created_by`." | §1: "Access follows **active project membership and the membership role**. `canvases.created_by` is provenance, not an authorization source." |
| **B-1i** | Immutable ownership rule | `PHASE3_03_CANVAS_API_CONTRACT.md:245`: "**Ownership rule:** `canvases.created_by` is immutable after creation. There is no transfer mechanism in v1." | §4 rule 2: "`canvases.created_by` is provenance, not authorization. ... It is recorded for audit and is immutable after creation, but it does not grant or restrict Canvas access." |
| **B-1j** | D1 recommends global RBAC | `PHASE3_03_CANVAS_API_CONTRACT.md:525`: "\| D1 \| Role model & permission matrix \| (a) owner-only, (b) owner + admin, (c) full RBAC with `admin/manager/editor/viewer` \| (c), using existing `users.role` and `requireRole` \|" | §2 five-actor matrix; §8 R-9 repeals D1 option (c). |
| **B-1k** | P3-01 role labels | `PHASE3_01_CANVAS_IA_JOURNEYS.md:173`: "\| **Owner / Admin** \| Create, rename, delete any canvas; place/edit/delete items and connections; manage project scoping \| ... Role strings come from `users.role` (`types/index.ts:8`) \|"; `:174`: "\| **Editor / Member** \| Same as Owner under current code (no RBAC) \| No canvas-scoped permission check \|" | §2 matrix and summary; §8 R-10/R-11. |
| **B-1l** | P3-02 D-12 role model | `PHASE3_02_CANVAS_INTERACTIONS.md:283`: "\| **D-12** \| Canvas permissions \| Any authenticated user / project-scoped RBAC \| **Project-scoped RBAC** — align with the existing project membership model; backend remains authoritative \| DECISION-REQUIRED \|" | §2 (project-scoped five-actor model). The "existing project membership model" wording remains B-4. |
| **B-1m** | P3-04 C-01 / OD-03 | `PHASE3_04_CANVAS_SPEC_APPROVAL.md:104`: "**Role-model conflict across phases.** ... proposes global roles `admin \| manager \| editor \| viewer` on `users.role` + `requireRole`; ... mandates project-scoped membership (`Owner/Editor/Viewer/Commenter`) ... **VERIFIED** — blocking"; `:192`: "\| **OD-03** \| Role model and permission matrix \| Project-scoped membership (`Owner/Editor/Viewer/Commenter`) per `PHASE2_02`; do not use `users.role` \| ..." | §2 and §3 implement OD-03; §8 records the repeal. |
| **B-2a** | Commenter omitted from role set | `PHASE3_03_CANVAS_API_CONTRACT.md:240-243` (the proposed set is `admin \| manager \| editor \| viewer`; no `commenter`) | §2 matrix includes the **Commenter** column; §2 summary: "**Commenter** \| R (read-only)". |
| **B-2b** | Route auth omits commenter | `PHASE3_03_CANVAS_API_CONTRACT.md:237`: "\| Create/update/delete item or connection \| Must have edit rights on the parent canvas (same rule as update canvas). Server **must** verify the item/connection belongs to the canvas named in the path. \|" | §3 rows 6-10 list the explicit role column; §6 rule 2: "**Commenter has the same Canvas read rights as Viewer**". |
| **B-2c** | Endpoint auth wording | `PHASE3_03_CANVAS_API_CONTRACT.md:339`: "- **Auth:** owner or admin/manager."; `:346`: "- **Auth:** owner or admin/manager."; `:366`/`:374`/`:395`: "- **Auth:** edit rights on the parent canvas."; `:380`: "- **Auth:** edit rights on the canvas." | §3 rows 4-10 give the corrected per-route rule with the five-actor role column. |
| **B-2d** | P3-04 blocking finding 1 | `PHASE3_04_CANVAS_SPEC_APPROVAL.md:37`: "`PHASE3_03` also omits `commenter`. **VERIFIED**" | §2 adds commenter; §9 BA-04/BA-06/BA-08/BA-28 test commenter behavior. |
| **B-2e** | Package B-2 | `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:45`: "\| **B-2** \| **Missing actor:** P3-03 omits the `commenter` actor required by Phase 2 and the original permission matrix. \| Add commenter to the Canvas role matrix and route policy. \|" | §2 (role matrix) and §3 (route/method matrix) add commenter explicitly. |

---

## 11. Residual DECISION-REQUIRED and out-of-scope items

| ID | Item | Status |
|---|---|---|
| RD-1 | Ratify this appendix as the replacement for P3-03 §3.3, §3.5 auth lines, and D1. | **DECISION-REQUIRED** |
| RD-2 | Ratify the membership-aware 403/404 policy as the replacement for P3-03 D3 option (c). | **DECISION-REQUIRED** |
| RD-3 | Confirm Editor may delete canvases (Phase 2 §3 says yes) or record an owner amendment. | **DECISION-REQUIRED** |
| RD-4 | Settle the persisted shape and lifecycle for project-scoped agent grants (`PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:36`). | **DECISION-REQUIRED** (carried from Phase 2) |
| RD-5 | Settle how agent identity is presented on Canvas routes (agent token → grant lookup). | **DECISION-REQUIRED** |
| RD-6 | Global canvases (`project_id = null`) — remains **B-3** (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:46`). | Out of scope |
| RD-7 | Phantom membership-model wording in P3-02 §7.2 — remains **B-4** (`PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:47`). | Out of scope |
| RD-8 | Export/import scope, card provenance, acceptance-criteria scoring, Phase 2 hash freezing, Canvas test-coverage gate — remain **B-5 through B-9**. | Out of scope |

---

## 12. Evidence index

- `PHASE3_CANVAS_SPEC_APPROVAL_PACKAGE.md:44-45` — B-1/B-2 definitions.
- `PHASE3_04_CANVAS_SPEC_APPROVAL.md:37,104,192,235-236` — blocking findings C-01, OD-03, and the alternate B-numbering.
- `PHASE3_03_CANVAS_API_CONTRACT.md:139-154,164-178,211-245,294-398,493-498,525-527` — current auth evidence, F1/F2/F11/F12/F15, error mapping, §3.3, endpoint specs, tests, decisions.
- `PHASE3_01_CANVAS_IA_JOURNEYS.md:63,167-178,508,517` — current route guard, role table, D2/D11.
- `PHASE3_02_CANVAS_INTERACTIONS.md:197,239,283` — current no-RBAC finding, permissions improve item, D-12.
- `PHASE2_02_RBAC_AND_CONNECTOR_SECURITY.md:24-30,34-36,42-61,78-86,92` — the Phase 2 target model used for the correction.
- `PHASE2_FOUNDATION_APPROVAL_PACKAGE.md` — Phase 2 design baseline and owner decisions D-01/D-03.
- Live source: `backend/src/routes/canvas.routes.ts:8`; `backend/src/middleware/auth.middleware.ts:8-22,24-32`; `backend/src/services/canvas.service.ts:50,66,72,91,99,127,141,181,187,237,247,264,270`; `backend/src/database/schema.sql:9,161-198`; `backend/src/routes/users.routes.ts` (sole `requireRole` consumer); `backend/src/tests/backend.test.ts` (zero Canvas coverage).

---

*Prepared as a read-only Phase 3 correction artifact. This is a specification and decision register, not an implementation authorization and not a source-code change.*
