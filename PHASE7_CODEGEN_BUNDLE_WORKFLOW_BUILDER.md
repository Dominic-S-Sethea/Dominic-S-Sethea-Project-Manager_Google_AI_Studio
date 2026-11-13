# Project Manager — Phase 7 PM-P7-04: Prompt + Complete Current Source

**Paste this entire document into ChatGPT regular chat.**  
It contains the approved implementation prompt (Part A) and the exact current source files it refers to (Part B).

---

## How to use this document

1. Read the prompt in Part A.
2. Read the complete current source files in Part B.
3. Generate complete replacement files exactly as the prompt specifies.
4. Do not invent APIs, types, tables, or files.
5. Do not change files the prompt does not list.

---

## Part A — Implementation Prompt

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

---

## Part B — Complete Current Source

Every block below is the authoritative current code, copied verbatim from the working tree. SHA-256 values are recorded after each block for verification.

### SOURCE: `frontend/src/pages/AutomationStudio.tsx`
```text
import { useState } from "react";
import { Icon } from "../components/layout/Icon";

type NodeId = "trigger" | "condition" | "notify" | "review";
type InspectorTab = "settings" | "input" | "output";

const nodeInfo: Record<NodeId, { title: string; kind: string; description: string; input: string; output: string }> = {
  trigger: { title: "Task status changed", kind: "Trigger \u00b7 Project Manager", description: "Begins when a confirmed task event is received.", input: "event: task.updated\nstatus: blocked", output: "items: 1" },
  condition: { title: "Dependency check", kind: "Decision \u00b7 Branch", description: "Routes a task only when its blocking status is confirmed.", input: "task_id: sample-042\nstatus: blocked\nblocked_by: sample-028", output: "branch: YES\nitems: 1" },
  notify: { title: "Notify task owner", kind: "Action \u00b7 Connector", description: "Would send a scoped message to the task owner.", input: "target: assignee\nmessage: dependency context", output: "delivery: queued" },
  review: { title: "Request human review", kind: "Human gate \u00b7 Approval", description: "Pauses any consequential action until a reviewer decides.", input: "reviewer: project owner\nchange: status update", output: "state: awaiting_review" },
};

export default function AutomationStudio() {
  const [selected, setSelected] = useState<NodeId>("condition");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("settings");
  const [executionTab, setExecutionTab] = useState<"history" | "failures">("history");
  const info = nodeInfo[selected];

  return (
    <div className="pm-page pm-automation-page">
      <header className="pm-page-heading">
        <div>
          <div className="pm-kicker">AUTOMATION STUDIO \u00b7 FUTURE MODULE</div>
          <h1>Make automation inspectable before it becomes executable.</h1>
          <p>Project Canvas maps work. Automation Studio would execute approved workflow definitions.</p>
        </div>
        <div className="pm-heading-actions">
          <span className="pm-future-notice">Preview only \u00b7 no runtime connected</span>
          <button className="pm-secondary-button" disabled>Publish workflow</button>
        </div>
      </header>

      <div className="pm-automation-layout">
        <aside className="pm-automation-library">
          <div className="pm-library-title">Node library</div>
          <div className="pm-library-search">
            <Icon name="search" size={13} />
            Search approved nodes
          </div>
          <section>
            <small>Start</small>
            <button onClick={() => setSelected("trigger")}>
              <Icon name="automation" size={14} />
              Task event
            </button>
          </section>
          <section>
            <small>Logic</small>
            <button onClick={() => setSelected("condition")}>
              <span className="pm-node-letter warning">\u25c7</span>
              Condition
            </button>
          </section>
          <section>
            <small>Actions</small>
            <button onClick={() => setSelected("notify")}>
              <span className="pm-node-letter success">\u2197</span>
              Connector action
            </button>
            <button onClick={() => setSelected("review")}>
              <span className="pm-node-letter success">\u2713</span>
              Human gate
            </button>
          </section>
          <section>
            <small>Safety</small>
            <button>
              <span className="pm-node-letter danger">!</span>
              Error handler
            </button>
          </section>
        </aside>

        <section className="pm-automation-canvas">
          <div className="pm-canvas-tools">
            <button className="is-active">Select</button>
            <button>+ Node</button>
            <button>Fit</button>
            <button>Sample data</button>
          </div>
          <span className="pm-draft-tag">Draft \u00b7 test only</span>
          <svg className="pm-workflow-lines" viewBox="0 0 950 500" preserveAspectRatio="none" aria-hidden="true">
            <path d="M222 225 C275 225 280 225 340 225" />
            <path className="yes" d="M505 225 C585 225 580 130 650 130" />
            <path className="no" d="M505 225 C585 225 580 335 650 335" />
            <path className="yes" d="M815 130 C860 130 855 225 890 225" />
            <path className="no" d="M815 335 C860 335 855 225 890 225" />
          </svg>
          <span className="pm-flow-label yes">YES</span>
          <span className="pm-flow-label no">NO</span>
          <button className={`pm-flow-node trigger${selected === "trigger" ? " is-selected" : ""}`} onClick={() => setSelected("trigger")}>
            <span className="pm-node-symbol">\u21bb</span>
            <span><strong>Task status changed</strong><small>Trigger \u00b7 Project Manager</small></span>
            <em>event: task.updated</em>
          </button>
          <button className={`pm-flow-node condition${selected === "condition" ? " is-selected" : ""}`} onClick={() => setSelected("condition")}>
            <span className="pm-node-symbol warning">\u25c7</span>
            <span><strong>Dependency check</strong><small>Decision \u00b7 Branch</small></span>
            <em>status = blocked</em>
          </button>
          <button className={`pm-flow-node notify${selected === "notify" ? " is-selected" : ""}`} onClick={() => setSelected("notify")}>
            <span className="pm-node-symbol success">\u2197</span>
            <span><strong>Notify task owner</strong><small>Action \u00b7 Connector</small></span>
            <em>target: assignee</em>
          </button>
          <button className={`pm-flow-node review${selected === "review" ? " is-selected" : ""}`} onClick={() => setSelected("review")}>
            <span className="pm-node-symbol success">\u2713</span>
            <span><strong>Request human review</strong><small>Human gate \u00b7 Approval</small></span>
            <em>reviewer: owner</em>
          </button>
          <div className="pm-flow-end">
            <span>\u00b7</span>
            <strong>Record</strong>
            <small>Result</small>
          </div>
          <span className="pm-zoom">\u2212 &nbsp;100%&nbsp; +</span>
        </section>

        <aside className="pm-node-inspector">
          <header>
            <div>
              <small>Node inspector</small>
              <h2>{info.title}</h2>
            </div>
            <Icon name="close" size={15} />
          </header>
          <nav>
            <button className={inspectorTab === "settings" ? "is-active" : ""} onClick={() => setInspectorTab("settings")}>
              Settings
            </button>
            <button className={inspectorTab === "input" ? "is-active" : ""} onClick={() => setInspectorTab("input")}>
              Input
            </button>
            <button className={inspectorTab === "output" ? "is-active" : ""} onClick={() => setInspectorTab("output")}>
              Output
            </button>
          </nav>
          <div className="pm-inspector-content">
            {inspectorTab === "settings" && (
              <>
                <label>
                  Node name
                  <input value={info.title} readOnly />
                </label>
                <label>
                  Purpose
                  <textarea value={info.description} readOnly rows={3} />
                </label>
                <div className="pm-inspector-divider" />
                <h3>Node kind</h3>
                <pre>{info.kind}</pre>
                <p className="pm-inspector-warning">
                  Sample data only. A live builder needs a versioned execution
                  API, redacted logs, connector permission scopes, safe replay
                  rules, and owner-approved publishing.
                </p>
              </>
            )}
            {inspectorTab === "input" && (
              <>
                <h3>Sample input preview</h3>
                <pre>{info.input}</pre>
                <div className="pm-inspector-divider" />
                <h3>Input schema</h3>
                <pre>{`{
  "task_id": "string",
  "status": "blocked | in_progress | done",
  "blocked_by": "string (optional)"
}`}</pre>
                <p className="pm-inspector-warning">
                  Input values are illustrative. Live execution requires a
                  connected task event source.
                </p>
              </>
            )}
            {inspectorTab === "output" && (
              <>
                <h3>Sample output preview</h3>
                <pre>{info.output}</pre>
                <div className="pm-inspector-divider" />
                <h3>Output schema</h3>
                <pre>{`{
  "branch": "YES | NO",
  "items": "number",
  "delivery": "queued | sent | failed"
}`}</pre>
                <p className="pm-inspector-warning">
                  Output values are illustrative. Live execution requires a
                  connected runtime.
                </p>
              </>
            )}
          </div>
        </aside>

        <section className="pm-execution-drawer">
          <aside>
            <header>Execution history</header>
            <button className={executionTab === "history" ? "is-active" : ""} onClick={() => setExecutionTab("history")}>
              <i />Sample test preview<span>not run</span>
            </button>
            <button className={executionTab === "failures" ? "is-active" : ""} onClick={() => setExecutionTab("failures")}>
              <i />Past executions<span>\u2014</span>
            </button>
            <button onClick={() => setExecutionTab("failures")}>
              <i />Failures / replay<span>\u2014</span>
            </button>
          </aside>
          <div className="pm-trace">
            <header>
              <div>
                <strong>Step inspector</strong>
                <span>Sample data</span>
              </div>
              <button disabled>Replay node \u00b7 future</button>
            </header>
            <div className="pm-trace-grid">
              <div className="pm-step-list">
                <span className="is-done"><i />Task status changed</span>
                <span className="is-active"><i />Dependency check</span>
                <span><i />Notify task owner</span>
                <span><i />Human review</span>
              </div>
              <div className="pm-output-box">
                <div>
                  <span>Selected node I/O</span>
                  <span>JSON \u00b7 Sample</span>
                </div>
                <pre>{'{ "task_id": "sample-042", "status": "blocked", "branch": "YES" }'}</pre>
                <p>Live run history is deliberately not simulated. It must be powered by a separately approved backend runtime.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
```

SHA-256: `0fedc7e686990308501303b5ab9b8915a5674f2f58b7cbad983d90d073851468`

