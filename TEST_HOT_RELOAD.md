# 핫리로드 빠른 테스트

## 🚀 30초 핫리로드 테스트

### Frontend 테스트
1. 브라우저 열기: `http://localhost:3004`
2. 다음 파일 편집: `frontend/src/App.tsx`
3. 간단한 텍스트 수정 (예: 제목 변경)
4. **저장** 후 브라우저 자동 새로고침 확인

### Backend 테스트
1. API 문서 열기: `http://localhost:8004/docs`
2. 다음 파일 편집: `backend/app/main.py`
3. 새 엔드포인트 또는 응답값 수정
4. **저장** 후 터미널에서 "Reloading..." 메시지 확인
5. API 문서 새로고침(F5) → 변경사항 반영

---

## 📋 현재 활성 볼륨

```bash
# Frontend 볼륨 확인
docker-compose exec frontend sh -c "mount | grep src"

# Backend 볼륨 확인
docker-compose exec backend sh -c "mount | grep app"
```

---

## 🔍 로그로 확인하기

### Frontend 리로드 로그
```bash
docker-compose logs -f frontend | grep -i "reload\|HMR"
```

### Backend 리로드 로그
```bash
docker-compose logs -f backend | grep -i "reload"
```

---

## ⚡ 핫리로드 동작 흐름

1. IDE에서 코드 수정
   ↓
2. Docker 볼륨이 변경 감지 (CHOKIDAR_USEPOLLING)
   ↓
3. Vite (Frontend) 또는 Uvicorn (Backend) 자동 리로드
   ↓
4. 브라우저 자동 새로고침 또는 API 변경사항 반영
   ↓
5. 즉시 결과 확인

---

## 💡 팁

- **Frontend 개발**: IDE와 브라우저를 나란히 배치
- **Backend 개발**: IDE와 터미널을 나란히 배치
- **동시 개발**: `docker-compose logs -f` 로 모든 로그 한 번에 확인

```bash
# 모든 서비스 로그 실시간 보기
docker-compose logs -f

# 특정 서비스만
docker-compose logs -f backend
docker-compose logs -f frontend
```

완벽하게 설정되었습니다! 즐거운 개발되세요! 🎉
