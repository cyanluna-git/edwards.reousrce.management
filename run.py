#!/usr/bin/env python3
"""
Edwards Engineering Operation Management - Service Runner
Cross-platform script to run backend and frontend services with Docker
"""

import os
import sys
import subprocess
import time
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output"""

    CYAN = "\033[36m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    WHITE = "\033[37m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def print_colored(message, color=""):
    """Print colored message to terminal"""
    print(f"{color}{message}{Colors.RESET}")


def print_header(title):
    """Print formatted header"""
    print_colored("=" * 50, Colors.CYAN)
    print_colored(title, Colors.CYAN + Colors.BOLD)
    print_colored("=" * 50, Colors.CYAN)
    print()


def load_env_file():
    """Load environment variables from .env file"""
    env_path = Path(".env")
    env_example_path = Path(".env.example")

    # Create .env from .env.example if it doesn't exist
    if not env_path.exists():
        print_colored(
            "[WARNING] .env file not found. Copying from .env.example...", Colors.YELLOW
        )
        if env_example_path.exists():
            env_path.write_text(env_example_path.read_text())
            print_colored(
                "[INFO] .env file created. Please review and update if needed.",
                Colors.GREEN,
            )
        else:
            print_colored("[ERROR] .env.example not found!", Colors.RED)
            sys.exit(1)
        print()

    # Load environment variables with encoding fallbacks to avoid Unicode errors
    print_colored(
        "[INFO] Loading environment variables from .env file...", Colors.GREEN
    )

    def _read_env_lines(path):
        encodings = ["utf-8", "utf-8-sig", "cp949", "latin-1"]
        for enc in encodings:
            try:
                with open(path, "r", encoding=enc) as f:
                    return f.readlines()
            except UnicodeDecodeError:
                continue
            except Exception:
                # If other IO errors occur, re-raise
                raise

        # Last resort: read as binary and decode replacing invalid bytes
        with open(path, "rb") as f:
            data = f.read()
        return data.decode("utf-8", errors="replace").splitlines()

    for line in _read_env_lines(env_path):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ[key.strip()] = value.strip()


def check_docker():
    """Check if Docker is running"""
    print_colored("[INFO] Checking Docker status...", Colors.GREEN)
    try:
        subprocess.run(
            ["docker", "info"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        print_colored("[OK] Docker is running", Colors.GREEN)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print_colored(
            "[ERROR] Docker is not running. Please start Docker Desktop first.",
            Colors.RED,
        )
        return False


def check_backend_running():
    """Check if backend service is running"""
    try:
        compose = get_compose_command()
        result = subprocess.run(
            compose + ["ps", "-q", "backend"],
            capture_output=True,
            text=True,
            check=True,
        )
        return bool(result.stdout.strip())
    except subprocess.CalledProcessError:
        return False


def get_compose_command():
    """Return docker compose command with the preferred compose file.

    Defaults to docker-compose.dev.yml when present to keep local dev behavior
    close to production (same /api base), while still supporting hot reload.

    Override by setting COMPOSE_FILE to a specific filename.
    """

    compose_file = os.getenv("COMPOSE_FILE")
    if compose_file:
        return ["docker", "compose", "-f", compose_file]

    if Path("docker-compose.dev.yml").exists():
        return ["docker", "compose", "-f", "docker-compose.dev.yml"]

    return ["docker", "compose"]


def check_existing_postgres():
    """Check if edwards-postgres container exists and start it if stopped"""
    try:
        # Check if container exists
        result = subprocess.run(
            [
                "docker",
                "ps",
                "-a",
                "--filter",
                "name=edwards-postgres",
                "--format",
                "{{.Status}}",
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        status = result.stdout.strip()

        if not status:
            return False  # Container doesn't exist

        if "Up" in status:
            print_colored(
                "[OK] Existing postgres container is already running", Colors.GREEN
            )
            return True
        elif "Exited" in status:
            print_colored(
                "[INFO] Starting existing postgres container...", Colors.GREEN
            )
            subprocess.run(["docker", "start", "edwards-postgres"], check=True)
            time.sleep(2)  # Wait for postgres to be ready
            print_colored("[OK] Existing postgres container started", Colors.GREEN)
            return True
        return False
    except subprocess.CalledProcessError:
        return False


def run_backend():
    """Start backend services (Database + API)"""
    print_header("Edwards Backend Service Launcher")

    load_env_file()

    # Display configuration
    print()
    print_colored("Configuration:", Colors.CYAN)
    print_colored(f"  Backend Port: {os.getenv('BACKEND_PORT', '8004')}", Colors.WHITE)
    print_colored(f"  Database Port: {os.getenv('DB_PORT', '5434')}", Colors.WHITE)
    print_colored(f"  Database URL: {os.getenv('DATABASE_URL', 'N/A')}", Colors.WHITE)
    print_colored(f"  Debug Mode: {os.getenv('DEBUG', 'true')}", Colors.WHITE)
    print()

    if not check_docker():
        sys.exit(1)

    print()
    print_colored("[INFO] Starting backend services (Database + API)...", Colors.GREEN)
    print()

    # Check if existing postgres container is available
    if check_existing_postgres():
        print_colored(
            "[INFO] Using existing postgres container, starting backend only...",
            Colors.GREEN,
        )
        subprocess.run(
            get_compose_command() + ["up", "-d", "--no-deps", "backend"], check=True
        )
    else:
        print_colored("[INFO] Starting database and backend services...", Colors.GREEN)
        subprocess.run(
            get_compose_command() + ["up", "-d", "db", "backend"], check=True
        )

    # Wait for services to initialize
    print_colored("[INFO] Waiting for services to initialize...", Colors.GREEN)
    time.sleep(3)

    print()
    print_header("Backend Services Started!")
    print()
    print_colored("Services:", Colors.CYAN)
    print_colored(f"  Database: localhost:{os.getenv('DB_PORT', '5434')}", Colors.WHITE)
    print_colored(
        f"  API: http://localhost:{os.getenv('BACKEND_PORT', '8004')}", Colors.WHITE
    )
    print_colored(
        f"  API Docs: http://localhost:{os.getenv('BACKEND_PORT', '8004')}/docs",
        Colors.WHITE,
    )
    print()
    print_colored("Hot Reload:", Colors.CYAN)
    print_colored("  ✓ Code changes in ./backend/app/ will auto-reload", Colors.GREEN)
    print_colored(
        "  ✓ Database migrations in ./backend/alembic/ are mounted", Colors.GREEN
    )
    print_colored("  ✓ Scripts in ./backend/scripts/ are mounted", Colors.GREEN)
    print()
    print_colored("Commands:", Colors.CYAN)
    print_colored("  View logs: docker-compose logs -f backend", Colors.WHITE)
    print_colored("  Stop services: docker-compose down", Colors.WHITE)
    print()
    print_colored(
        "[INFO] Opening live logs... (Press Ctrl+C to exit logs view)", Colors.YELLOW
    )
    print()

    # Show logs
    try:
        subprocess.run(get_compose_command() + ["logs", "-f", "--tail=50", "backend"])
    except KeyboardInterrupt:
        print()
        print_colored(
            "[INFO] Log viewing stopped. Services are still running.", Colors.YELLOW
        )


def run_frontend():
    """Start frontend service"""
    print_header("Edwards Frontend Service Launcher")

    load_env_file()

    # Display configuration
    print()
    print_colored("Configuration:", Colors.CYAN)
    print_colored(
        f"  Frontend Port: {os.getenv('FRONTEND_PORT', '3004')}", Colors.WHITE
    )
    print_colored(f"  Backend API: {os.getenv('VITE_API_URL', 'N/A')}", Colors.WHITE)
    print()

    if not check_docker():
        sys.exit(1)

    # Check if backend is running
    print_colored("[INFO] Checking if backend is running...", Colors.GREEN)
    if check_backend_running():
        print_colored("[OK] Backend is running", Colors.GREEN)
    else:
        print_colored(
            "[WARNING] Backend is not running. Frontend will not be able to connect to API.",
            Colors.YELLOW,
        )
        print_colored(
            "[INFO] You may want to run 'python run.py backend' first.", Colors.YELLOW
        )

    print()
    print_colored("[INFO] Starting frontend service...", Colors.GREEN)
    print()

    # Start frontend service
    subprocess.run(get_compose_command() + ["up", "-d", "frontend"], check=True)

    # Wait for service to start
    print_colored("[INFO] Waiting for frontend to initialize...", Colors.GREEN)
    time.sleep(3)

    print()
    print_header("Frontend Service Started!")
    print()
    print_colored("Service:", Colors.CYAN)
    print_colored(
        f"  Frontend: http://localhost:{os.getenv('FRONTEND_PORT', '3004')}",
        Colors.WHITE,
    )
    print()
    print_colored("Hot Reload:", Colors.CYAN)
    print_colored("  ✓ Code changes in ./frontend/src/ will auto-reload", Colors.GREEN)
    print_colored("  ✓ Vite HMR (Hot Module Replacement) is enabled", Colors.GREEN)
    print_colored("  ✓ Config files are mounted for instant updates", Colors.GREEN)
    print()
    print_colored("Commands:", Colors.CYAN)
    print_colored("  View logs: docker compose logs -f frontend", Colors.WHITE)
    print_colored("  Stop service: docker compose stop frontend", Colors.WHITE)
    print_colored("  Stop all: docker compose down", Colors.WHITE)
    print()
    print_colored(
        "[INFO] Opening live logs... (Press Ctrl+C to exit logs view)", Colors.YELLOW
    )
    print()

    # Show logs
    try:
        subprocess.run(get_compose_command() + ["logs", "-f", "--tail=50", "frontend"])
    except KeyboardInterrupt:
        print()
        print_colored(
            "[INFO] Log viewing stopped. Service is still running.", Colors.YELLOW
        )


def run_all():
    """Start all services"""
    print_header("Edwards All Services Launcher")

    load_env_file()

    if not check_docker():
        sys.exit(1)

    print()
    print_colored(
        "[INFO] Starting all services (Database + Backend + Frontend)...", Colors.GREEN
    )
    print()

    # Check if existing postgres container is available
    if check_existing_postgres():
        print_colored(
            "[INFO] Using existing postgres container, starting backend and frontend...",
            Colors.GREEN,
        )
        subprocess.run(
            get_compose_command() + ["up", "-d", "--no-deps", "backend", "frontend"],
            check=True,
        )
    else:
        print_colored("[INFO] Starting all services...", Colors.GREEN)
        subprocess.run(get_compose_command() + ["up", "-d"], check=True)

    # Wait for services to initialize
    print_colored("[INFO] Waiting for services to initialize...", Colors.GREEN)
    time.sleep(5)

    print()
    print_header("All Services Started!")
    print()
    print_colored("Services:", Colors.CYAN)
    print_colored(f"  Database: localhost:{os.getenv('DB_PORT', '5434')}", Colors.WHITE)
    print_colored(
        f"  Backend API: http://localhost:{os.getenv('BACKEND_PORT', '8004')}",
        Colors.WHITE,
    )
    print_colored(
        f"  API Docs: http://localhost:{os.getenv('BACKEND_PORT', '8004')}/docs",
        Colors.WHITE,
    )
    print_colored(
        f"  Frontend: http://localhost:{os.getenv('FRONTEND_PORT', '3004')}",
        Colors.WHITE,
    )
    print()
    print_colored("Commands:", Colors.CYAN)
    print_colored("  View all logs: docker compose logs -f", Colors.WHITE)
    print_colored("  View backend logs: docker compose logs -f backend", Colors.WHITE)
    print_colored("  View frontend logs: docker compose logs -f frontend", Colors.WHITE)
    print_colored("  Stop all: docker compose down", Colors.WHITE)
    print()
    print_colored(
        "[INFO] Opening live logs... (Press Ctrl+C to exit logs view)", Colors.YELLOW
    )
    print()

    # Show logs
    try:
        subprocess.run(get_compose_command() + ["logs", "-f", "--tail=50"])
    except KeyboardInterrupt:
        print()
        print_colored(
            "[INFO] Log viewing stopped. Services are still running.", Colors.YELLOW
        )


def stop_all():
    """Stop all services"""
    print_header("Stopping All Services")
    print()
    print_colored("[INFO] Stopping all Docker services...", Colors.YELLOW)
    subprocess.run(get_compose_command() + ["down"], check=True)
    print()
    print_colored("[OK] All services stopped.", Colors.GREEN)


def show_status():
    """Show status of all services"""
    print_header("Services Status")
    print()
    subprocess.run(get_compose_command() + ["ps"])


def run_db_only():
    """Start only the database service"""
    print_header("Edwards Database Service Launcher")

    load_env_file()

    print()
    print_colored("Configuration:", Colors.CYAN)
    print_colored(f"  Database Port: {os.getenv('DB_PORT', '5434')}", Colors.WHITE)
    print_colored(f"  Database URL: {os.getenv('DATABASE_URL', 'N/A')}", Colors.WHITE)
    print()

    if not check_docker():
        sys.exit(1)

    # Check if existing postgres container is available
    if check_existing_postgres():
        print_colored("[OK] Database is already running", Colors.GREEN)
        return

    print()
    print_colored("[INFO] Starting database service...", Colors.GREEN)
    print()

    subprocess.run(get_compose_command() + ["up", "-d", "db"], check=True)

    # Wait for database to initialize
    print_colored("[INFO] Waiting for database to initialize...", Colors.GREEN)
    time.sleep(3)

    print()
    print_header("Database Service Started!")
    print()
    print_colored("Service:", Colors.CYAN)
    print_colored(f"  Database: localhost:{os.getenv('DB_PORT', '5434')}", Colors.WHITE)
    print()
    print_colored("Commands:", Colors.CYAN)
    print_colored("  View logs: docker compose logs -f db", Colors.WHITE)
    print_colored("  Stop database: docker compose stop db", Colors.WHITE)
    print()


def check_port_available(port: int) -> bool:
    """Check if a port is available"""
    import socket
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('localhost', port))
            return True
    except OSError:
        return False


def kill_process_on_port(port: int) -> bool:
    """Kill process using the specified port"""
    try:
        import subprocess
        import platform
        
        if platform.system() == "Windows":
            # Windows
            result = subprocess.run(
                ["netstat", "-ano"],
                capture_output=True,
                text=True,
                check=False,
            )
            for line in result.stdout.splitlines():
                if f":{port}" in line and "LISTENING" in line:
                    parts = line.split()
                    if len(parts) > 0:
                        pid = parts[-1]
                        try:
                            subprocess.run(["taskkill", "/F", "/PID", pid], check=False)
                            return True
                        except:
                            pass
        else:
            # macOS/Linux
            result = subprocess.run(
                ["lsof", "-ti", f":{port}"],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0 and result.stdout.strip():
                pid = result.stdout.strip().split()[0]
                try:
                    subprocess.run(["kill", "-9", pid], check=False)
                    return True
                except:
                    pass
    except Exception:
        pass
    return False


def run_local_backend():
    """Run backend with uvicorn locally (not in Docker)"""
    print_header("Edwards Local Backend Launcher")

    load_env_file()
    
    # Override DATABASE_URL for local execution if it points to 'db'
    db_url = os.getenv("DATABASE_URL", "").strip()
    db_port = os.getenv("DB_PORT", "5434").strip()
    if "@db:5432" in db_url:
        new_db_url = db_url.replace("@db:5432", f"@localhost:{db_port}")
        os.environ["DATABASE_URL"] = new_db_url
        print_colored(f"[INFO] Adjusting DATABASE_URL for local execution: {new_db_url}", Colors.YELLOW)
    else:
        # Even if not adjusting, ensure we use the stripped version
        os.environ["DATABASE_URL"] = db_url

    print()
    print_colored("Configuration:", Colors.CYAN)
    print_colored(f"  Backend Port: {os.getenv('BACKEND_PORT', '8004')}", Colors.WHITE)
    print_colored(f"  Database URL: {os.getenv('DATABASE_URL', 'N/A')}", Colors.WHITE)
    print()

    # Check if venv exists (either in backend/venv or root .venv)
    venv_backend = Path("backend/venv")
    venv_root = Path(".venv")
    
    selected_venv = None
    if venv_root.exists():
        selected_venv = venv_root
    elif venv_backend.exists():
        selected_venv = venv_backend

    if not selected_venv:
        print_colored("[ERROR] Virtual environment not found!", Colors.RED)
        print_colored("[INFO] Please create venv first:", Colors.YELLOW)
        print_colored("  python -m venv .venv", Colors.WHITE)
        print_colored(
            "  .venv\\Scripts\\activate on Windows or source .venv/bin/activate on Linux",
            Colors.WHITE,
        )
        print_colored("  pip install -r backend/requirements.txt", Colors.WHITE)
        sys.exit(1)

    print_colored(f"[INFO] Using virtual environment: {selected_venv}", Colors.GREEN)

    # Check if DB is running
    if check_docker():
        print_colored("[INFO] Checking if database is running...", Colors.GREEN)
        if not check_existing_postgres():
            print_colored("[WARNING] Database is not running!", Colors.YELLOW)
            print_colored("[INFO] Starting database...", Colors.GREEN)
            run_db_only()
            print()

    print_colored("[INFO] Starting backend with uvicorn...", Colors.GREEN)
    print_colored("[INFO] Press Ctrl+C to stop", Colors.YELLOW)
    print()

    # Change to backend directory and run uvicorn
    backend_dir = Path("backend")

    # Determine the activation script based on platform and venv location
    if sys.platform == "win32":
        activate_path = selected_venv / "Scripts" / "activate"
        # On Windows, we use set to set the environment variable before running uvicorn
        # Note: No space before && to avoid trailing space in variable value
        set_env = f"set DATABASE_URL={os.environ.get('DATABASE_URL', '')}&&" if "DATABASE_URL" in os.environ else ""
        activate_cmd = f"{activate_path} && {set_env} cd {backend_dir} && uvicorn app.main:app --reload --port {os.getenv('BACKEND_PORT', '8004')}"
        subprocess.run(activate_cmd, shell=True)
    else:
        activate_path = selected_venv / "bin" / "activate"
        # On Linux/macOS, we can just prefix the command with the environment variable
        export_env = f"export DATABASE_URL={os.environ.get('DATABASE_URL', '')} && " if "DATABASE_URL" in os.environ else ""
        activate_cmd = f"source {activate_path} && {export_env}cd {backend_dir} && uvicorn app.main:app --reload --port {os.getenv('BACKEND_PORT', '8004')}"
        subprocess.run(activate_cmd, shell=True, executable="/bin/bash")


def run_local_frontend():
    """Run frontend with pnpm dev locally (not in Docker)"""
    print_header("Edwards Local Frontend Launcher")

    load_env_file()

    print()
    print_colored("Configuration:", Colors.CYAN)
    print_colored(
        f"  Frontend Port: {os.getenv('FRONTEND_PORT', '3004')}", Colors.WHITE
    )
    print_colored(
        f"  Backend API: {os.getenv('VITE_API_URL', 'http://localhost:8004')}",
        Colors.WHITE,
    )
    print()

    # Check if node_modules exists
    frontend_dir = Path("frontend")
    node_modules = frontend_dir / "node_modules"

    if not node_modules.exists():
        print_colored("[WARNING] node_modules not found!", Colors.YELLOW)
        print_colored("[INFO] Installing dependencies...", Colors.GREEN)
        print()
        subprocess.run(["pnpm", "install"], cwd=frontend_dir, check=True)
        print()

    print_colored("[INFO] Starting frontend with pnpm dev...", Colors.GREEN)
    print_colored("[INFO] Press Ctrl+C to stop", Colors.YELLOW)
    print()

    # Run pnpm dev
    if sys.platform == "win32":
        subprocess.run(
            ["pnpm", "dev", "--port", os.getenv("FRONTEND_PORT", "3004")],
            cwd=frontend_dir,
            shell=True,
        )
    else:
        subprocess.run(
            ["pnpm", "dev", "--port", os.getenv("FRONTEND_PORT", "3004")],
            cwd=frontend_dir,
        )


def run_dev():
    """Development mode: DB in Docker, Frontend & Backend run locally"""
    print_header("Edwards Development Mode")

    load_env_file()

    print()
    print_colored("Development Mode Setup:", Colors.CYAN)
    print_colored("  • Database: Docker container", Colors.WHITE)
    print_colored("  • Backend: Local uvicorn (hot reload)", Colors.WHITE)
    print_colored("  • Frontend: Local pnpm dev (HMR)", Colors.WHITE)
    print()

    if not check_docker():
        sys.exit(1)

    # Start DB
    print_colored("[STEP 1/3] Starting Database...", Colors.CYAN)
    run_db_only()

    print()
    print_header("Development Environment Ready!")
    print()
    print_colored("Next Steps:", Colors.CYAN)
    print()
    print_colored("1. Start Backend (in a new terminal):", Colors.YELLOW)
    print_colored("   cd backend", Colors.WHITE)
    print_colored(
        "   source venv/bin/activate  # or venv\\Scripts\\activate on Windows",
        Colors.WHITE,
    )
    print_colored(
        f"   uvicorn app.main:app --reload --port {os.getenv('BACKEND_PORT', '8004')}",
        Colors.WHITE,
    )
    print()
    print_colored("   OR use:", Colors.YELLOW)
    print_colored("   python run.py local-backend", Colors.WHITE)
    print()
    print_colored("2. Start Frontend (in another new terminal):", Colors.YELLOW)
    print_colored("   cd frontend", Colors.WHITE)
    print_colored(
        f"   pnpm dev --port {os.getenv('FRONTEND_PORT', '3004')}", Colors.WHITE
    )
    print()
    print_colored("   OR use:", Colors.YELLOW)
    print_colored("   python run.py local-frontend", Colors.WHITE)
    print()
    print_colored("Services:", Colors.CYAN)
    print_colored(f"  Database: localhost:{os.getenv('DB_PORT', '5434')}", Colors.WHITE)
    print_colored(
        f"  Backend: http://localhost:{os.getenv('BACKEND_PORT', '8004')}", Colors.WHITE
    )
    print_colored(
        f"  Frontend: http://localhost:{os.getenv('FRONTEND_PORT', '3004')}",
        Colors.WHITE,
    )
    print()


def print_usage():
    """Print usage information"""
    print_header("Edwards Service Runner")
    print()
    print_colored("Usage:", Colors.CYAN)
    print_colored("  python run.py [command]", Colors.WHITE)
    print()
    print_colored("Docker Mode (All in containers):", Colors.CYAN)
    print_colored(
        "  backend        Start backend services (Database + API)", Colors.WHITE
    )
    print_colored("  frontend       Start frontend service", Colors.WHITE)
    print_colored("  all            Start all services", Colors.WHITE)
    print()
    print_colored("Development Mode (Local execution):", Colors.CYAN)
    print_colored(
        "  dev            Start DB only, show instructions for local dev", Colors.WHITE
    )
    print_colored("  db             Start database only (Docker)", Colors.WHITE)
    print_colored("  local-backend  Run backend with uvicorn locally", Colors.WHITE)
    print_colored("  local-frontend Run frontend with pnpm dev locally", Colors.WHITE)
    print()
    print_colored("Management:", Colors.CYAN)
    print_colored("  stop           Stop all services", Colors.WHITE)
    print_colored("  status         Show status of all services", Colors.WHITE)
    print_colored("  help           Show this help message", Colors.WHITE)
    print()
    print_colored("Examples:", Colors.CYAN)
    print_colored(
        "  python run.py all            # Start everything in Docker", Colors.WHITE
    )
    print_colored(
        "  python run.py dev            # Setup local dev environment", Colors.WHITE
    )
    print_colored("  python run.py local-backend  # Run backend locally", Colors.WHITE)
    print_colored("  python run.py local-frontend # Run frontend locally", Colors.WHITE)
    print_colored("  python run.py stop           # Stop all services", Colors.WHITE)
    print()


def main():
    """Main entry point"""
    # Change to script directory
    os.chdir(Path(__file__).parent)

    if len(sys.argv) < 2:
        print_usage()
        sys.exit(0)

    command = sys.argv[1].lower()

    commands = {
        # Docker mode
        "backend": run_backend,
        "frontend": run_frontend,
        "all": run_all,
        # Development mode
        "dev": run_dev,
        "db": run_db_only,
        "local-backend": run_local_backend,
        "local-frontend": run_local_frontend,
        # Management
        "stop": stop_all,
        "status": show_status,
        "help": print_usage,
    }

    if command in commands:
        try:
            commands[command]()
        except KeyboardInterrupt:
            print()
            print_colored("\n[INFO] Operation cancelled by user.", Colors.YELLOW)
        except subprocess.CalledProcessError as e:
            print_colored(f"\n[ERROR] Command failed: {e}", Colors.RED)
            sys.exit(1)
    else:
        print_colored(f"[ERROR] Unknown command: {command}", Colors.RED)
        print()
        print_usage()
        sys.exit(1)


if __name__ == "__main__":
    main()