### SOURCE: `frontend/src/hooks/useCanvas.ts`
```text
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  CanvasItem,
  CanvasConnection,
  CanvasWithItems,
  CanvasTool,
} from "../types/canvas";
import type { Task } from "../types";
import { getToken } from "./useAuth";

export interface PanPoint {
  x: number;
  y: number;
}

type ConnectionUpdates = Partial<
  Pick<CanvasConnection, "connection_type" | "style">
>;

interface ApiError extends Error {
  status?: number;
}

interface UseCanvasReturn {
  canvas: CanvasWithItems | null;
  canvasId: string | null;
  items: CanvasItem[];
  connections: CanvasConnection[];
  selectedItemId: string | null;
  selectedConnectionId: string | null;
  tool: CanvasTool;
  pan: PanPoint;
  zoom: number;
  loading: boolean;
  error: string | null;
  tasks: Task[];
  enteringItemIds: Set<string>;
  deletingItemIds: Set<string>;
  pendingItemIds: Set<string>;
  failedItemIds: Set<string>;
  refetchTasks: () => Promise<void>;
  setItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>;
  setConnections: React.Dispatch<
    React.SetStateAction<CanvasConnection[]>
  >;
  addItem: (
    item: Partial<CanvasItem> & {
      item_type: CanvasItem["item_type"];
    },
  ) => Promise<CanvasItem | null>;
  updateItem: (
    itemId: string,
    updates: Partial<CanvasItem>,
  ) => Promise<CanvasItem | null>;
  updateItemLocal: (
    itemId: string,
    updates: Partial<CanvasItem>,
  ) => void;
  deleteItem: (itemId: string) => Promise<void>;
  addConnection: (
    fromItemId: string,
    toItemId: string,
    connectionType?: "line" | "arrow",
    style?: string | null,
  ) => Promise<CanvasConnection | null>;
  updateConnection: (
    connectionId: string,
    updates: ConnectionUpdates,
  ) => Promise<CanvasConnection | null>;
  deleteConnection: (connectionId: string) => Promise<void>;
  selectItem: (itemId: string | null) => void;
  selectConnection: (connectionId: string | null) => void;
  setTool: (tool: CanvasTool) => void;
  setPan: (pan: PanPoint) => void;
  setZoom: (zoom: number) => void;
  saveItem: (
    itemId: string,
    updates: Partial<CanvasItem>,
  ) => Promise<CanvasItem | null>;
  clearError: () => void;
  refetch: () => Promise<void>;
}

function authHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const token = getToken();

  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getErrorMessage(
  body: unknown,
  fallback: string,
): string {
  if (
    body !== null &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string" &&
    body.error.trim()
  ) {
    return body.error;
  }

  if (
    body !== null &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string" &&
    body.message.trim()
  ) {
    return body.message;
  }

  return fallback;
}

async function getResponseError(
  response: Response,
  fallback: string,
): Promise<ApiError> {
  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    // The response may not contain JSON. Preserve the status-based fallback.
  }

  const error = new Error(
    getErrorMessage(body, fallback),
  ) as ApiError;

  error.status = response.status;
  return error;
}

function isRetryableError(error: unknown): boolean {
  if (
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return (
      error.status === 429 ||
      (error.status >= 500 && error.status <= 599)
    );
  }

  // Fetch network failures are normally TypeErrors. Unknown transport
  // failures are treated as transient, while HTTP errors are not.
  return error instanceof TypeError;
}

function getErrorStatus(error: unknown): number | undefined {
  if (
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return undefined;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function readViewport(
  canvasId: string,
): { pan: PanPoint; zoom: number } | null {
  try {
    const raw = window.localStorage.getItem(
      `pm-canvas-view-${canvasId}`,
    );

    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      !("pan" in parsed) ||
      !("zoom" in parsed)
    ) {
      return null;
    }

    const savedPan = parsed.pan;
    const savedZoom = parsed.zoom;

    if (
      savedPan === null ||
      typeof savedPan !== "object" ||
      !("x" in savedPan) ||
      !("y" in savedPan) ||
      typeof savedPan.x !== "number" ||
      typeof savedPan.y !== "number" ||
      !Number.isFinite(savedPan.x) ||
      !Number.isFinite(savedPan.y) ||
      typeof savedZoom !== "number" ||
      !Number.isFinite(savedZoom) ||
      savedZoom < 0.2 ||
      savedZoom > 4
    ) {
      return null;
    }

    return {
      pan: { x: savedPan.x, y: savedPan.y },
      zoom: savedZoom,
    };
  } catch {
    return null;
  }
}

export function useCanvas(
  canvasId: string | undefined,
): UseCanvasReturn {
  const [canvas, setCanvas] =
    useState<CanvasWithItems | null>(null);
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [connections, setConnections] =
    useState<CanvasConnection[]>([]);
  const [selectedItemId, setSelectedItemId] =
    useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] =
    useState<string | null>(null);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [pan, setPan] = useState<PanPoint>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [enteringItemIds, setEnteringItemIds] =
    useState<Set<string>>(new Set());
  const [deletingItemIds, setDeletingItemIds] =
    useState<Set<string>>(new Set());
  const [pendingItemIds, setPendingItemIds] =
    useState<Set<string>>(new Set());
  const [failedItemIds, setFailedItemIds] =
    useState<Set<string>>(new Set());

  const lastServerItems = useRef<CanvasItem[]>([]);
  const lastServerConnections =
    useRef<CanvasConnection[]>([]);
  const restoredViewportFor = useRef<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchTasks = useCallback(
    async (projectId: string | null) => {
      if (!projectId) {
        setTasks([]);
        return;
      }

      try {
        const response = await fetch(
          `/api/tasks?project_id=${encodeURIComponent(projectId)}`,
          { headers: authHeaders() },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch tasks");
        }

        const data: { tasks?: Task[] } =
          await response.json();

        setTasks(data.tasks || []);
      } catch {
        setTasks([]);
      }
    },
    [],
  );

  const fetchCanvas = useCallback(async () => {
    if (!canvasId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/canvas/${canvasId}`,
        { headers: authHeaders() },
      );

      if (!response.ok) {
        throw await getResponseError(
          response,
          "Failed to fetch canvas",
        );
      }

      const data: { canvas: CanvasWithItems } =
        await response.json();
      const fetchedCanvas = data.canvas;
      const fetchedItems = fetchedCanvas.items || [];
      const fetchedConnections =
        fetchedCanvas.connections || [];

      setCanvas(fetchedCanvas);
      setItems(fetchedItems);
      setConnections(fetchedConnections);
      lastServerItems.current = fetchedItems;
      lastServerConnections.current = fetchedConnections;

      setPendingItemIds(new Set());
      setFailedItemIds(new Set());

      if (fetchedCanvas.project_id) {
        await fetchTasks(fetchedCanvas.project_id);
      } else {
        setTasks([]);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to fetch canvas",
      );
    } finally {
      setLoading(false);
    }
  }, [canvasId, fetchTasks]);

  useEffect(() => {
    void fetchCanvas();
  }, [fetchCanvas]);

  useEffect(() => {
    if (!canvasId || canvas?.canvas_id !== canvasId) {
      return;
    }

    if (restoredViewportFor.current === canvasId) {
      return;
    }

    restoredViewportFor.current = canvasId;

    const saved = readViewport(canvasId);

    if (saved) {
      setPan(saved.pan);
      setZoom(saved.zoom);
    } else {
      setPan({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [canvasId, canvas]);

  useEffect(() => {
    if (
      !canvasId ||
      canvas?.canvas_id !== canvasId ||
      restoredViewportFor.current !== canvasId
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          `pm-canvas-view-${canvasId}`,
          JSON.stringify({ pan, zoom }),
        );
      } catch {
        // Storage can be unavailable or full; viewport interaction remains usable.
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canvasId, canvas, pan, zoom]);

  const addItem = useCallback(
    async (
      item: Partial<CanvasItem> & {
        item_type: CanvasItem["item_type"];
      },
    ) => {
      if (!canvasId) return null;

      try {
        const response = await fetch(
          `/api/canvas/${canvasId}/items`,
          {
            method: "POST",
            headers: authHeaders({
              "Content-Type": "application/json",
            }),
            body: JSON.stringify(item),
          },
        );

        if (!response.ok) {
          throw await getResponseError(
            response,
            "Failed to add item",
          );
        }

        const data: { item: CanvasItem } =
          await response.json();
        const created = data.item;

        setItems((previous) => [...previous, created]);
        lastServerItems.current = [
          ...lastServerItems.current,
          created,
        ];

        setEnteringItemIds((previous) => {
          const next = new Set(previous);
          next.add(created.item_id);
          return next;
        });

        window.setTimeout(() => {
          setEnteringItemIds((previous) => {
            const next = new Set(previous);
            next.delete(created.item_id);
            return next;
          });
        }, 400);

        return created;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to add item",
        );
        return null;
      }
    },
    [canvasId],
  );

  const updateItemLocal = useCallback(
    (itemId: string, updates: Partial<CanvasItem>) => {
      setItems((previous) =>
        previous.map((item) =>
          item.item_id === itemId
            ? { ...item, ...updates }
            : item,
        ),
      );
    },
    [],
  );

  const removePendingItem = useCallback((itemId: string) => {
    setPendingItemIds((previous) => {
      const next = new Set(previous);
      next.delete(itemId);
      return next;
    });
  }, []);

  const persistItem = useCallback(
    async (
      itemId: string,
      updates: Partial<CanvasItem>,
    ): Promise<CanvasItem | null> => {
      setPendingItemIds((previous) => {
        const next = new Set(previous);
        next.add(itemId);
        return next;
      });

      setFailedItemIds((previous) => {
        const next = new Set(previous);
        next.delete(itemId);
        return next;
      });

      let lastError: unknown = null;
      let updatedItem: CanvasItem | null = null;

      for (let attempt = 0; attempt <= 3; attempt += 1) {
        try {
          const response = await fetch(
            `/api/canvas/items/${itemId}`,
            {
              method: "PUT",
              headers: authHeaders({
                "Content-Type": "application/json",
              }),
              body: JSON.stringify(updates),
            },
          );

          if (!response.ok) {
            throw await getResponseError(
              response,
              "Failed to update item",
            );
          }

          const data: { item: CanvasItem } =
            await response.json();
          updatedItem = data.item;
          break;
        } catch (caught) {
          lastError = caught;
          const status = getErrorStatus(caught);

          if (status === 401 || status === 403) {
            removePendingItem(itemId);
            setFailedItemIds((previous) => {
              const next = new Set(previous);
              next.delete(itemId);
              return next;
            });

            await fetchCanvas();
            setError(
              status === 401
                ? "Your session has expired. Sign in again to save changes."
                : "You no longer have permission to edit this canvas.",
            );
            return null;
          }

          if (status === 404) {
            setItems((previous) =>
              previous.filter(
                (item) => item.item_id !== itemId,
              ),
            );
            setConnections((previous) =>
              previous.filter(
                (connection) =>
                  connection.from_item_id !== itemId &&
                  connection.to_item_id !== itemId,
              ),
            );
            lastServerItems.current =
              lastServerItems.current.filter(
                (item) => item.item_id !== itemId,
              );
            lastServerConnections.current =
              lastServerConnections.current.filter(
                (connection) =>
                  connection.from_item_id !== itemId &&
                  connection.to_item_id !== itemId,
              );
            removePendingItem(itemId);
            setFailedItemIds((previous) => {
              const next = new Set(previous);
              next.delete(itemId);
              return next;
            });
            setError(
              "This canvas item no longer exists. The item was removed.",
            );
            return null;
          }

          if (
            !isRetryableError(caught) ||
            attempt === 3
          ) {
            break;
          }

          await wait(1000 * 2 ** attempt);
        }
      }

      if (updatedItem) {
        setItems((previous) =>
          previous.map((item) =>
            item.item_id === itemId ? updatedItem! : item,
          ),
        );

        lastServerItems.current =
          lastServerItems.current.map((item) =>
            item.item_id === itemId ? updatedItem! : item,
          );

        removePendingItem(itemId);
        setFailedItemIds((previous) => {
          const next = new Set(previous);
          next.delete(itemId);
          return next;
        });

        return updatedItem;
      }

      const serverItem = lastServerItems.current.find(
        (item) => item.item_id === itemId,
      );

      setItems((previous) => {
        if (!serverItem) {
          return previous.filter(
            (item) => item.item_id !== itemId,
          );
        }

        return previous.map((item) =>
          item.item_id === itemId ? serverItem : item,
        );
      });

      removePendingItem(itemId);
      setFailedItemIds((previous) => {
        const next = new Set(previous);
        next.add(itemId);
        return next;
      });

      setError(
        lastError instanceof Error
          ? lastError.message
          : "Failed to update item. Your changes were reverted.",
      );

      return null;
    },
    [fetchCanvas, removePendingItem],
  );

  const updateItem = useCallback(
    async (
      itemId: string,
      updates: Partial<CanvasItem>,
    ) => {
      updateItemLocal(itemId, updates);
      return persistItem(itemId, updates);
    },
    [updateItemLocal, persistItem],
  );

  const saveItem = useCallback(
    async (
      itemId: string,
      updates: Partial<CanvasItem>,
    ) => persistItem(itemId, updates),
    [persistItem],
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      setDeletingItemIds((previous) => {
        const next = new Set(previous);
        next.add(itemId);
        return next;
      });

      try {
        const response = await fetch(
          `/api/canvas/items/${itemId}`,
          {
            method: "DELETE",
            headers: authHeaders(),
          },
        );

        if (!response.ok) {
          throw await getResponseError(
            response,
            "Failed to delete item",
          );
        }
      } catch (caught) {
        setDeletingItemIds((previous) => {
          const next = new Set(previous);
          next.delete(itemId);
          return next;
        });

        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to delete item",
        );
        return;
      }

      await wait(220);

      setItems((previous) =>
        previous.filter((item) => item.item_id !== itemId),
      );
      setConnections((previous) =>
        previous.filter(
          (connection) =>
            connection.from_item_id !== itemId &&
            connection.to_item_id !== itemId,
        ),
      );

      lastServerItems.current =
        lastServerItems.current.filter(
          (item) => item.item_id !== itemId,
        );
      lastServerConnections.current =
        lastServerConnections.current.filter(
          (connection) =>
            connection.from_item_id !== itemId &&
            connection.to_item_id !== itemId,
        );

      if (selectedItemId === itemId) {
        setSelectedItemId(null);
      }

      setDeletingItemIds((previous) => {
        const next = new Set(previous);
        next.delete(itemId);
        return next;
      });
    },
    [selectedItemId],
  );

  const addConnection = useCallback(
    async (
      fromItemId: string,
      toItemId: string,
      connectionType: "line" | "arrow" = "line",
      style: string | null = null,
    ) => {
      if (!canvasId) return null;

      if (
        fromItemId === toItemId ||
        connections.some(
          (connection) =>
            connection.from_item_id === fromItemId &&
            connection.to_item_id === toItemId,
        )
      ) {
        setError(
          "A connection between these items already exists or is invalid.",
        );
        return null;
      }

      try {
        const response = await fetch(
          `/api/canvas/${canvasId}/connections`,
          {
            method: "POST",
            headers: authHeaders({
              "Content-Type": "application/json",
            }),
            body: JSON.stringify({
              from_item_id: fromItemId,
              to_item_id: toItemId,
              connection_type: connectionType,
              style,
            }),
          },
        );

        if (!response.ok) {
          throw await getResponseError(
            response,
            "Failed to add connection",
          );
        }

        const data: { connection: CanvasConnection } =
          await response.json();
        const created = data.connection;

        setConnections((previous) => [
          ...previous,
          created,
        ]);
        lastServerConnections.current = [
          ...lastServerConnections.current,
          created,
        ];

        return created;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to add connection",
        );
        return null;
      }
    },
    [canvasId, connections],
  );

  const updateConnection = useCallback(
    async (
      connectionId: string,
      updates: ConnectionUpdates,
    ): Promise<CanvasConnection | null> => {
      const previousConnection =
        lastServerConnections.current.find(
          (connection) =>
            connection.connection_id === connectionId,
        );

      try {
        const response = await fetch(
          `/api/canvas/connections/${connectionId}`,
          {
            method: "PUT",
            headers: authHeaders({
              "Content-Type": "application/json",
            }),
            body: JSON.stringify(updates),
          },
        );

        if (!response.ok) {
          throw await getResponseError(
            response,
            "Failed to update connection",
          );
        }

        const data: { connection: CanvasConnection } =
          await response.json();
        const updated = data.connection;

        setConnections((previous) =>
          previous.map((connection) =>
            connection.connection_id === connectionId
              ? updated
              : connection,
          ),
        );
        lastServerConnections.current =
          lastServerConnections.current.map((connection) =>
            connection.connection_id === connectionId
              ? updated
              : connection,
          );

        return updated;
      } catch (caught) {
        if (previousConnection) {
          setConnections((previous) =>
            previous.map((connection) =>
              connection.connection_id === connectionId
                ? previousConnection
                : connection,
            ),
          );
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to update connection",
        );
        return null;
      }
    },
    [],
  );

  const deleteConnection = useCallback(
    async (connectionId: string) => {
      try {
        const response = await fetch(
          `/api/canvas/connections/${connectionId}`,
          {
            method: "DELETE",
            headers: authHeaders(),
          },
        );

        if (!response.ok) {
          throw await getResponseError(
            response,
            "Failed to delete connection",
          );
        }

        setConnections((previous) =>
          previous.filter(
            (connection) =>
              connection.connection_id !== connectionId,
          ),
        );
        lastServerConnections.current =
          lastServerConnections.current.filter(
            (connection) =>
              connection.connection_id !== connectionId,
          );

        if (selectedConnectionId === connectionId) {
          setSelectedConnectionId(null);
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to delete connection",
        );
      }
    },
    [selectedConnectionId],
  );

  const selectItem = useCallback((itemId: string | null) => {
    setSelectedItemId(itemId);

    if (itemId !== null) {
      setSelectedConnectionId(null);
    }
  }, []);

  const selectConnection = useCallback(
    (connectionId: string | null) => {
      setSelectedConnectionId(connectionId);

      if (connectionId !== null) {
        setSelectedItemId(null);
      }
    },
    [],
  );

  const refetch = useCallback(async () => {
    await fetchCanvas();
  }, [fetchCanvas]);

  const refetchTasks = useCallback(async () => {
    if (canvas?.project_id) {
      await fetchTasks(canvas.project_id);
    }
  }, [canvas?.project_id, fetchTasks]);

  return {
    canvas,
    canvasId: canvasId || null,
    items,
    connections,
    selectedItemId,
    selectedConnectionId,
    tool,
    pan,
    zoom,
    loading,
    error,
    tasks,
    enteringItemIds,
    deletingItemIds,
    pendingItemIds,
    failedItemIds,
    setItems,
    setConnections,
    addItem,
    updateItem,
    updateItemLocal,
    deleteItem,
    addConnection,
    updateConnection,
    deleteConnection,
    selectItem,
    selectConnection,
    setTool,
    setPan,
    setZoom,
    saveItem,
    clearError,
    refetch,
    refetchTasks,
  };
}
```

SHA-256: `fcf56ae82c3ebc6697d2c14b042f3270b80b17113cc46145b76c9833a388715c`

### SOURCE: `backend/src/types/automation.ts`
```text
/**
 * Persisted Automation domain contracts.
 *
 * This module contains types only. It does not implement workflow execution,
 * state transitions, permissions, or connector interactions.
 */

export type WorkflowStatus =
  | "draft"
  | "test"
  | "published"
  | "paused"
  | "archived";

export type WorkflowNodeType =
  | "trigger"
  | "transform"
  | "decision"
  | "action"
  | "human_gate"
  | "error_handler";

export type EnvironmentMode = "preview" | "test" | "live";

export type ExecutionStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timed_out"
  | "created"
  | "paused"
  | "rolled_back"
  | "error";

export type ExecutionTriggerType =
  | "event"
  | "manual"
  | "schedule"
  | "retry"
  | "replay";

export type TriggerActorType = "user" | "agent" | "system" | "automation";

export type ExecutionErrorClass = "retryable" | "permanent";

export type ExecutionStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled";

export type ApprovalType =
  | "publish"
  | "execute"
  | "connector_action"
  | "replay_side_effect";

export type ApprovalStatus =
  | "pending"
  | "granted"
  | "rejected"
  | "expired"
  | "cancelled";

export type ApprovalRequesterType = "user" | "agent" | "automation";

