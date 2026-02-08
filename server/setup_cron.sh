#!/bin/bash
# ============================================================
# Edwards EOB - Setup cron job for daily DB backup
# ============================================================
# Run this once on the server to register the cron job.
#
# Usage:
#   ./setup_cron.sh          # install cron (daily 2:00 AM)
#   ./setup_cron.sh --remove # remove cron
#   ./setup_cron.sh --show   # show current cron entries
# ============================================================

set -euo pipefail

PROJECT_DIR="/data/eob/edwards_project"
BACKUP_SCRIPT="${PROJECT_DIR}/server/backup_db.sh"
BACKUP_LOG="${PROJECT_DIR}/backups/backup.log"
CRON_SCHEDULE="0 2 * * *"
CRON_MARKER="# edwards-eob-db-backup"
CRON_LINE="${CRON_SCHEDULE} ${BACKUP_SCRIPT} >> ${BACKUP_LOG} 2>&1 ${CRON_MARKER}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

install_cron() {
    # Ensure script is executable
    chmod +x "${BACKUP_SCRIPT}"

    # Ensure backup/log directory exists
    mkdir -p "$(dirname "${BACKUP_LOG}")"

    # Check if already installed
    if crontab -l 2>/dev/null | grep -q "${CRON_MARKER}"; then
        log "Cron job already installed. Updating..."
        remove_cron_silent
    fi

    # Add to crontab
    (crontab -l 2>/dev/null; echo "${CRON_LINE}") | crontab -
    log "Cron job installed: daily at 02:00 AM"
    log "  Script: ${BACKUP_SCRIPT}"
    log "  Log:    ${BACKUP_LOG}"
    log ""
    log "Verify with: crontab -l"
    log "Test now:    ${BACKUP_SCRIPT}"
}

remove_cron_silent() {
    crontab -l 2>/dev/null | grep -v "${CRON_MARKER}" | crontab - 2>/dev/null || true
}

remove_cron() {
    if crontab -l 2>/dev/null | grep -q "${CRON_MARKER}"; then
        remove_cron_silent
        log "Cron job removed."
    else
        log "No cron job found to remove."
    fi
}

show_cron() {
    log "Current crontab entries:"
    crontab -l 2>/dev/null || echo "(empty)"
}

# ---- Main ----

case "${1:-}" in
    --remove)
        remove_cron
        ;;
    --show)
        show_cron
        ;;
    *)
        install_cron
        ;;
esac
