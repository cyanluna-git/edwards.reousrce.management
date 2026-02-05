# My FTE Section 구현 계획

## 개요
User Dashboard의 Monthly 뷰 하단에 "My FTE" 섹션을 추가하여 사용자의 계획된 FTE와 실제 투입 FTE를 비교 표시한다.

## 데이터 구조

### 응답 스키마 (MyFTEResponse)
```python
{
  "year": 2026,
  "month": 2,
  "working_hours_per_month": 160,  # FTE 계산 기준
  "summary": {
    "planned_fte": 1.0,
    "actual_fte": 1.03,
    "utilization_percent": 103
  },
  "product_functional": {
    "planned": [
      {
        "project_id": "...",
        "project_code": "406365",
        "project_name": "High Performance...",
        "category": "PRODUCT",
        "planned_fte": 0.8,
        "actual_fte": 0.65,
        "utilization_percent": 81
      }
    ],
    "unplanned": [
      {
        "project_id": "...",
        "project_code": "406399",
        "project_name": "Havasu",
        "category": "FUNCTIONAL",
        "planned_fte": 0,
        "actual_fte": 0.05,
        "utilization_percent": null  # 계획 없음
      }
    ]
  },
  "support": [
    {
      "project_id": "...",
      "project_code": "SUP-001",
      "project_name": "Support Project A",
      "category": "SUPPORT",
      "actual_fte": 0.03
    }
  ]
}
```

## 구현 단계

### Phase 1: Backend API

#### 1.1 스키마 추가
**파일:** `backend/app/schemas/dashboard.py`

```python
class MyFTEProjectItem(BaseModel):
    project_id: str
    project_code: str
    project_name: str
    category: str  # PRODUCT, FUNCTIONAL, SUPPORT
    planned_fte: float | None
    actual_fte: float
    utilization_percent: float | None

class MyFTESummary(BaseModel):
    planned_fte: float
    actual_fte: float
    utilization_percent: float

class MyFTEProductFunctional(BaseModel):
    planned: list[MyFTEProjectItem]
    unplanned: list[MyFTEProjectItem]

class MyFTEResponse(BaseModel):
    year: int
    month: int
    working_hours_per_month: int
    summary: MyFTESummary
    product_functional: MyFTEProductFunctional
    support: list[MyFTEProjectItem]
```

#### 1.2 서비스 로직
**파일:** `backend/app/services/dashboard_service.py`

`get_my_fte(user_id, year, month)` 메서드 추가:
1. ResourcePlan 조회 (user_id, year, month)
2. WorkLog 조회 (user_id, 해당 월 전체)
3. 프로젝트별 집계:
   - planned_hours → planned_fte (÷160)
   - actual_hours → actual_fte (÷160)
4. 카테고리별 분류 (PRODUCT/FUNCTIONAL vs SUPPORT)
5. 계획 유무로 분리 (planned vs unplanned)

#### 1.3 API 엔드포인트
**파일:** `backend/app/api/endpoints/dashboard.py`

```python
@router.get("/my-fte", response_model=MyFTEResponse)
def get_my_fte(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = DashboardService(db)
    return service.get_my_fte(current_user.id, year, month)
```

### Phase 2: Frontend

#### 2.1 API 클라이언트 타입
**파일:** `frontend/src/api/client.ts`

```typescript
export interface MyFTEProjectItem {
  project_id: string;
  project_code: string;
  project_name: string;
  category: 'PRODUCT' | 'FUNCTIONAL' | 'SUPPORT';
  planned_fte: number | null;
  actual_fte: number;
  utilization_percent: number | null;
}

export interface MyFTEResponse {
  year: number;
  month: number;
  working_hours_per_month: number;
  summary: {
    planned_fte: number;
    actual_fte: number;
    utilization_percent: number;
  };
  product_functional: {
    planned: MyFTEProjectItem[];
    unplanned: MyFTEProjectItem[];
  };
  support: MyFTEProjectItem[];
}

export const getMyFTE = (year: number, month: number) =>
  apiClient.get<MyFTEResponse>(`/dashboard/my-fte?year=${year}&month=${month}`);
```

