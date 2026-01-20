# Resource Allocation Matrix (마스터 Headcount Sheet) 구현

## 개요
부서별 × 프로젝트(IO)별 × 월별로 개별 인원의 HC(FTE) 집계를 보여주는 동적 매트릭스를 구현했습니다. Program > Projects 계층 구조로 리소스 할당 현황을 한눈에 파악할 수 있으며, 각 셀을 클릭하면 인원별 상세 정보를 확인할 수 있습니다.

## 주요 변경사항

### Backend
- **새 Schema 추가**: `backend/app/schemas/resource_matrix.py`
  - ResourceAllocationDetail: 개별 인원 정보 (이름, 역할, 직급, FTE)
  - MonthlyAllocation, ProjectAllocationRow, ProgramGroup
  - ResourceAllocationMatrix: 전체 매트릭스 구조

- **새 Service 구현**: `backend/app/services/resource_matrix_service.py`
  - `generate_month_range()`: 월 범위 생성 헬퍼
  - `get_resource_allocation_matrix()`: 핵심 집계 로직
    - ResourcePlan 테이블 조회 및 집계
    - FTE 계산: `planned_hours / 160`
    - TBD 지원 (user_id가 NULL인 경우)
    - Program > Project > Month 계층 집계

- **새 Endpoint 추가**: `backend/app/api/endpoints/resource_matrix.py`
  - `GET /api/resource-matrix/allocation`
  - Query params: start_month, end_month, department_id, program_id

### Frontend
- **API Client 확장**: `frontend/src/api/client.ts`
  - TypeScript 인터페이스 정의
  - `getResourceAllocationMatrix()` 함수 추가

- **새 Component**: `frontend/src/components/resource-matrix/ResourceAllocationGrid.tsx`
  - Sticky headers (프로젝트 컬럼 + 월 헤더 고정)
  - Program 레벨 subtotal 행
  - Grand Total 행 (sticky bottom)
  - 셀 클릭 → 인원 상세 모달
  - Hover 효과 및 시각적 피드백

- **새 Page**: `frontend/src/pages/ResourceMatrixPage.tsx`
  - 월 범위 선택 UI (start_month, end_month)
  - Legend 설명
  - ResourceAllocationGrid 컴포넌트 렌더링

- **Routing & Menu 통합**
  - App.tsx: `/resource-matrix` 라우트 추가
  - Sidebar.tsx: "Resource Matrix" 메뉴 추가 (Monitoring 섹션)

## 핵심 코드

### Backend - FTE 집계 로직
```python
# resource_matrix_service.py
for plan in resource_plans:
    month_key = f"{plan.year}-{plan.month:02d}"
    fte = round(plan.planned_hours / 160, 2)  # 160h = 1 FTE

    detail = ResourceAllocationDetail(
        user_id=plan.user_id,
        name=plan.user.name if plan.user else "TBD",
        role=plan.project_role.name if plan.project_role else "-",
        position=plan.position.name,
        fte=fte,
    )

    matrix_data[program_id][project_id][month_key].append(detail)
```

### Frontend - Sticky Table Grid
```tsx
<table className="border-collapse w-full text-sm">
  <thead className="sticky top-0 bg-slate-100 z-20">
    <th className="sticky left-0 bg-slate-200 z-30">
      Program / Project
    </th>
    {months.map(month => <th>{month}</th>)}
  </thead>
  <tbody>
    {/* Program rows + Project rows + Grand Total */}
  </tbody>
</table>
```

## 결과
- ✅ Backend API 구현 완료
- ✅ Frontend UI 구현 완료
- ✅ Routing 및 메뉴 통합 완료
- ✅ 계층 구조 집계 (Program > Project > Month)
- ✅ TBD 리소스 지원
- ✅ 실시간 Total 계산

## 다음 단계

### 단기 개선
- Excel Export 기능 추가 (xlsx 다운로드)
- 필터 기능 강화 (부서별, 프로그램별 필터)
- 드래그 앤 드롭으로 리소스 재할당
- 셀 인라인 편집 기능

### 중기 개선
- 가용 리소스 vs 할당 리소스 Gap 시각화
- 색상 코딩 (초과 할당 빨간색, 부족 노란색)
- 부서별 Capacity 한계 설정 및 경고
- 월별 비교 차트 추가

### 데이터 품질
- Standing IO 데이터 시딩 (엑셀 → DB)
- Program/ProjectType 마스터 데이터 정비
- 실제 ResourcePlan 데이터 입력

### 성능 최적화
- 큰 데이터셋에서 가상 스크롤링 적용
- 백엔드 쿼리 최적화 (인덱스 추가)
- 프론트엔드 메모이제이션 (React.memo)
