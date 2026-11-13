# PM-P2-02 — RBAC, Ownership and Connector Secret Policy

**Status:** Proposed policy for the Phase 2 owner gate; not yet owner-approved.  
**Scope:** Human and agent access, project membership, Project Canvas, future workflows, connector credentials, redaction and backend enforcement requirements.  
**Implementation boundary:** Specification only. No application source, database, environment, credential, or runtime changes are authorized by this artifact.

## 1. Decision status and verified baseline

Labels: **VERIFIED** means observed in the reviewed source or Phase 1 decision pack; **PROPOSED** means the recommended target contract; **DECISION-REQUIRED** means the owner must settle it before implementation.

- **VERIFIED:** `users.role` is a global column with default `viewer`; `projects.created_by` records the creator. The reviewed schema has no `project_members` table. A global user role is therefore not evidence of project membership or resource-level enforcement.
- **VERIFIED:** `agents` stores an API-key hash and a `permissions` field, but the reviewed table does not establish project scoping or a complete permission contract.
- **VERIFIED:** Canvas records have `project_id`, but it is nullable in the current schema. Canvas items and connections are children of a Canvas and must inherit its project scope.
- **VERIFIED:** `connectors` has `created_by` and a JSON `config`; `connector_configs` stores `value` plus `is_secret`. The schema does not establish encryption, per-project scope, or safe API/log redaction. `connectors` has no project ID in the reviewed schema.
- **VERIFIED:** The Phase 1 route inventory found no registered workflow, execution, replay, approval, or audit API; Automation Studio is a preview-only UI, with no runtime assumed. Project Canvas is a planning surface, not workflow control flow.
- **VERIFIED:** Phase 1 identified no RBAC-enforcement test coverage in the existing backend test baseline. Passing existing tests does not prove the permissions below are enforced.

These facts describe the reviewed baseline, not a claim that the current app already implements this policy.

## 2. Principal and membership model — PROPOSED

### 2.1 Humans

Authorization is project-scoped. A human must have an active membership for the target project; access to one project grants nothing in another. A member may have different roles in different projects. Account authentication and project authorization are separate checks.

Use the project membership record—not a client-supplied role, request-body `user_id`, or stale role claim—as the authorization source. Keep `users.role` out of project permission decisions; any platform-level administrative role would be a separate, explicit policy and is outside this matrix.

For a new project, create its first `owner` membership in the same transaction as project creation. Do not infer access to legacy projects merely from a user's account role. `projects.created_by` is a candidate for legacy owner backfill, but its identities and demo/test records must be reconciled before any migration. **DECISION-REQUIRED:** approve the legacy backfill rule and the membership migration.

A project must retain at least one active owner. Ownership transfer, owner removal/demotion, and membership changes require owner authority and an audit record. No user may elevate their own role through a request payload or by editing project data.

### 2.2 Agents

An agent is a non-human service principal, not a human project role. Its default access is **none**. Grant it an explicit project/resource/action allow-list, with an owner, purpose, expiry/revocation path, and audit attribution. Grants must not include wildcard access by default. Agents cannot manage membership, grant permissions, read credential values, impersonate a user, publish a workflow, or approve their own proposed action. Where a human initiated/delegated an action, record both identities.

**DECISION-REQUIRED:** settle the persisted shape and lifecycle for project-scoped agent grants; the current `agents.permissions` field alone does not prove such isolation.

## 3. Permission matrix — PROPOSED

`R` = read; `C` = create; `U` = update; `D` = delete; `M` = membership/project administration; `own` = authored by that principal. All human access is limited to projects where membership is active. The agent column describes a default-deny principal: the named operation is allowed only when explicitly granted for that project/resource.

