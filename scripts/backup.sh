#!/bin/bash
# Project Manager - SQLite Backup Script
# Usage: ./scripts/backup.sh [backup-dir]

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
DB_PATH="${DB_PATH:-./backend/data/app.db}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/app-backup-${TIMESTAMP}.db"

mkdir -p "${BACKUP_DIR}"

# Checkpoint WAL before backup
if command -v sqlite3 &> /dev/null; then
    sqlite3 "${DB_PATH}" "PRAGMA wal_checkpoint(PASSIVE);" 2>/dev/null || true
fi

# Copy database file
if [ -f "${DB_PATH}" ]; then
    cp "${DB_PATH}" "${BACKUP_FILE}"
    echo "Backup created: ${BACKUP_FILE}"
    echo "Size: $(du -h "${BACKUP_FILE}" | cut -f1)"
else
    echo "ERROR: Database file not found at ${DB_PATH}"
    exit 1
fi

# Copy WAL and SHM if they exist
for ext in "-wal" "-shm"; do
    if [ -f "${DB_PATH}${ext}" ]; then
        cp "${DB_PATH}${ext}" "${BACKUP_FILE}${ext}"
        echo "Copied ${ext} file"
    fi
done

# Prune old backups (keep last 30)
cd "${BACKUP_DIR}"
ls -t app-backup-*.db 2>/dev/null | tail -n +31 | xargs -r rm -f
echo "Pruned old backups (kept last 30)"

echo "Backup complete: $(date)"
