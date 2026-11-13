# Project Manager - Backup Configuration
# Phase 4: DM-002 Automated Backups

## Backup Strategy (SQLite, local-first)

### Nightly Backup
- **Schedule**: 00:00 UTC daily (via cron or GitHub Actions scheduled workflow)
- **Method**: PRAGMA wal_checkpoint(PASSIVE) → copy app.db + app.db-wal + app.db-shm
- **Retention**: 30 nights
- **Storage**: Local backups/ directory + optional cloud bucket (S3-compatible/Azure Blob)

### On-Demand Backup
- **API**: POST /api/backup (auth required)
- **CLI**: ./scripts/backup.sh [backup-dir]
- **Pre-deploy**: Always take a manual backup before deploying

### Restore Procedure
1. Stop application: docker compose down
2. Restore: ./scripts/restore.sh <backup-file>
3. Run migrations: npm run db:migrate
4. Start: docker compose up -d
5. Verify: curl http://localhost:4000/health

### Backup API Endpoints
- POST /api/backup - Create manual backup
- GET /api/backup - List all backups
- DELETE /api/backup/:filename - Delete a backup
- POST /api/backup/prune - Prune old backups (keep N)

### Retention Policy
- Keep last 30 backups
- Prune automatically via POST /api/backup/prune
- Weekly cleanup via GitHub Actions scheduled workflow