| Capability | Owner | Editor | Viewer | Commenter | Agent (default; explicit grant required) |
|---|---|---|---|---|---|
| Project details and ordinary project data | R/C/U/D | R/C/U/D on content | R | R | No access unless allow-listed; only named resources/actions |
| Tasks, checklists, dependencies | R/C/U/D | R/C/U/D | R | R | Explicit task/checklist/dependency actions only; no project-wide wildcard |
| Canvas, items and visual connections | R/C/U/D | R/C/U/D | R | R | No access by default; explicit `canvas.read` or narrowly named item actions |
| Comments | R; may moderate/remove any | R/C/U/D own | R | R/C/U/D own | No access by default; explicit `comment.create` or narrower grant; attributable to agent |
| Membership, role changes, project settings, ownership transfer | M | — | — | — | Never |
| Connector safe metadata/status | R | R | R (safe fields only) | R (safe fields only) | No access by default; safe status only when explicitly granted |
| Create/change/revoke connector or credential binding | M; credential operations are write-only | No; may request a change | — | — | Never manage credentials or bindings |
| Read back a credential/secret value | **Never** | **Never** | **Never** | **Never** | **Never** |
| Workflow/Automation preview and read (current state) | R | R | R | R | None unless explicitly granted, and no runtime authority follows |
| Future workflow draft | C/U/D drafts | C/U/D drafts | R | R; comments only | None by default; `workflow.draft.*` only if specifically granted |
| Publish workflow | **Disabled for every role now.** After a separately approved runtime/publish policy: owner only, for an immutable reviewed version, with explicit confirmation and audit. | No | No | No | Never; cannot approve or publish |
| Execute, replay or retry a side-effecting workflow | **Disabled for every role now.** A later runtime requires separate owner authorization and per-run approval. A dedicated least-privilege executor performs the run. | No | No | No | No self-start or self-approval. A future executor binding is not a general agent grant. |
| Read project audit history | R, project-scoped | No by default; only if separately granted read-only | — | — | No by default |
| Manage agents or their grants | M | — | — | — | Never |

**Inheritance and boundaries:** Viewer is read-only. Commenter is Viewer plus the ability to create, edit, and delete their own comments; an owner may moderate comments. Editor is Commenter plus CRUD on project content and Canvas, but not membership, project administration, credentials, or workflow publication/execution. Owner is the project administrator and content owner. Connector secrets are an exception: no role receives plaintext readback, including Owner.

**Canvas scope:** every Canvas must resolve to exactly one project. A Canvas with no project mapping is inaccessible to ordinary members and must not become globally readable. Canvas items/connections inherit the owning Canvas's project; requests must not authorize a child by its supplied ID alone.

**Workflow boundary:** Automation remains preview-only until a separate runtime specification and explicit owner authorization exist. Drafting is not publishing; publishing is not execution. A UI button, agent capability, Canvas connection, or test preview cannot imply live execution rights. Any future external write must be separately authorized, approved, attributable, and auditable.

## 4. Connector credential and redaction policy — PROPOSED

1. **Scope:** Bind each connector and its credential to one explicit project, provider, environment, and minimum provider scopes/operations. A connector creator is not automatically a project-wide authorization rule. Because the reviewed connector schema lacks `project_id`, existing connector records must be explicitly mapped or quarantined before cross-user/project access is enabled. Never fall back to global visibility or creator-only inference.
2. **Storage:** Store a server-side credential reference and safe metadata (provider, project, scopes, configured/status, rotation time). Resolve the secret only inside the backend operation that needs it, through a deployment-approved credential provider. Keep raw credentials out of workflow JSON, database config fields, browser storage, URLs and task metadata. `is_secret=1` is a classification marker, not encryption.
3. **Write-only UX/API:** Owners may set, rotate or revoke credentials through an authorized write-only operation. After save, all roles—including Owner—receive only a safe result such as `configured: true`, status and update time; never echo the submitted secret or return its original value. Editors may request a connector change but cannot replace its credential.
4. **Use:** A connector runner receives only the exact credential reference and provider operation it needs. Agents/workflows receive neither a secret-read API nor a reusable credential value. External operations require an explicit scope and appropriate user/owner authorization; test mode must be mock/pinned-data only unless a separately authorized live health check is confirmed.
5. **Redaction:** Apply allow-listed response serializers and centralized recursive redaction before API serialization, logging, audit, tracing, export, error reporting, screenshots and support diagnostics. Redact credential values and sensitive provider payloads in success and failure paths. Do not rely on frontend masking. Return generic safe errors with a request ID; keep provider detail in protected diagnostics only after redaction.
6. **Audit:** Record actor kind/ID, project, connector ID, operation, outcome and request/correlation ID for credential set/rotate/revoke/use. Never store the secret, secret reference if it is itself sensitive, auth header, raw provider error, or unredacted old/new configuration in the audit record.

**DECISION-REQUIRED:** choose the provider for the intended deployment (for example, OS credential store for local use or managed vault/KMS for hosted use), the recovery/rotation approach, and retention/privacy rules. Do not implement encryption with a key stored beside ciphertext in the same SQLite database.

## 5. Backend enforcement requirements — mandatory for implementation

