# Resource Matrix Drill-down 기능 구현

## 개요
Resource Matrix에서 각 IO/User별 FTE 셀을 클릭했을 때, 해당 집계의 근거가 되는 상세 Worklogs(업무 이력)를 팝업으로 확인할 수 있는 기능을 구현했습니다. 또한 개발 과정에서 발생한 서버 내부 오류(500)를 해결하여 안정성을 확보했습니다.

## 주요 변경사항
- **기능 추가**: 
  - Backend: `GET /details` 엔드포인트 및 `WorklogDetailResponse` 스키마 추가
  - Frontend: `WorklogDrilldownModal` 컴포넌트 구현 및 `ResourcePivotTable` 클릭 이벤트 연동
- **버그 수정**:
  - `resource_matrix.py` 내 중복 함수 정의 제거 (파일 구조 정리)
  - API 응답 스키마 불일치로 인한 Pydantic 검증 오류(500 Crash) 수정

## 핵심 코드
```typescript
// frontend/src/components/resource-matrix/ResourcePivotTable.tsx
// 셀 클릭 시 Drill-down 모달 호출
<td
    className={cn(val > 0 ? "cursor-pointer hover:bg-blue-50" : "")}
    onClick={() => {
        if (val > 0 && onCellClick) {
            onCellClick(row.user_id, row.user_name, col.id, col.name);
        }
    }}
>
    {val.toFixed(2)}
</td>
```

```python
# backend/app/api/endpoints/resource_matrix.py
# 상세 내역 조회 API (디버그 핸들링 포함)
@router.get("/details", response_model=List[WorklogDetailResponse])
def get_matrix_details(user_id: str, month: str, io_id: str, db: Session = Depends(get_db)):
    try:
        return get_resource_matrix_details(db, user_id, month, io_id)
    except Exception as e:
        # 에러 발생 시 상세 원인 반환
        return JSONResponse(status_code=500, content={"error": str(e), "traceback": traceback.format_exc()})
```

## 결과
- ✅ **API 동작 확인**: `curl` 테스트 통과 (200 OK)
- ✅ **UI 연동 확인**: Matrix 셀 클릭 시 모달 팝업 및 데이터 로딩 성공

## 다음 단계
- Matrix 로딩 속도 최적화 (데이터 양 증가 시 대비)
- 엑셀 다운로드 기능에 상세 내역 포함 여부 검토
