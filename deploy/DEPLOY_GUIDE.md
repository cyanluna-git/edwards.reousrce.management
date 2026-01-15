# 🚀 Edwards Project VM 배포 가이드

## 📋 배포 파일 정보

| 항목 | 값 |
|------|-----|
| **파일명** | edwards_project_20260115_111412.tar.gz |
| **크기** | 87.5MB |
| **위치** | build_output/ |
| **생성 시간** | 2026-01-15 11:14:12 |

## 🖥️ 대상 서버

| 항목 | 값 |
|------|-----|
| **서버명** | VTISAZUAPP218 |
| **IP 주소** | 10.182.252.32 |
| **사용자** | atlasAdmin |
| **배포 경로** | /data/eob/edwards_project |
| **OS** | Ubuntu 24.04.3 LTS |

## 🎯 배포 옵션

### 옵션 1: ✅ 권장 - Windows PowerShell 자동 배포

**가장 편리하고 빠른 방법입니다.**

```powershell
# 1. PowerShell 관리자로 실행
# 2. 다음 명령어 실행
cd D:\00.Dev\7.myApplication\engineering.resource.management
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\deploy_to_vm.ps1

# 옵션:
.\deploy_to_vm.ps1 -VMPath /data/eob              # 기본값
.\deploy_to_vm.ps1 -SkipImageLoad                 # 이미지 로드 스킵
.\deploy_to_vm.ps1 -Help                          # 도움말 표시
```

**특징:**
- ✅ 자동 파일 전송 (SCP)
- ✅ 자동 추출 및 배포
- ✅ 실시간 진행 상황 표시
- ✅ 에러 발생 시 자동 중지

---

### 옵션 2: 📝 수동 배포 (단계별)

**더 세밀한 제어가 필요할 때 사용합니다.**

#### Step 1: 파일 전송

```bash
# Git Bash 또는 WSL에서 실행
scp build_output/edwards_project_20260115_111412.tar.gz atlasAdmin@10.182.252.32:/tmp/

# 또는 PowerShell (Windows 10+)
scp build_output\edwards_project_20260115_111412.tar.gz atlasAdmin@10.182.252.32:/tmp/
```

#### Step 2: VM 접속

```bash
ssh atlasAdmin@10.182.252.32
# 비밀번호: 7ab172XY6n9ccab8
```

#### Step 3: 배포 스크립트 실행

VM에 접속한 후 다음을 실행하세요:

```bash
# 기존 컨테이너 중지
cd /data/eob
docker-compose down 2>/dev/null || true

# 파일 추출
tar -xzf /tmp/edwards_project_20260115_111412.tar.gz

# Docker 이미지 로드
cd edwards_project/docker_images
chmod +x load_images.sh
./load_images.sh

# 환경 설정 (필요시 수정)
cd ..
cp .env.example .env
nano .env

# 서비스 시작
docker-compose up -d

# 상태 확인
docker-compose ps
```

---

## ⚙️ 배포 후 설정

### 1. 환경 변수 확인

```bash
cd /data/eob/edwards_project
cat .env

# 주요 변수:
# POSTGRES_USER=postgres
# POSTGRES_PASSWORD=<secure_password>
# POSTGRES_DB=edwards
# SECRET_KEY=<random_key>
```

### 2. 서비스 상태 확인

```bash
# 컨테이너 실행 상태
docker-compose ps

# 예상 출력:
# NAME                  COMMAND                  SERVICE   STATUS      PORTS
# edwards-postgres      "docker-entrypoint..."   db        Up 2 mins   5432/tcp
# edwards-api          "python -m uvicorn..."   backend   Up 2 mins   0.0.0.0:8004->8004/tcp
# edwards-web          "nginx -g daemon..."     frontend  Up 2 mins   0.0.0.0:3004->80/tcp
```

### 3. API 연결 테스트

```bash
# 백엔드 상태 확인
curl -I http://10.182.252.32:8004/api/docs

# 응답 예시:
# HTTP/1.1 200 OK
```

### 4. 데이터베이스 복원 (중요)

```bash
# 백업 파일이 있는 경우, 먼저 VM으로 전송
scp edwards_backup.sql atlasAdmin@10.182.252.32:/tmp/

# VM에서 복원 실행
ssh atlasAdmin@10.182.252.32

cd /data/eob/edwards_project

# 데이터베이스 복원
docker-compose exec -T db psql -U postgres -d edwards < /tmp/edwards_backup.sql

# 복원 확인
docker-compose exec -T db psql -U postgres -d edwards -c "\dt"
```

---

## 🌐 접근 방법

배포 완료 후 다음 URL로 접근 가능합니다:

### 프론트엔드

| URL | 설명 |
|-----|------|
| http://eob.10.182.252.32.sslip.io | 🌟 권장 (Nginx 리버스 프록시) |
| http://10.182.252.32:3004 | 직접 접근 |

