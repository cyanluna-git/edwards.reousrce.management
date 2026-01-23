#!/usr/bin/env python3
"""
Local Database Operations Script
Manages backup and restore operations for the local Dockerized database.
Combines functionality of previous backup_db.py and restore_db.py.
"""

import os
import sys
import subprocess
import argparse
from datetime import datetime
from pathlib import Path

class Colors:
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    RED = '\033[31m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_colored(message, color=''):
    print(f"{color}{message}{Colors.RESET}")

def print_header(title):
    print()
    print_colored("=" * 60, Colors.CYAN)
    print_colored(f"  {title}", Colors.CYAN + Colors.BOLD)
    print_colored("=" * 60, Colors.CYAN)
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
    
    # Robust env reading (from restore_db.py)
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
        # Last resort
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
        # Check for 'db' service or whatever is defined in docker-compose
        result = subprocess.run(
            ['docker-compose', 'ps', '-q', 'db'],
            capture_output=True,
            text=True,
            check=True
        )
        return bool(result.stdout.strip())
    except subprocess.CalledProcessError:
        return False

def backup_local():
    """Backup PostgreSQL database"""
    print_header("LOCAL BACKUP: Docker DB -> Local File")
    
    load_env()
    
    if not check_containers_running():
        print_colored("[ERROR] Database container is not running!", Colors.RED)
        print_colored("[INFO] Start the database first: ./run.py backend", Colors.YELLOW)
        sys.exit(1)
    
    backup_dir = Path('backups')
    backup_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = backup_dir / f'edwards_backup_{timestamp}.sql'
    
    db_name = os.getenv('POSTGRES_DB', 'edwards')
    db_user = os.getenv('POSTGRES_USER', 'postgres')

    print_colored(f"[INFO] Creating database backup...", Colors.GREEN)
    print_colored(f"  Database: {db_name}", Colors.CYAN)
    print_colored(f"  Output: {backup_file}", Colors.CYAN)
    print()
    
    try:
        cmd = [
            'docker-compose', 'exec', '-T', 'db',
            'pg_dump',
            '-U', db_user,
            '-d', db_name,
            '--no-owner',
            '--no-privileges'
        ]
        
        with open(backup_file, 'w') as f:
            subprocess.run(cmd, stdout=f, check=True, text=True)
        
        size_mb = backup_file.stat().st_size / (1024 * 1024)
        
        print()
        print_colored("✅ Backup completed successfully!", Colors.GREEN + Colors.BOLD)
        print_colored(f"  File: {backup_file}", Colors.GREEN)
        print_colored(f"  Size: {size_mb:.2f} MB", Colors.GREEN)

    except subprocess.CalledProcessError as e:
        print_colored(f"\n[ERROR] Backup failed: {e}", Colors.RED)
        sys.exit(1)

def restore_local(backup_file=None):
    """Restore PostgreSQL database from backup"""
    print_header("LOCAL RESTORE: Local File -> Docker DB")
    
    load_env()
    
    # 1. Find backup file
    backup_path = None
    if backup_file:
        backup_path = Path(backup_file)
        if not backup_path.exists():
             # Check in backups dir
             backup_path = Path('backups') / backup_file
             if not backup_path.exists():
                 print_colored(f"[ERROR] Backup file not found: {backup_file}", Colors.RED)
                 sys.exit(1)
    else:
        # Find latest
        backups_dir = Path('backups')
        if not backups_dir.exists():
            print_colored("[ERROR] 'backups' directory not found.", Colors.RED)
            sys.exit(1)
            
        files = sorted(backups_dir.glob('*.sql'), key=lambda f: f.stat().st_mtime, reverse=True)
        if not files:
            print_colored("[ERROR] No backup files found in 'backups/' directory.", Colors.RED)
            sys.exit(1)
        backup_path = files[0]

    if not check_containers_running():
        print_colored("[ERROR] Database container is not running!", Colors.RED)
        print_colored("[INFO] Start the database first: ./run.py backend", Colors.YELLOW)
        sys.exit(1)
        
    db_name = os.getenv('POSTGRES_DB', 'edwards')
    db_user = os.getenv('POSTGRES_USER', 'postgres')

    print_colored(f"[INFO] Restoring database from backup...", Colors.GREEN)
    print_colored(f"  Database: {db_name}", Colors.CYAN)
    print_colored(f"  Source: {backup_path}", Colors.CYAN)
    print()
    
    response = input(f"{Colors.YELLOW}⚠️  This will DESTROY and REPLACE the local '{db_name}' database. Continue? (yes/no): {Colors.RESET}")
    if response.lower() not in ['yes', 'y']:
        print_colored("[INFO] Restore cancelled.", Colors.YELLOW)
        sys.exit(0)
    
    print()
    
    try:
        # 1. Stop backend to release locks
        print_colored("[INFO] Stopping backend service...", Colors.CYAN)
        subprocess.run(['docker-compose', 'stop', 'backend'], check=True)

        # 2. Drop and Recreate Database
        print_colored("[INFO] Recreating database...", Colors.CYAN)
        
        # Drop
        drop_cmd = [
            'docker-compose', 'exec', '-T', 'db',
            'psql', '-U', db_user, '-d', 'postgres',
            '-c', f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE);'
        ]
        subprocess.run(drop_cmd, check=True)

        # Create
        create_cmd = [
            'docker-compose', 'exec', '-T', 'db',
            'psql', '-U', db_user, '-d', 'postgres',
            '-c', f'CREATE DATABASE "{db_name}"'
        ]
        subprocess.run(create_cmd, check=True)

        # 3. Restore from Backup
        print_colored("[INFO] Importing data...", Colors.CYAN)
        with open(backup_path, 'r') as f:
            restore_cmd = [
                'docker-compose', 'exec', '-T', 'db',
                'psql', '-U', db_user, '-d', db_name
            ]
            subprocess.run(restore_cmd, stdin=f, check=True, capture_output=True, text=True)

        # 4. Restart Backend
        print_colored("[INFO] Restarting backend service...", Colors.CYAN)
        subprocess.run(['docker-compose', 'start', 'backend'], check=True)
        
        print()
        print_colored("✅ Local Database restored successfully!", Colors.GREEN + Colors.BOLD)
        
    except subprocess.CalledProcessError as e:
        print_colored(f"\n[ERROR] Restore failed: {e}", Colors.RED)
        if hasattr(e, 'stderr') and e.stderr:
            print_colored(f"Details: {e.stderr}", Colors.RED)
        
        print_colored("[INFO] Attempting to restart backend...", Colors.YELLOW)
        subprocess.run(['docker-compose', 'start', 'backend'], check=False)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Local Database Operations")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Backup command
    subparsers.add_parser("backup", help="Backup local DB to file")
    
    # Restore command
    restore_parser = subparsers.add_parser("restore", help="Restore local DB from file")
    restore_parser.add_argument("file", nargs="?", help="Specific backup file to restore (optional, defaults to latest)")

    args = parser.parse_args()

    try:
        if args.command == "backup":
            backup_local()
        elif args.command == "restore":
            restore_local(args.file)
        else:
            parser.print_help()
    except KeyboardInterrupt:
        print_colored("\n[INFO] Operation cancelled by user.", Colors.YELLOW)
        sys.exit(0)

if __name__ == '__main__':
    main()
