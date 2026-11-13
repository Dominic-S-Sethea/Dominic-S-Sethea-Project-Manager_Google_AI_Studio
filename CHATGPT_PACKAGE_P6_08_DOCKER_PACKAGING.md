# PM-P6-08 — Fix Docker packaging for the schema path and stale build
## Detailed implementation prompt for ChatGPT

You are implementing one card of an approved, stage-gated programme. Write real, complete,
production-quality configuration. Do not stub, do not summarize, do not ask questions, do not
change anything outside the authorized file list.

---

## 0. Context you must understand first

**Product.** "Project Manager" — a project/work management application.

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind |
| Backend | Express + TypeScript (ESM, `"type": "module"`) |
| Database | SQLite via Node's built-in `node:sqlite` (`DatabaseSync`) |
| Tests | `node --test` (no Jest/Vitest) |
| Deployment | Docker + docker-compose |

**Build gates (must keep passing).**

- `npm run typecheck` → `tsc -p tsconfig.typecheck.json --noEmit` (exit 0)
- `npm run build` → `tsc` (exit 0)
- `npm test` → `node --test src/tests/` (76 pass, 0 fail)
- frontend typecheck / build

**Why `noEmit` is set.** `backend/tsconfig.json` currently sets `"noEmit": true`. That was a
deliberate owner decision to keep the build gate passing. **It must stay.** The consequence is
that `npm run build` emits nothing, so `backend/dist` is stale (90 entries from before the
change).

---

## 1. Current state (VERIFIED against the live tree)

| Fact | Evidence |
|---|---|
| The runtime resolves the schema from the source tree | `backend/src/database/index.ts` → `new URL("../../src/database/schema.sql", import.meta.url)` — resolves to `backend/src/database/schema.sql` from both `src/database` and `dist/database` |
| The image does not contain that file | `Dockerfile` runtime stage copies only `backend/dist` and `backend/node_modules` |
| `dist` is stale | `npm run build` emits nothing under `noEmit`; `backend/dist` holds 90 pre-change entries |
| The container sets `PORT=4000` | `Dockerfile` `ENV NODE_ENV=production PORT=4000`; `docker-compose.yml` maps `4000:4000` and health-checks `http://localhost:4000/health` |
| The app binds `PORT` | `backend/src/server.ts` → `Number.parseInt(process.env.PORT ?? "3000", 10)` |

**Net effect:** the container cannot start — the schema file it needs is not in the image, and
the compiled code it would run is stale.

---

## 2. The task

Make the container build reproducible and correct, without breaking the gates and without
changing application source.

Two things must be true in the built image:

1. **The compiled backend is fresh** — produced from the current `src`, not the stale `dist`.
2. **The schema file is present** at the path `index.ts` resolves to
   (`backend/src/database/schema.sql`), or `index.ts` is changed to read a schema that *is*
   present in the image.

You choose the approach, but you must respect §4.

---

## 3. Authorized deliverables — exactly these files

1. `backend/package.json`
2. `backend/tsconfig.build.json` (new — an emit config that extends the base)
3. `Dockerfile`
4. `docker-compose.yml` — only if the port or healthcheck needs aligning

Do **not** change application source (`backend/src/**`). Do **not** change
`backend/tsconfig.json` or `backend/tsconfig.typecheck.json`. Do **not** add dependencies.

---

## 4. Constraints — do not violate

- **`noEmit: true` stays in `backend/tsconfig.json`.** The typecheck gate depends on it.
- **No new dependencies.** Use only what is already in `backend/package.json`.
- **No application source changes.** This card is packaging only.
- **The runtime schema must be the committed `src/database/schema.sql`** (or a byte-identical
  copy shipped in the image). Do not introduce a second schema source of truth.
- **Keep the local dev workflow working.** `npm run dev` must still start the server.
- **Preserve the existing container contract:** `PORT=4000`, `/health`, `DB_PATH`.

---

## 5. Acceptance criteria

- `docker build` succeeds.
- The container starts and `GET /health` returns 200 on port 4000.
- The schema read at runtime is the committed schema (or a byte-identical copy).
- `npm run typecheck` still exits 0.
- `npm run build` still exits 0.
- `npm test` still passes 76/0.
- Frontend typecheck and build still pass.

---

## 6. Output format

