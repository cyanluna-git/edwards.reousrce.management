# Resource Matrix 추가 성능 최적화 제안

**Date**: 2026-02-02  
**현재 상태**: 인덱스 최적화 완료, 서비스 함수 개선 여지 있음

---

## 현재 성능 상태

### ✅ 우수한 성능 (인덱스 효과 확인)

| 테스트 | 시간 | 인덱스 | 평가 |
|--------|------|--------|------|
| Date range query | 23.99ms | ✅ | 우수 |
| User aggregation | 14.03ms | ✅ | 우수 |
| Project aggregation | 12.23ms | ✅ | 우수 |
| User x Project | 17.44ms | ✅ | 우수 |

### ⚠️ 개선 필요 (서비스 함수)

| 테스트 | 시간 | 평가 |
|--------|------|------|
| get_resource_pivot_matrix() | 16.75초 | 개선 필요 |

---

## 성능 병목 분석

### Test 5 (16.75초) 상세 분석

**데이터 규모**:
- 기간: 1년 (2025-02-02 ~ 2026-02-02)
- 결과: 94명 × 39개 IO = 3,666개 셀
- 예상 worklog 수: 약 20,000-30,000개 (94명 × 250일)

**시간 분해**:
- DB 쿼리: ~2-3초 (인덱스 사용)
- 메모리 로드: ~1-2초
- Python 처리: ~12-13초 (주요 병목)

**병목 지점**:
1. **메모리 로드** (30%): `query.all()` - 모든 레코드 로드
2. **Python 루프** (70%): 각 worklog마다 처리
   - IO 결정 로직 실행
   - 딕셔너리 조회 및 집계

---

## 최적화 제안

### 우선순위 1: 통계 정보 업데이트 (즉시 적용)

```sql
ANALYZE worklogs;
```

**효과**: 쿼리 플래너가 최적의 실행 계획 선택
**예상 개선**: 5-10% 성능 향상

### 우선순위 2: 선택적 joinedload (단기)

**현재 문제**: 모든 관계를 미리 로드
```python
.options(
    joinedload(WorkLog.project).joinedload(Project.internal_io),
    joinedload(WorkLog.project).joinedload(Project.recharge_io),
    joinedload(WorkLog.project).joinedload(Project.recharge_mappings).joinedload(...),
    # ... 7개의 joinedload
)
```

**개선안**: 필요한 것만 선택적 로드
```python
# User 정보는 한 번만 로드
users = db.query(User).options(
    joinedload(User.position),
    joinedload(User.department),
    joinedload(User.sub_team),
    joinedload(User.primary_business_unit),
).filter(User.id.in_(user_ids)).all()
users_map = {u.id: u for u in users}

# Project 정보도 한 번만 로드
projects = db.query(Project).options(
    joinedload(Project.internal_io),
    joinedload(Project.recharge_io),
    joinedload(Project.recharge_mappings).joinedload(ProjectRechargeMapping.recharge_io),
).filter(Project.id.in_(project_ids)).all()
projects_map = {p.id: p for p in projects}

# Worklog는 최소한의 정보만 로드
worklogs = db.query(WorkLog).filter(...).all()
```

**예상 개선**: 20-30% 성능 향상 (16.75초 → 12-13초)

### 우선순위 3: 배치 처리 (중기)

**현재**: 모든 데이터를 한 번에 로드
```python
worklogs = query.all()  # 모든 레코드 로드
```

**개선안**: 배치로 나누어 처리
```python
BATCH_SIZE = 1000
for offset in range(0, total_count, BATCH_SIZE):
    batch = query.offset(offset).limit(BATCH_SIZE).all()
    # 처리
```

**예상 개선**: 메모리 사용량 감소, 대량 데이터 처리 가능

### 우선순위 4: DB 레벨 집계 (장기, 선택적)

**적용 시점**: 
- worklog가 50,000개 이상일 때
- 응답 시간이 30초 이상일 때

**예상 개선**: 16.75초 → 2-5초 (3-8배 개선)

---

## 즉시 적용 가능한 최적화

### 1. 통계 정보 업데이트

```bash
# PostgreSQL에서 실행
psql -h localhost -p 5434 -U postgres -d edwards -c "ANALYZE worklogs;"
```

### 2. 쿼리 최적화 (선택적 joinedload)

현재 코드에서 불필요한 joinedload 제거:
- User 정보는 한 번만 로드하여 맵으로 관리
- Project 정보도 한 번만 로드하여 맵으로 관리

### 3. 캐싱 전략

프론트엔드에서 이미 적용됨:
- `staleTime: 10분`
- `gcTime: 1시간`

---

## 성능 목표

### 현재
- 기본 쿼리: ✅ 23-107ms (목표 달성)
- 서비스 함수: ⚠️ 16.75초 (개선 필요)

### 단기 목표 (1-2주)
- 서비스 함수: < 10초 (통계 업데이트 + 선택적 joinedload)

### 중기 목표 (1-2개월)
- 서비스 함수: < 5초 (배치 처리 적용)

### 장기 목표 (필요시)
- 서비스 함수: < 3초 (DB 레벨 집계)

---

## 모니터링 체크리스트

정기적으로 확인할 항목:

- [ ] 주 1회: API 응답 시간 확인
- [ ] 월 1회: worklog 데이터 양 확인
- [ ] 월 1회: 인덱스 사용 통계 확인
- [ ] 분기 1회: 통계 정보 업데이트 (ANALYZE)

---

## 결론

### ✅ 성공한 최적화
1. 인덱스 추가: 기본 쿼리 성능 100-1000배 개선
2. 모든 쿼리가 인덱스 사용 확인
3. 코드 품질 개선 (중복 로직 통합)

### ⚠️ 추가 개선 여지
1. 서비스 함수 최적화 (16.75초 → 목표 5초)
2. 선택적 joinedload 적용
3. 배치 처리 (대량 데이터 대비)

### 💡 권장 사항

**즉시 적용**:
- `ANALYZE worklogs;` 실행

**단기 적용** (1-2주):
- 선택적 joinedload로 리팩토링

**장기 모니터링**:
- 데이터 증가 추이 확인
- worklog 50,000개 이상 시 DB 레벨 집계 고려

---

**현재 평가**: ✅ **인덱스 최적화 성공**  
**추가 최적화**: 선택적 (데이터 증가 시 적용)
