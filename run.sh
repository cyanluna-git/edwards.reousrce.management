#!/usr/bin/env bash
# Edwards Engineering Operation Management - Service Runner

set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Colors
# ─────────────────────────────────────────────────────────────
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
WHITE='\033[37m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${GREEN}${1}${RESET}"; }
warn()    { echo -e "${YELLOW}${1}${RESET}"; }
error()   { echo -e "${RED}${1}${RESET}"; }
plain()   { echo -e "${WHITE}${1}${RESET}"; }
cyan()    { echo -e "${CYAN}${1}${RESET}"; }

print_header() {
  echo -e "${CYAN}==================================================${RESET}"
  echo -e "${CYAN}${BOLD}${1}${RESET}"
  echo -e "${CYAN}==================================================${RESET}"
  echo
}

# ─────────────────────────────────────────────────────────────
# .env loader
# ─────────────────────────────────────────────────────────────
load_env() {
  if [[ ! -f .env ]]; then
    warn "[WARNING] .env file not found. Copying from .env.example..."
    if [[ -f .env.example ]]; then
      cp .env.example .env
      info "[INFO] .env file created. Please review and update if needed."
    else
      error "[ERROR] .env.example not found!"
      exit 1
    fi
    echo
  fi

  info "[INFO] Loading environment variables from .env file..."
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
}

# ─────────────────────────────────────────────────────────────
# Docker helpers
# ─────────────────────────────────────────────────────────────
check_docker() {
  info "[INFO] Checking Docker status..."
  if docker info &>/dev/null; then
    info "[OK] Docker is running"
    return 0
  else
    error "[ERROR] Docker is not running. Please start Docker Desktop first."
    return 1
  fi
}

# Sets global COMPOSE_CMD array
_init_compose_cmd() {
  local compose_file="${COMPOSE_FILE:-}"
  if [[ -n "$compose_file" ]]; then
    COMPOSE_CMD=("docker" "compose" "-f" "$compose_file")
  elif [[ -f docker-compose.dev.yml ]]; then
    COMPOSE_CMD=("docker" "compose" "-f" "docker-compose.dev.yml")
  else
    COMPOSE_CMD=("docker" "compose")
  fi
}

check_existing_postgres() {
  local status
  status=$(docker ps -a --filter "name=edwards-postgres" --format "{{.Status}}" 2>/dev/null || true)

  if [[ -z "$status" ]]; then
    return 1
  fi

  if [[ "$status" == *"Up"* ]]; then
    info "[OK] Existing postgres container is already running"
    return 0
  elif [[ "$status" == *"Exited"* ]]; then
    info "[INFO] Starting existing postgres container..."
    docker start edwards-postgres >/dev/null
    sleep 2
    info "[OK] Existing postgres container started"
    return 0
  fi
  return 1
}

check_backend_running() {
  _init_compose_cmd
  local result
  result=$("${COMPOSE_CMD[@]}" ps -q backend 2>/dev/null || true)
  [[ -n "$result" ]]
}

# ─────────────────────────────────────────────────────────────
# Commands
# ─────────────────────────────────────────────────────────────
cmd_backend() {
  print_header "Edwards Backend Service Launcher"
  load_env
  _init_compose_cmd

  echo
  cyan "Configuration:"
  plain "  Backend Port: ${BACKEND_PORT:-8004}"
  plain "  Database Port: ${DB_PORT:-5434}"
  plain "  Database URL: ${DATABASE_URL:-N/A}"
  plain "  Debug Mode: ${DEBUG:-true}"
  echo

  check_docker || exit 1

  echo
  info "[INFO] Starting backend services (Database + API)..."
  echo

  if check_existing_postgres; then
    info "[INFO] Using existing postgres container, starting backend only..."
    "${COMPOSE_CMD[@]}" up -d --no-deps backend
  else
    info "[INFO] Starting database and backend services..."
    "${COMPOSE_CMD[@]}" up -d db backend
  fi

  info "[INFO] Waiting for services to initialize..."
  sleep 3

  echo
  print_header "Backend Services Started!"
  echo
  cyan "Services:"
  plain "  Database: localhost:${DB_PORT:-5434}"
  plain "  API: http://localhost:${BACKEND_PORT:-8004}"
  plain "  API Docs: http://localhost:${BACKEND_PORT:-8004}/docs"
  echo
  cyan "Hot Reload:"
  info "  ✓ Code changes in ./backend/app/ will auto-reload"
  info "  ✓ Database migrations in ./backend/alembic/ are mounted"
  info "  ✓ Scripts in ./backend/scripts/ are mounted"
  echo
  cyan "Commands:"
  plain "  View logs: docker compose logs -f backend"
  plain "  Stop services: docker compose down"
  echo
  warn "[INFO] Opening live logs... (Press Ctrl+C to exit logs view)"
  echo

  "${COMPOSE_CMD[@]}" logs -f --tail=50 backend || true
}

