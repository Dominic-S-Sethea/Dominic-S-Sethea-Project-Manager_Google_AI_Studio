# Project Manager — Rules and Conventions

> **CRITICAL:** CDES Student Instructor V1.2.0 and Project Manager are COMPLETELY SEPARATE (historical).
> - Do NOT modify, edit, or change anything in CDES Student Instructor V1.2.0.
> - CDES Student Instructor V1.2.0 is COMPLETE and awaiting future development.
> - All work from this point onward is for Project Manager ONLY.

---

## 1. Project Separation Rules

| Rule | Description |
|---|---|
| **Zero shared artifacts** | No shared memory, data, source code, binaries, or resources between projects |
| **Separate workspaces** | CDES Student Instructor V1.2.0: `<USER>\GitHub\Student-Instructor-V1.2.0` |
| | Project Manager: `<workspace>\` |
| **No cross-references** | No links, mentions, or dependencies between the two projects |
| **Separate git repos** | Each project has its own repository |
| **Independent development** | Both projects develop independently |

---

## 2. Development Rules

### 2.1 Scope Control
- **Only work on Project Manager**
- Any discussion about CDES Student Instructor V1.2.0 should be prefixed: "For CDES Student Instructor V1.2.0 (future work): ..."
- Do not plan features for CDES Student Instructor V1.2.0 unless explicitly requested

### 2.2 Approval Gates
- No irreversible changes (DB edits, environment installs, config changes, repo history rewrites) without explicit owner approval
- Feature changes require sign-off before implementation
- Security/DB/credentials/key-person/scope-expansion: owner veto only

### 2.3 Evidence-Only Policy
- Report what real execution returned, not plausible-looking output
- If a tool fails, report the blocker honestly
- Do not fabricate results, API responses, or file contents

### 2.4 One Topic at a Time
- Sequential Q&A when multiple decisions are needed
- 5-item status briefs when requested (done / in progress / needs approval / blocked / next)

---

## 3. Hand-Over Conventions

### 3.1 Trigger Points
Hand-over may be triggered:
- When a chatbox reaches a natural milestone (e.g., planning complete, Phase 1 complete)
- When the user requests a hand-over
- When a new task requires a different specialist/assignee

### 3.2 Hand-Over Procedure
1. **Finalize current work** - Complete all pending tasks
2. **Save progress** - Persist to disk (files, not memory)
3. **Create hand-over document** - Summarize state, decisions, open items
4. **Notify next chatbox** - Provide hand-over file location
5. **Verify durability** - Confirm files exist on disk

### 3.3 Hand-Over Contents
| Item | Description |
|---|---|
| Project state | What is built, what is planned |
| Decisions made | Key decisions and rationale |
| Open items | Pending questions, unresolved decisions |
| Next steps | Immediate next actions |
| File locations | All related files and their paths |

---

## 4. File Organization

```
Project Manager/
├── memory.md                    # Project memory & context
├── design-system.md             # UI/UX design system (36 sections, 47 KB)
├── hand-over-guide.md           # Hand-over instructions
├── hand-over-checklist.md       # Hand-over verification
├── rules.md                     # Development rules & conventions
└── Project Manager.docx         # Research paper (UI/UX discovery)
```

---

## 5. Chat-Box Switching Protocol

When requesting a hand-over:
1. State clearly: "Requesting hand-over for Project Manager"
2. Provide context: current phase, completed items, pending items
3. Reference the hand-over file location
4. Specify what the receiving chatbox should verify

---

## 6. Escalation Paths

| Escalation | Path |
|---|---|
| Security issues | Owner → security team immediately |
| Blocked / Time / Quality | CEO with evidence |
| Feature changes | Owner approval required |
| DB / Credentials | Owner explicit approval required |

---

## 7. Design Philosophy

"Simple to understand. Powerful to operate."

1. **Visual clarity** — Every element has a clear purpose, hierarchy, and relationship
2. **Predictable interaction** — Users know where to click and what happens next
3. **Intelligent assistance** — System absorbs repetitive complexity
4. **Responsive feedback** — Every action receives timely, accurate feedback
5. **Operational transparency** — Humans understand what AI agents are doing
6. **Consistent engineering** — Shared design tokens, motion behavior, component rules