Return the files **in the order listed in §3**, each as a complete replacement file in a fenced
code block, prefixed by its path. Do not return snippets or diffs. State your chosen approach in
one short paragraph before the files.

---

## 7. Current source files (authoritative)


### SOURCE FILE: `Dockerfile`

```
# ============================
# Project Manager — Dockerfile
# Multi-stage build
# ============================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --omit=dev
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev
COPY backend/ ./
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache ca-certificates curl
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=frontend-builder /app/frontend/dist ./backend/dist
ENV NODE_ENV=production PORT=4000
ENV DB_PATH=/app/backend/data/app.db
RUN mkdir -p /app/backend/data
EXPOSE 4000
WORKDIR /app/backend
CMD ["node", "dist/server.js"]

```

### SOURCE FILE: `docker-compose.yml`

```yaml
version: "3.8"
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - PORT=4000
      - CORS_ORIGIN=http://localhost:4000
      - DB_PATH=/app/backend/data/app.db
      - JWT_SECRET=${JWT_SECRET:-change-me-in-production}
      - RATE_LIMIT_WINDOW_MS=900000
      - RATE_LIMIT_MAX=100
    volumes:
      - app_data:/app/backend/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  app_data:

```

### SOURCE FILE: `backend/package.json`

```json
{
  "name": "project-manager-backend",
  "version": "1.0.0",
  "description": "Project Manager backend API (Express + TypeScript)",
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:migrate": "tsx src/database/migrate.ts",
    "db:seed": "tsx src/database/seed.ts",
    "db:reset": "tsx src/database/reset.ts",
    "typecheck": "tsc -p tsconfig.typecheck.json --noEmit",
    "test": "node --test src/tests/",
    "dev:full": "tsx src/server.ts"
  },
  "license": "MIT",
  "dependencies": {
    "bcryptjs": "^3.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.21.2",
    "express-rate-limit": "^7.5.0",
    "helmet": "^8.1.0",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.3",
    "@types/express-rate-limit": "^6.0.2",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^24.0.0",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^5.2.0",
    "autoprefixer": "^10.6.2",
    "jest": "^30.5.2",
    "postcss": "^8.5.32",
    "supertest": "^7.3.1",
    "tailwindcss": "^3.4.11",
    "tsx": "^4.20.0",
    "typescript": "^5.9.3",
    "vite": "^6.4.5"
  },
  "type": "module"
}

```

### SOURCE FILE: `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true,
    "types": [
      "node"
    ],
    "noUncheckedIndexedAccess": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "noImplicitOverride": true
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

### SOURCE FILE: `backend/tsconfig.typecheck.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  }
}

```

### SOURCE FILE: `backend/src/database/index.ts`

```typescript
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let db: InstanceType<typeof DatabaseSync> | null = null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the committed source schema from both src/database and dist/database.
// This intentionally avoids reading a stale schema copy beside compiled output.
const schemaPath = fileURLToPath(
  new URL("../../src/database/schema.sql", import.meta.url),
);
const schemaSql = readFileSync(schemaPath, "utf-8");

function applyCompatibilityMigrations(database: InstanceType<typeof DatabaseSync>): void {
  const agentColumns = database
    .prepare("PRAGMA table_info(agents)")
    .all() as Array<{ name: string }>;

  if (!agentColumns.some((column) => column.name === "expires_at")) {
    // SQLite's CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
    // A nullable column keeps legacy agent records valid; new registrations always set it.
    database.exec("ALTER TABLE agents ADD COLUMN expires_at DATETIME;");
  }

  // Keep this migration self-contained: older schema files may not define agent_tokens.
  // These statements are also safe when the current schema has already created them.
  database.exec(`
    CREATE TABLE IF NOT EXISTS agent_tokens (
      token_hash  TEXT PRIMARY KEY,
      agent_id    TEXT NOT NULL REFERENCES agents(agent_id),
      role        TEXT NOT NULL,
      expires_at  DATETIME NOT NULL,
      created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_agent_tokens_agent
      ON agent_tokens(agent_id);

    CREATE INDEX IF NOT EXISTS idx_agent_tokens_expires
      ON agent_tokens(expires_at);
  `);
}

export function getDb(): InstanceType<typeof DatabaseSync> {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "app.db");
    db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");

    // Apply the authoritative schema, then bridge databases created before expires_at
    // and agent_tokens existed.
    db.exec(schemaSql);
    applyCompatibilityMigrations(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

```
