#!/usr/bin/env python3
"""
Edwards Engineering Management - Build & Compress Script
프로젝트를 완전히 빌드하고 압축하여 SCP 전송 가능하게 준비
"""

import os
import sys
import shutil
import subprocess
import tarfile
import gzip
from pathlib import Path
from datetime import datetime
import json


class Colors:
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    RED = '\033[31m'
    RESET = '\033[0m'


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


def check_prerequisites():
    """Check if required tools are available"""
    print_info("Checking prerequisites...")
    
    required_tools = ['docker', 'docker-compose']
    
    for tool in required_tools:
        try:
            subprocess.run(['which', tool], capture_output=True, check=True)
            print_colored(f"  ✓ {tool}", Colors.GREEN)
        except subprocess.CalledProcessError:
            print_error(f"{tool} is required but not installed.")
            sys.exit(1)
    
    print_info("Prerequisites OK")
    print()


def create_build_directory():
    """Create and return build directory path"""
    print_step("Creating build directory")
    build_dir = Path('./build_output')
    
    if build_dir.exists():
        print_info(f"Removing existing build directory...")
        shutil.rmtree(build_dir)
    
    build_dir.mkdir(parents=True, exist_ok=True)
    print_info(f"Build directory: {build_dir.absolute()}")
    
    return build_dir


def copy_project_files(build_dir):
    """Copy project files excluding unnecessary ones"""
    print_step("Copying project files")
    
    project_dir = build_dir / 'edwards_project'
    project_dir.mkdir(exist_ok=True)
    
    exclude_patterns = {
        '.git',
        '.github',
        '.venv',
        '.mypy_cache',
        'node_modules',
        '.next',
        '__pycache__',
        '.pytest_cache',
        'dist',
        'build',
        '.DS_Store',
        'backup',
        'backups',
        'build_output',
        '.env'
    }
    
    def should_exclude(path):
        for pattern in exclude_patterns:
            if pattern in path.parts:
                return True
            if path.name == pattern:
                return True
        return False
    
    current_dir = Path('.')
    copied_count = 0
    
    for item in current_dir.rglob('*'):
        if should_exclude(item):
            continue
        
        rel_path = item.relative_to(current_dir)
        dest_path = project_dir / rel_path
        
        try:
            if item.is_dir():
                dest_path.mkdir(parents=True, exist_ok=True)
            else:
                dest_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item, dest_path)
                copied_count += 1
        except Exception as e:
            print_warn(f"Skipping {rel_path}: {e}")
    
    print_info(f"Copied {copied_count} files")
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
        subprocess.run(
            [sys.executable, '-m', 'venv', str(venv_dir)],
            check=True,
            capture_output=True
        )
        
        # Get python executable in venv
        if os.name == 'nt':
            python_exe = venv_dir / 'Scripts' / 'python.exe'
            pip_exe = venv_dir / 'Scripts' / 'pip.exe'
        else:
            python_exe = venv_dir / 'bin' / 'python'
            pip_exe = venv_dir / 'bin' / 'pip'
        
        # Upgrade pip
        print_info("Upgrading pip...")
        subprocess.run(
            [str(pip_exe), 'install', '--upgrade', 'pip', 'setuptools', 'wheel'],
            check=True,
            capture_output=True
        )
        
        # Install requirements
        requirements_file = backend_dir / 'requirements.txt'
        if requirements_file.exists():
            print_info("Installing Python dependencies...")
            subprocess.run(
                [str(pip_exe), 'install', '-r', str(requirements_file)],
                check=True,
                capture_output=True
            )
        
        print_info("Backend build complete")
        return True
        
    except subprocess.CalledProcessError as e:
        print_error(f"Backend build failed: {e}")
        return False


