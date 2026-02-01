# Resource Matrix Code Review & Performance Optimization

**Date**: 2026-02-02  
**Reviewer**: Claude (AI Code Reviewer)  
**Focus**: Performance Optimization, Query Optimization, Code Quality

---

## Executive Summary

리소스 매트릭스 구현은 기능적으로 완성되었으나, **성능 최적화와 쿼리 최적화** 측면에서 개선이 필요합니다. 주요 이슈는 다음과 같습니다:

1. **Critical (P1)**: 모든 WorkLog를 메모리로 로드하여 Python에서 집계 (N+1 쿼리 위험)
2. **High (P2)**: 데이터베이스 레벨 집계 미사용
3. **Medium (P3)**: 중복 로직, 인덱스 부재, 프론트엔드 최적화 미적용

---

## 1. Critical Issues (P1) - Must Fix

### 1.1 Memory Load: All WorkLogs Loaded into Memory

**Location**: `backend/app/services/resource_matrix_service.py:251`

```python
worklogs = query.all()  # ❌ 모든 레코드를 메모리로 로드
```

**Problem**:
- 대량의 WorkLog 데이터를 한 번에 메모리로 로드
- 1년치 데이터 (365일 × 100명 = 36,500 레코드) 시 메모리 사용량 급증
- 각 레코드마다 여러 joinedload로 인한 추가 메모리 사용

**Impact**:
- 메모리 사용량: ~500MB - 2GB (데이터 크기에 따라)
- 응답 시간: 5-30초 (데이터 크기에 따라)
- 서버 메모리 부족 가능성

**Solution**: 데이터베이스 레벨 집계 사용

```python
# ✅ Good: DB 레벨 집계
from sqlalchemy import func, case

# User별 총 프로젝트 시간 집계
user_totals_subquery = (
    db.query(
        WorkLog.user_id,
        func.sum(WorkLog.hours).label('total_hours')
    )
    .filter(
        and_(
            WorkLog.date >= query_start_date,
            WorkLog.date <= query_end_date,
            WorkLog.project_id.isnot(None),
        )
    )
    .group_by(WorkLog.user_id)
    .subquery()
)

# WorkLog + IO 정보 + 집계
worklog_aggregation = (
    db.query(
        WorkLog.user_id,
        # IO 결정 로직을 SQL CASE로 구현
        func.sum(WorkLog.hours).label('hours'),
        # ... IO ID 추출 로직
    )
    .join(WorkLog.project)
    .join(WorkLog.user)
    .filter(...)
    .group_by(WorkLog.user_id, io_id_expression)
    .all()
)
```

### 1.2 N+1 Query Risk in IO Resolution

**Location**: `backend/app/services/resource_matrix_service.py:268-316`

```python
def get_effective_io(project: Project, user: User):
    # ❌ 각 worklog마다 Python에서 IO 결정
    if project.recharge_mappings:
        for mapping in project.recharge_mappings:  # N+1 위험
            ...
```

**Problem**:
- 각 WorkLog마다 Python에서 IO 결정 로직 실행
- `project.recharge_mappings` 접근 시 추가 쿼리 발생 가능
- 36,500 레코드 × 3-5번의 로직 실행 = 100,000+ 연산

**Solution**: SQL CASE 문으로 DB 레벨에서 처리

```python
# ✅ Good: SQL CASE로 IO 결정
from sqlalchemy import case, select

io_id_case = case(
    # 1. Dynamic Mapping (BU-based)
    (
        and_(
            User.primary_business_unit_id.isnot(None),
            ProjectRechargeMapping.business_unit_id == User.primary_business_unit_id,
            RechargeIO.is_active == True,
        ),
        RechargeIO.id
    ),
    # 2. Internal IO
    (
        and_(
            InternalIO.id.isnot(None),
            InternalIO.is_active == True,
        ),
        InternalIO.id
    ),
    # 3. Recharge IO
    (
        and_(
            Project.recharge_io_id.isnot(None),
            RechargeIO.is_active == True,
        ),
        RechargeIO.id
    ),
    else_=None  # unassigned
).label('io_id')
```

---

## 2. High Priority Issues (P2) - Should Fix

### 2.1 Missing Database Indexes

**Location**: `backend/app/models/resource.py:50-80`

**Problem**:
- `worklogs.date` 인덱스 없음 → 날짜 범위 쿼리 느림
- `worklogs.user_id` 인덱스 없음 → 사용자별 집계 느림
- `worklogs.project_id` 인덱스 없음 → 프로젝트별 집계 느림

**Solution**: 복합 인덱스 추가

