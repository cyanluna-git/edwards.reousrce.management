# DB 스키마 업데이트 및 수동 분류 체계 구축

## 개요

프로젝트 재무 데이터 백필 시스템을 실제 DB에 적용하기 위해 스키마를 업데이트하고, 자동 분류 결과를 검증하기 위한 수동 분류 워크플로우를 구축했습니다. Dimension 테이블 생성, 재무 컬럼 추가, Dry-run 테스트 완료 후 수동 분류 템플릿 및 Import 스크립트를 구현했습니다.

## 주요 변경사항

### 개발한 것

1. **`scripts/setup_financial_schema.py`** - DB 스키마 자동 설정 스크립트
   - `dim_funding_entity` 테이블 생성 (4개 엔티티)
   - `dim_io_category` 테이블 생성 (6개 카테고리)
   - `projects` 테이블에 재무 컬럼 5개 추가
   - 인덱스 3개 생성 (성능 최적화)

2. **`scripts/generate_manual_classification_template.py`** - 수동 분류 템플릿 생성기
   - 130개 프로젝트의 상세 정보 추출
   - Program, Product Line, Customer, PM 정보 포함
   - Project Type 기반 추천 값 자동 생성

3. **`scripts/import_manual_classification.py`** - 분류 결과 Import 스크립트
   - CSV 파일에서 수동 분류 결과 읽기
   - 유효성 검사 (값 검증)
   - Dry-run 모드 지원
   - 배치 업데이트

4. **`docs/MANUAL_CLASSIFICATION_GUIDE.md`** - 수동 분류 가이드 문서
   - 4개 분류 항목 상세 설명
   - 일반적인 분류 패턴 예시
   - 체크리스트 및 작업 절차
   - 특수 케이스 처리 방법

### 수정한 것

- **Pydantic 설정 수정**: `app/core/config.py`에 `extra = "ignore"` 추가하여 .env 파일의 추가 필드 허용
- **스키마 설정 스크립트**: 컬럼 추가 시 에러 핸들링 개선

### 개선한 것

- **Dry-run 테스트 성공**: 130개 프로젝트 분류 완료 (1초 이내)
- **수동 분류 워크플로우**: Excel/Google Sheets 기반 편리한 UI 제공

## 핵심 코드

### 스키마 설정

```python
# 재무 컬럼 추가
db.execute(text("""
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS funding_entity_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS recharge_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS io_category_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS is_capitalizable BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS gl_account_code VARCHAR(50)
"""))

# 인덱스 생성 (성능 향상)
db.execute(text("""
    CREATE INDEX IF NOT EXISTS ix_projects_funding_entity_id
    ON projects(funding_entity_id)
"""))
```

### 수동 분류 템플릿 생성

```python
# Project Type 기반 추천 값 생성
if project.project_type_id == 'NPI':
    suggested_funding = 'ENTITY_LOCAL_KR'
    suggested_recharge = 'NON_BILLABLE'
    suggested_category = 'NPI'
    suggested_capital = 'TRUE'
elif project.project_type_id == 'SUSTAINING':
    suggested_funding = 'ENTITY_VSS'
    suggested_recharge = 'BILLABLE'
    suggested_category = 'SUSTAINING'
    suggested_capital = 'TRUE'
```

### Import 유효성 검사

```python
def validate_values(row, row_num):
    valid_funding = ['ENTITY_VSS', 'ENTITY_SUN', 'ENTITY_LOCAL_KR', 'ENTITY_SHARED', '']
    valid_recharge = ['BILLABLE', 'NON_BILLABLE', 'INTERNAL', '']
    valid_category = ['NPI', 'FIELD_FAILURE', 'OPS_SUPPORT', 'SUSTAINING', 'CIP', 'OTHER', '']

    # 각 필드 검증
    if row['funding_entity_id'] not in valid_funding:
        errors.append(f"Invalid funding_entity_id")
```

## DB 스키마 구조

### Dimension 테이블

```
dim_funding_entity (4개 레코드)
├─ ENTITY_VSS (VSS Division)
├─ ENTITY_SUN (SUN Division)
├─ ENTITY_LOCAL_KR (Local Korea)
└─ ENTITY_SHARED (Shared Services)

dim_io_category (6개 레코드)
├─ NPI (New Product Introduction)
├─ FIELD_FAILURE (Field Failure Escalation)
├─ OPS_SUPPORT (Operations Support)
├─ SUSTAINING (Sustaining Engineering)
├─ CIP (Continuous Improvement)
└─ OTHER (Miscellaneous)
```

### Projects 테이블 추가 컬럼

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| funding_entity_id | VARCHAR(50) | FK to dim_funding_entity |
| recharge_status | VARCHAR(20) | BILLABLE, NON_BILLABLE, INTERNAL |
| io_category_code | VARCHAR(100) | IO Framework 카테고리 |
| is_capitalizable | BOOLEAN | CAPEX vs OPEX |
| gl_account_code | VARCHAR(50) | General Ledger 계정 |

## 결과

✅ **스키마 설정 완료**
- Dimension 테이블 생성 (10개 레코드)
- Projects 테이블 컬럼 추가 (5개)
- 인덱스 생성 (3개)