def build_frontend(project_dir):
    """Build frontend with npm/pnpm"""
    print_step("Building frontend")
    
    frontend_dir = project_dir / 'frontend'
    
    if not frontend_dir.exists():
        print_error("Frontend directory not found")
        return False
    
    try:
        # Check for pnpm
        try:
            subprocess.run(['which', 'pnpm'], capture_output=True, check=True)
        except subprocess.CalledProcessError:
            print_info("Installing pnpm globally...")
            subprocess.run(
                ['npm', 'install', '-g', 'pnpm'],
                check=True,
                capture_output=True
            )
        
        # Install dependencies
        print_info("Installing frontend dependencies...")
        subprocess.run(
            ['pnpm', 'install'],
            cwd=str(frontend_dir),
            check=True,
            capture_output=True
        )
        
        # Build
        print_info("Building frontend bundle...")
        subprocess.run(
            ['pnpm', 'build'],
            cwd=str(frontend_dir),
            check=True,
            capture_output=True
        )
        
        print_info("Frontend build complete")
        return True
        
    except subprocess.CalledProcessError as e:
        print_error(f"Frontend build failed: {e}")
        return False


def build_docker_images(project_dir):
    """Build Docker images locally"""
    print_step("Building Docker images")
    
    docker_compose_file = project_dir / 'docker-compose.yml'
    if not docker_compose_file.exists():
        print_error("docker-compose.yml not found")
        return False
    
    try:
        os.chdir(str(project_dir))
        
        # Build backend image
        print_info("Building backend Docker image...")
        subprocess.run(
            ['docker-compose', 'build', 'backend', '--no-cache'],
            check=True,
            capture_output=True
        )
        print_colored("  ✓ Backend image built", Colors.GREEN)
        
        # Build frontend image
        print_info("Building frontend Docker image...")
        subprocess.run(
            ['docker-compose', 'build', 'frontend', '--no-cache'],
            check=True,
            capture_output=True
        )
        print_colored("  ✓ Frontend image built", Colors.GREEN)
        
        os.chdir('..')
        return True
        
    except subprocess.CalledProcessError as e:
        print_error(f"Docker build failed: {e}")
        return False
    finally:
        os.chdir('../..')


def export_docker_images(project_dir):
    """Export Docker images to tar.gz files"""
    print_step("Exporting Docker images")
    
    images_dir = project_dir / 'docker_images'
    images_dir.mkdir(parents=True, exist_ok=True)
    
    images_to_export = [
        ('edwards_project-backend:latest', 'edwards-backend.tar.gz'),
        ('edwards_project-frontend:latest', 'edwards-frontend.tar.gz'),
        ('postgres:16', 'postgres-16.tar.gz'),
    ]
    
    for image_name, file_name in images_to_export:
        try:
            print_info(f"Exporting {image_name}...")
            
            # Check if image exists
            result = subprocess.run(
                ['docker', 'image', 'inspect', image_name],
                capture_output=True
            )
            
            if result.returncode != 0:
                print_warn(f"Image {image_name} not found, skipping...")
                continue
            
            export_path = images_dir / file_name
            
            # Save image
            with open(export_path, 'wb') as f:
                proc = subprocess.Popen(
                    ['docker', 'save', image_name],
                    stdout=subprocess.PIPE
                )
                
                with gzip.open(f, 'wb') as gz:
                    for chunk in iter(lambda: proc.stdout.read(8192), b''):
                        gz.write(chunk)
                
                proc.wait()
            
            size_mb = export_path.stat().st_size / (1024 * 1024)
            print_colored(f"  ✓ {file_name} ({size_mb:.1f}MB)", Colors.GREEN)
            
        except Exception as e:
            print_error(f"Failed to export {image_name}: {e}")
    
    return images_dir


