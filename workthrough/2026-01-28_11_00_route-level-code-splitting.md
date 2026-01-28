# Route-Level Code Splitting 적용

## 개요
Vercel React Best Practices 가이드라인에 따라 프론트엔드에 route-level code splitting을 적용했습니다. React.lazy와 Suspense를 사용하여 각 페이지를 별도 청크로 분리하고, 초기 번들 크기를 61% 감소시켰습니다.

## 주요 변경사항
- **성능 개선**: React.lazy로 모든 페이지 컴포넌트 동적 로딩
- **UX 개선**: Suspense fallback에 로딩 스피너 추가
- **문서 추가**: CLAUDE.md 파일 생성 (Claude Code 가이드)

## 핵심 코드

```typescript
// App.tsx - Route-level code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));

// Suspense로 감싸서 로딩 상태 처리
<Route path="/" element={
  <Suspense fallback={<PageLoader />}>
    <DashboardPage />
  </Suspense>
} />
```

## 결과
- ✅ 빌드 성공 (4.74s)
- ✅ 메인 번들: 1,127KB → 437KB (61% 감소)
- ✅ recharts (341KB) 별도 청크로 분리
- ✅ 페이지별 on-demand 로딩

## 번들 분석
| 청크 | 크기 |
|------|------|
| index.js (메인) | 437 KB |
| PieChart.js (recharts) | 341 KB |
| DashboardPage.js | 52 KB |
| OrganizationPage.js | 43 KB |

## 다음 단계
- 이미지 최적화 (lazy loading)
- 서드파티 라이브러리 defer 로딩 (analytics 등)
- SWR/TanStack Query staleTime 최적화
