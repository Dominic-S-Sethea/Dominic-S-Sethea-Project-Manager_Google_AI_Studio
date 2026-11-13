# Project Manager — Technology Stack (TECH_STACK.md)

> **Purpose:** Complete technology stack specification for Project Manager.
> **Author:** CTO (Toolchain & Architecture)
> **Date:** November 2026

---

## 1. Technology Stack Overview

| Layer | Technology | Version/Notes |
|---|---|---|
| **Frontend** | React 19 | Latest stable, TypeScript |
| **Frontend Build** | Vite | Fast dev server, optimized build |
| **Styling** | Tailwind CSS | Utility-first, design token based |
| **Backend** | Express | TypeScript, REST API |
| **Database** | SQLite | node:sqlite (local-first) |
| **AI Integration** | Multi-provider | Gemini, OpenAI, local models |
| **State Management** | React Query (TanStack Query) | Server state |
| **Design Tokens** | CSS Custom Properties | Centralized design system |
| **UI Primitives** | Custom components | dnd-kit (drag-and-drop), TipTap/BlockNote (Markdown) |

---

## 2. Detailed Stack

### 2.1 Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool, dev server |
| Tailwind CSS | 3.x | Styling, design tokens |
| React Query | 5.x | Server state management |
| dnd-kit | Latest | Drag-and-drop (Kanban, task reordering) |
| TipTap / BlockNote | Latest | Markdown editor |
| react-beautiful-dnd | Latest (or alternative) | Alternative drag-and-drop |

**Frontend Structure:**
```
src/
├── components/          # Reusable UI components
│   ├── buttons/         # Button components
│   ├── cards/           # Card components
│   ├── forms/           # Form components
│   ├── layout/          # Layout components
│   └── ...
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions
├── styles/              # Global styles, design tokens
├── types/               # TypeScript types
├── pages/               # Page components
└── App.tsx              # Root component
```

### 2.2 Backend

| Technology | Version | Purpose |
|---|---|---|
| Express | 4.x | Web framework |
| TypeScript | 5.x | Type safety |
| SQLite | node:sqlite | Local database |
| dotenv | Latest | Environment configuration |
| crypto | Built-in | Encryption, auth |

**Backend Structure:**
```
src/
├── routes/              # API routes
│   ├── tasks.routes.ts
│   ├── projects.routes.ts
│   ├── agents.routes.ts
│   └── ...
├── middleware/          # Express middleware
│   ├── auth.middleware.ts
│   ├── audit.middleware.ts
│   └── rateLimit.middleware.ts
├── services/            # Business logic
│   ├── task.service.ts
│   ├── agent.service.ts
│   └── audit.service.ts
├── database/            # Database layer
│   ├── index.ts         # SQLite connection
│   ├── schema.ts        # Schema definition
│   └── migrations/      # Database migrations
└── index.ts             # Entry point
```

### 2.3 Database

| Component | Technology |
|---|---|
| Database | SQLite |
| Driver | node:sqlite (built-in) |
| Migrations | Custom scripts (SQL) |
| Indexes | As defined in SCHEMA.md |

**Database Design Principles:**
- Single relational table for tasks + join table for multi-homing
- Audit logging for all critical changes
- Agent authentication and authorization
- Cross-tenant data isolation (RBAC)

### 2.4 AI Integration

| Component | Technology |
|---|---|
| Model Providers | Gemini, OpenAI, local models |
| Client | HTTP API calls (no specific SDK) |
| Cost Control | Token limits, reasoning effort, fallback model |
| Agent Management | Per-agent API keys, OAuth client-credentials |

---

## 3. Project Structure

```
project-manager/
├── src/
│   ├── frontend/              # React application
│   │   ├── src/
│   │   │   ├── components/    # UI components
│   │   │   ├── hooks/         # Custom hooks
│   │   │   ├── lib/           # Utilities
│   │   │   ├── styles/        # Global styles
│   │   │   ├── types/         # TypeScript types
│   │   │   ├── pages/         # Page components
│   │   │   └── App.tsx
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   └── backend/               # Express API
│       ├── src/
│       │   ├── routes/        # API routes
│       │   ├── middleware/    # Express middleware
│       │   ├── services/      # Business logic
│       │   ├── database/      # Database layer
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── docs/                        # Documentation
├── scripts/                     # Build & deployment scripts
├── tests/                       # Test cases
├── .gitignore
├── package.json                 # Root package.json
└── README.md                    # Project overview
```

---

## 4. Development Workflow

### 4.1 Local Development
```bash
# Install dependencies (root)
npm install

# Start frontend (Vite dev server)
npm run dev:frontend

# Start backend (Express)
npm run dev:backend

# Database
npm run db:migrate        # Run migrations
npm run db:seed           # Seed with test data
npm run db:reset          # Reset database
```

### 4.2 Testing
```bash
# Run all tests
npm test

# Run frontend tests
npm run test:frontend

# Run backend tests
npm run test:backend
```

### 4.3 Linting & Type Checking
```bash
# TypeScript type checking
npm run typecheck

# Linting
npm run lint

# Format
npm run format
```

### 4.4 Build
```bash
# Build frontend
npm run build:frontend

# Build backend
npm run build:backend

# Full production build
npm run build
```

---

## 5. Deployment Strategy

### 5.1 Local Deployment
- SQLite database (file-based)
- Development server for preview

### 5.2 Production Deployment
- SQLite database (file-based, backed up)
- Node.js server
- Environment variables for API keys, database path
- Automated backups (nightly, git-synced, cloud storage)

### 5.3 CI/CD
- GitHub Actions or similar
- Automated linting, type checking, testing
- Build on push to main branch
- Deploy to preview environment on PR merge

---

## 6. Performance Budgets

| Metric | Target | Measurement |
|---|---|---|
| Task list load time | <10ms | Browser dev tools |
| Initial page load | <3s | Lighthouse |
| API response time | <200ms | Request timing |
| Bundle size | <500KB (compressed) | Build analysis |
| AI cost/user | Defined per model | Cost tracking |

---

## 7. Security Considerations

| Area | Implementation |
|---|---|
| Authentication | OAuth client-credentials (agents) |
| Authorization | RBAC (owner, editor, viewer, commenter) |
| Data Isolation | Tenant/project-scoped |
| Audit Logging | All critical changes logged |
| Rate Limiting | Per-agent, configurable |
| API Keys | Per-agent, encrypted storage |

---

## 8. Design System Integration

### Design Tokens (CSS Variables)
```css
:root {
  /* Colors */
  --color-bg: #ffffff;
  --color-surface: #f8fafc;
  --color-primary: #3b82f6;
  --color-accent: #8b5cf6;
  --color-text: #1e293b;
  --color-muted: #64748b;
  --color-border: #e2e8f0;
  --color-error: #ef4444;
  --color-success: #22c55e;
  --color-warning: #f59e0b;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'Fira Code', monospace;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  /* Elevation */
  --elevation-none: 0px 0px 0px 0px rgba(0,0,0,0);
  --elevation-sm: 0px 1px 2px rgba(0,0,0,0.05);
  --elevation-md: 0px 4px 6px rgba(0,0,0,0.1);
  --elevation-lg: 0px 8px 16px rgba(0,0,0,0.12);
}
```

---

## 9. Source Attribution

This tech stack is derived from:
- CDES Student Instructor V1.2.0 reconstruction plan (6-phase blueprint)
- Project requirements (React 19 + TS + Vite + Tailwind, Express + TS, SQLite)
- Design system (custom component library, Canva-like canvas)
- Performance requirements (tasks load instantly, 10ms target)

All recommendations trace to source videos and project requirements.
