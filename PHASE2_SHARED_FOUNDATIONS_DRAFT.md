# Project Manager — Phase 2 Shared Foundations (Draft)

**Kanban task:** `t_19d71597`  
**Status:** Draft for the Phase 2 owner gate — not owner-approved architecture  
**Scope:** Shared frontend/backend/data/security/design foundations only  
**Implementation boundary:** No application source, database, environment, credential, or deployment changes are authorized by this document.

## 1. Purpose and decision status

This draft turns the Phase 1 evidence baseline and the approved glass-design direction into a common set of proposed contracts for the Project Manager product. It is intended to guide the Phase 2 work cards and give the owner one coherent foundation to accept, amend, or reject before Phase 3 feature specifications proceed.

Labels used here: **VERIFIED** = observed in the Phase 1 evidence pack or live files reviewed for this task; **PROPOSED** = target contract recommended here; **DECISION-REQUIRED** = the owner must settle it; **UNKNOWN** = not established by available evidence.

The running Phase 2 task authorizes architecture/design planning only. It does not authorize a permission-system rollout, a database migration, connector-secret refactor, or Automation runtime. Project Canvas remains a planning/diagramming surface. Automation Studio remains a preview-only future surface; no execution, publish, replay, or live connector side effects are implied.

## 2. Verified baseline and constraints

- **VERIFIED:** Frontend is React 19, TypeScript, Vite, Tailwind, React Router, and TanStack Query. The frontend manifest provides `typecheck` and `build` scripts; server state should continue to use TanStack Query rather than being duplicated in page-local stores.
- **VERIFIED:** Backend is Express + TypeScript with SQLite (`node:sqlite`). `backend/src/index.ts` is the test/app factory and `backend/src/server.ts` is the unified server; Phase 1 verified the same API route families registered in both.
- **VERIFIED:** Existing route families include auth, users, agents, dashboard, projects, tasks, checklists, dependencies, Git, import/export, Canvas, backup, monitoring, UI layout, and connectors. No workflow/execution/replay/approval route was found in the Phase 1 scan.
- **VERIFIED:** SQLite schema includes users, projects, tasks, task dependencies, comments, checklists/items, `audit_logs`, agents/agent activities, Canvas tables, connectors/configs, UI layouts, and supporting tables. `projects.created_by` is present; a project-membership join table was not present in the reviewed schema. Automation tables were not present.
- **VERIFIED:** `connectors.config` and `connector_configs.value` are persisted fields; the latter has an `is_secret` flag. The schema alone does not prove encryption, access isolation, or redaction.
- **VERIFIED:** `audit_logs` records user/agent, action, target, old/new value, trigger, reasoning summary, IP and timestamp. Its schema does not show a project scope, request/correlation ID, or structured redaction contract.
- **VERIFIED:** Backend package exposes `db:migrate` via `src/database/migrate.ts`, and the `src/database/migrations/` directory listing was empty during this review. The migration runner's implementation and any migration ledger were not verified; do not infer transactional, versioning, or rollback behavior from the script name.
- **VERIFIED:** `UI_UX_PROGRESS.md` and `ThemeProvider.tsx` show six existing theme IDs (`crystal`, `violet`, `aurora`, `ember`, `emerald`, `porcelain`), Obsidian Signal as default, `#54C8FF` as its accent, and `pm-theme-preference-v2` storage. `index.css` contains the existing `--pm-*` semantic and supporting variables and reduced-motion rules.
- **DECISION-REQUIRED:** `UI_UX_REDESIGN_PLAN.md` conflicts with the progress tracker and live theme implementation: it specifies `#63C6FF` and different preset names/accents, while the tracker and implementation specify `#54C8FF` and Carbon Orchid/Aurora Mint/Emerald Circuit. No values are silently changed in this proposal.
- **VERIFIED:** The Phase 1 baseline reported frontend typecheck/build and backend typecheck/tests passing; backend build fails on TypeScript TS5096. This remains a pre-existing release-readiness defect, not a Phase 2 design change.