export interface Workflow {
  workflow_id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  current_version_id: string | null;
  created_by: string;
  created_by_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowVersion {
  version_id: string;
  workflow_id: string;
  version_number: number;
  definition_json: string;
  definition_hash: string;
  schema_version: number;
  is_reviewed: number;
  review_note: string | null;
  created_by: string;
  created_at: string;
  published_at: string | null;
}

export interface WorkflowNode {
  node_id: string;
  version_id: string;
  node_type: WorkflowNodeType;
  name: string;
  config_json: string;
  credential_reference_id: string | null;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface WorkflowEdge {
  edge_id: string;
  version_id: string;
  from_node_id: string;
  to_node_id: string;
  branch_label: string | null;
  condition_expr: string | null;
}

export interface Environment {
  environment_id: string;
  project_id: string;
  name: string;
  mode: EnvironmentMode;
  is_live: number;
  created_by: string;
  created_at: string;
}

export interface Execution {
  execution_id: string;
  workflow_id: string;
  version_id: string;
  environment_id: string;
  status: ExecutionStatus;
  trigger_type: ExecutionTriggerType;
  trigger_actor_type: TriggerActorType;
  trigger_actor_id: string | null;
  idempotency_key: string;
  trace_id: string;
  approval_id: string | null;
  attempt_count: number;
  error_class: ExecutionErrorClass | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancel_requested_by: string | null;
  cancel_requested_at: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  preview: number;
}

export interface ExecutionStep {
  step_id: string;
  execution_id: string;
  node_id: string;
  node_type: string;
  attempt: number;
  status: ExecutionStepStatus;
  input_json: string | null;
  output_json: string | null;
  credential_reference_id: string | null;
  idempotency_key: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  error_class: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Approval {
  approval_id: string;
  execution_id: string | null;
  step_id: string | null;
  workflow_id: string;
  version_id: string | null;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  requested_by_type: ApprovalRequesterType;
  requested_by_id: string;
  requested_at: string;
  reviewer_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  expires_at: string;
  idempotency_key: string;
  created_at: string;
}

export interface CredentialReference {
  credential_reference_id: string;
  project_id: string;
  connector_id: string | null;
  environment_id: string | null;
  reference: string;
  provider_scopes: string;
  created_by: string;
  created_at: string;
  rotated_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_verified_at: string | null;
}

export interface IdempotencyKey {
  key: string;
  request_hash: string;
  response_snapshot: string;
  created_at: string;
  expires_at: string;
}
```

SHA-256: `00c68498aea0e72d32cd94f1648c9e16caed44396db0251b39812de2b4fad539`

### SOURCE: `frontend/src/types/canvas.ts`
```text
// Canvas Type Definitions

export interface Canvas {
  canvas_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasItem {
  item_id: string;
  canvas_id: string;
  item_type:
    | "task"
    | "square"
    | "rectangle"
    | "circle"
    | "diamond"
    | "triangle"
    | "line"
    | "arrow"
    | "text";
  task_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string | null;
  style: string | null;
  z_index: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasConnection {
  connection_id: string;
  canvas_id: string;
  from_item_id: string;
  to_item_id: string;
  connection_type: "line" | "arrow";
  style: string | null;
  created_at: string;
}

export type CanvasConnectionUpdates = Partial<
  Pick<CanvasConnection, "connection_type" | "style">
>;

export interface CanvasWithItems extends Canvas {
  items: CanvasItem[];
  connections: CanvasConnection[];
}

export interface CanvasItemStyle {
  shape?: "square" | "rectangle" | "circle" | "diamond" | "triangle";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  color?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
  opacity?: number;
  borderRadius?: number;
}

export type CanvasTool =
  | "select"
  | "square"
  | "line"
  | "arrow"
  | "text"
  | "task";

export interface DragState {
  isDragging: boolean;
  itemId: string | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface PanState {
  isPanning: boolean;
  startX: number;
  startY: number;
  translateX: number;
  translateY: number;
}
```

SHA-256: `b7b857f9c89e1550ac74dcff18cf1142693215c44a1bf12ff1c3317ca449f531`

### SOURCE: `frontend/src/hooks/useAuth.tsx`
```text
import { createContext, useContext, useState, type ReactNode } from "react";

interface User { user_id: string; username: string; email: string; role: string; status: string; created_at: string; }
interface AuthContextType { user: User | null; login: (user: User, token?: string) => void; logout: () => void; }
const AuthContext = createContext<AuthContextType | null>(null);

function readStoredUser(): User | null {
  try { const stored = localStorage.getItem("pm_user"); return stored ? JSON.parse(stored) as User : null; } catch { localStorage.removeItem("pm_user"); return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const login = (nextUser: User, token?: string) => { setUser(nextUser); localStorage.setItem("pm_user", JSON.stringify(nextUser)); if (token) localStorage.setItem("pm_token", token); };
  const logout = () => { setUser(null); localStorage.removeItem("pm_user"); localStorage.removeItem("pm_token"); };
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}
export function getToken(): string | null { return localStorage.getItem("pm_token"); }
export function useAuth() { const ctx = useContext(AuthContext); if (!ctx) throw new Error("useAuth must be used within AuthProvider"); return ctx; }
```

SHA-256: `68927f24c284f99ff9dac6fe96e57c10614f6129fec04ada0ce3280760a151d4`

### SOURCE: `frontend/src/components/layout/Icon.tsx`
```text
export type IconName =
  | "overview" | "tasks" | "projects" | "review" | "activity" | "canvas" | "automation"
  | "git" | "integrations" | "people" | "appearance" | "search" | "plus" | "chevron"
  | "command" | "settings" | "close" | "spark" | "theme" | "logout" | "arrow"
  | "grid" | "list" | "flow" | "plug" | "users" | "bell" | "check" | "branch"
  | "play" | "history" | "shield" | "filter" | "code" | "palette";

interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
}

export function Icon({ name, className, size = 16 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (name) {
    case "overview":
    case "grid":
      return <svg {...common}><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/></svg>;
    case "tasks":
    case "list":
      return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>;
    case "projects":
    case "canvas":
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 14h7"/></svg>;
    case "review":
      return <svg {...common}><path d="M4 5h16v12H8l-4 3V5Z"/><path d="m9 11 2 2 4-4"/></svg>;
    case "activity":
      return <svg {...common}><path d="M4 12h3l2-6 4 12 2-6h5"/></svg>;
    case "automation":
    case "flow":
      return <svg {...common}><circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="m7 11 10-5M7 13l10 5"/></svg>;
    case "git":
    case "code":
    case "command":
      return <svg {...common}><path d="M8 5 3 12l5 7M16 5l5 7-5 7M14 4l-4 16"/></svg>;
    case "integrations":
    case "plug":
      return <svg {...common}><path d="M8 12a4 4 0 0 1 4-4h2a4 4 0 0 1 0 8h-2M16 12a4 4 0 0 1-4 4H10a4 4 0 0 1 0-8h2"/></svg>;
    case "people":
    case "users":
      return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M17 15c2.4.4 4 2 4 4"/></svg>;
    case "appearance":
    case "theme":
    case "palette":
      return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.6 4.6 6 6M18 18l1.4 1.4M3 12h2M19 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case "chevron":
      return <svg {...common}><path d="m7 10 5 5 5-5"/></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.8v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5.7v-2.8h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L7 8.2l2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h2.8v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z"/></svg>;
    case "close":
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18"/></svg>;
    case "spark":
      return <svg {...common}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/></svg>;
    case "logout":
      return <svg {...common}><path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6"/></svg>;
    case "arrow":
      return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "bell":
      return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>;
    case "check":
      return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>;
    case "branch":
      return <svg {...common}><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M8 6h8M12 8v8"/></svg>;
    case "play":
      return <svg {...common}><path d="m9 5 10 7-10 7V5Z"/></svg>;
    case "history":
      return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 7v5l3 2"/></svg>;
    case "shield":
      return <svg {...common}><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/></svg>;
    case "filter":
      return <svg {...common}><path d="M4 6h16M7 12h10m-7 6h4"/></svg>;
    default:
      return null;
  }
}
```

SHA-256: `361803fa23cf395e50e06730d3c82faa4869f785e4e05657aba2ba26a41d1fe8`

### SOURCE: `frontend/src/main.tsx`
```text
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./theme/ThemeProvider";
import { AppShell } from "./components/layout/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ReviewQueue from "./pages/ReviewQueue";
import AutomationStudio from "./pages/AutomationStudio";
import Appearance from "./pages/Appearance";
import Users from "./pages/Users";
import GitCommits from "./pages/GitCommits";
import Canvas from "./pages/Canvas";
import CanvasList from "./pages/CanvasList";
import ImportExport from "./pages/ImportExport";
import Connectors from "./pages/Connectors";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } } });

function ProtectedWorkspace() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function Root() {
  const { user } = useAuth();
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<ProtectedWorkspace />}>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/review" element={<ReviewQueue />} />
      <Route path="/automation" element={<AutomationStudio />} />
      <Route path="/appearance" element={<Appearance />} />
      <Route path="/users" element={<Users />} />
      <Route path="/git-commits" element={<GitCommits />} />
      <Route path="/import-export" element={<ImportExport />} />
      <Route path="/connectors" element={<Connectors />} />
      <Route path="/canvas" element={<Canvas />} />
      <Route path="/canvas/:id" element={<Canvas />} />
      <Route path="/canvases" element={<CanvasList />} />
      <Route path="/canvases/:projectId" element={<CanvasList />} />
    </Route>
    <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
  </Routes>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><ThemeProvider><Root /></ThemeProvider></AuthProvider></BrowserRouter></QueryClientProvider></React.StrictMode>);
```

SHA-256: `ee68b6b2c9288a2f6625c04689cedd7dd314ea9fde7ccc12f280a12754e6013d`

### SOURCE: `frontend/src/index.css`
```text
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  --pm-canvas: #090b0f;
  --pm-canvas-deep: #050609;
  --pm-rail: rgba(12, 15, 21, 0.74);
  --pm-glass: rgba(21, 27, 37, 0.56);
  --pm-glass-strong: rgba(28, 35, 47, 0.74);
  --pm-glass-soft: rgba(255, 255, 255, 0.045);
  --pm-glass-hover: rgba(255, 255, 255, 0.082);
  --pm-border: rgba(211, 228, 255, 0.13);
  --pm-border-strong: rgba(215, 234, 255, 0.22);
  --pm-text: #f4f8ff;
  --pm-text-secondary: #aebcd0;
  --pm-text-muted: #738197;
  --pm-accent: #54C8FF;
  --pm-accent-rgb: 84, 200, 255;
  --pm-accent-ink: #06131A;
  --pm-accent-soft: rgba(var(--pm-accent-rgb), 0.13);
  --pm-accent-glow: rgba(var(--pm-accent-rgb), 0.26);
  --pm-success: #73d6a3;
  --pm-warning: #f2be6e;
  --pm-danger: #f0838c;
  --pm-info: #95b9ff;
  --pm-radius-sm: 8px;
  --pm-radius: 14px;
  --pm-radius-lg: 20px;
  --pm-shadow: 0 18px 44px rgba(0, 0, 0, 0.28), inset 0 1px rgba(255, 255, 255, 0.055);
  --pm-shadow-float: 0 26px 70px rgba(0, 0, 0, 0.5), inset 0 1px rgba(255, 255, 255, 0.07);
  --pm-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --color-bg: var(--pm-canvas);
  --color-surface: var(--pm-glass);
  --color-primary: var(--pm-accent);
  --color-accent: var(--pm-accent);
  --color-text: var(--pm-text);
  --color-muted: var(--pm-text-secondary);
  --color-border: var(--pm-border);
  --color-error: var(--pm-danger);
  --color-success: var(--pm-success);
  --color-warning: var(--pm-warning);
}

html[data-pm-theme="violet"] {
  --pm-canvas: #0c0a12;
  --pm-canvas-deep: #07050a;
  --pm-rail: rgba(17, 12, 25, 0.76);
  --pm-glass: rgba(37, 27, 49, 0.57);
  --pm-glass-strong: rgba(45, 33, 60, 0.75);
  --pm-border: rgba(232, 217, 255, 0.14);
  --pm-border-strong: rgba(232, 217, 255, 0.24);
  --pm-text: #f9f3ff;
  --pm-text-secondary: #c2b5d0;
  --pm-text-muted: #877d96;
}

html[data-pm-theme="aurora"] {
  --pm-canvas: #07100e;
  --pm-canvas-deep: #040806;
  --pm-rail: rgba(9, 23, 18, 0.78);
  --pm-glass: rgba(18, 44, 35, 0.58);
  --pm-glass-strong: rgba(24, 56, 44, 0.76);
  --pm-border: rgba(208, 255, 229, 0.14);
  --pm-border-strong: rgba(208, 255, 229, 0.24);
  --pm-text: #effff7;
  --pm-text-secondary: #b2d0bf;
  --pm-text-muted: #789787;
}

html[data-pm-theme="ember"] {
  --pm-canvas: #100c08;
  --pm-canvas-deep: #080604;
  --pm-rail: rgba(26, 17, 10, 0.78);
  --pm-glass: rgba(50, 34, 21, 0.56);
  --pm-glass-strong: rgba(62, 42, 27, 0.75);
  --pm-border: rgba(255, 232, 207, 0.14);
  --pm-border-strong: rgba(255, 232, 207, 0.23);
  --pm-text: #fff7ee;
  --pm-text-secondary: #d1bda8;
  --pm-text-muted: #987f68;
}

html[data-pm-theme="emerald"] {
  --pm-canvas: #08100d;
  --pm-canvas-deep: #050806;
  --pm-rail: rgba(9, 19, 15, 0.77);
  --pm-glass: rgba(19, 41, 32, 0.58);
  --pm-glass-strong: rgba(25, 51, 39, 0.75);
  --pm-border: rgba(214, 255, 235, 0.14);
  --pm-border-strong: rgba(214, 255, 235, 0.23);
  --pm-text: #f1fff8;
  --pm-text-secondary: #b7d0c2;
  --pm-text-muted: #7a9788;
}

* { box-sizing: border-box; }
html, body, #root { min-height: 100%; }
body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at 84% -14%, rgba(var(--pm-accent-rgb), 0.19), transparent 33rem),
    radial-gradient(circle at -8% 105%, rgba(var(--pm-accent-rgb), 0.09), transparent 30rem),
    linear-gradient(145deg, var(--pm-canvas-deep), var(--pm-canvas) 48%, var(--pm-canvas-deep));
  color: var(--pm-text);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

button, input, textarea, select { font: inherit; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.55; }
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, a:focus-visible {
  outline: 2px solid var(--pm-accent);
  outline-offset: 2px;
}

.pm-app-shell {
  display: grid;
  grid-template-columns: 238px minmax(0, 1fr);
  min-height: 100vh;
  color: var(--pm-text);
}

.pm-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 19px 13px 14px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--pm-rail) 86%, transparent), color-mix(in srgb, var(--pm-rail) 94%, var(--pm-canvas-deep)));
  border-right: 1px solid var(--pm-border);
  backdrop-filter: blur(28px) saturate(145%);
  -webkit-backdrop-filter: blur(28px) saturate(145%);
  z-index: 20;
}