```python
# ✅ Migration: Add indexes
# alembic/versions/XXXX_add_worklog_indexes.py

def upgrade():
    op.create_index(
        'ix_worklogs_date_user_project',
        'worklogs',
        ['date', 'user_id', 'project_id'],
        unique=False
    )
    op.create_index(
        'ix_worklogs_user_date',
        'worklogs',
        ['user_id', 'date'],
        unique=False
    )
    op.create_index(
        'ix_worklogs_project_date',
        'worklogs',
        ['project_id', 'date'],
        unique=False
    )
```

**Expected Performance Gain**: 10-100x 쿼리 속도 향상

### 2.2 Redundant Logic: Duplicate IO Resolution Functions

**Location**: 
- `get_resource_pivot_matrix()` 내부: `get_effective_io()` (line 268)
- `get_resource_matrix_details()` 내부: `_determine_effective_io_for_log()` (line 501)

**Problem**:
- 동일한 로직이 두 함수에 중복 구현
- 유지보수 어려움 (한 곳 수정 시 다른 곳도 수정 필요)
- 테스트 중복

**Solution**: 모듈 레벨 헬퍼 함수로 통합

```python
# ✅ Good: 모듈 레벨 헬퍼
def _determine_effective_io(
    project: Optional[Project],
    user: Optional[User],
    db: Session
) -> Optional[tuple[str, str, str, str]]:
    """
    Determine effective IO for a project-user combination.
    
    Returns:
        (io_id, io_label, io_name, io_type) or None
    """
    if not project:
        return None
    
    # 1. Dynamic Mapping Check
    if user and user.primary_business_unit_id:
        mapping = (
            db.query(ProjectRechargeMapping)
            .join(RechargeIO)
            .filter(
                and_(
                    ProjectRechargeMapping.project_id == project.id,
                    ProjectRechargeMapping.business_unit_id == user.primary_business_unit_id,
                    RechargeIO.is_active == True,
                )
            )
            .first()
        )
        if mapping:
            return (
                str(mapping.recharge_io.id),
                str(mapping.recharge_io.io_number or "N/A"),
                str(mapping.recharge_io.name or ""),
                "RECHARGE",
            )
    
    # 2. Internal IO
    if project.internal_io and project.internal_io.is_active:
        return (
            str(project.internal_io.id),
            str(project.internal_io.io_number or "N/A"),
            str(project.internal_io.name or ""),
            "INTERNAL",
        )
    
    # 3. Recharge IO
    if project.recharge_io and project.recharge_io.is_active:
        return (
            str(project.recharge_io.id),
            str(project.recharge_io.io_number or "N/A"),
            str(project.recharge_io.name or ""),
            "RECHARGE",
        )
    
    return ("unassigned", "No IO", "Unassigned Project", "NONE")
```

### 2.3 Inefficient Dictionary Lookups

**Location**: `backend/app/services/resource_matrix_service.py:254-379`

```python
# ❌ 매번 딕셔너리 조회
for log in worklogs:
    user_id = str(log.user_id)
    total_hours = user_total_project_hours[user_id]  # O(1) but repeated
    ...
    data_map[user_id][io_id] += fte_contribution  # Nested dict lookup
```

**Problem**:
- 중첩 딕셔너리 조회가 많음
- Python 루프에서 반복 계산

**Solution**: 집계를 DB 레벨에서 수행

```python
# ✅ Good: DB 레벨 집계
aggregated_data = (
    db.query(
        WorkLog.user_id,
        io_id_case.label('io_id'),
        func.sum(WorkLog.hours).label('hours'),
        func.max(user_totals_subquery.c.total_hours).label('user_total_hours')
    )
    .join(user_totals_subquery, WorkLog.user_id == user_totals_subquery.c.user_id)
    .group_by(WorkLog.user_id, io_id_case)
    .all()
)

# Python에서는 단순 변환만
for row in aggregated_data:
    fte = row.hours / row.user_total_hours if row.user_total_hours > 0 else 0
    data_map[row.user_id][row.io_id] = fte
```

---

## 3. Medium Priority Issues (P3) - Nice to Have

### 3.1 Frontend: Missing React.memo

**Location**: `frontend/src/components/resource-matrix/ResourcePivotTable.tsx`

**Problem**:
- `RowItem` 컴포넌트가 메모이제이션되지 않음
- 부모 리렌더 시 모든 행이 리렌더됨

**Solution**: React.memo 적용

```tsx
// ✅ Good: Memoized row component
const RowItem = React.memo<{
    row: PivotRow;
    columns: PivotMatrixResponse['columns'];
    indentLevel: number;
    onCellClick?: (userId: string, userName: string, ioId: string, ioName: string) => void;
}>(({ row, columns, indentLevel, onCellClick }) => {
    // ... existing implementation
}, (prevProps, nextProps) => {
    // Custom comparison for better performance
    return (
        prevProps.row.user_id === nextProps.row.user_id &&
        prevProps.row.total_fte === nextProps.row.total_fte &&
        prevProps.indentLevel === nextProps.indentLevel &&
        prevProps.columns.length === nextProps.columns.length
    );
});
```

