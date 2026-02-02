# Edwards Engineering Management - Automated Deployment Script (PowerShell)
# Modified from historical deploy_to_vm.ps1 to match current server setup

param (
    [string]$ServerIP = "10.182.252.32",
    [string]$Username = "atlasAdmin",
    [string]$Domain = "eob.10.182.252.32.sslip.io",
    [switch]$SkipBackup = $false,
    [switch]$SkipBuild = $false
)

# Determine paths
$ScriptDir = $PSScriptRoot
$LocalProjectRoot = $ScriptDir
$BuildOutputDir = Join-Path $LocalProjectRoot "build_output"
$RemotePath = "/data/eob/edwards_project"

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "   EOB Project - Full Deployment to VM" -ForegroundColor Cyan
Write-Host "   Target: $Username@$ServerIP" -ForegroundColor Cyan
Write-Host "===================================================`n" -ForegroundColor Cyan

# Pre-flight: Check SSH Connection
Write-Host "Checking SSH connectivity..." -ForegroundColor Gray
ssh -o BatchMode=yes -o ConnectTimeout=5 "$Username@$ServerIP" "exit" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Cannot connect to $Username@$ServerIP." -ForegroundColor Red
    Write-Host "  Try running manually: ssh $Username@$ServerIP" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ SSH Connection confirmed." -ForegroundColor Green

# Step 0: Build (if not skipped)
if (-not $SkipBuild) {
    Write-Host "[0/7] Building project..." -ForegroundColor Green
    Push-Location $LocalProjectRoot
    python build_and_compress.py
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
$LatestArchive = Get-ChildItem -Path $BuildOutputDir -Filter "edwards_project_*.tar.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $LatestArchive) {
    Write-Host "[ERROR] No build archive found in $BuildOutputDir" -ForegroundColor Red
    exit 1
}

$ArchiveName = $LatestArchive.Name
$ArchivePath = $LatestArchive.FullName
$ArchiveSizeMB = [Math]::Round($LatestArchive.Length/1MB, 1)
Write-Host "  ✓ Found: $ArchiveName ($ArchiveSizeMB MB)" -ForegroundColor Green

# Step 2: Ensure remote directory exists and backup database
Write-Host "`n[2/7] Preparing remote directory..." -ForegroundColor Green
ssh -t "$Username@$ServerIP" "sudo mkdir -p $RemotePath && sudo chown ${Username}:${Username} $RemotePath && mkdir -p $RemotePath/backups"

if (-not $SkipBackup) {
    Write-Host "  Creating database backup..." -ForegroundColor Green
    $BackupTimestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    ssh "$Username@$ServerIP" "cd $RemotePath && docker exec edwards-postgres pg_dump -U postgres -d edwards > backups/edwards_backup_$BackupTimestamp.sql 2>/dev/null || echo 'No existing database to backup'"
}

# Step 3: Upload archive to VM
Write-Host "`n[3/7] Uploading archive to VM..." -ForegroundColor Green
scp "$ArchivePath" "$Username@$ServerIP`:/tmp/$ArchiveName"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Upload failed." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Upload complete." -ForegroundColor Green

# Step 4: Stop containers and extract archive
Write-Host "`n[4/7] Extracting archive..." -ForegroundColor Green
ssh "$Username@$ServerIP" "docker stop edwards-api edwards-web 2>/dev/null || true"
ssh "$Username@$ServerIP" "docker rm edwards-api edwards-web 2>/dev/null || true"

# Extract to remote path
ssh -t "$Username@$ServerIP" "cd $RemotePath && tar -xzf /tmp/$ArchiveName --strip-components=1 && rm /tmp/$ArchiveName"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Extraction failed." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Archive extracted." -ForegroundColor Green

# Step 5: Load Docker images
Write-Host "`n[5/7] Loading Docker images..." -ForegroundColor Green
ssh -t "$Username@$ServerIP" "cd $RemotePath/docker_images && chmod +x load_images.sh && ./load_images.sh"

# Step 6: Start containers
Write-Host "`n[6/7] Starting containers..." -ForegroundColor Green
ssh -t "$Username@$ServerIP" "cd $RemotePath && docker-compose up -d"

Write-Host "`n[7/7] Verifying services..." -ForegroundColor Green
Start-Sleep -Seconds 5
ssh "$Username@$ServerIP" "cd $RemotePath && docker-compose ps"

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "          🚀 Deployment Complete! 🚀" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Frontend: http://$Domain" -ForegroundColor White
Write-Host "  Coolify:  http://coolify.$ServerIP.sslip.io" -ForegroundColor White
