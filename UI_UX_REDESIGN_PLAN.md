# Project Manager — UI/UX Redesign Plan v4 — approved glass direction

**Status:** implementation of the approved frontend visual foundation is in progress locally. This document remains the design and scope reference; it does not authorize an Automation Studio runtime, new automation data storage, or live connector side effects.

## 1. What changes after reviewing the complete research

The complete shared report confirms a three-system model:

1. **Project Manager** organizes people, tasks, dependencies, deadlines, and decisions.
2. **Automation Studio** orchestrates approved workflows, integrations, and human gates.
3. **Git/development tools** build, test, and deploy the software.

The redesign must not merge those responsibilities into one crowded screen. The earlier plan kept Automation Studio too abstract. This revision gives it an explicit, separate product area, while keeping the everyday workspace task-first.

## 2. Product posture

**A precise work operating system for humans and AI agents: calm in daily use, explicit under pressure.**

- A human can see the next important decision in seconds.
- A task remains the source of truth; List, Board, Calendar, and Project views are lenses over the same record.
- AI/automation actions are visible, attributable, reviewable, and never cosmetically presented as completed before the backend confirms them.
- The product is deliberately opinionated: no deep nesting, no default settings maze, no dashboard made from decorative metric cards.

## 3. Visual system — default: Obsidian Signal Glass

**Approved default:** **Obsidian Signal Glass** — graphite-black glass with **crystal-bright-blue** emphasis.

The workspace is a dark graphite field rather than a navy UI. Glass is a structural material: it separates rails, working panels, inspectors, menus, dialogs, and overlays without turning every row into a glowing card.

| Token role | Default value | Usage |
|---|---:|---|
| Workspace | `#080B11` | graphite-black application field |
| Glass rail | `rgba(10,14,22,.82)` | persistent navigation plane |
| Glass panel | `rgba(19,27,41,.66)` | cards, panels, menu surfaces |
| Raised glass | `rgba(30,42,63,.76)` | active / overlay surfaces |
| Glass border | `rgba(182,211,255,.15)` | translucent edge separation |
| Primary text | `#F3F8FF` | soft high-contrast text |
| Secondary text | `#A7B8CE` | metadata and supporting text |
| Crystal blue accent | `#63C6FF` | primary action, selection, focus, active navigation |
| Accent ink | `#061018` | text/icon on a crystal-blue primary action |

### Glassmorphism rules

- Use `backdrop-filter: blur(20px) saturate(135%)` only on genuine layered surfaces: the rail, panels, dialogs, popovers, command palette, and inspector.
- Use a one-pixel translucent rim plus a restrained inset highlight to communicate glass depth; avoid opaque blue borders and oversized neon glow.
- Preserve opaque-ish data rows inside a glass panel when density and readability matter. Glass is for hierarchy, not visual fog.
- Use blue only for the intended interactive signal. Semantic success, warning, danger, and information states remain independent from the user-selected accent.
- Respect `prefers-reduced-motion`; movement should show spatial continuity, not create decorative spectacle.

## 4. Theme and accent customization

**Obsidian Signal Glass** remains the default for every new user. Presets are token maps, not separate layouts:

| Theme | Surface posture | Accent |
|---|---|---|
| **Obsidian Signal Glass — default** | graphite-black glass | crystal-bright blue `#63C6FF` |
| Prism Violet | charcoal glass | `#B69CFF` |
| Aurora Teal | smoked teal glass | `#78E4D3` |
| Forge Amber | warm graphite glass | `#FFC071` |
| Juniper | deep green glass | `#85E3AD` |
| Porcelain | optional daylight glass | cobalt `#4773D8` |

### User customization feature

- Settings → Appearance and the global theme control expose the same theme chooser.
- The user can choose a preset, use the native color picker, or enter a `#RRGGBB` color code.
- A valid custom accent updates only `--pm-accent`, `--pm-accent-rgb`, and contrast-aware `--pm-accent-ink`; it does not replace semantic status colors or layout tokens.
- The selected preset and custom accent are persisted locally per browser as a UI preference. It must load before React mounts to avoid a flash of an incorrect theme.
- Invalid hex values are rejected with inline feedback. The primary-button ink is calculated for contrast against the selected accent.

## 5. Information architecture

### Global shell

