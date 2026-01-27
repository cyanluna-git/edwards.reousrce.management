"""
Database Backup and Restore Utility

Provides functionality to:
1. Backup local PostgreSQL database using pg_dump
2. Restore backup to server PostgreSQL
3. List available backups

Usage:
    cd backend
    python -m scripts.db_backup --backup                    # Backup local DB
    python -m scripts.db_backup --backup --output backup.sql  # Custom filename
    python -m scripts.db_backup --restore backup.sql --target server  # Restore to server
    python -m scripts.db_backup --list                      # List backups

Environment Variables (in .env):
    DATABASE_URL - Local PostgreSQL connection string
    SERVER_DATABASE_URL - Server PostgreSQL connection string (optional)
"""

import sys
import os
import subprocess
import argparse
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse
from typing import Optional, Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings

# Backup directory
BACKUP_DIR = Path(__file__).parent.parent.parent / "backups"


def ensure_backup_dir():
    """Create backup directory if it doesn't exist."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def parse_database_url(url: str) -> dict:
    """
    Parse PostgreSQL connection URL into components.

    Args:
        url: PostgreSQL URL (e.g., postgresql://user:pass@host:port/dbname)

    Returns:
        Dictionary with host, port, user, password, dbname
    """
    parsed = urlparse(url)

    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "dbname": parsed.path.lstrip("/") or "postgres",
    }


def get_local_db_config() -> dict:
    """Get local database configuration from settings."""
    return parse_database_url(settings.DATABASE_URL)


def get_server_db_config() -> Optional[dict]:
    """Get server database configuration if available."""
    server_url = os.getenv("SERVER_DATABASE_URL")
    if server_url:
        return parse_database_url(server_url)
    return None


def generate_backup_filename() -> str:
    """Generate timestamped backup filename."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"backup_{timestamp}.sql"


def run_pg_dump(
    config: dict,
    output_path: Path,
    format: str = "p",  # p = plain SQL, c = custom (compressed)
    verbose: bool = False
) -> Tuple[bool, str]:
    """
    Run pg_dump to backup database.

    Args:
        config: Database configuration dict
        output_path: Path to save backup file
        format: pg_dump format (p=plain, c=custom)
        verbose: Print verbose output

    Returns:
        Tuple of (success, message)
    """
    # Build pg_dump command
    cmd = [
        "pg_dump",
        "-h", config["host"],
        "-p", str(config["port"]),
        "-U", config["user"],
        "-d", config["dbname"],
        "-F", format,
        "-f", str(output_path),
    ]

    if verbose:
        cmd.append("-v")

    # Set PGPASSWORD environment variable
    env = os.environ.copy()
    if config["password"]:
        env["PGPASSWORD"] = config["password"]

    try:
        if verbose:
            print(f"Running: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            size = output_path.stat().st_size / 1024 / 1024  # MB
            return True, f"Backup saved to {output_path} ({size:.2f} MB)"
        else:
            return False, f"pg_dump failed: {result.stderr}"

    except FileNotFoundError:
        return False, "pg_dump not found. Make sure PostgreSQL client tools are installed."
    except Exception as e:
        return False, f"Error: {str(e)}"


def run_pg_restore(
    config: dict,
    backup_path: Path,
    clean: bool = True,
    verbose: bool = False
) -> Tuple[bool, str]:
    """
    Run pg_restore or psql to restore database.

    Args:
        config: Database configuration dict
        backup_path: Path to backup file
        clean: Drop existing objects before restore
        verbose: Print verbose output

    Returns:
        Tuple of (success, message)
    """
    if not backup_path.exists():
        return False, f"Backup file not found: {backup_path}"

    # Determine if this is a plain SQL or custom format
    is_plain = str(backup_path).endswith(".sql")

    if is_plain:
        # Use psql for plain SQL
        cmd = [
            "psql",
            "-h", config["host"],
            "-p", str(config["port"]),
            "-U", config["user"],
            "-d", config["dbname"],
            "-f", str(backup_path),
        ]
    else:
        # Use pg_restore for custom format
        cmd = [
            "pg_restore",
            "-h", config["host"],
            "-p", str(config["port"]),
            "-U", config["user"],
            "-d", config["dbname"],
        ]

        if clean:
            cmd.append("-c")  # Clean (drop) database objects before recreating

        if verbose:
            cmd.append("-v")

        cmd.append(str(backup_path))

    # Set PGPASSWORD environment variable
    env = os.environ.copy()
    if config["password"]:
        env["PGPASSWORD"] = config["password"]

    try:
        if verbose:
            print(f"Running: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            return True, f"Restore completed successfully"
        else:
            # pg_restore returns non-zero even with warnings, check stderr
            if "ERROR" in result.stderr:
                return False, f"Restore failed: {result.stderr}"
            else:
                return True, f"Restore completed with warnings: {result.stderr[:200]}"

    except FileNotFoundError:
        tool = "psql" if is_plain else "pg_restore"
        return False, f"{tool} not found. Make sure PostgreSQL client tools are installed."
    except Exception as e:
        return False, f"Error: {str(e)}"


def list_backups() -> list:
    """List all available backup files."""
    ensure_backup_dir()

    backups = []
    for f in BACKUP_DIR.glob("backup_*.sql*"):
        stat = f.stat()
        backups.append({
            "name": f.name,
            "path": str(f),
            "size_mb": stat.st_size / 1024 / 1024,
            "created": datetime.fromtimestamp(stat.st_mtime),
        })

    # Sort by creation time, newest first
    backups.sort(key=lambda x: x["created"], reverse=True)
    return backups


def backup_database(
    output: Optional[str] = None,
    compressed: bool = False,
    verbose: bool = False
) -> bool:
    """
    Backup local database.

    Args:
        output: Custom output filename (optional)
        compressed: Use compressed format
        verbose: Verbose output

    Returns:
        True if successful
    """
    print("=" * 60)
    print("Database Backup")
    print("=" * 60)

    ensure_backup_dir()

    config = get_local_db_config()
    print(f"Source: {config['host']}:{config['port']}/{config['dbname']}")

    if output:
        filename = output
    else:
        filename = generate_backup_filename()
        if compressed:
            filename = filename.replace(".sql", ".dump")

    output_path = BACKUP_DIR / filename

    format_type = "c" if compressed else "p"
    print(f"Format: {'Compressed (custom)' if compressed else 'Plain SQL'}")
    print(f"Output: {output_path}")
    print()

    success, message = run_pg_dump(config, output_path, format_type, verbose)

    if success:
        print(f"SUCCESS: {message}")
    else:
        print(f"FAILED: {message}")

    return success


def restore_database(
    backup_file: str,
    target: str = "local",
    clean: bool = True,
    verbose: bool = False
) -> bool:
    """
    Restore database from backup.

    Args:
        backup_file: Path to backup file
        target: "local" or "server"
        clean: Drop existing objects before restore
        verbose: Verbose output

    Returns:
        True if successful
    """
    print("=" * 60)
    print("Database Restore")
    print("=" * 60)

    # Determine backup path
    backup_path = Path(backup_file)
    if not backup_path.is_absolute():
        backup_path = BACKUP_DIR / backup_file

    if not backup_path.exists():
        print(f"ERROR: Backup file not found: {backup_path}")
        return False

    # Get target configuration
    if target == "server":
        config = get_server_db_config()
        if config is None:
            print("ERROR: SERVER_DATABASE_URL not configured in .env")
            return False
    else:
        config = get_local_db_config()

    print(f"Target: {config['host']}:{config['port']}/{config['dbname']}")
    print(f"Backup: {backup_path}")
    print(f"Clean: {clean}")
    print()

    # Confirm for server restore
    if target == "server":
        print("WARNING: You are about to restore to the SERVER database!")
        response = input("Type 'yes' to confirm: ")
        if response.lower() != "yes":
            print("Restore cancelled.")
            return False

    success, message = run_pg_restore(config, backup_path, clean, verbose)

    if success:
        print(f"SUCCESS: {message}")
    else:
        print(f"FAILED: {message}")

    return success


def show_backups():
    """Display list of available backups."""
    print("=" * 60)
    print("Available Backups")
    print("=" * 60)
    print(f"Backup directory: {BACKUP_DIR}")
    print()

    backups = list_backups()

    if not backups:
        print("No backups found.")
        return

    print(f"{'Filename':<40} {'Size (MB)':<12} {'Created'}")
    print("-" * 70)

    for b in backups:
        print(f"{b['name']:<40} {b['size_mb']:<12.2f} {b['created'].strftime('%Y-%m-%d %H:%M:%S')}")


def main():
    parser = argparse.ArgumentParser(
        description="Database Backup and Restore Utility"
    )

    # Actions
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--backup",
        action="store_true",
        help="Backup local database"
    )
    group.add_argument(
        "--restore",
        type=str,
        metavar="FILE",
        help="Restore database from backup file"
    )
    group.add_argument(
        "--list",
        action="store_true",
        help="List available backups"
    )

    # Options
    parser.add_argument(
        "--output", "-o",
        type=str,
        help="Output filename for backup"
    )
    parser.add_argument(
        "--target",
        choices=["local", "server"],
        default="local",
        help="Target database for restore (default: local)"
    )
    parser.add_argument(
        "--compressed", "-c",
        action="store_true",
        help="Use compressed backup format"
    )
    parser.add_argument(
        "--no-clean",
        action="store_true",
        help="Don't drop existing objects before restore"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )

    args = parser.parse_args()

    if args.backup:
        backup_database(
            output=args.output,
            compressed=args.compressed,
            verbose=args.verbose
        )
    elif args.restore:
        restore_database(
            backup_file=args.restore,
            target=args.target,
            clean=not args.no_clean,
            verbose=args.verbose
        )
    elif args.list:
        show_backups()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
