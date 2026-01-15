# VM 서버 수동 배포 가이드

## 📦 배포 파일 정보
- **파일명**: edwards_project_20260115_111412.tar.gz
- **크기**: 87.5MB
- **위치**: build_output/edwards_project_20260115_111412.tar.gz

## 🔧 배포 환경
- **서버**: VTISAZUAPP218
- **IP**: 10.182.252.32
- **사용자**: atlasAdmin
- **배포 경로**: /data/eob/edwards_project

---

## 배포 단계

### 1️⃣ 로컬에서 VM으로 파일 전송

```bash
# Windows PowerShell에서 실행
$file = "D:\00.Dev\7.myApplication\engineering.resource.management\build_output\edwards_project_20260115_111412.tar.gz"
$user = "atlasAdmin"
$ip = "10.182.252.32"

scp $file ${user}@${ip}:/tmp/

# 또는 Git Bash/WSL에서
scp build_output/edwards_project_20260115_111412.tar.gz atlasAdmin@10.182.252.32:/tmp/
```

### 2️⃣ VM에 SSH로 접속

```bash
ssh atlasAdmin@10.182.252.32

# 비밀번호: 7ab172XY6n9ccab8
```

### 3️⃣ 기존 컨테이너 중지

```bash
cd /data/eob/edwards_project

# 현재 실행 중인 컨테이너 확인
docker-compose ps

# 컨테이너 중지 및 제거
docker-compose down

# 또는 볼륨도 함께 제거 (DB 초기화 원할 경우)
docker-compose down -v
```

### 4️⃣ 압축 파일 추출

```bash
cd /data/eob

# 파일 추출
tar -xzf /tmp/edwards_project_20260115_111412.tar.gz

# 확인
ls -la edwards_project/
```

### 5️⃣ Docker 이미지 로드

```bash
cd edwards_project/docker_images

# 권한 설정
chmod +x load_images.sh

# 이미지 로드 (약 2-3분 소요)
./load_images.sh

# 로드된 이미지 확인
docker images | grep -E "edwards|postgres"
```

### 6️⃣ 환경 설정 파일 준비

```bash
cd /data/eob/edwards_project

# .env 파일 복사 (이미 있으면 백업)
cp .env .env.backup 2>/dev/null || true
cp .env.example .env

# .env 수정 (필요한 경우)
nano .env

# 중요 환경변수:
# - POSTGRES_USER=postgres
# - POSTGRES_PASSWORD=<strong_password>
# - POSTGRES_DB=edwards
# - SECRET_KEY=<random_key>
# - CORS_ORIGINS=http://localhost:3004,http://eob.10.182.252.32.sslip.io
```

### 7️⃣ 서비스 시작

```bash
cd /data/eob/edwards_project

# 컨테이너 시작
docker-compose up -d

# 시작 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f
```

### 8️⃣ 서비스 정상 확인

```bash
# 컨테이너 상태
docker-compose ps

# 백엔드 API 체크
curl -I http://10.182.252.32:8004/api/docs

# 프론트엔드 체크
curl -I http://10.182.252.32:3004

# 데이터베이스 체크
docker-compose exec -T db psql -U postgres -c "\l"
```

---

## 💾 데이터베이스 복원

기존 백업이 있는 경우:

### 1) 백업 파일을 VM으로 전송

```bash
# 로컬에서 실행
scp edwards_backup.sql atlasAdmin@10.182.252.32:/tmp/

# 또는
scp backup_db.py atlasAdmin@10.182.252.32:/data/eob/edwards_project/
```

### 2) VM에서 데이터베이스 복원

```bash
cd /data/eob/edwards_project

# 방법 1: SQL 파일로부터 직접 복원
docker-compose exec -T db psql -U postgres -d edwards < /tmp/edwards_backup.sql

# 방법 2: 파이썬 스크립트로 복원 (있는 경우)
python3 restore_db.py
```

### 3) 복원 확인

```bash
# 테이블 확인
docker-compose exec -T db psql -U postgres -d edwards -c "\dt"

# 데이터 샘플 확인
docker-compose exec -T db psql -U postgres -d edwards -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public';"
```

---

## 🌐 접근 URL

배포 완료 후 다음 URL로 접근 가능:

- **프론트엔드**: http://eob.10.182.252.32.sslip.io
- **백엔드 API Docs**: http://eob.10.182.252.32.sslip.io/api/docs
- **프론트엔드 (직접 포트)**: http://10.182.252.32:3004
- **백엔드 (직접 포트)**: http://10.182.252.32:8004

---

## 🔍 트러블슈팅

### 포트 충돌 확인

```bash
# 사용 중인 포트 확인
sudo netstat -tuln | grep -E "3004|8004|5432"

# 또는
sudo ss -tuln | grep -E "3004|8004|5432"
```

### 컨테이너 로그 확인

```bash
# 전체 로그
docker-compose logs

# 특정 서비스 로그
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db

# 실시간 로그 (종료: Ctrl+C)
docker-compose logs -f
```

### 컨테이너 재시작

```bash
# 전체 재시작
docker-compose restart

# 특정 서비스 재시작
docker-compose restart backend
docker-compose restart frontend
docker-compose restart db
```

### 디스크 공간 확인

```bash
# 전체 디스크 사용량
df -h

# Docker 사용량
docker system df

# 불필요한 이미지/컨테이너 정리
docker system prune -a --volumes
```

### SSH 접속 실패

```bash
# 방화벽 확인
sudo ufw status

# 포트 22 열기 (필요시)
sudo ufw allow 22/tcp

# SSH 서비스 상태
sudo systemctl status ssh
```

---

## 📝 주요 파일 위치

```
/data/eob/edwards_project/
├── docker-compose.yml      # Docker 컴포지션 설정
├── .env                    # 환경 설정 (수정 필요)
├── .env.example            # 환경 설정 템플릿
├── backend/                # 백엔드 소스
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .venv/              # 파이썬 가상 환경
├── frontend/               # 프론트엔드 소스
│   ├── Dockerfile
│   ├── dist/               # 빌드된 정적 파일
│   └── node_modules/
├── docker_images/          # Docker 이미지 파일
│   ├── edwards-backend.tar.gz
│   ├── edwards-frontend.tar.gz
│   ├── postgres-15.tar.gz
│   └── load_images.sh
└── DEPLOY_ON_VM.md         # 배포 가이드
```

---

## ✅ 체크리스트

배포 후 확인 사항:

- [ ] 파일이 VM의 /data/eob에 추출됨
- [ ] Docker 이미지가 로드됨 (`docker images` 확인)
- [ ] 컨테이너가 실행 중 (`docker-compose ps`)
- [ ] 백엔드가 정상 응답 (API endpoint 확인)
- [ ] 프론트엔드가 정상 로드 (브라우저 확인)
- [ ] 데이터베이스가 정상 연결 (테이블 확인)
- [ ] 백업에서 데이터가 복원됨 (필요시)

---

## 🆘 문제 발생 시

1. **로그 확인**: `docker-compose logs -f`
2. **컨테이너 재시작**: `docker-compose restart`
3. **전체 재구성**: `docker-compose down -v && docker-compose up -d`
4. **디스크 공간**: `df -h` 확인
5. **포트 충돌**: `netstat -tuln` 확인

긴급 연락처:
- VM IP: 10.182.252.32
- 사용자: atlasAdmin
- 배포 디렉토리: /data/eob/edwards_project

---

*마지막 업데이트: 2026-01-15*