```
Workspace switcher
├── Overview
├── My work
├── Projects
│   └── Project context: Overview · Work · Board · Calendar · Activity
├── Review queue
├── Project Canvas             (planning/diagram tool)
├── Automation Studio          (future, executable-workflow tool)
├── Integrations
├── Git activity
├── People & access
└── Settings
    └── Appearance
```

### Core screen hierarchy

| Surface | Archetype | What it prioritizes |
|---|---|---|
| Overview | Monitor + Operate | focus queue, blocked work, due work, recent decisions |
| My work | Operate | personal next actions and fast status changes |
| Project work | Operate | one project’s List/Board/Calendar lenses over shared tasks |
| Task detail | Command + Inspect | task context, dependency graph, checklist, conversation, audit trail |
| Review queue | Decide | human approvals and their real consequences |
| Project Canvas | Explore | visual planning, mappings, and task links only |
| Automation Studio | Command + Inspect | workflow authoring, execution inspection, safe test/publish controls |
| Settings | Configure | user preference, roles, integrations, non-routine settings |

### Key flows

1. **Fast capture:** command palette or `C` → title → optional project/assignee/due date → create. Advanced fields remain collapsed.
2. **Work movement:** task row/card → status selector or drag → optimistic visual move → confirmed/rolled-back state from the server.
3. **Dependency decision:** blocked task → visible blocking relationship → open predecessor or request a decision; never hide a dependency inside a modal-only view.
4. **Agent proposal:** proposal enters Review Queue → shows actor, trigger, target, change preview, rationale, and impact → approve/reject → immutable resulting event is shown.
5. **Automation flow:** draft workflow → test with redacted sample/pinned data → inspect per-node I/O → require review for consequential actions → publish a version only after explicit authorization.

## 6. Frontend infrastructure hierarchy

The redesigned frontend should be built as a stable application system, not as a collection of route-sized pages.

```
frontend/src/
├── app/
│   ├── AppProviders.tsx        # auth, query client, theme bootstrap, keyboard layer
│   ├── AppShell.tsx            # rail, command bar, contextual dock, responsive shell
│   ├── routes.tsx              # route composition and capability gates
│   └── styles/
│       ├── tokens.css          # semantic, theme, motion, z-index tokens
│       ├── themes.css          # the six theme value maps
│       └── globals.css
├── shared/
│   ├── ui/                     # Button, Dialog, Menu, DataRow, Status, EmptyState, Inspector
│   ├── hooks/                  # keyboard, media-query, debounced persistence
│   ├── lib/                    # date, ID, permission, formatting helpers
│   └── api/                    # typed fetch client + error normalization
├── entities/
│   ├── task/                   # model, query keys, display primitives
│   ├── project/
│   ├── user/
│   ├── agent/
│   └── automation/             # only after backend capability exists
├── features/
│   ├── command-palette/
│   ├── task-capture/
│   ├── task-move/
│   ├── dependency-review/
│   ├── approval-review/
│   ├── theme-selector/
│   └── workflow-editor/
└── pages/
    ├── overview/
    ├── my-work/
    ├── project-workspace/
    ├── review-queue/
    ├── automation-studio/
    └── settings/
```

### Ownership and state rules

| Layer | Owns | Does not own |
|---|---|---|
| API / TanStack Query | server task/project/user/connector/execution data, caching, invalidation | transient modal, drag, or hover state |
| App providers | auth session, theme preference, command palette, toasts, keyboard registry | task-form field state |
| Feature module | an interaction’s reducer, optimistic update, validation, local state | another domain’s API response cache |
| Entity module | typed models, query keys, small reusable views | page layout and navigation policy |
| Page | composition and URL state | duplicated task business logic |

### Interaction infrastructure

- A single **command registry** powers Ctrl/Cmd+K, visible shortcut hints, and permission-aware actions.
- A single **overlay stack** resolves the earlier overlap risk: base `0`, sticky layout `10`, contextual menus `20`, inspector/sheets `30`, dialogs `50`, command palette `60`, toasts `70`.
- Use server-state updates through TanStack Query; keep drag motion DOM-local until drop, then commit once.
- Use an accessible dialog/drawer/menu primitive so Escape, focus return, `aria` relationships, and keyboard navigation are consistent.
- Use typed API clients and normalized error shapes. UI permission gates improve clarity, but backend RBAC remains authoritative.
- Treat loading, empty, offline, error, and mutation-pending states as first-class UI states, not afterthoughts.

## 7. Automation Studio — included as a distinct product area

**Boundary:** Project Canvas visualizes work. Automation Studio executes approved workflow definitions. They must never share a misleading name, a data model, or an implied execution engine.

