# Project Manager — Design System

> **Purpose:** Complete UI/UX design reference for the "Project Manager" project.
> **Source:** Analysis of 10 UI/UX design videos + project decisions.
> **Last updated:** November 2026

---

## 1. Project Overview

| Attribute | Value |
|---|---|
| Project Name | Project Manager |
| Location | `<workspace>\` |
| Repository | `project-manager` (separate from CDES Student Instructor V1.2.0) |
| Tech Stack | React 19 + TS + Vite + Tailwind (frontend) · Express + TS (backend) · SQLite (database) |
| Operating Model | **Model B** (humans + AI agents interact directly) |
| Multi-tenancy | 1 project at a time, up to 15 human users |
| AI Agent Auth | OAuth client-credentials + per-agent API keys fallback |
| Build Timebox | 2 weeks for MVP (Phase 1) |
| Data Isolation | Tenant/project-scoped RBAC |

---

## 2. Design System Architecture

### 2.1 Design Tokens (CSS Custom Properties)

| Category | Tokens |
|---|---|
| Colors | `--color-bg`, `--color-surface`, `--color-primary`, `--color-accent`, `--color-text`, `--color-muted`, `--color-border`, `--color-error`, `--color-success`, `--color-warning` |
| Spacing | `--spacing-xs` (4px), `--spacing-sm` (8px), `--spacing-md` (16px), `--spacing-lg` (24px), `--spacing-xl` (32px) |
| Typography | `--font-sans`, `--font-mono`, `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--text-2xl` |
| Border Radius | `--radius-sm` (6px), `--radius-md` (10px), `--radius-lg` (16px), `--radius-xl` (24px) |
| Elevation | `--elevation-none`, `--elevation-sm`, `--elevation-md`, `--elevation-lg` |
| Transitions | `--transition-fast` (100ms), `--transition-normal` (150ms), `--transition-slow` (300ms) |

### 2.2 Component Inventory

| Component | Types | States |
|---|---|---|
| **Button** | Primary, Secondary, Tertiary, Destructive, Icon-only | Default, Hover, Focus, Pressed, Loading, Success, Error, Disabled |
| **Card** | Task, Project, Agent, Milestone, Notification, Dashboard KPI, Documentation | Default, Hover, Selected, Expanded, Loading |
| **Form** | Task, Project, Agent, Settings, Approval | Input, Label, Error, Success, Disabled |
| **Toggle** | Notifications, Automation, Agent activation | On, Off, Loading |
| **Navigation** | Tabs, Sidebar, Breadcrumbs | Active, Inactive, Hover, Loading |
| **Menu** | Dropdown, Contextual, Overflow | Open, Closed, Disabled |
| **Icon** | Animated (Play/Pause, Download/Progress, Sun/Moon, Search/Close, Send, Lock/Unlock) | Static, Animated, Disabled |

---

## 3. Motion Design System

### 3.1 Spring Physics
- **Button press**: Sink to 95% of original size, then spring back (duration ~100ms)
- **Toggle**: Stretch, overshoot slightly, settle into final position (spring-based)
- **Icon morphing**: Continuous visual relationship between states (300ms)

### 3.2 Key Animations

| Animation | Duration | Description | Application |
|---|---|---|---|
| Button press | ~100ms | Sink then spring back | All primary/important buttons |
| Card expand | ~350ms | Ease-out expansion | Task details, panels, document previews |
| Success animation | ~470ms | Circle draws → checkmark | Task completion, uploads, form submits |
| Icon morph | ~300ms | One icon transforms to another | Play/Pause, Download/Progress, etc. |
| Number transition | ~100ms staggered | Rolling digits | KPIs, completion %, overdue counts |
| Drag to reorder | Per item | Lift 105%, spatial reflow | Kanban cards, priorities, milestones |
| Pull to refresh | Per gesture | Resist, nonlinear | List/board refresh, activity feeds |

### 3.3 Motion Rules
- **No motion for every element**: Reserve for meaningful state transitions
- **Optional disable**: User can globally disable nonessential motion
- **Accessibility**: Respect `prefers-reduced-motion` media query
- **Staggered transitions**: 100ms stagger for lists/elements appearing together

---

## 4. UI Components

### 4.1 Buttons

- **Primary**: Bold, accent color, 44px minimum height, 24px side padding
- **Secondary**: Outlined, visible boundary, neutral color
- **Tertiary**: Text-only, minimal style
- **Destructive**: Red/warning color, confirm before action
- **Icon-only**: 44px touch target, visible icon, accessible label

**States:** Default → Hover → Focus → Pressed → Loading → Success / Error → Disabled
- **Destructive button**: Never show misleading success state before deletion is confirmed

### 4.2 Cards

**Spec:**
- **Visual hierarchy**: Task title is dominant element, rest supports
- **Spacing**: Consistent rhythm, breathing room between elements
- **Color**: Neutral foundation + single accent (status colors)
- **Elevation**: Light shadow for depth, stronger for selected/active
- **Border radius**: Small (6px) for inline cards, medium (10px) for standalone

**Practical example - Task Card:**
1. Task title (largest text, 1.5-2xl)
2. Status badge (pill, colored)
3. Assignee (avatar + name)
4. Due date (relative + absolute)
5. Action buttons (drag, edit, archive)

### 4.3 Forms

**Spec:**
- **Single primary action** per form (e.g., "Create Task" vs "Save Draft")
- **Persistent labels**: Never disappear on input (clear when typing)
- **Inline validation**: Error messages near relevant fields
- **Surface elevation**: Subtle border, lift, shadow for forms
- **Submission feedback**: Stateful button (loading → success/error)

**Validation rules:**
- Validate on blur (not on every keystroke)
- Show errors inline, near relevant fields
- Preserve user-entered data after validation failures
- Logical tab order for keyboard navigation

### 4.4 Navigation

- **Tab bar**: Pill slides between active states (not disappear/reappear)
- **Switcher views**: List, Board, Calendar, Timeline, Activity feed
- **Context menus**: Expand from trigger button origin (not centered)
- **Keyboard navigation**: Tab, Enter, Escape, arrow keys

---

## 5. AI-Agent Communication UI

### 5.1 Architecture
**Separate chat panel per task.** Each task has its own communication thread.

### 5.2 Design

| Feature | Specification |
|---|---|
| Sender-based alignment | Human messages (right), AI-agent messages (left) |
| Message grouping | Consecutive same-sender messages grouped |
| Color differentiation | Human: neutral, Agent: accent color |
| Timestamps | Intelligent (relative + absolute), not repeated |
| Delivery status | Submitted → Received → Acknowledged → Processing → Responded → Failed |
| Mentions | Highlight relevant participants |
| Attachments | Keep deliverables near discussion |
| Unread indicators | For new information |

### 5.3 Message Flow States
1. **Submitted**: User sends message
2. **Received**: Agent acknowledges receipt
3. **Processing**: Agent is working
4. **Responding**: Agent drafting response
5. **Acknowledged**: Human acknowledged response
6. **Failed**: Agent failed to process (with retry option)

---

## 6. Dashboard Design

### 6.1 Visual Hierarchy

| Element | Specification |
|---|---|
| KPI cards | Task completion %, outstanding tasks, due today, project progress |
| Progress bars | Visual representation of metrics (data visualization) |
| Task list | Basic list view (MVP only) |
| Board view | Kanban (MVP only, enhanced in Phase 2) |
| Dynamic data | Live updates, agent activity indicators |

### 6.2 Data Visualization Rules
- Show progress bars, not just numbers
- Use consistent color coding (status colors)
- Human-readable labels, not technical jargon
- Dynamic updates without requiring page refresh

---

## 7. Ethical UX

### Mandatory Policies
| Situation | Design Requirement |
|---|---|
| Deleting a task | Clear consequences, confirmation dialog |
| Removing an AI agent | Explain what happens to assigned work |
| Changing permissions | Disclose consequences before saving |
| Connecting integrations | Request explicit authorization |
| Inviting team members | Clearly disclose invitation actions |
| Removing project data | Make deletion/recovery rules understandable |
| Disabling automation | Make the control easy to locate |

### Forbidden
- Fake urgency
- Hidden costs or consequences
- Manipulative confirmation wording
- Obstructed cancellation
- Deceptive consent choices
- Fake loading progress
- Unrequested optional selections

---

## 8. Performance & Perceived Performance

### Implementation
- **Optimistic UI**: Show intent immediately, rollback on failure
- **Skeleton screens**: Display placeholder shapes during load
- **Progressive rendering**: LQIP for images/attachments
- **Background uploads**: Begin once user selects, with visible/cancellable status
- **Live status indicators**: Show real operational activity

### Rules
- **Never** fabricate progress (show indeterminate indicator when unknown)
- **Never** use false success states
- Animations must not block user input
- Large datasets must remain responsive
- Users must be able to disable nonessential motion

---

## 9. Accessibility

### Requirements
| Category | Specification |
|---|---|
| Color contrast | WCAG AA: 4.5:1 normal text, 3:1 large text |
| Focus indicators | Visible, high contrast |
| Keyboard navigation | Full support (Tab, Enter, Escape, arrow keys, shortcuts) |
| Reduced motion | Respect `prefers-reduced-motion` media query |
| Screen readers | Alternative text for icons, semantic HTML, ARIA labels |
| Touch targets | 44px minimum for interactive elements |

---

## 10. AI-Agents (Model B)

### Agent Identity & Authentication
- **OAuth client-credentials flow**: Backend authentication for agents
- **Per-agent API keys**: Fallback, simpler to implement
- **Credential pool**: Stores per-agent keys, scoped to role hierarchy

### Agent Hierarchy (Example)

| Agent Type | Role | Capabilities |
|---|---|---|
| Researcher | Low | Search, gather info, suggest |
| Executor | Medium | Create tasks, update status, assign |
| Admin | High | Full access, manage agents, delete |

### Agent Actions (All allowed per user decision)
- Create tasks, update status, assign tasks, delete tasks, change dependencies, submit deliverables, establish dependencies, communicate (chat panel per task)

### Human Oversight
- **Agents propose actions** → humans approve
- Agent must be able to suggest, not force
- Human approval required for critical actions (deletion, permission changes)

### Audit Requirements
- Agent name, trigger, reasoning summary
- Action taken, target, timestamp
- Human approval/decision record
- Reason why (for traceability)

---

## 11. Integration Requirements

### Project Manager Sync
- **Trigger**: User-initiated only (not automatic)
- **Permissions**: Read, pull, push, edit — only with explicit human/role approval
- **Sync types**: Read, pull, push, edit
- **Consent**: Required for each sync operation

### Git Integration (Phase 2/3)
- One-way: `git commit "Fixes #42"` → mark task done
- Bidirectional (detect task status changes) — NOT in MVP
- Manual "mark done" in MVP; audit log captures context

### Export/Import (MVP)
- **Formats**: JSON, CSV (Markdown later)
- **Restrictions**: Role-based (owner, editor only)
- **PII protection**: Mask/redact student personal data
- **Signed URL**: Expiration (5-10 min)
- **Testing**: Multi-homing and dependencies survive export

---

## 12. User Customization (Canva-Like)

### Custom Canvas (Phase 2/3)
- **Drag-and-drop canvas**: Like Canva
- **Components**: Square, line, arrow, circle, text, image
- **Connections**: Link task cards together (connections/dependencies)
- **Customization**: Edit any component (text, color, size, position)
- **Save/Load**: Save canvas layouts, load for different projects

### Design System Rules for Customization
- All components must use designated design tokens
- Visual hierarchy must be maintained
- Accessibility must be preserved during customization
- Export/import must work for custom designs

---

## 13. Implementation Roadmap

| Phase | Deliverables | Acceptance Criteria |
|---|---|---|
| **Phase 1: Core** | Project + Tasks + Checklists + Dependencies + Comments + RBAC + Audit log + Agent auth + Human approval + AI model select + Export (JSON+CSV with PII masking) | User can create task, assign, set due date, change status, comment, see audit log. Agent can propose, human approves, AI model selected. Export works with PII masking. |
| **Phase 2: Views & Power** | Import/Export (JSON, CSV, Markdown), User profile + access tracking, Simple dashboard, Git-commit linking (one-way) | User can import CSV, view user access locations, see basic dashboard, commit → task close. |
| **Phase 3: Custom Canvas** | Drag-and-drop canvas, Component library (square, line, arrow, circle, text), Task card connections, Custom UI/UX editing, Save/load canvas layouts | User can create custom dashboard with components, connect task cards, customize appearance, save/load layouts. |

---

## 14. Open Questions

1. **Agent hierarchy**: What specific agent names/roles will you use? (e.g., "researcher", "executor")
2. **PII scope**: Which student fields are considered personal data that must be masked in exports?
3. **Sync trigger**: Who initiates Project Manager sync — the user, or can AI agents trigger it? (Answer: User-initiated only)

---

---

## 15. UX Laws and Principles

### 15.1 Laws from Video 03 (Six Laws That Make Interfaces Easier to Use)

| Law | Principle | Application |
|---|---|---|
| **Jakob's Law** | Put it where they look | Place search, settings, navigation, task actions, and user profiles in familiar locations. Use familiar conventions rather than inventing new navigation patterns. |
| **Steering Law** | Narrow paths slip | Make interaction paths easy to navigate. Wider interaction areas for important controls. Allow pointer to move from menu trigger to submenu without the submenu disappearing unexpectedly. |
| **Prägnanz** | Simple shapes read first | People perceive visual elements in simplest, most organized forms. Simplify icons, task status indicators, navigation symbols, and dashboards. |
| **Working Memory** | Show it, don't ask | Reduce cognitive load. Show recently viewed projects, tasks, filters, and frequently used commands. Recognition over recall. |
| **Active User** | Nobody reads the manual | Provide contextual guidance and progressive onboarding. Tooltips, first-use explanations, and contextual help. Make these dismissible and avoid repeated interruptions. |
| **Default Effect** | The default decides | Sensible defaults reduce configuration effort. Default task statuses, notification preferences, view settings, and standard workflow configurations. Defaults must be sensible, transparent, and safe. |

### 15.2 Laws from Video 06 (Six Laws That Change How Users Interact)

| Law | Principle | Application |
|---|---|---|
| **Closure** | Half a card says swipe | Partially visible next card at carousel edge communicates additional content exists. Best used as peek-ahead affordance for horizontal scrolling. |
| **Figure-Ground** | Dim the background | Background becomes darker when a confirmation dialog opens. Focuses attention on the active dialog. |
| **Banner Blindness** | Banners get skipped | Avoid presenting important warnings as decorative promotional banners. Put important information directly beside relevant tasks or project information. |
| **Parkinson's Law** | Shrink the task | Reduce input burden. Autocomplete, post-code lookup to auto-populate address, suggest project references, reuse previous assignments. Important: Parkinson's Law traditionally describes work expanding to fill time; the demonstrated technique is better described as form simplification. |
| **Connectedness** | Lines make groups | Elements connected by visual lines are perceived as belonging together. Use connected progress steppers for project milestones, task approval pipelines, and onboarding stages. |
| **Choice Overload** | Fewer choices, more yes | More choices increase decision time. Reduce choices using categories, search, filters, and progressive disclosure. Use Hick-Hyman Law. |

---

## 16. Navigation and Command Palette

### 16.1 Global Command Palette

A searchable interface allowing users to find information and execute actions without navigating through menus. This is one of the most valuable features for a growing project.

**Implementation:**
- **Trigger**: Ctrl + K (or equivalent)
- **Input-first hierarchy**: Search input prominently at top
- **Grouping**: Results separated by category:
  - Actions
  - Pages
  - Recent items
  - Tasks
  - Projects
  - People
  - Documents
  - AI agents
  - Comments
  - Decisions

**Features:**
- Query-term highlighting (show why a result matched)
- Search suggestions as user types
- Keyboard navigation (arrow keys to navigate, Enter to execute, Esc to close)
- Explicit selection state (Enter needs a target; prevent accidental execution)
- Keyboard shortcuts shown beside relevant commands and in palette footer
- Low-latency filtering (~150ms) with animated selection

**Command Palette Modes:**
- **Search mode**: Find existing information (Tasks, Projects, People, Documents, Comments, Decisions, AI agents)
- **Command mode**: Execute operations (Create task, Assign task, Change status, Open project, Create document, Start workflow, Navigate to settings)

For sensitive operations, present a confirmation or review step before executing.

### 16.2 Navigation Architecture
- **Familiar left-hand navigation**: Respect Jakob's Law — use conventional patterns
- **Recently accessed items**: Show in navigation (working memory)
- **Contextual guidance**: Tooltips, first-use explanations, shortcut hints (dismissible)
- **Command palette**: Global access from every major workspace screen

---

## 17. Workflow and Status Communication

### 17.1 Real-Time Status Tracking

The same questions exist in PM as in delivery tracking:
- What is happening?
- Where is the current state?
- How long will it take?
- Who is responsible?
- Has anything gone wrong?
- What should I expect next?

### 17.2 Execution Timeline

Build a structured task execution timeline for every important task:

| Stage | Description |
|---|---|
| Task assigned | Task spec received by assigned agent |
| Requirements reviewed | Task specification inspected |
| Execution | Currently implementing approved changes |
| Testing | Not started / In progress |
| Human review | Awaiting completion of testing |

**Stages to track:**
- Requested → Accepted → Acknowledged → In progress → Blocked → Completed → Failed → Awaiting human review

### 17.3 Status Communication Principles

| Technique | Specification |
|---|---|
| **Range-based ETA** | Show 12–15 minutes, not "exactly 12 minutes". Use ranges for uncertain estimates. |
| **Multi-stage progress** | Show journey (e.g., Confirmed → Preparing → On the way → Delivered) |
| **Live tracking** | Execute activity timeline (not literal geographic tracking) |
| **Humanization** | Show agent's name, role, current status, contact/communication controls |
| **Persistent instructions** | Task requirements and acceptance criteria visible to agent during execution |
| **Fold what can wait** | Collapsible details for metadata, execution logs, audit history, attachments |

### 17.4 Status States (Expanded)

```
Submitted → Received → Acknowledged → Processing → Completed → Failed
```

Also:
- Awaiting human review
- Blocked (with reason)
- Deferred (for later)

---

## 18. Form and Decision Experience

### 18.1 Checkout-Inspired Principles for Task Creation

| Principle | Application |
|---|---|
| **Express Pay**: Fastest path first | Fast path for ordinary tasks; additional details when required |
| **Guest by default**: No account wall | Avoid forcing excessive information before first task |
| **Live formatting**: Format as they type | Input masking for dates, phone numbers, currency, IDs, structured references |
| **Trust in place**: Contextual reassurance | Display permission explanations, file-security info, AI-agent access restrictions beside relevant controls |
| **A real date**: Specific deadline | Show specific task deadlines, milestone dates, estimated completion windows |
| **Price on the button**: Transparent consequences | Show consequences before committing (e.g., "Delete 5 tasks", "Remove 2 members") |

### 18.2 Progressive Disclosure Pattern

```
Quick task creation (required fields only):
Task title ◀ ──┐
Assignee    ◀─┤
Due date    ◀─┤
[Create Task ───]

