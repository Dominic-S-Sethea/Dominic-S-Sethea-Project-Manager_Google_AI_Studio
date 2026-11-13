# ChatGPT Code-Generation Prompt — Automation Studio Persisted Workflow Builder & Node Validation (Detailed)

**Paste this entire document into ChatGPT regular chat.**
**Do NOT shorten it. Do NOT ask clarifying questions. Return complete replacement files.**

---

## 0. Your role and output contract

You are generating a production frontend patch for an existing TypeScript/React/Vite application.

- Return **complete replacement files** for every file listed in §7.
- For `frontend/src/index.css` you must return **only the new CSS rules to append** (see §7). Do not return the existing stylesheet.
- Do **not** return snippets, diffs, or "here is the changed part".
- Do **not** change any file that is not listed in §7.
- Do **not** add dependencies.
- Do **not** run git, commits, or pushes.
- Do **not** invent APIs, tables, or environment variables.
- If something in this prompt is ambiguous, choose the **most conservative** interpretation that preserves existing behavior, and state it in your final notes.

Your output must be a single response with:

1. A short summary of the approach.
2. Complete file contents, each in its own fenced code block with a header line like `FILE: frontend/src/pages/AutomationStudio.tsx`.
3. A final "Verification checklist" section.

---

## 1. Project context

**Application:** Project Manager
**Repository root:** `<workspace>`
**Stack:** React 19 + TypeScript + Vite + Tailwind; Express 4 + TypeScript backend; SQLite via `node:sqlite`; JWT in `Authorization: Bearer` header.

**Frontend conventions (VERIFIED from the current tree):**

- `frontend/src/pages/` — route pages.
- `frontend/src/hooks/` — data hooks that own API calls, optimistic state and retry/backoff (`useCanvas.ts` is the reference pattern).
- `frontend/src/types/` — shared types (`types/index.ts`, `types/canvas.ts`).
- `frontend/src/components/<domain>/` — domain components.
- `frontend/src/index.css` — the single stylesheet. Design tokens live in `:root` as `--pm-*` custom properties. New rules are **appended**.
- `frontend/src/components/layout/Icon.tsx` — the `Icon` component with a fixed `IconName` union (see Part B of the bundle). Use only names from that union.
- Auth: `getToken()` from `../hooks/useAuth` returns the JWT stored at `localStorage["pm_token"]`.
- Current project: `localStorage["pm-selected-project"]` holds the selected `project_id` (set by `ProjectSwitcher`).
- API errors: structured `{ error: string }` bodies. Status semantics: 400 invalid input, 401 unauthenticated, 403 unauthorized, 404 not found / no access, 409 conflict, 422 validation, 423 runtime disabled, 429 rate limited, 5xx server error.
- Route: `/automation` renders `frontend/src/pages/AutomationStudio.tsx`.

---

## 2. Approved design decisions (binding)

These decisions are approved by the project owner. Implement them exactly. Do not substitute your own design.

### 2.1 Runtime boundary — preview-only (AD-01 / UD-10)

Automation Studio is **preview-only**. No execution, no publish, no replay, no approvals, no live connector side effects.

- Preserve the existing controls and notices: the "Preview only · no runtime connected" notice, the disabled "Publish workflow" button, the "Draft · test only" badge, the disabled "Replay node · future" control, and the "Live run history is deliberately not simulated…" notice.
- No control may imply a functioning runtime. No `Run` / `Execute` / `Publish` / `Replay` action may become enabled.
- Do **not** call any runtime endpoint (`/test`, `/publish`, `/pause`, `/archive`, `/executions`, `/replay`, `/approvals`).
- The execution/history drawer is **out of scope** for this card (PM-P7-05 owns traces). Keep its existing markup and non-live notices unchanged.

### 2.2 API versioning (UD-11)

Every Automation API call uses the base path **`/api/v1/automation`**.

### 2.3 Node type catalog (approved — six types)

| ID | Label | Category | Side-effect class | Approval |
|---|---|---|---|---|
| `trigger` | Trigger | Start | `none` | None |
| `transform` | Transform | Logic | `none` | None |
| `decision` | Decision | Logic | `none` | None |
| `action` | Action | Actions | `write` or `send` (declared per node) | Publish-time |
| `human_gate` | Human gate | Safety | `none` (pauses a run) | Always |
| `error_handler` | Error handler | Safety | depends on recovery action | Publish-time |

