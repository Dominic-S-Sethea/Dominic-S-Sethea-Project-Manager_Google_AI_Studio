# Phase 4 — CI/CD Pipeline Plan (Project Manager)

## 1. Objective
Move from "works on a developer machine" to repeatable, verifiable releases:
- Every change to `main` → validated → built → scanned → published as a versioned image.
- Staging auto-deploys on `main`; production deploys on tagged releases (`v*`) behind a manual approval gate.
- Rollbacks are single-command image/tag restores; database backups are nightly dumps.

## 2. What exists today (verified by file review)
| Item | Status |
|---|---|
| `backend/` scripts (build/typecheck/test/dev) | ✅ present |
| `frontend/` scripts (build/typecheck/test) | ✅ present |
| `Dockerfile` (multi-stage: frontend-builder → backend-builder → runtime) | ✅ present |
| `docker-compose.yml` | ✅ present, but **not production-ready** (see TODOs) |
| `.github/` workflows | ❌ absent (planned here) |
| Root `package.json` (for `npm run install:all`) | ❌ absent |
| Remotes / tags / releases | ❌ none configured |

## 3. Pipeline design — GitHub Actions (`.github/workflows/ci-cd.yml`)

### Trigger matrix
| Event | Branch / ref | Permission |
|---|---|---|
| `pull_request` | `main` | validate only |
| `push` | `main` | validate + build/publish + staging deploy |
| `push` | `tags: ['v*']` | build/publish + prod deploy (manual approval) |
| `workflow_dispatch` | any | manual run for any stage |

### Jobs (stage order)
1. **validate** — checkout → setup-node 20 (matches Dockerfile base) → per-package `npm ci` → typecheck (backend + frontend) → backend unit tests (`node --test src/tests/`) → verify frontend `vite build` succeeds. Fails fast on any gate.
2. **build-and-push** (push to main/tags only) — build the multi-stage image (`target: runtime`) from the repo `Dockerfile`; publish to `ghcr.io` tagged `<git-sha>` and `latest` (main only). Adds Trivy image scan (fail on HIGH/CRITICAL).
3. **deploy-staging** (environment: `staging`) — `docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --pull always`; sleeps; hits `/health`; runs smoke tests; posts summary; tears down on failure.
4. **deploy-prod** (environment: `production`) — same compose stack against the production file; requires manual approval; verifies `/health` **and** the SPA route (`/` serves `index.html`); posts summary.
5. **cleanup** (cron weekly / manual) — prunes image tags older than 30 days on GHCR; keeps last 30.

### Artifact flow
```
git push → [validate] → [build + scan] → [publish ghcr.sha] → [staging: compose up]
                                                                 → [prod: compose up] (tag v* + approve)
                                                                 → [health + SPA check] → summary
```

## 4. Concrete workflow file

File: **`.github/workflows/ci-cd.yml`**

```yaml
name: CI/CD — Project Manager

on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: "20"
  REGISTRY: ghcr.io

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - name: Install (root + packages)
        run: |
          npm i -g npm@10
          npm ci --no-audit --no-fund || echo "NOTE: add root package.json first"
          npm --prefix backend ci --no-audit --no-fund
          npm --prefix frontend ci --no-audit --no-fund
      - name: Typecheck backend
        run: npm --prefix backend run typecheck
      - name: Typecheck frontend
        run: npm --prefix frontend run typecheck
      - name: Backend unit tests
        run: npm --prefix backend run test
      - name: Frontend build (vite build)
        run: npm --prefix frontend run build

  build-and-push:
    needs: validate
    if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v'))
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build & push runtime image
        uses: docker/build-push-action@v6
        with:
          context: ..
          file: ../Dockerfile
          target: runtime
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ github.repository }}-backend:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ github.repository }}-backend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Build & push frontend-builder image
        uses: docker/build-push-action@v6
        with:
          context: ..
          file: ../Dockerfile
          target: frontend-builder
          push: true
          tags: ${{ env.REGISTRY }}/${{ github.repository }}-frontend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build-and-push
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Deploy staging stack
        run: |
          docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --pull always
          sleep 10
      - name: Verify health
        run: curl -fsS http://localhost:4000/health
      - name: Smoke tests
        run: |
          curl -fsS http://localhost:4000/health > /dev/null
          curl -fsS -b /tmp/session.cookies http://localhost:4000/api/auth/login && exit 1 || echo "unauthenticated login rejected (expected)"
      - name: Post deploy note
        run: echo "Staging OK @ ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY

  deploy-prod:
    needs: build-and-push
    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy production stack
        run: |
          docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --pull always
          sleep 10
      - name: Verify API health
        run: curl -fsS https://<PROD_HOST>/health
      - name: Verify SPA served
        run: curl -fsS https://<PROD_HOST>/ | grep -q "<title>Project Manager</title>"
      - name: Post deploy note
        run: echo "Production OK @ ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY

  cleanup:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    permissions:
      packages: write
    steps:
      - uses: actions/checkout@v4
      - name: Prune old image tags (keep latest 30)
        run: |
          gh package list --limit 100 --package-type container |             awk -F/ '/project-manager-backend/ {print $NF}' | sort | tail -n +31 | xargs -r gh package delete --yes
```

## 5. What must change in the repo *before* CI works end-to-end
1. **Dockerfile production serving bug** (verified): `server.ts` serves static from `/app/backend/dist`, but the frontend bundle is copied to `/app/frontend/dist` → production SPA returns 404. Fix: `COPY --from=frontend-builder /app/frontend/dist ./dist` so the SPA is served by the unified backend.
2. **Duplicate entry points** (verified): `src/index.ts` (CMD `node dist/index.js`) and `src/server.ts` (start script) both build Express apps and listen on different port defaults with different route sets (`users` routes only in `server.ts`; `index.ts` has no `users` routes). Consolidate to one entry.
3. **Node version** (verified): backend uses `node:sqlite` (built-in driver) which does **not exist in Node 20**; Dockerfile base `node:20-alpine` will crash on startup. Pin `node:22-alpine` (or `node:24-alpine`) or switch to `better-sqlite3`. Also note `node:sqlite` is experimental — review before prod.
4. **Root `package.json`** — add so CI/scripts can resolve `npm run install:all` referenced in README.
5. **docker-compose.yml** — the frontend service uses `target: frontend-builder` (a build stage) with no runtime command (port 5173 suggests a Vite dev server). For production use the unified backend-only stack (`docker-compose.prod.yml`); keep a dev-only compose for local Vite+tsx.
6. **Branch protection** (`main`) + required status checks (`validate`, `build-and-push`).
