# DB 백업 스킬 생성 및 환경변수 단일화

## 개요
데이터베이스 백업/복원을 위한 Claude Code 스킬을 생성하고, 분산된 .env 파일을 단일 소스로 통합했습니다. 또한 CSV worklog 마이그레이션에서 누락된 사용자(Alyssa Park)를 추가하고 1,510건의 worklog를 DB에 삽입했습니다.

## 주요 변경사항

### 1. 환경변수 단일화
- `backend/.env` 제거 → 루트 `/.env`만 사용
- `DATABASE_URL`을 `localhost:5434`로 통일 (Docker는 docker-compose에서 override)
- `config.py`에서 상위 디렉토리 .env 자동 탐색 기능 추가

**변경 파일:**
- `/.env` - DATABASE_URL을 localhost:5434로 변경
- `backend/app/core/config.py` - `find_env_file()` 함수 추가

```python
def find_env_file() -> str:
    """Find .env file in current or parent directory."""
    current = Path.cwd()
    if (current / ".env").exists():
        return str(current / ".env")
    if (current.parent / ".env").exists():
        return str(current.parent / ".env")
    return ".env"
```

### 2. DB 백업 스킬 생성
- `.claude/skills/db-backup/SKILL.md` 생성
- 기존 스크립트(`backup_db.py`, `restore_db.py`, `backend/scripts/db_backup.py`) 활용

**스킬 명령어:**
| 명령 | 설명 |
|------|------|
| `/db-backup backup` | Docker DB 백업 |
| `/db-backup list` | 백업 목록 조회 |
| `/db-backup restore <file>` | DB 복원 |

### 3. 백업 목록 패턴 수정
- `backend/scripts/db_backup.py`의 `list_backups()` 함수 수정
- `edwards_backup_*`, `edwards_full_backup_*` 패턴 추가

```python
for pattern in ["backup_*.sql*", "edwards_backup_*.sql*", "edwards_full_backup_*.sql*"]:
    for f in BACKUP_DIR.glob(pattern):
```

### 4. CSV Worklog 마이그레이션 완료
- Alyssa Park (Person.id=446) 사용자 DB 추가
- `user_resolver.py`에 수동 매핑 추가
- `csv_migration_service.py` import 오류 및 필드 오류 수정

**마이그레이션 결과:**
```
Inserted: 1,510건
Total in DB: 108,468건
```

## 생성된 파일

| 파일 | 설명 |
|------|------|
| `.claude/skills/db-backup/SKILL.md` | DB 백업/복원 스킬 정의 |

## 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `/.env` | DATABASE_URL을 localhost:5434로 변경 |
| `backend/app/core/config.py` | 상위 디렉토리 .env 탐색 |
| `backend/app/services/user_resolver.py` | Person.id=446 수동 매핑 |
| `backend/app/services/csv_migration_service.py` | import 경로 및 WorkLog 필드 수정 |
| `backend/scripts/db_backup.py` | 백업 파일 패턴 확장 |

## 검증 결과

### Docker 테스트
```
Container edwards-api: Up
Container edwards-postgres: Up
Container edwards-web: Up
DATABASE_URL (Docker 내부): db:5432
API 응답: 정상
```

### 백업 테스트
```
edwards_backup_20260130_224042.sql  19.79 MB  2026-01-30 22:40:43
```

### 마이그레이션 테스트
```
=== Alyssa Park Recent Worklogs ===
2026-01-29: 4.0h - Vacuum performance test report 작성
2026-01-29: 3.0h - HRS leak test
2026-01-29: 1.0h - SE3 Team weekly meeting
```

## 다음 단계
- Low Confidence 669건 Project 매핑 검토
- SERVER_DATABASE_URL 설정하여 서버 복원 테스트
- 자동 백업 스케줄링 (GitHub Actions 또는 cron)