### Studio navigation

```
Automation Studio
├── Workflows          # drafts, active, paused, archived
├── Executions         # history, errors, filtered runs
├── Approval gates     # queued human decisions
├── Templates          # organization-approved starting points
└── Settings           # credentials references, environments, limits
```

### Builder composition

- **Top bar:** workflow name, draft/published/paused state, version, test, save, publish. Publishing describes real consequences and required approval.
- **Left library:** Trigger, Transform, Decision, Action, Human Gate, Error Handler. Search and approved templates; no arbitrary unbounded plugin gallery.
- **Center canvas:** directional, spatially consistent node graph with clear entry/exit ports and a minimap only when scale requires it.
- **Right inspector:** node settings, input, output, validation, and permission warnings. Input/output data defaults to redacted previews.
- **Bottom execution drawer:** execution history, step timeline, selected-node trace, error location, sample/pinned data, and safe replay constraints.

### Workflow primitives

| Primitive | Example | Guardrail |
|---|---|---|
| Trigger | task status changes | explicit event subscription |
| Transform | normalize task metadata | deterministic, testable output |
| Decision | is dependency blocking? | visible branch labels and test cases |
| Action | notify task owner | scoped connector permissions |
| Human Gate | owner approves a close/reassign action | explicit decision, expiry, audit record |
| Error handler | notify owner / create review item | failure is visible, never silently swallowed |

### Reliability, privacy, and governance requirements

- Draft, test, published, paused, and archived are distinct states.
- Test mode uses sample or pinned data; it cannot silently call a live side-effecting connector.
- Replay is allowed only for non-side-effecting nodes by default. A replay that could send, write, or change status requires an explicit reviewed mode.
- Every run stores a redacted step trace, version ID, initiating actor, timestamps, outcome, and approval link when applicable.
- Credentials are references managed outside the visual node payload. Never render secrets in logs, canvas, exports, or screenshots.
- Version differences, environment boundaries, and rollback must exist before a live workflow can be published.

## 8. Evidence ledger and engineering gaps

| Capability | Current evidence | Redesign status |
|---|---|---|
| Project/task/checklist/dependency CRUD | frontend pages and backend routes exist | preserve; reorganize around shared shell and task detail |
| Dashboard totals/due-state data | `/api/dashboard` route and Dashboard page exist | use as real source only where fields exist |
| Project Canvas | Canvas frontend and REST routes exist | retain as **planning canvas**, not automation runtime |
| Connectors | connector route/service and Connector page exist | retain as integration configuration surface |
| Git links / import-export / people access | frontend and backend routes exist | place inside coherent navigation |
| Automation builder, execution history, node I/O, replay | route scan found no automation/workflow/execution/replay surface | proposed net-new capability requiring design, API, schema, security review, and owner approval |
| Review queue / agent proposal UX | documents/schema describe agents and activity, but verified dedicated UI/API surface is incomplete | proposed; verify backend contract before presentation as live |

## 9. Delivery phases — approved implementation sequence

1. **Foundation:** token system, all six themes, AppShell, command registry, overlay/focus infrastructure, responsive rail/dock behavior.
2. **Core work surfaces:** Overview, My Work, Project workspace, task inspector/detail, List and Board views over existing task data.
3. **Transparency surfaces:** Review Queue, activity/audit presentation, agent context, dependency flow—only after corresponding live contracts are verified.
4. **Automation foundation:** automation domain model, versioning, execution model, permission boundaries, test/sandbox constraints, and audit contract. This is backend and security work, not merely frontend styling.
5. **Automation Studio:** builder, inspector, execution drawer, templates, human gates, progressive rollout in test-only mode before any publish path.
6. **Validation:** keyboard-only flows, screen reader labels, contrast at every theme, reduced motion, responsive layouts, empty/error/latency states, no secrets in logs or previews.

## 10. Explicit decisions remaining

- **Approved default visual language:** Obsidian Signal Glass (graphite-black glass + crystal-bright-blue emphasis), with five additional presets and user-entered custom `#RRGGBB` accent support.
- **Recommended automation scope:** include Automation Studio in the product plan as a separate later-phase module; do not represent the existing Project Canvas as an automation engine.
- **Implementation authorization:** owner approved the glass direction, default theme, theme customization, and implementation of the UI/UX plan. Automation Studio remains a clearly marked future surface until its separate runtime is approved and built.

