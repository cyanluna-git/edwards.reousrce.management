# Dev Tools (개발용 스크립트)

이 폴더는 **운영 코드/정식 시딩 루틴이 아닌**, 개발 과정에서 필요할 수 있는 **임시 유틸/검증 스크립트**를 보관합니다.

## 원칙

- **운영 환경에서 실행하지 마세요.** (데이터 변조/대량 INSERT/성능 문제 가능)
- 스키마/데이터가 바뀌면 쉽게 깨질 수 있으므로, 필요 시 스크립트를 수정해서 사용합니다.
- 정식 기능/정식 시딩으로 승격되는 경우에는 `backend/scripts/` 또는 앱 로직으로 이동합니다.

## 목록

- `seed_worklogs_test_sample.py`
  - ref_table의 샘플 CSV를 읽어서 worklogs에 일부(테스트용) 데이터를 넣는 유틸입니다.
  - 로컬 DB(`localhost:5434`) 및 로컬 CSV 파일에 의존합니다.

## 실행 (예시)

```bash
# (프로젝트 루트에서)
python backend/dev_tools/seed_worklogs_test_sample.py
```
