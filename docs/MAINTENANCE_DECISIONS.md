# Project Manager — Residual Phase 2 Baseline Findings: Migration & Remediation Decisions

Scope: C-2 (container port mismatch), C-3 (runtime schema path), C-4 (agent
schema drift). Owner decision D-02 authorized remediation of C-1..C-4. C-1 was
closed by PM-P6-02. Only C-2, C-3, C-4 remain.

Classification: VERIFIED (re-discovered against the live tree on 2026-11-11).
Remediation only — no unrelated redesign. Direction: Obsidian Signal glass,
`--pm-*` tokens only.

---

## C-2 — Container port mismatch (config-only)

**Finding:** `backend/src/server.ts:98` reads `process.env.NODE_PORT || "3000"`,
but `Dockerfile:25` sets `ENV PORT=4000` and `EXPOSE 4000`, and
`docker-compose.yml` maps `4000:4000` + sets `PORT=4000` + health-checks
`http://localhost:4000/health`. The container therefore exposes/health-checks
4000 while the app listens on 3000 (Docker deploy health check fails).

**Decision (C-2-DEC-01):** Align the application to the `PORT` environment
variable already set by the container and compose file.
- Change `backend/src/server.ts:98` from
  `parseInt(process.env.NODE_PORT || "3000")`
  to `parseInt(process.env.PORT || "3000")`.
- Rationale: the container/compose already declares and health-check `PORT=4000`.
  Reading `PORT` makes the app bind 4000 with zero Dockerfile/compose edits and
  no schema/runtime-logic change.
- No schema change. No new dependency.

## C-3 — Runtime schema path is stale/unreproducible

**Finding:** `backend/src/database/index.ts` resolves `__dirname/schema.sql`;
in production `__dirname` lands on `backend/dist/database`, where `schema.sql`
is stale (4,891 bytes) vs `src/database/schema.sql` (11,096 bytes). `noEmit: true`
means `npm run build` never emits a fresh `dist`, and `.dockerignore` excludes
`dist/`, so the dist copy can never be refreshed.

**Decision (C-3-DEC-01):** Remove `__dirname`-based schema resolution and read
the schema from the committed source of truth.
- In `backend/src/database/index.ts`, resolve
  `path.resolve(__dirname, "..", "..", "src", "database", "schema.sql")`.
  This lands on `backend/src/database/schema.sql` in BOTH dev (`tsx
  src/server.ts` -> `__dirname` = `backend/src/database`) and production
  (`node dist/server.js` -> `__dirname` = `backend/dist/database`).
- Effect: production schema is now sourced reproducibly and byte-matches the
  authoritative `src/database/schema.sql`.
- No migration is required for C-3 because no schema column/table changes.

## C-4 — Agent registration broken by schema drift

**Finding:** `backend/src/services/agentAuthService.ts` inserts into
`agents (...expires_at)` and `agent_tokens (token_hash, agent_id, role,
expires_at)`, but `backend/src/database/schema.sql` `agents` table has no
`expires_at` column and no `agent_tokens` table exists at all (line 137 is the
unrelated `agent_activities` table). Agent registration fails at runtime.

**Decision (C-4-DEC-01):** Schema change + migration.
- `backend/src/database/schema.sql`:
  - `agents` table gains a nullable `expires_at DATETIME` column.
  - New `agent_tokens` table:
    ```sql
    CREATE TABLE IF NOT EXISTS agent_tokens (
      token_hash    TEXT PRIMARY KEY,
      agent_id      TEXT NOT NULL REFERENCES agents(agent_id),
      role          TEXT NOT NULL,
      expires_at    DATETIME,
      created_at    DATETIME NOT NULL DEFAULT (datetime('now'))
    );
    ```
- **Migration (C-4-DEC-02):** Existing databases (created from the old schema)
  must be migrated. The app applies the schema on startup via
  `db.exec(schemaSql)` using `CREATE TABLE IF NOT EXISTS`, which handles new
  tables. For existing databases the app additionally runs an idempotent
  migration on first connection:
  1. `ALTER TABLE agents ADD COLUMN expires_at DATETIME` — only when missing
     (guarded by `PRAGMA table_info(agents)`).
  2. `CREATE TABLE IF NOT EXISTS agent_tokens (...)` — covered by the schema
     statement itself, kept idempotent.
  This is idempotent on both fresh and pre-existing databases and changes no
  runtime logic.

- **C-4-DEC-03 (agentAuthService.ts):** The registered `agents` row also requires
  the NOT NULL fields the registration request does not carry (`name`,
  `provider`, `model`, `permissions`, `updated_at`). The INSERT now derives
  defaults with documented fallbacks: `provider`/`model` read
  `AGENT_PROVIDER`/`AGENT_MODEL` env (default `"gemini"`/"gemini-1.5-flash"),
  `permissions` defaults to `"[]"`, `name` defaults to `"Agent <hash-prefix>"`,
  `updated_at` = `now`. This is a required, minimal companion to the schema
  change for `agent registration succeeds against the migrated schema`.

- No new dependency; no secrets in artifacts.

## Cross-cutting

- No new dependencies, no secrets, no unrelated redesign.
- Gates verified after each change: backend typecheck, backend build, backend
  tests, frontend typecheck, frontend build.
- The local dev database (`backend/data/app.db`) still carries the old schema and
  will be migrated on next startup once the app ships the change above.