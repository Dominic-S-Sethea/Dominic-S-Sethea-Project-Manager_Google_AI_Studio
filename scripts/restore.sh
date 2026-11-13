#!/bin/bash
# Project Manager - SQLite Restore Script
# Usage: ./scripts/restore.sh <backup-file>

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup-file>"
    exit 1
fi

BACKUP_FILE="$1"
DB_PATH="${DB_PATH:-./backend/data/app.db}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Stop the application (if running via Docker)
if command -v docker &> /dev/null; then
    docker compose down 2>/dev/null || true
fi

# Backup current DB before restore
if [ -f "${DB_PATH}" ]; then
    cp "${DB_PATH}" "${DB_PATH}.pre-restore"
    echo "Current DB backed up to ${DB_PATH}.pre-restore"
fi

# Restore
mkdir -p "$(dirname "${DB_PATH}")"
cp "${BACKUP_FILE}" "${DB_PATH}"
echo "Restored: ${BACKUP_FILE} → ${DB_PATH}"

# Restore WAL/SHM if they exist
for ext in "-wal" "-shm"; do
    if [ -f "${BACKUP_FILE}${ext}" ]; then
        cp "${BACKUP_FILE}${ext}" "${DB_PATH}${ext}"
        echo "Restored ${ext} file"
    fi
done

echo "Restore complete. Start the application to verify."
