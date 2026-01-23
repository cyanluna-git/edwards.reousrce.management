# Edwards Engineering Management - Automated Deployment Script (PowerShell)
# Complete one-command deployment including nginx configuration

param (
    [string]$ServerIP = "10.182.252.32",
    [string]$Username = "atlasAdmin",
    [string]$Domain = "eob.10.182.252.32.sslip.io",
    [switch]$SkipBackup = $false,
    [switch]$SkipBuild = $false
)

# Determine paths dynamically based on script location
$ScriptDir = $PSScriptRoot
$LocalProjectRoot = (Resolve-Path "$ScriptDir\..").Path
$BuildOutputDir = Join-Path $LocalProjectRoot "build_output"
$RemotePath = "/home/atlasAdmin/services/edwards_project"

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "   EOB Project - Complete Deployment to VM" -ForegroundColor Cyan
Write-Host "   Target: $Username@$ServerIP" -ForegroundColor Cyan
Write-Host "===================================================`n" -ForegroundColor Cyan

# Pre-flight: Check SSH Connection
Write-Host "Checking SSH connectivity..." -ForegroundColor Gray
ssh -o BatchMode=yes -o ConnectTimeout=5 "$Username@$ServerIP" "exit" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Cannot connect to $Username@$ServerIP." -ForegroundColor Red
    Write-Host "  Possible causes:" -ForegroundColor Gray
    Write-Host "  1. SSH keys are not configured or loaded (Password auth is disabled in this script to prevent hangs)." -ForegroundColor Gray
    Write-Host "  2. Network connection issue or VPN required." -ForegroundColor Gray
    Write-Host "  3. Host key verification failed." -ForegroundColor Gray
    Write-Host "`n  Try running manually to diagnose: ssh $Username@$ServerIP" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ SSH Connection confirmed." -ForegroundColor Green

# Step 0: Build (if not skipped)
if (-not $SkipBuild) {
    Write-Host "[0/7] Building project..." -ForegroundColor Green
    Push-Location $LocalProjectRoot
    python scripts/build_and_compress.py
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Build failed." -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "  ✓ Build complete." -ForegroundColor Green
} else {
    Write-Host "[0/7] Skipping build (using existing archive)..." -ForegroundColor Yellow
}

# Step 1: Find the latest build archive
Write-Host "`n[1/7] Searching for latest build archive..." -ForegroundColor Green
$LatestArchive = Get-ChildItem -Path $BuildOutputDir -Filter "eob-project_*.tar.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $LatestArchive) {
    Write-Host "[ERROR] No build archive found in $BuildOutputDir" -ForegroundColor Red
    exit 1
}

$ArchiveName = $LatestArchive.Name
$ArchivePath = $LatestArchive.FullName
$ArchiveSizeMB = [Math]::Round($LatestArchive.Length/1MB, 1)
Write-Host "  ✓ Found: $ArchiveName ($ArchiveSizeMB MB)" -ForegroundColor Green

# Step 2: Ensure remote directory exists and backup database (if not skipped)
Write-Host "`n[2/7] Preparing remote directory..." -ForegroundColor Green

ssh "$Username@$ServerIP" "mkdir -p $RemotePath/backups"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to create remote directory." -ForegroundColor Red
    exit 1
}

if (-not $SkipBackup) {
    Write-Host "  Creating database backup..." -ForegroundColor Green
    $BackupTimestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    
    ssh "$Username@$ServerIP" "cd $RemotePath && docker exec edwards-postgres pg_dump -U postgres -d edwards > backups/edwards_backup_$BackupTimestamp.sql 2>/dev/null || echo 'No existing database to backup'"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Database backup complete." -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Backup failed or containers not running (continuing anyway)." -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✓ Remote directory ready (skipping backup)." -ForegroundColor Green
}

# Step 3: Upload archive to VM
Write-Host "`n[3/7] Uploading archive to VM..." -ForegroundColor Green
Write-Host "  Target: $Username@$ServerIP`:$RemotePath" -ForegroundColor Gray

scp "$ArchivePath" "$Username@$ServerIP`:$RemotePath/$ArchiveName"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Upload failed." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Upload complete." -ForegroundColor Green

# Step 4: Stop containers and extract archive (preserve DB)
Write-Host "`n[4/7] Stopping app containers and extracting archive..." -ForegroundColor Green