## 3. Shared application architecture

### 3.1 Frontend boundaries — PROPOSED

Keep the current React/Vite stack and working product behavior. Treat the following as **logical ownership boundaries**, not a requirement to move files in a broad refactor:

1. **App shell/providers:** authentication/session context, theme bootstrap, query client, global command registry, overlay stack, and toast host. Shell owns navigation and global UI state only.
2. **Shared UI and utilities:** buttons, panels, dialogs, drawers, menus, status/state components, keyboard/media-query helpers, formatting, typed API/error helpers, and permission-aware presentation primitives.
3. **Entities:** canonical typed Project, Task, User, Agent, Connector and (only after separate approval) Automation models, query keys and narrowly reusable domain display pieces.
4. **Features:** a single user interaction's validation and transient state (capture, task move, approval review, theme selection, etc.).
5. **Pages/routes:** route composition and URL-addressable state; no duplicated business logic or server-data cache.

**State ownership:** TanStack Query owns server records, cache, invalidation and mutation lifecycle. URL/search parameters own shareable filters and selected project/context. Local component/feature state owns open dialogs, drag previews, hover, form edits and other transient interaction state. Auth/theme remain global providers; do not mirror server entities in global context. Permission checks in the UI explain or hide unavailable actions but never authorize them.

### 3.2 Backend boundaries — PROPOSED

Preserve the existing Express app factory/server split and route parity. The target request flow is:

`HTTP route → authentication/session middleware → input validation → resource/project authorization → domain service → parameterized SQLite access → audit/event write where applicable → response serializer`.

Routes should be thin and should not contain SQL or role policy. Services own domain invariants and perform authorization against the resource's project scope. Shared middleware owns authentication, request ID, rate limits and transport/security headers. Responses must be serialized through allow-lists, especially for user, agent, connector and audit data. Add new behavior incrementally; do not reorganize the entire working tree as a prerequisite.

### 3.3 API conventions — PROPOSED

- Preserve the existing `/api/...` routes and response contracts until a contract audit establishes compatibility. Do not add a global `/v1` prefix or wrap every successful response without an explicit migration plan.
- Use resource-oriented nouns and standard methods: `GET` read, `POST` create/action, `PUT`/`PATCH` update (choose consistently per route family), `DELETE` remove. Validate IDs, enums, payload sizes and ownership at the server boundary; use parameterized SQL.
- Require authenticated identity for all non-public product endpoints. Use `401` for missing/invalid authentication; `403` for authenticated but unauthorized actions; `404` for absent resources (and, where appropriate, inaccessible project resources to prevent ID enumeration); `400`/`422` for invalid input; `409` for conflicts; `429` for rate limits. No exception response may include stack traces, SQL, credential material or raw provider payloads.
- For new endpoints, use a stable JSON error object with machine-readable `code`, human-safe `message`, optional field-level `details`, and `request_id`. Normalize legacy endpoints only in a separately tested compatibility change. Success responses should remain domain-shaped and explicitly typed.
- Each route family has a typed client contract and tests for auth, validation, role enforcement, cross-project access, success and failure. Do not let a frontend-provided `user_id`, role, project ID or capability override server-derived identity/authorization.
- Require idempotency keys for future retriable side-effecting actions; use conditional update/version checks where concurrent edits could overwrite user work. These are future contracts, not new current endpoints.

**Deployment/session decision:** The reviewed frontend currently uses a bearer-token flow and local storage. Whether the intended deployment remains local-only, single-user, or multi-user hosted is not settled here. Before widening access beyond the current trust boundary, the owner must approve the session/cookie, CORS, CSRF, HTTPS, backup and secret-provider design. Prefer secure, HttpOnly, SameSite cookies for a hosted browser deployment; changing the current token flow requires its own migration and threat review.

## 4. Ownership and RBAC contract

### 4.1 Scope model — PROPOSED

