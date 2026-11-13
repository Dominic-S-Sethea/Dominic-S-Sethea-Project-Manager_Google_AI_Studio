# Phase 4 — Environment Configuration & Secrets (Project Manager)

## 1. Variable inventory

Everything below is referenced by the code, `docker-compose.yml`, or `.env.example`.

| Variable | Purpose | Type | Dev | Staging | Prod | Secret? | Notes |
|---|---|---|---|---|---|---|---|
| `NODE_ENV` | app mode | string | `development` | `production` | `production` | no | controls dotenv path + Vite middleware |
| `PORT` / `NODE_PORT` | API listen port | int | `4000` | `4000` | `4000` | no | `server.ts` reads `NODE_PORT || 3000`; `index.ts` reads `TEST_PORT || 0` (see CI doc) |
| `CORS_ORIGIN` | allowed browser origins | list | `http://localhost:5173` | `https://staging.example.com` | `https://example.com` | no | add frontend domain(s) for each env |
| `DB_PATH` | SQLite file path | path | `./data/app.db` | `/app/backend/data/app.db` | `/app/backend/data/app.db` | no | WAL mode; must be on persistent, backed-up volume in staging/prod |
| `JWT_SECRET` | human-session signing key | 64-byte base64url | dev value | staging value | **generated, never commit** | ✅ yes | generate: `node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"` |
| `RATE_LIMIT_WINDOW_MS` | global rate-limit window | ms | `15*60*1000` | `15*60*1000` | `60*60*1000` | no | tighten in prod |
| `RATE_LIMIT_MAX` | global rate-limit max | int | `100` | `100` | `100` | no | tighten in prod |
| `AGENT_OAUTH_REDIRECT` | agent OAuth callback URL | URL | `http://localhost:4000/api/agents/callback` | `https://staging.example.com/api/agents/callback` | `https://example.com/api/agents/callback` | no | required for agent auth flow |
| `GEMINI_API_KEY` | (optional) AI provider key | string | empty | staging key | **secret** | ✅ yes | multi-provider: Gemini, OpenAI, local |
| `OPENAI_API_KEY` | (optional) AI provider key | string | empty | staging key | **secret** | ✅ yes |  |
| `TEST_PORT` | test-only port override | int | — | — | — | no | used by `backend/src/index.ts` for `node --test` |

## 2. Environment profiles

### Dev (local)
- **Source**: `.env` (copy of `.env.example`, edited locally). `NODE_ENV=development`.
- **Data**: SQLite file at repo-relative `./data/app.db` (gitignored).
- **Run**: `npm run dev:full` — `tsx src/server.ts` (Vite HMR middleware) + Vite dev server on 5173.
- **Rules**: never commit `.env`; `.gitignore` already blocks it. Commit `.env.example` only.

### Staging
- **Source**: `docker-compose.staging.yml` + secret store (GitHub Environments `staging`).
- **Data**: persistent named volume, path `/app/backend/data/app.db`; nightly backup.
- **Run**: `docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d`.
- **URLs**: `https://staging.project-manager.example.com` (CORS + OAUTH redirect + health).

### Production
- **Source**: `docker-compose.prod.yml` + secret store (GitHub Environments `production`).
- **Data**: named volume `backend_data` on the host datastore, **outside git**; snapshot backups nightly.
- **Run**: single unified server image (`target: runtime`); backend serves the SPA statically (`/app/dist`).
- **URLs**: `https://project-manager.example.com`; `https://www.project-manager.example.com`.

## 3. Secrets management (required before prod deploy)
- **GitHub Actions**: store as repository secrets + environment-protected secrets (`staging`, `production`) with required reviewers.
- **Never** bake secrets into images or `docker-compose.yml` defaults — the current `.env.example` defaults (`change-me-in-production`) are only fallbacks; use real values in every environment.
- **Rotation**: JWT_SECRET + API keys rotate on a schedule; old keys removed from the secret store and from the app config (no in-image values).
- `.gitignore` already covers `.env*`, `*.key`, `node_modules`, `dist`, `*.db*`.

## 4. Mapping: docker-compose env vs `.env.example` vs required prod values

| docker-compose sets | .env.example default | Required in prod? |
|---|---|---|
| `NODE_ENV=production` | — | ✅ |
| `PORT=4000` | `PORT=4000` | ✅ |
| `CORS_ORIGIN=http://localhost:5173,http://localhost:4000` | `CORS_ORIGIN=http://localhost:5173` | ✅ (prod: `https://example.com`) |
| `DB_PATH=/app/backend/data/app.db` | `DB_PATH=./data/app.db` | ✅ |
| `JWT_SECRET=${JWT_SECRET:-change-me-in-production}` | weak fallback | ✅ (real secret from secret store) |
| `RATE_LIMIT_WINDOW_MS=900000` | `15*60*1000` | ✅ (prod: `3600000`) |
| `RATE_LIMIT_MAX=100` | `100` | ✅ |
| `AGENT_OAUTH_REDIRECT` | `http://localhost:4000/api/agents/callback` | ✅ (prod URL) |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | commented out | ✅ (prod only) |

## 5. Deliverables linked to this plan
- `docs/environment-variables.md` — variable inventory + profiles + secrets rules (this file).
- `docs/deployment-checklist.md` — deploy + rollback checklist (next deliverable).
- `.github/workflows/ci-cd.yml` — pipeline that consumes these variables via environment secrets.
