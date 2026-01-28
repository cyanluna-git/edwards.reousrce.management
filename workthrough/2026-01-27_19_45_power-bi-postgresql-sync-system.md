# Power BI Desktop → PostgreSQL 동기화 시스템 구현

## 개요
Power BI Desktop에서 변환된 데이터를 직접 쿼리하여 PostgreSQL로 동기화하는 시스템을 구현했습니다. SharePoint 원본 대신 Power BI에서 이미 정리/변환된 데이터를 사용하며, DB 백업/복원 유틸리티도 함께 개발했습니다.

## 주요 변경사항

### 개발한 것
- **Power BI 커넥터** (`backend/scripts/pbi_connector.py`)
  - Power BI Desktop 로컬 포트 자동 감지
  - DAX 쿼리 실행 → pandas DataFrame 반환
  - pyadomd/pbi-local-connector 지원

- **데이터 변환기** (`backend/app/services/data_transformer.py`)
  - `migrate_sharepoint_data.py` 로직 모듈화
  - Power BI 컬럼 → PostgreSQL 스키마 매핑
  - 값 변환 및 검증 유틸리티

- **동기화 스크립트** (`backend/scripts/sync_from_pbi.py`)
  - Power BI 연결 → DAX 쿼리 → DB upsert
  - Users, Projects, WorkTypes, WorkLogs 동기화
  - dry-run 모드 및 개별 엔티티 동기화 지원

- **DB 백업/복원** (`backend/scripts/db_backup.py`)
  - pg_dump 래퍼로 로컬 DB 백업
  - pg_restore로 서버 DB 복원
  - 백업 목록 조회

### 수정한 것
- `requirements.txt`: pandas 및 Power BI 패키지 주석 추가

## 핵심 코드

```python
# DAX 쿼리 실행 예시
dax_query = "EVALUATE db_users"
df = connector.execute_dax(dax_query)

# 데이터 변환
result = transformer.transform_user(row, hashed_password)
if result.success:
    user = User(**result.data)
    db.add(user)
```

## 사용 방법

```bash
# Power BI Desktop 실행 후

# 연결 테스트
python -m scripts.sync_from_pbi --test

# 전체 동기화
python -m scripts.sync_from_pbi --all

# DB 백업
python -m scripts.db_backup --backup

# 서버로 복원
python -m scripts.db_backup --restore backup_xxx.sql --target server
```

## 결과
- ✅ 모든 Python 파일 문법 검증 통과
- ✅ 4개 신규 파일 생성 완료

## 다음 단계
- Windows 환경에서 실제 Power BI 연결 테스트
- Power BI 테이블 실제 컬럼명 확인 (DAX Studio에서 `INFO.TABLES()`, `INFO.COLUMNS()`)
- macOS 대안: CSV 내보내기 자동화 스크립트
- 대용량 워크로그 (10만+) 배치 처리 최적화
