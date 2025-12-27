#!/usr/bin/env python3
"""
Database Restore Script
Imports PostgreSQL database from SQL backup file
"""

import os
import sys
import subprocess
from pathlib import Path


class Colors:
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    RED = '\033[31m'
    RESET = '\033[0m'


def print_colored(message, color=''):
    print(f"{color}{message}{Colors.RESET}")


def print_header(title):
    print_colored("=" * 50, Colors.CYAN)
    print_colored(title, Colors.CYAN)
    print_colored("=" * 50, Colors.CYAN)
    print()


def load_env():
    """Load environment variables from .env file"""
    env_path = Path('.env')
    if not env_path.exists():
        env_example = Path('.env.example')
        if env_example.exists():
            print_colored("[INFO] Creating .env from .env.example...", Colors.YELLOW)
            env_path.write_text(env_example.read_text())
        else:
            print_colored("[ERROR] .env file not found!", Colors.RED)
            sys.exit(1)
    
    # Load environment variables with encoding fallbacks to avoid Unicode errors
    def _read_env_lines(path):
        encodings = ['utf-8', 'utf-8-sig', 'cp949', 'latin-1']
        for enc in encodings:
            try:
                with open(path, 'r', encoding=enc) as f:
                    return f.readlines()
            except UnicodeDecodeError:
                continue
            except Exception:
                raise
        
        # Last resort: read as binary and decode replacing invalid bytes
        with open(path, 'rb') as f:
            data = f.read()
        return data.decode('utf-8', errors='replace').splitlines()
    
    for line in _read_env_lines(env_path):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()


def check_containers_running():
    """Check if database container is running"""
    try:
        result = subprocess.run(
            ['docker-compose', 'ps', '-q', 'db'],
            capture_output=True,
            text=True,
            check=True
        )
        return bool(result.stdout.strip())
    except subprocess.CalledProcessError:
        return False


def restore_database(backup_file: str):
    """Restore PostgreSQL database from backup"""
    print_header("Edwards Database Restore")
    
    # Load environment variables
    load_env()
    
    # Find backup file
    backup_path = Path('backups') / backup_file
    if not backup_path.exists():
        # Try absolute path
        backup_path = Path(backup_file)
        if not backup_path.exists():
            print_colored(f"[ERROR] Backup file not found: {backup_file}", Colors.RED)
            print_colored("[INFO] Available backups:", Colors.YELLOW)
            backups_dir = Path('backups')
            if backups_dir.exists():
                for f in sorted(backups_dir.glob('*.sql'), reverse=True):
                    print_colored(f"  - {f.name}", Colors.CYAN)
            sys.exit(1)
    
    # Check if database is running
    if not check_containers_running():
        print_colored("[ERROR] Database container is not running!", Colors.RED)
        print_colored("[INFO] Start the database first: ./run.py backend", Colors.YELLOW)
        sys.exit(1)
    
    print_colored(f"[INFO] Restoring database from backup...", Colors.GREEN)
    print_colored(f"  Database: {os.getenv('POSTGRES_DB', 'edwards')}", Colors.CYAN)
    print_colored(f"  Backup: {backup_path}", Colors.CYAN)
    print()
    
    # Confirm restoration
    response = input(f"{Colors.YELLOW}⚠️  This will REPLACE all current data. Continue? (yes/no): {Colors.RESET}")
    if response.lower() not in ['yes', 'y']:
        print_colored("[INFO] Restore cancelled.", Colors.YELLOW)
        sys.exit(0)
    
    print()
    
    try:
        # Execute psql inside the database container
        with open(backup_path, 'r') as f:
            cmd = [
                'docker-compose', 'exec', '-T', 'db',
                'psql',
                '-U', os.getenv('POSTGRES_USER', 'postgres'),
                '-d', os.getenv('POSTGRES_DB', 'edwards')
            ]
            
            subprocess.run(cmd, stdin=f, check=True, capture_output=True, text=True)
        
        print()
        print_colored("=" * 50, Colors.GREEN)
        print_colored("✅ Database restored successfully!", Colors.GREEN)
        print_colored("=" * 50, Colors.GREEN)
        print()
        print_colored("You can now access the application:", Colors.CYAN)
        print_colored(f"  Frontend: http://localhost:{os.getenv('FRONTEND_PORT', '3004')}", Colors.GREEN)
        print_colored(f"  Backend API: http://localhost:{os.getenv('BACKEND_PORT', '8004')}/api/docs", Colors.GREEN)
        print()
        
    except subprocess.CalledProcessError as e:
        print()
        print_colored(f"[ERROR] Restore failed: {e}", Colors.RED)
        if e.stderr:
            print_colored(f"Error details: {e.stderr}", Colors.RED)
        sys.exit(1)


def show_usage():
    """Show usage information"""
    print_header("Database Restore Tool")
    print_colored("Usage:", Colors.CYAN)
    print_colored("  ./restore_db.py <backup_file>", Colors.WHITE)
    print()
    print_colored("Example:", Colors.CYAN)
    print_colored("  ./restore_db.py edwards_backup_20231227_120000.sql", Colors.WHITE)
    print()
    print_colored("Available backups:", Colors.CYAN)
    backups_dir = Path('backups')
    if backups_dir.exists():
        backups = sorted(backups_dir.glob('*.sql'), reverse=True)
        if backups:
            for f in backups[:5]:  # Show last 5 backups
                print_colored(f"  - {f.name}", Colors.GREEN)
        else:
            print_colored("  (no backups found)", Colors.YELLOW)
    else:
        print_colored("  (backups directory not found)", Colors.YELLOW)
    print()


if __name__ == '__main__':
    try:
        if len(sys.argv) < 2:
            show_usage()
            sys.exit(1)
        
        backup_file = sys.argv[1]
        restore_database(backup_file)
        
    except KeyboardInterrupt:
        print()
        print_colored("\n[INFO] Restore cancelled by user.", Colors.YELLOW)
        sys.exit(0)
