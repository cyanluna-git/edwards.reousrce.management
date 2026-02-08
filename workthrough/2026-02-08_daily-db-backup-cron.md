# Daily DB Backup Cron Job & Build Fix

## Overview

서버에 매일 02:00 자동 DB 백업 크론잡을 추가하고, 빌드 프로세스에서 발생한 두 가지 에러를 수정했다.

## Context

- 프로덕션 DB 백업이 수동으로만 가능했음 (`backup_remote_db.py`는 로컬 PC에서 SSH로 실행)
- 서버 자체에서 자동 백업 + 오래된 파일 정리가 필요
- 배포 과정에서 두 가지 빌드 에러 발견:
  1. `docker-compose build`가 `.env` 없이 실행되어 `POSTGRES_PASSWORD` interpolation 실패
  2. `RegisterPage.tsx`에서 `JobPosition` import 경로 오류 (TS2614)

## Changes Made

### 1. 서버 백업 스크립트 (server/backup_db.sh) - 신규

- `docker exec edwards-postgres pg_dump` → gzip 압축 저장
- `RETENTION_DAYS=7` 환경변수로 보관기간 조정 가능
- 컨테이너 미실행 시 에러 처리
- 백업 크기, 파일 수 등 로그 출력

```bash
# 핵심 로직
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"

# 7일 이상 된 백업 자동 삭제
find "${BACKUP_DIR}" -name "edwards_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -type f -delete
```

### 2. 크론잡 설치 스크립트 (server/setup_cron.sh) - 신규

- `./setup_cron.sh` → 매일 02:00 크론잡 등록
- `./setup_cron.sh --remove` → 크론잡 제거
- `./setup_cron.sh --show` → 현재 크론탭 확인
- 마커 기반 중복 등록 방지 (`# edwards-eob-db-backup`)

### 3. 빌드 스크립트 .env 처리 (build_and_compress.py)

`docker-compose build`가 `build_output/edwards_project/`에서 실행될 때 `.env`가 없어서 `POSTGRES_PASSWORD` 변수 interpolation 실패.

```python
# Before: .env 없이 docker-compose build 실행 → 에러
os.chdir(str(project_dir))
subprocess.run(['docker-compose', 'build', 'backend'], ...)

# After: 원본 .env를 빌드 디렉토리에 복사, 빌드 후 삭제
if not stub_env.exists():
    source_env = Path(original_cwd) / '.env'
    if source_env.exists():
        shutil.copy2(source_env, stub_env)
    ...
# finally 블록에서 삭제 → 아카이브에 시크릿 미포함
```

### 4. RegisterPage import 수정 (frontend/src/pages/RegisterPage.tsx)

```typescript
// Before: TS2614 - client.ts에 JobPosition export 없음
import type { Department, JobPosition } from '@/api/client';

// After: JobPosition은 @/types에서 import
import type { Department } from '@/api/client';
import type { JobPosition } from '@/types';
```

### 5. 배포 가이드 업데이트 (docs/DEPLOYMENT.md)

크론잡 설정 섹션 추가:
- 설치/제거/확인 명령어
- 백업 파일/로그 경로 안내

## File Summary

| File | Action |
|------|--------|
| `server/backup_db.sh` | **New** - DB 백업 스크립트 |
| `server/setup_cron.sh` | **New** - 크론잡 설치/관리 |
| `build_and_compress.py` | Modified - .env 복사 로직 추가 |
| `frontend/src/pages/RegisterPage.tsx` | Modified - import 경로 수정 |
| `docs/DEPLOYMENT.md` | Modified - 크론잡 섹션 추가 |

## Verification Results

### 수동 백업 테스트 (서버)
```
[2026-02-08 06:55:56] === Database backup started ===
[2026-02-08 06:55:56] Dumping edwards from edwards-postgres...
[2026-02-08 06:55:56] Backup saved: /data/eob/edwards_project/backups/edwards_backup_20260208_065556.sql.gz (3.0M)
[2026-02-08 06:55:56] Backups on disk: 1 files, 249M total
[2026-02-08 06:55:56] === Backup completed successfully ===
```

### 크론잡 등록 확인
```
$ crontab -l
0 2 * * * /data/eob/edwards_project/server/backup_db.sh >> /data/eob/edwards_project/backups/backup.log 2>&1 # edwards-eob-db-backup
```

### 배포 결과
```
[8/8] Verifying services...
edwards-api        edwards_project-backend    Up 5 seconds   0.0.0.0:8004->8004/tcp
edwards-postgres   postgres:15                Up 6 hours     0.0.0.0:5434->5432/tcp
edwards-web        edwards_project-frontend   Up 5 seconds   0.0.0.0:3004->80/tcp
```

### TypeScript Type Check
```bash
$ npx tsc --noEmit
# (no output - clean pass)
```
