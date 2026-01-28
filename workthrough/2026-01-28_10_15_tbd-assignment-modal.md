# TBD 포지션 사용자 할당 모달 구현

## 개요
PM이 리소스 플랜에서 TBD(미할당)로 계획한 포지션에 FM이 실제 사용자를 배정할 수 있는 모달을 구현했습니다. Gemini-Claude 루프를 통해 코드 리뷰를 받고 UX 개선사항을 적용했습니다.

## 주요 변경사항
- **개발한 것**: TbdAssignmentModal 컴포넌트 신규 생성
- **통합한 것**: ResourcePlansPage에 TBD 할당 버튼 및 모달 연동
- **개선한 것**: Gemini 리뷰 반영 - 할당 전 확인 다이얼로그, 버튼 툴팁 추가

## 핵심 코드

```typescript
// TbdAssignmentModal.tsx - 주요 기능
export const TbdAssignmentModal: React.FC<TbdAssignmentModalProps> = ({
  open, onOpenChange, defaultYear, defaultMonth, defaultProjectId
}) => {
  // 필터: 연도, 월, 프로젝트
  const [filterYear, setFilterYear] = useState(defaultYear || today.getFullYear());
  const [filterMonth, setFilterMonth] = useState(defaultMonth || today.getMonth() + 1);

  // TBD 포지션 조회 (기존 API 활용)
  const { data: tbdPositions } = useTbdPositions({ year: filterYear, month: filterMonth });

  // 할당 전 확인 다이얼로그
  const handleAssign = async (plan: ResourcePlan) => {
    if (!window.confirm(`${userName}님을 ${plan.project_name}에 할당하시겠습니까?`)) return;
    await assignMutation.mutateAsync({ planId: plan.id, data: { user_id: userId } });
  };
};
```

```typescript
// ResourcePlansPage.tsx - 모달 통합
<Button onClick={() => setIsTbdModalOpen(true)} title="TBD(미할당) 포지션에 담당자 배정">
  TBD 할당
</Button>
<TbdAssignmentModal open={isTbdModalOpen} onOpenChange={setIsTbdModalOpen} />
```

## 결과
- ✅ TypeScript 빌드 성공
- ✅ Vite 프로덕션 빌드 성공 (2.94s)
- ✅ Gemini 코드 리뷰 완료 및 피드백 반영

## 다음 단계
- 리소스 충돌 감지 (FTE > 1.0 경고)
- 배포 준비 (Vercel, Render, Supabase)
- Excel Import/Export 기능
