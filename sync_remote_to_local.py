import sys
import os
import pty
import select
import time
import subprocess
from datetime import datetime

# ================= Configuration =================
# Remote Server Config
REMOTE_CONTAINER = "edwards_project-db-1"
REMOTE_DB_USER = "postgres"
REMOTE_DB_NAME = "edwards"
REMOTE_TMP_FILE = "/tmp/remote_backup.sql"

# Local Config
LOCAL_BACKUP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backups")
LOCAL_CONTAINER = "edwards-postgres" 
LOCAL_DB_USER = "postgres"
LOCAL_DB_NAME = "edwards"

# .env.vm location
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.vm")
# =================================================

def load_env(path):
    config = {}
    try:
        with open(path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    config[key] = value
    except FileNotFoundError:
        print(f"Error: .env.vm file not found at {path}")
        sys.exit(1)
    return config

def interactive_command(cmd, password):
    """Executes SSH/SCP commands, printing ALL output and handling password prompts."""
    print(f"⚡ Executing: {' '.join(cmd)}")
    
    pid, fd = pty.fork()
    
    if pid == 0:
        os.execvp(cmd[0], cmd)
    else:
        output_str = ""
        last_chunk_time = time.time()
        last_password_time = 0 
        
        while True:
            r, _, _ = select.select([fd], [], [], 0.1)
            if fd in r:
                try:
                    data = os.read(fd, 1024)
                    if not data:
                        break
                    chunk = data.decode(errors='ignore')
                    
                    # PRINT EVERYTHING TO STDOUT
                    sys.stdout.write(chunk)
                    sys.stdout.flush()
                    
                    output_str += chunk

                    # Smart Password Detection
                    lower_chunk = chunk.lower()
                    now = time.time()
                    
                    # Detect prompts
                    is_ssh_prompt = "password:" in lower_chunk and "sudo" not in lower_chunk
                    is_sudo_prompt = "[sudo] password" in lower_chunk or "password for" in lower_chunk
                    
                    # Send password
                    if (is_ssh_prompt or is_sudo_prompt) and (now - last_password_time > 2.0):
                        os.write(fd, (password + "\n").encode())
                        last_password_time = now
                        # No print here to avoid cluttering the real output
                        
                except OSError:
                    break
            
            if os.waitpid(pid, os.WNOHANG)[0] == pid:
                # Read remainder
                try:
                    data = os.read(fd, 1024)
                    if data:
                        chunk = data.decode(errors='ignore')
                        sys.stdout.write(chunk)
                        sys.stdout.flush()
                        output_str += chunk
                except OSError:
                    pass
                break
        
        return output_str

def main():
    # 0. Setup
    if not os.path.exists(LOCAL_BACKUP_DIR):
        os.makedirs(LOCAL_BACKUP_DIR)
        
    config = load_env(ENV_PATH)
    user = config.get('VM_USER')
    ip = config.get('VM_IP')
    password = config.get('VM_PASSWORD')

    if not all([user, ip, password]):
        print("❌ Error: Missing credentials in .env.vm")
        return

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    local_filename = f"remote_sync_{timestamp}.sql"
    local_file_path = os.path.join(LOCAL_BACKUP_DIR, local_filename)

    print(f"🚀 Starting One-Shot Sync")
    print(f"   Remote: {REMOTE_CONTAINER} -> Local: {LOCAL_CONTAINER}")

    # 1. Remote Backup (via SSH)
    print("\n[1/4] 📦 Creating backup on remote server...")
    
    # Using bash explicitly to handle redirection properly under sudo
    backup_cmd_str = (
        f"docker exec {REMOTE_CONTAINER} pg_dump -U {REMOTE_DB_USER} -d {REMOTE_DB_NAME} --clean --if-exists > {REMOTE_TMP_FILE} "
        f"&& chmod 644 {REMOTE_TMP_FILE} && echo 'BACKUP_SUCCESS'"
    )
    
    # Wrap in sudo sh -c
    safe_backup_cmd = f"sudo sh -c \"{backup_cmd_str}\""
    
    ssh_cmd = ["ssh", "-tt", "-o", "StrictHostKeyChecking=no", f"{user}@{ip}", safe_backup_cmd]
    
    output = interactive_command(ssh_cmd, password)
    
    if "BACKUP_SUCCESS" not in output:
        print("\n⚠️  Warning: Backup command output doesn't confirm success. Proceeding cautiously.")

    # 2. Download Backup (via SCP)
    print(f"\n[2/4] ⬇️  Downloading to {local_filename}...")
    scp_cmd = ["scp", "-o", "StrictHostKeyChecking=no", f"{user}@{ip}:{REMOTE_TMP_FILE}", local_file_path]
    interactive_command(scp_cmd, password)

    if not os.path.exists(local_file_path) or os.path.getsize(local_file_path) == 0:
        print("❌ Error: Download failed or file is empty.")
        sys.exit(1)

    # 3. Cleanup Remote (via SSH)
    print("\n[3/4] 🧹 Cleaning up remote temp file...")
    cleanup_cmd = ["ssh", "-tt", "-o", "StrictHostKeyChecking=no", f"{user}@{ip}", f"sudo rm {REMOTE_TMP_FILE}"]
    interactive_command(cleanup_cmd, password)

    # 4. Local Restore
    print(f"\n[4/4] 💾 Restoring to LOCAL Docker container ({LOCAL_CONTAINER})...")
    
    try:
        subprocess.check_call(["docker", "ps", "-q", "-f", f"name={LOCAL_CONTAINER}"], stdout=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        print(f"❌ Error: Local container '{LOCAL_CONTAINER}' is not running.")
        sys.exit(1)

    try:
        print("   -> Copying file to container...")
        subprocess.check_call(["docker", "cp", local_file_path, f"{LOCAL_CONTAINER}:/tmp/restore.sql"])
        
        print("   -> Executing psql restore...")
        with open(os.devnull, 'w') as devnull:
             subprocess.check_call([
                "docker", "exec", LOCAL_CONTAINER, 
                "psql", "-U", LOCAL_DB_USER, "-d", LOCAL_DB_NAME, "-f", "/tmp/restore.sql"
            ], stdout=devnull)
        print("✅ Restore Complete!")
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Error during local restore: {e}")
        sys.exit(1)

    print(f"\n✨ Sync Finished Successfully! Local DB is now identical to Remote DB.")

if __name__ == "__main__":
    main()