- The library lists **only** these six approved types, grouped by category. No arbitrary plugin gallery.
- Type IDs are stable API identifiers; labels are UI text.
- Each library entry shows: label, kind, side-effect class, and the permission/scope it requires.

### 2.4 Node contract

Each node instance carries:

```
node_id            stable id within the version
node_type          trigger | transform | decision | action | human_gate | error_handler
name               human-readable name (required, unique within the workflow)
purpose            short description (required)
config             type-specific parameters (validated against the type schema; serialized to config_json)
input_schema       declared input contract
output_schema      declared output contract
side_effect_class  none | read_only | write | send | mixed
idempotency        key strategy for side-effecting actions
credential_ref     reference to a credential reference (never an inline secret; maps to credential_reference_id)
retry_policy       max_attempts, backoff_ms, timeout_ms
test_cases         pinned input / expected output pairs
position_x, position_y  persisted canvas position
```

Note: the approved data contract (`PHASE4_03` §4.3, implemented by PM-P7-01) names the node title column `name`; the Phase 4 node-lifecycle spec (`PHASE4_02` §3.2) called the same field `label`. Use `name`.

Type-specific `config`:

- **trigger** — `event_type`, `filter?`, `subscription_id`
- **transform** — `mapping`, `on_error` (`fail` | `pass-through`)
- **decision** — `branches: [{ label, condition, target_node_id }]`, `default_target_node_id`
- **action** — `connector_id`, `operation_id`, `parameters`, `scope`, `idempotency_key`, `timeout_ms`, `on_error`
- **human_gate** — `reviewer_policy`, `expiry_seconds`, `escalation_policy`, `change_summary_template`
- **error_handler** — `handles: [node_id | node_type | "any"]`, `recovery` (`retry` | `notify` | `create_review` | `end`), `max_retries`, `notify_target`

### 2.5 Canvas behavior

1. Nodes are connected by **directional control-flow edges** with visible input/output ports.
2. Decision nodes expose labeled branches (e.g. `YES` / `NO`) and test cases.
3. The canvas supports pan, zoom and fit. A minimap is required only if the graph exceeds the viewport; you may omit it and say so in your notes.
4. Node positions are persisted as part of the draft.
5. Invalid edges are rejected with a visible reason: `self_loop`, `duplicate`, `cross_project`, `cycle`.
6. Keyboard operable: arrow-key node navigation, `Delete`/`Backspace` removes the selection, `Escape` deselects/cancels, `Ctrl/Cmd+Z` undo (session-local).
7. A workflow state badge (`draft | test | published | paused | archived`) is always visible.
8. No `Run` / `Execute` / `Publish` control on the canvas surface.

### 2.6 Inspector

Tabs: **Settings, Input, Output, Validation, Permissions** — `role="tablist"` / `tab` / `tabpanel"`, `aria-selected`, `aria-controls`, arrow-key navigation.

| Tab | Content |
|---|---|
| Settings | Node name, purpose, kind (read-only), type-specific config fields |
| Input | Input schema, redacted sample/pinned preview |
| Output | Output schema, redacted sample/pinned preview |
| Validation | Required fields, type/range checks, edge constraints, test cases |
| Permissions | Required connector scope, credential reference (never the secret), approval requirement |

- All fields have programmatic labels; inputs are editable for authorized roles.
- Inline errors are linked with `aria-describedby`; warnings use `role="note"` or `aria-live="polite"`.
- The close button has an accessible label and returns focus to the invoker.
- Previews are redacted by default. Never render a secret.

### 2.7 Validation rules V-01 … V-23 (binding)

