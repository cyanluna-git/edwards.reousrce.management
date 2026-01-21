# Sustaining Matrix IO System 구현

## 개요
"General Support" 프로젝트들의 비구조화 문제를 해결하기 위해 **Matrix IO System**을 구현했습니다. VSS(Integrated Systems)와 SUN(Abatement) 두 Funding Entity별로 8개씩 총 16개의 표준 Sustaining 프로젝트 버킷을 생성합니다.

## 주요 변경사항

### 개발한 것
- **`seed_sustaining_matrix_v2.py`**: Matrix IO 프로젝트 시딩 스크립트
  - UPSERT 로직 (생성 또는 업데이트로 일관성 강제)
  - Legacy 후보 프로젝트 식별 리포트

### 생성된 데이터
| 구분 | 코드 | IO Category |
|------|------|-------------|
| VSS (8개) | VSS011-VSS018 | FIELD_FAILURE, SUSTAINING, OPS_SUPPORT, CIP, OTHER |
| SUN (8개) | SUN001-SUN008 | FIELD_FAILURE, SUSTAINING, OPS_SUPPORT, CIP, OTHER |

### 공통 속성
- `project_type_id`: "SUSTAINING"
- `recharge_status`: "BILLABLE"
- `funding_entity_id`: ENTITY_VSS 또는 ENTITY_SUN

## 핵심 코드

```python
# Upsert 로직 - 일관성 강제
if existing:
    if existing.name != item["name"]:
        existing.name = item["name"]
    if existing.funding_entity_id != funding_entity_id:
        existing.funding_entity_id = funding_entity_id
    # ... 기타 속성 체크
else:
    # 새로 생성
    project = Project(...)
```

## 결과
- 16개 Matrix 프로젝트 생성 완료
- 21개 Legacy 후보 프로젝트 식별됨
- Idempotent (재실행 시 안전)

```bash
# 실행 방법
docker exec edwards-api python /app/scripts/seed_sustaining_matrix_v2.py
```

## 다음 단계
1. **Frontend 탭 추가**: "Standard IO Framework" 탭으로 16개 Matrix 프로젝트 전용 뷰 구현
2. **Legacy Migration 스크립트**: 21개 Legacy 프로젝트의 worklog를 새 Matrix 버킷으로 이관
3. **Legacy 프로젝트 비활성화**: Migration 완료 후 is_active=False 처리
