# Edwards Engineering Management - Deployment Documentation

## Deployment Workflow

The project uses a manual but automated script-based deployment process to ensure stability and control.

### Key Scripts

| Script | Purpose |
| :--- | :--- |
| `run_full_deploy.ps1` | **Main Deployment Script**. Automates build, upload, and container restart on the server. |
| `build_and_compress.py` | Helper script used by `run_full_deploy.ps1`. Handles backend/frontend builds, Docker image creation, and packaging into a `.tar.gz` archive. |
| `deploy_nginx.py` | **Infrastructure Setup**. Configures the Host Nginx reverse proxy. Run this only when changing domains or proxy rules. |
| `deploy_env_remote.py` | Helper to generate the `.env` file for the remote server safely. |

### Configuration Files

| File | Purpose |
| :--- | :--- |
| `nginx_remote_proxy.conf` | The Nginx configuration file applied by `deploy_nginx.py`. Defines routing for Coolify (8080), Portainer (9000), and EOB App (3004). |
| `SERVER_SETUP.md` | Comprehensive documentation of the server architecture, ports, and troubleshooting. |
| `REMOTE_SYNC_GUIDE.md` | Guide for syncing the remote database to the local environment for debugging. |

### Quick Start: Deploying Updates

1. **Commit your changes** to git.
2. Run the full deployment script:
   ```powershell
   ./run_full_deploy.ps1
   ```
   *(This will build, upload, and restart the app containers. The database is preserved.)*

### Infrastructure Maintenance

*   **To update Nginx rules:**
    Modify `nginx_remote_proxy.conf` and run:
    ```powershell
    python deploy_nginx.py
    ```

*   **To debug server connection:**
    ```powershell
    python inspect_remote.py
    ```

### Cleanup Note
Unused development scripts have been removed to keep the root directory clean.
