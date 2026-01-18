# 📦 Deployment Guide

Edwards Engineering Management System - 서버 배포 가이드

## 🎯 배포 개요

이 가이드는 로컬 PC에서 원격 서버로 애플리케이션을 배포하는 전체 프로세스를 설명합니다.

---

## 🚀 원클릭 배포 (권장)

### 전체 배포 (빌드 + 백업 + 배포)

```powershell
.\scripts\deploy_to_vm.ps1
```

**수행 단계:**
1. ✅ 프로젝트 빌드 (backend + frontend)
2. ✅ 서버 DB 자동 백업
3. ✅ 빌드 파일 업로드 (SCP)
4. ✅ 컨테이너 중지 및 압축 해제
5. ✅ Docker 이미지 로드
6. ✅ Nginx 자동 설정
7. ✅ 컨테이너 시작

---

## ⚙️ 배포 옵션

### 빌드 스킵 (기존 빌드 사용)

```powershell
.\scripts\deploy_to_vm.ps1 -SkipBuild
```

### 백업 스킵 (빠른 배포)

```powershell
.\scripts\deploy_to_vm.ps1 -SkipBackup
```

### 다른 서버에 배포

```powershell
.\scripts\deploy_to_vm.ps1 -ServerIP "192.168.1.100" -Domain "app.example.com"
```

---

## 📝 수동 배포 (단계별)

필요시 수동으로 단계별 배포를 진행할 수 있습니다.

### 1. 빌드

```bash
python scripts/build_and_compress.py
```

**결과:** `build_output/edwards_project_YYYYMMDD_HHMMSS.tar.gz`

### 2. 업로드

```bash
scp build_output/edwards_project_*.tar.gz atlasAdmin@10.182.252.32:~/services/edwards_project/
```

### 3. 서버에서 배포

```bash
ssh atlasAdmin@10.182.252.32

cd ~/services/edwards_project

# 컨테이너 중지
docker-compose down

# 압축 해제
tar -xzf edwards_project_*.tar.gz --strip-components=1
rm edwards_project_*.tar.gz

# Docker 이미지 로드
cd docker_images
docker load < postgres-15.tar
docker load < edwards-backend.tar
docker load < edwards-frontend.tar

# 컨테이너 시작
cd ..
docker-compose up -d
```

---

## 🔄 롤백 (이전 버전으로 복구)

### 1. 백업에서 복원

```bash
# 로컬에서
python scripts/restore_db.py backups/edwards_backup_YYYYMMDD_HHMMSS.sql
```

### 2. 서버에서 복원

```bash
ssh atlasAdmin@10.182.252.32

cd ~/services/edwards_project
docker exec -i edwards-postgres psql -U postgres -d edwards < backups/edwards_backup_YYYYMMDD_HHMMSS.sql
docker-compose restart backend
```

---

## 🏗️ 서버 인프라 구조

### 현재 서버 정보

- **서버 IP:** 10.182.252.32
- **사용자:** atlasAdmin
- **프로젝트 경로:** `/home/atlasAdmin/services/edwards_project`
- **도메인:** http://eob.10.182.252.32.sslip.io

### 포트 구성

| 서비스 | 내부 포트 | 외부 포트 | 접근 |
|--------|----------|----------|------|
| Frontend | 80 | 3004 | Nginx 프록시 |
| Backend | 8004 | 8004 | Nginx 프록시 |
| PostgreSQL | 5432 | 5434 | 내부만 |

### Docker 컨테이너

- `edwards-web` - Frontend (Nginx)
- `edwards-api` - Backend (FastAPI)
- `edwards-postgres` - Database (PostgreSQL 15)

---

## 🔍 배포 확인

### 1. 컨테이너 상태 확인

```bash
ssh atlasAdmin@10.182.252.32 "docker ps | grep edwards"
```

**정상 출력:**
```
edwards-web      Up X minutes
edwards-api      Up X minutes
edwards-postgres Up X minutes (healthy)
```

### 2. 로그 확인

```bash
# Backend 로그
ssh atlasAdmin@10.182.252.32 "docker logs edwards-api --tail 50"

# Frontend 로그
ssh atlasAdmin@10.182.252.32 "docker logs edwards-web --tail 50"

# DB 로그
ssh atlasAdmin@10.182.252.32 "docker logs edwards-postgres --tail 50"
```

### 3. API 헬스체크

```bash
curl http://eob.10.182.252.32.sslip.io/health
# 출력: healthy
```

---

## 🛠️ 배포 후 작업

### Nginx 설정 확인

```bash
ssh atlasAdmin@10.182.252.32 "sudo nginx -t"
ssh atlasAdmin@10.182.252.32 "sudo cat /etc/nginx/sites-available/edwards"
```

### 디스크 공간 확인

```bash
ssh atlasAdmin@10.182.252.32 "df -h"
```

### 백업 파일 정리 (7일 이상 된 백업 삭제)

```bash
ssh atlasAdmin@10.182.252.32 "find ~/services/edwards_project/backups -name '*.sql' -mtime +7 -delete"
```

---

## 🆘 트러블슈팅

### 배포 스크립트 실패

**증상:** PowerShell 스크립트가 중간에 실패

**해결:**
```powershell
# SSH 연결 테스트
ssh atlasAdmin@10.182.252.32 "echo 'Connected'"

# 서버 디스크 공간 확인
ssh atlasAdmin@10.182.252.32 "df -h"

# 수동 단계별 배포로 전환
```

### 컨테이너가 계속 재시작

**증상:** `docker ps`에서 `Restarting` 상태

**해결:**
```bash
# 로그 확인
ssh atlasAdmin@10.182.252.32 "docker logs edwards-api"

# DB 비밀번호 문제일 경우
ssh atlasAdmin@10.182.252.32 "cd ~/services/edwards_project && docker-compose down -v && docker-compose up -d"
```

### Nginx 404 에러

**증상:** 도메인 접속 시 404

**해결:**
```bash
# Nginx 설정 재확인
ssh atlasAdmin@10.182.252.32 "sudo nginx -t && sudo systemctl reload nginx"

# 컨테이너 포트 확인
ssh atlasAdmin@10.182.252.32 "docker ps | grep edwards"
```

### 로그인 불가

**증상:** 로그인 500 에러

**해결:**
```bash
# DB 복원
python scripts/restore_db.py backups/edwards_backup_YYYYMMDD_HHMMSS.sql

# 또는 서버에서 직접
ssh atlasAdmin@10.182.252.32
cd ~/services/edwards_project
docker exec -i edwards-postgres psql -U postgres -d edwards < backups/edwards_backup_*.sql
docker-compose restart backend
```

---

## 📚 추가 정보

- **빠른 시작:** `QUICKSTART.md`
- **개발 문서:** `docs/development/`
- **서버 정보:** `deploy/.env.vm`
- **프로젝트 README:** `README.md`
