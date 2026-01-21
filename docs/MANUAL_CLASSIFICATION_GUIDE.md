# 수동 분류 가이드 (Manual Classification Guide)

**작성일**: 2026-01-21
**대상**: 프로젝트 재무 속성 수동 분류

---

## 📋 개요

자동 분류 시스템에서 LOW confidence로 판정된 프로젝트들을 수동으로 분류하는 가이드입니다.
템플릿 CSV 파일을 열어서 각 프로젝트의 재무 속성을 확인하고 수정합니다.

---

## 🎯 분류 항목

### 1. Funding Entity ID (누가 비용을 부담하는가?)

| 값 | 의미 | 사용 시기 |
|---|------|----------|
| **ENTITY_VSS** | VSS Division이 부담 | VSS 고객사 프로젝트, VSS 제품 관련 |
| **ENTITY_SUN** | SUN Division이 부담 | SUN 고객사 프로젝트, SUN 제품 관련 |
| **ENTITY_LOCAL_KR** | Local Korea가 부담 | 자체 개발, 내부 프로젝트, 신제품 개발 |
| **ENTITY_SHARED** | 공유 서비스 | 전사 공통 인프라, 도구 개발 |

**판단 기준**:
- 프로젝트 코드/이름에 VSS 또는 SUN이 명시적으로 있는가?
- Customer가 VSS 또는 SUN 소속인가?
- Product Line이 특정 Division 전용인가?

### 2. Recharge Status (비용 청구 방식)

| 값 | 의미 | 사용 시기 |
|---|------|----------|
| **BILLABLE** | 청구 가능 (inter-company) | VSS/SUN에 청구하는 프로젝트 |
| **NON_BILLABLE** | 청구 불가 (local CAPEX) | 자체 개발, 신제품 NPI |
| **INTERNAL** | 내부 간접비 | 일반 관리, 교육, 인프라 |

**조합 예시**:
- VSS Field Support → ENTITY_VSS + BILLABLE
- 자체 NPI 개발 → ENTITY_LOCAL_KR + NON_BILLABLE
- 팀 내부 업무 → ENTITY_LOCAL_KR + INTERNAL

### 3. IO Category Code (프로젝트 카테고리)

| 값 | 의미 | 사용 시기 |
|---|------|----------|
| **NPI** | New Product Introduction | 신제품 개발 프로젝트 |
| **FIELD_FAILURE** | Field Failure Escalation | 고객 현장 문제 대응 |
| **OPS_SUPPORT** | Operations Support | 공장/운영 지원 |
| **SUSTAINING** | Sustaining Engineering | 기존 제품 유지보수 |
| **CIP** | Continuous Improvement | 프로세스 개선 프로젝트 |
| **OTHER** | 기타/잡무 | 위 카테고리에 해당 없음 |

### 4. Is Capitalizable (자본화 가능 여부)

| 값 | 의미 | 사용 시기 |
|---|------|----------|
| **TRUE** | CAPEX (자본화 가능) | 신제품 개발, 유지보수, 개선 프로젝트 |
| **FALSE** | OPEX (즉시 비용처리) | 지원 업무, 내부 관리, 일반 간접비 |

**판단 기준**:
- 결과물이 자산으로 남는가? (제품, 설계, 개선) → TRUE
- 일시적 지원/서비스인가? (고객 응대, 교육) → FALSE

---

## 📊 일반적인 패턴

### Pattern 1: VSS/SUN 고객 지원

```
프로젝트: "VSS Field Failure - Customer A"
→ funding_entity_id: ENTITY_VSS
→ recharge_status: BILLABLE
→ io_category_code: FIELD_FAILURE
→ is_capitalizable: TRUE
```

### Pattern 2: 자체 신제품 개발

```
프로젝트: "GEN4 Platform Development"
→ funding_entity_id: ENTITY_LOCAL_KR
→ recharge_status: NON_BILLABLE
→ io_category_code: NPI
→ is_capitalizable: TRUE
```

### Pattern 3: 내부 팀 업무

```
프로젝트: "General Admin / Training"
→ funding_entity_id: ENTITY_LOCAL_KR
→ recharge_status: INTERNAL
→ io_category_code: OTHER
→ is_capitalizable: FALSE
```

### Pattern 4: Sustaining (유지보수)

```
프로젝트: "GEN3 Bug Fix & Maintenance"
→ funding_entity_id: ENTITY_VSS (고객에게 청구)
→ recharge_status: BILLABLE
→ io_category_code: SUSTAINING
→ is_capitalizable: TRUE
```

---

## 🔍 분류 시 체크리스트

### Step 1: 프로젝트 정보 확인
- [ ] 프로젝트 코드/이름에서 VSS/SUN 언급 확인
- [ ] Program 이름 확인 (어느 조직 소속?)
- [ ] Product Line 확인 (어느 제품군?)
- [ ] Customer 확인 (누구를 위한 프로젝트?)
- [ ] PM 확인 (누가 담당?)

### Step 2: Funding Entity 결정
- [ ] VSS/SUN 고객사 프로젝트? → ENTITY_VSS/ENTITY_SUN
- [ ] 자체 개발/내부 프로젝트? → ENTITY_LOCAL_KR
- [ ] 전사 공통 인프라? → ENTITY_SHARED

### Step 3: Recharge Status 결정
- [ ] 타 Division에 청구? → BILLABLE
- [ ] 자체 CAPEX? → NON_BILLABLE
- [ ] 일반 간접비? → INTERNAL