def create_deployment_scripts(project_dir, images_dir):
    """Create deployment helper scripts"""
    print_step("Creating deployment helper scripts")
    
    # Create load_images.sh
    load_images_content = '''#!/bin/bash
set -e

echo "Loading Docker images..."

cd "$(dirname "$0")"

echo "[1/3] Loading PostgreSQL image..."
if [ -f postgres-16.tar.gz ]; then
    docker load < postgres-16.tar.gz
else
    echo "  ⚠ postgres-16.tar.gz not found, skipping..."
fi

echo "[2/3] Loading backend image..."
if [ -f edwards-backend.tar.gz ]; then
    docker load < edwards-backend.tar.gz
else
    echo "  ⚠ edwards-backend.tar.gz not found, skipping..."
fi

echo "[3/3] Loading frontend image..."
if [ -f edwards-frontend.tar.gz ]; then
    docker load < edwards-frontend.tar.gz
else
    echo "  ⚠ edwards-frontend.tar.gz not found, skipping..."
fi

echo "✓ All available images loaded successfully!"
echo "You can now run: docker-compose up -d"
'''
    
    load_images_path = images_dir / 'load_images.sh'
    load_images_path.write_text(load_images_content)
    os.chmod(load_images_path, 0o755)
    print_colored("  ✓ load_images.sh created", Colors.GREEN)
    
    # Create load_images.ps1 for Windows
    load_images_ps1_content = '''# Load Docker images on Windows
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "Loading Docker images..."

Write-Host "[1/3] Loading PostgreSQL image..."
if (Test-Path "postgres-16.tar.gz") {
    docker load -i postgres-16.tar.gz
} else {
    Write-Host "  ⚠ postgres-16.tar.gz not found, skipping..."
}

Write-Host "[2/3] Loading backend image..."
if (Test-Path "edwards-backend.tar.gz") {
    docker load -i edwards-backend.tar.gz
} else {
    Write-Host "  ⚠ edwards-backend.tar.gz not found, skipping..."
}

Write-Host "[3/3] Loading frontend image..."
if (Test-Path "edwards-frontend.tar.gz") {
    docker load -i edwards-frontend.tar.gz
} else {
    Write-Host "  ⚠ edwards-frontend.tar.gz not found, skipping..."
}

Write-Host "✓ All available images loaded successfully!"
Write-Host "You can now run: docker-compose up -d"
'''
    
    load_images_ps1_path = images_dir / 'load_images.ps1'
    load_images_ps1_path.write_text(load_images_ps1_content)
    print_colored("  ✓ load_images.ps1 created", Colors.GREEN)
    
    # Create DEPLOY_ON_VM.md
    deploy_guide = '''# VM Server Deployment Guide

## Prerequisites
- Docker and Docker Compose installed on VM
- 15GB+ free disk space (including extracted files)
- Python 3.12+ (for backend)
- sudo/root access for Docker commands

## Deployment Steps

### Step 1: Transfer files to VM
```bash
scp -r edwards_project_*.tar.gz user@vm_ip:/path/to/deployment/
```

### Step 2: SSH into VM and extract
```bash
ssh user@vm_ip
cd /path/to/deployment/
tar -xzf edwards_project_*.tar.gz
cd edwards_project
```

### Step 3: Load Docker images
```bash
cd docker_images

# On Linux/Mac:
./load_images.sh

# On Windows (PowerShell):
.\\load_images.ps1
```

### Step 4: Configure environment
```bash
cp .env.example .env
# Edit .env with appropriate settings for VM
# Important: Update DATABASE_URL, BACKEND_PORT, FRONTEND_PORT, SECRET_KEY
nano .env
```

### Step 5: Start services
```bash
docker-compose up -d
```

### Step 6: Verify services are running
```bash
docker-compose ps
```

### Step 7: Initialize database (if needed)
```bash
docker-compose exec -T db psql -U postgres -d edwards < /path/to/backup.sql
```

### Step 8: Access application
- Frontend: http://vm_ip:3004
- Backend API: http://vm_ip:8004/api/docs
- Default login: admin@edwards.com / password

## Troubleshooting

### Check service logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Restart services
```bash
docker-compose restart
```

### Stop services
```bash
docker-compose down
```

### Remove containers and restart (fresh start)
```bash
docker-compose down -v
docker-compose up -d
```

### Check disk space
```bash
df -h
```

### Verify Docker images are loaded
```bash
docker images | grep -E "edwards|postgres"
```

## Important Notes
- Archive is self-contained (no external image pulls needed)
- Adjust .env for VM network/database settings
- Ensure sufficient disk space on VM before extraction
- Backend will use pre-installed venv (no need to install again)
- Frontend dist/ is pre-built (nginx will serve static files)
- First start may take a few minutes as containers initialize

## Restoring from Database Backup
If you have a database backup:
```bash
# Copy backup file to VM
scp backup_file.sql user@vm_ip:/path/to/edwards_project/

# Restore from backup
docker-compose exec -T db psql -U postgres -d edwards < backup_file.sql
```

## Common Issues

### Port already in use
Edit .env and change FRONTEND_PORT and BACKEND_PORT to available ports

### Permission denied on load_images.sh
```bash
chmod +x docker_images/load_images.sh
```

### Docker daemon not running
```bash
sudo service docker start
# or on systemd systems:
sudo systemctl start docker
```

### Out of disk space
- Check available space: `df -h`
- Remove old archives: `rm edwards_project_*.tar.gz`
- Clean Docker: `docker system prune`
'''
    
    deploy_guide_path = project_dir / 'DEPLOY_ON_VM.md'
    deploy_guide_path.write_text(deploy_guide)
    print_colored("  ✓ DEPLOY_ON_VM.md created", Colors.GREEN)