| # | Rule | Severity |
|---|---|---|
| V-01 | Node type exists in the approved type catalog | error |
| V-02 | Required fields present (`name`, `purpose`, type-specific config) | error |
| V-03 | `config` validates against the type schema | error |
| V-04 | `input_schema` / `output_schema` are well-formed and match the declared type contract | error |
| V-05 | Trigger: exactly one active trigger per workflow version | error |
| V-06 | Trigger: `event_type` is a supported, versioned event | error |
| V-07 | Decision: ≥2 outgoing edges, each with a visible label | error |
| V-08 | Decision: an exhaustive default branch exists | error |
| V-09 | Decision: branch conditions are deterministic and testable | error |
| V-10 | Action: `connector_id` and `operation_id` resolve to an approved connector operation | error |
| V-11 | Action: `scope` is explicit and least-privilege; no wildcard | error |
| V-12 | Action: `side_effect_class` declared; idempotency key strategy declared | error |
| V-13 | Action: `credential_ref` references a credential reference; no inline secret | error |
| V-14 | Transform: no external call, connector, or HTTP reference | error |
| V-15 | Human gate: `reviewer_policy` resolves to at least one human approver; agents excluded | error |
| V-16 | Human gate: `expiry_seconds` and `escalation_policy` set | error |
| V-17 | Error handler: recovery action is itself a scoped, approved operation | error |
| V-18 | Workflow graph is acyclic, or an explicit loop guard with max iterations exists | error |
| V-19 | Workflow has at least one terminal node | error |
| V-20 | No secret pattern in any config, sample data, or trace preview | error |
| V-21 | Actor/role has the required permission for the node's operation | warning |
| V-22 | Node has ≥1 pinned test case | warning |
| V-23 | Node has ≥1 passing test run for the current version | warning (publish gate) |

**Severity semantics**

- `error` blocks test runs and publish (both disabled in preview-only, but still surfaced).
- `warning` allows test runs; blocks publish unless explicitly acknowledged.
- Validation runs on every change (debounced), on save, and would run on test/publish (out of scope here).
- **Draft save is not blocked by validation errors** — a draft is a work in progress. Issues are surfaced inline and in a summary.
- V-21 and V-23 require server-side context. Implement them so they are evaluated only when the caller supplies a permission map / test-run summary; otherwise they return no issue. Document this.

### 2.8 Workflow lifecycle states

`draft`, `test`, `published`, `paused`, `archived` are distinct and always visible. The `rollback` transition is out of scope (PM-P7-06). State is never conveyed by color alone — pair with a text label.

### 2.9 Draft persistence (UD-13)

- Autosave drafts with a **visible status**: `Saving…`, `Saved`, `Unsaved changes`, `Save failed — Retry`.
- Reloading a draft must not silently lose work.
- Undo/redo is session-local (UD-14); it is not persisted.

### 2.10 Cross-card API contract (binding)

The approved endpoint inventory (`PHASE4_03` §9.3, under the UD-11 prefix `/api/v1/automation`) is the contract this builder consumes. The builder must not invent replacements.

**Ownership note (verified 2026-11-11):** no Phase 7 card currently implements the Automation HTTP API. PM-P7-01 is schema/migrations only and explicitly excludes routes, controllers, services and validators. This builder therefore treats the API as optional at runtime and degrades gracefully (see below). The owner must assign the API implementation card before the builder can persist for real.

Endpoints consumed:

| Method | Path | Purpose |
|---|---|---|
| GET | `/workflows?project_id=&status=` | List workflows (project-scoped) |
| POST | `/workflows` | Create a draft workflow |
| GET | `/workflows/:id` | Read a workflow with its current version |
| PUT | `/workflows/:id` | Update the draft (metadata + working definition) |
| POST | `/workflows/:id/versions` | Create an immutable version |
| GET | `/workflows/:id/versions` | List versions |

Payload contract (derived from UD-13 and the approved data model; required for whichever card implements the API):

- `POST /workflows` body: `{ project_id, name, description? }` → returns `{ workflow }`.
- `GET /workflows/:id` → `{ workflow: Workflow; version: WorkflowVersion | null }`.
- `WorkflowVersion.definition_json` is a JSON **string**; the client parses it into `WorkflowDefinition = { nodes, edges }`.
- Autosave issues `PUT /workflows/:id` with `{ name?, description?, definition, current_version_id, updated_at }`. The server persists the working definition as the draft version's `definition_json`.
- On `409`, refetch and show a conflict message. Never silently overwrite.
- If the API is unregistered (404) or disabled (423), show a safe "Automation API not connected" state with a **Retry** action. Keep the draft in memory; never present the failure as an empty state and never imply that data was saved.

---

## 3. Current code facts you must respect

