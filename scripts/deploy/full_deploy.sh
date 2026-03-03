#!/usr/bin/env bash
# Edwards Engineering Management - Automated Deployment Script

set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Defaults (override via flags)
# ─────────────────────────────────────────────────────────────
SERVER_IP="10.182.252.32"
USERNAME="atlasAdmin"
DOMAIN="eob.10.182.252.32.sslip.io"
SKIP_BACKUP=false
SKIP_BUILD=false

# ─────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_OUTPUT_DIR="$PROJECT_ROOT/build_output"
REMOTE_PATH="/data/eob/edwards_project"

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
  echo "  --skip-backup        Skip DB backup before deploy"
  echo "  --skip-build         Skip build (use existing archive)"
  echo "  -h, --help           Show this help"
  echo ""
  echo "Example:"
  echo "  $0"
  echo "  $0 --skip-build"
  echo "  $0 --server-ip 10.182.0.1 --domain myapp.example.com"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-ip)   SERVER_IP="$2";  shift 2 ;;
    --username)    USERNAME="$2";   shift 2 ;;
    --domain)      DOMAIN="$2";     shift 2 ;;
    --skip-backup) SKIP_BACKUP=true; shift ;;
    --skip-build)  SKIP_BUILD=true;  shift ;;
    -h|--help)     usage; exit 0 ;;
    *) error "[ERROR] Unknown option: $1"; echo; usage; exit 1 ;;
  esac
done

# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────
echo ""
print_header "   EOB Project - Full Deployment to VM"
plain "   Target: $USERNAME@$SERVER_IP"
echo ""

# Pre-flight: Check SSH connection
info "Checking SSH connectivity..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "$USERNAME@$SERVER_IP" "exit" 2>/dev/null; then
  error "[ERROR] Cannot connect to $USERNAME@$SERVER_IP."
  warn "  Try running manually: ssh $USERNAME@$SERVER_IP"
  exit 1
fi
info "  ✓ SSH Connection confirmed."

# Step 0: Generate .env.remote
info "[0/8] Generating .env.remote from .env..."
cd "$PROJECT_ROOT"
python scripts/deploy/env.py --profile server --domain "$DOMAIN"
info "  ✓ .env.remote generated."

# Step 1: Build
if [[ "$SKIP_BUILD" == false ]]; then
  echo ""
  info "[1/8] Building project..."
  python scripts/deploy/build.py
  info "  ✓ Build complete."
else
  warn "[1/8] Skipping build (using existing archive)..."
fi

# Step 2: Find latest build archive
echo ""
info "[2/8] Searching for latest build archive..."
LATEST_ARCHIVE=$(ls -t "$BUILD_OUTPUT_DIR"/edwards_project_*.tar.gz 2>/dev/null | head -1 || true)

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
  "sudo mkdir -p $REMOTE_PATH && sudo chown ${USERNAME}:${USERNAME} $REMOTE_PATH && mkdir -p $REMOTE_PATH/backups"

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

echo ""
print_header "          🚀 Deployment Complete! 🚀"
plain "  Frontend: http://$DOMAIN"
plain "  Coolify:  http://coolify.$SERVER_IP.sslip.io"
echo ""