Authorization is **project-scoped**. A user who creates a project becomes its initial owner. Existing `created_by` remains provenance, not a substitute for a membership/role policy. Add an explicit project-membership model only through a reviewed migration; one user may hold different roles in different projects. Every task, checklist, dependency, comment, Canvas, connector, approval and future workflow lookup must be scoped through its owning project before read or write.

Agents are non-human service principals with their own ID, key hash and explicit project/resource/action allow-list. Their default is no access. An agent cannot grant itself permissions, manage memberships, read credential values, approve its own proposed actions, or impersonate a human. Every agent action records both the agent and the triggering human/workflow when one exists.

### 4.2 Proposed permission matrix

`R` = read; `C` = create; `U` = update; `D` = delete; `M` = membership/configuration management; `Draft` = create/edit a non-executable draft only. All permissions are restricted to an assigned project.

| Capability | Owner | Editor | Commenter | Viewer | Agent (default; explicit grant required) |
|---|---|---|---|---|---|
| Project, tasks, checklists, dependencies, Canvas | R/C/U/D | R/C/U; delete only own draft/content if policy allows | R | R | R; narrowly granted C/U on named resources |
| Comments | R/C/U own/D own | R/C/U own/D own | R/C own/D own | R | R/C only with explicit comment grant; attributable |
| Membership/roles and project settings | M | — | — | — | — |
| Connector definitions/configuration | R/C/U/D | R; may request change | R | R | No credential access; no config mutation by default |
| Secret values | write/rotate through secret provider; value never re-read in UI | — | — | — | — |
| Automation (current state) | preview only | preview only | preview only | preview only | none |
| Future workflow draft | Draft | Draft | R | R | Draft only if explicitly granted |
| Future publish/execute/replay with side effects | blocked pending separate owner approval and policy | blocked pending separate owner approval and policy | — | — | never self-approve; only a separate least-privilege execution identity after approval |
| Audit | R within project; no update/delete | R only if granted | — | — | no read by default |

This matrix is a proposal, not a claim about present enforcement. Backend enforcement is mandatory for every mutation and read, including nested resources and bulk/import/export endpoints. Default deny; deny-by-default tests must prove that a viewer cannot write and that a user cannot access another project by substituting an ID. Owner administration and ordinary content permissions must remain separate so a general editor cannot grant themselves ownership.

**Migration caution:** legacy projects need an explicit owner/membership backfill rule; `created_by` is a candidate initial owner but must be reconciled against existing users and demo/test identities before migration. Do not silently grant every user access to every project.

## 5. Connector and secret policy

1. **Never store plaintext secrets in connector config JSON, workflow definitions, task metadata, audit old/new values, logs, exports, screenshots, traces, error messages or browser storage.** `is_secret` is a classification flag, not proof of encryption.
2. Persist a non-secret credential reference and metadata (provider, scopes, owner/project, status, rotation time); a server-side `CredentialProvider` resolves the value only for the connector operation that needs it. Credential APIs are write-only from the UI: return `configured: true` and safe metadata, never the original value.
3. Keep credential material outside the project database where possible. The deployment-specific provider (OS credential store for local mode, managed vault/KMS for hosted mode) is **DECISION-REQUIRED**. If encrypted local storage is chosen, its key must not be stored beside the ciphertext in the same SQLite file; document key loss, rotation and recovery behavior before implementation.
4. Enforce least privilege per project and integration scope. An agent/workflow receives a reference and an operation allow-list, never a general secret-read API. Test mode must use mock/pinned data and must not call live side-effecting providers.
5. Redact centrally before serialization/logging. Redaction is allow-list based, applies recursively to nested provider output and error fields, and is covered by automated tests using canary strings. Never rely on masking only in the frontend.
6. Require explicit user confirmation for connect/test, rotate, revoke and any future operation with external effects. Record actor, project, connector, operation, outcome and request ID in the audit trail—never the secret value.

## 6. Migrations, domain events, audit and runtime infrastructure

### 6.1 Database migrations — PROPOSED