### 3.1 `frontend/src/pages/AutomationStudio.tsx`
- Preview-only mock: four hardcoded nodes (`trigger`, `condition`, `notify`, `review`), decorative SVG paths, read-only inspector, static execution drawer, disabled controls.
- Replace it with the persisted builder while preserving the page shell, the preview-only controls, and the execution drawer markup.

### 3.2 `frontend/src/hooks/useCanvas.ts`
- Reference pattern: `authHeaders()`, `getResponseError()`, optimistic local state with rollback to the last confirmed server state, 1s/2s/4s retry backoff on network/429/5xx, `pendingItemIds` / `failedItemIds` indicators, `clearError()`, non-fatal error banner with **Retry**.

### 3.3 `frontend/src/components/layout/Icon.tsx`
- Fixed `IconName` union. Use only names from that union; `activity`, `filter`, `branch`, `plug`, `users`, `shield` are available and appropriate for the six node types.

### 3.4 `frontend/src/index.css`
- `--pm-*` tokens in `:root`. Existing automation classes: `.pm-automation-page`, `.pm-automation-layout`, `.pm-automation-library`, `.pm-library-title`, `.pm-library-search`, `.pm-node-letter`, `.pm-node-symbol`, `.pm-automation-canvas`, `.pm-canvas-tools`, `.pm-draft-tag`, `.pm-workflow-lines`, `.pm-flow-label`, `.pm-flow-node`, `.pm-flow-end`, `.pm-zoom`, `.pm-node-inspector`, `.pm-inspector-content`, `.pm-inspector-divider`, `.pm-inspector-warning`, `.pm-execution-drawer`, `.pm-trace`, `.pm-step-list`, `.pm-output-box`, `.pm-future-notice`, `.pm-secondary-button`, `.pm-heading-actions`, `.pm-page`, `.pm-page-heading`, `.pm-kicker`.
- Existing responsive breakpoints: 1120px, 850px, 780px.
- New rules must be appended and must reuse the existing tokens and class naming style. No new raw hex colors; use `color-mix(in srgb, var(--pm-…) …)` for tints.

### 3.5 `frontend/src/hooks/useAuth.tsx`
- `getToken()` returns the JWT or `null`.

---

## 4. Required implementation

### 4.1 `frontend/src/types/automation.ts` (new)

Define the approved contract types:

- `WorkflowStatus`, `NodeType`, `SideEffectClass`
- `WorkflowNode` (with `name`, not `label`), `WorkflowEdge`, `WorkflowDefinition`
- `WorkflowVersion` (with `definition_json: string`), `Workflow`
- `EdgeRejectionReason = "self_loop" | "duplicate" | "cross_project" | "cycle"`
- `SaveState = "idle" | "saving" | "saved" | "dirty" | "error"`
- `NODE_TYPE_CATALOG`: a typed constant describing the six approved types — id, label, category, description, icon name, side-effect class, approval requirement, config field schema (key, label, input type, required, options), and a `defaultConfig()` factory.
- `WORKFLOW_STATUS_LABELS`: the five statuses with human labels.

### 4.2 `frontend/src/lib/automationValidation.ts` (new)

A **pure** module — no React, no DOM, no fetch. Exports:

```ts
export type ValidationSeverity = "error" | "warning";
export interface ValidationIssue {
  rule: string;                 // "V-01" … "V-23"
  severity: ValidationSeverity;
  message: string;
  node_id?: string;
  field?: string;
}
export interface ValidationContext {
  permittedScopes?: string[];   // for V-21
  testedNodeIds?: string[];     // for V-23
}
export function validateWorkflow(
  definition: WorkflowDefinition,
  context?: ValidationContext,
): ValidationIssue[];
```

- Implement V-01 … V-23 exactly as specified in §2.7.
- Cycle detection (V-18) must use an explicit graph traversal.
- Secret-pattern detection (V-20) must check string values in configs, schemas and test cases against common secret patterns; never print the matched secret in the message.
- Return issues sorted by severity (`error` first), then rule id.

### 4.3 `frontend/src/hooks/useAutomationWorkflow.ts` (new)

Owns all draft state and API access. Follow the `useCanvas.ts` patterns (optimistic local state, rollback to the last confirmed server state, retry/backoff, visible pending/failed state, `clearError`, safe error messages).

