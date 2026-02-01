# Resource Matrix Performance Benchmark Guide

**Date**: 2026-02-02  
**Purpose**: 인덱스 적용 후 성능 개선 확인

---

## 빠른 성능 확인

### 방법 1: 벤치마크 스크립트 실행 (권장)

```bash
cd backend
python scripts/benchmark_resource_matrix.py
```

이 스크립트는 다음을 테스트합니다:
1. 날짜 범위 쿼리 (COUNT)
2. 사용자별 집계 쿼리
3. 프로젝트별 집계 쿼리
4. 사용자 x 프로젝트 집계 쿼리 (리소스 매트릭스 스타일)
5. 실제 `get_resource_pivot_matrix()` 서비스 호출

### 방법 2: 쿼리 실행 계획 확인

```sql
-- PostgreSQL에서 직접 실행
EXPLAIN ANALYZE
SELECT COUNT(*) 
FROM worklogs 
WHERE date >= '2026-01-01' 
  AND date <= '2026-12-31'
  AND project_id IS NOT NULL;
```

**확인 포인트**:
- `Index Scan using ix_worklogs_date` → ✅ 인덱스 사용
- `Seq Scan on worklogs` → ❌ 인덱스 미사용

---

## 예상 성능 개선

### 마이그레이션 전 (인덱스 없음)

| 쿼리 유형 | 예상 시간 | 스캔 방식 |
|----------|----------|----------|
| 날짜 범위 쿼리 | 5-30초 | Seq Scan |
| 사용자별 집계 | 10-30초 | Seq Scan |
| 프로젝트별 집계 | 10-30초 | Seq Scan |
| 리소스 매트릭스 | 15-60초 | Seq Scan |

### 마이그레이션 후 (인덱스 있음)

| 쿼리 유형 | 예상 시간 | 스캔 방식 | 개선율 |
|----------|----------|----------|--------|
| 날짜 범위 쿼리 | 0.5-3초 | Index Scan | 10-100배 |
| 사용자별 집계 | 1-5초 | Index Scan | 10-50배 |
| 프로젝트별 집계 | 1-5초 | Index Scan | 10-50배 |
| 리소스 매트릭스 | 2-10초 | Index Scan | 10-50배 |

---

## 벤치마크 결과 해석

### ✅ 좋은 결과

```
✅ Indexed queries: 5/5
⏱️  Average time (indexed): 1.23s
```

**의미**: 모든 쿼리가 인덱스를 사용하고 있으며, 평균 응답 시간이 빠름

### ⚠️ 개선 필요

```
✅ Indexed queries: 3/5
⚠️  Some queries are using indexes, but not all.
```

**해결 방법**:
```sql
-- 통계 정보 업데이트
ANALYZE worklogs;
```

### ❌ 문제 있음

```
❌ No queries are using indexes!
```

**확인 사항**:
1. 인덱스가 생성되었는지 확인
   ```bash
   python scripts/verify_worklog_indexes.py
   ```

2. 통계 정보 업데이트
   ```sql
   ANALYZE worklogs;
   ```

3. 쿼리 패턴 확인
   - WHERE 절에 인덱스 컬럼 사용 확인
   - 함수나 연산자 사용 시 인덱스 미사용 가능

---

## 상세 성능 분석

### 1. 쿼리 실행 계획 분석

```sql
-- 상세 실행 계획 확인
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT 
    wl.user_id,
    wl.project_id,
    SUM(wl.hours) as total_hours
FROM worklogs wl
WHERE wl.date >= '2026-01-01' 
  AND wl.date <= '2026-12-31'
  AND wl.project_id IS NOT NULL
GROUP BY wl.user_id, wl.project_id;
```

**확인 항목**:
- `Index Scan` vs `Seq Scan`
- `Execution Time` (밀리초)
- `Buffers: shared hit/read` (캐시 효율성)

### 2. 인덱스 사용 통계

```sql
-- 인덱스 사용 빈도 확인
SELECT 
    indexrelname as index_name,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    idx_scan::float / NULLIF(idx_scan + seq_scan, 0) * 100 as index_usage_pct
FROM pg_stat_user_indexes
WHERE relname = 'worklogs'
AND indexrelname LIKE 'ix_worklogs%'
ORDER BY idx_scan DESC;
```

**해석**:
- `scans`: 인덱스가 사용된 횟수
- `index_usage_pct`: 인덱스 사용 비율 (높을수록 좋음)

