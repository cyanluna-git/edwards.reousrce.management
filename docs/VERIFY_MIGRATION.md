# 마이그레이션 적용 확인 가이드

**Date**: 2026-02-02  
**Migration**: `010_add_worklog_indexes`

---

## 빠른 확인 방법

### 방법 1: 확인 스크립트 사용 (권장)

```bash
cd backend
python scripts/verify_worklog_indexes.py
```

**예상 출력**:
```
🔍 Verifying worklog indexes...
📊 Database: localhost:5434/edwards

📋 Current migration revision: 010_add_worklog_indexes

📋 Found 4 worklog indexes:

  ✅ ix_worklogs_date
     CREATE INDEX ix_worklogs_date ON worklogs USING btree (date)
  ✅ ix_worklogs_date_user_project
     CREATE INDEX ix_worklogs_date_user_project ON worklogs USING btree (date, user_id, project_id)
  ✅ ix_worklogs_project_date
     CREATE INDEX ix_worklogs_project_date ON worklogs USING btree (project_id, date)
  ✅ ix_worklogs_user_date
     CREATE INDEX ix_worklogs_user_date ON worklogs USING btree (user_id, date)

✅ SUCCESS: All expected indexes are present!
✅ Migration verification complete!
```

### 방법 2: Alembic 명령어로 확인

```bash
cd backend
alembic current
```

**예상 출력**:
```
010_add_worklog_indexes (head)
```

### 방법 3: PostgreSQL에서 직접 확인

```sql
-- 인덱스 목록 확인
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'worklogs' 
AND indexname LIKE 'ix_worklogs%'
ORDER BY indexname;
```

**예상 결과**:
```
indexname                      | indexdef
-------------------------------|--------------------------------------------------
ix_worklogs_date               | CREATE INDEX ix_worklogs_date ON worklogs USING btree (date)
ix_worklogs_date_user_project  | CREATE INDEX ix_worklogs_date_user_project ON worklogs USING btree (date, user_id, project_id)
ix_worklogs_project_date       | CREATE INDEX ix_worklogs_project_date ON worklogs USING btree (project_id, date)
ix_worklogs_user_date          | CREATE INDEX ix_worklogs_user_date ON worklogs USING btree (user_id, date)
```

---

## 상세 확인 항목

### 1. 마이그레이션 버전 확인

```sql
SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1;
```

**예상 결과**: `010_add_worklog_indexes`

### 2. 인덱스 개수 확인

```sql
SELECT COUNT(*) 
FROM pg_indexes 
WHERE tablename = 'worklogs' 
AND indexname LIKE 'ix_worklogs%';
```

**예상 결과**: `4`

### 3. 인덱스 사용 통계 확인

```sql
SELECT 
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'worklogs'
AND indexname LIKE 'ix_worklogs%'
ORDER BY idx_scan DESC;
```

**설명**:
- `scans`: 인덱스가 사용된 횟수
- `tuples_read`: 인덱스를 통해 읽은 튜플 수
- `tuples_fetched`: 인덱스를 통해 가져온 튜플 수

**참고**: 처음에는 0일 수 있습니다. 쿼리를 실행한 후 증가합니다.

### 4. 쿼리 실행 계획 확인

```sql
EXPLAIN ANALYZE
SELECT wl.*
FROM worklogs wl
WHERE wl.date >= '2026-01-01' 
  AND wl.date <= '2026-12-31'
  AND wl.project_id IS NOT NULL
LIMIT 100;
```

**확인 포인트**:
- `Index Scan using ix_worklogs_date` 또는
- `Index Scan using ix_worklogs_date_user_project`

**인덱스가 사용되지 않는 경우**:
- `Seq Scan on worklogs` → 통계 정보 업데이트 필요:
  ```sql
  ANALYZE worklogs;
  ```

---

## 문제 해결

### 문제 1: 인덱스가 보이지 않음

**확인 사항**:
1. 마이그레이션이 실제로 실행되었는지 확인
   ```bash
   alembic current
   ```

2. 데이터베이스 연결 확인
   ```bash
   python -c "from app.core.database import engine; engine.connect(); print('OK')"
   ```

3. 수동으로 인덱스 생성 (비권장)
   ```sql
   CREATE INDEX IF NOT EXISTS ix_worklogs_date ON worklogs (date);
   CREATE INDEX IF NOT EXISTS ix_worklogs_user_date ON worklogs (user_id, date);
   CREATE INDEX IF NOT EXISTS ix_worklogs_project_date ON worklogs (project_id, date);
   CREATE INDEX IF NOT EXISTS ix_worklogs_date_user_project ON worklogs (date, user_id, project_id);
   ```

### 문제 2: 인덱스가 사용되지 않음

**해결 방법**:
1. 통계 정보 업데이트
   ```sql
   ANALYZE worklogs;
   ```

2. 쿼리 최적화 확인
   - WHERE 절에 인덱스 컬럼 사용 확인
   - 함수나 연산자 사용 시 인덱스 미사용 가능

3. PostgreSQL 설정 확인
   ```sql
   SHOW enable_seqscan;  -- false 권장 (개발 환경)
   SHOW random_page_cost;  -- 1.1 권장 (SSD)
   ```

---

## 성능 테스트

### API 엔드포인트 테스트

```bash
# 시간 측정 포함
time curl -s "http://localhost:8004/api/resource-matrix/pivot?start_month=2026-01&end_month=2026-12" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  > /dev/null
```

**예상 결과**:
- 마이그레이션 전: 5-30초
- 마이그레이션 후: 0.5-3초

### 쿼리 성능 비교

```sql
-- 인덱스 사용 전 (시퀀스 스캔)
EXPLAIN ANALYZE
SELECT COUNT(*) FROM worklogs 
WHERE date >= '2026-01-01' AND date <= '2026-12-31';

-- 인덱스 사용 후 (인덱스 스캔)
-- 같은 쿼리지만 인덱스가 사용됨
```

---

## 체크리스트

마이그레이션 확인:
- [ ] `alembic current` 명령으로 버전 확인
- [ ] `verify_worklog_indexes.py` 스크립트 실행
- [ ] 4개 인덱스 모두 존재 확인
- [ ] 인덱스 정의 확인

성능 확인:
- [ ] 쿼리 실행 계획에서 인덱스 사용 확인
- [ ] API 응답 시간 측정
- [ ] 인덱스 사용 통계 확인

---

**관련 문서**:
- [마이그레이션 가이드](./MIGRATION_GUIDE.md)
- [최적화 구현 문서](./RESOURCE_MATRIX_OPTIMIZATION_IMPLEMENTATION.md)
