#!/usr/bin/env bash
# Edwards Engineering Management - Automated Deployment Script

set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Defaults (override via flags)
# ─────────────────────────────────────────────────────────────
SERVER_IP="10.182.252.32"
USERNAME="atlasAdmin"
DOMAIN="eob.10.182.252.32.sslip.io"
REMOTE_PATH="/data/eob/edwards_project"
SKIP_BACKUP=false
SKIP_BUILD=false
SKIP_ENV_SYNC=false
ARCHIVE_PATH=""

# ─────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_OUTPUT_DIR="$PROJECT_ROOT/build_output"

# ─────────────────────────────────────────────────────────────
# Colors
# ─────────────────────────────────────────────────────────────
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
WHITE='\033[37m'
RESET='\033[0m'

info()  { echo -e "${GREEN}${1}${RESET}"; }
warn()  { echo -e "${YELLOW}${1}${RESET}"; }
error() { echo -e "${RED}${1}${RESET}"; }
plain() { echo -e "${WHITE}${1}${RESET}"; }

print_header() {
  echo -e "${CYAN}====================================================${RESET}"
  echo -e "${CYAN}${1}${RESET}"
  echo -e "${CYAN}====================================================${RESET}"
}

require_value() {
  local flag="$1"
  local value="${2:-}"

  if [[ -z "$value" || "$value" == --* ]]; then
    error "[ERROR] Missing value for $flag"
    echo
    usage
    exit 1
  fi
}

# ─────────────────────────────────────────────────────────────
# Argument parsing
# ─────────────────────────────────────────────────────────────
usage() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  --server-ip <IP>     Target server IP (default: $SERVER_IP)"
  echo "  --username  <USER>   SSH username     (default: $USERNAME)"
  echo "  --domain    <DOMAIN> App domain       (default: $DOMAIN)"
  echo "  --remote-path <DIR>  Remote deploy dir (default: $REMOTE_PATH)"
  echo "  --archive <PATH>     Deploy a specific archive file"
  echo "  --skip-backup        Skip DB backup before deploy"
  echo "  --skip-build         Skip build (use existing archive)"
  echo "  --skip-env-sync      Skip generating .env.remote from .env"
  echo "  -h, --help           Show this help"
  echo ""
  echo "Example:"
  echo "  $0"
  echo "  $0 --skip-build"
  echo "  $0 --server-ip 10.182.0.1 --domain myapp.example.com"
  echo "  $0 --skip-build --archive build_output/edwards_project_20260313_075912.tar.gz"
  echo "  $0 --remote-path /opt/edwards_project --skip-env-sync"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-ip)
      require_value "$1" "${2:-}"
      SERVER_IP="$2"
      shift 2
      ;;
    --username)
      require_value "$1" "${2:-}"
      USERNAME="$2"
      shift 2
      ;;
    --domain)
      require_value "$1" "${2:-}"
      DOMAIN="$2"
      shift 2
      ;;
    --remote-path)
      require_value "$1" "${2:-}"
      REMOTE_PATH="$2"
      shift 2
      ;;
    --archive)
      require_value "$1" "${2:-}"
      ARCHIVE_PATH="$2"
      shift 2
      ;;
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-env-sync)
      SKIP_ENV_SYNC=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *) error "[ERROR] Unknown option: $1"; echo; usage; exit 1 ;;
  esac
done

# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────
echo ""
print_header "   EOB Project - Full Deployment to VM"
plain "   Target: $USERNAME@$SERVER_IP"
plain "   Remote Path: $REMOTE_PATH"
echo ""

# Pre-flight: Check SSH connection
info "Checking SSH connectivity..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "$USERNAME@$SERVER_IP" "exit" 2>/dev/null; then
  error "[ERROR] Cannot connect to $USERNAME@$SERVER_IP."
  warn "  Try running manually: ssh $USERNAME@$SERVER_IP"
  exit 1
fi
info "  ✓ SSH Connection confirmed."

cd "$PROJECT_ROOT"

# Step 0: Generate .env.remote
if [[ "$SKIP_ENV_SYNC" == false ]]; then
  info "[0/8] Generating .env.remote from .env..."
  python3 scripts/deploy/env.py --profile server --domain "$DOMAIN"
  info "  ✓ .env.remote generated."
else
  warn "[0/8] Skipping .env.remote generation..."
fi

# Step 1: Build
if [[ "$SKIP_BUILD" == false ]]; then
  echo ""
  info "[1/8] Building project..."
  python3 scripts/deploy/build.py
  info "  ✓ Build complete."
