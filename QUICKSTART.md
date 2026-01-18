# 🚀 Quick Start Guide

Edwards Engineering Management System - 빠른 시작 가이드

## 📋 Prerequisites

- **로컬 개발:**
  - Python 3.12+
  - Node.js 18+ / pnpm
  - Docker Desktop (실행 중)
  
- **서버 배포:**
  - SSH 키 설정 완료
  - 서버 정보: `deploy/.env.vm` 확인

---

## 🏃 빠른 시작 (로컬 개발)

### 1️⃣ 로컬에서 실행

```bash
# 프로젝트 루트에서
python run.py
```

**접속:**
- Frontend: http://localhost:3004
- Backend API: http://localhost:8004/api/docs

---

## 🚀 서버 배포 (원클릭)

### 1️⃣ 빌드 + 배포 (전체)

```powershell
# PowerShell에서
.\scripts\deploy_to_vm.ps1
```

### 2️⃣ 빌드 스킵 (기존 빌드 사용)

```powershell
.\scripts\deploy_to_vm.ps1 -SkipBuild
```

### 3️⃣ 백업 스킵 (빠른 배포)

```powershell
.\scripts\deploy_to_vm.ps1 -SkipBackup
```

**배포 완료 후 접속:**
- Frontend: http://eob.10.182.252.32.sslip.io
- Backend API: http://eob.10.182.252.32.sslip.io/docs

---

## 🔧 개별 작업

### 빌드만

```bash
python scripts/build_and_compress.py
```

### DB 백업

```bash
python scripts/backup_db.py
```

### DB 복원

```bash
python scripts/restore_db.py backups/edwards_backup_YYYYMMDD_HHMMSS.sql
```

---

## 📁 주요 스크립트 위치

| 스크립트 | 용도 | 위치 |
|---------|------|------|
| `run.py` | 로컬 개발 환경 실행 | 루트 |
| `deploy_to_vm.ps1` | 서버 배포 (원클릭) | `scripts/` |
| `build_and_compress.py` | 프로젝트 빌드 | `scripts/` |
| `backup_db.py` | DB 백업 | `scripts/` |
| `restore_db.py` | DB 복원 | `scripts/` |

---

## 🆘 트러블슈팅

### 로컬 실행 안됨
```bash
# Docker가 실행 중인지 확인
docker ps

# .env 파일 확인
cat .env
```

### 배포 실패
```bash
# SSH 연결 확인
ssh atlasAdmin@10.182.252.32 "docker ps"

# 서버 로그 확인
ssh atlasAdmin@10.182.252.32 "docker logs edwards-api"
```

### 더 자세한 내용
- 배포 가이드: `docs/DEPLOYMENT.md`
- 개발 문서: `docs/development/`
- README: `README.md`