- Establish an ordered, checked-in migration ledger (`schema_migrations` or equivalent) with stable version, checksum and applied timestamp. `schema.sql` may remain the fresh-database baseline; do not use `CREATE TABLE IF NOT EXISTS` as a substitute for altering existing databases.
- Each SQLite migration is deterministic, parameterized where data is involved, tested against both an empty database and a copy of the current baseline, and transaction-wrapped where SQLite permits. Handle WAL mode, foreign keys and index changes explicitly.
- Take/verify a restorable backup before a production migration. Prefer forward-fix migrations over destructive automatic rollback; document a tested recovery path. Run migrations as a single deployment step, not concurrently in every web worker.
- Add checks for migration order, checksum drift, repeat invocation, foreign-key integrity and recovery from a failed migration. No schema or live database changes are authorized by this phase.

### 6.2 Domain events and async work — PROPOSED, future-gated

Keep business state changes and audit writes in the same database transaction. A domain event describes a committed fact; an audit record describes who did what and the decision/authority. They are related but not interchangeable. Do not introduce a queue for current synchronous CRUD without a demonstrated need.

Only if a separately approved Automation/runtime scope needs durable asynchronous work, add a transactional outbox, versioned event envelope (`event_id`, type/version, occurred time, project, actor, resource, correlation/causation IDs, safe payload), and a worker contract with leases, bounded retries/backoff, timeout, idempotency and dead-letter visibility. Side-effecting retries/replay require provider idempotency or an explicit approval; never silently repeat an email, write or status-changing action. No queue, workflow engine, execution table or live runtime is assumed to exist today.

### 6.3 Audit — PROPOSED

Extend the existing audit concept only after agreeing retention/privacy rules. New records should include immutable event ID, actor kind and ID (user/agent/system), acting human/delegation chain when applicable, project ID, action, target type/ID, outcome, trigger/source, timestamp, request/correlation ID, and a redacted minimal diff. Write audit in the same transaction as the mutation or record an explicit failure event if the attempted action is denied. Make the application writer append-only; expose filtered read-only views by project to authorized owners/auditors; prohibit update/delete from normal application paths.

Do not copy raw full row snapshots into `old_value`/`new_value`; redact credentials and minimize personal data. Define retention, export and erasure/legal-hold behavior before finalizing new audit fields. Existing audit coverage is not proven by schema presence alone.

### 6.4 Observability and recovery — PROPOSED

Use structured logs with request/correlation ID, route, actor kind/ID, project ID where safe, outcome, latency and error code; exclude auth headers, tokens, passwords, connector values and raw provider payloads. Track health, request failures, migration status, backup age/restore verification and (only if approved later) queue depth/retries/dead letters. Define alert thresholds and retention with the deployment decision; no operational SLO is asserted here.

## 7. Canonical design-token contract

### 7.1 Token hierarchy — PROPOSED

Use semantic CSS custom properties as the only component color source. Establish six documented **core semantic roles**, while retaining current supporting variables for compatibility:

| Core role (proposed canonical name) | Current implementation mapping / intent |
|---|---|
| `--pm-bg` | alias to existing `--pm-canvas` (graphite app field) |
| `--pm-rail` | existing rail surface |
| `--pm-glass` | existing default panel surface |
| `--pm-border` | existing translucent separator |
| `--pm-accent` | existing interaction accent |
| `--pm-text` | existing primary text |

Supporting roles remain separate: deep background, stronger/soft/hover glass, stronger border, secondary/muted text, accent RGB/ink/soft/glow, semantic success/warning/danger/info, radius, shadow, spacing, motion and z-index. Semantic status colors must never be replaced by a user's accent. Components use tokens, not literal palette colors. Preserve the current variables and provide aliases before considering any deprecation; do not perform a token rename in this planning phase.

### 7.2 Themes and unresolved palette conflict

**VERIFIED current contract:** six stable IDs in `ThemeProvider.tsx`; default `crystal` / Obsidian Signal uses `#54C8FF`; custom accent is local preference under `pm-theme-preference-v2`; valid custom accent updates accent/RGB/ink. `UI_UX_PROGRESS.md` records the same as a locked owner decision.

