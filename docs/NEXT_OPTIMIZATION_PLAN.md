# Next Optimization & Development Plan

SSO 연동 및 실서버 안정화 이후, 시스템의 유지보수 효율과 성능을 높이기 위한 로드맵입니다.

---

## 1. 운영 효율 최적화 (Operational Efficiency)

### 1.1 환경 변수 관리 단일화 -- DONE
*   **현황**: ~~`.env` (로컬)와 `.env.remote` (서버)를 수동으로 각각 관리 중.~~
*   **완료**: `deploy_env_remote.py --profile server`로 `.env`에서 `.env.remote`를 자동 생성. `run_full_deploy.ps1`과 `build_and_compress.py`에 자동 생성 단계 통합.

### 1.2 서버 백업 자동화 (Cron Job)
*   **현황**: `backup_remote_db.py`를 수동으로 실행하여 백업.
*   **목표**: 매일 새벽 서버 데이터를 자동으로 로컬 또는 클라우드 스토리지에 백업.
*   **작업 내용**:
    *   서버 내 `crontab` 또는 GitHub Actions를 이용한 정기 백업 스케줄링.

---

## 2. 사용자 경험 고도화 (UX Improvement)

### 2.1 SSO 미등록 유저 안내 페이지 -- DONE
*   **현황**: ~~DB에 없는 유저가 로그인 시 JSON 에러(`403 Forbidden`)만 출력.~~
*   **완료**: 백엔드에서 미등록/비활성 유저를 `/login?error=unregistered&email=...`로 리다이렉트. 프론트엔드 LoginPage에 안내 배너 + 권한 요청 이메일 링크 표시.

### 2.2 정식 SSL 인증서 적용
*   **현황**: 자가 서명 인증서 사용으로 브라우저 경고(HTTPS 경고) 발생.
*   **목표**: 사내 정식 인증서(PKI)를 적용하여 보안 경고 제거.
*   **작업 내용**:
    *   IT 부서로부터 `.crt`, `.key` 파일을 수령하여 Nginx 설정 업데이트.

---

## 3. 성능 최적화 (Performance & Scalability)

### 3.1 대량 데이터 테이블 최적화 (10만 건+)
*   **현황**: Worklogs 데이터가 늘어남에 따라 전체 조회 속도 저하 우려.
*   **목표**: 수십만 건의 데이터도 1초 이내에 로딩.
*   **작업 내용**:
    *   **Server-side Pagination**: 프런트엔드에서 모든 데이터를 받지 않고, 필요 페이지만 요청하도록 API 수정.
    *   **Index Optimization**: `work_date`, `user_id`, `project_id` 복합 인덱스 점검.

### 3.2 메타데이터 캐싱
*   **현황**: 부서, 직급 등 변하지 않는 정보를 매번 DB에서 조회.
*   **목표**: API 응답 속도 향상 및 DB 부하 감소.
*   **작업 내용**:
    *   백엔드 메모리 캐시(lru_cache) 또는 Redis를 이용한 공통 코드 캐싱.

---

## 4. 분석 및 모니터링

### 4.1 AI Worklog 분류 성능 모니터링
*   **목표**: 사용자가 입력한 Worklog를 AI가 얼마나 정확히 분류하는지 추적.
*   **작업 내용**:
    *   AI 분류 성공/실패 로그 기록 및 통계 화면 추가.
