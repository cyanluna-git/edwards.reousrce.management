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
        subprocess.run(get_compose_command() + ["up", "-d", "--no-deps", "backend"], check=True)
    else:
        print_colored("[INFO] Starting database and backend services...", Colors.GREEN)
        subprocess.run(get_compose_command() + ["up", "-d", "db", "backend"], check=True)

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


def print_usage():
    """Print usage information"""
    print_header("Edwards Service Runner")
    print()
    print_colored("Usage:", Colors.CYAN)
    print_colored("  python run.py [command]", Colors.WHITE)
    print()
    print_colored("Commands:", Colors.CYAN)
    print_colored("  backend     Start backend services (Database + API)", Colors.WHITE)
    print_colored("  frontend    Start frontend service", Colors.WHITE)
    print_colored("  all         Start all services", Colors.WHITE)
    print_colored("  stop        Stop all services", Colors.WHITE)
    print_colored("  status      Show status of all services", Colors.WHITE)
    print_colored("  help        Show this help message", Colors.WHITE)
    print()
    print_colored("Examples:", Colors.CYAN)
    print_colored("  python run.py backend   # Start backend only", Colors.WHITE)
    print_colored("  python run.py all       # Start everything", Colors.WHITE)
    print_colored("  python run.py stop      # Stop all services", Colors.WHITE)
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
        "backend": run_backend,
        "frontend": run_frontend,
        "all": run_all,
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
