# Power BI/CSV 동기화 시스템 - ID 매핑 및 날짜 필터 추가

## 개요
Power BI Desktop 또는 CSV 파일에서 워크로그를 PostgreSQL로 동기화하는 시스템을 구현했습니다. 기존 DB의 user/project를 email/code로 찾아서 매핑하며, 날짜 범위 필터와 INSERT ONLY 모드를 지원합니다.

## 주요 변경사항

### 개발한 것
- **CSV 모드** (`--csv` 플래그): macOS/Linux에서 CSV 파일로 동기화 가능
- **날짜 범위 옵션**: `-0` (오늘), `-d 7d` (7일), `--from/--to` (기간)
- **ID 매핑 로직**: 기존 `reseed_worklogs_person_id.py` 방식 적용
  - `Person.id` → `email` → DB UUID
  - `Project.Id` → `IO code` → DB UUID
  - 키워드 매칭 fallback

### 수정한 것
- `sync_from_pbi.py`: INSERT ONLY 모드로 변경 (DELETE/UPDATE 제거)
- 중복 체크: `(user_id, project_id, date, hours)` 조합으로 판별

## 핵심 코드

```python
# CSV Person.id → DB UUID 매핑
for person_id, email in self.person_id_to_email.items():
    if email in self.email_to_uuid:
        self.transformer.lookup.user_id_map[person_id] = self.email_to_uuid[email]

# 프로젝트 키워드 매칭 (fallback)
for keyword in sorted(self.project_keywords.keys(), key=len, reverse=True):
    if len(keyword) > 4 and keyword in desc_lower:
        return self.project_keywords[keyword]
```

## 사용 방법

```bash
# CSV 모드 (macOS/Linux)
python -m scripts.sync_from_pbi --csv --worklogs -0        # 오늘
python -m scripts.sync_from_pbi --csv --worklogs -d 7d     # 최근 7일
python -m scripts.sync_from_pbi --csv --worklogs --from 2025-01-20 --to 2025-01-27

# Power BI 모드 (Windows)
python -m scripts.sync_from_pbi --worklogs -0
```

## 결과
- ✅ Python 문법 검증 통과
- ✅ 기존 DB 매핑 로직 재사용

## 다음 단계
- Windows 환경에서 Power BI Desktop 연결 테스트
- 대용량 워크로그 (10만+) 배치 처리 성능 최적화
- 동기화 결과 리포트 기능 (성공/실패/스킵 상세)
