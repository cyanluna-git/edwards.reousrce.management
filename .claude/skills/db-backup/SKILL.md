---
name: db-backup
description: PostgreSQL 데이터베이스 백업 및 복원. Docker/로컬 환경 지원.
argument-hint: [backup|restore|list] [options]
disable-model-invocation: true
allowed-tools: Bash(docker *, python *, pg_dump *, psql *), Read, Glob
---

# Database Backup & Restore Skill

PostgreSQL 데이터베이스를 백업하고 복원합니다.

## 사용법

```bash
/db-backup backup                    # Docker DB 백업
/db-backup backup --local            # 로컬 DB 백업 (localhost:5434)
/db-backup list                      # 백업 목록 조회
/db-backup restore <file>            # Docker DB로 복원
/db-backup restore <file> --server   # 서버 DB로 복원
```

## Arguments

| 명령 | 옵션 | 설명 |
|------|------|------|
| `backup` | (없음) | Docker 컨테이너 내 DB 백업 |
| `backup` | `--local` | 로컬 PostgreSQL 백업 (localhost:5434) |
| `backup` | `--compressed` | 압축 포맷 (.dump) |
| `list` | | 사용 가능한 백업 파일 목록 |
| `restore` | `<file>` | 지정 파일로 Docker DB 복원 |
| `restore` | `<file> --local` | 로컬 PostgreSQL로 복원 |
| `restore` | `<file> --server` | 서버 DB로 복원 (확인 필요) |

## 실행 스크립트

### Docker 환경 (기본)
```bash
# 프로젝트 루트에서 실행
cd $PROJECT_ROOT

# 백업 (Docker)
python backup_db.py

# 복원 (Docker)
python restore_db.py <backup_file>
```

### 로컬/서버 환경
```bash
# backend 디렉토리에서 실행
cd $PROJECT_ROOT/backend

# 백업 (로컬 DB)
python -m scripts.db_backup --backup

# 복원 (로컬 DB)
python -m scripts.db_backup --restore <file> --target local

# 복원 (서버 DB) - SERVER_DATABASE_URL 필요
python -m scripts.db_backup --restore <file> --target server

# 목록 조회
python -m scripts.db_backup --list
```

## 환경 변수 (.env)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DATABASE_URL` | 로컬 PostgreSQL 연결 | `localhost:5434` |
| `SERVER_DATABASE_URL` | 서버 PostgreSQL 연결 | (미설정) |
| `POSTGRES_USER` | DB 사용자명 | `postgres` |
| `POSTGRES_PASSWORD` | DB 비밀번호 | `password` |
| `POSTGRES_DB` | DB 이름 | `edwards` |

## 백업 파일 위치

```
backups/
├── backup_20260130_120000.sql       # 일반 백업
├── backup_20260130_120000.dump      # 압축 백업
├── edwards_backup_*.sql             # Docker 백업 (backup_db.py)
└── edwards_full_backup_*.sql.gz     # 전체 백업
```

## 워크플로우 예시

### 1. Docker DB → 로컬 백업
```bash
# Docker DB 백업
python backup_db.py
# 결과: backups/edwards_backup_20260130_HHMMSS.sql
```

### 2. 로컬 DB → 서버 복원
```bash
# .env에 SERVER_DATABASE_URL 설정 필요
cd backend
python -m scripts.db_backup --restore backup_20260130.sql --target server
# 확인 프롬프트: "yes" 입력
```

### 3. 새 PC로 데이터 이전
```bash
# 원본 PC
python backup_db.py

# 새 PC (backups/ 폴더에 파일 복사 후)
python restore_db.py edwards_backup_20260130_120000.sql
```

## 주의사항

- **복원 시 기존 데이터 삭제됨**: 복원 전 현재 DB 백업 권장
- **서버 복원 시 확인 필요**: `--server` 옵션 사용 시 "yes" 입력 필요
- **Docker 컨테이너 필수**: Docker 명령은 컨테이너 실행 중이어야 함
- **pg_dump 필요**: 로컬 명령은 PostgreSQL 클라이언트 도구 필요

## 참고 파일

- `backup_db.py` - Docker 백업 스크립트
- `restore_db.py` - Docker 복원 스크립트
- `backend/scripts/db_backup.py` - 전체 기능 유틸리티
