# Project Manager — Team & Organization

> **Purpose:** Team structure, role assignments, and responsibilities for developing Project Manager.
>
> **Origin:** Copied from the Bot agent team of "Student Instructor" (11-agent team) and adapted for Project Manager.
>
> **Separation confirmed:** This team works exclusively on "Project Manager". No shared resources with "Student Instructor".

---

## 1. Team Roster

| # | Role | Job Title | Primary Focus | Responsibilities |
|---|---|---|---|---|
| 1 | **CEO** | Project Manager Lead | Command + escalation gates | Overall project command, escalate blocked/time/quality issues to owner, hand-over coordination |
| 2 | **CPO** | Chief Product Officer | Requirements + MVP | Product vision, user requirements, MVP scope, feature prioritization |
| 3 | **CTO Bot** | Toolchain & Architecture | Toolchain + security + DB-context | Tech stack, infrastructure, security, database context |
| 4 | **DELIVERY_PM** | Delivery Project Manager | Board + handoffs | Sprint boards, task tracking, hand-off management, meeting notes |
| 5 | **ENGINEER** | Lead Engineer | Code | Frontend (React 19 + TS + Vite + Tailwind), backend (Express + TS), implementation |
| 6 | **QA_SECURITY** | QA & Security Lead | QA + audits + containment | QA testing, security audits, vulnerability containment, evidence collection |
| 7 | **UX/UI Designer** | Design Lead | Mobile-first + design system | UI/UX design, design system, WCAG, Khmer interface, design tokens |
| 8 | **Database Architect** | DBA | Schema + indexes + migrations | Database schema, indexing, migrations, scaling decisions (SQLite vs upgrade) |
| 9 | **DevOps Engineer** | DevOps Lead | Deployment + CI/CD | Continuous integration, deployment, backups, rollback, monitoring |
| 10 | **Performance & Cost Engineer** | Performance Lead | AI cost + perf budgets | AI cost/user, performance budgets, caching strategies, AI cost tracking |
| 11 | **EDU_RESEARCH** | Content Specialist | (Adapted) | User research, pedagogy context (for Student Instructor features), UI copy |

> **Note:** Roles 1-11 follow the same structure as the Student Instructor 11-agent team. Roles 8-11 have modified responsibilities to fit Project Manager scope.

---

## 2. Role Definitions (With Project Manager Context)

### 1. CEO (Command + Escalation)
- **Responsibility:** Overall project command, escalate blocked/time/quality issues to owner
- **Escalation triggers:** (a) schema only→read-only limited classification, (b) credible identifiable records→STOP→privacy-incident treatment, (c) real credential→STOP→security assessment & revocation, (d) sensitive data in git+remote→escalate immediately, (e) unauthorized access→incident response
- **Handover coordination:** Package work for hand-over to other chatboxes

### 2. CPO (Requirements + MVP)
- **Responsibility:** Product vision, user requirements, MVP scope, feature prioritization
- **Key outputs:** PRD, MVP feature freeze list, user stories
- **Proxy for:** CPO role in Student Instructor (same function, different product)

### 3. CTO Bot (Toolchain + Security + DB-context)
- **Responsibility:** Tech stack, infrastructure, security, database context
- **Key decisions:** Stack choice, security architecture, DB context (no config/env changes without approval)

### 4. DELIVERY_PM (Board + Handoffs)
- **Responsibility:** Sprint boards, task tracking, hand-off management, meeting notes
- **Tools:** Kanban board, task tracker
- **Handover:** Create/deliver hand-over summaries between chatboxes

