# Edwards Engineering Management - Automated Deployment Script (PowerShell)
# Complete one-command deployment including nginx configuration

param (
    [string]$ServerIP = "10.182.252.32",
    [string]$Username = "atlasAdmin",
    [string]$Domain = "eob.10.182.252.32.sslip.io",
    [switch]$SkipBackup = $false,
    [switch]$SkipBuild = $false
)

$BuildOutputDir = "D:\00.Dev\7.myApplication\engineering.resource.management\build_output"
$LocalProjectRoot = "D:\00.Dev\7.myApplication\engineering.resource.management"
$RemotePath = "/home/atlasAdmin/services/edwards_project"

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "   Edwards Project - Complete Deployment to VM" -ForegroundColor Cyan
Write-Host "   Target: $Username@$ServerIP" -ForegroundColor Cyan
Write-Host "===================================================`n" -ForegroundColor Cyan

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

# Step 2: Backup current database (if not skipped)
if (-not $SkipBackup) {
    Write-Host "`n[2/7] Creating database backup on server..." -ForegroundColor Green
    $BackupTimestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $BackupCmd = @"
cd $RemotePath && \
docker exec edwards-postgres pg_dump -U postgres -d edwards > backups/edwards_backup_$BackupTimestamp.sql && \
echo 'Backup created: edwards_backup_$BackupTimestamp.sql'
"@
    
    ssh "$Username@$ServerIP" $BackupCmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Database backup complete." -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Backup failed or containers not running (continuing anyway)." -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[2/7] Skipping database backup..." -ForegroundColor Yellow
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

# Step 4: Stop containers and extract archive
Write-Host "`n[4/7] Stopping containers and extracting archive..." -ForegroundColor Green

$ExtractCmd = @"
cd $RemotePath && \
docker-compose down && \
rm -rf backend frontend docker_images .env.example docker-compose.yml && \
tar -xzf $ArchiveName --strip-components=1 && \
rm $ArchiveName && \
echo 'Extraction complete'
"@

ssh "$Username@$ServerIP" $ExtractCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Extraction failed." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Archive extracted." -ForegroundColor Green

# Step 5: Load Docker images
Write-Host "`n[5/7] Loading Docker images..." -ForegroundColor Green

$LoadImagesCmd = @"
cd $RemotePath/docker_images && \
docker load < postgres-15.tar && \
docker load < edwards-backend.tar && \
docker load < edwards-frontend.tar && \
echo 'Docker images loaded'
"@

ssh "$Username@$ServerIP" $LoadImagesCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker image loading failed." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Docker images loaded." -ForegroundColor Green

# Step 6: Configure nginx
Write-Host "`n[6/7] Configuring nginx reverse proxy..." -ForegroundColor Green

$NginxConfig = @"
# Edwards Project Operation Board - Nginx Configuration
# Domain: $Domain

server {
    listen 80;
    listen [::]:80;
    server_name $Domain;

    # Logging
    access_log /var/log/nginx/edwards-access.log;
    error_log /var/log/nginx/edwards-error.log;

    # Client upload size limit
    client_max_body_size 100M;

    # Security headers
    add_header X-Frame-Options \"SAMEORIGIN\" always;
    add_header X-Content-Type-Options \"nosniff\" always;
    add_header X-XSS-Protection \"1; mode=block\" always;

    # Frontend - Root location
    location / {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        proxy_cache_bypass `$http_upgrade;

        # WebSocket support
        proxy_read_timeout 86400;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8004/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        proxy_cache_bypass `$http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Backend API Documentation (Swagger UI)
    location /docs {
        proxy_pass http://localhost:8004/docs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        proxy_cache_bypass `$http_upgrade;
    }

    # OpenAPI JSON
    location /openapi.json {
        proxy_pass http://localhost:8004/openapi.json;
        proxy_http_version 1.1;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 \"healthy\n\";
        add_header Content-Type text/plain;
    }
}
"@

# Write nginx config to temp file and upload
$TempNginxFile = [System.IO.Path]::GetTempFileName()
$NginxConfig | Out-File -FilePath $TempNginxFile -Encoding UTF8

scp "$TempNginxFile" "$Username@$ServerIP`:/tmp/edwards.conf"
Remove-Item $TempNginxFile

# Install nginx config
$NginxCmd = @"
sudo mv /tmp/edwards.conf /etc/nginx/sites-available/edwards && \
sudo ln -sf /etc/nginx/sites-available/edwards /etc/nginx/sites-enabled/edwards && \
sudo nginx -t && \
sudo systemctl reload nginx && \
echo 'Nginx configured'
"@

ssh "$Username@$ServerIP" $NginxCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Nginx configuration failed." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Nginx configured." -ForegroundColor Green

# Step 7: Start containers
Write-Host "`n[7/7] Starting Docker containers..." -ForegroundColor Green

$StartCmd = @"
cd $RemotePath && \
docker-compose up -d && \
echo 'Waiting for containers to be healthy...' && \
sleep 10 && \
docker-compose ps
"@

ssh "$Username@$ServerIP" $StartCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Container startup failed." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Containers started." -ForegroundColor Green

# Final Summary
Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "          🎉 Deployment Complete! 🎉" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  📦 Archive: $ArchiveName ($ArchiveSizeMB MB)" -ForegroundColor Gray
Write-Host "  🌐 Frontend: http://$Domain" -ForegroundColor Green
Write-Host "  📡 Backend API: http://$Domain/api/" -ForegroundColor Green
Write-Host "  📚 API Docs: http://$Domain/docs" -ForegroundColor Green
Write-Host "  ⏰ Deployed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# Optional: Open browser
$Response = Read-Host "Open browser to $Domain? (y/n)"
if ($Response -eq 'y' -or $Response -eq 'Y') {
    Start-Process "http://$Domain"
}