1. **Authenticate first; authorize every request.** Require an authenticated human or agent identity on every non-public route. Return `401` for missing/invalid identity. Derive identity from verified authentication, never from request-body fields. Enforce authorization on the backend even when the UI hides a control.
2. **Resolve the project from the resource.** For each read/write, resolve the canonical resource-to-project relationship server-side, then verify active membership and action. Scope list/search/count queries before returning data. For moving a resource, authorize both its current and destination project. Fail closed on missing, null, conflicting or unscoped ownership.
3. **Use a shared policy check at the service boundary.** Routes validate input and call domain services; services enforce `authorize(actor, project, resource, action)` before database mutation/response. Every alternate route, bulk action, import/export, dashboard/query, Canvas child route and connector operation uses the same policy. Do not treat route middleware or client-side checks as the only control.
4. **Protect against IDOR and escalation.** Test cross-project ID substitution for parent and nested IDs; reject user-supplied owner, role, project membership, creator, connector scope, agent grant, or audit actor overrides. A resource's project ID from the payload must not replace its stored relationship. Inaccessible lookups may use a consistent `404` where needed to prevent enumeration; explicit authenticated denials use `403` without disclosing protected details.
5. **Fail closed on roles and scopes.** Validate roles/actions against an allow-list; unknown role, inactive membership, expired/revoked agent grant, unmapped connector, or policy lookup failure means deny. If permission caching is introduced, membership/grant revocation must invalidate it before subsequent requests are authorized.
6. **Make audit trustworthy.** Audit successful sensitive changes and denied sensitive operations with server-derived actor/project/resource/action/outcome and request ID. Write the mutation and success audit atomically where feasible; normal application paths are append-only. Redaction runs before audit persistence.
7. **Keep testing at the API and service levels.** Add table-driven role/action tests for each route family and direct service tests. Include owner/editor/viewer/commenter behavior; agent default deny and explicit grants; cross-project and nested-ID attacks; role revocation; project reassignment; null Canvas and unscoped connector cases; bulk/import/export; connector canary secrets in responses/logs/audit/errors; and future publish/execute denial while runtime is disabled. Verify tests fail if checks are removed.

Recommended response semantics: `401` unauthenticated; `403` authenticated but unauthorized; `404` absent or deliberately concealed resource; `400/422` invalid request; `409` membership/ownership conflict; safe error body only. Never return SQL, stack traces, credentials, auth headers or raw provider payloads.

## 6. Migration and rollout guardrails

- Add explicit project membership and project-scoped agent/connector grants through a reviewed, versioned migration; do not infer them from `users.role` or an `is_secret` flag.
- Before backfill, report counts of projects, creators missing from `users`, existing global roles, unscoped Canvases/connectors, and unresolved agent permissions. Review ambiguous records before applying an owner-approved mapping.
- Preserve a deny-by-default cutover: unmapped project data, Canvas, connectors or agent grants remain inaccessible until explicitly resolved. Do not make every logged-in user a member to avoid migration work.
- Roll out with authorization tests and a recoverable migration plan; no migration, data backfill, credential move or enforcement code change is authorized by this planning task.

## 7. Owner decisions required at the Phase 2 approval gate

1. Accept, amend, or reject the project-scoped role definitions and the separation between global account role and project membership.
2. Approve a legacy membership backfill rule, including treatment of creator identities, missing users and demo/test records; confirm that unscoped records fail closed.
3. Approve the owner/editor/viewer/commenter behavior and whether an editor can use an already authorized, non-side-effecting connector operation (the proposed default is no live external use without explicit authorization).
4. Choose the deployment boundary and credential provider; settle secret recovery/rotation and audit-retention/privacy rules.
5. Approve how agent grants are represented, created, scoped, expired and revoked.
6. Confirm that workflow publication/execution/replay remain disabled until a separate runtime approval; if later enabled, require owner approval and a dedicated least-privilege executor.

## 8. Evidence and completion boundary

Evidence reviewed: `PHASE2_SHARED_FOUNDATIONS_DRAFT.md`, `PHASE1_DISCOVERY_DECISION_PACK.md`, and the live `backend/src/database/schema.sql`. The parent draft reports the Phase 1 route inventory and preview-only Automation status. Existing implementation behavior and authorization coverage must be re-audited before any code/migration work; this policy is a target contract, not proof of enforcement.

**Completion for PM-P2-02:** the requested roles, membership boundaries, Canvas and workflow rights, publish/execute gate, connector scope/redaction policy, and backend enforcement/test requirements are defined here. Owner approval and implementation remain separate gates.