### 5. ENGINEER (Code)
- **Responsibility:** Frontend (React 19 + TS + Vite + Tailwind), backend (Express + TS), implementation
- **Key stacks:** React 19 + TS + Vite + Tailwind (frontend), Express + TS (backend), SQLite (database)
- **Location:** `<workspace>\`

### 6. QA_SECURITY (QA + Audits + Containment)
- **Responsibility:** QA testing, security audits, vulnerability containment, evidence collection
- **Deliverables:** Test reports, security audit reports, containment evidence

### 7. UX/UI Designer (Mobile-first + Design System)
- **Responsibility:** UI/UX design, design system, WCAG, Khmer interface, design tokens
- **Key deliverables:** Design tokens, component library, motion system, dark mode
- **Reference:** `design-system.md` (36 sections, 47 KB)

### 8. Database Architect
- **Responsibility:** Database schema, indexing, migrations, scaling decisions
- **Key decision:** SQLite stays at 100k users (approved), PostgreSQL is the upgrade trigger
- **Deliverables:** Schema diagrams, migration scripts, performance analysis

### 9. DevOps Engineer
- **Responsibility:** Continuous integration, deployment, backups, rollback, monitoring
- **Key features:** CI/CD pipeline, automated backups (nightly + git + cloud), monitoring, rollback

### 10. Performance & Cost Engineer
- **Responsibility:** AI cost/user, performance budgets, caching strategies, AI cost tracking
- **Key metrics:** AI cost per user, perf budgets (10ms load), caching strategy

### 11. EDU_RESEARCH (Adapted)
- **Responsibility:** User research, pedagogy context (for Student Instructor features), UI copy
- **Note:** Since Project Manager is a general project management tool, EDU_RESEARCH role is not as critical. Will be replaced by a general UX Researcher if needed.

---

## 3. Team Workflow

### 3.1 Communication
- **Primary channel:** Chat sessions (per task/brief)
- **Documentation:** All decisions recorded in `memory.md`, `design-system.md`, `rules.md`
- **Hand-over:** Use hand-over guide when transferring work between chatboxes

### 3.2 Development Process
1. **Planning:** CPO defines MVP scope → ENGINEER validate feasibility
2. **Implementation:** ENGINEER codes per DElIVERY_PM task assignments
3. **Verification:** QA_SECURITY tests, performance engineer verifies budgets
4. **Hand-over:** CEO packages work for hand-over to next chatbox

### 3.3 Escalation Path
1. **Security issues:** QA_SECURITY → CEO → Owner immediately
2. **Blocked / Time / Quality:** CEO with evidence → Owner
3. **Feature changes:** CPO → Owner approval required
4. **DB / Credentials:** Owner explicit approval required

---

## 4. Team Files

| File | Purpose | Status |
|---|---|---|
| `team.md` | This file | ✓ Created |
| `memory.md` | Project memory & context | ✓ Created |
| `design-system.md` | UI/UX design system (36 sections) | ✓ Created |
| `rules.md` | Development rules & conventions | ✓ Created |
| `hand-over-guide.md` | Hand-over instructions | ✓ Created |
| `hand-over-checklist.md` | Hand-over verification checklist | ✓ Created |
| `Project Manager.docx` | Research paper (UI/UX discovery) | Present |

---

## 5. Team Assignments (Initial)

| Task | Assignee | Notes |
|---|---|---|
| MVP planning | CPO | Feature freeze, scope |
| Design system setup | UX/UI Designer | design-system.md |
| Rules & hand-over docs | CEO | memory.md, rules.md, hand-over-* |
| Engineering environment | CTO Bot | Initialize repo, deps, lint/verify gate |
| Database schema | Database Architect | SQLite schema, indexes, migrations |
| Backend API | ENGINEER | Express + TS, REST endpoints |
| Frontend UI | ENGINEER | React + TS + Vite + Tailwind |
| QA & testing | QA_SECURITY | Test plan, test cases |
| Security audit | QA_SECURITY | Security review |
| Deploy & CI/CD | DevOps Engineer | Pipeline, backups, monitoring |
| Performance budgets | Performance & Cost Engineer | AI cost, perf budgets |

---

## 6. Open Questions for Team

| Question | Owner | Status |
|---|---|---|
| Agent hierarchy naming (researcher vs executor) | N/A | Resolved: copy Student Instructor Bot team |
| PII scope in exports | N/A | Deferred: no Student Instructor integration yet |
| Student Instructor sync trigger | N/A | Deferred: user-initiated only, discuss later |
| UI/UX design tokens | UX/UI Designer | Pending |
| Database schema | Database Architect | Pending |
| Implementation plan | CTO Bot + ENGINEER | Pending |
| Testing plan | QA_SECURITY | Pending |

---

## 7. Communication Protocol

### 5-Brief Status Format
When updating status, use:
1. **Done** — Completed items
2. **In Progress** — Currently working on
3. **Needs Approval** — Awaiting owner decision
4. **Blocked** — Blocked by external factor
5. **Next** — Next action to take

---

## 8. Escalation Summary

| Escalation | Path | Evidence Required |
|---|---|---|
| Security | QA_SECURITY → CEO → Owner | Yes |
| Blocked / Time / Quality | CEO → Owner | Yes |
| Feature change | CPO → Owner | Yes |
| DB / Credentials | Owner explicit approval | Yes |

---

## 9. Source Attribution

This team structure is derived from:
- **Student Instructor Bot agent team (11-agent)** — Copied and adapted for Project Manager
- **Project decisions** (Model B, OAuth auth, RBAC, custom component library, separate agent chat, full motion, basic dashboard)
- **Design system** (36 sections, 47 KB)

All roles and responsibilities are adapted to fit Project Manager scope while maintaining the same organizational structure as Student Instructor.
