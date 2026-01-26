# AI 어시스턴트 기반 워크로그 자동 입력 기능

## 개요
자연어로 업무를 입력하면 AI(Ollama + Phi3)가 분석하여 프로젝트, 업무유형, 시간을 자동으로 매핑하는 기능 구현. 사용자가 "오전에 OQC 미팅하고 오후에 개발함"과 같이 입력하면 구조화된 워크로그 항목으로 변환됨.

## 주요 변경사항

### 개발한 것
- **Docker 인프라**: Ollama 서비스 추가 (docker-compose.dev.yml)
- **Backend API**: `/api/ai/ai-parse`, `/api/ai/ai-health` 엔드포인트
- **AI 서비스**: Ollama 클라이언트, 프롬프트 템플릿, 파싱 로직
- **Frontend UI**: AI 탭, 자연어 입력, 파싱 결과 미리보기/수정 컴포넌트

### 수정한 것
- `backend/app/core/config.py`: Ollama 설정 추가 (URL, 모델, 타임아웃)
- `backend/app/main.py`: AI 라우터 등록
- `frontend/src/pages/WorkLogsPage.tsx`: AI 탭 추가
- `frontend/src/types/index.ts`: AI 관련 타입 추가

### 생성된 파일 (15개)
```
backend/
├── app/
│   ├── schemas/ai_worklog.py          # Pydantic 스키마
│   ├── services/ollama_client.py      # Ollama HTTP 클라이언트
│   ├── services/ai_worklog_service.py # AI 파싱 비즈니스 로직
│   ├── prompts/worklog_parser.py      # 프롬프트 템플릿
│   └── api/endpoints/ai_worklog.py    # API 엔드포인트
└── tests/test_ai_worklog.py           # 단위 테스트

frontend/src/
├── api/ai-worklog.ts                  # API 클라이언트
├── hooks/useAIWorklog.ts              # React Query 훅
├── components/worklogs/
│   ├── AIWorklogInput.tsx             # 자연어 입력 컴포넌트
│   └── AIWorklogPreview.tsx           # 미리보기/편집 컴포넌트
└── components/ui/
    ├── textarea.tsx                   # Textarea 컴포넌트
    ├── alert.tsx                      # Alert 컴포넌트
    └── badge.tsx                      # Badge 컴포넌트

frontend/e2e/ai-worklog.spec.ts        # E2E 테스트
```

## 핵심 코드

### 프롬프트 템플릿 (worklog_parser.py)
```python
SYSTEM_TEMPLATE = """당신은 업무 기록 파싱 전문가입니다...
## 시간 산정 규칙
- "오전" = 4시간, "오후" = 4시간, "잠깐" = 0.5시간
## 사용 가능한 업무 유형
{work_types}
## 사용 가능한 프로젝트
{projects}
## 출력 형식 (JSON만)
{"entries":[{"project_id":...,"work_type_id":...,"hours":...}]}"""
```

### AI 서비스 흐름
```
사용자 입력 → 프롬프트 생성 (프로젝트/업무유형 목록 포함)
→ Ollama API 호출 → JSON 파싱 → 검증/매핑 → 응답
```

## 결과
- ✅ Ollama 컨테이너 실행 (phi3:mini 모델)
- ✅ AI 연결 상태 표시 (AI 연결됨/안됨)
- ✅ 자연어 파싱 및 워크로그 변환
- ⚠️ 복잡한 입력은 처리 시간 길어짐 (최대 2-3분)

## 다음 단계

### 성능 개선
- [ ] 더 빠른 모델로 교체 (llama3.2, gemma2 등 검토)
- [ ] 프롬프트 캐싱으로 반복 호출 최적화
- [ ] 스트리밍 응답으로 UX 개선

### 기능 개선
- [ ] 사용자별 자주 사용하는 프로젝트 우선 표시
- [ ] 이전 워크로그 패턴 학습
- [ ] 프로젝트 키워드 사전 추가 (OQC→OQC Infra 등)

### 안정성
- [ ] 타임아웃 시 재시도 로직
- [ ] 오프라인 폴백 (수동 입력 유도)
- [ ] 에러 메시지 상세화

## 사용 방법
```bash
# 1. Ollama 시작
docker compose -f docker-compose.dev.yml up -d ollama

# 2. 모델 다운로드 (최초 1회)
docker exec edwards-ollama ollama pull phi3:mini

# 3. 서비스 시작
docker compose -f docker-compose.dev.yml up -d

# 4. WorkLogs 페이지 → AI 탭 → 자연어 입력 → AI 분석
```
