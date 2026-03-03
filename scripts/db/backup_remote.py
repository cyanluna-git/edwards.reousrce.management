#!/usr/bin/env python3
"""
Remote Database Backup Script
Backs up the database from the REMOTE server and saves it locally.
"""

import subprocess
import sys
import os
from datetime import datetime
from pathlib import Path

# Configuration
HOST = "10.182.252.32"
USER = "atlasAdmin"
DB_CONTAINER = "edwards-postgres"
DB_NAME = "edwards"
DB_USER = "postgres"
BACKUP_DIR = Path("backups")

class Colors:
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    RED = '\033[31m'
    RESET = '\033[0m'

def print_colored(message, color=''):
    print(f"{color}{message}{Colors.RESET}")

def run_command_to_file(cmd, output_file):
    """Run a command and redirect its output to a file"""
    print_colored(f"RUNNING: {' '.join(cmd)} > {output_file}", Colors.CYAN)
    # Using binary mode to avoid encoding issues with pg_dump output
    with open(output_file, 'wb') as f:
        subprocess.run(cmd, stdout=f, check=True)

def main():
    if not BACKUP_DIR.exists():
        BACKUP_DIR.mkdir(parents=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"remote_backup_{timestamp}.sql"
    backup_path = BACKUP_DIR / backup_filename

    print_colored(f"\nStarting remote database backup from {HOST}...", Colors.GREEN)
    
    try:
        # Command to run pg_dump on the remote container and pipe it back to a local file
        ssh_cmd = [
            "ssh", 
            f"{USER}@{HOST}", 
            f"docker exec {DB_CONTAINER} pg_dump -U {DB_USER} {DB_NAME}"
        ]
        
        run_command_to_file(ssh_cmd, backup_path)
        
        # Check if file exists and is not empty
        if backup_path.exists() and backup_path.stat().st_size > 1000:
            print_colored(f"\n✅ Remote database backup complete!", Colors.GREEN)
            print_colored(f"Backup saved to: {backup_path}", Colors.GREEN)
        else:
            size = backup_path.stat().st_size if backup_path.exists() else 0
            print_colored(f"\nWarning: Backup file is very small or missing ({size} bytes).", Colors.YELLOW)
            print_colored("Check if the remote database is accessible and has data.", Colors.YELLOW)

    except subprocess.CalledProcessError as e:
        print_colored(f"\n❌ An error occurred during backup: {e}", Colors.RED)
        sys.exit(1)
    except Exception as e:
        print_colored(f"\n❌ An unexpected error occurred: {e}", Colors.RED)
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelled.")