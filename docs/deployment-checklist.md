# Phase 4 — Deployment Checklist (Project Manager)

## A. Pre-deployment verification (run before ANY environment)

### Repo / code state
- [ ] `git status` clean (or changes committed + pushed) — no stray local work on `main`.
- [ ] `validate` GitHub Actions job green on the target branch.
- [ ] Branch protection enabled on `main`: PR required, status checks required, approvals required, branch up to date.

### Image & Dockerfile
- [ ] Dockerfile fixed for production (CSS doc "Dockerfile production serving bug"):
  - [ ] frontend dist copied into runtime image where the unified server serves it (`/app/dist`);
  - [ ] single entry point (`src/server.ts` with Vite middleware in dev / static `dist` in prod) — **never two apps listening**;
  - [ ] base image ≥ Node 22.5 (node:sqlite exists) — currently `node:20-alpine` is a blocker.
- [ ] `node:sqlite` availability confirmed on the chosen Node image (test build + `node -e "require('node:sqlite')"`).
- [ ] Backend unit tests + frontend typecheck + build green inside the image build.

### Environment
- [ ] `.env.example` committed; `.env` never committed; secrets in GitHub Environments, not in compose files.
- [ ] `CORS_ORIGIN`, `AGENT_OAUTH_REDIRECT`, `JWT_SECRET`, AI keys match the target environment's URLs.
- [ ] Database path is on a persistent, backed-up volume (prod/staging).

### Data & backups
- [ ] Pre-deploy DB snapshot taken (see Backup section).
- [ ] Rollback image tag identified (previous `<sha>` or `latest` — see C).

### Monitoring
- [ ] `/health` endpoint reachable from outside the container.
- [ ] Log aggregation + alert rule configured (downtime > 2 min, health check failing).

## B. Deploy stages

### Dev (local / VM) — zero ceremony
1. `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` (dev-only compose with Vite dev server).
2. `curl http://localhost:4000/health` → `{"status":"ok"...}` ✅
3. Browser → `http://localhost:5173` loads SPA ✅

### Staging (auto on `main`)
1. Push to `main` → `validate` + `build-and-push` green → `deploy-staging` runs.
2. `curl http://<staging-host>:4000/health` → `ok` ✅
3. Smoke tests pass (API + login attempt rejected without cookie) ✅
4. Post-deploy summary written; notify team channel.
5. **Rollback drill**: redeploy previous image tag → health still ok (proves rollback path).

### Production (manual approval on `v*` tags)
1. Create and push a version tag: `git tag v1.0.0 && git push origin v1.0.0`.
2. `deploy-prod` requires manual approval in the `production` environment.
3. Verify: `curl -fsS https://<prod-host>/health` ✅ and `/` serves the SPA (`<title>Project Manager</title>`).
4. Smoke: login flow, create task, attach checklist, dependency link, export (JSON) — cover core MVP paths.
5. Post-deploy: summary, monitoring alert review, runbook link.

## C. Rollback strategy

| Layer | Mechanism | How-to |
|---|---|---|
| App / image | Redeploy previous image tag | `docker compose up -d --pull always --no-build --image <prev-tag>` (or compose file pinning `image:`) |
| Database | Nightly snapshot + manual pre-deploy snapshot | Restore snapshot to pre-deploy state, then re-run schema seed (`npm --prefix backend run db:migrate`) |
| Config | Revert env values | Update environment secret store / compose env files, redeploy same image |

- **Rollback verification**: `/health` + SPA route + one business flow (create task) before declaring rollback complete.
- Keep last **30 image tags** on GHCR (cleanup job).

## D. Post-deployment verification
- [ ] `/health` OK at least 10 min, no 5xx surge.
- [ ] SPA loads, login page renders.
- [ ] API endpoints: `/api/auth/login`, `/api/tasks`, `/api/checklists`, `/api/dependencies`, `/api/users`.
- [ ] No unhandled errors in aggregated logs (alert threshold 0).
- [ ] Memory/data: DB file size within expected range; WAL checkpointed.
- [ ] Team channel notified with deployment summary + link to runbook.

## E. Backup & restore strategy (SQLite, local-first)
- **Nightly**: `PRAGMA wal_checkpoint(PASSIVE)` → copy `app.db` + `app.db-wal` + `app.db-shm` to backup bucket (S3-compatible/Azure Blob). Retain 30 nights.
- **On-demand**: `docker compose exec backend sh -c "cp /app/backend/data/app.db /tmp/"` while stopped, or use `db:backup` script when added.
- **Restore**: stop stack → copy DB files back → `npm --prefix backend run db:migrate` → start stack → verify `/health`.
- **Schema drift guard**: schema is embedded in `backend/src/database/schema.sql`; migrations are one-time seeds — verify before restore.

## F. Monitoring & alerting (Phase 4 DM-003)
- [ ] `/health` endpoint (API) — primary liveness probe.
- [ ] SPA root check — primary liveness probe for the web tier.
- [ ] Log aggregation (file/JSON) + rotation (> 50 MB/day).
- [ ] Alerts: health check failure > 2 min, HTTP 5xx rate > 1%, DB file growth > 2× prior day.
- [ ] Ticket/automation: deploy failures page on-call; rollback auto-triggered if health fails on deploy.
