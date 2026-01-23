#!/bin/bash
# Edwards Engineering Management - Automated Deployment Script (Bash)
# Usage: ./deploy_to_vm.sh [options]

SERVER_IP="10.182.252.32"
USERNAME="atlasAdmin"
DOMAIN="eob.10.182.252.32.sslip.io"
SKIP_BACKUP=false
SKIP_BUILD=false
REMOTE_PATH="/home/atlasAdmin/services/edwards_project"

# Parse arguments
for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    *)
      # Assume other args might be overrides, but for now keep simple
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_OUTPUT_DIR="$PROJECT_ROOT/build_output"

echo -e "\n===================================================="
echo -e "   EOB Project - Complete Deployment to VM (Bash)"
echo -e "   Target: $USERNAME@$SERVER_IP"
echo -e "====================================================\n"

# Pre-flight check
echo "Checking SSH connectivity..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "$USERNAME@$SERVER_IP" "exit" 2>/dev/null; then
    echo -e "\033[0;31m[ERROR] Cannot connect to $USERNAME@$SERVER_IP.\033[0m"
    echo "  Please check your SSH keys or network connection."
    echo "  Try running: ssh $USERNAME@$SERVER_IP"
    exit 1
fi
echo -e "\033[0;32m  ✓ SSH Connection confirmed.\033[0m"

# Step 0: Build
if [ "$SKIP_BUILD" = false ]; then
    echo -e "\033[0;32m[0/7] Building project...\033[0m"
    cd "$PROJECT_ROOT"
    python3 scripts/build_and_compress.py
    if [ $? -ne 0 ]; then
        echo -e "\033[0;31m[ERROR] Build failed.\033[0m"
        exit 1
    fi
    echo -e "\033[0;32m  ✓ Build complete.\033[0m"
else
    echo -e "\033[0;33m[0/7] Skipping build (using existing archive)...";
fi

# Step 1: Find latest archive
echo -e "\n\033[0;32m[1/7] Searching for latest build archive...\033[0m"
LATEST_ARCHIVE=$(ls -t "$BUILD_OUTPUT_DIR"/eob-project_*.tar.gz 2>/dev/null | head -n 1)

if [ -z "$LATEST_ARCHIVE" ]; then
    echo -e "\033[0;31m[ERROR] No build archive found in $BUILD_OUTPUT_DIR\033[0m"
    exit 1
fi

ARCHIVE_NAME=$(basename "$LATEST_ARCHIVE")
ARCHIVE_SIZE=$(du -h "$LATEST_ARCHIVE" | cut -f1)
echo -e "\033[0;32m  ✓ Found: $ARCHIVE_NAME ($ARCHIVE_SIZE)\033[0m"

# Step 2: Prepare remote dir
echo -e "\n\033[0;32m[2/7] Preparing remote directory...\033[0m"
ssh "$USERNAME@$SERVER_IP" "mkdir -p $REMOTE_PATH/backups"
if [ $? -ne 0 ]; then
    echo -e "\033[0;31m[ERROR] Failed to create remote directory.\033[0m"
    exit 1
fi

if [ "$SKIP_BACKUP" = false ]; then
    echo -e "\033[0;32m  Creating database backup...\033[0m"
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    ssh "$USERNAME@$SERVER_IP" "cd $REMOTE_PATH && docker exec edwards-postgres pg_dump -U postgres -d edwards > backups/edwards_backup_$TIMESTAMP.sql 2>/dev/null || echo 'No existing database to backup'"
    echo -e "\033[0;32m  ✓ Database backup step complete.\033[0m"
else
    echo -e "\033[0;32m  ✓ Remote directory ready (skipping backup).\033[0m"
fi

# Step 3: Upload
echo -e "\n\033[0;32m[3/7] Uploading archive to VM...\033[0m"
scp "$LATEST_ARCHIVE" "$USERNAME@$SERVER_IP:$REMOTE_PATH/$ARCHIVE_NAME"
if [ $? -ne 0 ]; then
    echo -e "\033[0;31m[ERROR] Upload failed.\033[0m"
    exit 1
fi
echo -e "\033[0;32m  ✓ Upload complete.\033[0m"