```ts
export interface UseAutomationWorkflowReturn {
  workflow: Workflow | null;
  definition: WorkflowDefinition;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  saveState: SaveState;
  issues: ValidationIssue[];
  loading: boolean;
  error: string | null;
  loadWorkflow: (workflowId: string) => Promise<void>;
  createDraft: (projectId: string, name: string) => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  addNode: (nodeType: NodeType, x: number, y: number) => void;
  updateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  moveNode: (nodeId: string, x: number, y: number) => void;
  deleteNode: (nodeId: string) => void;
  addEdge: (fromNodeId: string, toNodeId: string, branchLabel?: string) => { ok: true } | { ok: false; reason: EdgeRejectionReason };
  deleteEdge: (edgeId: string) => void;
  undo: () => void;
  redo: () => void;
  saveNow: () => Promise<void>;
  clearError: () => void;
}
```

Behavior:

- On mount: read `workflow_id` from the URL query (`?workflow=`); if present, `loadWorkflow`. Otherwise list draft workflows for the current project (`GET /workflows?project_id=…&status=draft`); if one exists, load it; if none, show the empty state with a **Create draft workflow** action.
- Autosave: debounced (≥800 ms) `PUT /workflows/:id`. Set `saveState` to `saving`, then `saved`; on failure set `error` + `saveState: "error"`, roll the working definition back to the last confirmed server state, keep the user's edit visible and offer **Retry**.
- Validation: run `validateWorkflow` on every definition change (debounced) and on save; expose `issues`.
- Undo/redo: session-local history of definition snapshots (nodes + edges), capped (e.g. last 50).
- All mutations update local state immediately (optimistic), then schedule autosave.

### 4.4 `frontend/src/components/automation/NodeLibrary.tsx` (new)

- Real `<input type="search">` with an accessible label; filters the catalog by label/description/kind.
- Six approved entries grouped by category, each showing label, kind, side-effect class and required permission.
- Clicking an entry arms "add node" mode; clicking the canvas adds the node at that position.
- Keyboard: when an entry is focused and activated with Enter/Space, add the node at the current viewport center (or a sensible default offset) so the flow is keyboard-complete.
- Empty search results show "No nodes match your search".
- Show the approval/permission state for entries that require a credential or scope.

### 4.5 `frontend/src/components/automation/WorkflowCanvas.tsx` (new)

- Renders nodes at their persisted positions and directional edges with visible ports.
- Decision nodes render their branch labels on the outgoing edges.
- Pan (pointer drag on the background), zoom (buttons + wheel), fit.
- Selection: click to select; arrow keys move the selection; Delete/Backspace deletes the selection; Escape deselects; Ctrl/Cmd+Z undo.
- Edge creation: pointer interaction from an output port to an input port; rejected edges show a visible reason and are not added.
- Renders the workflow state badge and the draft/save status.
- Empty state: "No nodes yet — add a trigger".
- Validation summary (counts + top issues) with a details disclosure.
- All canvas controls have accessible names; the canvas surface is `role="application"` with hidden keyboard instructions and an `aria-live` selection status region.

### 4.6 `frontend/src/components/automation/NodeInspector.tsx` (new)

- Five tabs with the ARIA tab pattern and arrow-key navigation.
- Settings: name, purpose, kind (read-only), and a generic config form rendered from the type's field schema.
- Input / Output: schema + redacted sample/pinned preview.
- Validation: the issues for the selected node (and workflow-level issues), each with rule id, severity and message; errors linked to fields with `aria-describedby`.
- Permissions: required connector scope, credential reference (never the secret), approval requirement.
- Close button with an accessible label and focus return.

### 4.7 `frontend/src/pages/AutomationStudio.tsx` (replacement)

- Keep the page shell, heading, kicker, the "Preview only · no runtime connected" notice, the disabled "Publish workflow" button, and the "Draft · test only" badge.
- Keep the execution/history drawer markup and its non-live notices unchanged (PM-P7-05 owns it).
- Compose: `NodeLibrary` + `WorkflowCanvas` + `NodeInspector`, driven by `useAutomationWorkflow`.
- Empty, loading and error states per region; never present a failure as an empty state.

### 4.8 `frontend/src/index.css` (append-only)

Append new rules only (do not modify existing rules):

