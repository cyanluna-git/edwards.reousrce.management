# 사이드바 접기/열기 기능 및 레이아웃 개선

## 개요

사용자 인사말을 상단 헤더에서 사이드바로 이동하고, 사이드바 접기/열기 토글 기능을 추가하여 화면 공간을 더 유연하게 활용할 수 있도록 개선했습니다.

## 변경 사항

### 이전 레이아웃
```
┌─────────────────────────────────────────────────────┐
│ Edwards POB │ 👋 안녕하세요, Gerald Park님!     🔔 │ ← 상단 헤더 (h-16)
├─────────────┼───────────────────────────────────────┤
│             │                                       │
│  Sidebar    │        Main Content                   │
│  (w-64)     │                                       │
│             │                                       │
└─────────────┴───────────────────────────────────────┘
```

### 새 레이아웃 (사이드바 열림)
```
┌───────────────────────────────────────────────────────┐
│ E Edwards POB  [<] │                              🔔  │ ← 최소 헤더 (h-12)
├────────────────────┼──────────────────────────────────┤
│ ┌────────────────┐ │                                  │
│ │ 안녕하세요,    │ │                                  │
│ │ Gerald Park님! │ │                                  │
│ └────────────────┘ │        Main Content              │
│                    │        (더 넓은 공간)            │
│  Navigation        │                                  │
│  - Dashboard       │                                  │
│  - ...             │                                  │
└────────────────────┴──────────────────────────────────┘
```

### 새 레이아웃 (사이드바 접힘)
```
┌────────────────────────────────────────────────────────┐
│  E  │                                              🔔  │
├─────┼──────────────────────────────────────────────────┤
│ 👋  │                                                  │
│ [>] │                                                  │
│     │           Main Content (최대 공간)               │
│ 📊  │                                                  │
│ 📈  │                                                  │
│ ... │                                                  │
└─────┴──────────────────────────────────────────────────┘
```

## 구현 세부 사항

### 1. MainLayout.tsx

**사이드바 상태 관리 추가:**
```tsx
// localStorage key for sidebar state
const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function MainLayout() {
    // Initialize from localStorage, default to false (expanded)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        return saved === 'true';
    });

    // Save to localStorage when changed
    useEffect(() => {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
    }, [isSidebarCollapsed]);

    // ...
}
```

**헤더 최소화:**
- 높이: h-16 → h-12
- 인사말 제거 (사이드바로 이동)
- 배경: 그라디언트 파란색 → 흰색 (bg-white)
- 알림 벨만 우측에 유지

### 2. Sidebar.tsx

**접기/열기 토글 Props:**
```tsx
interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
}
```

**동적 너비:**
```tsx
<div className={cn(
    "flex h-full flex-col bg-slate-900 transition-all duration-300 ease-in-out",
    isCollapsed ? "w-16" : "w-64"
)}>
```

**인사말 섹션 (헤더에서 이동):**
```tsx
{/* Greeting - moved from header */}
<div className={cn("px-3 py-3 border-b border-slate-700", isCollapsed && "px-2")}>
    {isCollapsed ? (
        <div className="flex justify-center">
            <span className="text-lg">👋</span>
        </div>
    ) : (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-3">
            <p className="text-sm font-medium text-white/90">안녕하세요,</p>
            <p className="text-base font-bold text-white truncate">
                {user?.korean_name || user?.name || 'Guest'}님!
            </p>
        </div>
    )}
</div>
```

**토글 버튼:**
```tsx
{/* 열림 상태: 로고 옆에 접기 버튼 */}
{!isCollapsed && (
    <button onClick={onToggle} title="사이드바 접기">
        <ChevronLeft className="h-5 w-5" />
    </button>
)}

{/* 접힘 상태: 열기 버튼 */}
{isCollapsed && (
    <button onClick={onToggle} title="사이드바 열기">
        <ChevronRight className="h-5 w-5" />
    </button>
)}
```

**접힘 상태 네비게이션:**
- 아이콘만 표시 (텍스트 숨김)
- 가운데 정렬
- title 속성으로 호버시 이름 표시

## 주요 기능

| 기능 | 설명 |
|-----|------|
| 토글 버튼 | 사이드바 상단에 접기/열기 버튼 |
| localStorage 저장 | 새로고침 후에도 상태 유지 |
| 부드러운 애니메이션 | transition-all duration-300 |
| 아이콘 모드 | 접힘 시 아이콘만 표시, 호버로 이름 확인 |
| 인사말 이동 | 상단 헤더 → 사이드바 상단 |

## 수정된 파일

| 파일 | 변경 내용 |
|-----|----------|
| `frontend/src/components/layout/MainLayout.tsx` | 사이드바 상태 관리, 헤더 최소화 |
| `frontend/src/components/layout/Sidebar.tsx` | 접기/열기 토글, 인사말 이동 |

## 빌드 검증

```bash
> pnpm run build
✓ 3413 modules transformed.
✓ built in 2.88s
```

## UX 개선 효과

1. **화면 공간 확보**: 접힘 시 w-64 → w-16 (248px 절약)
2. **유연한 사용**: 모니터 크기에 따라 사용자가 선택 가능
3. **상태 유지**: localStorage로 사용자 설정 기억
4. **시각적 일관성**: 인사말이 사이드바 컨텍스트에 더 자연스럽게 배치
