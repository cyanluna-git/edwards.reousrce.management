# OQC Worklog 업데이트 가이드

## 개요

General/Non-Project에 할당된 WorkLog 중 description에 "oqc"가 포함된 항목들을 OQC Digitalization 프로젝트로 변경하는 스크립트입니다.

## 스크립트 목록

### 1. `inspect_db_schema.py` - 데이터베이스 스키마 조사

**목적**: 프로젝트와 IO 번호의 실제 구조를 확인

**사용법**:
```bash
cd backend
source venv/bin/activate
python scripts/inspect_db_schema.py
```

**출력 내용**:
- 모든 InternalIO 목록
- 모든 RechargeIO 목록
- OQC 관련 IO 번호
- 888888 포함 IO 번호
- OQC 프로젝트 정보
- General/Non-Project 프로젝트 정보
- 프로젝트-IO 관계

**사용 시점**:
- OQC 프로젝트의 정확한 IO 번호를 확인할 때
- 프로젝트 구조를 파악할 때
- 데이터베이스 스키마를 검증할 때

---

### 2. `update_oqc_worklogs.py` - OQC Worklog 업데이트

**목적**: General/Non-Project의 OQC 관련 WorkLog를 OQC Digitalization 프로젝트로 이동

**사용법**:

#### Dry Run (미리보기)
```bash
cd backend
source venv/bin/activate
python scripts/update_oqc_worklogs.py
```

#### 실제 업데이트 실행
```bash
python scripts/update_oqc_worklogs.py --execute
```

**기능**:
1. General/Non-Project 프로젝트 자동 검색
2. OQC Digitalization 프로젝트 자동 검색 (이름 또는 IO 번호)
3. description에 "oqc" (대소문자 무시)가 포함된 WorkLog 검색
4. 미리보기 및 통계 정보 출력
5. 배치 업데이트 (100개씩)

**출력 예시**:
```
🔍 Finding projects...
  ✅ General/Non-Project: 8a45fd77... (General/Non-Project)
  ✅ OQC Digitalization: ac78d5ae... (OQC Digitalization Infrastructure)

🔍 Finding worklogs with 'oqc' in description...
  ✅ Found 25 worklogs

📋 Preview (first 10 worklogs):
1. Date: 2026-01-15, User: 홍길동, Hours: 4.0
   Description: OQC 관련 업무 처리...

📊 Statistics:
  Total worklogs: 25
  Total hours: 120.5
  Unique users: 5
  Date range: 2026-01-01 to 2026-02-01

[DRY RUN] Would update 25 worklogs
💡 Run with --execute to actually update the worklogs
```

**주의사항**:
- 기본적으로 Dry Run 모드로 실행됩니다
- 실제 업데이트를 하려면 `--execute` 옵션을 반드시 사용해야 합니다
- 업데이트 전에 반드시 Dry Run으로 결과를 확인하세요

---

## 작업 흐름

### 1단계: 스키마 확인
```bash
python scripts/inspect_db_schema.py
```

**확인 사항**:
- OQC Digitalization 프로젝트가 존재하는지
- 연결된 IO 번호가 무엇인지
- General/Non-Project 프로젝트 ID

### 2단계: Dry Run으로 확인
```bash
python scripts/update_oqc_worklogs.py
```

**확인 사항**:
- 업데이트될 WorkLog 개수
- 업데이트될 WorkLog의 내용
- 통계 정보 (시간, 사용자, 날짜 범위)

### 3단계: 실제 업데이트
```bash
python scripts/update_oqc_worklogs.py --execute
```

**확인 사항**:
- 업데이트 완료 메시지
- 배치 처리 진행 상황

---

## 문제 해결

### 에러: "General/Non-Project not found"
- `inspect_db_schema.py`로 General/Non-Project 프로젝트 확인
- 프로젝트 이름이 정확한지 확인 (대소문자, 공백 등)

### 에러: "OQC Digitalization project not found"
- `inspect_db_schema.py`로 OQC 프로젝트 확인
- 프로젝트 이름에 "OQC"와 "Digitalization"이 포함되어 있는지 확인
- IO 번호로 검색하는 로직도 확인

### 업데이트할 WorkLog가 없음
- description에 "oqc"가 정확히 포함되어 있는지 확인 (대소문자 무시)
- General/Non-Project에 할당된 WorkLog인지 확인

---

## 관련 파일

- `backend/scripts/update_oqc_worklogs.py` - 메인 업데이트 스크립트
- `backend/scripts/inspect_db_schema.py` - 스키마 조사 스크립트
- `backend/app/models/project.py` - Project 모델 정의
- `backend/app/models/internal_io.py` - InternalIO 모델 정의
- `backend/app/models/recharge_io.py` - RechargeIO 모델 정의

---

## 참고

- WorkLog의 description은 대소문자를 구분하지 않고 검색합니다
- 프로젝트 검색은 이름 기반으로 수행됩니다
- IO 번호는 InternalIO와 RechargeIO 모두에서 검색합니다
- 배치 크기는 100개로 설정되어 있습니다