else
  warn "[1/8] Skipping build (using existing archive)..."
fi

# Step 2: Find build archive
echo ""
info "[2/8] Selecting build archive..."

if [[ -n "$ARCHIVE_PATH" ]]; then
  if [[ ! -f "$ARCHIVE_PATH" ]]; then
    error "[ERROR] Archive not found: $ARCHIVE_PATH"
    exit 1
  fi
  LATEST_ARCHIVE="$(cd "$(dirname "$ARCHIVE_PATH")" && pwd)/$(basename "$ARCHIVE_PATH")"
else
  LATEST_ARCHIVE=$(ls -t "$BUILD_OUTPUT_DIR"/edwards_project_*.tar.gz 2>/dev/null | head -1 || true)
fi

if [[ -z "$LATEST_ARCHIVE" ]]; then
  error "[ERROR] No build archive found in $BUILD_OUTPUT_DIR"
  exit 1
fi

ARCHIVE_NAME=$(basename "$LATEST_ARCHIVE")
ARCHIVE_SIZE=$(du -sh "$LATEST_ARCHIVE" | cut -f1)
info "  ✓ Found: $ARCHIVE_NAME ($ARCHIVE_SIZE)"

# Step 3: Prepare remote directory + backup DB
echo ""
info "[3/8] Preparing remote directory..."
ssh "$USERNAME@$SERVER_IP" \
  "if [[ -d $REMOTE_PATH && -w $REMOTE_PATH ]]; then \
      mkdir -p $REMOTE_PATH/backups; \
    elif mkdir -p $REMOTE_PATH/backups 2>/dev/null; then \
      :; \
    elif sudo -n mkdir -p $REMOTE_PATH && sudo -n chown ${USERNAME}:${USERNAME} $REMOTE_PATH && mkdir -p $REMOTE_PATH/backups; then \
      :; \
    else \
      echo '[ERROR] Unable to prepare remote deployment directory. Check permissions for $REMOTE_PATH.' >&2; \
      exit 1; \
    fi"

if [[ "$SKIP_BACKUP" == false ]]; then
  info "  Creating database backup..."
  BACKUP_TS=$(date +%Y%m%d_%H%M%S)
  ssh "$USERNAME@$SERVER_IP" \
    "cd $REMOTE_PATH && docker exec edwards-postgres pg_dump -U postgres -d edwards > backups/edwards_backup_${BACKUP_TS}.sql 2>/dev/null || echo 'No existing database to backup'"
fi

# Step 4: Upload archive
echo ""
info "[4/8] Uploading archive to VM..."
scp "$LATEST_ARCHIVE" "$USERNAME@$SERVER_IP:/tmp/$ARCHIVE_NAME"
info "  ✓ Upload complete."

# Step 5: Stop containers and extract
echo ""
info "[5/8] Extracting archive..."
ssh "$USERNAME@$SERVER_IP" "docker stop edwards-api edwards-web 2>/dev/null || true"
ssh "$USERNAME@$SERVER_IP" "docker rm   edwards-api edwards-web 2>/dev/null || true"
ssh "$USERNAME@$SERVER_IP" \
  "cd $REMOTE_PATH && tar -xzf /tmp/$ARCHIVE_NAME --strip-components=1 && rm /tmp/$ARCHIVE_NAME"
info "  ✓ Archive extracted."

# Step 6: Load Docker images
echo ""
info "[6/8] Loading Docker images..."
ssh "$USERNAME@$SERVER_IP" \
  "cd $REMOTE_PATH/docker_images && chmod +x load_images.sh && ./load_images.sh"

# Step 7: Start containers
echo ""
info "[7/8] Starting containers..."
ssh "$USERNAME@$SERVER_IP" "cd $REMOTE_PATH && docker-compose up -d"

# Step 8: Verify
echo ""
info "[8/8] Verifying services..."
sleep 5
ssh "$USERNAME@$SERVER_IP" "cd $REMOTE_PATH && docker-compose ps"
ssh "$USERNAME@$SERVER_IP" "curl --fail --silent --show-error --max-time 10 http://localhost:8004/health >/dev/null"
ssh "$USERNAME@$SERVER_IP" "curl --fail --silent --show-error --max-time 10 http://localhost:3004 >/dev/null"
info "  ✓ Backend /health responded."
info "  ✓ Frontend responded on localhost:3004."

echo ""
print_header "          🚀 Deployment Complete! 🚀"
plain "  Frontend: https://$DOMAIN"
plain "  Coolify:  http://coolify.$SERVER_IP.sslip.io"
echo ""
