#!/usr/bin/env python3
"""
Edwards Engineering Management - Build & Compress Script (Cross-Platform)
윈도우(PowerShell)와 리눅스(WSL)를 모두 지원하도록 최적화된 빌드 스크립트
"""

import os
import sys
import shutil
import subprocess
import tarfile
import gzip
from pathlib import Path
from datetime import datetime
import platform

class Colors:
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    RED = '\033[31m'
    RESET = '\033[0m'

    # Windows terminal support for colors
    if platform.system() == 'Windows':
        os.system('')

def print_colored(message, color=''):
    print(f"{color}{message}{Colors.RESET}")

def print_header(title):
    print_colored("=" * 70, Colors.CYAN)
    print_colored(title.center(70), Colors.CYAN)
    print_colored("=" * 70, Colors.CYAN)
    print()

def print_info(message):
    print_colored(f"[INFO] {message}", Colors.GREEN)

def print_warn(message):
    print_colored(f"[WARN] {message}", Colors.YELLOW)

def print_error(message):
    print_colored(f"[ERROR] {message}", Colors.RED)

def print_step(message):
    print_colored(f"\n>>> {message}", Colors.CYAN)

def run_command(args, cwd=None, shell=False):
    """Run a subprocess command and handle cross-platform issues"""
    # Windows requires shell=True for some commands like 'pnpm' or batch files
    if platform.system() == 'Windows':
        shell = True
    
    try:
        return subprocess.run(
            args,
            cwd=str(cwd) if cwd else None,
            check=True,
            capture_output=True,
            shell=shell
        )
    except subprocess.CalledProcessError as e:
        # Avoid character encoding issues in logs
        stdout = e.stdout.decode(errors='replace') if e.stdout else ""
        stderr = e.stderr.decode(errors='replace') if e.stderr else ""
        if stdout:
            print_colored(f"STDOUT:\n{stdout}", Colors.YELLOW)
        if stderr:
            print_colored(f"STDERR:\n{stderr}", Colors.RED)
        raise e

def check_prerequisites():
    """Check if required tools are available"""
    print_info("Checking prerequisites...")
    
    # Check for docker
    if shutil.which('docker') or shutil.which('docker.exe'):
        print_colored("  * docker", Colors.GREEN)
    else:
        print_error("docker is required but not installed.")
        sys.exit(1)

    # Check for docker-compose
    if shutil.which('docker-compose') or shutil.which('docker-compose.exe'):
        print_colored("  * docker-compose", Colors.GREEN)
    else:
        print_error("docker-compose is required but not installed.")
        sys.exit(1)
    
    print_info("Prerequisites OK")
    print()

def create_build_directory():
    """Create and return build directory path"""
    print_step("Creating build directory")
    build_dir = Path('./build_output')
    
    if build_dir.exists():
        print_info(f"Removing existing build directory...")
        try:
            shutil.rmtree(build_dir)
        except Exception as e:
            # Handle Windows directory lock issues
            print_warn(f"Failed to fully remove old build directory: {e}")
            print_info("Attempting to proceed anyway...")
    
    build_dir.mkdir(parents=True, exist_ok=True)
    print_info(f"Build directory: {build_dir.absolute()}")
    
    return build_dir

def copy_project_files(build_dir):
    """Copy project files excluding unnecessary ones"""
    print_step("Copying project files")
    
    project_dir = build_dir / 'edwards_project'
    project_dir.mkdir(exist_ok=True)
    
    exclude_patterns = {
        '.git', '.github', '.venv', '.mypy_cache', 'node_modules', 
        '.next', '__pycache__', '.pytest_cache', 'dist', 'build', 
        '.DS_Store', 'backup', 'backups', 'build_output', '.env'
    }
    
    current_dir = Path('.')
    
    # Using more robust copy logic for Windows
    for item in current_dir.iterdir():
        if item.name in exclude_patterns or item.name == 'build_output':
            continue
            
        if item.is_dir():
            dest = project_dir / item.name
            shutil.copytree(item, dest, ignore=shutil.ignore_patterns(*exclude_patterns), dirs_exist_ok=True)
        else:
            shutil.copy2(item, project_dir / item.name)
    
    print_info(f"Copied base project structure")
    return project_dir

def build_backend(project_dir):
    """Build backend with Python dependencies"""
    print_step("Building backend")
    
    backend_dir = project_dir / 'backend'
    
    if not backend_dir.exists():
        print_error("Backend directory not found")
        return False
    
    try:
        # Create virtual environment
        print_info("Creating Python virtual environment...")
        venv_dir = backend_dir / '.venv'
        run_command([sys.executable, '-m', 'venv', str(venv_dir)])
        
        # Get python/pip executable in venv
        if platform.system() == 'Windows':
            python_exe = venv_dir / 'Scripts' / 'python.exe'
        else:
            python_exe = venv_dir / 'bin' / 'python'
        
        # Upgrade pip and install requirements
        print_info("Upgrading pip and installing dependencies...")
        run_command([str(python_exe), '-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel'])
        
        requirements_file = backend_dir / 'requirements.txt'
        if requirements_file.exists():
            run_command([str(python_exe), '-m', 'pip', 'install', '-r', str(requirements_file)])
        
        print_info("Backend build complete")
        return True
        
    except Exception as e:
        print_error(f"Backend build failed: {e}")
        return False