cmd_frontend() {
  print_header "Edwards Frontend Service Launcher"
  load_env
  _init_compose_cmd

  echo
  cyan "Configuration:"
  plain "  Frontend Port: ${FRONTEND_PORT:-3004}"
  plain "  Backend API: ${VITE_API_URL:-N/A}"
  echo

  check_docker || exit 1

  info "[INFO] Checking if backend is running..."
  if check_backend_running; then
    info "[OK] Backend is running"
  else
    warn "[WARNING] Backend is not running. Frontend will not be able to connect to API."
    warn "[INFO] You may want to run './run.sh backend' first."
  fi

  echo
  info "[INFO] Starting frontend service..."
  echo

  "${COMPOSE_CMD[@]}" up -d frontend

  info "[INFO] Waiting for frontend to initialize..."
  sleep 3

  echo
  print_header "Frontend Service Started!"
  echo
  cyan "Service:"
  plain "  Frontend: http://localhost:${FRONTEND_PORT:-3004}"
  echo
  cyan "Hot Reload:"
  info "  ✓ Code changes in ./frontend/src/ will auto-reload"
  info "  ✓ Vite HMR (Hot Module Replacement) is enabled"
  info "  ✓ Config files are mounted for instant updates"
  echo
  cyan "Commands:"
  plain "  View logs: docker compose logs -f frontend"
  plain "  Stop service: docker compose stop frontend"
  plain "  Stop all: docker compose down"
  echo
  warn "[INFO] Opening live logs... (Press Ctrl+C to exit logs view)"
  echo

  "${COMPOSE_CMD[@]}" logs -f --tail=50 frontend || true
}

cmd_all() {
  print_header "Edwards All Services Launcher"
  load_env
  _init_compose_cmd
  check_docker || exit 1

  echo
  info "[INFO] Starting all services (Database + Backend + Frontend)..."
  echo

  if check_existing_postgres; then
    info "[INFO] Using existing postgres container, starting backend and frontend..."
    "${COMPOSE_CMD[@]}" up -d --no-deps backend frontend
  else
    info "[INFO] Starting all services..."
    "${COMPOSE_CMD[@]}" up -d
  fi

  info "[INFO] Waiting for services to initialize..."
  sleep 5

  echo
  print_header "All Services Started!"
  echo
  cyan "Services:"
  plain "  Database: localhost:${DB_PORT:-5434}"
  plain "  Backend API: http://localhost:${BACKEND_PORT:-8004}"
  plain "  API Docs: http://localhost:${BACKEND_PORT:-8004}/docs"
  plain "  Frontend: http://localhost:${FRONTEND_PORT:-3004}"
  echo
  cyan "Commands:"
  plain "  View all logs: docker compose logs -f"
  plain "  View backend logs: docker compose logs -f backend"
  plain "  View frontend logs: docker compose logs -f frontend"
  plain "  Stop all: docker compose down"
  echo
  warn "[INFO] Opening live logs... (Press Ctrl+C to exit logs view)"
  echo

  "${COMPOSE_CMD[@]}" logs -f --tail=50 || true
}

cmd_stop() {
  print_header "Stopping All Services"
  _init_compose_cmd
  echo
  warn "[INFO] Stopping all Docker services..."
  "${COMPOSE_CMD[@]}" down
  echo
  info "[OK] All services stopped."
}

cmd_status() {
  print_header "Services Status"
  _init_compose_cmd
  echo
  "${COMPOSE_CMD[@]}" ps
}

cmd_db() {
  print_header "Edwards Database Service Launcher"
  load_env
  _init_compose_cmd

  echo
  cyan "Configuration:"
  plain "  Database Port: ${DB_PORT:-5434}"
  plain "  Database URL: ${DATABASE_URL:-N/A}"
  echo

  check_docker || exit 1

  if check_existing_postgres; then
    info "[OK] Database is already running"
    return 0
  fi

  echo
  info "[INFO] Starting database service..."
  echo

  "${COMPOSE_CMD[@]}" up -d db

  info "[INFO] Waiting for database to initialize..."
  sleep 3

  echo
  print_header "Database Service Started!"
  echo
  cyan "Service:"
  plain "  Database: localhost:${DB_PORT:-5434}"
  echo
  cyan "Commands:"
  plain "  View logs: docker compose logs -f db"
  plain "  Stop database: docker compose stop db"
  echo
}

