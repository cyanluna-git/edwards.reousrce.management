# Coolify Migration Guide

This guide details the steps to migrate the "Edwards Engineering Management" application from a manual Nginx + Docker Compose deployment to a fully managed Coolify deployment on the same server (`10.182.252.32`).

## 1. Pre-Migration Checklist

- [ ] **Codebase**: Ensure all local changes are committed and pushed to the Git repository.
- [ ] **Database Backup**: We will create a fresh backup before stopping the current service.
- [ ] **Secrets**: Ensure you have the `.env.vm` values ready (`POSTGRES_PASSWORD`, `SECRET_KEY`).

## 2. Step-by-Step Migration

### Step 1: Backup Database (Critical)

Run this from your local machine (using the existing script):

```powershell
.\scripts\deploy_to_vm.ps1 -SkipBuild -SkipBackup:$false
# Wait for the backup step to complete, then you can cancel (Ctrl+C) if you don't want to re-deploy.
# Alternatively, manually run the backup command via SSH:
# ssh atlasAdmin@10.182.252.32 "cd ~/services/edwards_project && docker exec edwards-postgres pg_dump -U postgres -d edwards > backups/manual_migration_backup.sql"
```

### Step 2: Configure Coolify

1.  **Login**: http://10.182.252.32:8000
2.  **Create Project**: Name it "Edwards Engineering".
3.  **Add Resource**: Select **Git Repository**.
    *   **Repository URL**: Your Git repo URL.
    *   **Branch**: `main` (or your production branch).
    *   **Build Pack**: `Docker Compose`.
4.  **Configuration**:
    *   Coolify will detect `docker-compose.yml`.
    *   **Environment Variables**: Add these in the Coolify UI for the services:
        *   `POSTGRES_PASSWORD`: (From `.env.vm`)
        *   `SECRET_KEY`: (From `.env.vm`)
        *   `BACKEND_PORT`: `8004`
        *   `FRONTEND_PORT`: `3004`
    *   **Domains**:
        *   Frontend: `http://eob.10.182.252.32.sslip.io`
        *   Backend: `http://api.eob.10.182.252.32.sslip.io` (Recommended to separate) OR keep using the path-based routing if you configure Coolify's Traefik labels manually.
        *   *Recommendation*: Use `http://eob.10.182.252.32.sslip.io` for frontend and allow Coolify to route `/api` request if configured, but simplest is to use a subdomain for API `http://api.eob.10.182.252.32.sslip.io`.

### Step 3: Stop Legacy Services

**Crucial**: You must stop the existing Nginx and Docker containers to free up ports and resources.

SSH into the server:
```bash
ssh atlasAdmin@10.182.252.32
```

Run the following commands:

```bash
# 1. Disable the manual Nginx site
sudo rm /etc/nginx/sites-enabled/edwards
sudo systemctl reload nginx

# 2. Stop the manual Docker containers
cd ~/services/edwards_project
docker-compose down

# 3. (Optional) Verify port 80 is now handled only by Coolify's proxy
# If Coolify's proxy (Traefik) was already running, it might have been fighting with Nginx.
# Ensure Coolify's proxy is healthy in the Coolify UI.
```

### Step 4: Deploy via Coolify

1.  In Coolify, click **Deploy**.
2.  Watch the build logs.
3.  Once "Healthy", verify access at `http://eob.10.182.252.32.sslip.io`.

### Step 5: Restore Data (If needed)

If the Coolify-managed Postgres volume is empty (it will be a new volume), you need to restore the backup.

1.  Locate the backup file on the server (usually in `~/services/edwards_project/backups/`).
2.  Find the new Coolify-managed Postgres container ID:
    ```bash
    docker ps | grep postgres
    # Look for the one managed by Coolify
    ```
3.  Restore:
    ```bash
    cat backup_file.sql | docker exec -i <COOLIFY_POSTGRES_CONTAINER_ID> psql -U postgres -d edwards
    ```

## Rollback Plan

If Coolify fails, you can quickly restore the manual deployment:

1.  Stop Coolify containers (via UI or `docker stop ...`).
2.  Enable Nginx site:
    ```bash
    sudo ln -s /etc/nginx/sites-available/edwards /etc/nginx/sites-enabled/
    sudo systemctl reload nginx
    ```
3.  Start manual containers:
    ```bash
    cd ~/services/edwards_project
    docker-compose up -d
    ```
