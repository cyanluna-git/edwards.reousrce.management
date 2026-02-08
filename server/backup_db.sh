#!/bin/bash
# ============================================================
# Edwards EOB - Daily Database Backup
# ============================================================
# Runs pg_dump via docker exec, saves to BACKUP_DIR with
# timestamp, and removes backups older than RETENTION_DAYS.
#
# Usage:
#   ./backup_db.sh              # use defaults
#   RETENTION_DAYS=14 ./backup_db.sh  # override retention
#
# Crontab (daily 2:00 AM):
#   0 2 * * * /data/eob/edwards_project/server/backup_db.sh >> /data/eob/edwards_project/backups/backup.log 2>&1
# ============================================================

set -euo pipefail

# Configuration (override via environment variables)
DB_CONTAINER="${DB_CONTAINER:-edwards-postgres}"
DB_NAME="${DB_NAME:-edwards}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/data/eob/edwards_project/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Derived
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/edwards_backup_${TIMESTAMP}.sql.gz"

# ---- Functions ----

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

die() {
    log "ERROR: $*" >&2
    exit 1
}

# ---- Main ----

log "=== Database backup started ==="

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Verify container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    die "Container '${DB_CONTAINER}' is not running"
fi

# Run pg_dump and compress
log "Dumping ${DB_NAME} from ${DB_CONTAINER}..."
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"

# Validate backup
if [ ! -s "${BACKUP_FILE}" ]; then
    die "Backup file is empty: ${BACKUP_FILE}"
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
log "Backup saved: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Cleanup old backups
DELETED_COUNT=0
while IFS= read -r old_file; do
    rm -f "${old_file}"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done < <(find "${BACKUP_DIR}" -name "edwards_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -type f 2>/dev/null)

if [ "${DELETED_COUNT}" -gt 0 ]; then
    log "Cleaned up ${DELETED_COUNT} backup(s) older than ${RETENTION_DAYS} days"
fi

# Summary
TOTAL_COUNT=$(find "${BACKUP_DIR}" -name "edwards_backup_*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
log "Backups on disk: ${TOTAL_COUNT} files, ${TOTAL_SIZE} total"
log "=== Backup completed successfully ==="
