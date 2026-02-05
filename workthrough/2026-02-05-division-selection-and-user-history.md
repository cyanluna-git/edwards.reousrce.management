# 본부(Division) 선택 기능 및 사용자 이력 강화

## 개요
사용자 관리 및 조직 구조 선택 시 본부(Division) 단위를 직접 선택할 수 있도록 기능을 개선하고, 사용자 이력(UserHistory)에 Division 정보를 포함하도록 강화했습니다.

## 주요 변경 사항

### 1. Backend 구현
- **모델 및 스키마 업데이트**: `User` 모델과 `UserHistory` 모델에 `division_id` 필드를 명확히 처리하도록 개선했습니다.
- **사용자 서비스 (`UserService`)**:
    - 사용자 정보 업데이트 시 `division_id` 변경 사항을 감지하여 `UserHistory`에 기록하는 로직을 추가했습니다.
    - 사용자 조회 시 `division` 정보를 `joinedload`를 통해 함께 가져오도록 최적화했습니다.
- **이력 로깅 (`_log_history_change`)**: 새로운 이력 생성 시 `division_id`를 함께 저장하여 소속 변경 이력을 정교화했습니다.

### 2. Frontend UI/UX 개선
- **OrganizationSelect 컴포넌트**:
    - 이제 부서(Department)뿐만 아니라 **본부(Division) 자체를 선택**할 수 있습니다.
    - 본부 선택 시 "본부" 이름이 표시되고, 부서나 팀 선택 시 "본부 > 부서 > 팀" 계층 구조로 표시 이름이 구성됩니다.
    - UI 트리 구조에서 Division 행을 클릭하여 선택할 수 있는 기능을 추가했습니다.
- **타입 정의 및 API 클라이언트**:
    - `divisionId`를 옵셔널하게 처리하고 `null` 값을 허용하도록 타입을 조정했습니다.
    - `OrganizationSelect`의 `onChange` 인터페이스를 `divisionId`를 포함하도록 업데이트했습니다.

## 기대 효과
- 조직 구조의 최상위 단위인 본부(Division) 소속 사용자를 더 정확하게 관리할 수 있습니다.
- 사용자 이동(Transfer) 이력 조회 시 본부 변경 사항까지 추적할 수 있어 데이터 정합성이 향상됩니다.
