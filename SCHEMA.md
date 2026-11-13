# Project Manager — Database Schema (SCHEMA.md)

> **Purpose:** Database schema documentation for Project Manager.
> **Database:** SQLite (local-first, offline-capable)
> **Status:** Planning Complete

---

## 1. Entity Relationships

```
┌────────────┐       ┌────────────┐
│   users    │───────│   projects │
└────────────┘       └────────────┘
       │                    │
       │                    │
       ▼                    ▼
┌────────────┐       ┌────────────┐
│  tasks     │◄─────►│ task_roles │
└────────────┘       └────────────┘
       │
       ▼
┌────────────┐
│  comments  │
└────────────┘
       │
       ▼
┌────────────┐
│  checklists│
└────────────┘
       │
       ▼
┌────────────┐
│  checklist │
└────────────┘
       │
       ▼
┌────────────┐
│  items     │
└────────────┘
```

---

## 2. Table Definitions

### 2.1 users
| Column | Type | Constraints | Description |
|---|---|---|---|
| user_id | TEXT | PRIMARY KEY | Unique user identifier |
| username | TEXT | NOT NULL | Display name |
| email | TEXT | UNIQUE, NOT NULL | Contact email |
| role | TEXT | NOT NULL, DEFAULT 'viewer' | owner, editor, viewer, commenter |
| status | TEXT | NOT NULL, DEFAULT 'active' | active, disabled |
| created_at | DATETIME | NOT NULL | Account creation timestamp |
| last_login_at | DATETIME | NULL | Last login timestamp |
| ip_address | TEXT | NULL | Last known IP address |
| device_fingerprint | TEXT | NULL | Device identification |

### 2.2 projects
| Column | Type | Constraints | Description |
|---|---|---|---|
| project_id | TEXT | PRIMARY KEY | Unique project identifier |
| name | TEXT | NOT NULL | Project name |
| description | TEXT | NULL | Project description |
| status | TEXT | NOT NULL, DEFAULT 'active' | active, archived |
| created_by | TEXT | NOT NULL, FOREIGN KEY → users.user_id | Owner |
| metadata | TEXT | NULL | JSON metadata |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update timestamp |

### 2.3 tasks
| Column | Type | Constraints | Description |
|---|---|---|---|
| task_id | TEXT | PRIMARY KEY | Unique task identifier |
| project_id | TEXT | NOT NULL, FOREIGN KEY → projects.project_id | Parent project |
| title | TEXT | NOT NULL | Task title |
| description | TEXT | NULL | Markdown description |
| status | TEXT | NOT NULL, DEFAULT 'todo' | todo, in_progress, done, blocked |
| priority | TEXT | NOT NULL, DEFAULT 'normal' | low, normal, high, urgent |
| assignee_id | TEXT | FOREIGN KEY → users.user_id | Assigned user |
| project_id | TEXT | NOT NULL, FOREIGN KEY → projects.project_id | Parent project |
| created_by | TEXT | NOT NULL, FOREIGN KEY → users.user_id | Creator |
| metadata | TEXT | NULL | JSON metadata |
| due_date | DATETIME | NULL | Due date |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update timestamp |

### 2.4 task_dependencies
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | Unique dependency record |
| task_id | TEXT | NOT NULL, FOREIGN KEY → tasks.task_id | Dependent task |
| depends_on_id | TEXT | NOT NULL, FOREIGN KEY → tasks.task_id | Task that must complete first |
| dependency_type | TEXT | NOT NULL | blocking, blocked_by |

### 2.5 comments
| Column | Type | Constraints | Description |
|---|---|---|---|
| comment_id | TEXT | PRIMARY KEY | Unique comment identifier |
| task_id | TEXT | NOT NULL, FOREIGN KEY → tasks.task_id | Task ID |
| author_id | TEXT | NOT NULL, FOREIGN KEY → users.user_id | Author |
| body | TEXT | NOT NULL | Comment content (Markdown) |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update timestamp |

### 2.6 checklists
| Column | Type | Constraints | Description |
|---|---|---|---|
| checklist_id | TEXT | PRIMARY KEY | Unique checklist identifier |
| task_id | TEXT | NOT NULL, FOREIGN KEY → tasks.task_id | Parent task |
| title | TEXT | NOT NULL | Checklist title |
| is_completed | BOOLEAN | NOT NULL, DEFAULT FALSE | Overall completion |

### 2.7 checklist_items
| Column | Type | Constraints | Description |
|---|---|---|---|
| item_id | TEXT | PRIMARY KEY | Unique item identifier |
| checklist_id | TEXT | NOT NULL, FOREIGN KEY → checklists.checklist_id | Parent checklist |
| content | TEXT | NOT NULL | Item content |
| is_completed | BOOLEAN | NOT NULL, DEFAULT FALSE | Completion status |
| order | INTEGER | NOT NULL, DEFAULT 0 | Display order |