.pm-brand { display: flex; align-items: center; gap: 10px; padding: 0 8px; font-weight: 670; letter-spacing: -0.025em; }
.pm-brand-mark {
  display: grid; place-items: center; width: 29px; height: 29px; border-radius: 9px;
  color: var(--pm-accent); background: linear-gradient(135deg, rgba(var(--pm-accent-rgb), .23), rgba(255,255,255,.03));
  border: 1px solid rgba(var(--pm-accent-rgb), .44); box-shadow: 0 8px 23px rgba(var(--pm-accent-rgb), .16), inset 0 1px rgba(255,255,255,.22);
  font-size: 13px; font-weight: 800;
}
.pm-brand span { font-size: 13px; }
.pm-workspace-switcher {
  display: flex; align-items: center; gap: 9px; padding: 9px;
  border-radius: var(--pm-radius-sm); border: 1px solid var(--pm-border); background: rgba(255,255,255,.035);
  color: var(--pm-text);
}
.pm-workspace-icon { width: 27px; height: 27px; display: grid; place-items: center; border-radius: 7px; background: var(--pm-glass-strong); color: var(--pm-accent); border: 1px solid var(--pm-border); font: 700 9px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-workspace-switcher small { display: block; color: var(--pm-text-muted); font-size: 8px; letter-spacing: .11em; line-height: 1; }
.pm-workspace-switcher strong { display: block; font-size: 10px; font-weight: 580; margin-top: 4px; }
.pm-workspace-switcher .pm-chevron { margin-left: auto; color: var(--pm-text-muted); }
.pm-nav-group { display: grid; gap: 3px; }
.pm-nav-label { color: var(--pm-text-muted); font-size: 8px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; padding: 0 9px; margin-bottom: 3px; }
.pm-nav-link {
  width: 100%; height: 35px; display: flex; align-items: center; gap: 9px; padding: 0 9px; border: 0; border-radius: 7px;
  color: var(--pm-text-secondary); text-decoration: none; background: transparent; font-size: 10px; text-align: left; position: relative;
  transition: color 140ms ease, background 160ms var(--pm-spring), transform 160ms var(--pm-spring);
}
.pm-nav-link:hover { background: rgba(255,255,255,.055); color: var(--pm-text); }
.pm-nav-link:active { transform: scale(.985); }
.pm-nav-link svg { width: 15px; height: 15px; color: var(--pm-text-muted); flex: none; }
.pm-nav-link.is-active { color: var(--pm-text); background: linear-gradient(90deg, rgba(var(--pm-accent-rgb), .18), rgba(var(--pm-accent-rgb), .06)); box-shadow: inset 2px 0 var(--pm-accent); }
.pm-nav-link.is-active svg { color: var(--pm-accent); }
.pm-nav-link .pm-nav-count { margin-left: auto; color: var(--pm-text-muted); font: 9px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-nav-link .pm-nav-count.is-accent { color: var(--pm-accent); background: var(--pm-accent-soft); border-radius: 4px; padding: 2px 5px; }
.pm-nav-tag { margin-left: auto; color: var(--pm-text-muted); border: 1px solid var(--pm-border); border-radius: 4px; padding: 2px 4px; font: 7px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .04em; }
.pm-profile { margin-top: auto; display: flex; align-items: center; gap: 9px; padding: 13px 6px 0; border-top: 1px solid var(--pm-border); }
.pm-avatar { width: 29px; height: 29px; display: grid; place-items: center; border-radius: 50%; color: var(--pm-accent); border: 1px solid var(--pm-border-strong); background: var(--pm-glass-strong); font: 700 9px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-profile-name { display: block; font-size: 10px; font-weight: 600; }
.pm-profile-role { display: block; margin-top: 2px; color: var(--pm-text-muted); font-size: 8px; }
.pm-profile-more { margin-left: auto; color: var(--pm-text-muted); font-size: 16px; }

.pm-main { min-width: 0; display: grid; grid-template-rows: 58px minmax(0, 1fr); }
.pm-topbar {
  position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 15px;
  padding: 0 26px; border-bottom: 1px solid var(--pm-border); background: rgba(7, 9, 13, .46);
  backdrop-filter: blur(28px) saturate(145%); -webkit-backdrop-filter: blur(28px) saturate(145%);
}
.pm-breadcrumb { color: var(--pm-text-muted); font-size: 10px; }
.pm-breadcrumb strong { color: var(--pm-text-secondary); font-weight: 590; }
.pm-top-actions { display: flex; align-items: center; gap: 9px; }
.pm-command-trigger { height: 31px; width: min(318px, 34vw); display: flex; align-items: center; gap: 8px; padding: 0 9px; border: 1px solid var(--pm-border); border-radius: 7px; background: rgba(255,255,255,.045); color: var(--pm-text-muted); font-size: 9px; text-align: left; }
.pm-command-trigger:hover { border-color: var(--pm-border-strong); background: rgba(255,255,255,.075); }
.pm-command-trigger svg { width: 14px; height: 14px; }
.pm-keycap { margin-left: auto; border: 1px solid var(--pm-border); border-radius: 4px; padding: 2px 4px; color: var(--pm-text-muted); font: 8px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-icon-button { position: relative; width: 32px; height: 32px; padding: 0; display: grid; place-items: center; border: 1px solid var(--pm-border); border-radius: 7px; background: rgba(255,255,255,.04); color: var(--pm-text-secondary); }
.pm-icon-button:hover { background: rgba(255,255,255,.08); color: var(--pm-text); }
.pm-notification-dot { width: 6px; height: 6px; border-radius: 50%; position: absolute; right: 7px; top: 7px; background: var(--pm-warning); box-shadow: 0 0 0 2px var(--pm-canvas); }
.pm-theme-menu-trigger { height: 31px; display: flex; align-items: center; gap: 7px; padding: 0 9px; border: 1px solid var(--pm-border); border-radius: 7px; background: rgba(255,255,255,.04); color: var(--pm-text-secondary); font-size: 9px; }
.pm-theme-menu-trigger:hover { background: rgba(255,255,255,.08); }
.pm-theme-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pm-accent); box-shadow: 0 0 0 3px var(--pm-accent-soft), 0 0 14px var(--pm-accent-glow); }
.pm-page-host { min-width: 0; overflow: auto; }
.pm-page { max-width: 1480px; margin: 0 auto; padding: 28px 28px 40px; }
.pm-page-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin: 0 0 20px; }
.pm-page-heading h1 { margin: 0; font-size: 25px; letter-spacing: -0.045em; line-height: 1.08; font-weight: 660; }
.pm-page-heading p { margin: 6px 0 0; color: var(--pm-text-secondary); font-size: 10px; }
.pm-kicker { color: var(--pm-accent); font-size: 8px; line-height: 1; font-weight: 700; letter-spacing: .13em; margin: 0 0 8px; }
.pm-glass-panel {
  background: linear-gradient(138deg, rgba(255,255,255,.105), rgba(255,255,255,.03) 24%, rgba(255,255,255,.018) 65%), var(--pm-glass);
  border: 1px solid var(--pm-border); border-radius: var(--pm-radius); box-shadow: var(--pm-shadow);
  backdrop-filter: blur(22px) saturate(142%); -webkit-backdrop-filter: blur(22px) saturate(142%);
}
.pm-glass-panel:hover { border-color: color-mix(in srgb, var(--pm-border-strong) 86%, var(--pm-accent) 14%); }
.pm-panel-heading { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 17px 18px 14px; border-bottom: 1px solid var(--pm-border); }
.pm-panel-heading h2 { margin: 0; font-size: 13px; letter-spacing: -.025em; font-weight: 640; }
.pm-panel-heading p { color: var(--pm-text-secondary); font-size: 9px; line-height: 1.5; margin: 5px 0 0; }
.pm-button { min-height: 32px; padding: 0 11px; border-radius: 7px; border: 1px solid var(--pm-border); color: var(--pm-text-secondary); background: rgba(255,255,255,.04); font-size: 9px; font-weight: 590; transition: background 150ms ease, border-color 150ms ease, transform 150ms var(--pm-spring); }
.pm-button:hover { color: var(--pm-text); border-color: var(--pm-border-strong); background: rgba(255,255,255,.085); }
.pm-button:active { transform: scale(.98); }
.pm-button-primary { background: linear-gradient(135deg, color-mix(in srgb, var(--pm-accent) 94%, white 6%), var(--pm-accent)); border-color: color-mix(in srgb, var(--pm-accent) 78%, white 22%); color: var(--pm-accent-ink); box-shadow: 0 8px 22px var(--pm-accent-glow), inset 0 1px rgba(255,255,255,.35); }
.pm-button-primary:hover { color: var(--pm-accent-ink); background: var(--pm-accent); filter: brightness(1.05); }
.pm-button-secondary { background: rgba(255,255,255,.06); }
.pm-button-quiet { border-color: transparent; background: transparent; color: var(--pm-text-muted); }
.pm-button-quiet:hover { background: rgba(255,255,255,.055); }
.pm-empty { padding: 42px 18px; color: var(--pm-text-secondary); font-size: 10px; text-align: center; }
.pm-inline-feedback { color: var(--pm-accent); font-size: 9px; margin: 11px 18px 16px; }

/* Theme controls */
.pm-theme-customizer { overflow: hidden; }
.pm-theme-current { flex: none; display: inline-flex; align-items: center; gap: 7px; color: var(--pm-text-secondary); font-size: 8px; border: 1px solid var(--pm-border); border-radius: 999px; padding: 5px 8px; background: rgba(255,255,255,.035); }
.pm-theme-current i { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 0 3px var(--pm-accent-soft); }
.pm-theme-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 9px; padding: 15px 18px; }
.pm-theme-choice { min-width: 0; padding: 9px; text-align: left; border: 1px solid var(--pm-border); border-radius: 9px; background: rgba(255,255,255,.025); color: var(--pm-text); transition: transform 160ms var(--pm-spring), border-color 160ms ease, background 160ms ease; }
.pm-theme-choice:hover { transform: translateY(-2px); background: rgba(255,255,255,.07); border-color: var(--pm-border-strong); }
.pm-theme-choice.is-selected { border-color: var(--pm-accent); box-shadow: 0 0 0 2px var(--pm-accent-soft); }
.pm-theme-choice strong { font-size: 9px; font-weight: 620; display: block; margin-top: 8px; }
.pm-theme-choice small { color: var(--pm-text-muted); display: block; margin-top: 3px; font-size: 7px; line-height: 1.35; }
.pm-theme-swatch { height: 45px; display: grid; grid-template-columns: 31% 1fr; gap: 4px; padding: 5px; border-radius: 5px; overflow: hidden; background: linear-gradient(145deg, #06070a, #15191f); border: 1px solid rgba(255,255,255,.08); }
.pm-theme-swatch i { background: rgba(255,255,255,.07); border-radius: 2px; }
.pm-theme-swatch b { background: rgba(255,255,255,.1); border-radius: 2px; }
.pm-theme-swatch em { background: var(--theme-choice-accent); opacity: .9; border-radius: 2px; }
.pm-custom-accent { display: grid; grid-template-columns: minmax(180px, .8fr) minmax(400px, 1.2fr); align-items: center; gap: 16px; padding: 15px 18px; border-top: 1px solid var(--pm-border); background: rgba(0,0,0,.08); }
.pm-field-label { display: block; color: var(--pm-text); font-size: 9px; font-weight: 620; }
.pm-custom-accent p { color: var(--pm-text-muted); font-size: 8px; line-height: 1.5; margin: 4px 0 0; }
.pm-accent-controls { display: flex; align-items: center; gap: 7px; }
.pm-color-input { width: 34px; height: 32px; border: 1px solid var(--pm-border); border-radius: 7px; overflow: hidden; background: var(--pm-glass-strong); cursor: pointer; }
.pm-color-input input { width: 100%; height: 100%; padding: 3px; border: 0; background: transparent; cursor: pointer; }
.pm-hex-input { width: 112px; height: 32px; padding: 0 9px; border: 1px solid var(--pm-border); border-radius: 7px; background: rgba(0,0,0,.16); color: var(--pm-text); font: 9px ui-monospace, SFMono-Regular, Consolas, monospace; text-transform: uppercase; }
.pm-hex-input::placeholder { color: var(--pm-text-muted); }

/* Legacy application surfaces inherit the glass system while routes are rebuilt. */
.pm-app-shell .min-h-screen { min-height: 0 !important; background: transparent !important; }
.pm-app-shell .bg-white,
.pm-app-shell .dark\:bg-slate-800,
.pm-app-shell .dark\:bg-slate-900,
.pm-app-shell .bg-slate-50 {
  background: var(--pm-glass) !important;
  border-color: var(--pm-border) !important;
}
.pm-app-shell .border-slate-200,
.pm-app-shell .dark\:border-slate-700,
.pm-app-shell .dark\:border-slate-600,
.pm-app-shell .border-slate-300 { border-color: var(--pm-border) !important; }
.pm-app-shell .text-slate-900,
.pm-app-shell .dark\:text-slate-100,
.pm-app-shell .text-slate-800,
.pm-app-shell .dark\:text-slate-200 { color: var(--pm-text) !important; }
.pm-app-shell .text-slate-700,
.pm-app-shell .dark\:text-slate-300,
.pm-app-shell .text-slate-600,
.pm-app-shell .dark\:text-slate-400 { color: var(--pm-text-secondary) !important; }
.pm-app-shell .text-slate-500,
.pm-app-shell .dark\:text-slate-500,
.pm-app-shell .text-slate-400 { color: var(--pm-text-muted) !important; }
.pm-app-shell .bg-blue-600,
.pm-app-shell .dark\:bg-blue-500 { background: var(--pm-accent) !important; color: var(--pm-accent-ink) !important; border-color: var(--pm-accent) !important; }
.pm-app-shell .text-blue-600,
.pm-app-shell .dark\:text-blue-400 { color: var(--pm-accent) !important; }
.pm-app-shell .shadow,
.pm-app-shell .shadow-lg { box-shadow: var(--pm-shadow) !important; }
.pm-app-shell input:not([type="color"]),
.pm-app-shell textarea,
.pm-app-shell select { background: rgba(5, 7, 11, .31) !important; border-color: var(--pm-border) !important; color: var(--pm-text) !important; }
.pm-app-shell input::placeholder,
.pm-app-shell textarea::placeholder { color: var(--pm-text-muted) !important; }

/* Canvas-specific motion remains available under the new token system. */
.canvas-spring { transition-timing-function: var(--pm-spring); }
@keyframes canvas-pop-in { from { opacity: 0; transform: scale(.82); } to { opacity: 1; transform: scale(1); } }
@keyframes canvas-pop-out { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(.78); } }
@keyframes canvas-pulse-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(var(--pm-accent-rgb), .54); } 50% { box-shadow: 0 0 0 10px rgba(var(--pm-accent-rgb), 0); } }
@keyframes canvas-skeleton-pulse { 0%,100% { opacity:.35; } 50% { opacity:.85; } }
@keyframes canvas-draw-line { from { stroke-dashoffset: var(--dash-len, 1000); } to { stroke-dashoffset: 0; } }
.canvas-item { transition: transform 200ms var(--pm-spring), box-shadow 200ms var(--pm-spring), border-color 200ms var(--pm-spring); }
.canvas-item-inner { width: 100%; height: 100%; }
.canvas-item-enter .canvas-item-inner { animation: canvas-pop-in .32s var(--pm-spring) both; }
.canvas-item-exit .canvas-item-inner { animation: canvas-pop-out .2s var(--pm-spring) both; }
.canvas-item-exit { pointer-events: none; }
.canvas-item-selected { animation: canvas-pulse-glow 1.6s ease-in-out infinite; }
.canvas-item-dragging { z-index: 9999 !important; }
.canvas-skeleton { animation: canvas-skeleton-pulse 1.2s ease-in-out infinite; background-color: rgba(255,255,255,.13); }

@media (max-width: 1120px) {
  .pm-app-shell { grid-template-columns: 204px minmax(0, 1fr); }
  .pm-sidebar { padding-left: 10px; padding-right: 10px; }
  .pm-topbar { padding: 0 18px; }
  .pm-page { padding: 23px 18px 32px; }
  .pm-theme-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .pm-custom-accent { grid-template-columns: 1fr; }
}

@media (max-width: 780px) {
  body { min-width: 0; }
  .pm-app-shell { display: block; }
  .pm-sidebar { position: static; height: auto; display: grid; grid-template-columns: auto 1fr; gap: 12px; padding: 12px; border-right: 0; border-bottom: 1px solid var(--pm-border); }
  .pm-brand { grid-column: 1; }
  .pm-workspace-switcher { grid-column: 2; }
  .pm-sidebar .pm-nav-group { display: none; }
  .pm-profile { display: none; }
  .pm-topbar { padding: 0 12px; height: 52px; }
  .pm-command-trigger { width: 165px; }
  .pm-theme-menu-trigger span { display: none; }
  .pm-page { padding: 18px 12px 26px; }
  .pm-page-heading { align-items: flex-start; flex-direction: column; }
  .pm-theme-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 12px; }
  .pm-custom-accent { padding: 12px; }
  .pm-accent-controls { flex-wrap: wrap; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: 0.01ms !important; }
}