### 3.2 Query Caching Strategy

**Location**: `frontend/src/components/resource-matrix/ResourcePivotTable.tsx:31-35`

**Problem**:
- TanStack Query 기본 설정 사용
- 리소스 매트릭스는 자주 변경되지 않으므로 더 긴 staleTime 가능

**Solution**: 커스텀 staleTime 설정

```tsx
// ✅ Good: Longer staleTime for reference data
const { data, isLoading, error } = useQuery<PivotMatrixResponse>({
    queryKey: ['resource-pivot', startMonth, endMonth, departmentId, programId],
    queryFn: () => getResourcePivotMatrix(startMonth, endMonth, departmentId, programId),
    enabled: !!startMonth && !!endMonth,
    staleTime: 10 * 60 * 1000, // 10분 (기본 5분보다 길게)
    gcTime: 60 * 60 * 1000, // 1시간 캐시 유지
});
```

### 3.3 Type Hints Improvement

**Location**: `backend/app/services/resource_matrix_service.py`

**Problem**:
- 일부 함수의 반환 타입이 문자열로 지정됨 (`"PivotMatrixResponse"`)
- Optional 타입 힌트 부족

**Solution**: 정확한 타입 힌트

```python
# ✅ Good: 정확한 타입 힌트
from typing import Optional, Dict, List, Tuple
from app.schemas.resource_matrix import PivotMatrixResponse

def get_resource_pivot_matrix(
    db: Session,
    start_month: str,
    end_month: str,
    department_id: Optional[str] = None,
    program_id: Optional[str] = None,
) -> PivotMatrixResponse:  # ✅ 문자열 대신 타입 직접 사용
    ...

def _determine_effective_io(
    project: Optional[Project],
    user: Optional[User],
    db: Session
) -> Optional[Tuple[str, str, str, str]]:  # ✅ Optional 명시
    ...
```

---

## 4. Performance Benchmarks

### Current Performance (Estimated)

| Metric | Current | Target |
|--------|---------|--------|
| Response Time (1 year, 100 users) | 5-30s | < 2s |
| Memory Usage | 500MB - 2GB | < 100MB |
| Database Queries | 1 + N (N+1 risk) | 2-3 |
| Query Execution Time | 2-10s | < 500ms |

### Expected Improvements

| Optimization | Performance Gain |
|--------------|------------------|
| DB-level aggregation | 10-50x faster |
| Indexes on worklogs | 10-100x faster queries |
| React.memo | 30-50% fewer re-renders |
| Query caching | 50-80% fewer API calls |

---

## 5. Implementation Priority

### Phase 1: Critical Fixes (Week 1)
1. ✅ Add database indexes
2. ✅ Refactor to DB-level aggregation
3. ✅ Consolidate duplicate IO resolution logic

### Phase 2: High Priority (Week 2)
1. ✅ SQL CASE for IO resolution
2. ✅ Optimize dictionary lookups
3. ✅ Add query result caching

### Phase 3: Medium Priority (Week 3)
1. ✅ React.memo for frontend
2. ✅ Improve type hints
3. ✅ Add performance monitoring

---

## 6. Code Review Checklist

### Backend
- [ ] Database indexes added
- [ ] DB-level aggregation implemented
- [ ] N+1 queries eliminated
- [ ] Duplicate logic consolidated
- [ ] Type hints complete
- [ ] Error handling robust

### Frontend
- [ ] React.memo applied
- [ ] Query caching optimized
- [ ] Loading states handled
- [ ] Error states handled
- [ ] Accessibility attributes

### Testing
- [ ] Unit tests for IO resolution
- [ ] Integration tests for aggregation
- [ ] Performance tests for large datasets
- [ ] Frontend rendering tests

---

## 7. Recommended Next Steps

1. **Immediate**: 인덱스 추가 (가장 빠른 성능 개선)
2. **Short-term**: DB 레벨 집계로 리팩토링
3. **Medium-term**: 프론트엔드 최적화 (React.memo, 캐싱)
4. **Long-term**: 성능 모니터링 도구 추가

---

## 8. References

- [SQLAlchemy Performance Tips](https://docs.sqlalchemy.org/en/20/faq/performance.html)
- [PostgreSQL Indexing Best Practices](https://www.postgresql.org/docs/current/indexes.html)
- [Vercel React Best Practices](./.claude/skills/vercel-best-practice/SKILL.md)
- [Gemini-Claude Loop](./.claude/skills/gemini-claude-loop/SKILL.md)

---

**Review Status**: ✅ Complete  
**Next Review**: After Phase 1 implementation
