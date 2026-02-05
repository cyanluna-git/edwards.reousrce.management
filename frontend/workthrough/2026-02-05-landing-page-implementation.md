# 로그인 페이지 랜딩페이지 구현

## 개요
로그인 화면에서 접근 가능한 랜딩페이지를 추가하여 Edwards Engineering Management Board의 목적, 기능, 사용법을 소개하는 페이지를 구현했다. Mock UI(코드 렌더링)와 CSS 애니메이션을 사용하여 별도 이미지 파일이나 추가 패키지 없이 구현 완료.

## 컨텍스트
- **목적**: 신규 사용자가 포털의 기능을 쉽게 이해할 수 있도록 소개 페이지 제공
- **제약사항**: 추가 패키지 없이 기존 스택(React, Tailwind, lucide-react)만 사용
- **접근성**: `prefers-reduced-motion` 미디어 쿼리로 모션 감소 선호 사용자 지원

## 변경 내용

### 1. 신규 파일: useIntersectionObserver 훅
- **파일**: `frontend/src/hooks/useIntersectionObserver.ts`
- 스크롤 시 요소가 뷰포트에 들어왔는지 감지하는 커스텀 훅
- IntersectionObserver API 사용, threshold 0.1 기본값

### 2. 신규 파일: LandingPage 컴포넌트
- **파일**: `frontend/src/pages/LandingPage.tsx`
- 약 300줄의 완전한 랜딩페이지 구현
- 5개 섹션: Hero, Problem Statement, Feature Showcase, How It Works, Footer
- 5개 Mock UI 컴포넌트: WorklogMockUI, ResourceMatrixMockUI, TimelineMockUI, DashboardMockUI, AISummaryMockUI

### 3. CSS 애니메이션 추가
- **파일**: `frontend/src/index.css`
- `.fade-in-section` 클래스: 스크롤 트리거 페이드인 효과
- `.animate-bounce-down` 클래스: 스크롤 인디케이터 바운스 애니메이션
- `@media (prefers-reduced-motion: reduce)` 접근성 지원

### 4. 라우팅 업데이트
- **파일**: `frontend/src/App.tsx`
- 비인증 상태: `/` → LandingPage, `/login` → LoginPage
- catch-all 라우트: `/login` 대신 `/`로 리다이렉트

### 5. 페이지 export 추가
- **파일**: `frontend/src/pages/index.ts`
- `LandingPage` export 추가

### 6. 로그인 페이지 링크 추가
- **파일**: `frontend/src/pages/LoginPage.tsx`
- Footer에 "포털 소개" 링크 추가 (→ `/`)
- `Link` 컴포넌트와 `Info` 아이콘 import

### 7. 기존 빌드 오류 수정 (부수적)
- `TeamDashboardContent.tsx`: 미사용 `setTeamViewMode` 파라미터 처리
- `ResourcesTab.tsx`: 미사용 `queryClient` 변수 처리

## 코드 예시

### useIntersectionObserver 훅
```typescript
// frontend/src/hooks/useIntersectionObserver.ts
export function useIntersectionObserver(options?: IntersectionObserverInit) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1, ...options }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [options]);

  return { ref, isVisible };
}
```

### FadeInSection 래퍼 컴포넌트
```tsx
// frontend/src/pages/LandingPage.tsx
function FadeInSection({ children, className = '' }) {
  const { ref, isVisible } = useIntersectionObserver();
  return (
    <div
      ref={ref}
      className={`fade-in-section ${isVisible ? 'visible' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
```

### Mock UI 예시 (리소스 매트릭스)
```tsx
function ResourceMatrixMockUI() {
  return (
    <div className="rounded-xl border bg-white shadow-lg p-3 w-56">
      <div className="text-xs font-medium text-slate-600 mb-2">Resource Matrix</div>
      <div className="grid grid-cols-4 gap-1">
        {['Jan', 'Feb', 'Mar', 'Apr'].map((m) => (
          <div key={m} className="text-[8px] text-slate-400 text-center">{m}</div>
        ))}
        {[0.8, 0.6, 1.0, 0.4, 0.5, 0.9, 0.7, 0.3].map((v, i) => (
          <div key={i} className="h-5 rounded"
            style={{ backgroundColor: `rgba(59, 130, 246, ${v})` }}
          />
        ))}
      </div>
    </div>
  );
}
```

### CSS 애니메이션 (접근성 포함)
```css
/* frontend/src/index.css */
.fade-in-section {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}
.fade-in-section.visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .fade-in-section {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

### 라우팅 변경
```tsx
// frontend/src/App.tsx (비인증 라우트)
{!isAuthenticated && (
  <>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="*" element={<Navigate to="/" />} />
  </>
)}
```

## 검증 결과

### 빌드 성공
```bash
> pnpm build
✓ 3420 modules transformed
✓ built in 3.18s

dist/index.html                    0.44 kB │ gzip:   0.30 kB
dist/assets/index-25S72e-c.css    60.80 kB │ gzip:  11.21 kB
dist/assets/index-fBJG6NzE.js    479.47 kB │ gzip: 153.44 kB
```

### TypeScript 검증
- 새로 생성된 파일들에서 TypeScript 에러 없음 확인
- 기존 빌드 에러(미사용 변수) 동시 수정

## 페이지 섹션 상세

| 섹션 | 내용 |
|------|------|
| Hero | 로고, 헤드라인, 서브헤드라인, CTA 버튼, 스크롤 인디케이터 |
| Problem Statement | 3개 문제점 카드 (분산된 데이터, 수동 추적, 제한된 가시성) |
| Feature Showcase | 5개 기능 카드 + Mock UI (워크로그, 리소스, 프로젝트, 대시보드, AI 요약) |
| How It Works | 3단계 플로우 (업무 기록 → 리소스 계획 → 추적 & 분석) |
| Footer | CTA 버튼, 저작권 표시 |

## 향후 개선사항

1. **실제 스크린샷 추가**: Playwright 자동화로 실제 화면 캡처 가능
2. **애니메이션 고도화**: Framer Motion 도입 시 더 풍부한 인터랙션 구현 가능
3. **다국어 지원**: i18n 적용 시 영문/한글 전환 기능 추가 가능
4. **A/B 테스트**: CTA 버튼 위치/문구 최적화 테스트 가능

## 파일 변경 요약

| 파일 | 작업 |
|------|------|
| `hooks/useIntersectionObserver.ts` | 신규 생성 |
| `pages/LandingPage.tsx` | 신규 생성 |
| `index.css` | 애니메이션 클래스 추가 |
| `pages/index.ts` | LandingPage export 추가 |
| `App.tsx` | 라우팅 변경 |
| `pages/LoginPage.tsx` | 포털 소개 링크 추가 |
| `components/dashboard/TeamDashboardContent.tsx` | 미사용 변수 수정 |
| `components/organization/ResourcesTab.tsx` | 미사용 변수 수정 |