- Node ports, edges, selection and focus states.
- Validation issue styling (error/warning), draft/save status chip.
- Inspector form controls and tab pattern.
- Library add-mode affordance.
- Responsive behavior at ≤1120px / ≤850px / ≤780px: no horizontal page scroll at 375px; regions stack; drawer full-width ≤780px.
- Respect `prefers-reduced-motion`.

---

## 5. Constraints

- Do **not** add dependencies.
- Do **not** use `any` unless the existing file already does; keep TypeScript strict-mode compatible (`noUncheckedIndexedAccess` is on).
- Do **not** store or render secrets. `credential_ref` is a reference only.
- Do **not** call runtime endpoints (`/test`, `/publish`, `/executions`, `/replay`, `/approvals`).
- Do **not** change any file not listed in §7.
- Do **not** modify the existing automation CSS rules; append only.
- Use only the `--pm-*` design tokens for color; no new raw hex colors.
- Use only icon names present in the `IconName` union.
- Keep the preview-only boundary intact.
- No hardcoded sample data presented as live; keep the explicit non-live notices.

---

## 6. Acceptance criteria

1. `npm run typecheck --prefix frontend` exits 0.
2. `npm run build --prefix frontend` exits 0.
3. The node library lists exactly the six approved types with working search and an empty state.
4. Nodes can be added from the library to the canvas (pointer and keyboard), moved, selected and deleted; positions persist in the draft.
5. Edges are directional with visible ports; decision branches are labeled; invalid edges (`self_loop`, `duplicate`, `cross_project`, `cycle`) are rejected with a visible reason.
6. The inspector exposes Settings, Input, Output, Validation and Permissions with the ARIA tab pattern and programmatic labels.
7. Validation implements V-01 … V-23 with the specified severities and surfaces issues inline and in a summary.
8. Draft autosave shows a visible status and survives reload without silent loss; failures show a safe message and a Retry action.
9. The workflow state badge and the preview-only boundary are preserved; no runtime call is made.
10. The execution/history drawer and all non-live notices are unchanged.
11. No new dependencies; no file outside §7 changed; CSS changes are append-only.
12. Responsive: no horizontal page scroll at 375px.

---

## 7. Files to return (complete replacement code)

Return complete replacement code for:

1. `frontend/src/types/automation.ts` (new)
2. `frontend/src/lib/automationValidation.ts` (new)
3. `frontend/src/hooks/useAutomationWorkflow.ts` (new)
4. `frontend/src/components/automation/NodeLibrary.tsx` (new)
5. `frontend/src/components/automation/WorkflowCanvas.tsx` (new)
6. `frontend/src/components/automation/NodeInspector.tsx` (new)
7. `frontend/src/pages/AutomationStudio.tsx` (replacement)
8. `frontend/src/index.css` — **append-only**: return only the new rules, in a block headed `FILE: frontend/src/index.css (APPEND ONLY)`.

If you believe another file must change, **stop and explain why** instead of changing it.

---

## 8. Final response format

Return exactly:

```text
## Approach
<2-5 bullets>

## Files
FILE: frontend/src/types/automation.ts
<complete file>

FILE: frontend/src/lib/automationValidation.ts
<complete file>

FILE: frontend/src/hooks/useAutomationWorkflow.ts
<complete file>

FILE: frontend/src/components/automation/NodeLibrary.tsx
<complete file>

FILE: frontend/src/components/automation/WorkflowCanvas.tsx
<complete file>

FILE: frontend/src/components/automation/NodeInspector.tsx
<complete file>

FILE: frontend/src/pages/AutomationStudio.tsx
<complete file>

FILE: frontend/src/index.css (APPEND ONLY)
<new rules only>

## Verification checklist
- [ ] npm run typecheck --prefix frontend
- [ ] npm run build --prefix frontend
- [ ] Six approved node types, searchable library
- [ ] Add/move/select/delete nodes; positions persist
- [ ] Directional edges with ports; branch labels; invalid edges rejected
- [ ] Inspector five tabs with ARIA tab pattern
- [ ] Validation V-01…V-23 with severities
- [ ] Autosave status visible; reload-safe; retry on failure
- [ ] Preview-only boundary preserved; no runtime calls
- [ ] Execution drawer unchanged
- [ ] No new dependencies; CSS append-only
```

Do not include any other commentary outside that structure.