# Step 4: Stop and Extract
echo -e "\n\033[0;32m[4/7] Stopping app containers and extracting archive...\033[0m"
ssh "$USERNAME@$SERVER_IP" "docker stop edwards-api edwards-web 2>/dev/null || true"
ssh "$USERNAME@$SERVER_IP" "docker rm edwards-api edwards-web 2>/dev/null || true"

# Use an existing image (postgres:15) to delete files, since the server cannot pull 'alpine'
# This mounts the remote path to /work in the container and deletes the files
ssh "$USERNAME@$SERVER_IP" "docker run --rm -v $REMOTE_PATH:/work postgres:15 sh -c 'cd /work && rm -rf backend frontend docker_images .env.example docker-compose.yml' && cd $REMOTE_PATH && tar -xzf $ARCHIVE_NAME --strip-components=1 && rm $ARCHIVE_NAME"

if [ $? -ne 0 ]; then
    echo -e "\033[0;31m[ERROR] Extraction or cleanup failed.\033[0m"
    echo "  This is likely due to permission issues or a corrupt archive."
    exit 1
fi
echo -e "\033[0;32m  ✓ Archive extracted (DB preserved).\033[0m"

# Step 4.5: Create .env
echo -e "\n\033[0;32m[4.5/7] Creating .env file on server...\033[0m"
LOCAL_ENV_TMP="$SCRIPT_DIR/.env.production.tmp"
cat <<EOF > "$LOCAL_ENV_TMP"
POSTGRES_USER=postgres
POSTGRES_PASSWORD=edwards_prod_password_2026
POSTGRES_DB=edwards
SECRET_KEY=edwards-prod-secret-key-2026-change-this-to-random-string
DEBUG=false
LOG_LEVEL=info
CORS_ORIGINS=http://eob.10.182.252.32.sslip.io
VITE_API_URL=/api
EOF

scp "$LOCAL_ENV_TMP" "$USERNAME@$SERVER_IP:$REMOTE_PATH/.env"
rm "$LOCAL_ENV_TMP"

if [ $? -ne 0 ]; then
    echo -e "\033[0;31m[ERROR] Failed to create .env file.\033[0m"
    exit 1
fi
echo -e "\033[0;32m  ✓ .env file created.\033[0m"

# Step 5: Cleanup
echo -e "\n\033[0;32m[5/7] Cleaning up...\033[0m"
ssh "$USERNAME@$SERVER_IP" "sudo systemctl disable --now nginx 2>/dev/null || true"
ssh "$USERNAME@$SERVER_IP" "docker system prune -f"
ssh "$USERNAME@$SERVER_IP" "docker image prune -a -f --filter 'until=24h'"
echo -e "\033[0;32m  ✓ Cleanup complete.\033[0m"

# Step 6: Load Images
echo -e "\n\033[0;32m[6/7] Loading Docker images...\033[0m"
ssh "$USERNAME@$SERVER_IP" "cd $REMOTE_PATH/docker_images && docker load < postgres-15.tar"
ssh "$USERNAME@$SERVER_IP" "cd $REMOTE_PATH/docker_images && docker load < eob-backend.tar"
ssh "$USERNAME@$SERVER_IP" "cd $REMOTE_PATH/docker_images && docker load < eob-frontend.tar"
echo -e "\033[0;32m  ✓ Docker images loaded.\033[0m"

# Step 7: Start
echo -e "\n\033[0;32m[7/7] Starting application containers...\033[0m"
DB_STATUS=$(ssh "$USERNAME@$SERVER_IP" "docker ps -q -f name=edwards-postgres")

if [ -n "$DB_STATUS" ]; then
    echo -e "\033[0;33m  ✓ Database already running, starting backend and frontend only...\033[0m"
    ssh "$USERNAME@$SERVER_IP" "cd $REMOTE_PATH && docker-compose up -d backend frontend"
else
    echo -e "\033[0;32m  Starting all containers...\033[0m"
    ssh "$USERNAME@$SERVER_IP" "cd $REMOTE_PATH && docker-compose up -d"
fi

sleep 10
ssh "$USERNAME@$SERVER_IP" "cd $REMOTE_PATH && docker-compose ps"

echo -e "\n===================================================="
echo -e "          🎉 Deployment Complete! 🎉"
echo -e "===================================================="
echo -e "  🌐 Application: http://$DOMAIN"
echo -e "===================================================="
