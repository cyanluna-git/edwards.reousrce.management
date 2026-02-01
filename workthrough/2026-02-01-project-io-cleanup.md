# Project & Internal IO 정리 및 Active Projects 필터링

## 개요
프로젝트와 Internal IO 데이터를 대폭 정리하고, Active Projects 탭에서 활성 프로젝트만 표시하도록 개선했습니다.

## 주요 변경사항

### 1. Internal IO 정리

#### 미사용 IO 삭제
- 프로젝트에 연결되지 않은 15개 IO 삭제
- 888888 시리즈 Sustaining IO 6개 삭제
- SUN/VSS Matrix IO 전체 삭제

#### 자식 IO 통합
- `406442-122`, `406442-132` → `406442`로 통합
- `406886-120` → `406886`로 통합
- 총 28개 자식 IO를 부모 IO로 통합 후 삭제

#### IO 이름 자동 추론
- 96개 IO에 프로젝트 이름 기반으로 이름 자동 부여
- 예: `406428` → "Abatement & SEC Projects"

#### 비활성화 처리
- PRJ-* 패턴 IO 9개를 비활성화 (과거 데이터 보존)

### 2. 프로젝트 정리

#### Worklog 없는 프로젝트 삭제
- 79개 프로젝트 삭제 (worklog 입력 이력 없음)
- 연관된 537개 Resource Plan도 함께 삭제

#### 프로젝트 이름 정리
- 년도 접두어 제거: `2025 Ar Degasser` → `Ar Degasser`
- `z [Closed]` 접두어 제거 및 Completed 상태로 변경

#### Start/End Month 자동 설정
- 67개 프로젝트의 기간을 실제 worklog 날짜 기반으로 업데이트

### 3. Frontend 개선

#### Active Projects 탭 필터링
- InProgress, Prospective 상태만 표시
- 활성 프로젝트가 없는 Product Line/Business Unit 자동 숨김

```typescript
// frontend/src/components/projects/ProjectHierarchyEditor.tsx
const ACTIVE_STATUSES = ['InProgress', 'Prospective'];

const filterActiveProjects = (projects: any[]): any[] => {
    if (!projects) return [];
    return projects.filter(p => ACTIVE_STATUSES.includes(p.status));
};

const activeProductProjects = useMemo(() => {
    return productProjects.map((bu: any) => ({
        ...bu,
        children: bu.children?.map((pl: any) => ({
            ...pl,
            children: filterActiveProjects(pl.children || [])
        })).filter((pl: any) => pl.children && pl.children.length > 0) || []
    })).filter((bu: any) => bu.children && bu.children.length > 0);
}, [productProjects]);
```

#### Internal IO 선택 시 None 허용
- `useInlineProjectEdit.ts`: 빈 문자열을 null로 변환
- `types/index.ts`: ID 필드에 `| null` 타입 추가

```typescript
// frontend/src/hooks/useInlineProjectEdit.ts
const cleanedFields = { ...editState.fields };
const idFields = ['internal_io_id', 'recharge_io_id', 'pm_id', ...] as const;
for (const field of idFields) {
    if (cleanedFields[field] === '') {
        cleanedFields[field] = null;
    }
}
```

### 4. 신규 프로젝트/IO 생성

#### LPLN SAVAS 프로젝트
- IO 407111과 연결
- 55개 worklog 이전 (다른 프로젝트에서 이동)

#### OQC Digitalization IO
- IO 625110 신규 생성
- OQC Digitalization Infrastructure 프로젝트에 연결

## 최종 현황

| 항목 | 이전 | 이후 |
|---|---|---|
| 프로젝트 | 146개 | 68개 |
| Internal IO (Active) | 132개 | 48개 |
| Internal IO (Inactive) | 0개 | 9개 |

## 검증 결과

```bash
# Frontend 빌드 성공
docker compose up -d --build frontend
✓ built in 5.13s

# 프로젝트 수 확인
SELECT COUNT(*) FROM projects;
-- 68 rows

# Active IO 수 확인
SELECT COUNT(*) FROM internal_ios WHERE is_active = true;
-- 48 rows
```

## 다음 단계
- Product Line 할당이 필요한 Ungrouped 프로젝트 정리
- Sustaining/Functional 프로젝트 구조 재검토