/* ── Rebuilt workspace surfaces ─────────────────────────────── */
.pm-main-column { min-width: 0; display: grid; grid-template-rows: 58px minmax(0, 1fr); }
.pm-main-column .pm-topbar { padding: 0 24px; }
.pm-topbar-actions { display: flex; align-items: center; gap: 8px; }
.pm-workspace { min-width: 0; overflow: auto; }
.pm-nav-item { width: 100%; height: 35px; display: flex; align-items: center; gap: 9px; padding: 0 9px; border: 0; border-radius: 7px; color: var(--pm-text-secondary); text-decoration: none; background: transparent; font-size: 10px; text-align: left; position: relative; transition: color 140ms ease, background 160ms var(--pm-spring), transform 160ms var(--pm-spring); }
.pm-nav-item:hover { background: rgba(255,255,255,.055); color: var(--pm-text); }
.pm-nav-item:active { transform: scale(.985); }
.pm-nav-item svg { flex: none; color: var(--pm-text-muted); }
.pm-nav-item.is-active { color: var(--pm-text); background: linear-gradient(90deg, rgba(var(--pm-accent-rgb), .18), rgba(var(--pm-accent-rgb), .06)); box-shadow: inset 2px 0 var(--pm-accent); }
.pm-nav-item.is-active svg { color: var(--pm-accent); }
.pm-nav-badge { margin-left: auto; padding: 2px 5px; border-radius: 4px; color: var(--pm-accent); background: var(--pm-accent-soft); font: 8px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-future-tag { margin-left: auto; color: var(--pm-text-muted); border: 1px solid var(--pm-border); border-radius: 4px; padding: 2px 4px; font: 7px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .04em; }
.pm-workspace-glyph { width: 27px; height: 27px; flex: none; display: grid; place-items: center; border-radius: 7px; background: var(--pm-glass-strong); color: var(--pm-accent); border: 1px solid var(--pm-border); font: 700 9px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-workspace-switcher > svg { margin-left: auto; color: var(--pm-text-muted); }
.pm-user-menu { margin-top: auto; padding: 13px 6px 0; border-top: 1px solid var(--pm-border); display: flex; align-items: center; gap: 8px; }
.pm-user-avatar { width: 29px; height: 29px; flex: none; display: grid; place-items: center; border-radius: 50%; color: var(--pm-accent); border: 1px solid var(--pm-border-strong); background: var(--pm-glass-strong); font: 700 9px ui-monospace, SFMono-Regular, Consolas, monospace; }
.pm-user-menu strong { display:block; font-size:10px; font-weight:600; }
.pm-user-menu small { display:block; margin-top:2px; color:var(--pm-text-muted); font-size:8px; text-transform:capitalize; }
.pm-user-logout { margin-left:auto; width:28px; height:28px; opacity:.7; }
.pm-primary-button, .pm-secondary-button { min-height:32px; border-radius:7px; padding:0 10px; display:inline-flex; align-items:center; justify-content:center; gap:6px; font-size:9px; font-weight:600; transition: transform 150ms var(--pm-spring), background 150ms ease, border-color 150ms ease; }
.pm-primary-button { background:linear-gradient(135deg, color-mix(in srgb,var(--pm-accent) 93%,white 7%),var(--pm-accent)); border:1px solid color-mix(in srgb,var(--pm-accent) 78%,white 22%); color:var(--pm-accent-ink); box-shadow:0 8px 23px var(--pm-accent-glow),inset 0 1px rgba(255,255,255,.35); }
.pm-primary-button:hover { filter:brightness(1.06); transform:translateY(-1px); }
.pm-primary-button:active,.pm-secondary-button:active { transform:scale(.98); }
.pm-secondary-button { background:rgba(255,255,255,.045); color:var(--pm-text-secondary); border:1px solid var(--pm-border); }
.pm-secondary-button:hover { color:var(--pm-text); background:rgba(255,255,255,.085); border-color:var(--pm-border-strong); }

.pm-view { max-width:1480px; margin:0 auto; padding:28px 28px 40px; }
.pm-view-heading { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; margin-bottom:20px; }
.pm-view-heading h1 { margin:0; color:var(--pm-text); font-size:25px; line-height:1.08; letter-spacing:-.045em; font-weight:660; max-width:620px; }
.pm-view-heading p { margin:7px 0 0; color:var(--pm-text-secondary); font-size:10px; line-height:1.5; max-width:650px; }
.pm-heading-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap; }
.pm-eyebrow { display:block; color:var(--pm-accent); font-size:8px; line-height:1; letter-spacing:.13em; font-weight:720; margin-bottom:8px; }
.pm-panel-header { min-height:59px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border-bottom:1px solid var(--pm-border); }
.pm-panel-header h2 { margin:0; color:var(--pm-text); font-size:12px; letter-spacing:-.025em; font-weight:640; }
.pm-panel-header p { margin:4px 0 0; color:var(--pm-text-muted); font-size:8px; }
.pm-button-small { min-height:27px; padding:0 8px; font-size:8px; }
.pm-state-card { display:flex; align-items:center; gap:10px; margin-bottom:14px; padding:12px 14px; border-radius:var(--pm-radius-sm); border:1px solid var(--pm-border); background:rgba(255,255,255,.035); color:var(--pm-text-secondary); }
.pm-state-card > svg { color:var(--pm-warning); flex:none; }
.pm-state-card > div { display:grid; gap:2px; min-width:0; }
.pm-state-card strong { font-size:10px; color:var(--pm-text); }
.pm-state-card span { font-size:8px; }
.pm-state-card .pm-button { margin-left:auto; }
.pm-error-state { border-color:color-mix(in srgb,var(--pm-danger) 45%,var(--pm-border)); background:color-mix(in srgb,var(--pm-danger) 8%,var(--pm-glass)); }
.pm-error-state > svg { color:var(--pm-danger); }

.pm-overview-layout { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(272px,.74fr); gap:13px; }
.pm-focus-list { padding:4px 10px 9px; }
.pm-focus-row { width:100%; display:grid; grid-template-columns:26px minmax(0,1fr) auto 16px; align-items:center; gap:9px; padding:10px 6px; color:var(--pm-text); text-align:left; background:transparent; border:0; border-bottom:1px solid color-mix(in srgb,var(--pm-border) 68%,transparent); }
.pm-focus-row:last-child { border-bottom:0; }
.pm-focus-row:hover .pm-focus-copy strong { color:var(--pm-accent); }
.pm-focus-row > svg { color:var(--pm-text-muted); }
.pm-state-glyph { width:23px; height:23px; display:grid; place-items:center; border-radius:6px; color:var(--pm-text-muted); border:1px solid var(--pm-border); background:rgba(255,255,255,.035); }
.pm-state-glyph.blocked { color:var(--pm-danger); border-color:color-mix(in srgb,var(--pm-danger) 38%,var(--pm-border)); background:color-mix(in srgb,var(--pm-danger) 8%,transparent); }
.pm-state-glyph.in_progress { color:var(--pm-info); border-color:color-mix(in srgb,var(--pm-info) 38%,var(--pm-border)); background:color-mix(in srgb,var(--pm-info) 8%,transparent); }
.pm-focus-copy { min-width:0; display:grid; gap:2px; }
.pm-focus-copy strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:9px; font-weight:590; transition:color 150ms ease; }
.pm-focus-copy small { color:var(--pm-text-muted); font-size:8px; }
.pm-status { display:inline-flex; align-items:center; gap:5px; white-space:nowrap; color:var(--pm-text-secondary); font-size:8px; }
.pm-status i { width:5px; height:5px; border-radius:50%; background:var(--pm-text-muted); }
.pm-status.todo i { background:var(--pm-text-muted); }.pm-status.in_progress { color:var(--pm-info); }.pm-status.in_progress i { background:var(--pm-info); }.pm-status.done { color:var(--pm-success); }.pm-status.done i { background:var(--pm-success); }.pm-status.blocked { color:var(--pm-danger); }.pm-status.blocked i { background:var(--pm-danger); }
.pm-empty-row { min-height:92px; padding:16px; display:flex; align-items:center; gap:10px; color:var(--pm-text-secondary); }
.pm-empty-row > svg { color:var(--pm-success); flex:none; }.pm-empty-row > div { display:grid; gap:3px; }.pm-empty-row strong { color:var(--pm-text); font-size:10px; }.pm-empty-row span { font-size:8px; color:var(--pm-text-muted); }.pm-empty-row .pm-button { margin-left:auto; }
.pm-overview-dock { display:grid; gap:13px; align-content:start; }
.pm-live-marker { color:var(--pm-success); display:inline-flex; align-items:center; gap:5px; font:8px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-live-marker i { width:5px; height:5px; border-radius:50%; background:var(--pm-success); box-shadow:0 0 10px color-mix(in srgb,var(--pm-success) 65%,transparent); }
.pm-signal-grid { display:grid; grid-template-columns:1fr 1fr; }.pm-signal-grid > div { padding:14px 16px; border-right:1px solid var(--pm-border); border-bottom:1px solid var(--pm-border); }.pm-signal-grid > div:nth-child(2n) { border-right:0; }.pm-signal-grid > div:nth-last-child(-n+2) { border-bottom:0; }.pm-signal-grid small { display:block; color:var(--pm-text-muted); font-size:8px; }.pm-signal-grid strong { display:block; margin-top:4px; color:var(--pm-text); font-size:18px; letter-spacing:-.04em; font-weight:650; }.pm-signal-grid strong.is-danger { color:var(--pm-danger); }.pm-signal-grid strong.is-warning { color:var(--pm-warning); }
.pm-attention-panel { padding:16px; background:linear-gradient(135deg,rgba(var(--pm-accent-rgb),.13),rgba(255,255,255,.02) 60%),var(--pm-glass); }.pm-attention-panel h2 { margin:0; font-size:13px; letter-spacing:-.025em; }.pm-attention-panel p { color:var(--pm-text-secondary); margin:7px 0 11px; font-size:9px; line-height:1.5; }.pm-inline-link { display:inline-flex; gap:6px; align-items:center; padding:0; color:var(--pm-accent); font-size:9px; font-weight:600; }.pm-inline-link:hover { color:color-mix(in srgb,var(--pm-accent) 80%,white); }
.pm-activity-panel { margin-top:13px; }.pm-state-strip { display:grid; grid-template-columns:repeat(4,1fr); }.pm-state-strip>div { min-height:78px; display:flex; align-items:center; gap:9px; padding:14px 16px; border-right:1px solid var(--pm-border); }.pm-state-strip>div:last-child { border-right:0; }.pm-strip-icon { width:27px; height:27px; display:grid; place-items:center; border-radius:7px; border:1px solid var(--pm-border); color:var(--pm-accent); background:var(--pm-accent-soft); }.pm-state-strip small { display:block; color:var(--pm-text-muted); font-size:8px; }.pm-state-strip strong { display:block; margin-top:3px; font-size:15px; letter-spacing:-.035em; }.pm-skeleton-list { padding:14px 16px; display:grid; gap:9px; }.pm-skeleton-list i,.pm-signal-skeleton { display:block; height:35px; border-radius:7px; background:linear-gradient(90deg,rgba(255,255,255,.035),rgba(255,255,255,.1),rgba(255,255,255,.035)); background-size:200% 100%; animation:pm-shimmer 1.4s ease-in-out infinite; }.pm-signal-skeleton { height:146px; margin:14px; }
@keyframes pm-shimmer { to { background-position:-200% 0; } }

/* Task workspace */
.pm-task-surface { overflow:hidden; }.pm-task-toolbar { min-height:54px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 13px; border-bottom:1px solid var(--pm-border); }.pm-filter-tabs { display:flex; gap:4px; flex-wrap:wrap; }.pm-filter-tabs button { min-height:27px; padding:0 8px; border:1px solid transparent; border-radius:5px; background:transparent; color:var(--pm-text-muted); font-size:8px; }.pm-filter-tabs button:hover { color:var(--pm-text); background:rgba(255,255,255,.055); }.pm-filter-tabs button.is-active { color:var(--pm-accent); border-color:color-mix(in srgb,var(--pm-accent) 32%,var(--pm-border)); background:var(--pm-accent-soft); }.pm-task-count { color:var(--pm-text-muted); font:8px ui-monospace, SFMono-Regular, Consolas, monospace; white-space:nowrap; }.pm-task-table { min-width:700px; }.pm-task-head,.pm-task-row { display:grid; grid-template-columns:minmax(245px,1.72fr) minmax(130px,.82fr) 75px 100px 88px; gap:10px; align-items:center; padding:0 15px; }.pm-task-head { height:29px; color:var(--pm-text-muted); font:8px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing:.07em; text-transform:uppercase; border-bottom:1px solid var(--pm-border); }.pm-task-row { min-height:55px; border-bottom:1px solid color-mix(in srgb,var(--pm-border) 65%,transparent); }.pm-task-row:hover { background:rgba(255,255,255,.026); }.pm-task-title { min-width:0; display:flex; align-items:center; gap:8px; }.pm-priority-dot { width:7px; height:7px; flex:none; border-radius:50%; background:var(--pm-text-muted); }.pm-priority-dot.high { background:var(--pm-warning); }.pm-priority-dot.urgent { background:var(--pm-danger); }.pm-priority-dot.low { background:var(--pm-info); }.pm-task-title>div { min-width:0; display:grid; gap:2px; }.pm-task-title strong { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:9px; font-weight:590; }.pm-task-title small { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:var(--pm-text-muted); font-size:8px; }.pm-project-name,.pm-date { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--pm-text-secondary); font-size:8px; }.pm-date { color:var(--pm-text-muted); }.pm-row-actions { display:flex; justify-content:flex-end; gap:7px; }.pm-row-actions button { padding:0; color:var(--pm-accent); background:transparent; border:0; font-size:8px; }.pm-row-actions button:hover { text-decoration:underline; }.pm-row-actions button.is-danger { color:var(--pm-danger); }.pm-task-surface { overflow-x:auto; }
.pm-dialog-backdrop { position:fixed; inset:0; z-index:60; display:grid; place-items:center; padding:18px; background:rgba(1,3,7,.62); backdrop-filter:blur(10px); }.pm-task-dialog { width:min(680px,100%); max-height:calc(100vh - 36px); overflow:auto; background:linear-gradient(135deg,rgba(255,255,255,.10),rgba(255,255,255,.025)),var(--pm-glass-strong); border:1px solid var(--pm-border-strong); border-radius:16px; box-shadow:var(--pm-shadow-float); backdrop-filter:blur(28px) saturate(150%); }.pm-dialog-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding:17px 18px 14px; border-bottom:1px solid var(--pm-border); }.pm-dialog-heading h2 { margin:0; font-size:17px; letter-spacing:-.035em; }.pm-task-dialog form { padding:16px 18px 18px; }.pm-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }.pm-field { display:grid; gap:6px; }.pm-field-wide { grid-column:1 / -1; }.pm-field>span { color:var(--pm-text-secondary); font-size:8px; font-weight:600; }.pm-field input,.pm-field textarea,.pm-field select { width:100%; border:1px solid var(--pm-border); border-radius:7px; background:rgba(4,7,12,.28); padding:8px 9px; color:var(--pm-text); font-size:9px; }.pm-field textarea { resize:vertical; }.pm-dialog-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }.pm-inline-error { margin:12px 0 0; color:var(--pm-danger); font-size:9px; }

