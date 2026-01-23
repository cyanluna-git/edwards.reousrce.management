# Worklog: Nginx Routing Fix & Architecture Documentation

**Date:** 2026-01-23
**Focus:** Fixing Production Deployment & Documenting Routing Architecture

## 1. Issue: Nginx Startup Crash
**Symptom:** The deployment to the VM was timing out.
**Investigation:**
- Checked logs of `edwards-web` container.
- Found repeated restarts with error: `host not found in upstream "backend"`.
- **Root Cause:** Nginx attempts to resolve the upstream hostname (`backend` or `edwards-api`) immediately upon startup. If the Backend container is not fully ready or the Docker network DNS isn't instant, Nginx crashes.

## 2. Solution: Robust Upstream Resolution
Modified `frontend/nginx.conf` to use runtime DNS resolution.

**Changes:**
- Added `resolver 127.0.0.11 valid=30s;` (Docker's internal DNS).
- Changed `proxy_pass` to use a variable (`$upstream_backend`).
- Updated hostname to the explicit container name `edwards-api`.

```nginx
# Before
location /api {
    proxy_pass http://backend:8004;
}

# After
location /api {
    resolver 127.0.0.11 valid=30s;
    set $upstream_backend http://edwards-api:8004;
    proxy_pass $upstream_backend;
}
```
**Benefit:** Nginx starts immediately regardless of Backend status. It resolves the IP address only when a request actually comes in.

## 3. Documentation: Routing Architecture
Created `docs/ROUTING_ARCHITECTURE.md` to explain the "Double Proxy" pattern (Traefik -> Nginx -> Backend).
- Included PlantUML diagram visualizing the flow.
- Explained the distinct roles of the Outer Gateway vs. the Inner Web Server.
