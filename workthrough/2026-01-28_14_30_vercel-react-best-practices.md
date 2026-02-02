# Vercel React Best Practices 최적화 적용

## 개요
Vercel Engineering의 React/Next.js 성능 최적화 가이드라인을 Edwards 프로젝트에 적용하여 API 호출 감소, 렌더링 성능 향상, 불필요한 리렌더 방지를 구현함.

## 주요 변경사항

### 1. TanStack Query 전역 최적화 (main.tsx)
- `staleTime: 5분` - 데이터를 5분간 fresh 상태로 유지하여 불필요한 refetch 방지
- `gcTime: 30분` - 미사용 데이터를 30분간 캐시에 유지
- `refetchOnWindowFocus: false` - 윈도우 포커스 시 자동 refetch 비활성화
- `retry: 1` - 실패 시 1회만 재시도

### 2. Reference Data 장기 캐싱 (useJobPositionsCrud.ts)
- Job Position 같은 참조 데이터는 30분 staleTime 적용
- 거의 변경되지 않는 데이터에 대한 API 호출 최소화

### 3. content-visibility CSS (index.css)
```css
tbody.virtualized {
  content-visibility: auto;
  contain-intrinsic-size: auto 300px;
}
```
- 화면 밖 콘텐츠 렌더링 지연으로 초기 로딩 속도 향상
- WorkLogTableView의 최대 500개 행에 적용

### 4. React.memo 적용 (ProjectResourceTable.tsx)
- 부모 상태 변경 시 props 변경 없으면 리렌더 방지
- useMemo와 함께 사용하여 최적화 효과 극대화

## 결과
- ✅ 빌드 성공 (3.22s)
- ✅ 번들 크기: 452KB (gzip: 147KB)
- ✅ 이전 Route-level code splitting과 결합하여 61% 초기 번들 감소

## 다음 단계
- 대시보드 차트에 React.memo 적용 검토
- 사용자별 staleTime 커스터마이징 (관리자 vs 일반 사용자)
- React Compiler 도입 시 자동 memoization 활용 검토
