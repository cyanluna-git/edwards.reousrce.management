# 2026-02-01: Local Development Mode & Dashboard Infinite Rendering Fix

## 변경 사항 요약

### 1. Local Development Mode 추가 (`run.py`)

Docker 없이 Backend/Frontend를 직접 실행할 수 있는 개발 모드를 추가했습니다.

**새로운 명령어:**
- `python run.py dev` - DB만 Docker로 시작, 로컬 개발 안내
- `python run.py db` - Database만 Docker로 실행
- `python run.py local-backend` - Backend를 uvicorn으로 로컬 실행
- `python run.py local-frontend` - Frontend를 pnpm dev로 로컬 실행

**사용 예시:**
```bash
# 1. DB 시작
python run.py db

# 2. 새 터미널에서 Backend 실행
python run.py local-backend

# 3. 또 다른 터미널에서 Frontend 실행
python run.py local-frontend
```

---

### 2. Dashboard 무한 렌더링 수정

#### 문제
`DashboardPage.tsx`에서 Team 탭으로 전환 시 무한 렌더링 발생

#### 원인
1. **dateRanges useMemo**: 컴포넌트 내부에서 `new Date()` 생성으로 인한 참조 불일치
2. **Rules of Hooks 위반**: `TeamDashboardContent`에서 `useMemo`가 early return 이후에 호출됨

#### 해결

**DashboardPage.tsx:**
```diff
-const dateRanges = useMemo(() => {
-    const now = new Date();
-    return { weekStart: ..., ... };
-}, []);

+// 컴포넌트 외부에서 1회 계산 (모듈 레벨)
+const STATIC_DATE_RANGES = getStaticDateRanges();
+
+export const DashboardPage = () => {
+    const { weekStart, ... } = STATIC_DATE_RANGES;
```

**TeamDashboardContent.tsx:**
```diff
 const { data: teamData, isLoading, error } = useTeamDashboard(...);
 
+// 모든 훅은 early return 이전에 호출
+const productFunctionalProjects = useMemo(() => { ... }, [...]);
+
 if (isLoading) return <Loading />;
 if (error) return <Error />;
-
-// ❌ 여기서 useMemo 호출하면 Rules of Hooks 위반!
-const productFunctionalProjects = useMemo(() => { ... }, [...]);
```

---

## 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `run.py` | Local development mode 명령어 추가 |
| `frontend/src/pages/DashboardPage.tsx` | dateRanges를 모듈 레벨 상수로 이동 |
| `frontend/src/components/dashboard/TeamDashboardContent.tsx` | useMemo를 early return 이전으로 이동 |