def create_archive(build_dir, project_dir):
    """Create compressed tar.gz archive"""
    print_step("Creating compressed archive")
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    archive_name = f"edwards_project_{timestamp}.tar.gz"
    archive_path = build_dir / archive_name
    
    print_info(f"Compressing project to {archive_name}...")
    
    try:
        with tarfile.open(archive_path, 'w:gz') as tar:
            tar.add(project_dir, arcname='edwards_project')
        
        size_mb = archive_path.stat().st_size / (1024 * 1024)
        print_colored(f"  ✓ Archive created: {archive_name}", Colors.GREEN)
        print_colored(f"  ✓ Size: {size_mb:.1f}MB", Colors.GREEN)
        
        return archive_path
        
    except Exception as e:
        print_error(f"Failed to create archive: {e}")
        return None


def generate_summary(build_dir, archive_path):
    """Generate and display summary"""
    print_header("Build Complete!")
    
    if archive_path and archive_path.exists():
        size_mb = archive_path.stat().st_size / (1024 * 1024)
        
        summary = f"""
📦 Archive Details:
  Name: {archive_path.name}
  Location: {archive_path.absolute()}
  Size: {size_mb:.1f}MB

📋 Included in Archive:
  ✓ Source code (backend + frontend)
  ✓ Docker images (postgres, backend, frontend)
  ✓ Python dependencies (backend .venv)
  ✓ Node dependencies (frontend node_modules)
  ✓ Frontend build dist/
  ✓ Configuration files (.env.example, docker-compose.yml)
  ✓ Database backup files (if available)
  ✓ Deployment scripts (load_images.sh, DEPLOY_ON_VM.md)

🚀 Next Steps (VM Server):
  1. Transfer to VM:
     scp {archive_path.name} user@vm_ip:/path/to/destination/

  2. Extract on VM:
     cd /path/to/destination/
     tar -xzf {archive_path.name}

  3. Load Docker images:
     cd edwards_project/docker_images/
     ./load_images.sh        # Linux/Mac
     .\\load_images.ps1      # Windows PowerShell

  4. Configure and start:
     cd ..
     cp .env.example .env
     # Edit .env for your VM settings
     docker-compose up -d

⚠️  Important:
  - Archive is self-contained (no external image pulls needed)
  - Adjust .env for VM network/database settings
  - Ensure sufficient disk space on VM (at least 15GB)
  - Run with Docker daemon available
  - Backend venv is pre-built (won't need reinstall)
  - Frontend is pre-built (nginx serves dist/)

📂 Build directory preserved at:
  {build_dir.absolute()}
"""
        print(summary)
    else:
        print_error("Archive was not created successfully")


def main():
    """Main execution"""
    print_header("Edwards Engineering Management - Build & Compress")
    
    try:
        # Check prerequisites
        check_prerequisites()
        
        # Create build directory
        build_dir = create_build_directory()
        
        # Copy project files
        project_dir = copy_project_files(build_dir)
        
        # Build backend
        if not build_backend(project_dir):
            print_warn("Backend build encountered issues, continuing...")
        
        # Build frontend
        if not build_frontend(project_dir):
            print_warn("Frontend build encountered issues, continuing...")
        
        # Build Docker images
        if not build_docker_images(project_dir):
            print_warn("Docker images build encountered issues, continuing...")
        
        # Export Docker images
        images_dir = export_docker_images(project_dir)
        
        # Create deployment scripts
        create_deployment_scripts(project_dir, images_dir)
        
        # Create archive
        archive_path = create_archive(build_dir, project_dir)
        
        # Generate summary
        generate_summary(build_dir, archive_path)
        
        print_info("Build and compress completed successfully!")
        
    except KeyboardInterrupt:
        print()
        print_warn("Build cancelled by user")
        sys.exit(0)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
