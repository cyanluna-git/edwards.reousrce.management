# 🚀 배포 체크리스트

## 사전 준비 ✅

- [x] 빌드 완료: `edwards_project_20260115_111412.tar.gz` (87.5MB)
- [x] build_and_compress.py 수정 완료 (postgres:15로 통일)
- [x] docker-compose.yml 컨테이너 이름 변경 완료
- [x] 배포 스크립트 3개 준비됨
  - [x] deploy_to_vm.ps1 (PowerShell 자동)
  - [x] deploy_to_vm_expect.py (Linux/Mac 자동)
  - [x] VM_DEPLOYMENT_MANUAL.md (수동 가이드)

## 배포 전 체크 📋

### 로컬 환경
- [ ] .env.vm 파일 확인 (VM_IP, VM_USER, VM_PASSWORD)
- [ ] build_output/ 디렉토리에 압축 파일 있음
- [ ] SSH/SCP 클라이언트 설치됨
- [ ] 로컬 디스크 여유 공간 확인

### 대상 서버 (10.182.252.32)
- [ ] VM 서버 접근 가능 (ping 확인)
- [ ] SSH 접속 가능 (ssh atlasAdmin@10.182.252.32)
- [ ] Docker 설치됨 (docker --version)
- [ ] Docker Compose 설치됨 (docker-compose --version)
- [ ] /data/eob 디렉토리 있음
- [ ] 디스크 여유 공간 충분 (최소 15GB)

## 배포 실행 🚀

### 방법 1: PowerShell 자동 배포 (권장)

```
[ ] Step 1: PowerShell 관리자 실행
[ ] Step 2: 현재 디렉토리 이동
    cd D:\00.Dev\7.myApplication\engineering.resource.management
[ ] Step 3: 실행 정책 설정
    Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
[ ] Step 4: 배포 스크립트 실행
    .\deploy_to_vm.ps1
[ ] Step 5: 완료 대기 (5-10분)
```

### 방법 2: 수동 배포

```
[ ] Step 1: 파일 전송
    scp build_output\edwards_project_*.tar.gz atlasAdmin@10.182.252.32:/tmp/
[ ] Step 2: VM 접속
    ssh atlasAdmin@10.182.252.32
[ ] Step 3: 파일 추출
    cd /data/eob
    tar -xzf /tmp/edwards_project_*.tar.gz
[ ] Step 4: 이미지 로드
    cd edwards_project/docker_images
    chmod +x load_images.sh
    ./load_images.sh
[ ] Step 5: 서비스 시작
    cd ..
    docker-compose up -d
[ ] Step 6: 상태 확인
    docker-compose ps
```

## 배포 후 검증 ✔️

### 컨테이너 확인
- [ ] 파일이 /data/eob/edwards_project에 정상 추출
- [ ] 3개 컨테이너 모두 "Up" 상태
  ```bash
  docker-compose ps
  # edwards-postgres: Up
  # edwards-api: Up
  # edwards-web: Up
  ```

### 서비스 연결 확인
- [ ] 백엔드 API 응답 확인
  ```bash
  curl -I http://10.182.252.32:8004/api/docs
  # HTTP/1.1 200 OK
  ```
- [ ] 프론트엔드 로드 확인 (브라우저)
  ```
  http://eob.10.182.252.32.sslip.io
  또는
  http://10.182.252.32:3004
  ```

### 데이터베이스 확인
- [ ] 데이터베이스 연결 확인
  ```bash
  docker-compose exec -T db psql -U postgres -c "\l"
  ```
- [ ] 테이블 존재 확인
  ```bash
  docker-compose exec -T db psql -U postgres -d edwards -c "\dt"
  ```

## 데이터베이스 복원 💾

[중요] 백업이 있는 경우 꼭 실행하세요!

- [ ] Step 1: 백업 파일 전송
  ```bash
  scp edwards_backup.sql atlasAdmin@10.182.252.32:/tmp/
  ```
- [ ] Step 2: VM 접속
  ```bash
  ssh atlasAdmin@10.182.252.32
  cd /data/eob/edwards_project
  ```
- [ ] Step 3: 데이터베이스 복원
  ```bash
  docker-compose exec -T db psql -U postgres -d edwards < /tmp/edwards_backup.sql
  ```
- [ ] Step 4: 복원 확인
  ```bash
  docker-compose exec -T db psql -U postgres -d edwards -c "\dt"
  ```

## 환경 설정 ⚙️

- [ ] .env 파일 확인 (필요시 수정)
  ```bash
  cd /data/eob/edwards_project
  cat .env
  # 주요 항목 확인:
  # - POSTGRES_PASSWORD
  # - SECRET_KEY
  # - CORS_ORIGINS
  ```
- [ ] 환경 변수 수정 필요 시
  ```bash
  nano .env
  docker-compose restart
  ```

## 최종 확인 🎯

- [ ] 프론트엔드 접근 가능
  - URL: http://eob.10.182.252.32.sslip.io
  - 또는: http://10.182.252.32:3004
  
- [ ] 백엔드 API 문서 접근 가능
  - URL: http://10.182.252.32:8004/api/docs
  
- [ ] 로그인 가능
  - 기본 계정으로 로그인 테스트
  
- [ ] 데이터 조회 가능
  - 복원된 데이터 확인
  
- [ ] 실시간 기능 테스트
  - 웹소켓 연결 확인 (필요시)

## 문제 해결 🔧

발생 가능한 문제와 해결 방법:

### 포트 충돌
```bash
# 포트 확인
netstat -tuln | grep -E "3004|8004|5432"

# .env에서 포트 변경
FRONTEND_PORT=3005
BACKEND_PORT=8005

# 재시작
docker-compose down
docker-compose up -d
```

### 컨테이너 실행 실패
```bash
# 로그 확인
docker-compose logs -f

# 재구성
docker-compose down -v
docker-compose up -d
```

### SSH 연결 불가
```bash
# 방화벽 확인
sudo ufw status

# 포트 22 활성화
sudo ufw allow 22/tcp

# SSH 서비스 재시작
sudo systemctl restart ssh
```

### 데이터베이스 연결 실패
```bash
# DB 로그 확인
docker-compose logs db

# DB 상태 확인
docker-compose exec -T db psql -U postgres -c "\l"

# DB 재시작
docker-compose restart db
```

## 배포 완료! 🎉

- [ ] 모든 체크리스트 완료
- [ ] 프로덕션 서버 준비 완료
- [ ] 백업 및 모니터링 설정 완료 (별도)

---

**배포 담당자**: _______________  
**배포 일시**: _______________  
**버전**: edwards_project_20260115_111412.tar.gz  
**상태**: ✅ 완료 / ⏳ 진행 중 / ❌ 실패

---

마지막 주의사항:
1. .env 파일의 민감한 정보는 보안 유지
2. 정기적인 백업 수행
3. 로그 모니터링
4. 성능 모니터링 설정
