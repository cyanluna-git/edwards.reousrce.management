#!/usr/bin/env python3
"""
Start Coolify and application containers
"""
import subprocess
import sys
import time

SERVER_IP = "10.182.252.32"
USERNAME = "atlasAdmin"
REMOTE_PATH = "/home/atlasAdmin/services/eob-project"
COOLIFY_PATH = "/root/coolify"  # Common Coolify installation path

def run_ssh(command, description=""):
    """Execute SSH command"""
    if description:
        print(f"\n{'='*60}")
        print(f"{description}")
        print('='*60)
    
    full_cmd = ['ssh', f'{USERNAME}@{SERVER_IP}', command]
    result = subprocess.run(full_cmd, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode, result.stdout

def main():
    print("=" * 70)
    print("Starting Coolify/Traefik and Application")
    print("=" * 70)
    
    # 1. Check if Coolify is installed
    print("\n[1/6] Checking Coolify installation...")
    code, output = run_ssh("ls -la /root/coolify 2>/dev/null || ls -la ~/coolify 2>/dev/null || echo 'Coolify not found in standard locations'")
    
    # 2. Find and start Coolify/Traefik
    print("\n[2/6] Starting Coolify/Traefik...")
    
    # Try multiple potential locations
    locations = [
        "/root/coolify",
        "/home/atlasAdmin/coolify", 
        "/opt/coolify",
        "/var/coolify"
    ]
    
    coolify_started = False
    for location in locations:
        code, _ = run_ssh(f"test -d {location} && echo 'exists' || echo 'not found'")
        if 'exists' in _:
            print(f"  Found Coolify at: {location}")
            run_ssh(f"cd {location} && docker-compose up -d", f"  Starting Coolify from {location}")
            coolify_started = True
            break
    
    if not coolify_started:
        print("  WARNING: Coolify not found. Checking if Traefik is running standalone...")
        run_ssh("docker ps | grep traefik")
    
    # 3. Wait for Traefik to be ready
    print("\n[3/6] Waiting for Traefik to start...")
    time.sleep(5)
    run_ssh("docker ps | grep traefik", "  Traefik status:")
    
    # 4. Verify coolify network exists
    print("\n[4/6] Verifying coolify network...")
    code, output = run_ssh("docker network inspect coolify >/dev/null 2>&1 && echo 'exists' || echo 'missing'")
    
    if 'missing' in output:
        print("  Creating coolify network...")
        run_ssh("docker network create coolify")
    else:
        print("  ✓ Coolify network exists")
    
    # 5. Start application containers
    print("\n[5/6] Starting application containers...")
    run_ssh(f"cd {REMOTE_PATH} && docker-compose up -d")
    
    # 6. Check status
    print("\n[6/6] Checking container status...")
    time.sleep(10)
    
    run_ssh(f"cd {REMOTE_PATH} && docker-compose ps", "Application containers:")
    run_ssh("docker ps | grep traefik", "Traefik:")
    run_ssh("docker network inspect coolify | grep -A 2 'edwards' || echo 'Checking connections...'", "Network connections:")
    
    print("\n" + "=" * 70)
    print("STATUS SUMMARY")
    print("=" * 70)
    
    # Final checks
    code, output = run_ssh("docker ps --format '{{.Names}}' | grep -E 'traefik|edwards'")
    
    if 'traefik' in output:
        print("✓ Traefik is running")
    else:
        print("✗ Traefik is NOT running - reverse proxy will not work!")
        print("  → You need to start Coolify or install Traefik")
    
    if 'edwards' in output:
        print("✓ Application containers are running")
    else:
        print("✗ Application containers are NOT running")
        print("  → Check logs: ssh {SERVER_IP} 'cd {REMOTE_PATH} && docker-compose logs'")
    
    print("\nTest application:")
    print(f"  → http://eob.10.182.252.32.sslip.io")
    print(f"\nIf 404 persists, check Traefik dashboard (if enabled)")
    print(f"  → http://traefik.10.182.252.32.sslip.io (if configured)")

if __name__ == '__main__':
    main()
