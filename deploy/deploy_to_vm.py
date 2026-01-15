#!/usr/bin/env python3
"""
배포 자동화 스크립트 - VM 서버에 파일 전송 및 배포
"""

import os
import sys
import subprocess
import time
from pathlib import Path
from datetime import datetime

# 환경변수 로드
def load_env():
    env_file = Path('.env.vm')
    if not env_file.exists():
        print("❌ .env.vm 파일을 찾을 수 없습니다.")
        sys.exit(1)
    
    env = {}
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                key, value = line.split('=', 1)
                env[key] = value
    
    return env

def find_latest_archive():
    """최신 압축 파일 찾기"""
    build_dir = Path('build_output')
    if not build_dir.exists():
        print("❌ build_output 디렉토리가 없습니다.")
        sys.exit(1)
    
    archives = sorted(build_dir.glob('edwards_project_*.tar.gz'), reverse=True)
    if not archives:
        print("❌ 압축 파일을 찾을 수 없습니다.")
        sys.exit(1)
    
    return archives[0]

def run_command(cmd, description=""):
    """명령어 실행"""
    if description:
        print(f"\n🔄 {description}")
    print(f"   명령어: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    
    try:
        if isinstance(cmd, str):
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        else:
            result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"❌ 실패: {result.stderr}")
            return False
        
        if result.stdout:
            print(f"✅ {result.stdout.strip()}")
        return True
    except Exception as e:
        print(f"❌ 오류: {e}")
        return False

def deploy():
    """배포 진행"""
    print("=" * 70)
    print("Edwards Project VM 배포".center(70))
    print("=" * 70)
    
    # 환경변수 로드
    env = load_env()
    vm_ip = env.get('VM_IP')
    vm_user = env.get('VM_USER')
    vm_password = env.get('VM_PASSWORD')
    
    if not all([vm_ip, vm_user, vm_password]):
        print("❌ .env.vm 파일에 VM_IP, VM_USER, VM_PASSWORD가 필요합니다.")
        sys.exit(1)
    
    # 최신 아카이브 찾기
    archive_path = find_latest_archive()
    archive_name = archive_path.name
    file_size_mb = archive_path.stat().st_size / (1024 * 1024)
    
    print(f"\n📦 압축 파일: {archive_name}")
    print(f"   크기: {file_size_mb:.1f}MB")
    print(f"   VM: {vm_user}@{vm_ip}")
    print()
    
    # 배포 경로
    remote_path = "/data/eob"
    
    # 1. SCP로 파일 전송
    print("\n[1/5] 파일을 VM에 전송 중...")
    scp_cmd = f'sshpass -p "{vm_password}" scp -o StrictHostKeyChecking=no "{archive_path}" {vm_user}@{vm_ip}:/tmp/'
    
    start_time = time.time()
    if not run_command(scp_cmd, "SCP 전송"):
        print("❌ 파일 전송 실패")
        sys.exit(1)
    
    elapsed = time.time() - start_time
    speed = file_size_mb / elapsed if elapsed > 0 else 0
    print(f"✅ 전송 완료 ({speed:.1f}MB/s, {elapsed:.1f}초)")
    
    # 2. SSH로 추출 및 배포 명령 실행
    print("\n[2/5] VM에서 파일 추출 중...")
    
    deploy_commands = f'''
set -e
cd {remote_path}

# 기존 컨테이너 중지
echo "기존 컨테이너 중지 중..."
docker-compose down 2>/dev/null || true

# 파일 추출
echo "파일 추출 중..."
tar -xzf /tmp/{archive_name}

# Docker 이미지 로드
echo "Docker 이미지 로드 중..."
cd edwards_project/docker_images
./load_images.sh

# 서비스 시작
echo "서비스 시작 중..."
cd ..
docker-compose up -d

# 상태 확인
echo "배포 상태 확인..."
docker-compose ps

echo "✅ 배포 완료!"
'''
    
    ssh_cmd = f'sshpass -p "{vm_password}" ssh -o StrictHostKeyChecking=no {vm_user}@{vm_ip} "{deploy_commands}"'
    
    if not run_command(ssh_cmd, "VM에서 배포 실행"):
        print("❌ 배포 실행 실패")
        sys.exit(1)
    
    print("✅ VM 배포 완료!")
    
    # 배포 후 정보
    print("\n" + "=" * 70)
    print("배포 완료 요약".center(70))
    print("=" * 70)
    print(f"""
📦 배포 정보:
   압축 파일: {archive_name}
   VM: {vm_user}@{vm_ip}
   배포 경로: {remote_path}/edwards_project

🔗 접근 URL:
   Frontend: http://eob.10.182.252.32.sslip.io
   Backend API: http://eob.10.182.252.32.sslip.io/api/docs
   
⚠️ 다음 단계:
   1. 데이터베이스 복원 (백업 파일이 있는 경우):
      docker-compose exec -T db psql -U postgres -d edwards < backup_file.sql
   
   2. 서비스 상태 확인:
      docker-compose ps
      docker-compose logs -f

   3. SSH 접속:
      ssh {vm_user}@{vm_ip}
""")
    
    print("=" * 70)

if __name__ == '__main__':
    try:
        deploy()
    except KeyboardInterrupt:
        print("\n\n⚠️ 배포 중단됨")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