**DECISION-REQUIRED:** `UI_UX_REDESIGN_PLAN.md` v4 instead gives default `#63C6FF` and names Prism Violet, Aurora Teal and Juniper, while the live theme and progress tracker use `#54C8FF`, Carbon Orchid, Aurora Mint and Emerald Circuit. Recommendation: preserve current stable IDs, names, and `#54C8FF` until the owner explicitly selects the authoritative palette; then update the canonical design doc and implementation in a separately authorized change. Do not try to reconcile the contradiction by code change here.

The approved style posture remains Obsidian Signal Glass: graphite-black (not navy), restrained translucent surfaces, bright blue interaction signal, semantic statuses independent of accent, and `backdrop-filter` only on true layered surfaces. The selected preset and optional custom `#RRGGBB` accent are UI preferences; they do not affect permissions or server data.

### 7.3 Sizing, typography, motion and stacking — PROPOSED

- Use a 4px base spacing scale (4/8/12/16/24/32/40px) and shared radius/field/button sizes; retain denser desktop rows where data density requires them, while meeting touch target guidance on touch layouts.
- Use a consistent readable body scale (14–16px default, 12px minimum for non-critical metadata), explicit line-height, truncation only with an accessible full value, and tabular numerals for dense counts/timestamps.
- Keep visible focus and reduced-motion support as global tokens/rules. Existing `prefers-reduced-motion` support should be retained; all transitions/animations must become brief or non-animated in reduced-motion mode.
- Define one overlay stack: base `0`, sticky shell `10`, contextual menu/popover `20`, inspector/sheet `30`, transient feedback `40`, dialog `50`, command palette `60`, toast `70`. The design-plan stack provides a compatible starting point, but current CSS has higher/overlapping values (including overlay backdrops at `80` and Canvas drag at `9999`); normalize only in a later implementation with tests for nested overlays.
- Validate every foreground/background combination in each theme. Target WCAG 2.2 AA contrast (4.5:1 normal text, 3:1 large text and essential non-text controls). These are acceptance thresholds, not measured current results.

## 8. Shared component and interaction catalog

These are proposed shared contracts for `shared/ui`; child card `t_32992bea` should expand examples and state details before the approval gate.

| Component | Minimal API / variants | Required states and behavior |
|---|---|---|
| `Button` | `variant` primary/secondary/quiet/danger, `size`, `disabled`, `busy`, native `type` | Native button semantics; busy announces progress and prevents duplicate submit; visible focus; touch-sized on mobile. |
| `Panel` | `title`, `description`, `actions`, `children`, optional labelled region | Heading relationship via `aria-labelledby`; neutral surface; responsive content; no nested interactive controls. |
| `Inspector` | `title`, `open/selected item`, `onClose`, content tabs | Desktop complementary panel; narrow view becomes a sheet; current selection announced; close returns focus to opener. |
| `Drawer` | `open`, `side`, `modal`, `onClose`, title/content | Modal mode traps focus and restores it; non-modal mode has correct landmark; Escape closes unless an unsaved-change confirmation is required. |
| `Dialog` | `open`, `title`, `description`, `onClose`, action slots | Focus enters and returns; labelled/described; Escape and backdrop behavior explicit; destructive confirmation names the consequence. |
| `Menu` | labelled trigger and typed menu items (`disabled`, `danger`, shortcut) | Arrow keys, Home/End, Escape, typeahead where useful; focus returns to trigger; do not use for form controls. |
| `Toolbar` | orientation, grouped actions, selected tool | Keyboard navigation and visible shortcut hints; wraps or scrolls safely on mobile; no hover-only affordance. |
| `Status` | `value`, readable `label`, semantic `tone` | Text/icon plus color; status is never conveyed by color alone; unknown values have a safe fallback. |
| `Toast` | kind, title, description, dismiss/undo action | `aria-live=polite` by default; assertive only for urgent failures; actionable messages persist until dismissed; no secret/provider detail. |
| `EmptyState` | title, explanation, optional primary action | Distinguish genuinely empty from filtered/no-access; action is permission-aware and keyboard operable. |
| `Loading` | accessible label, region | `aria-busy` on affected region; skeletons do not communicate false data; reduced-motion-safe. |
| `ErrorState` | safe message, retry action, optional request ID | Explain recovery; retry only when safe/idempotent; technical details stay in protected logs. |

