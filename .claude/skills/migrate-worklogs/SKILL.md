---
name: migrate-worklogs
description: CSV에서 worklog를 DB로 증분 마이그레이션. User/Project/WorkType을 의미론적으로 추론하여 매핑. 날짜 범위 지정 가능.
argument-hint: [-1d|-7d|-20d] [--dry-run|--execute]
disable-model-invocation: true
allowed-tools: Bash(python *), Read, Grep, Glob
---

# CSV Worklog Migration Skill

CSV 백업 데이터에서 worklog를 PostgreSQL로 증분 마이그레이션합니다.
기존 DB에 이미 데이터가 있으므로 날짜 기반으로 필터링하여 신규 레코드만 추가합니다.

## 사용법

```bash
/migrate-worklogs -7d --dry-run      # 최근 7일 분석 (기본)
/migrate-worklogs -1d --execute      # 어제 데이터 실제 적용
/migrate-worklogs -20d               # 최근 20일 분석
```

## Arguments

| 옵션 | 설명 |
|------|------|
| `-1d`, `-7d`, `-20d` | 날짜 범위 (기본: -7d) |
| `--from YYYY-MM-DD` | 시작 날짜 |
| `--to YYYY-MM-DD` | 종료 날짜 |
| `--dry-run` | 분석만 수행 (기본) |
| `--execute` | 실제 DB 적용 |

## 워크플로우

### Step 1: CSV 분석
- `$CSV_BACKUP_PATH/tb_worklog.csv` 로드 (기본: .env의 CSV_BACKUP_PATH)
- 날짜 범위로 필터링
- 중복 체크 (이미 DB에 있는 레코드 제외)

### Step 2: 매핑 추론
User, Project, WorkType을 의미론적으로 추론:

**User 매핑 (4단계)**
1. Person.id → email (db_users.csv) → DB UUID
2. 영문 이름 Jaro-Winkler >= 0.9
3. 한글 이름 포함 검사
4. LLM 추론 (최후 수단)

**Project 매핑 (5단계)**
1. Project.Id → IO code (db_projects.csv) → DB UUID
2. IO code 정확 일치
3. Priority 키워드 (OQC, GEN3+, TUMALO 등)
4. Description 키워드 추출
5. Default project fallback (General/Non-Project)

**WorkType 매핑 (4단계)**
1. Worktype.Id → Legacy 매핑 테이블
2. Title 정확 일치
3. 274개 키워드 매칭
4. Description AI 추론

### Step 3: 리포트 생성
매핑 결과를 리포트로 출력:
- 성공/실패 건수
- 추론된 매핑 목록
- 저신뢰도 항목 경고

### Step 4: 사용자 확인
`--execute` 옵션 시 사용자 확인 후 DB 적용

## 실행 방법

```bash
cd backend
source ../.venv/bin/activate
python -m scripts.ai_migrate_worklogs $ARGUMENTS
```

## 환경 변수 (.env)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 연결 (localhost 사용 시 주석 해제) | `db:5432` |
| `CSV_BACKUP_PATH` | CSV 백업 폴더 경로 | `backups/latest` |
| `MIGRATION_REPORT_PATH` | 리포트 저장 경로 | `backend/reports` |

## 주의사항

### 과거 실패 케이스 방지
- **GEN3 vs GEN3+**: Priority 기반으로 GEN3+ 우선 매칭
- **LEGACY 프로젝트**: 888888 시리즈 명시적 제외
- **z [Closed]**: 프로젝트명에 포함된 경우 제외

### 컬럼 매핑
| CSV 컬럼 | 처리 |
|----------|------|
| `Createdby.Id` | Person.id → email → UUID (2단계 lookup) |
| `Project.Id` | CSV 내부 ID → IO code → UUID |
| `Worktype.Id` | Legacy 매핑 테이블 참조 |
| `SuddenWork?` | "TRUE"/"FALSE" → Boolean |

### 중복 방지
4-key 복합키로 중복 체크: `(user_id, project_id, date, hours)`

## 참고 문서

- [매핑 규칙 상세](./mapping-rules.md)
- [기존 동기화 스크립트](../../backend/scripts/sync_from_pbi.py)
- [Fuzzy 매칭 서비스](../../backend/app/services/matching_service.py)
- [키워드 매핑](../../backend/app/services/keyword_mappings.py)
