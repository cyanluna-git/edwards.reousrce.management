# Recharge IO 기능 추가 완료

## 개요
프로젝트에 비용 청구(Recharge)용 IO 테이블을 별도로 추가하여, Internal IO와 Recharge IO를 분리하여 관리할 수 있게 했다. 이전 세션에서 Internal IO 마이그레이션이 완료되었고, 이번에는 Recharge IO CRUD API와 프론트엔드 hooks를 추가했다.

## 데이터 모델 구조

```
┌─────────────────┐         ┌──────────────────┐
│  internal_ios   │         │   recharge_ios   │
├─────────────────┤         ├──────────────────┤
│ id (PK)         │         │ id (PK)          │
│ io_number (UQ)  │         │ io_number (UQ)   │
│ name            │         │ name             │
│ description     │         │ description      │
│ is_active       │         │ is_active        │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         │ 1:N                       │ 1:N
         ▼                           ▼
┌─────────────────────────────────────────────┐
│                  projects                    │
├─────────────────────────────────────────────┤
│ id (PK)                                     │
│ internal_io_id (FK) → internal_ios.id       │
│ recharge_io_id (FK) → recharge_ios.id       │
│ ...                                         │
└─────────────────────────────────────────────┘
```

## 변경 사항

### 1. Backend - Recharge IO CRUD API 추가

**파일:** `backend/app/api/endpoints/recharge_ios.py` (신규)

```python
# CRUD 엔드포인트 제공
@router.get("/")           # 목록 조회 (검색, 필터링)
@router.get("/{io_id}")    # ID로 조회
@router.get("/by-number/{io_number}")  # IO 번호로 조회
@router.post("/")          # 생성
@router.put("/{io_id}")    # 수정
@router.delete("/{io_id}") # 삭제 (참조 중인 프로젝트 있으면 거부)
@router.post("/find-or-create")  # 있으면 반환, 없으면 생성
```

### 2. Backend - 라우터 등록

**파일:** `backend/app/main.py`

```python
from app.api.endpoints import (
    ...
    internal_ios,
    recharge_ios,  # 추가
)

app.include_router(
    recharge_ios.router, prefix="/api/recharge-ios", tags=["Recharge IOs"]
)
```

### 3. Frontend - API 클라이언트 함수 추가

**파일:** `frontend/src/api/client.ts`

Internal IO와 Recharge IO 모두에 대한 API 함수 추가:

```typescript
// Internal IO API
export const getInternalIOs = async (params?): Promise<InternalIOResponse[]>
export const getInternalIO = async (id: string): Promise<InternalIOResponse>
export const createInternalIO = async (data: InternalIOCreate): Promise<InternalIOResponse>
export const updateInternalIO = async (id: string, data: InternalIOUpdate): Promise<InternalIOResponse>
export const deleteInternalIO = async (id: string): Promise<void>
export const findOrCreateInternalIO = async (data: InternalIOCreate): Promise<InternalIOResponse>

// Recharge IO API
export const getRechargeIOs = async (params?): Promise<RechargeIOResponse[]>
export const getRechargeIO = async (id: string): Promise<RechargeIOResponse>
export const createRechargeIO = async (data: RechargeIOCreate): Promise<RechargeIOResponse>
export const updateRechargeIO = async (id: string, data: RechargeIOUpdate): Promise<RechargeIOResponse>
export const deleteRechargeIO = async (id: string): Promise<void>
export const findOrCreateRechargeIO = async (data: RechargeIOCreate): Promise<RechargeIOResponse>
```

### 4. Frontend - React Query Hooks 추가

**파일:** `frontend/src/hooks/useInternalIOs.ts` (신규)
**파일:** `frontend/src/hooks/useRechargeIOs.ts` (신규)

```typescript
// useInternalIOs.ts
export function useInternalIOsList(params?)
export function useInternalIO(id: string)
export function useCreateInternalIO()
export function useUpdateInternalIO()
export function useDeleteInternalIO()
export function useFindOrCreateInternalIO()

// useRechargeIOs.ts
export function useRechargeIOsList(params?)
export function useRechargeIO(id: string)
export function useCreateRechargeIO()
export function useUpdateRechargeIO()
export function useDeleteRechargeIO()
export function useFindOrCreateRechargeIO()
```

## 검증 결과

### API 엔드포인트 테스트

```bash
# 목록 조회 (빈 배열 반환)
$ curl -s http://localhost:8004/api/recharge-ios/
[]
HTTP Status: 200

# 생성
$ curl -s -X POST http://localhost:8004/api/recharge-ios/ \
  -H "Content-Type: application/json" \
  -d '{"io_number": "TEST001", "name": "Test Recharge IO"}'
{"io_number":"TEST001","name":"Test Recharge IO","id":"75c40f44-...","is_active":true}
HTTP Status: 200

# 삭제
$ curl -s -X DELETE http://localhost:8004/api/recharge-ios/75c40f44-...
{"message":"Recharge IO deleted successfully"}
HTTP Status: 200
```

### 기존 Internal IO 확인

```bash
$ curl -s http://localhost:8004/api/internal-ios/ | head -c 200
[{"io_number":"148963",...},{"io_number":"404721",...}...]
```

## 이전 세션에서 완료된 작업

1. **Internal IO 마이그레이션** (`006_add_recharge_io_to_projects.py`)
   - `internal_ios` 테이블 생성
   - 기존 `projects.code` 데이터를 `internal_ios`로 이전 (146개 프로젝트)
   - `projects.internal_io_id` FK 컬럼 추가
   - `projects.code` 컬럼 삭제