### 3. 테이블 통계

```sql
-- 테이블 크기 및 통계
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_live_tup as row_count,
    last_vacuum,
    last_analyze
FROM pg_stat_user_tables
WHERE tablename = 'worklogs';
```

---

## API 엔드포인트 성능 테스트

### curl을 사용한 테스트

```bash
# 시간 측정 포함
time curl -s "http://localhost:8004/api/resource-matrix/pivot?start_month=2026-01&end_month=2026-12" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  > /dev/null
```

### Python을 사용한 테스트

```python
import time
import requests

url = "http://localhost:8004/api/resource-matrix/pivot"
params = {
    "start_month": "2026-01",
    "end_month": "2026-12"
}
headers = {"Authorization": "Bearer YOUR_TOKEN"}

start = time.time()
response = requests.get(url, params=params, headers=headers)
elapsed = time.time() - start

print(f"Response time: {elapsed:.2f}s")
print(f"Status: {response.status_code}")
print(f"Data size: {len(response.content)} bytes")
```

---

## 성능 최적화 팁

### 1. 통계 정보 업데이트

정기적으로 통계 정보를 업데이트하여 쿼리 플래너가 최적의 실행 계획을 선택하도록 합니다:

```sql
-- 수동 업데이트
ANALYZE worklogs;

-- 또는 자동 업데이트 설정 (권장)
ALTER TABLE worklogs SET (autovacuum_analyze_scale_factor = 0.01);
```

### 2. 쿼리 최적화

- **인덱스 컬럼 우선 사용**: WHERE 절에서 인덱스가 있는 컬럼을 먼저 필터링
- **함수 사용 피하기**: `WHERE DATE(date) = '2026-01-01'` 대신 `WHERE date >= '2026-01-01' AND date < '2026-02-01'`
- **LIKE 패턴 최적화**: `LIKE 'prefix%'`는 인덱스 사용 가능, `LIKE '%suffix'`는 불가능

### 3. 캐싱 전략

프론트엔드에서 TanStack Query 캐싱 활용:
- `staleTime: 10분` (리소스 매트릭스는 자주 변경되지 않음)
- `gcTime: 1시간` (캐시 유지 시간)

---

## 문제 해결

### 문제 1: 인덱스가 사용되지 않음

**증상**: `Seq Scan`이 계속 나타남

**해결**:
1. 통계 정보 업데이트
   ```sql
   ANALYZE worklogs;
   ```

2. 쿼리 재작성
   - 인덱스 컬럼을 WHERE 절에 포함
   - 함수나 연산자 제거

3. 인덱스 재생성 (최후의 수단)
   ```sql
   REINDEX INDEX ix_worklogs_date;
   ```

### 문제 2: 성능 개선이 없음

**확인 사항**:
1. 데이터 양이 적은 경우 (1000개 미만)
   - 인덱스 오버헤드가 시퀀스 스캔보다 클 수 있음
   - 정상적인 동작

2. 쿼리 패턴이 인덱스와 맞지 않음
   - 복합 인덱스 컬럼 순서 확인
   - 필요한 인덱스 추가 고려

### 문제 3: 메모리 사용량 증가

**원인**: 인덱스는 추가 메모리를 사용합니다

**해결**:
- 인덱스는 디스크에 저장되지만, 자주 사용되는 인덱스는 메모리에 캐시됨
- 일반적으로 읽기 성능 향상이 메모리 사용량 증가보다 훨씬 큼

---

## 성능 모니터링 체크리스트

정기적으로 확인할 항목:

- [ ] 인덱스 사용 통계 확인 (월 1회)
- [ ] 쿼리 실행 계획 확인 (주 1회)
- [ ] API 응답 시간 모니터링 (일 1회)
- [ ] 통계 정보 업데이트 (주 1회)
- [ ] 테이블 크기 모니터링 (월 1회)

---

## 관련 문서

- [마이그레이션 가이드](./MIGRATION_GUIDE.md)
- [최적화 구현 문서](./RESOURCE_MATRIX_OPTIMIZATION_IMPLEMENTATION.md)
- [코드 리뷰 문서](./RESOURCE_MATRIX_CODE_REVIEW.md)

---

**벤치마크 스크립트**: `backend/scripts/benchmark_resource_matrix.py`  
**확인 스크립트**: `backend/scripts/verify_worklog_indexes.py`