### Step 4: IO Category 결정
- [ ] 신제품 개발? → NPI
- [ ] 현장 문제? → FIELD_FAILURE
- [ ] 공장 지원? → OPS_SUPPORT
- [ ] 유지보수? → SUSTAINING
- [ ] 프로세스 개선? → CIP
- [ ] 기타? → OTHER

### Step 5: Capitalizable 결정
- [ ] 결과물이 자산? (제품/설계/개선) → TRUE
- [ ] 일시적 서비스? (지원/교육/관리) → FALSE

---

## 💡 특수 케이스 처리

### Case 1: 프로젝트 타입이 LEGACY인 경우
- 과거 프로젝트로 분류 불가 → 삭제 또는 OTHER로 분류
- `notes` 필드에 "LEGACY - 분류 불가" 기록

### Case 2: 여러 Division에 걸친 프로젝트
- 주요 고객사 기준으로 판단
- 예: 70% VSS, 30% SUN → ENTITY_VSS
- `notes` 필드에 "Mixed - primarily VSS" 기록

### Case 3: Customer가 ASML인 경우
- ASML은 VSS의 주요 고객 → ENTITY_VSS
- 단, ASML 내부 개발용은 → ENTITY_LOCAL_KR

### Case 4: ETO (Engineering To Order)
- 고객 주문형 개발 → NPI로 분류
- Capitalizable: TRUE
- Recharge는 고객사에 따라 결정

---

## 📝 작업 절차

### 1. 템플릿 파일 열기

```bash
# 파일 위치
backend/reports/manual_classification_template_YYYYMMDD_HHMMSS.csv
```

Excel 또는 Google Sheets에서 열기

### 2. 분류 작업

각 프로젝트(행)에 대해:
1. 좌측 정보 컬럼들 확인 (project_code, project_name, program_name, product_line_name, customer 등)
2. 우측 분류 컬럼들 수정:
   - `funding_entity_id`
   - `recharge_status`
   - `io_category_code`
   - `is_capitalizable`
3. 필요시 `notes` 컬럼에 판단 근거 기록

### 3. 유효성 검사

분류 값이 아래 목록에 있는지 확인:
- funding_entity_id: `ENTITY_VSS`, `ENTITY_SUN`, `ENTITY_LOCAL_KR`, `ENTITY_SHARED`
- recharge_status: `BILLABLE`, `NON_BILLABLE`, `INTERNAL`
- io_category_code: `NPI`, `FIELD_FAILURE`, `OPS_SUPPORT`, `SUSTAINING`, `CIP`, `OTHER`
- is_capitalizable: `TRUE`, `FALSE`

### 4. 파일 저장

- **중요**: 파일 이름을 바꾸지 마세요!
- 인코딩: UTF-8
- 형식: CSV (쉼표로 구분)

### 5. Dry-run 테스트

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5434/edwards" \
.venv/bin/python backend/scripts/import_manual_classification.py \
backend/reports/manual_classification_template_YYYYMMDD_HHMMSS.csv
```

로그를 확인하여 오류가 없는지 체크

### 6. 실제 적용

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5434/edwards" \
.venv/bin/python backend/scripts/import_manual_classification.py \
backend/reports/manual_classification_template_YYYYMMDD_HHMMSS.csv \
--execute --i-have-backed-up
```

---

## ⚠️ 주의사항

1. **백업 필수**: 실제 적용 전 DB 백업 필수
2. **파일 이름 유지**: 템플릿 파일 이름 변경 금지
3. **값 대소문자**: 분류 값은 **대문자**로 입력 (TRUE, FALSE, ENTITY_VSS 등)
4. **빈 값 허용**: 확실하지 않은 항목은 비워둘 수 있음 (업데이트 건너뜀)
5. **notes 활용**: 판단 근거를 notes에 기록하여 추후 검토 가능

---

## 📊 검증 쿼리

분류 후 DB에서 확인:

```sql
-- Funding Entity 분포
SELECT funding_entity_id, COUNT(*) as count
FROM projects
WHERE funding_entity_id IS NOT NULL
GROUP BY funding_entity_id
ORDER BY count DESC;

-- IO Category 분포
SELECT io_category_code, COUNT(*) as count
FROM projects
WHERE io_category_code IS NOT NULL
GROUP BY io_category_code
ORDER BY count DESC;

-- Recharge Status 분포
SELECT recharge_status, COUNT(*) as count
FROM projects
WHERE recharge_status IS NOT NULL
GROUP BY recharge_status
ORDER BY count DESC;

-- Capitalizable 분포
SELECT is_capitalizable, COUNT(*) as count
FROM projects
GROUP BY is_capitalizable
ORDER BY count DESC;
```

---

## 🆘 문제 해결

### 문제: CSV 파일이 Excel에서 깨짐
**해결**: UTF-8 인코딩으로 저장 또는 Google Sheets 사용

### 문제: "Invalid funding_entity_id" 오류
**해결**: 값이 정확한지 확인 (대문자, 오타 없음)

### 문제: 프로젝트가 업데이트되지 않음
**해결**: `--execute` 플래그 사용했는지 확인, project_id가 정확한지 확인

### 문제: 어떻게 분류해야 할지 모르겠음
**해결**:
1. PM이나 팀리드에게 문의
2. 유사한 프로젝트 참고
3. 일단 기본값(ENTITY_LOCAL_KR, INTERNAL, OTHER, FALSE)으로 두고 notes에 "요확인" 기록

---

## 📞 연락처

분류 관련 문의: [담당자 이메일]
시스템 문제: [IT 지원팀]

---

**END OF GUIDE**
