# ============================
# Project Manager — Dockerfile
# Multi-stage build
# ============================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci
COPY backend/ ./
RUN npm run build && mkdir -p dist/database && cp -r src/database/migrations dist/database/migrations && cp src/database/schema.sql dist/database/schema.sql

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache ca-certificates curl

# Freshly compiled backend and its runtime dependencies.
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules

# Preserve the package scope so Node interprets emitted .js files as ESM.
COPY --from=backend-builder /app/backend/package.json ./backend/package.json

# The compiled database module resolves this exact source-schema path.
COPY --from=backend-builder /app/backend/src/database/schema.sql ./backend/src/database/schema.sql

# Place the frontend build alongside the backend output.
COPY --from=frontend-builder /app/frontend/dist ./backend/dist

ENV NODE_ENV=production PORT=4000
ENV DB_PATH=/app/backend/data/app.db

RUN mkdir -p /app/backend/data

EXPOSE 4000

WORKDIR /app/backend
CMD ["node", "dist/server.js"]
