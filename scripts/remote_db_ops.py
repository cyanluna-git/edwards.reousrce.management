#!/usr/bin/env python3
"""
Remote Database Operations Script
Manages backup and restore operations between local machine and remote production server.
"""

import os
import sys
import subprocess
import argparse
from datetime import datetime
from pathlib import Path

# Configuration
SERVER_IP = "10.182.252.32"
SSH_USER = "atlasAdmin"
REMOTE_PATH = "/home/atlasAdmin/services/edwards_project"
LOCAL_BACKUP_DIR = Path("backups")

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

def run_command(cmd, shell=False, check=True, capture_output=False):
    """Run a shell command and handle errors."""
    try:
        # If cmd is a list of strings, print it nicely
        cmd_str = cmd if isinstance(cmd, str) else ' '.join(cmd)
        # print_colored(f"DEBUG: Executing: {cmd_str}", Colors.RESET)
        
        result = subprocess.run(
            cmd, 
            shell=shell, 
            check=check, 
            text=True, 
            capture_output=capture_output
        )
        return result
    except subprocess.CalledProcessError as e:
        print_colored(f"\n[ERROR] Command failed: {e}", Colors.RED)
        if e.stderr:
            print_colored(f"Stderr: {e.stderr}", Colors.RED)
        sys.exit(1)

def backup_remote():
    """Backs up the production database from the remote server."""
    print_header("REMOTE BACKUP: Production -> Local")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"edwards_remote_backup_{timestamp}.sql"
    local_file_path = LOCAL_BACKUP_DIR / backup_filename
    
    # Ensure local backup directory exists
    LOCAL_BACKUP_DIR.mkdir(exist_ok=True)
    
    print_colored(f"🔹 Target: {SSH_USER}@{SERVER_IP}", Colors.CYAN)
    print_colored(f"🔹 Remote Path: {REMOTE_PATH}", Colors.CYAN)
    print_colored(f"🔹 Local File: {local_file_path}", Colors.CYAN)
    print()

    # 1. Create Remote Dump
    print_colored("1. Creating database dump on remote server...", Colors.YELLOW)
    remote_cmd = (
        f"cd {REMOTE_PATH} && "
        f"docker exec edwards-postgres pg_dump -U postgres -d edwards > {backup_filename}"
    )
    run_command(["ssh", f"{SSH_USER}@{SERVER_IP}", remote_cmd])
    print_colored(f"   ✅ Remote dump created: {backup_filename}", Colors.GREEN)

    # 2. Download Dump
    print_colored("2. Downloading backup file...", Colors.YELLOW)
    scp_source = f"{SSH_USER}@{SERVER_IP}:{REMOTE_PATH}/{backup_filename}"
    run_command(["scp", scp_source, str(local_file_path)])
    print_colored("   ✅ Download successful.", Colors.GREEN)

    # 3. Cleanup Remote
    print_colored("3. Cleaning up remote server...", Colors.YELLOW)
    cleanup_cmd = f"rm {REMOTE_PATH}/{backup_filename}"
    run_command(["ssh", f"{SSH_USER}@{SERVER_IP}", cleanup_cmd])
    print_colored("   ✅ Remote cleanup done.", Colors.GREEN)

    print()
    print_colored("🎉 Backup Complete!", Colors.GREEN + Colors.BOLD)
    print_colored(f"Saved to: {local_file_path}", Colors.GREEN)


def restore_remote(backup_file=None):
    """Restores a local backup file to the remote production server."""
    print_header("REMOTE RESTORE: Local -> Production")
    
    # 1. Find backup file
    if not backup_file:
        # Find latest if not specified
        files = sorted(LOCAL_BACKUP_DIR.glob("*.sql"), key=lambda f: f.stat().st_mtime, reverse=True)
        if not files:
            print_colored("[ERROR] No backup files found in 'backups/' directory.", Colors.RED)
            sys.exit(1)
        target_backup = files[0]
    else:
        target_backup = Path(backup_file)
        if not target_backup.exists():
            # Try checking inside backups dir if path not found
            target_backup = LOCAL_BACKUP_DIR / backup_file
            if not target_backup.exists():
                print_colored(f"[ERROR] Backup file not found: {backup_file}", Colors.RED)
                sys.exit(1)

    print_colored("⚠️  WARNING: This will OVERWRITE the REMOTE production database!", Colors.RED + Colors.BOLD)
    print_colored(f"🔹 Target: {SSH_USER}@{SERVER_IP} (Database: edwards)", Colors.CYAN)
    print_colored(f"🔹 Source: {target_backup}", Colors.CYAN)
    print()
    
    confirm = input(f"{Colors.YELLOW}Are you sure you want to proceed? (Type 'yes' to confirm): {Colors.RESET}")
    if confirm.lower() != "yes":
        print_colored("Operation cancelled.", Colors.YELLOW)
        sys.exit(0)
    
    print()

    # 2. Upload Backup
    print_colored("1. Uploading backup to remote server...", Colors.YELLOW)
    remote_temp_file = "restore_candidate.sql"
    scp_dest = f"{SSH_USER}@{SERVER_IP}:{REMOTE_PATH}/{remote_temp_file}"
    run_command(["scp", str(target_backup), scp_dest])
    print_colored("   ✅ Upload successful.", Colors.GREEN)

    # 3. Perform Restore
    print_colored("2. Restoring database on remote server...", Colors.YELLOW)
    
    # We use a single SSH command with chained shell commands
    restore_cmds = [
        f"cd {REMOTE_PATH}",
        "echo '   Stopping API service...'",
        "docker stop edwards-api",
        "echo '   Recreating database...'",
        "docker exec edwards-postgres psql -U postgres -d postgres -c 'DROP DATABASE IF EXISTS edwards WITH (FORCE);'",
        "docker exec edwards-postgres psql -U postgres -d postgres -c 'CREATE DATABASE edwards;'",
        "echo '   Importing data...'",
        f"cat {remote_temp_file} | docker exec -i edwards-postgres psql -U postgres -d edwards",
        "echo '   Cleaning up...'",
        f"rm {remote_temp_file}",
        "echo '   Restarting API service...'",
        "docker start edwards-api"
    ]
    
    full_remote_cmd = " && ".join(restore_cmds)
    run_command(["ssh", f"{SSH_USER}@{SERVER_IP}", full_remote_cmd])

    print()
    print_colored("✅ Remote Restore Completed Successfully!", Colors.GREEN + Colors.BOLD)


def main():
    parser = argparse.ArgumentParser(description="Remote Database Operations")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Backup command
    subparsers.add_parser("backup", help="Backup remote DB to local")
    
    # Restore command
    restore_parser = subparsers.add_parser("restore", help="Restore local DB to remote")
    restore_parser.add_argument("file", nargs="?", help="Specific backup file to restore (optional, defaults to latest)")

    args = parser.parse_args()

    try:
        if args.command == "backup":
            backup_remote()
        elif args.command == "restore":
            restore_remote(args.file)
        else:
            parser.print_help()
    except KeyboardInterrupt:
        print_colored("\n[INFO] Operation cancelled by user.", Colors.YELLOW)
        sys.exit(0)

if __name__ == "__main__":
    main()