✅ **Dry-run 테스트 성공**
- 처리 프로젝트: 130개
- 실행 시간: ~1초
- 에러: 0개
- CSV 리포트 생성: 34KB

✅ **수동 분류 체계 구축**
- 템플릿 생성기 구현 (27KB CSV)
- Import 스크립트 구현 (유효성 검사 포함)
- 완전한 분류 가이드 문서 작성

⚠️ **자동 분류 정확도 이슈**
- LOW confidence: 119개 (91.5%)
- VSS/SUN 프로젝트 감지 실패 (0개)
- 수동 분류 필요

## Dry-run 분석 결과

### Funding Entity 분포
```
ENTITY_LOCAL_KR: 119개 (91.5%) - 대부분 기본값 적용
```

### IO Category 분포
```
NPI: 78개 (60.0%)
OTHER: 37개 (28.5%)
SUSTAINING: 4개 (3.1%)
INTERNAL: 2개 (1.5%)
```

### 발견된 문제
1. 프로젝트 코드/이름에서 VSS/SUN 마커 부재
2. 분류 규칙 개선 필요 (Product Line, Customer 정보 활용)
3. Unknown Project Type들 (LEGACY, AND 등)

## 수동 분류 워크플로우

```
1. 템플릿 생성
   └─ generate_manual_classification_template.py
   └─ CSV 파일 생성 (130개 프로젝트 정보)

2. Excel/Sheets에서 편집
   └─ funding_entity_id 수정
   └─ recharge_status 수정
   └─ io_category_code 수정
   └─ is_capitalizable 수정

3. Dry-run 테스트
   └─ import_manual_classification.py (미리보기)
   └─ 유효성 검사
   └─ 로그 확인

4. 실제 적용
   └─ --execute --i-have-backed-up
   └─ DB 업데이트
   └─ 검증 쿼리 실행
```

## 사용 방법

### 1. 템플릿 생성

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5434/edwards" \
.venv/bin/python backend/scripts/generate_manual_classification_template.py
```

→ `backend/reports/manual_classification_template_YYYYMMDD_HHMMSS.csv` 생성

### 2. Excel에서 편집

- 좌측: 프로젝트 정보 (읽기 전용)
- 우측: 분류 필드 (편집)
  - funding_entity_id
  - recharge_status
  - io_category_code
  - is_capitalizable
  - notes

### 3. Import (Dry-run)

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5434/edwards" \
.venv/bin/python backend/scripts/import_manual_classification.py \
backend/reports/manual_classification_template_YYYYMMDD_HHMMSS.csv
```

### 4. Import (Execute)

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5434/edwards" \
.venv/bin/python backend/scripts/import_manual_classification.py \
backend/reports/manual_classification_template_YYYYMMDD_HHMMSS.csv \
--execute --i-have-backed-up
```

## 다음 단계

### 단기 (수동 분류 작업)
1. **템플릿 검토**
   - VSS/SUN 관련 프로젝트 식별
   - Customer 정보 기반 분류
   - SUPPORT, SUSTAINING 타입 확인

2. **우선순위 분류**
   - HIGH: VSS/SUN 명시적 프로젝트 (청구 관련)
   - MEDIUM: SUSTAINING, SUPPORT (비용 분배)
   - LOW: 내부 NPI (대부분 기본값 OK)

3. **Import 실행**
   - Dry-run으로 검증
   - 백업 후 Execute
   - 검증 쿼리로 확인

### 중기 (분류 규칙 개선)
1. **Product Line 기반 분류 추가**
   - GEN3/GEN4 → ENTITY_VSS
   - Ruby → ENTITY_SUN
   - 특정 제품군별 매핑

2. **Customer 정보 활용**
   - "ASML" → ENTITY_VSS
   - "Samsung" → ENTITY_SUN
   - 고객사별 엔티티 매핑

3. **Program 정보 활용**
   - Program 테이블 조인
   - Business Unit 정보 활용
   - 조직 구조 기반 자동 분류

### 장기 (시스템 개선)
1. **자동 분류 알고리즘 고도화**
   - ML 기반 분류 (과거 데이터 학습)
   - 다중 조건 매칭 (AND/OR 로직)
   - Confidence Score 정교화

2. **대시보드 추가**
   - 분류 통계 시각화
   - Low confidence 프로젝트 리스트
   - 일괄 리뷰 인터페이스

3. **자동 재분류**
   - Project 정보 변경 시 트리거
   - Funding Entity 변경 이력
   - 분류 규칙 버전 관리

## 참고 문서

- **수동 분류 가이드**: `docs/MANUAL_CLASSIFICATION_GUIDE.md`
- **백필 시스템 요약**: `docs/BACKFILL_IMPLEMENTATION_SUMMARY.md`
- **Recharge 계획**: `docs/recharge-planning-implementation-plan.md`

---

**작업 시간**: ~2시간 (스키마 설정 30분, 수동 분류 시스템 90분)
**파일 수**: 5개 (스크립트 3개, 문서 2개)
**코드 라인**: ~800줄
