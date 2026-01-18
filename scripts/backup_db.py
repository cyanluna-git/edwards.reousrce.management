#!/usr/bin/env python3
"""
Database Backup Script
Exports PostgreSQL database to SQL file
"""

import os
import sys
import subprocess
from datetime import datetime
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
        print_colored("[ERROR] .env file not found!", Colors.RED)
        sys.exit(1)
    
    with open(env_path, 'r') as f:
        for line in f:
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


def backup_database():
    """Backup PostgreSQL database"""
    print_header("Edwards Database Backup")
    
    # Load environment variables
    load_env()
    
    # Check if database is running
    if not check_containers_running():
        print_colored("[ERROR] Database container is not running!", Colors.RED)
        print_colored("[INFO] Start the database first: ./run.py backend", Colors.YELLOW)
        sys.exit(1)
    
    # Create backups directory
    backup_dir = Path('backups')
    backup_dir.mkdir(exist_ok=True)
    
    # Generate backup filename with timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = backup_dir / f'edwards_backup_{timestamp}.sql'
    
    print_colored(f"[INFO] Creating database backup...", Colors.GREEN)
    print_colored(f"  Database: {os.getenv('POSTGRES_DB', 'edwards')}", Colors.CYAN)
    print_colored(f"  Output: {backup_file}", Colors.CYAN)
    print()
    
    try:
        # Execute pg_dump inside the database container
        cmd = [
            'docker-compose', 'exec', '-T', 'db',
            'pg_dump',
            '-U', os.getenv('POSTGRES_USER', 'postgres'),
            '-d', os.getenv('POSTGRES_DB', 'edwards'),
            '--no-owner',  # Don't set ownership
            '--no-privileges'  # Don't set privileges
        ]
        
        # Run pg_dump and save to file
        with open(backup_file, 'w') as f:
            subprocess.run(cmd, stdout=f, check=True, text=True)
        
        # Get file size
        size_mb = backup_file.stat().st_size / (1024 * 1024)
        
        print()
        print_colored("=" * 50, Colors.GREEN)
        print_colored("✅ Backup completed successfully!", Colors.GREEN)
        print_colored("=" * 50, Colors.GREEN)
        print()
        print_colored("Backup Details:", Colors.CYAN)
        print_colored(f"  File: {backup_file}", Colors.GREEN)
        print_colored(f"  Size: {size_mb:.2f} MB", Colors.GREEN)
        print()
        print_colored("To restore on another PC:", Colors.CYAN)
        print_colored("  1. Copy this backup file to the new PC", Colors.YELLOW)
        print_colored("  2. Place it in the 'backups/' directory", Colors.YELLOW)
        print_colored(f"  3. Run: ./restore_db.py {backup_file.name}", Colors.YELLOW)
        print()
        
    except subprocess.CalledProcessError as e:
        print()
        print_colored(f"[ERROR] Backup failed: {e}", Colors.RED)
        sys.exit(1)


if __name__ == '__main__':
    try:
        backup_database()
    except KeyboardInterrupt:
        print()
        print_colored("\n[INFO] Backup cancelled by user.", Colors.YELLOW)
        sys.exit(0)