cmd_local_backend() {
  print_header "Edwards Local Backend Launcher"
  load_env

  # Adjust DATABASE_URL for local execution (docker internal hostname → localhost)
  if [[ "${DATABASE_URL:-}" == *"@db:5432"* ]]; then
    DATABASE_URL="${DATABASE_URL/@db:5432/@localhost:${DB_PORT:-5434}}"
    export DATABASE_URL
    warn "[INFO] Adjusting DATABASE_URL for local execution: $DATABASE_URL"
  fi

  echo
  cyan "Configuration:"
  plain "  Backend Port: ${BACKEND_PORT:-8004}"
  plain "  Database URL: ${DATABASE_URL:-N/A}"
  echo

  # Find virtual environment
  local venv_dir=""
  if [[ -d .venv ]]; then
    venv_dir=".venv"
  elif [[ -d backend/venv ]]; then
    venv_dir="backend/venv"
  else
    error "[ERROR] Virtual environment not found!"
    warn "[INFO] Please create venv first:"
    plain "  python -m venv .venv"
    plain "  source .venv/bin/activate"
    plain "  pip install -r backend/requirements.txt"
    exit 1
  fi

  info "[INFO] Using virtual environment: $venv_dir"

  # Ensure DB is running
  if check_docker; then
    info "[INFO] Checking if database is running..."
    if ! check_existing_postgres; then
      warn "[WARNING] Database is not running!"
      info "[INFO] Starting database..."
      cmd_db
      echo
    fi
  fi

  info "[INFO] Starting backend with uvicorn..."
  warn "[INFO] Press Ctrl+C to stop"
  echo

  # shellcheck disable=SC1090
  source "${venv_dir}/bin/activate"
  cd backend
  exec uvicorn app.main:app --reload --port "${BACKEND_PORT:-8004}"
}

cmd_local_frontend() {
  print_header "Edwards Local Frontend Launcher"
  load_env

  echo
  cyan "Configuration:"
  plain "  Frontend Port: ${FRONTEND_PORT:-3004}"
  plain "  Backend API: ${VITE_API_URL:-http://localhost:8004}"
  echo

  if [[ ! -d frontend/node_modules ]]; then
    warn "[WARNING] node_modules not found!"
    info "[INFO] Installing dependencies..."
    echo
    pnpm install --dir frontend
    echo
  fi

  info "[INFO] Starting frontend with pnpm dev..."
  warn "[INFO] Press Ctrl+C to stop"
  echo

  exec pnpm --dir frontend dev --port "${FRONTEND_PORT:-3004}"
}

cmd_dev() {
  print_header "Edwards Development Mode"
  load_env

  echo
  cyan "Development Mode Setup:"
  plain "  • Database: Docker container"
  plain "  • Backend: Local uvicorn (hot reload)"
  plain "  • Frontend: Local pnpm dev (HMR)"
  echo

  check_docker || exit 1

  cyan "[STEP 1/3] Starting Database..."
  cmd_db

  echo
  print_header "Development Environment Ready!"
  echo
  cyan "Next Steps:"
  echo
  warn "1. Start Backend (in a new terminal):"
  plain "   cd backend"
  plain "   source venv/bin/activate"
  plain "   uvicorn app.main:app --reload --port ${BACKEND_PORT:-8004}"
  echo
  warn "   OR use:"
  plain "   ./run.sh local-backend"
  echo
  warn "2. Start Frontend (in another new terminal):"
  plain "   cd frontend"
  plain "   pnpm dev --port ${FRONTEND_PORT:-3004}"
  echo
  warn "   OR use:"
  plain "   ./run.sh local-frontend"
  echo
  cyan "Services:"
  plain "  Database: localhost:${DB_PORT:-5434}"
  plain "  Backend: http://localhost:${BACKEND_PORT:-8004}"
  plain "  Frontend: http://localhost:${FRONTEND_PORT:-3004}"
  echo
}

print_help() {
  print_header "Edwards Service Runner"
  echo
  cyan "Usage:"
  plain "  ./run.sh [command]"
  echo
  cyan "Docker Mode (All in containers):"
  plain "  backend        Start backend services (Database + API)"
  plain "  frontend       Start frontend service"
  plain "  all            Start all services"
  echo
  cyan "Development Mode (Local execution):"
  plain "  dev            Start DB only, show instructions for local dev"
  plain "  db             Start database only (Docker)"
  plain "  local-backend  Run backend with uvicorn locally"
  plain "  local-frontend Run frontend with pnpm dev locally"
  echo
  cyan "Management:"
  plain "  stop           Stop all services"
  plain "  status         Show status of all services"
  plain "  help           Show this help message"
  echo
  cyan "Examples:"
  plain "  ./run.sh all            # Start everything in Docker"
  plain "  ./run.sh dev            # Setup local dev environment"
  plain "  ./run.sh local-backend  # Run backend locally"
  plain "  ./run.sh local-frontend # Run frontend locally"
  plain "  ./run.sh stop           # Stop all services"
  echo
}

# ─────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────
cd "$(dirname "$0")"

COMPOSE_CMD=()

case "${1:-}" in
  backend)        cmd_backend ;;
  frontend)       cmd_frontend ;;
  all)            cmd_all ;;
  dev)            cmd_dev ;;
  db)             cmd_db ;;
  local-backend)  cmd_local_backend ;;
  local-frontend) cmd_local_frontend ;;
  stop)           cmd_stop ;;
  status)         cmd_status ;;
  help|--help|-h) print_help ;;
  "")             print_help ;;
  *)
    error "[ERROR] Unknown command: ${1}"
    echo
    print_help
    exit 1
    ;;
esac