Shared components provide consistent semantics and visuals; domain components retain domain meaning. Do not reuse a visual Canvas connection as a workflow execution edge or imply an Automation action is live merely because it shares the same node/panel styling.

## 9. Accessibility and responsive acceptance standards

- All flows must work with keyboard only: logical tab order, visible focus, no keyboard traps outside modal dialogs, Escape handling, shortcut discoverability and no shortcuts that hijack typing in editable fields.
- Use semantic HTML and accessible names; associate every input with a label and field-level error; announce async result/error states; use appropriate landmarks, headings and table labels. Test with screen-reader landmarks and form feedback.
- Meet the contrast thresholds above across all six themes, focus indicators and disabled/selected states. Never rely only on color, shape, drag or hover to expose meaning/action.
- Respect `prefers-reduced-motion`; support zoom/reflow; provide non-drag alternatives for Canvas operations and an accessible list/outline alternative for any spatial view.
- Preserve the existing 1120/850/780px CSS breakpoints as current implementation facts; test representative widths 1440, 1024, 768 and 390px. At narrow widths, stack panels, convert inspector/drawer to an accessible sheet, keep primary actions visible, and allow horizontal scrolling only for inherently wide data tables or spatial canvases (with an alternate list view). No page-level horizontal overflow.
- Verify keyboard, screen-reader, contrast and responsive criteria with an explicit test matrix; a typecheck/build alone does not establish accessibility.

## 10. Phase 2 exit gate and owner decisions

Before approving shared foundations, the owner should record:

1. Whether the authority order in Phase 1 Decision A stands and whether the implementation/progress token conflict is resolved in favor of `#54C8FF` or `#63C6FF` (including preset names).
2. Whether the proposed project-scoped roles and membership model are accepted, including migration/backfill treatment for legacy projects and agent identities.
3. The intended deployment/trust boundary (local-only vs hosted/multi-user), and the session/cookie policy needed for that boundary.
4. The allowed connector secret provider for the selected deployment and the audit retention/privacy requirements.
5. Whether the migration, event and audit contracts are accepted as proposed; Automation queue/runtime remains separately gated.
6. Whether the shared component catalog, token aliases, WCAG/responsive criteria and overlay stack are accepted.
7. Explicit confirmation that approving these planning foundations does **not** authorize implementation or live Automation execution. Execution needs a separate owner order.

**Exit criterion:** owner approval is recorded on the Phase 2 approval card (`t_7ac0e3a2`) after architecture, RBAC/secret policy, migrations/events/audit, token/accessibility rules and component catalog are reviewed. Until then, this file is a review draft and Phase 3 remains gated.

## 11. Evidence references

- `PHASE1_DISCOVERY_DECISION_PACK.md` — baseline, route families, schema inventory, capability boundaries, risks, authority register and Phase 1 owner decisions.
- `UI_UX_REDESIGN_PLAN.md` — current design/scope reference, proposed app layers, overlay stack, Canvas/Automation separation, and the conflicting palette values/names.
- `UI_UX_PROGRESS.md` — recorded owner decisions, implementation progress, six preset IDs/names, accent and storage key.
- `frontend/src/theme/ThemeProvider.tsx` and `frontend/src/index.css` — live theme/token implementation and responsive/reduced-motion declarations reviewed read-only.
- `backend/src/database/schema.sql` — reviewed current role, ownership, audit and connector-related fields.
- `frontend/package.json`, `backend/package.json`, and `backend/src/database/migrations/` listing — stack/scripts and current migration-directory evidence.

---

*Prepared as a proposed design/architecture artifact for owner review only. No project application file, database, secret, environment, commit, or runtime was changed by this task.*
