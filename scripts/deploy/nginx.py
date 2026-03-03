#!/usr/bin/env python3
"""
Finalize Server Infrastructure:
1. Stops competing Traefik (coolify-proxy)
2. Cleans up redundant Nginx configs
3. Deploys the definitive EOB Nginx proxy config
"""

import argparse
import subprocess
import sys
from pathlib import Path

class Colors:
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    RED = '\033[31m'
    RESET = '\033[0m'

def print_colored(message, color=''):
    print(f"{color}{message}{Colors.RESET}")

def run_remote(ssh_base, cmd, desc):
    print_colored(f">>> {desc}...", Colors.CYAN)
    full_cmd = ssh_base + [cmd]
    result = subprocess.run(full_cmd)
    if result.returncode != 0:
        print_colored(f"Warning: {desc} returned non-zero exit code.", Colors.YELLOW)
    return result.returncode == 0

def main():
    parser = argparse.ArgumentParser(description="Finalize Server Proxy Infrastructure")
    parser.add_argument("--host", default="10.182.252.32", help="Remote host IP")
    parser.add_argument("--user", default="atlasAdmin", help="Remote SSH user")
    args = parser.parse_args()

    ssh_base = ["ssh", "-t", f"{args.user}@{args.host}"]
    
    # 1. Stop Traefik/Coolify Proxy
    run_remote(ssh_base, 
               "sudo docker stop coolify-proxy 2>/dev/null && sudo docker update --restart=no coolify-proxy 2>/dev/null", 
               "Stopping Traefik (coolify-proxy) to free Port 80")

    # 2. Cleanup Nginx sites-enabled
    run_remote(ssh_base, 
               "sudo rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/edwards /etc/nginx/sites-enabled/euvcfg", 
               "Cleaning up redundant Nginx configurations")

    # 3. Upload and Deploy new config
    local_conf = Path("nginx_remote_proxy.conf")
    if not local_conf.exists():
        print_colored("Error: nginx_remote_proxy.conf not found locally!", Colors.RED)
        return

    print_colored("\n>>> Uploading new Nginx configuration...", Colors.CYAN)
    subprocess.run(["scp", str(local_conf), f"{args.user}@{args.host}:/tmp/coolify.conf"])
    
    run_remote(ssh_base, 
               "sudo mv /tmp/coolify.conf /etc/nginx/sites-available/coolify.conf && " +
               "sudo ln -sf /etc/nginx/sites-available/coolify.conf /etc/nginx/sites-enabled/coolify.conf",
               "Activating new Nginx configuration")

    # 4. Final Reload
    run_remote(ssh_base, "sudo nginx -t && sudo systemctl restart nginx", "Restarting Nginx")

    print_colored("\n✅ Infrastructure Cleanup & Nginx Deployment Complete!", Colors.GREEN)
    print_colored(f"Target URL: http://eob.{args.host}.sslip.io", Colors.CYAN)

if __name__ == "__main__":
    main()