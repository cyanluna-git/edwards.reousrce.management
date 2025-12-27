# Hot Reload 설정 가이드

## ✅ 현재 핫리로드 상태

### Frontend (React + Vite)
- ✓ **활성화됨**: src, public, vite.config.ts 변경 시 자동 리로드
- ✓ **HMR (Hot Module Replacement)**: 상태를 유지한 채로 모듈만 교체
- ✓ **CHOKIDAR_USEPOLLING=true**: Docker 환경에서 파일 변경 감지 최적화

### Backend (FastAPI + Uvicorn)
- ✓ **활성화됨**: ./backend/app/ 변경 시 자동 리로드
- ✓ **재시작 없음**: 모듈만 재로드되어 데이터베이스 연결 유지
- ✓ **마이그레이션 마운트**: ./backend/alembic/ 변경 감지

---

## 🔄 어떻게 작동하는가?

### Docker Volume Mounts (bind mounts)

**Frontend**:
```yaml
volumes:
  - ./frontend/src:/app/src           # 소스 코드 변경 감지
  - ./frontend/public:/app/public     # 정적 파일 변경 감지
  - ./frontend/index.html:/app/index.html
  - ./frontend/vite.config.ts:/app/vite.config.ts
  - ./frontend/tsconfig.json:/app/tsconfig.json
```

**Backend**:
```yaml
volumes:
  - ./backend/app:/app/app                    # 파이썬 코드 변경 감지
  - ./backend/alembic:/app/alembic            # DB 마이그레이션
  - ./backend/scripts:/app/scripts
  - ./backend/alembic.ini:/app/alembic.ini
  - ./backend/requirements.txt:/app/requirements.txt
```

### 작동 원리

1. **로컬 파일 변경** → IDE에서 코드 수정
2. **파일 시스템 감지** → Docker가 변경 감지
3. **자동 리로드** → 
   - Frontend: Vite HMR이 브라우저 자동 새로고침
   - Backend: Uvicorn이 Python 모듈 재로드
4. **실시간 반영** → 브라우저에서 즉시 확인

---

## 🧪 핫리로드 테스트 방법

### Frontend 테스트

**1단계: 서비스 시작**
```bash
python run.py all    # 또는 python3 run.py all
```

**2단계: 브라우저 접속**
```
http://localhost:3004
```

**3단계: 코드 수정**

파일을 열고 변경:
```
frontend/src/App.tsx
```

예시: 텍스트 변경
```tsx
// 변경 전
<h1>Welcome</h1>

// 변경 후
<h1>Welcome to Edwards! 🎉</h1>
```

**4단계: 확인**
- ✓ 브라우저 자동 새로고침
- ✓ 변경사항 즉시 반영
- ✓ **상태 유지**: 입력값이나 스크롤 위치 유지

---

### Backend 테스트

**1단계: 서비스 시작**
```bash
python run.py all
```

**2단계: API 테스트**
```
http://localhost:8004/docs
```

**3단계: 코드 수정**

파일을 열고 변경:
```
backend/app/main.py
```

예시: 엔드포인트 추가
```python
@app.get("/test")
def test_endpoint():
    return {"message": "Hot reload working!"}
```

**4단계: 확인**
- ✓ Uvicorn 자동 재로드 메시지
- ✓ API 문서 새로고침
- ✓ 새 엔드포인트 즉시 사용 가능

---

## ⚙️ 환경 변수

### Frontend HMR 설정
```env
# docker-compose.yml에 설정됨
CHOKIDAR_USEPOLLING=true  # Docker에서 파일 감시 활성화
DEBUG=vite:*              # Vite 디버그 로깅
VITE_API_URL=http://localhost:8004/api  # 백엔드 URL
```

### Backend 리로드 설정
```env
# docker-compose.yml의 uvicorn 실행
uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload
```

---

## 🛠️ 트러블슈팅

### Frontend 핫리로드가 안 됨

**원인 1: 파일 감시 시스템 문제**
```bash
# Docker 재시작
docker-compose restart frontend

# 또는 재빌드
docker-compose up -d --build frontend
```

**원인 2: 너무 큰 변경**
- TypeScript 타입 에러 시 전체 리로드 필요
- 타입 정의 파일 변경 시 수동 새로고침 필요

**확인 방법: 개발자 도구 확인**
```
브라우저 콘솔 → 네트워크 탭
WebSocket ws://localhost:3004/@vite/hmr 연결 확인
```

---

### Backend 핫리로드가 안 됨

**원인 1: Syntax Error**
```bash
# 로그 확인
docker-compose logs -f backend

# 에러 수정 후 자동 재로드됨
```

**원인 2: 모듈 임포트 에러**
- 순환 참조 발생 시 수동 재시작 필요
```bash
docker-compose restart backend
```

**확인 방법: 로그 확인**
```bash
docker-compose logs -f backend | grep -i "reload\|started"
```

---

## 📝 주의사항

### Frontend
- ❌ package.json 변경 시 → 컨테이너 재빌드 필요
- ❌ vite.config.ts 주요 변경 시 → 재시작 필요
- ✓ src 폴더 변경 → 자동 리로드

### Backend
- ❌ requirements.txt 변경 시 → 컨테이너 재빌드 필요
- ❌ 데이터베이스 마이그레이션 작성 후 → 수동 마이그레이션 실행 필요
- ✓ app 폴더 Python 파일 변경 → 자동 리로드

---

## 🚀 최상의 개발 경험

**추천 개발 워크플로우:**

```bash
# 터미널 1: 백엔드 로그 보기
docker-compose logs -f backend

# 터미널 2: 프론트엔드 로그 보기
docker-compose logs -f frontend

# 터미널 3: 코드 편집 (IDE 사용)
# 이곳에서 코드 수정하면 위의 두 터미널에서 리로드 메시지 확인 가능
```

**실시간 개발:**
- IDE와 브라우저/API 문서 나란히 배치
- 코드 변경 → 자동 리로드 → 결과 확인
- 즉각적인 피드백 루프로 생산성 향상

---

## ✨ 현재 설정 요약

| 항목 | Frontend | Backend |
|------|----------|---------|
| 감시 방식 | Vite HMR | Uvicorn reload |
| 파일 감시 | CHOKIDAR_USEPOLLING=true | 자동 |
| 마운트 경로 | src/, public/ | app/, alembic/ |
| 리로드 속도 | <1초 | 1-2초 |
| 상태 유지 | ✓ (HMR) | ✗ (전체 재로드) |

모두 설정되어 있으므로 바로 개발을 시작할 수 있습니다! 🎉
