# Project Manager — Project Structure & Resources

> **Project separation:** Project Manager is COMPLETELY SEPARATE from CDES Student Instructor V1.2.0 (historical).
> - CDES Student Instructor V1.2.0: `<USER>\GitHub\Student-Instructor-V1.2.0` (Complete, no modifications)
> - Project Manager: `<workspace>\` (Active)

---

## 1. Directory Structure

```
Project Manager/
├── memory.md                     # Project memory & context (things to remember)
├── design-system.md              # UI/UX design system (36 sections, 49 KB)
├── rules.md                      # Development rules & conventions
├── hand-over-guide.md            # Hand-over instructions
├── hand-over-checklist.md        # Hand-over verification
├── team.md                       # Team roster & responsibilities
├── Project Manager.docx          # Research paper (UI/UX discovery)
│
├── # Future files (created during development)
├── src/                          # Source code (React + Express)
│   ├── frontend/                 # React 19 + TS + Vite + Tailwind
│   └── backend/                  # Express + TS
├── docs/                         # Documentation
├── scripts/                      # Build & deployment scripts
└── tests/                        # Test cases
```

---

## 2. Document Versions

| Version | File | Purpose | Owner |
|---|---|---|---|
| 1.0 | `design-system.md` | UI/UX design reference | UX/UI Designer |
| 1.0 | `memory.md` | Project memory & context | CEO |
| 1.0 | `rules.md` | Development rules & conventions | CEO |
| 1.0 | `hand-over-guide.md` | Hand-over instructions | CEO |
| 1.0 | `hand-over-checklist.md` | Hand-over checklist | CEO |
| 1.0 | `team.md` | Team roster & responsibilities | CEO |
| 1.0 | `Project Manager.docx` | Research paper | CEO |

---

## 3. Key Facts for All Chatboxes

| Fact | Value |
|---|---|
| Project Name | Project Manager |
| Workspace | `<workspace>\` |
| Tech Stack | React 19 + TS + Vite + Tailwind / Express + TS / SQLite |
| Operating Model | Model B (humans + AI agents) |
| Team | 11-agent team (same as CDES Student Instructor V1.2.0) |
| Memory | `memory.md` (store of key facts) |
| Separation | Zero shared resources with CDES Student Instructor V1.2.0 |

---

## 4. Common Documents

### 4.1 Design System (design-system.md)
- Motion design, UI components, AI-agent communication
- Usability laws (Fitts's, Hick's, Chunking, etc.)
- Behavioral UX principles
- Premium card composition
- Dark mode architecture
- Motion engineering techniques

### 4.2 Hand-Over (hand-over-guide.md + hand-over-checklist.md)
- Instructions for handing over to another chatbox
- Pre/post hand-over verification checklist

### 4.3 Rules (rules.md)
- Scope control (only Project Manager)
- Approval gates
- Evidence-only policy
- One topic at a time

---

## 5. Development Phases

| Phase | Focus | Primary Owner | Timeline |
|---|---|---|---|
| **Phase 1: Core** | MVP (task, project, agent, audit log, agent auth, export) | CPO + ENGINEER | 2 weeks (timeboxed) |
| **Phase 2: Views & Power** | Import/export, dashboard, git integration | ENGINEER | 2 weeks |
| **Phase 3: Extras** | Custom canvas, dashboards, advanced motion | UX/UI Designer + ENGINEER | Future |

---

## 6. First-Phase Features (MVP)

### Must-Have
- [ ] Projects (one: CDES Student Instructor V1.2.0)
- [ ] Tasks (create, update status, due date, priority, assignee)
- [ ] Checklists inside tasks
- [ ] Blocking/blocked-by dependencies
- [ ] Comments on tasks
- [ ] Online/offline sync (local-first SQLite)
- [ ] Role-based permissions (owner, editor, viewer, commenter)
- [ ] Audit log (who/when/what)
- [ ] Agent authentication (OAuth + per-agent keys)
- [ ] Agent proposal + human approval
- [ ] Multi-provider AI model selection (cost control)
- [ ] Export (JSON + CSV, PII masking)

### Not in MVP (Phase 2/3)
- [ ] Import/Export (future formats)
- [ ] User profile + access tracking
- [ ] Simple dashboard (task progress, due-date forecast)
- [ ] Git-commit linking (one-way)
- [ ] Custom canvas (task connections, Canva-like)
- [ ] Mobile responsiveness
- [ ] Keyboard shortcuts

---

## 7. Infrastructure Setup Priority

| Order | Item | Owner | Notes |
|---|---|---|---|
| 1 | Initialize git repo | ENGINEER | Separate from CDES Student Instructor V1.2.0 |
| 2 | Install deps (React, TS, Express) | ENGINEER | Verify tsc --noEmit |
| 3 | Setup SQLite database | Database Architect | Schema, indexes |
| 4 | Setup CI/CD pipeline | DevOps Engineer | Build, test, deploy |
| 5 | Setup backups | DevOps Engineer | Nightly + git + cloud |
| 6 | Setup monitoring | DevOps Engineer | Performance tracking |
| 7 | Setup AI model integration | Performance & Cost Engineer | Multi-provider selection |

---

## 8. Communication Protocol

### 5-Brief Status Format
When updating status, use:
1. **Done** — Completed items
2. **In Progress** — Currently working on
3. **Needs Approval** — Awaiting owner decision
4. **Blocked** — Blocked by external factor
5. **Next** — Next action to take

### Hand-Over Triggers
- Planning complete → Hand-over to implementation
- Phase 1 complete → Hand-over to Phase 2
- User requests → Immediate hand-over
- Natural milestone → At phase boundary

---

## 9. Escalation Summary

| Escalation | Path | Evidence Required |
|---|---|---|
| Security | QA_SECURITY → CEO → Owner | Yes |
| Blocked / Time / Quality | CEO → Owner | Yes |
| Feature change | CPO → Owner | Yes |
| DB / Credentials | Owner explicit approval | Yes |

---

## 10. Source Attribution

This project structure is derived from:
- **CDES Student Instructor V1.2.0 Bot agent team (11-agent)** — Copied and adapted for Project Manager
- **Project decisions** (Model B, OAuth auth, RBAC, custom component library, separate agent chat, full motion, basic dashboard)
- **Design system** (36 sections, 49 KB)
- **All three UI/UX research collections** (25 videos)

All roles and responsibilities are adapted to fit Project Manager scope while maintaining the same organizational structure as CDES Student Instructor V1.2.0.