Advanced details (optional, expanded):
Priority:
Tags:
Sprint/Project:
Dependencies:
Checklist:
```

### 18.3 Form Optimization

| Technique | Implementation |
|---|---|
| Fast task creation | Minimize fields for simple tasks |
| Input formatting | Real-time formatting for structured fields |
| Autocomplete | Suggestions for assignment, project, agent, tags |
| Contextual validation | Inline errors near relevant fields |
| Intelligent defaults | Sensible presets for status, notifications, view settings |
| Persistent instructions | Task requirements visible to agent during execution |
| Transparent consequences | Show impact of destructive actions |

---

## 19. Motion and Gesture System (Expanded)

### 19.1 iOS-Inspired Principles

| Technique | Application |
|---|---|
| **Stable touch targets** | Control should not chase the finger unless direct manipulation requires |
| **Spring animations** | Spring-based (not time-driven) for natural movement |
| **Momentum scrolling** | Inertial scrolling for long lists, task lists, activity streams |
| **Elastic overscroll** | Rubber-band at scroll boundaries (selective for desktop) |
| **Interruptible animations** | Change your mind — respond to new interactions mid-animation |
| **Continuous corners** | Smooth continuous corner curvature (superellipse), not just CSS border-radius |

### 19.2 Animation Engineering Techniques

| Animation | Technical Implementation |
|---|---|
| **Spatial movement** | Translate between source and destination |
| **Component morph** | Animate width, opacity, internal layout (e.g., Save → Saving → Saved ✓) |
| **Staggered entrance** | Controlled delays (e.g., 70ms apart) for sequential items |
| **Gesture following** | Map pointer position to transform (card follows finger while swiping) |
| **3D flip** | rotateY() with perspective (use sparingly for task details) |
| **Spring oscillation** | Damped spring (e.g., notification swing ±24°, settling 760ms) |

### 19.3 Suggested Motion Parameters (Test Against Patterns)
| Component | Demonstration value |
|---|---|
| Submit button morph | 270 ms |
| List row stagger | 70 ms |
| Swipe dismissal | Velocity/gesture dependent |
| Card flip | 600 ms |
| Card mid-flip elevation | 8% |
| Notification swing | ±24° |
| Notification settling | 760 ms |

### 19.4 Motion Governance
- Centralize motion tokens and animation configurations
- Avoid decorative animations that interfere with productivity
- Animations must be interruptible and reversible
- Respect `prefers-reduced-motion`

---

## 20. Interaction Feedback

### 20.1 Feedback Patterns

| Pattern | Application |
|---|---|
| **Optimistic UI** | Show intent immediately, rollback on failure |
| **Stateful buttons** | Save → Saving → Saved ✓ (morph, don't swap) |
| **Delivery acknowledgments** | Submitted → Received → Acknowledged → Processing → Completed |
| **Success and error feedback** | Every backend operation has defined success/failure state |
| **Notification animations** | Swing ±24°, settle 760ms (one-time attention, not continuous) |
| **Real-time execution status** | Show actual state transitions, not just animations |

### 20.2 Spatial Continuity
- **Add to cart analogy**: Show where things went
- Task movement between columns: Card visibly moves into new location
- Attach files: Visual indication of where they went

---

## 21. Performance and Responsiveness

| Technique | Implementation |
|---|---|
| **Fast search** | Global command palette with live filtering (~150ms) |
| **Responsive interaction** | Frequent operations require few steps |
| **Background operations** | Background processing with clear status |
| **Progressive rendering** | LQIP for images, skeleton screens |
| **Efficient list rendering** | Virtualization for large datasets |
| **Responsive drag-and-drop** | Smooth Kanban interactions |

### Performance Rules
- Never fabricate progress (use indeterminate indicators when unknown)
- Never display false success states
- Animations must not block user input
- Efficient React rendering (avoid unnecessary re-renders)
- Optimize large Kanban boards and project datasets

---

## 22. Ethical UX and Accessibility (Expanded)

### Ethical UX (From Videos 03, 06, 09)

| Principle | Requirement |
|---|---|
| **Predictability** | Users know where to find things and how interactions work |
| **Visibility** | Important information and system states should be visible |
| **Efficiency** | Frequent operations require few steps |
| **Transparency** | Users understand what software and AI agents are doing |
| **Consistency** | Every component follows the same design and interaction language |

### Accessibility
- Keyboard navigation
- Visible focus states
- Screen-reader labels
- Appropriate touch-target dimensions
- Sufficient color contrast (WCAG AA: 4.5:1 text, 3:1 large)
- Reduced-motion preferences
- Meaningful non-color status indicators

### No Manipulative Engagement
- No fake urgency
- No guilt-based notifications (e.g., "don't break your streak")
- No hidden consequential actions
- No obstructed cancellation
- No fabricated progress
- No manipulative defaults
- May celebrate consistency positively (not with loss aversion guilt)

---

## 23. Implementation Priority (Comprehensive)

| Priority | Feature | Related Video |
|---|---|---|
| **P0** (MVP) | Command palette and global search | 04 |
| **P0** (MVP) | Clear task workflows and execution timelines | 05 |
| **P0** (MVP) | Good defaults, familiar navigation, cognitive-load reduction | 03, 06 |
| **P0** (MVP) | Reusable forms and contextual validation | 01 |
| **P0** (MVP) | Task execution timeline with audit log | 05 |
| **P0** (MVP) | Role-based permissions | Project decisions |
| **P1** (Phase 2) | Autocomplete and smart suggestions | 04, 09 |
| **P1** (Phase 2) | Real-time task and agent status | 05, 09 |
| **P1** (Phase 2) | Optimized touch and gesture interactions | 08 |
| **P1** (Phase 2) | Spring-based motion and component morphing | 10 |
| **P1** (Phase 2) | Actionable dashboard (basic) | 05 |
| **P2** (Phase 3) | Advanced 3D card flips and decorative animations | 07, 10 |
| **P2** (Phase 3) | Sophisticated attention and reward animations | 09, 10 |
| **P2** (Phase 3) | Canva-like custom canvas | Project decisions |

### Critical Emphasis (From Video 09)
1. **Command Palette**: Navigation complexity grows with project size
2. **Task Execution Timeline**: Essential for human + AI agent environment
3. **Contextual Interaction**: Present relevant actions when needed (not all at once)

---

## 24. Cumulative Design System Architecture

| Category | Videos | Key Elements |
|---|---|---|
| **Visual Foundation** | 02, 03, 06 | Hierarchy, spacing, typography, color, icons, elevation |
| **Navigation & Info Architecture** | 03, 04 | Familiar nav, command palette, keyboard shortcuts, search results grouping |
| **Workflow & Status Communication** | 01, 05, 09 | Progress tracking, execution timelines, AI-agent identity, approval workflows |
| **Form & Decision Experience** | 01, 02, 06 | Fast task creation, input formatting, autocomplete, progressive disclosure |
| **Motion & Gesture System** | 07, 08, 10 | Spring animations, momentum, gestures, 3D transitions, morphing |
| **Interaction Feedback** | 01, 07, 09, 10 | Stateful UI, delivery acknowledgments, notifications, execution status |
| **Performance & Responsiveness** | 04, 05, 08 | Fast search, virtualization, background ops, progressive loading |
| **Ethical UX & Accessibility** | 03, 06, 09 | Transparency, safe defaults, reduction of cognitive load |

---

## 25. Consolidated Design System Specification (for Developers/AI Agents)

> **Use this prompt to hand off to development AI agents:**

> Act as a Senior Product Designer, UX Architect, and Frontend Engineer.
>
> I have researched 10 UI/UX design demonstrations covering checkout UX, pricing layouts, UX psychology, command palettes, tracking interfaces, Gestalt principles, media controls, iOS interactions, behavioral design, and advanced motion engineering.
>
> **Your responsibility:** Translate these principles into a consistent UI/UX architecture for the Project Manager application.

> **A. Visual and Information Design**
> - Strong visual hierarchy
> - Consistent typography, spacing, border radii, elevation
> - Accessible color contrast
> - Clear primary/secondary actions
> - Semantic color usage

> **B. Navigation and Command Palette**
> - Global command palette (Ctrl + K)
> - Search tasks, projects, users, AI agents, documents, comments, decisions
> - Group results by category (Actions, Pages, Recent items, Tasks, Projects, People, Documents)
> - Show keyboard shortcuts
> - Prevent execution when no valid result is selected
> - Support confirmation for consequential operations

> **C. Task and Execution Tracking**
> - Task execution timelines with clear workflow stages
> - Human and AI-agent identities and ownership
> - Actual completion events, historical activity records
> - Realistic estimated completion ranges
> - Persistent task requirements
> - Expandable execution logs
> - Status states: Requested, Accepted, Acknowledged, In progress, Blocked, Completed, Failed, Awaiting human review

> **D. Form and Interaction Design**
> - Fast task creation (quick path + advanced details)
> - Persistent labels, input formatting, autocomplete
> - Contextual validation, intelligent defaults
> - Inline errors, explicit success feedback
> - Progressive disclosure

> **E. Motion and Gesture System**
> - Spring animations, momentum scrolling, interruptible transitions
> - Component morphing, staggered list entrances
> - Gesture-following interactions, contextual menu expansion
> - Notification feedback, stable task movement
> - Centralize motion tokens and animation configurations

> **F. Performance**
> - Responsive search, efficient list rendering, virtualization
> - Optimistic UI with error rollback
> - Background processing, progressive loading
> - Honest loading indicators

> **G. Ethical UX**
> - No fake urgency, fabricated progress, manipulative defaults
> - No hidden consequential actions, guilt-based notifications
> - No obstructed cancellation, misleading success indicators
> - Respect user decisions, transparent system behavior

> **H. Accessibility**
> - Keyboard navigation, visible focus states, screen-reader labels
> - Appropriate touch targets, sufficient color contrast
> - Reduced-motion preferences, meaningful non-color status indicators

> **I. Architectural Requirements**
> 1. Use reusable components
> 2. Centralize design tokens
> 3. Centralize motion configurations
> 4. Avoid duplicated frontend logic
> 5. Keep UI state and backend state consistent
> 6. Preserve existing architecture where practical
> 7. Avoid unnecessary dependencies
> 8. Optimize large Kanban boards and project datasets

> **J. Required Deliverables**
> Before implementing: provide assessment of current frontend architecture, design token specification, component inventory, navigation architecture, command palette architecture, task execution visualization, motion system architecture, accessibility requirements, performance risk assessment, implementation roadmap, and acceptance criteria.

---

## 26. Five Foundation Principles

1. **Predictability** — Users know where to find things and how interactions work
2. **Visibility** — Important information and system states should be visible
3. **Efficiency** — Frequent operations require as few steps as reasonably possible
4. **Transparency** — Users understand what the software and AI agents are doing
5. **Consistency** — Every component follows the same design and interaction language

---

---

## 27. Usability and Interaction Laws

### 27.1 Laws from Video 01 (Six UX Laws That Influence Every Screen)

| Law | Principle | Design Lesson |
|---|---|---|
| **Fitts's Law** | Big and close wins | Make important targets large and accessible. Avoid small distant buttons. 44–48px target for touch. |
| **Hick's Law** | Fewer choices, faster | Reduce unnecessary choices. Use progressive disclosure. Show most frequent actions first, advanced in "More". |
| **Chunking** | Four slots, not seven | Organize information into meaningful groups. Task IDs (PROJ-001-025), dates, phone numbers, execution logs. |
| **Doherty Threshold** | Answer in 400 ms | Immediate feedback. Choose from options, not listed spaces, making the choice is intensive, high levels of stimulation associated with high skill levels results in flow. |
| **Proximity** | Close means together | Keep related elements visually close. 8px between label and field, 24px between field groups. |
| **Von Restorff Effect** | Different gets noticed | Use selective visual emphasis for blocked tasks, overdue tasks, critical milestones, human approval requirements, failed AI-agent operations, important warnings. |

**UX Acceptance Criteria:** When reviewing a task-management screen, verify:
- Can users reach main actions easily?
- Are there too many visible choices?
- Is information divided into understandable groups?
- Does the interface acknowledge user actions promptly?
- Are labels and related inputs grouped correctly?
- Are critical tasks visually distinguishable?

### 27.2 Motion and Gesture Techniques from Video 05

| Technique | Animation Details | Application |
|---|---|---|
| **Fan out, don't pop** | ~45° rotation per element, 100ms spacing | Task card action menus, project shortcuts, contextual tool menus |
| **Grow when grabbed** | ~140% scale, bubble trail feedback | Timeline controls, progress sliders, workload filters, date-range selection |
| **Shrink, don't vanish** | 34px → 18px as user scrolls | Project dashboards, Kanban headers, task detail screens |
| **Sink, then lift** | 400ms hold, 5% lift | Task cards, draggable items, contextual selection controls |
| **Stretch, then snap** | 130ms between edge movements | Board-view navigation, project tabs, dashboard carousels, pagination |
| **Push, don't cover** | 86% scale, 150px slide, 800ms | Desktop/mobile sidebars, project navigation, nested panels |

**Motion Governance:**
- Centralize motion tokens and animation configurations
- Animations must be interruptible and not block user input
- Test durations against device performance (sidebar transition recommended shorter than 800ms)

---

## 28. Behavioral UX

### 28.1 Laws from Video 02 (Six More UX Laws: How People Behave)

| Law | Principle | Design Lesson |
|---|---|---|
| **Goal Gradient / Endowed Progress** | Never start at zero | Make genuine progress visible. Use meaningful progress indicators (onboarding, checklists, milestones). Never fabricate progress. |
| **Postel's Law** | Accept it anyway | Be liberal in what you accept. Accept valid input variations (dates, phone numbers, task IDs, emails, search queries). Normalize, then validate strictly. |
| **Tesler's Law** | Someone carries the work | System should absorb repetitive complexity. Automate task inheritance, agent capability loading, subtask context, status updates. Human makes important decisions. |
| **Similarity** | Alike means works alike | Consistent visual patterns: clickable task cards, navigation rows, expandable sections, editable fields, destructive actions, read-only info. |
| **Serial Position** | First and last stick | Place important navigation items in stable, predictable locations. Use frequency-based arrangement. |
| **Peak-End Rule** | End on a high | Provide meaningful completion feedback. Show clear summaries after important workflows. Don't use celebratory animations for every operation. |

### 28.2 Tesler's Law Implementation (High Priority)

| User Action | System Assistance |
|---|---|
| Create a task in a project | Automatically inherit project settings |
| Assign an AI agent | Automatically load the agent's approved capabilities |
| Create a subtask | Inherit relevant parent-task context |
| Change task status | Update related progress indicators |
| Create a recurring task | Automatically populate recurrence settings |
| Attach a document | Associate it with the relevant task |
| Schedule a milestone | Identify potentially affected dependent tasks |

**Rule:** The human should make important decisions. The system should handle repetitive work. Automated values must remain visible and correctable.

### 28.3 Postel's Law Implementation
- Backend should validate data strictly and store it in consistent format
- Forgiving input ≠ accepting invalid/unsafe data
- Normalize legitimate variations, then validate

### 28.4 Priority Order (From Video 02)
1. **Tesler's Law** — automate repetitive project administration
2. **Postel's Law** — make data entry and search forgiving
3. **Similarity** — maintain consistent interaction language
4. **Peak-End Rule** — provide clear completion summaries
5. **Goal Gradient** — use truthful progress visualization
6. **Serial Position** — prioritize frequently used navigation

---

## 29. Premium Visual Composition

### 29.1 Six-Layer Card Architecture (Video 03)

| Layer | Technique | Opacity | Application |
|---|---|---|---|
| 1. Base | Multi-stop linear/directional gradient | — | Selected cards, dashboards, project headers |
| 2. Pattern | Decorative texture overlay | ~8% | Project headers, milestone cards |
| 3. Content | Four primary elements, left-aligned | — | Task cards (title, status, assignee, due date) |
| 4. Rim light | 1px translucent border | ~28% white | Glass-like panels, floating dialogs, selected surfaces |
| 5. Glare | Dynamic tilt-responsive highlight | ~18% white | Optional polish (project cover cards only) |
| 6. Shadow | Two shadow levels (8px, 30px) | — | Modals, floating panels, expanded task cards |

**Selective Application:**
| Component | Recommended Treatment |
|---|---|
| Main dashboard | Subtle gradient and surface hierarchy |
| Project overview cards | Gradient, restrained pattern, and shadow |
| Selected task | Subtle rim and elevation |
| AI-agent profile cards | Gradient and subtle lighting |
| Modal windows | Clear surface separation and shadow |
| Ordinary task lists | Minimal backgrounds and borders |

**Rule:** Premium software is not every component glowing with borders and shadows. Visual treatment communicates importance and hierarchy.

### 29.2 Component Composition Guidelines
- Four primary elements per card: title, status, assignee, due date
- Common left-side alignment
- Minimal content on expanded cards only
- Decorative patterns only behind sparse content

---

## 30. Dark Mode Design Architecture

### 30.1 Six Adjustments (Video 04)

| Adjustment | Before | After | Technique |
|---|---|---|---|
| Background | Pure black #000000 | Near-black #0C1424 | Avoid absolute black; use deep navy |
| Text | White 100% | ~87% opacity | Softened primary text |
| Accent | 2.9:1 contrast | 8.6:1 contrast | Accent-color contrast optimization |
| Surface elevation | — | Level 0–3 graduated | Progressive lightness |
| Images | — | ~82% intensity | Diminished artwork/luminance |
| Shadow/Glow | — | Glow instead of shadow | Emissive accent lighting |

### 30.2 Dark-Mode Elevation Tokens
| Level | Purpose | Color |
|---|---|---|
| Level 0 | Workspace background | #0C1424 |
| Level 1 | Standard card | #141F32 |
| Level 2 | Raised panel | #1C2A40 |
| Level 3 | Floating panel | (lighter than level 2) |

### 30.3 Dark-Mode Design Tokens
```css
--surface-workspace: #0C1424;
--surface-card: #141F32;
--surface-elevated: #1C2A40;
--text-primary: #E6E6E6; (87-100% opacity)
--text-secondary: #9CA3AF; (muted grey)
--text-tertiary: #6B7280; (lower-emphasis grey)
--border-color: #374151; (1px translucent rim)
--color-primary: #6366F1; (strong accent)
--focus-ring: #6366F1; (emissive glow for focused elements)
```

**Dark Mode Principles:**
1. Avoid indiscriminate pure black
2. Maintain readable text contrast (WCAG AA)
3. Use controlled accent colors
4. Establish clear surface elevation levels
5. Ensure selected/interactive states remain recognizable
6. Follow WCAG accessibility requirements
7. Support future light/dark themes through semantic tokens

---

## 31. Motion Design Engineering

### 31.1 Six Motion Techniques (Video 05)

| Technique | Details | Implementation |
|---|---|---|
| **Fan out, don't pop** | ~45° rotation, 100ms spacing | Staggered radial menu expansion |
| **Grow when grabbed** | ~140% scale + bubble trail | Gesture-responsive scaling |
| **Shrink, don't vanish** | 34px → 18px on scroll | Scroll-linked collapsing header |
| **Sink, then lift** | ~400ms hold, 5% lift | Long-press elevation |
| **Stretch, then snap** | 130ms between edge movements | Elastic pagination indicator |
| **Push, don't cover** | 86% scale, 150px slide, 800ms | Spatial navigation push sidebar |

### 31.2 Implementation Recommendations
- **Kanban drag-and-drop**: Centralized drag state machine + spring physics
- **Expandable task details**: Animated height/opacity transitions
- **Collapsing project headers**: Scroll-linked transform + typography
- **View-switching indicators**: Animated tab/breadcrumb transitions
- **Contextual task menus**: Staggered radial expansion
- **Responsive sidebar**: Coordinated translation + scaling

**Motion System Architecture:**
- Centralize all animation configurations
- Use shared spring physics engine
- Keep same timing conventions across application
- Respect `prefers-reduced-motion`
- Animations must be interruptible and not block user input

---

## 32. Cross-cutting Accessibility and Performance

### 32.1 Accessibility Requirements
- Accessible target dimensions (44–48px for interactive elements)
- Keyboard interaction support (Tab, Enter, Escape, arrow keys)
- Sufficient color contrast (WCAG AA: 4.5:1 text, 3:1 large)
- Reduced-motion support
- Consistent component behavior

### 32.2 Performance Requirements
- Responsive animations (no frame drops)
- Responsive drag-and-drop
- Efficient list rendering
- Virtualized large datasets
- Centralized design tokens (no per-component hardcoded colors)

---

## 33. Implementation Priority (Comprehensive — All Three Collections)

| Priority | Feature | Related Video |
|---|---|---|
| **P0** (MVP) | Consistent interaction sizes and visual hierarchy | 01 |
| **P0** (MVP) | Immediate feedback for user actions | 01 |
| **P0** (MVP) | Intelligent defaults and task automation | 02 |
| **P0** (MVP) | Consistent dark-mode color tokens | 04 |
| **P0** (MVP) | Clear status and priority differentiation | 01, 02 |
| **P0** (MVP) | Command palette and global search | 04 |
| **P0** (MVP) | Task execution timeline with audit log | 05 |
| **P1** (Phase 2) | Premium card composition | 03 |
| **P1** (Phase 2) | Spring-based Kanban interactions | 05 |
| **P1** (Phase 2) | Collapsing headers and contextual menus | 05 |
| **P1** (Phase 2) | Selective elevation and lighting | 03, 04 |
| **P1** (Phase 2) | Full motion system with optional disable | Project decisions |
| **P1** (Phase 2) | Real-time agent status and execution timeline | 05, 09 |
| **P1** (Phase 2) | Autocomplete and smart suggestions | 04, 09 |
| **P2** (Phase 3) | Dynamic glare and advanced lighting | 03 |
| **P2** (Phase 3) | Elaborate decorative animation | 05 |
| **P2** (Phase 3) | Advanced 3D card flips | 07, 10 |

---

## 34. Cumulative Design System Architecture (All Three Collections)

| Area | Videos | Key Elements |
|---|---|---|
| **Usability & Interaction Laws** | 01, 02 | Fitts's, Hick's, Chunking, Doherty, Proximity, Von Restorff, Goal Gradient, Postel, Tesler, Similarity, Serial Position, Peak-End |
| **Navigation & Command Palette** | 04 | Global search, keyboard shortcuts, result grouping, command mode |
| **Workflow & Status Communication** | 01, 05, 09 | Execution timelines, agent identity, status tracking, task prioritization |
| **Form & Decision Experience** | 01, 02, 06 | Fast task creation, input formatting, progressive disclosure, forgiving input |
| **Visual Foundation** | 02, 03, 06 | Hierarchy, spacing, typography, color, icons, elevation |
| **Premium Card Composition** | 03 | Layered gradients, translucent borders, selective lighting |
| **Dark Mode Design Architecture** | 04 | Near-black background, graduated text, accent contrast, surface elevation |
| **Motion & Gesture System** | 05, 07, 08, 10 | Spring, momentum, gestures, 3D transitions, morphing |
| **Interaction Feedback** | 01, 07, 09, 10 | Stateful UI, delivery acknowledgments, execution status, notifications |
| **Performance & Responsiveness** | 04, 05, 08 | Fast search, virtualization, background ops, progressive loading |
| **Ethical UX & Accessibility** | 03, 06, 09 | Transparency, safe defaults, reduced-motion, accessible targets |

---

## 35. Design Philosophy (All Three Collections)

**Simple to understand. Powerful to operate.**

1. **Visual clarity** — Every element has a clear purpose, hierarchy, and relationship
2. **Predictable interaction** — Users know where to click, what happens next, and how to reverse an action
3. **Intelligent assistance** — System absorbs repetitive complexity; humans retain decision control
4. **Responsive feedback** — Every meaningful action receives timely, accurate visual feedback
5. **Operational transparency** — Humans understand what AI agents are doing, completed, and what needs approval
6. **Consistent engineering** — Components, design tokens, and motion behavior follow shared architectural rules

### Implementation Sequence
1. **Establish the visual foundation** (design tokens, dark mode, typography, spacing)
2. **Build the reusable component system** (buttons, cards, forms, navigation)
3. **Implement core UX principles** (Fitts's, Hick's, Postel, Tesler's Law)
4. **Implement the motion system** (spring physics, gesture interactions, motion engine)
5. **Add advanced visual polish** (premium card composition, dark mode, selective lighting)
6. **Test usability and performance** (accessibility, responsiveness, cognitive load)

**Final recommendation:** Build a coherent design system first, then build the project management software using that design system. Do not design each screen independently.

---

## Source Attribution

This design system is derived from:
- **10 UI/UX video analyses** (first collection: motion, buttons, cards, communication, dashboard, forms, dark patterns, performance, icon motion, micro-interactions)
- **10 UI/UX video analyses** (second collection: checkout UX, pricing layouts, UX psychology laws, command palettes, delivery tracking, Gestalt principles, media controls, iOS interactions, behavioral design, animation engineering)
- **5 UI/UX video analyses** (third collection: UX laws, behavioral psychology, premium card design, dark mode, motion engineering)
- **Project decisions** (Model B, OAuth auth, RBAC, custom component library, separate agent chat per task, full motion with disable option, basic dashboard + list in MVP, PII protection)

All recommendations trace to the source videos and project requirements.



This design system is derived from:
- **10 UI/UX video analyses** (second collection: checkout UX, pricing layouts, UX psychology laws, command palettes, delivery tracking, Gestalt principles, media controls, iOS interactions, behavioral design, animation engineering)
- **First collection** (10 videos: motion, buttons, cards, communication, dashboard, forms, dark patterns, performance, icon motion, micro-interactions)
- **Project decisions** (Model B, OAuth auth, RBAC, custom component library, separate agent chat per task, full motion with disable option, basic dashboard + list in MVP, PII protection)

All recommendations trace to the source videos and project requirements.



This design system is derived from:
- **10 UI/UX video analyses** (motion design, button design, card design, communication, dashboard, form, dark patterns, performance, icon motion, micro-interactions)
- **Project decisions** (Model B, OAuth auth, RBAC, custom component library, separate agent chat per task, full motion with disable option, basic dashboard + list in MVP, PII protection)

All recommendations trace to the source videos and project requirements.
