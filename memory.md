## 8. Source Attribution

This memory file derives from:
- 10 UI/UX video analyses (first collection)
- 10 UI/UX video analyses (second collection)
- 5 UI/UX video analyses (third collection)
- Project decisions (Model B, OAuth auth, RBAC, custom component library, separate agent chat, full motion, basic dashboard)

All recommendations trace to source videos and project requirements.

---

## 9. Project Identification Rule (Added)

**Rule:** Always verify the project name from the kanban board files (`KANBAN_BOARD.md`, `README.md`) before citing any project name.

**Checklist:**
1. Read `KANBAN_BOARD.md` from the workspace
2. Extract the project name from the file contents (not from memory)
3. Verify the workspace path matches the kanban board
4. Use the verified project name in all future handoffs

**Decision:** The active project is **"Project Manager"** — use this name exclusively going forward. The "Student Instructor V1.2.0" file is historical reference only and should not be used for active development.

---

## 10. Project Context Files (Separate Memory Contexts)

To prevent confusion between the active kanban project and the historical student-instructor project, we maintain **two separate context files**:

### 10.1 Active Project — Project Manager
- **File:** `ProjectManager.md`
- **Workspace:** `<workspace>\`
- **Status:** ACTIVE kanban board project (19 cards in 5 phases)
- **Purpose:** Current kanban workflow, task tracking, and project development

### 10.2 Historical Reference — CDES Student Instructor V1.2.0
- **File:** `CDES-Student-Instructor.md`
- **Workspace:** `<USER>\GitHub\Student-Instructor-V1.2.0`
- **Status:** Historical reference only
- **Purpose:** Original project documentation (pre-reconfiguration)

---

## 11. Project Identity Validation (Added)

**Check:** Before each handoff, do this:

1. **Read** `KANBAN_BOARD.md` from the workspace
2. **Extract** the project name from the file contents (not from memory)
3. **Verify** the workspace path matches the kanban board
4. **Write** the handoff using the verified project name

**Sample Handoff:**

> "We're at 6/28 gates achieved (21%) on Project Manager. MC-005, MC-006, MC-007, MC-008, MC-009, MC-010, MC-011, MC-012, MC-013 (remaining MVP core). The auto-decomposer system is recovered. node_modules is installed and ready. Where should we start?"

---

## 12. Kanban Workflows

### 3.1 Card Lifecycle
Card statuses and transitions:
- **todo** → *blocked* (waiting on dependencies)
- **blocked** → *ready* (unblocked after dependencies complete or manual unblock)
- **ready** → *running* (dispatcher auto-claims, or manual claim)
- **running** → *done* (task completes successfully)
- **running** → *blocked* (task crashes or worker fails)
- **done** → archived to `KANBAN_DONE_LOG.md`

### 3.2 Agent Roles
- **@engineer** — Feature implementation tasks (PB, MC cards)
- **@devops** — Infrastructure, CI/CD, deployment (PB-006)
- **@db architect** — Database schema, migrations, data setup (PB-003)
- **@qa_security** — Security testing, acceptance tests (MC-013)
- **@qa/qc lead** — QA/QC bot: tests feature implementations, finds bugs, verifies task integrity
- **@CPO** — Requirements, MVP definition
- **@DELIVERY_PM** — Task board tracking, handoff coordination
- **@auto-decomposer** — System auto-decomposer: creates sub-tasks from parent tasks

### 3.3 QA/QC Workflow
1. Feature task completed (e.g., MC-008)
2. QA/QC bot (Beam 1.0 501B A23B:Free) claims and tests the task (QA-001 card)
3. QA/QC bot creates QA-002 through QA-013 testing cards for MC-002 through MC-013
4. QA/QC bot reports bugs and verifies fixes
5. Developer fixes bugs, re-tests, and marks task verified

### 3.4 Archiving Rules
- All "done" tasks are archived to `KANBAN_DONE_LOG.md`
- After archiving, the card is closed (status: done)
- Kanban CLI: `kanban complete {task_id} --result "..."` to complete a task
- Kanban CLI: `kanban archive {task_id}` to remove a task (used for duplicates)
- Kanban CLI: `kanban unblock {task_id}` to unblock a task
- Kanban CLI: `kanban claim {task_id}` to move a task to running

### 3.5 Dependency Management
- Tasks use `parents` array to declare dependencies
- Task automatically becomes "ready" when all parents are "done"
- Blocked tasks should not be unblocked unless their dependencies are complete
- Duplicate cards should be archived to avoid confusion

---

## 12. Kanban CLI Commands

| Command | Description |
|---|---|
| `kanban list` | List all tasks |
| `kanban show {task_id}` | Show task with events |
| `kanban claim {task_id}` | Move task to running |
| `kanban complete {task_id} --result "..."` | Complete a task |
| `kanban archive {task_id}` | Remove duplicate task |
| `kanban unblock {task_id}` | Unblock a task |
| `kanban block {task_id}` | Block a task |
| `kanban dispatch` | Dispatch agent |
| `kanban daemon` | Run agent daemon |

---

## 13. Kanban CLI Quick Reference

| Subcommand | Description |
|---|---|
| `init` | Create kanban.db if missing |
| `boards` | Manage kanban boards |
| `create` | Create a new task |
| `swarm` | Create a Kanban Swarm v1 graph |
| `list` / `ls` | List tasks |
| `show` | Show task with comments + events |
| `assign` | Assign or reassign a task |
| `set-model` | Set task model/provider override |
| `reclaim` | Release active worker claim |
| `reassign` | Reassign task to different profile |
| `diagnostics` / `diag` | List active diagnostics |
| `link` / `unlink` | Link/unlink tasks |
| `claim` | Move task to running |
| `comment` | Add comment to task |
| `attach` / `attachments` / `attach-rm` | File attachments |
| `complete` | Complete a task |
| `edit` | Edit task |
| `block` / `unblock` | Block/unblock a task |
| `schedule` | Schedule task |
| `request-review` / `request-changes` / `reopen-review` | Review workflow |
| `promote` | Promote task |
| `archive` | Archive task |
| `tail` | Tail task logs |
| `dispatch` / `daemon` / `watch` | Dispatcher/deamon/watcher |
| `stats` | Task statistics |
| `notify-subscribe` / `notify-list` / `notify-unsubscribe` | Notifications |
| `log` | Task logs |
| `runs` | Task run history |
| `heartbeat` | Health check |
| `assignees` | List task assignees |
| `context` | Task context |
| `specify` | Specify task |
| `decompose` | Decompose task |
| `gc` / `repair` | Garbage collection / DB repair |

---

## 14. Historical Reference — CDES Student Instructor V1.2.0

This is the **original project** that was reconfigured into Project Manager.

- **Original name:** CDES Student Instructor V1.2.0
- **Original workspace:** `<USER>\GitHub\Student-Instructor-V1.2.0`
- **Original agent team:** 11-agent team (ceo, cpo, cto, delivery_pm, engineer, qa_security, edu_research, devops, performance, uxui, db_arch)
- **Original JDs/rules:** operating-model/AGENT_JOBS_AND_RULES.md
- **Original roadmap:** operating-model/RECONSTRUCTION_ROADMAP.md
- **Status:** Historical reference only — NOT the active project

This section exists for historical context only. The active kanban board is **Project Manager**.
