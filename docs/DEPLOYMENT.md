# Deployment Guide

Edwards Engineering Management System - 서버 배포 가이드

## 배포 개요

로컬 PC에서 원격 서버(`10.182.252.32`)로 애플리케이션을 배포하는 프로세스입니다.

**현재 서버 정보:**
- **서버 IP:** 10.182.252.32
- **사용자:** atlasAdmin
- **프로젝트 경로:** `/data/eob/edwards_project`
- **도메인:** https://eob.10.182.252.32.sslip.io

---

## 원클릭 배포 (권장)

### 전체 배포 (env 생성 + 빌드 + 백업 + 배포)

```powershell
.\run_full_deploy.ps1
```

**수행 단계 (0~8):**
0. `.env`에서 `.env.remote` 자동 생성 (`deploy_env_remote.py --profile server`)
1. 프로젝트 빌드 (Docker 이미지 + 압축)
2. 최신 빌드 아카이브 탐색
3. 서버 준비 + DB 백업
4. 빌드 파일 업로드 (SCP)
5. 컨테이너 중지 + 압축 해제
6. Docker 이미지 로드
7. 컨테이너 시작
8. 서비스 검증

### 배포 옵션

```powershell
# 빌드 스킵 (기존 빌드 사용)
.\run_full_deploy.ps1 -SkipBuild

# 백업 스킵 (빠른 배포)
.\run_full_deploy.ps1 -SkipBackup

# 다른 서버/도메인에 배포
.\run_full_deploy.ps1 -ServerIP "192.168.1.100" -Domain "app.example.com"
```

---

## 환경 변수 관리

`.env` 하나만 관리하고, 서버용 `.env.remote`는 자동 생성됩니다.

```bash
# .env.remote 자동 생성 (권장)
python deploy_env_remote.py --profile server

# 커스텀 도메인
python deploy_env_remote.py --profile server --domain custom.domain.com

# 생성 + SCP 업로드
python deploy_env_remote.py --profile server --scp atlasAdmin@10.182.252.32:/data/eob/edwards_project/.env.remote

# 개별 값 오버라이드
python deploy_env_remote.py --profile server --set SAML_DEBUG=true
```

**서버 프로파일 자동 변환 내역:**
| 항목 | 변환 |
|------|------|
| `DEBUG` | `true` → `false` |
| `LOG_LEVEL` | `debug` → `info` |
| `SAML_*_URL` | `http://localhost` → `https://{domain}` |
| `CORS_ORIGINS` | localhost only → `+{domain}` |
| `DATABASE_URL` | 제거 (docker-compose 관리) |
| `VITE_DEV_PROXY_TARGET` | 제거 (dev-only) |

---

## 수동 배포 (단계별)

### 1. .env.remote 생성

```bash
python deploy_env_remote.py --profile server
```

### 2. 빌드

```bash
python build_and_compress.py
```

결과: `build_output/edwards_project_YYYYMMDD_HHMMSS.tar.gz`

### 3. 업로드

```bash
scp build_output/edwards_project_*.tar.gz atlasAdmin@10.182.252.32:/tmp/
```

### 4. 서버에서 배포

```bash
ssh atlasAdmin@10.182.252.32

cd /data/eob/edwards_project

# 컨테이너 중지
docker-compose down

# 압축 해제
tar -xzf /tmp/edwards_project_*.tar.gz --strip-components=1
rm /tmp/edwards_project_*.tar.gz

# Docker 이미지 로드
cd docker_images && ./load_images.sh && cd ..

# 컨테이너 시작
docker-compose up -d
```

---

## 데이터베이스 백업/복원

### 원격 DB 백업

```bash
python backup_remote_db.py
```

결과: `backups/remote_backup_YYYYMMDD_HHMMSS.sql`

### 로컬 DB 복원

```bash
python restore_db.py backups/remote_backup_YYYYMMDD_HHMMSS.sql
```

### 서버 DB 복원 (주의: 프로덕션 데이터 덮어쓰기)

```bash
python restore_remote_db.py backups/remote_backup_YYYYMMDD_HHMMSS.sql
```

---

## 포트 구성

| 서비스 | 내부 포트 | 외부 포트 | 접근 |
|--------|----------|----------|------|
| Frontend | 80 | 3004 | Nginx 프록시 |
| Backend | 8004 | 8004 | Nginx 프록시 |
| PostgreSQL | 5432 | 5434 | 내부만 |

### Docker 컨테이너

- `edwards-web` - Frontend (Nginx)
- `edwards-api` - Backend (FastAPI)
- `edwards-postgres` - Database (PostgreSQL 16)

---

## 배포 확인

```bash
# 컨테이너 상태
ssh atlasAdmin@10.182.252.32 "docker ps | grep edwards"

# 로그 확인
ssh atlasAdmin@10.182.252.32 "docker logs edwards-api --tail 50"
ssh atlasAdmin@10.182.252.32 "docker logs edwards-web --tail 50"

# API 헬스체크
curl https://eob.10.182.252.32.sslip.io/health
```

---

## 트러블슈팅

### 배포 스크립트 실패

```powershell
# SSH 연결 테스트
ssh atlasAdmin@10.182.252.32 "echo 'Connected'"

# 서버 디스크 공간 확인
ssh atlasAdmin@10.182.252.32 "df -h"
```

### 컨테이너가 계속 재시작

```bash
# 로그 확인
ssh atlasAdmin@10.182.252.32 "docker logs edwards-api"

# DB 비밀번호 문제일 경우
ssh atlasAdmin@10.182.252.32 "cd /data/eob/edwards_project && docker-compose down -v && docker-compose up -d"
```

### Nginx 404 에러

```bash
ssh atlasAdmin@10.182.252.32 "sudo nginx -t && sudo systemctl reload nginx"
```
