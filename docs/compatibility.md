# Cross-Platform Compatibility Guide

## ✅ OS 호환성 현황

### Windows ✓
- Python 3.8+
- Docker Desktop for Windows
- PowerShell 또는 CMD

### macOS ✓
- Python 3.8+
- Docker Desktop for Mac
- zsh 또는 bash

### Linux ✓
- Python 3.8+
- Docker & Docker Compose
- bash

---

## 🔧 호환성이 보장되는 이유

### 1. Python 스크립트 (`run.py`)
- **cross-platform**: `pathlib.Path` 사용으로 자동 경로 처리
- **universal**: `subprocess` 모듈로 OS 독립적 명령 실행
- **encoding-safe**: 다양한 인코딩 자동 감지

### 2. Dockerfile
- **Fixed pnpm version**: `pnpm@9.12.0` 고정으로 OS 간 일관성 보장
- **Hoisted node-linker**: `node-linker hoisted` 설정으로 표준 node_modules 구조
- **Direct node execution**: pnpm 스크립트 대신 `node node_modules/.bin/vite` 직접 실행

### 3. Configuration Files
- **.gitattributes**: 모든 파일의 line ending을 LF로 정규화
  ```
  * text=auto        # 자동 정규화
  *.js text eol=lf   # 모든 .js 파일은 LF
  *.py text eol=lf   # 모든 .py 파일은 LF
  ```

### 4. Docker Compose
- **OS 독립적**: 모든 OS에서 동일한 docker-compose.yml 사용
- **자동 경로 처리**: Docker가 OS의 경로 분리자 자동 처리

---

## 🚀 실행 방법

### Windows
```bash
python run.py backend    # 백엔드 시작
python run.py frontend   # 프론트엔드 시작
python run.py all        # 모든 서비스 시작
```

### macOS / Linux
```bash
python3 run.py backend   # 백엔드 시작
python3 run.py frontend  # 프론트엔드 시작
python3 run.py all       # 모든 서비스 시작
```

또는 shebang을 이용한 직접 실행:
```bash
chmod +x run.py
./run.py backend
```

---

## ⚠️ 주의사항

### Windows에서
- Docker Desktop이 실행 중이어야 함
- PowerShell 또는 CMD에서 실행 가능

### macOS에서
- Docker Desktop for Mac이 실행 중이어야 함
- `python3` 명령 사용 권장 (python은 Python 2.7로 설정될 수 있음)

### Linux에서
- Docker 및 Docker Compose가 설치되어 있어야 함
- sudo 권한이 필요할 수 있음

---

## 📋 환경 변수

`.env` 파일은 자동으로 생성되며, `.env.example`에서 복사됩니다.

주요 환경 변수:
```
DOCKER_BUILD_ARCH=auto   # CPU 아키텍처 (auto, amd64, arm64)
BACKEND_PORT=8004        # 백엔드 포트
FRONTEND_PORT=3004       # 프론트엔드 포트
DB_PORT=5434            # 데이터베이스 포트
```

---

## 🐳 Docker 버전 호환성

- **Docker**: 20.10+
- **Docker Compose**: v2.0+

호환성 확인:
```bash
docker --version
docker compose version
```

---

## 🔍 문제 해결

### "Cannot find module vite" 에러
✓ **해결됨**: pnpm@9.12.0 + hoisted node-linker로 자동 해결

### Line ending 문제
✓ **해결됨**: .gitattributes로 자동 정규화

### 아키텍처 호환성
✓ **해결됨**: DOCKER_BUILD_ARCH=auto로 자동 감지

---

## 📝 최종 확인

모든 수정사항이 git에 커밋되었으므로, Mac 또는 다른 OS로 pull한 후:

```bash
git pull
python run.py all      # 또는 python3 run.py all
```

실행하면 자동으로 모든 호환성 설정이 적용됩니다!