2. **Recharge IO 테이블 추가**
   - `recharge_ios` 테이블 생성
   - `projects.recharge_io_id` FK 컬럼 추가
   - 부분 인덱스 추가 (`is_active = true`)

3. **SQLAlchemy 모델 업데이트**
   - `backend/app/models/recharge_io.py` 신규 생성
   - `backend/app/models/project.py`에 relationship 추가

4. **프론트엔드 타입 정의**
   - `frontend/src/types/index.ts`에 `RechargeIO` 인터페이스 추가

## IO Management 탭 추가 (2026-02-01 추가 작업)

프로젝트 페이지에 IO 관리 탭을 추가하여 Internal IO와 Recharge IO를 직접 관리할 수 있게 했다.

### 추가된 파일

**`frontend/src/components/projects/IOManagementTab.tsx`**
- Internal IO와 Recharge IO를 관리하는 탭 컴포넌트
- 검색 필터, CRUD 모달, 삭제 확인 다이얼로그 포함
- 테이블 형태로 IO 목록 표시 (IO Number, Name, Description, Status, Actions)

### 수정된 파일

**`frontend/src/components/projects/ProjectHierarchyEditor.tsx`**
- IOManagementTab 컴포넌트 import
- "IO Management" 탭 추가 (5번째 탭)

**`frontend/src/api/client.ts`**
- Internal IO API 함수들 추가
- Recharge IO API 함수들 추가

**`frontend/src/hooks/useInternalIOs.ts`** (신규)
- Internal IO용 React Query hooks

**`frontend/src/hooks/useRechargeIOs.ts`** (신규)
- Recharge IO용 React Query hooks

### 기능

1. **Internal IO 관리**
   - 목록 조회 (검색 가능)
   - 신규 생성
   - 수정
   - 삭제 (참조 중인 프로젝트 있으면 거부)

2. **Recharge IO 관리**
   - 동일한 기능 제공

### 검증 결과

```bash
# Internal IO: 100개 존재
$ curl -s http://localhost:8004/api/internal-ios/ | jq 'length'
100

# Recharge IO: 0개 (아직 데이터 없음)
$ curl -s http://localhost:8004/api/recharge-ios/ | jq 'length'
0
```

## 프로젝트 테이블에 IO 드롭다운 추가 (2026-02-01 추가 작업 2)

프로젝트 인라인 테이블에 Internal IO와 Recharge IO 컬럼을 추가하고, 드롭다운으로 선택할 수 있게 했다.

### 수정된 파일

**`frontend/src/components/projects/EditableCell.tsx`**
- `InternalIOSelectCell` 컴포넌트 추가
- `RechargeIOSelectCell` 컴포넌트 추가

**`frontend/src/components/projects/ProjectInlineTable.tsx`**
- `recharge_io` 컬럼 설정 추가
- `internalIOs`, `rechargeIOs` props 추가
- 테이블 헤더에 Recharge IO 컬럼 추가

**`frontend/src/components/projects/InlineEditableRow.tsx`**
- View 모드: Recharge IO 값 표시
- Edit 모드: Internal IO, Recharge IO 드롭다운 선택

**`frontend/src/components/projects/ProjectHierarchyEditor.tsx`**
- `useInternalIOsList`, `useRechargeIOsList` 훅 사용
- IO 데이터를 `ProjectInlineTable`에 전달

**`frontend/src/hooks/useInlineProjectEdit.ts`**
- `recharge_io_id` 필드 추가

### 테이블 컬럼 순서

| Internal IO | Recharge IO | Name | Category | Status | ... |
|-------------|-------------|------|----------|--------|-----|

## API URL Trailing Slash 수정 (2026-02-01 버그 수정)

### 문제

nginx 프록시를 통해 API 요청 시 FastAPI가 307 Temporary Redirect를 반환하고, 리다이렉트 URL에서 포트 번호가 누락되어 `ERR_CONNECTION_REFUSED` 에러 발생.

```
GET http://localhost/api/internal-ios/?is_active=true net::ERR_CONNECTION_REFUSED
```

### 원인

FastAPI는 trailing slash가 없는 URL을 trailing slash가 있는 URL로 자동 리다이렉트함.
- `/api/internal-ios?...` → 307 redirect → `/api/internal-ios/?...`
- 이때 nginx proxy가 Host 헤더를 제대로 전달하지 못해 포트 번호가 누락됨.

### 해결

`frontend/src/api/client.ts`에서 API URL에 trailing slash 추가:

```typescript
// Before
const response = await apiClient.get(`/internal-ios?${searchParams.toString()}`);

// After
const queryString = searchParams.toString();
const response = await apiClient.get(`/internal-ios/${queryString ? `?${queryString}` : ''}`);
```

수정된 엔드포인트:
- `getInternalIOs()` - GET `/internal-ios/`
- `getRechargeIOs()` - GET `/recharge-ios/`
- `createInternalIO()` - POST `/internal-ios/`
- `createRechargeIO()` - POST `/recharge-ios/`
- `findOrCreateInternalIO()` - POST `/internal-ios/find-or-create/`
- `findOrCreateRechargeIO()` - POST `/recharge-ios/find-or-create/`

## 향후 개선 사항

1. **프로젝트 생성 폼**: ProjectForm에 Internal IO, Recharge IO 드롭다운 추가
2. **검색 기능**: 프로젝트 목록에서 IO 번호로 필터링 기능 추가
3. **리포트**: Recharge IO별 프로젝트 그룹화 보고서
4. **벌크 임포트**: CSV에서 IO 목록 일괄 가져오기