/* Review */
.pm-page { max-width:1480px; margin:0 auto; padding:28px 28px 40px; }.pm-page-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; margin-bottom:20px; }.pm-page-heading h1 { font-size:25px; line-height:1.08; letter-spacing:-.045em; margin:0; }.pm-page-heading p { margin:6px 0 0; color:var(--pm-text-secondary); font-size:10px; }.pm-data-status { color:var(--pm-text-muted); border:1px solid var(--pm-border); border-radius:999px; padding:5px 8px; font:8px ui-monospace, SFMono-Regular, Consolas, monospace; white-space:nowrap; }.pm-review-grid { display:grid; grid-template-columns:minmax(0,1fr) 305px; gap:13px; }.pm-review-list { padding:4px 10px 10px; }.pm-review-row { width:100%; display:grid; grid-template-columns:8px minmax(0,1fr) 14px; gap:9px; align-items:center; padding:12px 6px; color:var(--pm-text); background:transparent; border:0; border-bottom:1px solid color-mix(in srgb,var(--pm-border) 65%,transparent); text-align:left; }.pm-review-row:last-child { border-bottom:0; }.pm-review-row:hover strong { color:var(--pm-accent); }.pm-review-row>span { display:grid; gap:3px; min-width:0; }.pm-review-row strong { font-size:9px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.pm-review-row small { color:var(--pm-text-muted); font-size:8px; }.pm-review-row>svg { color:var(--pm-text-muted); }.pm-status-dot { width:7px; height:7px; border-radius:50%; display:inline-block; background:var(--pm-text-muted); }.pm-status-dot.danger { background:var(--pm-danger); }.pm-status-dot.warning { background:var(--pm-warning); }.pm-status-dot.success { background:var(--pm-success); }.pm-status-dot.info { background:var(--pm-info); }.pm-review-side { padding:17px; }.pm-transparency-icon { width:31px; height:31px; display:grid; place-items:center; border-radius:8px; border:1px solid color-mix(in srgb,var(--pm-accent) 30%,var(--pm-border)); background:var(--pm-accent-soft); color:var(--pm-accent); }.pm-review-side h2 { margin:12px 0 6px; font-size:13px; }.pm-review-side>p { margin:0 0 14px; color:var(--pm-text-secondary); font-size:9px; line-height:1.55; }.pm-review-stat { display:flex; justify-content:space-between; padding:9px 0; border-top:1px solid var(--pm-border); color:var(--pm-text-muted); font-size:8px; }.pm-review-stat strong { color:var(--pm-text); font-size:14px; letter-spacing:-.03em; }.pm-loading-state,.pm-empty-state { padding:26px 12px; color:var(--pm-text-secondary); text-align:center; font-size:9px; }.pm-empty-state strong { display:block; color:var(--pm-text); margin-bottom:4px; }.pm-empty-state p { margin:0; color:var(--pm-text-muted); font-size:8px; }

/* Appearance */
.pm-appearance-layout { display:grid; grid-template-columns:minmax(0,1fr) 310px; gap:13px; }.pm-appearance-main { overflow:hidden; }.pm-theme-card-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; padding:15px; }.pm-appearance-theme-card { min-height:91px; display:grid; grid-template-columns:83px minmax(0,1fr) 15px; align-items:center; gap:10px; padding:9px; text-align:left; background:rgba(255,255,255,.025); border:1px solid var(--pm-border); border-radius:8px; color:var(--pm-text); }.pm-appearance-theme-card:hover { background:rgba(255,255,255,.07); border-color:var(--pm-border-strong); }.pm-appearance-theme-card.is-selected { border-color:var(--pm-accent); box-shadow:0 0 0 2px var(--pm-accent-soft); }.pm-appearance-theme-card>span:not(.pm-theme-swatch) { min-width:0; display:grid; gap:3px; }.pm-appearance-theme-card strong { font-size:9px; }.pm-appearance-theme-card small { color:var(--pm-text-muted); font-size:7px; line-height:1.4; }.pm-appearance-theme-card>svg { color:var(--pm-accent); }.pm-theme-swatch { height:46px; display:grid; grid-template-columns:30% 1fr 1fr; gap:4px; padding:5px; border-radius:5px; overflow:hidden; background:linear-gradient(135deg,#07090c,#17212a); border:1px solid rgba(255,255,255,.07); }.pm-theme-swatch i { background:rgba(255,255,255,.07); border-radius:2px; }.pm-theme-swatch i:nth-child(2) { background:rgba(255,255,255,.12); }.pm-theme-swatch i:last-child { background:var(--swatch-accent); opacity:.9; }.pm-appearance-side { display:grid; gap:13px; align-content:start; }.pm-custom-accent-card { overflow:hidden; }.pm-custom-color-large { display:grid; grid-template-columns:31px 0 1fr auto; gap:7px; align-items:center; padding:14px 15px; }.pm-accent-preview { height:31px; border-radius:7px; border:1px solid var(--pm-border-strong); box-shadow:inset 0 1px rgba(255,255,255,.35); }.pm-custom-color-large input[type=color] { width:0; height:0; opacity:0; pointer-events:none; }.pm-custom-color-large input:not([type=color]) { min-width:0; height:31px; border:1px solid var(--pm-border); border-radius:7px; background:rgba(0,0,0,.18); color:var(--pm-text); padding:0 8px; font:9px ui-monospace, SFMono-Regular, Consolas, monospace; text-transform:uppercase; }.pm-color-help,.pm-color-error { margin:0 15px 13px; color:var(--pm-text-muted); font-size:8px; line-height:1.45; }.pm-color-error { color:var(--pm-danger); }.pm-text-button { display:inline-flex; align-items:center; gap:4px; padding:0; border:0; background:transparent; color:var(--pm-accent); font-size:8px; }.pm-text-button:hover { text-decoration:underline; }.pm-appearance-rule-card { padding:15px; }.pm-appearance-rule-card>svg { color:var(--pm-accent); }.pm-appearance-rule-card h2 { margin:10px 0 5px; font-size:12px; }.pm-appearance-rule-card p { color:var(--pm-text-secondary); font-size:9px; line-height:1.5; margin:0; }.pm-appearance-rule-card ul { display:grid; gap:6px; padding:11px 0 0; margin:11px 0 0; border-top:1px solid var(--pm-border); list-style:none; }.pm-appearance-rule-card li { display:flex; align-items:center; gap:7px; color:var(--pm-text-muted); font-size:8px; }

/* Modals + menus */
.pm-popover-backdrop,.pm-command-backdrop { position:fixed; inset:0; z-index:80; background:rgba(2,4,8,.4); backdrop-filter:blur(6px); }.pm-theme-menu { position:absolute; top:68px; right:23px; width:min(382px,calc(100vw - 28px)); max-height:calc(100vh - 88px); overflow:auto; background:linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.035)),var(--pm-glass-strong); border:1px solid var(--pm-border-strong); border-radius:14px; box-shadow:var(--pm-shadow-float); backdrop-filter:blur(30px) saturate(155%); }.pm-menu-header { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; padding:16px 16px 10px; }.pm-menu-header h2 { margin:3px 0 0; font-size:16px; letter-spacing:-.035em; }.pm-menu-kicker { color:var(--pm-accent); font-size:8px; letter-spacing:.12em; font-weight:700; }.pm-menu-copy { margin:0 16px 13px; color:var(--pm-text-secondary); font-size:9px; line-height:1.5; }.pm-theme-preset-list { display:grid; gap:5px; padding:0 11px 11px; }.pm-theme-preset { display:grid; grid-template-columns:47px minmax(0,1fr) 14px; align-items:center; gap:8px; width:100%; padding:6px; text-align:left; border:1px solid transparent; border-radius:7px; background:transparent; color:var(--pm-text); }.pm-theme-preset:hover { background:rgba(255,255,255,.06); }.pm-theme-preset.is-selected { border-color:var(--pm-accent); background:var(--pm-accent-soft); }.pm-theme-preview { height:27px; display:grid; grid-template-columns:20% 1fr 1fr; gap:3px; padding:4px; background:#090b0e; border:1px solid rgba(255,255,255,.08); border-radius:4px; }.pm-theme-preview i { background:rgba(255,255,255,.08); border-radius:1px; }.pm-theme-preview i:nth-child(2) { background:rgba(255,255,255,.13); }.pm-theme-preview i:last-child { background:var(--preview-accent); }.pm-theme-preset>span:not(.pm-theme-preview) { min-width:0; display:grid; gap:2px; }.pm-theme-preset strong { font-size:9px; }.pm-theme-preset small { color:var(--pm-text-muted); font-size:7px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.pm-theme-preset>svg { color:var(--pm-accent); }.pm-custom-color { padding:11px 16px 14px; border-top:1px solid var(--pm-border); background:rgba(0,0,0,.08); }.pm-custom-color-head { display:flex; justify-content:space-between; gap:10px; }.pm-custom-color-head strong { display:block; font-size:9px; }.pm-custom-color-head small { display:block; color:var(--pm-text-muted); font-size:8px; margin-top:3px; }.pm-color-input-row { display:flex; align-items:center; gap:7px; margin-top:9px; }.pm-color-input-row input[type=color] { width:30px; height:30px; border:1px solid var(--pm-border); border-radius:6px; padding:2px; background:transparent; }.pm-color-input-row input:not([type=color]) { min-width:0; flex:1; height:30px; border:1px solid var(--pm-border); border-radius:6px; padding:0 8px; background:rgba(0,0,0,.17); color:var(--pm-text); font:8px ui-monospace, SFMono-Regular, Consolas, monospace; text-transform:uppercase; }.pm-compact-button { height:30px; border:1px solid var(--pm-border); border-radius:6px; padding:0 8px; color:var(--pm-text-secondary); background:rgba(255,255,255,.06); font-size:8px; }.pm-color-feedback { margin-top:6px; color:var(--pm-text-muted); font-size:7px; }.pm-color-feedback.is-error { color:var(--pm-danger); }.pm-menu-note { display:flex; gap:6px; align-items:flex-start; padding:11px 16px 14px; color:var(--pm-text-muted); font-size:7.5px; line-height:1.45; }.pm-menu-note svg { color:var(--pm-accent); flex:none; }.pm-command-backdrop { display:grid; place-items:start center; padding-top:min(16vh,135px); }.pm-command-palette { width:min(620px,calc(100vw - 28px)); background:linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.03)),var(--pm-glass-strong); border:1px solid var(--pm-border-strong); border-radius:14px; box-shadow:var(--pm-shadow-float); overflow:hidden; backdrop-filter:blur(30px) saturate(155%); }.pm-command-input { height:51px; display:flex; align-items:center; gap:9px; padding:0 14px; border-bottom:1px solid var(--pm-border); color:var(--pm-accent); }.pm-command-input input { min-width:0; flex:1; border:0; outline:0; background:transparent; color:var(--pm-text); font-size:11px; }.pm-command-input input::placeholder { color:var(--pm-text-muted); }.pm-command-input kbd,.pm-command-item kbd { color:var(--pm-text-muted); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; border:1px solid var(--pm-border); border-radius:3px; padding:2px 4px; }.pm-command-label { padding:11px 14px 5px; color:var(--pm-text-muted); font:8px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing:.08em; text-transform:uppercase; }.pm-command-item { width:100%; display:grid; grid-template-columns:27px 1fr auto; align-items:center; gap:8px; padding:8px 14px; background:transparent; color:var(--pm-text-secondary); border:0; text-align:left; font-size:9px; }.pm-command-item:hover { color:var(--pm-text); background:var(--pm-accent-soft); }.pm-command-icon { width:24px; height:24px; display:grid; place-items:center; border-radius:5px; border:1px solid var(--pm-border); color:var(--pm-accent); background:rgba(var(--pm-accent-rgb),.08); }.pm-command-footer { display:flex; gap:13px; padding:10px 14px; border-top:1px solid var(--pm-border); color:var(--pm-text-muted); font-size:7px; }


/* Missing component classes added for UIUX-010 */
.pm-dialog-compact { padding: 12px 16px; border-radius: 12px; }
.pm-dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--pm-border); }
.pm-inline-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pm-checklist-items { display: flex; flex-direction: column; gap: 6px; }
.pm-relationship-arrow { display: inline-flex; align-items: center; color: var(--pm-text-muted); font-size: 12px; }
.pm-kanban-board { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.pm-project-switcher { position: relative; display: inline-block; }
.pm-project-switcher-menu { position: absolute; z-index: 50; margin-top: 4px; min-width: 200px; border: 1px solid var(--pm-border); border-radius: 8px; background: var(--pm-glass-strong); box-shadow: var(--pm-shadow); backdrop-filter: blur(22px) saturate(142%); }
.pm-automation-page { min-height: 100vh; padding: 24px; }
.pm-focus-panel { padding: 16px; border: 1px solid var(--pm-border); border-radius: 8px; background: var(--pm-glass); }
.pm-form-help { font-size: 12px; color: var(--pm-text-muted); margin-top: 4px; }

/* Automation Studio (intentionally non-live) */
.pm-future-notice { color:var(--pm-warning); border:1px solid color-mix(in srgb,var(--pm-warning) 38%,var(--pm-border)); border-radius:5px; padding:5px 7px; font:8px ui-monospace, SFMono-Regular, Consolas, monospace; background:color-mix(in srgb,var(--pm-warning) 9%,transparent); }.pm-automation-layout { min-height:690px; display:grid; grid-template-columns:177px minmax(0,1fr) 258px; grid-template-rows:minmax(0,1fr) 178px; overflow:hidden; border:1px solid var(--pm-border); border-radius:var(--pm-radius); background:var(--pm-glass); box-shadow:var(--pm-shadow); backdrop-filter:blur(22px) saturate(142%); }.pm-automation-library { grid-row:1 / 3; padding:13px 10px; border-right:1px solid var(--pm-border); background:rgba(3,6,11,.19); }.pm-library-title { color:var(--pm-text); font-size:10px; font-weight:620; margin:0 2px 10px; }.pm-library-search { height:28px; display:flex; align-items:center; gap:6px; color:var(--pm-text-muted); border:1px solid var(--pm-border); border-radius:6px; padding:0 7px; font-size:8px; background:rgba(0,0,0,.16); }.pm-automation-library section { display:grid; gap:3px; margin-top:14px; }.pm-automation-library section small { color:var(--pm-text-muted); font:8px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing:.08em; text-transform:uppercase; margin:0 3px 3px; }.pm-automation-library section button { display:flex; align-items:center; gap:7px; padding:6px; border:0; border-radius:5px; color:var(--pm-text-secondary); background:transparent; font-size:8px; text-align:left; }.pm-automation-library section button:hover { color:var(--pm-text); background:rgba(255,255,255,.06); }.pm-node-letter,.pm-node-symbol { width:20px; height:20px; flex:none; display:grid; place-items:center; border:1px solid var(--pm-border); border-radius:5px; color:var(--pm-accent); background:var(--pm-accent-soft); font:10px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-node-letter.warning,.pm-node-symbol.warning { color:var(--pm-warning); background:color-mix(in srgb,var(--pm-warning) 11%,transparent); }.pm-node-letter.success,.pm-node-symbol.success { color:var(--pm-success); background:color-mix(in srgb,var(--pm-success) 11%,transparent); }.pm-node-letter.danger { color:var(--pm-danger); background:color-mix(in srgb,var(--pm-danger) 11%,transparent); }.pm-automation-canvas { position:relative; overflow:hidden; background-color:rgba(4,7,12,.34); background-image:radial-gradient(color-mix(in srgb,var(--pm-text-muted) 33%,transparent) .65px,transparent .65px); background-size:17px 17px; }.pm-canvas-tools { position:absolute; z-index:4; top:11px; left:11px; display:flex; gap:5px; }.pm-canvas-tools button { height:26px; padding:0 7px; border:1px solid var(--pm-border); border-radius:5px; color:var(--pm-text-muted); background:rgba(14,18,26,.84); font-size:8px; }.pm-canvas-tools button.is-active { color:var(--pm-accent); border-color:color-mix(in srgb,var(--pm-accent) 45%,var(--pm-border)); background:var(--pm-accent-soft); }.pm-draft-tag { position:absolute; z-index:4; top:12px; right:12px; color:var(--pm-warning); border:1px solid color-mix(in srgb,var(--pm-warning) 40%,var(--pm-border)); border-radius:4px; padding:4px 5px; background:color-mix(in srgb,var(--pm-warning) 10%,rgba(12,15,20,.85)); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-workflow-lines { position:absolute; inset:0; z-index:0; width:100%; height:100%; overflow:visible; }.pm-workflow-lines path { fill:none; stroke:color-mix(in srgb,var(--pm-text-secondary) 55%,transparent); stroke-width:1.5; stroke-dasharray:5 5; }.pm-workflow-lines path.yes { stroke:var(--pm-success); stroke-dasharray:none; }.pm-workflow-lines path.no { stroke:var(--pm-text-muted); }.pm-flow-label { position:absolute; z-index:2; top:25%; left:57%; border:1px solid var(--pm-border); border-radius:4px; padding:3px 4px; color:var(--pm-success); background:var(--pm-glass-strong); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-flow-label.no { top:63%; color:var(--pm-text-muted); }.pm-flow-node { position:absolute; z-index:2; width:170px; display:grid; grid-template-columns:22px minmax(0,1fr); gap:7px; padding:8px; text-align:left; color:var(--pm-text); border:1px solid var(--pm-border-strong); border-radius:8px; background:linear-gradient(140deg,rgba(255,255,255,.09),rgba(255,255,255,.025)),var(--pm-glass-strong); box-shadow:0 10px 25px rgba(0,0,0,.23); }.pm-flow-node:hover { border-color:var(--pm-accent); }.pm-flow-node.is-selected { border-color:var(--pm-accent); box-shadow:0 0 0 2px var(--pm-accent-soft),0 10px 25px rgba(0,0,0,.24); }.pm-flow-node.trigger { left:6%; top:34%; }.pm-flow-node.condition { left:34%; top:34%; }.pm-flow-node.notify { left:65%; top:16%; }.pm-flow-node.review { left:65%; top:58%; }.pm-flow-node>span:nth-child(2) { min-width:0; display:grid; gap:2px; }.pm-flow-node strong { font-size:8px; font-weight:610; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.pm-flow-node small { color:var(--pm-text-muted); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-flow-node em { grid-column:1/-1; margin-top:2px; color:var(--pm-text-secondary); border:1px solid var(--pm-border); border-radius:4px; padding:4px; background:rgba(2,4,8,.19); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; font-style:normal; }.pm-flow-end { position:absolute; left:89%; top:40%; z-index:2; width:93px; display:grid; grid-template-columns:18px 1fr; gap:5px; align-items:center; padding:7px; border:1px solid var(--pm-border); border-radius:7px; background:var(--pm-glass-strong); }.pm-flow-end span { color:var(--pm-accent); font:12px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-flow-end strong { font-size:8px; }.pm-flow-end small { grid-column:2; color:var(--pm-text-muted); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-zoom { position:absolute; right:10px; bottom:10px; z-index:3; color:var(--pm-text-secondary); border:1px solid var(--pm-border); border-radius:5px; padding:6px 7px; background:var(--pm-glass-strong); font:8px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-node-inspector { grid-column:3; grid-row:1/3; min-width:0; border-left:1px solid var(--pm-border); background:rgba(3,6,11,.17); }.pm-node-inspector>header { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:12px; border-bottom:1px solid var(--pm-border); }.pm-node-inspector>header small { display:block; color:var(--pm-text-muted); font-size:8px; }.pm-node-inspector>header h2 { margin:3px 0 0; font-size:11px; letter-spacing:-.02em; }.pm-node-inspector>header>svg { color:var(--pm-text-muted); }.pm-node-inspector nav { display:flex; gap:11px; padding:0 12px; border-bottom:1px solid var(--pm-border); }.pm-node-inspector nav button { padding:9px 0; color:var(--pm-text-muted); border:0; border-bottom:2px solid transparent; background:transparent; font-size:8px; }.pm-node-inspector nav button.is-active { color:var(--pm-accent); border-color:var(--pm-accent); }.pm-inspector-content { padding:12px; }.pm-inspector-content label { display:grid; gap:5px; margin-bottom:10px; color:var(--pm-text-secondary); font-size:8px; }.pm-inspector-content input,.pm-inspector-content textarea { width:100%; border:1px solid var(--pm-border); border-radius:6px; background:rgba(2,4,8,.18); color:var(--pm-text); padding:7px; font-size:8px; resize:vertical; }.pm-inspector-divider { height:1px; background:var(--pm-border); margin:12px 0; }.pm-inspector-content h3 { margin:10px 0 5px; font-size:8px; }.pm-inspector-content pre { margin:0; border:1px solid var(--pm-border); border-radius:5px; padding:7px; color:var(--pm-text-secondary); background:rgba(2,4,8,.18); font:7px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; white-space:pre-wrap; }.pm-inspector-warning { color:var(--pm-warning); font-size:7px; line-height:1.5; }.pm-execution-drawer { grid-column:2; grid-row:2; display:grid; grid-template-columns:183px minmax(0,1fr); border-top:1px solid var(--pm-border); background:rgba(4,7,12,.2); }.pm-execution-drawer>aside { padding:10px; border-right:1px solid var(--pm-border); }.pm-execution-drawer>aside header { color:var(--pm-text); font-size:9px; font-weight:610; margin-bottom:7px; }.pm-execution-drawer>aside button { width:100%; display:flex; align-items:center; gap:6px; padding:6px; color:var(--pm-text-muted); background:transparent; border:0; border-radius:4px; font-size:7px; text-align:left; }.pm-execution-drawer>aside button.is-active { color:var(--pm-text); background:var(--pm-accent-soft); }.pm-execution-drawer>aside i { width:5px; height:5px; border-radius:50%; background:var(--pm-text-muted); }.pm-execution-drawer>aside button.is-active i { background:var(--pm-warning); }.pm-execution-drawer>aside span { margin-left:auto; color:var(--pm-text-muted); font:7px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-trace { padding:10px 12px; min-width:0; }.pm-trace>header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:7px; }.pm-trace>header>div { display:flex; align-items:center; gap:6px; }.pm-trace>header strong { font-size:9px; }.pm-trace>header span { color:var(--pm-warning); border:1px solid color-mix(in srgb,var(--pm-warning) 35%,var(--pm-border)); border-radius:3px; padding:3px 4px; font:7px ui-monospace, SFMono-Regular, Consolas, monospace; }.pm-trace>header button { color:var(--pm-text-muted); border:1px solid var(--pm-border); border-radius:4px; padding:4px 5px; background:transparent; font-size:7px; }.pm-trace-grid { display:grid; grid-template-columns:128px minmax(0,1fr); gap:8px; }.pm-step-list,.pm-output-box { border:1px solid var(--pm-border); border-radius:5px; padding:5px; background:rgba(2,4,8,.17); }.pm-step-list { display:grid; gap:2px; }.pm-step-list span { display:flex; align-items:center; gap:6px; color:var(--pm-text-muted); padding:4px; font-size:7px; }.pm-step-list i { width:5px; height:5px; border-radius:50%; background:var(--pm-text-muted); }.pm-step-list span.is-done i { background:var(--pm-success); }.pm-step-list span.is-active { color:var(--pm-text); }.pm-step-list span.is-active i { background:var(--pm-accent); box-shadow:0 0 0 3px var(--pm-accent-soft); }.pm-output-box>div { display:flex; justify-content:space-between; color:var(--pm-text-muted); font-size:7px; }.pm-output-box pre { margin:5px 0 0; color:var(--pm-text-secondary); font:7px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; white-space:pre-wrap; }.pm-output-box p { margin:4px 0 0; color:var(--pm-warning); font-size:7px; line-height:1.4; }

@media (max-width: 1120px) { .pm-main-column .pm-topbar{padding:0 17px}.pm-view,.pm-page{padding:22px 18px 32px}.pm-overview-layout{grid-template-columns:minmax(0,1.35fr) 255px}.pm-automation-layout{grid-template-columns:158px minmax(0,1fr) 225px}.pm-flow-node{width:150px}.pm-flow-end{display:none}.pm-appearance-layout{grid-template-columns:minmax(0,1fr) 280px} }
@media (max-width: 850px) { .pm-overview-layout,.pm-review-grid,.pm-appearance-layout{grid-template-columns:1fr}.pm-overview-dock{grid-template-columns:1fr 1fr}.pm-automation-layout{grid-template-columns:1fr;grid-template-rows:auto 430px auto auto}.pm-automation-library{grid-row:auto;border-right:0;border-bottom:1px solid var(--pm-border);display:flex;gap:10px;overflow:auto}.pm-automation-library .pm-library-title,.pm-automation-library .pm-library-search{display:none}.pm-automation-library section{display:flex;gap:3px;margin:0}.pm-automation-library section small{display:none}.pm-node-inspector{grid-column:auto;grid-row:auto;border-left:0;border-top:1px solid var(--pm-border)}.pm-execution-drawer{grid-column:auto;grid-row:auto}.pm-task-table{min-width:650px}.pm-theme-card-grid{grid-template-columns:1fr}.pm-state-strip{grid-template-columns:1fr 1fr}.pm-state-strip>div:nth-child(2){border-right:0}.pm-state-strip>div:nth-child(-n+2){border-bottom:1px solid var(--pm-border)} }
@media (max-width: 780px) { .pm-main-column .pm-topbar{padding:0 12px}.pm-view,.pm-page{padding:18px 12px 28px}.pm-view-heading,.pm-page-heading{align-items:flex-start;flex-direction:column}.pm-view-heading h1,.pm-page-heading h1{font-size:22px}.pm-overview-dock{grid-template-columns:1fr}.pm-topbar-actions .pm-theme-trigger span{display:none}.pm-primary-button{padding:0 8px}.pm-command-trigger{width:150px}.pm-form-grid{grid-template-columns:1fr}.pm-field-wide{grid-column:auto}.pm-theme-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pm-custom-accent{grid-template-columns:1fr}.pm-activity-panel{overflow:auto}.pm-state-strip{min-width:560px}.pm-topbar-actions{gap:5px}.pm-topbar-actions .pm-primary-button{font-size:0}.pm-topbar-actions .pm-primary-button svg{width:15px;height:15px} }


/* Authentication is part of the same glass system, outside the authenticated shell. */
.pm-auth-shell { min-height:100vh; position:relative; overflow:hidden; display:grid; place-items:center; padding:24px; background:radial-gradient(circle at 75% 8%,rgba(var(--pm-accent-rgb),.22),transparent 28rem),radial-gradient(circle at 15% 100%,rgba(var(--pm-accent-rgb),.09),transparent 26rem),linear-gradient(145deg,var(--pm-canvas-deep),var(--pm-canvas)); }
.pm-auth-orb { position:absolute; width:30rem; height:30rem; border-radius:50%; pointer-events:none; filter:blur(34px); opacity:.26; background:var(--pm-accent); }.pm-auth-orb-one { top:-22rem; right:-13rem; }.pm-auth-orb-two { bottom:-25rem; left:-16rem; opacity:.13; }
.pm-auth-card { position:relative; z-index:1; width:min(430px,100%); padding:25px; border:1px solid var(--pm-border-strong); border-radius:18px; background:linear-gradient(140deg,rgba(255,255,255,.15),rgba(255,255,255,.035) 32%,rgba(255,255,255,.025)),var(--pm-glass-strong); box-shadow:var(--pm-shadow-float); backdrop-filter:blur(32px) saturate(155%); }.pm-auth-card header h1 { margin:12px 0 5px; color:var(--pm-text); font-size:24px; letter-spacing:-.045em; line-height:1.1; }.pm-auth-card header>p { margin:0; color:var(--pm-text-secondary); font-size:10px; }.pm-auth-brand { display:flex; align-items:center; gap:8px; color:var(--pm-text); font-size:12px; font-weight:650; }.pm-auth-brand>span { width:25px; height:25px; display:grid; place-items:center; border:1px solid rgba(var(--pm-accent-rgb),.44); border-radius:7px; color:var(--pm-accent); background:var(--pm-accent-soft); font:700 11px ui-monospace,SFMono-Regular,Consolas,monospace; }.pm-auth-tabs { display:grid; grid-template-columns:1fr 1fr; gap:3px; margin:20px 0 16px; padding:3px; border:1px solid var(--pm-border); border-radius:8px; background:rgba(0,0,0,.14); }.pm-auth-tabs button { min-height:30px; border:0; border-radius:5px; color:var(--pm-text-muted); background:transparent; font-size:9px; }.pm-auth-tabs button.is-active { color:var(--pm-text); background:rgba(255,255,255,.09); box-shadow:inset 0 1px rgba(255,255,255,.08); }.pm-auth-card form { display:grid; gap:13px; }.pm-auth-card form>div { min-width:0; }.pm-auth-card label { display:block; margin-bottom:5px; color:var(--pm-text-secondary) !important; font-size:9px !important; font-weight:600 !important; }.pm-auth-card input { width:100%; height:37px; padding:0 10px; color:var(--pm-text) !important; border:1px solid var(--pm-border) !important; border-radius:7px !important; background:rgba(2,4,8,.26) !important; font-size:10px; }.pm-auth-card input::placeholder { color:var(--pm-text-muted); }.pm-auth-card form button[type=submit] { width:100%; min-height:37px; margin-top:3px; border:1px solid color-mix(in srgb,var(--pm-accent) 78%,white 22%); border-radius:7px; color:var(--pm-accent-ink); background:var(--pm-accent) !important; box-shadow:0 8px 22px var(--pm-accent-glow),inset 0 1px rgba(255,255,255,.3); font-size:10px; font-weight:650; }.pm-auth-card form button[type=submit]:hover { filter:brightness(1.06); }.pm-auth-card form .text-red-600,.pm-auth-card form .dark\:text-red-400 { color:var(--pm-danger) !important; font-size:8px; }.pm-auth-card footer { display:flex; align-items:center; gap:6px; margin-top:18px; padding-top:13px; color:var(--pm-text-muted); border-top:1px solid var(--pm-border); font-size:8px; }.pm-auth-card footer svg { color:var(--pm-accent); }.pm-auth-card .bg-red-500{background:var(--pm-danger)!important}.pm-auth-card .bg-yellow-500{background:var(--pm-warning)!important}.pm-auth-card .bg-blue-500{background:var(--pm-accent)!important}.pm-auth-card .bg-green-500{background:var(--pm-success)!important}


html[data-pm-theme="porcelain"] {
  color-scheme: light;
  --pm-canvas: #eef2f7;
  --pm-canvas-deep: #e3e9f2;
  --pm-rail: rgba(244, 247, 252, 0.82);
  --pm-glass: rgba(255, 255, 255, 0.72);
  --pm-glass-strong: rgba(255, 255, 255, 0.88);
  --pm-border: rgba(25, 42, 70, 0.14);
  --pm-border-strong: rgba(25, 42, 70, 0.24);
  --pm-text: #101826;
  --pm-text-secondary: #435268;
  --pm-text-muted: #6c7c93;
  --pm-shadow: 0 16px 38px rgba(15, 23, 42, 0.08), inset 0 1px rgba(255, 255, 255, 0.75);
  --pm-shadow-float: 0 24px 56px rgba(15, 23, 42, 0.16), inset 0 1px rgba(255, 255, 255, 0.85);
}

.pm-accent-picker-label {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 31px;
  cursor: pointer;
}
.pm-accent-picker-label .pm-accent-preview {
  display: block;
  width: 100%;
  height: 100%;
}
.pm-accent-picker-label input[type="color"] {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  opacity: 0 !important;
  pointer-events: auto !important;
  cursor: pointer;
}
.pm-custom-color-large {
  grid-template-columns: 34px 1fr auto !important;
}

.pm-mobile-nav-toggle { display: none; margin-left: auto; }
@media (max-width: 780px) {
  .pm-mobile-nav-toggle { display: inline-grid; }
  .pm-sidebar.is-mobile-open .pm-nav-group,
  .pm-sidebar.is-mobile-open .pm-user-menu { display: grid; grid-column: 1 / -1; }
  .pm-sidebar.is-mobile-open .pm-user-menu { display: flex; }
}


/* Canvas accessibility utilities */
.pm-visually-hidden,
.pm-visually-hidden-focusable:not(:focus):not(:focus-visible) {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

.pm-visually-hidden-focusable:focus,
.pm-visually-hidden-focusable:focus-visible {
  position: absolute !important;
  top: -1.75rem;
  right: 0;
  z-index: 1000;
  width: auto !important;
  height: auto !important;
  padding: 6px 10px !important;
  margin: 0 !important;
  overflow: visible !important;
  clip: auto !important;
  white-space: normal !important;
  border: 1px solid var(--pm-border-strong) !important;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-glass-strong);
  color: var(--pm-text);
  box-shadow: var(--pm-shadow);
  outline: 2px solid var(--pm-accent);
  outline-offset: 2px;
}

/* Focus indicators for non-native canvas controls */
.pm-canvas-item:focus-visible,
.pm-canvas-connection:focus-visible {
  outline: 2px solid var(--pm-accent);
  outline-offset: 2px;
}
```

SHA-256: `a7bba2480e1f88c6f8f6329ae51110b277a037909ba2d2321cb05ad79d6fa47d`

### SOURCE: `backend/src/services/connector.service.ts`
```text
import { getDb } from "../database/index.ts";
import { randomUUID } from "node:crypto";

export interface ConnectorDefinition {
  id: string;
  name: string;
  provider: string;
  type: "oauth" | "api_key" | "webhook" | "token";
  description: string;
  icon: string;
  configFields: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  actions: { id: string; label: string; description: string }[];
}

export interface ConnectorInstance {
  connector_id: string;
  name: string;
  type: string;
  provider: string;
  status: "connected" | "disconnected" | "error" | "pending";
  config: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const AVAILABLE_CONNECTORS: ConnectorDefinition[] = [
  {
    id: "github",
    name: "GitHub",
    provider: "github",
    type: "token",
    description: "Connect to GitHub repositories, issues, and pull requests",
    icon: "github",
    configFields: [
      { key: "access_token", label: "Personal Access Token", type: "password", required: true, placeholder: "ghp_..." },
      { key: "repo_owner", label: "Repository Owner", type: "text", required: false, placeholder: "username or org" },
      { key: "repo_name", label: "Repository Name", type: "text", required: false, placeholder: "repo-name" },
    ],
    actions: [
      { id: "list_repos", label: "List Repositories", description: "List accessible GitHub repositories" },
      { id: "create_issue", label: "Create Issue", description: "Create a GitHub issue" },
      { id: "list_issues", label: "List Issues", description: "List repository issues" },
      { id: "link_commit", label: "Link Commit", description: "Link a commit to a task" },
    ],
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    provider: "hermes",
    type: "api_key",
    description: "Connect to Hermes Agent for AI-powered assistance",
    icon: "hermes",
    configFields: [
      { key: "api_key", label: "API Key", type: "password", required: true, placeholder: "hermes-..." },
      { key: "base_url", label: "Base URL", type: "url", required: false, placeholder: "https://api.hermes-agent.com" },
      { key: "model", label: "Default Model", type: "text", required: false, placeholder: "gpt-4" },
    ],
    actions: [
      { id: "test_connection", label: "Test Connection", description: "Verify Hermes API connectivity" },
      { id: "send_message", label: "Send Message", description: "Send a message to Hermes" },
      { id: "list_models", label: "List Models", description: "List available models" },
    ],
  },
];

export class ConnectorService {
  listAvailable(): ConnectorDefinition[] {
    return AVAILABLE_CONNECTORS;
  }

  getDefinition(provider: string): ConnectorDefinition | undefined {
    return AVAILABLE_CONNECTORS.find((c) => c.provider === provider);
  }

  listInstances(userId?: string): ConnectorInstance[] {
    const db = getDb();
    let query = "SELECT * FROM connectors";
    const params: any[] = [];
    if (userId) {
      query += " WHERE created_by = ?";
      params.push(userId);
    }
    query += " ORDER BY created_at DESC";
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((row) => ({
      connector_id: row.connector_id,
      name: row.name,
      type: row.type,
      provider: row.provider,
      status: row.status,
      config: row.config ? JSON.parse(row.config) : {},
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  getInstance(connectorId: string): ConnectorInstance | null {
    const db = getDb();
    const row = db.prepare("SELECT * FROM connectors WHERE connector_id = ?").get(connectorId) as any;
    if (!row) return null;
    return {
      connector_id: row.connector_id,
      name: row.name,
      type: row.type,
      provider: row.provider,
      status: row.status,
      config: row.config ? JSON.parse(row.config) : {},
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  createInstance(provider: string, name: string, userId: string, config: Record<string, any> = {}): ConnectorInstance {
    const db = getDb();
    const def = this.getDefinition(provider);
    if (!def) throw new Error(`Unknown connector provider: ${provider}`);

    const connectorId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO connectors (connector_id, name, type, provider, status, config, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(connectorId, name, def.type, provider, "disconnected", JSON.stringify(config), userId, now, now);

    // Save individual config entries
    for (const [key, value] of Object.entries(config)) {
      const configId = randomUUID();
      const field = def.configFields.find((f) => f.key === key);
      db.prepare(`
        INSERT INTO connector_configs (config_id, connector_id, key, value, is_secret, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(configId, connectorId, key, String(value), field?.type === "password" ? 1 : 0, now, now);
    }

    return this.getInstance(connectorId)!;
  }

  updateConfig(connectorId: string, config: Record<string, any>): ConnectorInstance {
    const db = getDb();
    const instance = this.getInstance(connectorId);
    if (!instance) throw new Error("Connector not found");

    const def = this.getDefinition(instance.provider);
    if (!def) throw new Error("Unknown connector provider");

    const now = new Date().toISOString();
    const mergedConfig = { ...instance.config, ...config };
    db.prepare("UPDATE connectors SET config = ?, updated_at = ? WHERE connector_id = ?").run(
      JSON.stringify(mergedConfig), now, connectorId
    );

    // Update individual config entries
    for (const [key, value] of Object.entries(config)) {
      const existing = db.prepare("SELECT config_id FROM connector_configs WHERE connector_id = ? AND key = ?").get(connectorId, key) as any;
      const field = def.configFields.find((f) => f.key === key);
      if (existing) {
        db.prepare("UPDATE connector_configs SET value = ?, updated_at = ? WHERE config_id = ?").run(String(value), now, existing.config_id);
      } else {
        const configId = randomUUID();
        db.prepare(`
          INSERT INTO connector_configs (config_id, connector_id, key, value, is_secret, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(configId, connectorId, key, String(value), field?.type === "password" ? 1 : 0, now, now);
      }
    }

    return this.getInstance(connectorId)!;
  }

  updateStatus(connectorId: string, status: ConnectorInstance["status"]): ConnectorInstance {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare("UPDATE connectors SET status = ?, updated_at = ? WHERE connector_id = ?").run(status, now, connectorId);
    return this.getInstance(connectorId)!;
  }

  deleteInstance(connectorId: string): boolean {
    const db = getDb();
    db.prepare("DELETE FROM connector_configs WHERE connector_id = ?").run(connectorId);
    const result = db.prepare("DELETE FROM connectors WHERE connector_id = ?").run(connectorId);
    return (result as any).changes > 0;
  }

  getConfig(connectorId: string): Record<string, any> {
    const instance = this.getInstance(connectorId);
    if (!instance) throw new Error("Connector not found");
    return instance.config;
  }

  // GitHub-specific actions
  async githubListRepos(connectorId: string): Promise<any[]> {
    const config = this.getConfig(connectorId);
    const token = config.access_token;
    if (!token) throw new Error("GitHub access token not configured");

    const res = await fetch("https://api.github.com/user/repos?per_page=100", {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    const repos = await res.json();
    return repos.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      description: r.description,
      private: r.private,
      html_url: r.html_url,
      default_branch: r.default_branch,
    }));
  }

  async githubListIssues(connectorId: string, owner: string, repo: string): Promise<any[]> {
    const config = this.getConfig(connectorId);
    const token = config.access_token;
    if (!token) throw new Error("GitHub access token not configured");

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=50`, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    const issues = await res.json();
    return issues.map((i: any) => ({
      id: i.id,
      number: i.number,
      title: i.title,
      state: i.state,
      html_url: i.html_url,
      created_at: i.created_at,
      user: i.user?.login,
    }));
  }

  async githubCreateIssue(connectorId: string, owner: string, repo: string, title: string, body: string): Promise<any> {
    const config = this.getConfig(connectorId);
    const token = config.access_token;
    if (!token) throw new Error("GitHub access token not configured");

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: "POST",
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    const issue = await res.json();
    return { id: issue.id, number: issue.number, title: issue.title, html_url: issue.html_url };
  }

  // Hermes-specific actions
  async hermesTestConnection(connectorId: string): Promise<{ ok: boolean; message: string }> {
    const config = this.getConfig(connectorId);
    const apiKey = config.api_key;
    const baseUrl = config.base_url || "https://api.hermes-agent.com";
    if (!apiKey) throw new Error("Hermes API key not configured");

    try {
      const res = await fetch(`${baseUrl}/health`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        return { ok: true, message: "Connection successful" };
      }
      return { ok: false, message: `Connection failed: ${res.status} ${res.statusText}` };
    } catch (err: any) {
      return { ok: false, message: `Connection error: ${err.message}` };
    }
  }

  async hermesSendMessage(connectorId: string, message: string): Promise<any> {
    const config = this.getConfig(connectorId);
    const apiKey = config.api_key;
    const baseUrl = config.base_url || "https://api.hermes-agent.com";
    const model = config.model || "default";
    if (!apiKey) throw new Error("Hermes API key not configured");

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: message }],
      }),
    });
    if (!res.ok) throw new Error(`Hermes API error: ${res.status} ${res.statusText}`);
    return await res.json();
  }

  async hermesListModels(connectorId: string): Promise<any[]> {
    const config = this.getConfig(connectorId);
    const apiKey = config.api_key;
    const baseUrl = config.base_url || "https://api.hermes-agent.com";
    if (!apiKey) throw new Error("Hermes API key not configured");

    try {
      const res = await fetch(`${baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`Hermes API error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      return data.data || data.models || [];
    } catch (err: any) {
      return [{ id: "default", name: "Default Model" }];
    }
  }

  // Test connection for any connector
  async testConnection(connectorId: string): Promise<{ ok: boolean; message: string }> {
    const instance = this.getInstance(connectorId);
    if (!instance) throw new Error("Connector not found");

    if (instance.provider === "github") {
      const config = instance.config;
      if (!config.access_token) return { ok: false, message: "Access token not configured" };
      try {
        const res = await fetch("https://api.github.com/user", {
          headers: { Authorization: `token ${config.access_token}` },
        });
        if (res.ok) {
          const user = await res.json();
          return { ok: true, message: `Connected as ${user.login}` };
        }
        return { ok: false, message: `GitHub auth failed: ${res.status}` };
      } catch (err: any) {
        return { ok: false, message: `Connection error: ${err.message}` };
      }
    }

    if (instance.provider === "hermes") {
      return this.hermesTestConnection(connectorId);
    }

    return { ok: false, message: "Unknown connector type" };
  }
}

export const connectorService = new ConnectorService();
```

SHA-256: `ae823c8dccd09a5a073e7052376cd6930d2224961585a81925e420c665f7b271`

### SOURCE: `frontend/src/components/projects/ProjectSwitcher.tsx`
```text
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "../../hooks/useAuth";
import type { Project } from "../../types";
import { Icon } from "../layout/Icon";

interface ProjectMenuEntry {
  id: string;
  kind: "project" | "new-project" | "manage-projects";
  project?: Project;
}

const SELECTED_PROJECT_KEY = "pm-selected-project";

export default function ProjectSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();

  const triggerId = useId();
  const menuId = useId();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const wasOpenRef = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Reuse the existing project query used by CommandPalette.
  const projectsQuery = useQuery<Project[]>({
    queryKey: ["workspace-projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!res.ok) return [];

      const data = (await res.json()) as {
        projects?: Project[];
      };

      return data.projects ?? [];
    },
  });

  const projects = projectsQuery.data ?? [];

  const selectedProject = projects.find(
    (project) => project.project_id === selectedProjectId
  );

  const entries: ProjectMenuEntry[] = [
    ...projects.map((project): ProjectMenuEntry => ({
      id: project.project_id,
      kind: "project",
      project,
    })),
    {
      id: "new-project",
      kind: "new-project",
    },
    {
      id: "manage-projects",
      kind: "manage-projects",
    },
  ];

  // Restore the persisted project selection when the component mounts.
  useEffect(() => {
    const savedProjectId = window.localStorage.getItem(SELECTED_PROJECT_KEY);

    if (savedProjectId) {
      setSelectedProjectId(savedProjectId);
    }
  }, []);

  // Synchronize the selected project with the URL.
  // An explicitly selected valid URL project takes precedence over localStorage.
  // Otherwise, restore the saved project without removing other query parameters.
  useEffect(() => {
    if (!projectsQuery.data || location.pathname !== "/projects") {
      return;
    }

    const params = new URLSearchParams(location.search);
    const urlProjectId = params.get("project");

    if (urlProjectId) {
      const urlProject = projects.find(
        (project) => project.project_id === urlProjectId
      );

      if (urlProject) {
        window.localStorage.setItem(SELECTED_PROJECT_KEY, urlProjectId);
        setSelectedProjectId(urlProjectId);
        return;
      }
    }

    const savedProjectId = window.localStorage.getItem(SELECTED_PROJECT_KEY);

    if (!savedProjectId) return;

    const savedProject = projects.find(
      (project) => project.project_id === savedProjectId
    );

    if (!savedProject) return;

    setSelectedProjectId(savedProjectId);

    if (urlProjectId !== savedProjectId) {
      params.set("project", savedProjectId);

      navigate(
        {
          pathname: "/projects",
          search: `?${params.toString()}`,
          hash: location.hash,
        },
        { replace: true }
      );
    }
  }, [
    projectsQuery.data,
    location.pathname,
    location.search,
    location.hash,
    navigate,
  ]);

  // Return keyboard focus to the trigger whenever the dropdown closes.
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      triggerRef.current?.focus();
    }

    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // Focus the selected project when the dropdown opens.
  useEffect(() => {
    if (!isOpen) return;

    const selectedIndex = entries.findIndex(
      (entry) =>
        entry.kind === "project" && entry.id === selectedProjectId
    );

    const initialIndex = selectedIndex >= 0 ? selectedIndex : 0;

    setActiveIndex(initialIndex);
    itemRefs.current[initialIndex]?.focus();
  }, [isOpen, projects.length, selectedProjectId]);

  const closeMenu = () => {
    setIsOpen(false);
  };

  const focusEntry = (index: number) => {
    if (!entries.length) return;

    const nextIndex = (index + entries.length) % entries.length;

    setActiveIndex(nextIndex);
    itemRefs.current[nextIndex]?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusEntry(activeIndex + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusEntry(activeIndex - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusEntry(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusEntry(entries.length - 1);
    }
  };

  const selectProject = (project: Project) => {
    window.localStorage.setItem(
      SELECTED_PROJECT_KEY,
      project.project_id
    );

    setSelectedProjectId(project.project_id);
    closeMenu();

    // Preserve existing query parameters such as create=task and scope=mine.
    const params = new URLSearchParams(location.search);
    params.set("project", project.project_id);

    navigate({
      pathname: "/projects",
      search: `?${params.toString()}`,
      hash: location.pathname === "/projects" ? location.hash : "",
    });
  };

  const openNewProject = () => {
    closeMenu();
    navigate("/projects?create=project");
  };

  const openProjectManagement = () => {
    closeMenu();
    navigate("/projects");
  };

  const entryButtonStyle = (
    index: number,
    isPrimary = false
  ): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    width: "100%",
    padding: "10px 11px",
    border: `1px solid ${
      index === activeIndex || isPrimary
        ? "var(--pm-accent)"
        : "var(--pm-border)"
    }`,
    borderRadius: "var(--pm-radius-sm)",
    background:
      index === activeIndex
        ? "var(--pm-accent-soft)"
        : isPrimary
          ? "var(--pm-accent)"
          : "var(--pm-glass)",
    color: isPrimary
      ? "var(--pm-accent-ink)"
      : "var(--pm-text)",
    textAlign: "left",
    font: "inherit",
    cursor: "pointer",
    outline: "none",
  });

  return (
    <div
      className="pm-project-switcher"
      style={{
        position: "relative",
        width: "100%",
        zIndex: isOpen ? 81 : undefined,
      }}
    >
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="pm-workspace-switcher"
        style={{
          width: "100%",
          textAlign: "left",
          font: "inherit",
          color: "var(--pm-text)",
          cursor: "pointer",
        }}
        aria-label={
          selectedProject
            ? `Choose project. Current project: ${selectedProject.name}`
            : "Choose project"
        }
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="pm-workspace-glyph">PM</span>

        <span>
          <small>Project</small>
          <strong>
            {selectedProject?.name ?? "Select project"}
          </strong>
        </span>

        <Icon name="chevron" size={14} />
      </button>

      {isOpen ? (
        <>
          <div
            className="pm-popover-backdrop"
            role="presentation"
            onMouseDown={closeMenu}
          />

          <div
            id={menuId}
            className="pm-project-switcher-menu"
            role="menu"
            aria-labelledby={triggerId}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={handleMenuKeyDown}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              zIndex: 82,
              width: "min(320px, calc(100vw - 32px))",
              maxHeight: "min(70vh, 520px)",
              overflowY: "auto",
              boxSizing: "border-box",
              padding: "11px",
              border: "1px solid var(--pm-border)",
              borderRadius: "var(--pm-radius-lg)",
              background: "var(--pm-glass-strong)",
              backdropFilter: "blur(22px) saturate(142%)",
              boxShadow: "var(--pm-shadow-float)",
              color: "var(--pm-text)",
            }}
          >
            <div
              style={{
                padding: "5px 5px 12px",
              }}
            >
              <div
                style={{
                  color: "var(--pm-accent)",
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                }}
              >
                PROJECT WORKSPACE
              </div>

              <div
                style={{
                  marginTop: "5px",
                  color: "var(--pm-text-secondary)",
                  fontSize: "11px",
                }}
              >
                Select a project to view its workspace.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: "5px",
              }}
            >
              {projectsQuery.isLoading ? (
                <div
                  style={{
                    padding: "12px 10px",
                    color: "var(--pm-text-muted)",
                    fontSize: "11px",
                  }}
                  aria-live="polite"
                >
                  Loading projects…
                </div>
              ) : projects.length === 0 ? (
                <div
                  style={{
                    padding: "12px 10px",
                    color: "var(--pm-text-muted)",
                    fontSize: "11px",
                  }}
                  aria-live="polite"
                >
                  No projects available.
                </div>
              ) : (
                projects.map((project, index) => {
                  const isSelected =
                    selectedProjectId === project.project_id;

                  return (
                    <button
                      key={project.project_id}
                      ref={(element) => {
                        itemRefs.current[index] = element;
                      }}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      tabIndex={activeIndex === index ? 0 : -1}
                      style={entryButtonStyle(index)}
                      onFocus={() => setActiveIndex(index)}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectProject(project)}
                    >
                      <span
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          minWidth: 0,
                        }}
                      >
                        <strong
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {project.name}
                        </strong>

                        <small
                          style={{
                            fontSize: "9px",
                            color: "var(--pm-text-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "190px",
                          }}
                        >
                          {project.description || "No description"}
                        </small>
                      </span>

                      <span
                        style={{
                          flexShrink: 0,
                          padding: "3px 6px",
                          border: "1px solid var(--pm-border)",
                          borderRadius: "var(--pm-radius-sm)",
                          background:
                            project.status === "active"
                              ? "var(--pm-accent-soft)"
                              : "var(--pm-glass)",
                          color:
                            project.status === "active"
                              ? "var(--pm-success)"
                              : "var(--pm-text-muted)",
                          fontSize: "8px",
                          fontWeight: 650,
                          textTransform: "capitalize",
                        }}
                      >
                        {project.status}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div
              role="separator"
              style={{
                margin: "10px 0",
                borderTop: "1px solid var(--pm-border)",
              }}
            />

            <div
              style={{
                display: "grid",
                gap: "6px",
              }}
            >
              <button
                ref={(element) => {
                  itemRefs.current[projects.length] = element;
                }}
                type="button"
                role="menuitem"
                tabIndex={activeIndex === projects.length ? 0 : -1}
                style={entryButtonStyle(projects.length, true)}
                onFocus={() => setActiveIndex(projects.length)}
                onMouseEnter={() => setActiveIndex(projects.length)}
                onClick={openNewProject}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    fontSize: "11px",
                    fontWeight: 650,
                  }}
                >
                  <Icon name="plus" size={14} />
                  New project…
                </span>
              </button>

              <button
                ref={(element) => {
                  itemRefs.current[projects.length + 1] = element;
                }}
                type="button"
                role="menuitem"
                tabIndex={activeIndex === projects.length + 1 ? 0 : -1}
                style={entryButtonStyle(projects.length + 1)}
                onFocus={() => setActiveIndex(projects.length + 1)}
                onMouseEnter={() => setActiveIndex(projects.length + 1)}
                onClick={openProjectManagement}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    fontSize: "11px",
                    fontWeight: 550,
                  }}
                >
                  <Icon name="projects" size={14} />
                  Manage projects…
                </span>

                <Icon
                  name="chevron"
                  size={12}
                />
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
```

SHA-256: `64d3b8a8b5419c95cab86ecee551b11f18939e0d9c2b540fe2183de2e82e35b5`

