# VTISAZUAPP218 Server Documentation

## 1. System Overview
*   **Hostname:** VTISAZUAPP218
*   **IP Address:** 10.182.252.32
*   **OS:** Ubuntu 24.04.3 LTS (Noble Numbat)
*   **Kernel:** 6.14.0-1017-azure

## 2. Infrastructure & Services
This server hosts **Coolify**, **Portainer**, and the **Edwards Project (EOB)**.

### 2.1 Docker Containers
| Container Name | Image | Status | Ports/Notes |
| :--- | :--- | :--- | :--- |
| `coolify` | `coollabsio/coolify:latest` | Up | Core Application (Port 8080 internally) |
| `portainer` | `portainer/portainer-ce:latest` | Up | Container Management |
| `edwards_project-frontend-1` | `edwards_project-frontend:latest` | Up | EOB Frontend (Port 3004) |
| `edwards_project-backend-1` | `edwards_project-backend:latest` | Up | EOB Backend (Port 8004) |
| `edwards_project-db-1` | `postgres:15` | Up | EOB Database (Port 5432) |

### 2.2 Directory Structure
Key data directories located in `/data`:
*   `/data/coolify/` - Coolify configuration and data.
*   `/data/eob/edwards_project/` - EOB deployment files and `docker-compose.yml`.

## 3. Network & Proxy Configuration
**Nginx** acts as a Reverse Proxy to route traffic based on Domain Names (Magic DNS via sslip.io).

### 3.1 Nginx Configuration
*   **Configuration Path:** `/etc/nginx/sites-available/coolify.conf`

```nginx
# /etc/nginx/sites-available/coolify.conf

# 1. Coolify (Main & Default)
server {
    listen 80;
    server_name coolify.10.182.252.32.sslip.io VTISAZUAPP218 10.182.252.32 10.182.252.32.sslip.io;

    location / {
        proxy_pass http://127.0.0.1:8080;
        # ... proxy headers ...
    }
}

# 2. Portainer
server {
    listen 80;
    server_name portainer.10.182.252.32.sslip.io;

    location / {
        proxy_pass http://127.0.0.1:9000;
        # ... proxy headers ...
    }
}

# 3. Edwards Project (EOB)
server {
    listen 80;
    server_name eob.10.182.252.32.sslip.io;

    location / {
        proxy_pass http://127.0.0.1:3004;
        # ... proxy headers ...
    }
}
```

## 4. Operational Notes
*   **Access URLs:**
    *   **Coolify:** [http://coolify.10.182.252.32.sslip.io](http://coolify.10.182.252.32.sslip.io) (or via IP)
    *   **Portainer:** [http://portainer.10.182.252.32.sslip.io](http://portainer.10.182.252.32.sslip.io)
    *   **EOB App:** [http://eob.10.182.252.32.sslip.io](http://eob.10.182.252.32.sslip.io)
*   **Deployment Method:** 
    1. SCP tarball to `/tmp`.
    2. Extract to `/data/eob/edwards_project`.
    3. `docker load` images.
    4. `docker-compose up -d`.
*   **Management:** SSH via `atlasAdmin` user.

## 5. Configuration & Setup Notes

### 5.1 Coolify Port Adjustment
*   **Discovery:** Initial documentation indicated Coolify used port 3000, but connectivity tests showed port 3000 was unreachable while **8080** was active and responding with the Coolify service.
*   **Action:** Nginx proxy rules were updated from `127.0.0.1:3000` to `127.0.0.1:8080`.

### 5.2 Virtual Hosting via Magic DNS (sslip.io)
*   **Problem:** The requirement was to host multiple applications on Port 80 without a dedicated DNS server. Path-based routing (`/eob`) caused asset resolution issues for the Vite-based frontend.
*   **Solution:** Employed **sslip.io** (Magic DNS). It maps `[anything].[IP].sslip.io` back to the original `[IP]`. This allowed Nginx to use `server_name` for clean, domain-based isolation.
    *   `eob.10.182.252.32.sslip.io` -> Routes to the EOB project.
    *   `10.182.252.32.sslip.io` -> Routes to Coolify.

### 5.3 Vite Application Optimization
To ensure the frontend works correctly behind the Nginx proxy, the following was modified in `vite.config.ts`:
*   **`server.allowedHosts`:** Explicitly added the server hostname and `.sslip.io` to prevent "Blocked request" (403 Forbidden) errors caused by Vite's security checks.
*   **`server.hmr`:** Configured Hot Module Replacement to connect through Port 80 to ensure real-time updates work through the proxy.

### 5.4 Automation Scripts
*   `remote_exec.py`: Handles SSH command execution with automated sudo password injection using PTY.
*   `scp_deploy.py`: Automates file transfers to the remote server with password handling.