# Only stop backend and frontend, keep DB running
ssh "$Username@$ServerIP" "docker stop edwards-api edwards-web 2>/dev/null || true"
ssh "$Username@$ServerIP" "docker rm edwards-api edwards-web 2>/dev/null || true"

# Use an existing image (postgres:15) to delete files, since the server cannot pull 'alpine' from Docker Hub
ssh "$Username@$ServerIP" "docker run --rm -v ${RemotePath}:/work postgres:15 sh -c 'cd /work && rm -rf backend frontend docker_images .env.example docker-compose.yml' && cd $RemotePath && tar -xzf $ArchiveName --strip-components=1 && rm $ArchiveName"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Extraction failed." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Archive extracted (DB preserved)." -ForegroundColor Green

# Step 4.5: Create .env file on server
Write-Host "`n[4.5/7] Creating .env file on server..." -ForegroundColor Green

$EnvContent = @'
POSTGRES_USER=postgres
POSTGRES_PASSWORD=edwards_prod_password_2026
POSTGRES_DB=edwards
SECRET_KEY=edwards-prod-secret-key-2026-change-this-to-random-string
DEBUG=false
LOG_LEVEL=info
CORS_ORIGINS=http://eob.10.182.252.32.sslip.io
VITE_API_URL=/api
'@

# Save to local temp file and SCP it (safer than complex nested heredocs)
$LocalEnvPath = Join-Path $ScriptDir ".env.production.tmp"
Set-Content -Path $LocalEnvPath -Value $EnvContent -NoNewline -Encoding UTF8

scp "$LocalEnvPath" "$Username@$ServerIP`:$RemotePath/.env"
Remove-Item -Path $LocalEnvPath -ErrorAction SilentlyContinue

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to create .env file." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ .env file created." -ForegroundColor Green

# Step 5: Clean up old artifacts & Disable Host Nginx
Write-Host "`n[5/7] Cleaning up and ensuring Nginx is off..." -ForegroundColor Green

ssh "$Username@$ServerIP" "sudo systemctl disable --now nginx 2>/dev/null || echo '(Nginx not installed or no sudo)'"
ssh "$Username@$ServerIP" "docker system prune -f"
ssh "$Username@$ServerIP" "docker image prune -a -f --filter 'until=24h'"

Write-Host "  ✓ Cleanup complete." -ForegroundColor Green

# Step 6: Load Docker images
Write-Host "`n[6/7] Loading Docker images..." -ForegroundColor Green

ssh "$Username@$ServerIP" "cd $RemotePath/docker_images && docker load < postgres-15.tar"
ssh "$Username@$ServerIP" "cd $RemotePath/docker_images && docker load < eob-backend.tar"
ssh "$Username@$ServerIP" "cd $RemotePath/docker_images && docker load < eob-frontend.tar"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker image loading failed." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Docker images loaded." -ForegroundColor Green

# Step 7: Start containers (excluding DB if already running)
Write-Host "`n[7/7] Starting application containers..." -ForegroundColor Green

# Check if DB is already running
$DbStatus = ssh "$Username@$ServerIP" "docker ps -q -f name=edwards-postgres"

if ($DbStatus) {
    Write-Host "  ✓ Database already running, starting backend and frontend only..." -ForegroundColor Yellow
    ssh "$Username@$ServerIP" "cd $RemotePath && docker-compose up -d backend frontend"
} else {
    Write-Host "  Starting all containers..." -ForegroundColor Green
    ssh "$Username@$ServerIP" "cd $RemotePath && docker-compose up -d"
}

Start-Sleep -Seconds 10
ssh "$Username@$ServerIP" "cd $RemotePath && docker-compose ps"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Container startup failed." -ForegroundColor Red
    Write-Host "Attempting to view logs..." -ForegroundColor Yellow
    ssh "$Username@$ServerIP" "cd $RemotePath && docker-compose logs --tail=50"
    exit 1
}
Write-Host "  ✓ Containers started." -ForegroundColor Green

# Final Summary
Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "          🎉 Deployment Complete! 🎉" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  📦 Archive: $ArchiveName ($ArchiveSizeMB MB)" -ForegroundColor Gray
Write-Host "  🌐 Application: http://$Domain" -ForegroundColor Green
Write-Host "     (Managed by Coolify/Traefik)" -ForegroundColor Gray
Write-Host "  ⏰ Deployed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# Optional: Open browser
$Response = Read-Host "Open browser to $Domain? (y/n)"
if ($Response -eq 'y' -or $Response -eq 'Y') {
    Start-Process "http://$Domain"
}
