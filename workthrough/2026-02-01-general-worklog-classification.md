# General/Non-Project 워크로그 자동 분류

## 개요
2026년도 General/Non-Project에 입력된 575건의 워크로그를 분석하여 Support 프로젝트, InProgress 제품 프로젝트, 또는 팀 자체 업무(NULL)로 자동 분류하는 스크립트를 개발하고 적용했습니다.

## 주요 변경사항
- **개발**: `backend/scripts/classify_general_worklogs.py` - 워크로그 자동 분류 스크립트
- **수정**: `docker-compose.yml` - DB 포트(5434) 외부 노출 추가
- **분류 로직**:
  - 팀 자체 업무 패턴 (휴가/교육/미팅/영어공부 등) → NULL
  - Support 프로젝트 패턴 (Field 대응/Lab Test/CIP 등) → 해당 Support 프로젝트
  - InProgress 프로젝트 키워드 (Vizeon/Torch/TSMC 등) → 해당 제품 프로젝트
  - 사용자 서브팀 기반 프로젝트 매핑 (Electrical IS → EUV Gen4 등)

## 핵심 코드
```python
# 서브팀별 기본 프로젝트 매핑
SUBTEAM_PROJECT_KEYWORDS = {
    "Electrical (IS)": {
        "dbf7bb73...": [r'TSMC', r'Power\s*[Bb]ox', r'ECDP', r'EUV'],
    },
    "Software (ABT)": {
        "77bc14b5...": [r'Torch', r'SCO[-\s]*\d+'],
    },
}

def classify_worklog(description, inprogress_projects, user_subteam):
    # 1. 팀 자체 업무 → NULL
    # 2. InProgress 프로젝트 키워드 매칭
    # 3. 서브팀 기반 프로젝트 매칭
    # 4. Support 패턴 매칭
```

## 결과
| 카테고리 | 건수 | 비율 |
|----------|------|------|
| PRODUCT | 1,238 | 53.5% |
| FUNCTIONAL | 608 | 26.3% |
| NULL (팀 자체) | 415 | 17.9% |
| SUPPORT | 53 | 2.3% |

- ✅ 575건 General 워크로그 재분류 완료
- ✅ Vizeon → EUV Gen4 Phase 2 매핑 (77건)
- ✅ Torch → Taylor 향 SAR 매핑 (50건)

## 다음 단계
- 2025년 이전 데이터에도 동일 분류 로직 적용 검토
- 새로운 General 워크로그 입력 시 자동 분류 제안 기능 추가
- 워크로그 입력 UI에서 프로젝트 추천 기능 구현
- 분류 규칙 관리 UI 추가 (Admin 기능)
