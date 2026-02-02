# Worklog Indexes Migration Guide

**Date**: 2026-02-02  
**Migration**: `010_add_worklog_indexes`  
**Purpose**: 성능 최적화 - 리소스 매트릭스 쿼리 속도 10-100배 향상

---

## 개요

이 마이그레이션은 `worklogs` 테이블에 4개의 인덱스를 추가하여 리소스 매트릭스 쿼리 성능을 대폭 개선합니다.

### 추가되는 인덱스

1. **`ix_worklogs_date`**: 날짜 범위 쿼리 최적화
2. **`ix_worklogs_user_date`**: 사용자별 집계 최적화
3. **`ix_worklogs_project_date`**: 프로젝트별 집계 최적화
4. **`ix_worklogs_date_user_project`**: 복합 필터 쿼리 최적화

---

## 적용 방법

### 방법 1: Alembic 명령어 사용 (권장)

```bash
cd backend
alembic upgrade head
```

### 방법 2: 스크립트 사용

```bash
cd backend
python scripts/apply_worklog_indexes.py
```

**옵션**:
- `--check`: 현재 마이그레이션 상태 확인
- `--rollback`: 마이그레이션 롤백 (필요시)

### 방법 3: Docker 환경에서

```bash
# Docker Compose 사용 시
docker compose exec backend alembic upgrade head

# 또는 컨테이너 내부에서
docker exec -it edwards-api alembic upgrade head
```

---

## 사전 확인

### 1. 현재 마이그레이션 상태 확인

```bash
cd backend
alembic current
```

**예상 출력**:
```
009_add_hierarchy_query_indexes (head)
```

### 2. 마이그레이션 상태 확인 스크립트

```bash
python scripts/apply_worklog_indexes.py --check
```

---

## 적용 후 확인

### 1. 인덱스 생성 확인

```sql
-- PostgreSQL에서 실행
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'worklogs' 
AND indexname LIKE 'ix_worklogs%'
ORDER BY indexname;
```

**예상 결과**:
```
ix_worklogs_date
ix_worklogs_date_user_project
ix_worklogs_project_date
ix_worklogs_user_date
```

### 2. 성능 테스트

```bash
# API 엔드포인트 테스트
curl "http://localhost:8004/api/resource-matrix/pivot?start_month=2026-01&end_month=2026-12" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -w "\nTime: %{time_total}s\n"
```

**예상 개선**:
- 이전: 5-30초
- 이후: 0.5-3초 (10-100배 빠름)

### 3. 쿼리 실행 계획 확인

```sql
EXPLAIN ANALYZE
SELECT wl.*
FROM worklogs wl
WHERE wl.date >= '2026-01-01' 
  AND wl.date <= '2026-12-31'
  AND wl.project_id IS NOT NULL;
```

인덱스가 사용되는지 확인:
- `Index Scan using ix_worklogs_date` 또는
- `Index Scan using ix_worklogs_date_user_project`

---

## 롤백 방법

### 필요시 마이그레이션 롤백

```bash
cd backend
alembic downgrade -1
```

또는 스크립트 사용:
```bash
python scripts/apply_worklog_indexes.py --rollback
```

---

## 주의사항

### 1. 인덱스 생성 시간

- 데이터 양에 따라 인덱스 생성에 시간이 걸릴 수 있습니다
- 10,000개 레코드: ~1-2초
- 100,000개 레코드: ~10-30초
- 1,000,000개 레코드: ~2-5분

### 2. 디스크 공간

- 각 인덱스는 약 10-20%의 추가 디스크 공간을 사용합니다
- 4개 인덱스 = 약 40-80% 추가 공간 필요

### 3. 쓰기 성능

- 인덱스는 SELECT 쿼리를 빠르게 하지만, INSERT/UPDATE는 약간 느려질 수 있습니다
- 일반적으로 읽기 성능 향상이 쓰기 성능 저하보다 훨씬 큽니다

---

## 문제 해결

### 문제 1: "relation already exists" 오류

**원인**: 인덱스가 이미 존재함

**해결**:
```sql
-- 인덱스 확인
SELECT indexname FROM pg_indexes WHERE tablename = 'worklogs';

-- 필요시 수동 삭제 후 재실행
DROP INDEX IF EXISTS ix_worklogs_date;
DROP INDEX IF EXISTS ix_worklogs_date_user_project;
DROP INDEX IF EXISTS ix_worklogs_user_date;
DROP INDEX IF EXISTS ix_worklogs_project_date;
```

### 문제 2: 마이그레이션 실패

**원인**: 데이터베이스 연결 문제 또는 권한 부족

**해결**:
1. DATABASE_URL 확인
2. 데이터베이스 사용자 권한 확인
3. 데이터베이스 연결 테스트

```bash
# 연결 테스트
python -c "from app.core.database import engine; engine.connect(); print('OK')"
```

### 문제 3: 성능 개선이 없음

**원인**: 쿼리가 인덱스를 사용하지 않음

**해결**:
1. 쿼리 실행 계획 확인 (EXPLAIN ANALYZE)
2. 통계 정보 업데이트:
   ```sql
   ANALYZE worklogs;
   ```
3. 쿼리 최적화 확인

---

## 성능 모니터링

### 쿼리 성능 측정

```sql
-- 인덱스 사용 통계 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'worklogs'
ORDER BY idx_scan DESC;
```

### 성능 비교

**마이그레이션 전**:
- 쿼리 시간: 5-30초
- 인덱스 스캔: 0
- 시퀀스 스캔: 전체 테이블

**마이그레이션 후**:
- 쿼리 시간: 0.5-3초
- 인덱스 스캔: 사용됨
- 시퀀스 스캔: 최소화

---

## 관련 문서

- [코드 리뷰 문서](./RESOURCE_MATRIX_CODE_REVIEW.md)
- [최적화 구현 문서](./RESOURCE_MATRIX_OPTIMIZATION_IMPLEMENTATION.md)
- [Alembic 문서](https://alembic.sqlalchemy.org/)

---

## 체크리스트

마이그레이션 적용 전:
- [ ] 데이터베이스 백업 완료
- [ ] 현재 마이그레이션 상태 확인
- [ ] DATABASE_URL 설정 확인

마이그레이션 적용 중:
- [ ] 마이그레이션 실행
- [ ] 오류 없이 완료 확인

마이그레이션 적용 후:
- [ ] 인덱스 생성 확인
- [ ] 성능 테스트 실행
- [ ] 쿼리 실행 계획 확인
- [ ] API 엔드포인트 테스트

---

**마이그레이션 버전**: 010_add_worklog_indexes  
**이전 버전**: 009_add_hierarchy_query_indexes  
**적용일**: 2026-02-02
