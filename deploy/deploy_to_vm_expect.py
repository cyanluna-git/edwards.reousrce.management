#!/usr/bin/env python3
"""
배포 스크립트 - expect를 사용한 SSH/SCP 자동화
"""

import os
import sys
import subprocess
import time
from pathlib import Path

def load_env():
    """환경변수 로드"""
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

def create_expect_script(vm_user, vm_ip, vm_password, archive_path, archive_name):
    """expect 스크립트 생성"""
    
    expect_script = f'''#!/usr/bin/expect -f
set timeout 300
set vm_user "{vm_user}"
set vm_ip "{vm_ip}"
set vm_pass "{vm_password}"
set local_file "{archive_path}"
set archive_name "{archive_name}"

puts "\\n🔄 \[1/2\] SCP로 파일 전송 중..."
spawn scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$local_file" $vm_user@$vm_ip:/tmp/
expect {{
    "password:" {{
        send "$vm_pass\\r"
        expect eof
    }}
    eof
}}

puts "\\n✅ 파일 전송 완료"

puts "\\n🔄 \[2/2\] VM에서 배포 실행 중..."
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $vm_user@$vm_ip

expect {{
    "password:" {{
        send "$vm_pass\\r"
        expect "$vm_user@*" {{
            send "cd /data/eob && echo '기존 컨테이너 중지...' && docker-compose down 2>/dev/null || true\\r"
            expect "$vm_user@*"
            
            send "echo '파일 추출 중...' && tar -xzf /tmp/$archive_name\\r"
            expect "$vm_user@*"
            
            send "echo '이미지 로드 중...' && cd edwards_project/docker_images && chmod +x load_images.sh && ./load_images.sh\\r"
            expect "$vm_user@*" {{
                timeout 180
            }}
            
            send "echo '서비스 시작 중...' && cd .. && docker-compose up -d\\r"
            expect "$vm_user@*"
            
            send "echo '상태 확인...' && docker-compose ps\\r"
            expect "$vm_user@*"
            
            send "echo '✅ 배포 완료!' && exit\\r"
            expect eof
        }}
    }}
    eof
}}

puts "\\n🎉 배포 성공!"
'''
    
    return expect_script

def deploy():
    """배포 진행"""
    print("=" * 70)
    print("Edwards Project VM 배포".center(70))
    print("=" * 70)
    
    env = load_env()
    vm_ip = env.get('VM_IP')
    vm_user = env.get('VM_USER')
    vm_password = env.get('VM_PASSWORD')
    
    if not all([vm_ip, vm_user, vm_password]):
        print("❌ .env.vm에 필수 정보가 없습니다.")
        sys.exit(1)
    
    archive_path = find_latest_archive()
    archive_name = archive_path.name
    file_size_mb = archive_path.stat().st_size / (1024 * 1024)
    
    print(f"\n📦 압축 파일: {archive_name}")
    print(f"   크기: {file_size_mb:.1f}MB")
    print(f"   VM: {vm_user}@{vm_ip}")
    print()
    
    # expect 스크립트 생성
    expect_script = create_expect_script(vm_user, vm_ip, vm_password, str(archive_path), archive_name)
    expect_file = Path('/tmp/deploy.expect')
    expect_file.write_text(expect_script)
    os.chmod(expect_file, 0o755)
    
    # expect 설치 확인
    result = subprocess.run(['which', 'expect'], capture_output=True)
    if result.returncode != 0:
        print("❌ expect를 설치해야 합니다.")
        print("   Ubuntu/Debian: sudo apt-get install expect")
        print("   CentOS/RHEL: sudo yum install expect")
        sys.exit(1)
    
    # expect 스크립트 실행
    print("배포 진행 중...\n")
    start_time = time.time()
    
    result = subprocess.run([str(expect_file)], capture_output=False, text=True)
    elapsed = time.time() - start_time
    
    # 정리
    expect_file.unlink()
    
    if result.returncode == 0:
        print("\n" + "=" * 70)
        print("배포 완료 요약".center(70))
        print("=" * 70)
        print(f"""
📦 배포 정보:
   압축 파일: {archive_name}
   크기: {file_size_mb:.1f}MB
   소요 시간: {elapsed:.1f}초
   VM: {vm_user}@{vm_ip}
   배포 경로: /data/eob/edwards_project

🔗 접근 URL:
   Frontend: http://eob.10.182.252.32.sslip.io
   Backend API: http://eob.10.182.252.32.sslip.io/api/docs

⚠️ 다음 단계 (DB 복원 필요):
   1. SSH 접속:
      ssh {vm_user}@{vm_ip}
   
   2. 데이터베이스 복원:
      cd /data/eob/edwards_project
      docker-compose exec -T db psql -U postgres -d edwards < /path/to/backup.sql
   
   3. 서비스 상태 확인:
      docker-compose ps
      docker-compose logs -f

📝 참고:
   - 백업 파일을 VM에 먼저 전송해야 합니다.
   - POSTGRES_PASSWORD 등 환경변수는 .env 파일에서 설정하세요.
""")
        print("=" * 70)
    else:
        print("\n❌ 배포 실패")
        sys.exit(1)

if __name__ == '__main__':
    try:
        deploy()
    except KeyboardInterrupt:
        print("\n\n⚠️ 배포 중단됨")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ 오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
