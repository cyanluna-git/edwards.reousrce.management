# CSV Worklog 매핑 규칙 상세

이 문서는 CSV worklog 마이그레이션 시 User, Project, WorkType 매핑의 상세 규칙을 정의합니다.
과거 워크스루에서 발견된 실패 케이스와 해결책을 포함합니다.

---

## 1. User 매핑 규칙

### 1.1 매핑 단계 (우선순위 순)

| Stage | 방법 | Confidence | 설명 |
|-------|------|------------|------|
| 1 | Person.id → email → UUID | 1.0 | db_users.csv의 email로 정확 매칭 |
| 2 | Jaro-Winkler >= 0.9 | 0.85 | 영문 이름 유사도 |
| 3 | 한글 이름 포함 | 0.8 | KoreanName 필드 검색 |
| 4 | LLM 추론 | 0.7 | 이름 변형 추론 (최후 수단) |

### 1.2 db_users.csv 컬럼 활용

```csv
Person.id,KoreanName,Department,ID,Person.email,English Name,Team,email,...
"209","이욱희","Software",95,"WookHee.Lee@csk.kr","Wookhee Lee",...
```

**매핑 우선순위:**
1. `Person.id` → `email` (primary)
2. `English Name` Fuzzy match (fallback)
3. `KoreanName` 포함 검색 (fallback)

### 1.3 주의사항

- **이메일 도메인 변경**: `@csk.kr` ↔ `@edwardsvacuum.com` 둘 다 확인
- **이름 순서**: "Wookhee Lee" ↔ "Lee Wookhee" 둘 다 매칭
- **대소문자**: 이메일은 case-insensitive

---

## 2. Project 매핑 규칙

### 2.1 매핑 단계 (우선순위 순)

| Stage | 방법 | Confidence | 설명 |
|-------|------|------------|------|
| 1 | Project.Id → IO code → UUID | 1.0 | db_projects.csv 참조 |
| 2 | IO code 정확 일치 | 0.95 | DB projects.code 검색 |
| 3 | Priority 키워드 | 0.85 | 100+ 키워드 매핑 |
| 4 | Description 키워드 | 0.75 | worklog Title에서 추출 |
| 5 | Default fallback | 0.5 | General/Non-Project |

### 2.2 Priority 키워드 매핑

과거 실패를 방지하기 위해 priority 기반으로 매핑:

```python
# keyword_mappings.py에서 발췌
PROJECT_KEYWORD_MAPPINGS = [
    # (keyword, IO_code, priority)
    ("OQC", "888888-160", 100),           # 최고 우선순위
    ("GEN3+", "406886", 95),              # GEN3+ 우선
    ("GEN3 PLUS", "406886", 95),
    ("GEN4 PHASE 2", "407039", 90),
    ("GEN4 PHASE2", "407039", 90),
    ("GEN4", "406437", 85),               # GEN4 (일반)
    ("GEN3", "406886", 80),               # GEN3 (fallback)
    ("TUMALO", "406437", 90),
    ("PROTRON", "406420", 90),
    ("VIZEON", "407056", 90),
    ("HERMES", "407110", 90),
    ("HAVASU", "407088", 90),
    # ... 100+ more
]
```

**GEN3 vs GEN3+ 구분 규칙:**
1. "GEN3+" 또는 "GEN3 PLUS" → 406886 (priority 95)
2. "GEN3" 단독 → 406886 (priority 80, fallback)
3. Longer match wins (더 긴 키워드 우선)

### 2.3 제외 프로젝트

다음 프로젝트는 매핑에서 제외:

```python
EXCLUDED_PROJECTS = [
    # LEGACY 프로젝트 (888888 시리즈)
    "888888-*",  # 모든 888888 시리즈
    
    # Closed 프로젝트
    "z [Closed]*",  # z [Closed] 프리픽스
    
    # 상태가 LEGACY인 프로젝트
    # (project.status == "LEGACY")
]
```

### 2.4 db_projects.csv 컬럼 활용

```csv
Project,Program,Product,IO,Customer,Status,Complexity,Description,ID,...
"z [Closed] NKB943, H2D-S x 3","EUV NPI","NKB943000",406372,"SK Hynix","Completed",...
```

**매핑 우선순위:**
1. `ID` (CSV 내부 ID) → `IO` (IO code) → DB project.code
2. `Project` (프로젝트명) → 키워드 추출 → 매칭
3. `Product` → 제품코드 매칭

---

## 3. WorkType 매핑 규칙

### 3.1 매핑 단계 (우선순위 순)