### 2.8 audit_logs
| Column | Type | Constraints | Description |
|---|---|---|---|
| log_id | TEXT | PRIMARY KEY | Unique log identifier |
| user_id | TEXT | FOREIGN KEY → users.user_id | User or agent |
| agent_id | TEXT | NULL | AI agent ID (if agent action) |
| action | TEXT | NOT NULL | Action type (create, update, delete, status_change, etc.) |
| target_table | TEXT | NOT NULL | Target table name |
| target_id | TEXT | NOT NULL | Target record ID |
| old_value | TEXT | NULL | Previous value (JSON) |
| new_value | TEXT | NULL | New value (JSON) |
| trigger | TEXT | NOT NULL | Trigger description (user action, agent action, cron, etc.) |
| reasoning_summary | TEXT | NULL | Reasoning summary (for AI agent actions) |
| ip_address | TEXT | NULL | Source IP address |
| created_at | DATETIME | NOT NULL | Timestamp |

### 2.9 agents
| Column | Type | Constraints | Description |
|---|---|---|---|
| agent_id | TEXT | PRIMARY KEY | Unique agent identifier |
| name | TEXT | NOT NULL | Agent name |
| role | TEXT | NOT NULL | Agent role (researcher, executor, admin, etc.) |
| api_key | TEXT | NOT NULL | API key (encrypted) |
| provider | TEXT | NOT NULL | AI provider (Gemini, OpenAI, etc.) |
| model | TEXT | NOT NULL | Model name |
| permissions | TEXT | NOT NULL | JSON permissions |
| rate_limit | INTEGER | NOT NULL | Max requests per minute |
| status | TEXT | NOT NULL, DEFAULT 'active' | active, disabled |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update timestamp |

### 2.9 agent_activities
| Column | Type | Constraints | Description |
|---|---|---|---|
| activity_id | TEXT | PRIMARY KEY | Unique activity identifier |
| agent_id | TEXT | NOT NULL, FOREIGN KEY → agents.agent_id | Agent ID |
| user_id | TEXT | FOREIGN KEY → users.user_id | User who triggered |
| action | TEXT | NOT NULL | Action performed |
| target_id | TEXT | NOT NULL | Target record ID |
| target_table | TEXT | NOT NULL | Target table |
| trigger | TEXT | NOT NULL | Trigger description |
| reasoning_summary | TEXT | NULL | Reasoning summary |
| status | TEXT | NOT NULL, DEFAULT 'pending' | pending, approved, completed, failed |
| created_at | DATETIME | NOT NULL | Creation timestamp |

---

## 3. Index Strategy

| Table | Index | Purpose |
|---|---|---|
| tasks | idx_tasks_project | Query tasks by project |
| tasks | idx_tasks_status | Filter tasks by status |
| tasks | idx_tasks_assignee | Filter tasks by assignee |
| tasks | idx_tasks_due_date | Query tasks by due date |
| tasks | idx_tasks_created_at | Chronological queries |
| task_dependencies | idx_deps_task | Find dependencies for a task |
| comments | idx_comments_task | Find comments for a task |
| audit_logs | idx_audit_user | Audit log by user |
| audit_logs | idx_audit_target | Audit log by target |
| audit_logs | idx_audit_created_at | Chronological audit log |
| agents | idx_agents_role | Query agents by role |
| agents | idx_agents_status | Filter active/inactive |

---

## 4. Data Isolation

### Cross-Tenant Isolation
- **Projects** are isolated by project_id (owner has single project)
- **Tasks** are isolated by project_id
- **Users** are isolated by role
- **Audit Logs** are cross-tenant (for accountability tracking)

### RBAC Enforcement
- All writes are filtered by role (owner, editor, viewer, commenter)
- Owner: all operations
- Editor: create, read, update, delete own content
- Viewer: read-only
- Commenter: read + comments

---

## 5. Data Types Reference

| Type | SQLite | Usage |
|---|---|---|
| Primary Key | TEXT (UUID) | All IDs |
| Boolean | INTEGER (0/1) | is_completed, status flags |
| Date/Time | TEXT (ISO 8601) | created_at, due_date, etc. |
| JSON | TEXT | metadata, permissions arrays |
| Notes | TEXT | description, body, reasoning_summary |

---

## 6. Database Context (from CTO)

> The database uses SQLite via node:sqlite. This is a local-first architecture.
> - Read-heavy profile: 10-15 tasks per project
> - Single local-storage box
> - Dataset <1TB (well within SQLite limits)
> - Less than 20 concurrent writers

---

## 7. Future Scaling (PostgreSQL Trigger)

> PostgreSQL is the upgrade trigger, NOT the assumed target.
> Owner approved: SQLite stays at 100k users for the national platform.
> PG upgrade is triggered only if scaling requirements exceed SQLite capacity.