### 백엔드 API

| URL | 설명 |
|-----|------|
| http://eob.10.182.252.32.sslip.io/api | Nginx 리버스 프록시 |
| http://10.182.252.32:8004/api | 직접 접근 |
| http://10.182.252.32:8004/api/docs | Swagger UI (직접 접근) |

---

## 📊 배포 체크리스트

배포 후 다음 항목을 확인하세요:

```
□ 파일이 /data/eob에 정상 추출됨
□ Docker 이미지가 로드됨 (docker images 확인)
□ 3개 컨테이너가 모두 실행 중 (docker-compose ps)
□ 백엔드 API가 응답함 (curl -I http://10.182.252.32:8004/api/docs)
□ 프론트엔드가 로드됨 (브라우저에서 http://eob.10.182.252.32.sslip.io 접근)
□ 데이터베이스가 정상 연결 (docker-compose exec -T db psql -U postgres -c "\l")
□ 백업이 복원됨 (필요시) (테이블 확인)
□ 포트가 모두 사용 중 (3004, 8004, 5432)
```

---

## 🔧 트러블슈팅

### 1. 포트 충돌

```bash
# 사용 중인 포트 확인
netstat -tuln | grep -E "3004|8004|5432"

# 또는
ss -tuln | grep -E "3004|8004|5432"

# .env 파일에서 포트 변경
FRONTEND_PORT=3005
BACKEND_PORT=8005
```

### 2. 컨테이너 실행 실패

```bash
# 로그 확인
docker-compose logs

# 특정 서비스 로그
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db

# 전체 재구성
docker-compose down -v
docker-compose up -d
```

### 3. SSH 연결 실패

```bash
# 방화벽 확인
sudo ufw status

# 포트 22 활성화
sudo ufw allow 22/tcp

# SSH 서비스 상태
sudo systemctl status ssh

# SSH 재시작
sudo systemctl restart ssh
```

### 4. 디스크 공간 부족

```bash
# 디스크 사용량 확인
df -h

# Docker 이미지 정리
docker system prune -a

# 타볼 정리
rm -f /tmp/edwards_project_*.tar.gz
```

---

## 📁 배포된 파일 구조

```
/data/eob/edwards_project/
├── docker-compose.yml              # Docker 컨테이너 설정
├── .env                            # 환경 설정 (수정함)
├── .env.example                    # 환경 설정 템플릿
├── backend/                        # 백엔드 소스 코드
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .venv/                      # Python 가상환경 (사전 설치)
│   └── app/
├── frontend/                       # 프론트엔드 소스 코드
│   ├── Dockerfile
│   ├── vite.config.ts
│   ├── dist/                       # 빌드된 정적 파일 (Nginx에서 제공)
│   ├── node_modules/               # Node 의존성 (사전 설치)
│   └── src/
├── docker_images/                  # Docker 이미지 파일
│   ├── edwards-backend.tar.gz
│   ├── edwards-frontend.tar.gz
│   ├── postgres-15.tar.gz
│   ├── load_images.sh              # 이미지 로드 스크립트
│   └── load_images.ps1             # Windows용 스크립트
├── docs/                           # 문서
├── DEPLOY_ON_VM.md                 # 상세 배포 가이드
└── README.md                       # 프로젝트 README
```

---

## 💾 데이터베이스 백업/복원

### 백업

```bash
# VM에서 실행
cd /data/eob/edwards_project
docker-compose exec -T db pg_dump -U postgres -d edwards > backup_$(date +%Y%m%d_%H%M%S).sql

# 로컬로 다운로드
scp atlasAdmin@10.182.252.32:/data/eob/edwards_project/backup_*.sql .
```

### 복원

```bash
# 백업 파일 업로드
scp backup_20260115.sql atlasAdmin@10.182.252.32:/tmp/

# VM에서 복원
ssh atlasAdmin@10.182.252.32
cd /data/eob/edwards_project
docker-compose exec -T db psql -U postgres -d edwards < /tmp/backup_20260115.sql
```

---

## 🔐 보안 확인

배포 후 보안 설정을 확인하세요:

```bash
# 1. 기본 로그인 변경
# - 기본 암호 변경
# - SSH 키 기반 인증 설정
# - 불필요한 포트 닫기

# 2. 환경 변수 검증
grep -E "PASSWORD|SECRET" .env

# 3. 방화벽 설정
sudo ufw status
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 📞 도움말

- **배포 스크립트**: deploy_to_vm.ps1 (PowerShell)
- **수동 가이드**: VM_DEPLOYMENT_MANUAL.md
- **서버 정보**: VTISAZUAPP218.md
- **Docker 설정**: docker-compose.yml

---

*작성일: 2026-01-15*  
*최종 수정: 2026-01-15*