| Stage | 방법 | Confidence | 설명 |
|-------|------|------------|------|
| 1 | Worktype.Id → Legacy 테이블 | 1.0 | 직접 매핑 |
| 2 | Title 정확 일치 | 0.95 | work_type_categories.name |
| 3 | 키워드 매칭 | 0.8 | 274개 키워드 |
| 4 | AI 추론 | 0.7 | LLM 분류 (최후 수단) |

### 3.2 db_worktype.csv 컬럼 활용

```csv
Id,Title,Description
1,"Design","설계 및 도면 작업"
6,"Meeting","회의 및 미팅"
3,"SW Develop","소프트웨어 개발"
```

### 3.3 키워드 매핑 (한국어 지원)

```python
WORKTYPE_KEYWORD_MAPPINGS = {
    # Engineering
    "설계": "Design",
    "디자인": "Design",
    "개발": "SW Develop",
    "코딩": "SW Develop",
    "프로그래밍": "SW Develop",
    
    # Meeting
    "회의": "Meeting",
    "미팅": "Meeting",
    "스탠드업": "Meeting",
    "데일리": "Meeting",
    
    # Documentation
    "문서": "Documentation",
    "작성": "Documentation",
    "리뷰": "Review",
    
    # ... 274개 더
}
```

### 3.4 한국어 별칭 (text_preprocessor.py)

```python
KOREAN_ALIASES = {
    "오큐씨": "OQC",
    "젠3": "GEN3",
    "젠4": "GEN4",
    "프로트론": "PROTRON",
    "투말로": "TUMALO",
    # ... 114개 더
}
```

---

## 4. 컬럼 변환 규칙

### 4.1 tb_worklog.csv 컬럼

| CSV 컬럼 | DB 컬럼 | 변환 규칙 |
|----------|---------|----------|
| `Date` | `date` | ISO 날짜 파싱 (YYYY-MM-DD) |
| `Hours` | `hours` | Float 변환 (> 0 검증) |
| `Title` | `description` | 문자열 그대로 |
| `Createdby.Id` | `user_id` | 2단계 lookup (Section 1) |
| `Project.Id` | `project_id` | 2단계 lookup (Section 2) |
| `Worktype.Id` | `work_type_category_id` | Legacy 매핑 (Section 3) |
| `SuddenWork?` | `is_sudden` | "TRUE"/"FALSE" → Boolean |
| `BusinessTrip` | `is_business_trip` | "TRUE"/"FALSE" → Boolean |
| `MeetingType` | `meeting_type` | 문자열 그대로 (nullable) |

### 4.2 날짜 파싱

```python
# 지원 형식
DATE_FORMATS = [
    "%Y-%m-%d %H:%M:%S.%f",  # 2024-04-16 00:00:00.000
    "%Y-%m-%d %H:%M:%S",     # 2024-04-16 00:00:00
    "%Y-%m-%d",              # 2024-04-16
    "%m/%d/%Y",              # 04/16/2024
]
```

### 4.3 Boolean 변환

```python
def parse_bool(value: str) -> bool:
    return value.upper() in ("TRUE", "1", "YES", "Y")
```

---

## 5. 중복 방지 규칙

### 5.1 복합키

```python
DUPLICATE_KEY = (
    "user_id",
    "project_id", 
    "date",
    "hours"
)
```

### 5.2 중복 체크 쿼리

```sql
SELECT user_id, project_id, date, hours
FROM worklogs
WHERE date >= :start_date AND date <= :end_date
```

---

## 6. Confidence Score 임계값

| Confidence | 처리 |
|------------|------|
| >= 0.85 | 자동 적용 |
| 0.7 ~ 0.85 | 적용 + 리뷰 플래그 |
| < 0.7 | Quarantine (수동 확인 필요) |

---

## 7. 에러 처리

### 7.1 매핑 실패 시

```python
class MappingResult:
    status: Literal["resolved", "low_confidence", "unresolved"]
    mapped_id: Optional[str]
    confidence: float
    alternatives: List[Tuple[str, float]]  # [(id, score), ...]
    reason: str
```

### 7.2 리포트 출력

실패한 매핑은 CSV 리포트로 출력:

```csv
worklog_id,field,original_value,mapped_id,confidence,alternatives,reason
65,user,209,uuid-xxx,0.72,"[('uuid-yyy', 0.68)]","Low confidence name match"
```

---

## 참고 문서

- `backend/workthrough/2026-01-27_ai_worklog_fuzzy_matching.md`
- `workthrough/2026-01-21_14_30_project-financial-backfill-system.md`
- `backend/app/services/keyword_mappings.py`
- `backend/app/services/matching_service.py`
- `backend/app/services/text_preprocessor.py`