#### 2.2 커스텀 훅
**파일:** `frontend/src/hooks/useDashboard.ts`

```typescript
export function useMyFTE(year: number, month: number) {
  return useQuery({
    queryKey: ['my-fte', year, month],
    queryFn: () => getMyFTE(year, month).then(r => r.data),
    enabled: !!year && !!month,
  });
}
```

#### 2.3 UI 컴포넌트
**파일:** `frontend/src/components/dashboard/MyFTECard.tsx`

구조:
```tsx
<Card>
  <CardHeader>
    <CardTitle>이번 달 나의 리소스 배분</CardTitle>
    <Badge>계획 {summary.planned_fte} FTE / 실적 {summary.actual_fte} FTE</Badge>
  </CardHeader>
  <CardContent>
    {/* Product / Functional 섹션 */}
    <Section title="Product / Functional">
      {/* 계획된 프로젝트 */}
      <SubSection label="계획됨">
        {product_functional.planned.map(item => (
          <FTEProgressBar
            project={item}
            showComparison={true}
          />
        ))}
      </SubSection>

      {/* 계획 외 투입 */}
      {product_functional.unplanned.length > 0 && (
        <SubSection label="계획 외">
          {product_functional.unplanned.map(item => (
            <FTEProgressBar
              project={item}
              showComparison={false}
            />
          ))}
        </SubSection>
      )}
    </Section>

    {/* Support 섹션 */}
    {support.length > 0 && (
      <Section title="Support">
        {support.map(item => (
          <FTESimpleRow project={item} />
        ))}
        <TotalRow total={supportTotalFTE} />
      </Section>
    )}

    {/* 총계 */}
    <TotalSummary summary={summary} />
  </CardContent>
</Card>
```

### Phase 3: 통합

#### 3.1 DashboardPage에 추가
**파일:** `frontend/src/pages/DashboardPage.tsx`

Monthly 뷰 선택 시 하단에 `<MyFTECard year={year} month={month} />` 추가

```tsx
{viewMode === 'monthly' && (
  <MyFTECard
    year={currentDate.getFullYear()}
    month={currentDate.getMonth() + 1}
  />
)}
```

## 파일 변경 목록

### 신규 파일
| 파일 | 설명 |
|------|------|
| `frontend/src/components/dashboard/MyFTECard.tsx` | My FTE 카드 컴포넌트 |

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `backend/app/schemas/dashboard.py` | MyFTE 관련 스키마 추가 |
| `backend/app/services/dashboard_service.py` | get_my_fte() 메서드 추가 |
| `backend/app/api/endpoints/dashboard.py` | /my-fte 엔드포인트 추가 |
| `frontend/src/api/client.ts` | MyFTE 타입 및 API 함수 추가 |
| `frontend/src/hooks/useDashboard.ts` | useMyFTE 훅 추가 |
| `frontend/src/pages/DashboardPage.tsx` | MyFTECard 통합 |

## UI 디자인 상세

### FTE Progress Bar (계획 있는 경우)
```
프로젝트A (PRODUCT)
████████░░░░░░░░ 계획 0.8 FTE
██████░░░░░░░░░░ 실적 0.65 FTE (81%)
```

### FTE Simple Row (계획 없는 경우)
```
프로젝트C (FUNCTIONAL)    실적 0.05 FTE
```

### Support Row
```
Support-A                 0.03 FTE
Support-B                 0.05 FTE
────────────────────────────────────
합계                      0.08 FTE
```

### Total Summary
```
┌────────────────────────────────────┐
│ 총계  계획 1.0 FTE  실적 1.03 FTE  │
│       (103% - 초과) ⚠️              │
└────────────────────────────────────┘
```

## 검증 방법
1. `pytest tests/test_dashboard.py -v` - 백엔드 테스트
2. `pnpm build` - 프론트엔드 빌드 확인
3. 로그인 후 User Dashboard > Monthly 선택 시 My FTE 카드 표시 확인
4. 계획된/계획 외/Support 분류 정확성 확인
5. FTE 계산값 정확성 확인 (hours ÷ 160)
