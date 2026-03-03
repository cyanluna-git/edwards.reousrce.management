#!/usr/bin/env python3
"""
Remote Database Restore Script
Restores a local SQL backup file to the REMOTE server database.
WARNING: This will DROP and RECREATE the remote database.
"""

import argparse
import subprocess
import sys
import os
from pathlib import Path

# Configuration
HOST = "10.182.252.32"
USER = "atlasAdmin"
REMOTE_PROJECT_PATH = "/data/eob/edwards_project"
DB_CONTAINER = "edwards-postgres"
APP_CONTAINER = "edwards-api"
DB_NAME = "edwards"
DB_USER = "postgres"

class Colors:
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    RED = '\033[31m'
    RESET = '\033[0m'

def print_colored(message, color=''):
    print(f"{color}{message}{Colors.RESET}")

def run_local(cmd):
    """Run a command locally"""
    print_colored(f"LOCAL: {' '.join(cmd)}", Colors.CYAN)
    subprocess.run(cmd, check=True)

def run_remote(cmd, ignore_error=False):
    """Run a command via SSH"""
    ssh_cmd = ["ssh", "-t", f"{USER}@{HOST}", cmd]
    print_colored(f"REMOTE: {cmd}", Colors.CYAN)
    try:
        subprocess.run(ssh_cmd, check=True)
    except subprocess.CalledProcessError:
        if not ignore_error:
            raise

def main():
    parser = argparse.ArgumentParser(description="Restore Remote Database")
    parser.add_argument("backup_file", help="Path to the local .sql backup file")
    args = parser.parse_args()

    backup_path = Path(args.backup_file)
    if not backup_path.exists():
        print_colored(f"Error: File {backup_path} not found.", Colors.RED)
        sys.exit(1)

    print_colored(f"\n!!! WARNING !!!", Colors.RED)
    print_colored(f"You are about to DESTROY and RESTORE the database on REMOTE SERVER ({HOST}).", Colors.RED)
    print_colored(f"Target Database: {DB_NAME}", Colors.RED)
    print_colored(f"Source File: {backup_path}", Colors.YELLOW)
    
    confirm = input(f"\nType 'destroy remote db' to continue: ")
    if confirm != "destroy remote db":
        print_colored("Operation cancelled.", Colors.GREEN)
        sys.exit(0)

    try:
        # 1. Upload Backup
        print_colored("\n[1/5] Uploading backup to remote server...", Colors.GREEN)
        remote_tmp = f"/tmp/restore_upload.sql"
        run_local(["scp", str(backup_path), f"{USER}@{HOST}:{remote_tmp}"])

        # 2. Stop Backend (Release locks)
        print_colored("\n[2/5] Stopping remote backend...", Colors.GREEN)
        run_remote(f"docker stop {APP_CONTAINER} || true")

        # 3. Drop and Recreate DB
        print_colored("\n[3/5] Recreating database...", Colors.GREEN)
        # Drop (Force disconnects)
        drop_sql = f"DROP DATABASE IF EXISTS \"{DB_NAME}\" WITH (FORCE);"
        run_remote(f"docker exec {DB_CONTAINER} psql -U {DB_USER} -d postgres -c '{drop_sql}'")
        # Create
        create_sql = f"CREATE DATABASE \"{DB_NAME}\";"
        run_remote(f"docker exec {DB_CONTAINER} psql -U {DB_USER} -d postgres -c '{create_sql}'")

        # 4. Import Data
        print_colored("\n[4/5] Importing data...", Colors.GREEN)
        # We copy the file into the container first to avoid pipe issues or just cat it
        # 'docker exec -i' allows piping stdin.
        # Cat remote file | docker exec -i ...
        # Since we have the file at /tmp/restore_upload.sql on the host:
        restore_cmd = f"cat {remote_tmp} | docker exec -i {DB_CONTAINER} psql -U {DB_USER} -d {DB_NAME}"
        run_remote(restore_cmd)

        # 5. Restart Backend
        print_colored("\n[5/5] Restarting backend...", Colors.GREEN)
        run_remote(f"docker start {APP_CONTAINER}")
        
        # Cleanup
        run_remote(f"rm {remote_tmp}")

        print_colored("\n✅ Remote database restore complete!", Colors.GREEN)

    except subprocess.CalledProcessError as e:
        print_colored(f"\n❌ An error occurred: {e}", Colors.RED)
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelled.")