def build_frontend(project_dir):
    """Build frontend with pnpm"""
    print_step("Building frontend")
    
    frontend_dir = project_dir / 'frontend'
    
    if not frontend_dir.exists():
        print_error("Frontend directory not found")
        return False
    
    try:
        # Install dependencies
        print_info("Installing frontend dependencies...")
        run_command(['pnpm', 'install'], cwd=frontend_dir)
        
        # Build
        print_info("Building frontend bundle...")
        run_command(['pnpm', 'build'], cwd=frontend_dir)
        
        print_info("Frontend build complete")
        return True
        
    except Exception as e:
        print_error(f"Frontend build failed: {e}")
        return False

def build_docker_images(project_dir):
    """Build Docker images locally"""
    print_step("Building Docker images")
    
    try:
        # Ensure .env exists to satisfy docker-compose interpolation
        env_example = project_dir / '.env.example'
        env_file = project_dir / '.env'
        if not env_file.exists() and env_example.exists():
            print_info("Creating temporary .env for Docker build...")
            shutil.copy2(env_example, env_file)

        # Build backend image
        print_info("Building backend Docker image...")
        run_command(['docker-compose', 'build', 'backend'], cwd=project_dir)
        print_colored("  * Backend image built", Colors.GREEN)
        
        # Build frontend image
        print_info("Building frontend Docker image...")
        run_command(['docker-compose', 'build', 'frontend'], cwd=project_dir)
        print_colored("  * Frontend image built", Colors.GREEN)
        
        return True
        
    except Exception as e:
        print_error(f"Docker build failed: {e}")
        return False

def export_docker_images(project_dir):
    """Export Docker images to tar files"""
    print_step("Exporting Docker images")
    
    images_dir = project_dir / 'docker_images'
    images_dir.mkdir(parents=True, exist_ok=True)
    
    images_to_export = [
        ('edwards_project-backend:latest', 'edwards-backend.tar'),
        ('edwards_project-frontend:latest', 'edwards-frontend.tar'),
        ('postgres:15', 'postgres-15.tar'),
    ]
    
    for image_name, file_name in images_to_export:
        try:
            print_info(f"Exporting {image_name}...")
            
            # Use -o flag for better reliability on Windows
            export_path = images_dir / file_name
            run_command(['docker', 'save', image_name, '-o', str(export_path)])
            
            size_mb = export_path.stat().st_size / (1024 * 1024)
            print_colored(f"  * {file_name} ({size_mb:.1f}MB)", Colors.GREEN)
            
        except Exception as e:
            print_warn(f"Failed to export {image_name}: {e}")
    
    return images_dir

def create_deployment_scripts(project_dir, images_dir):
    """Create deployment helper scripts (Cross-Platform)"""
    print_step("Creating deployment helper scripts")
    
    # load_images.sh (Linux/Mac)
    sh_content = '''#!/bin/bash
set -e
echo "Loading Docker images..."
cd "$(dirname "$0")"
for f in postgres-15.* edwards-backend.* edwards-frontend.*; do
    if [ -f "$f" ]; then
        echo "Loading $f..."
        docker load < "$f"
    fi
done
echo "Success!"
'''
    # Specifying encoding='utf-8' to avoid CP949 errors on Windows
    with open(images_dir / 'load_images.sh', 'w', encoding='utf-8') as f:
        f.write(sh_content)
        
    if platform.system() != 'Windows':
        os.chmod(images_dir / 'load_images.sh', 0o755)

    # load_images.ps1 (Windows)
    ps1_content = '''# Load Docker images on Windows
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir
Write-Host "Loading Docker images..."
Get-Item "postgres-15.*", "edwards-backend.*", "edwards-frontend.*" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Loading $($_.Name)..."
    docker load -i $_.FullName
}
Write-Host "Success!"
'''
    with open(images_dir / 'load_images.ps1', 'w', encoding='utf-8') as f:
        f.write(ps1_content)
        
    print_info("Generated deployment scripts (sh/ps1)")

def create_archive(build_dir, project_dir):
    """Create final archive"""
    print_step("Creating compressed archive")
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    archive_name = f"edwards_project_{timestamp}.tar.gz"
    archive_path = build_dir / archive_name
    
    print_info(f"Compressing project to {archive_name}...")
    
    try:
        with tarfile.open(archive_path, 'w:gz') as tar:
            tar.add(project_dir, arcname='edwards_project')
        
        size_mb = archive_path.stat().st_size / (1024 * 1024)
        print_info(f"Archive created! Size: {size_mb:.1f}MB")
        return archive_path
    except Exception as e:
        print_error(f"Archive creation failed: {e}")
        return None

def main():
    print_header("Edwards Engineering Management - Build & Compress")
    
    try:
        check_prerequisites()
        build_dir = create_build_directory()
        project_dir = copy_project_files(build_dir)
        
        if not build_backend(project_dir):
            print_warn("Backend build had issues, continuing...")
            
        if not build_frontend(project_dir):
            print_warn("Frontend build had issues, continuing...")
            
        if not build_docker_images(project_dir):
            print_warn("Docker build had issues, continuing...")
            
        images_dir = export_docker_images(project_dir)
        create_deployment_scripts(project_dir, images_dir)
        
        # Remove temporary .env used for build
        temp_env = project_dir / '.env'
        if temp_env.exists():
            temp_env.unlink()
            
        archive_path = create_archive(build_dir, project_dir)
        
        print_header("Build Successful!")
        if archive_path:
            print_info(f"Location: {archive_path.absolute()}")
            print_info("You can now transfer this file to your VM server.")
            
    except Exception as e:
        print_error(f"Build failed with unexpected error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
