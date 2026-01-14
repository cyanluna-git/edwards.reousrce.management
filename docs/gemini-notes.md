# Gemini 가이드: Edwards 엔지니어링 운영 관리 시스템

이 문서는 AI 에이전트(Gemini)가 이 프로젝트의 코드를 일관성 있고 안전하게 수정하기 위한 가이드라인을 담고 있습니다.

## 1. 프로젝트 개요

- **목적**: Edwards(또는 PCAS) 엔지니어링 조직의 운영 관리(프로젝트, 인력, 리소스, 업무 기록)를 위한 내부 풀스택 웹 애플리케이션입니다.
- **기술 스택**:
    - **통합**: Docker Compose
    - **백엔드**: Python, FastAPI, SQLAlchemy, PostgreSQL
    - **프론트엔드**: TypeScript, React, Vite, Tailwind CSS

## 2. 무시할 파일 및 디렉토리 (Ignore List)

다음 파일 및 디렉토리는 AI가 분석하거나 수정하지 않아야 합니다. 이들은 주로 종속성, 빌드 결과물, 캐시, 로컬 환경 설정 파일입니다.

```
# Dependencies
/backend/venv/
/frontend/node_modules/

# Build artifacts
/frontend/dist/

# Caches
/backend/.mypy_cache/
/backend/**/__pycache__/

# Git
.git/

# Environment files
.env
.env.*
!/.env.example

# Logs & Configuration
*.log
/frontend/pnpm-lock.yaml
/frontend/nginx.conf
/backend/alembic.ini
```

## 3. 백엔드 가이드라인 (Python/FastAPI)

`backend/.cursorrules`에 명시된 규칙을 따릅니다.

- **아키텍처**:
    - `app/api/endpoints/`: 라우팅 및 HTTP 요청/응답 처리
    - `app/services/`: 핵심 비즈니스 로직
    - `app/models/`: SQLAlchemy 데이터베이스 모델
    - `app/schemas/`: Pydantic 데이터 유효성 검사 스키마
    - `app/core/`: 설정, 데이터베이스 연결, 보안
- **핵심 원칙**:
    - **강력한 타입**: 모든 함수와 변수에 타입 힌트를 사용합니다.
    - **의존성 주입**: FastAPI의 `Depends()`를 적극적으로 활용합니다.
    - **비동기 처리**: 데이터베이스 접근 등 I/O 작업에는 `async def`를 사용합니다.
    - **단일 책임 원칙**: 각 모듈은 하나의 명확한 목적을 가집니다.
- **데이터베이스**:
    - 로컬 개발은 Docker Compose의 PostgreSQL 컨테이너를 사용합니다.
    - 기본 키는 테이블별로 UUID 또는 문자열/정수 PK가 혼재할 수 있습니다(모델 정의를 따름).

## 4. 🚨 Database Strategy (Dev 기준)

- **기본 전략:** 개발 환경에서는 빠른 반복을 위해 앱 시작 시 `Base.metadata.create_all()`로 스키마를 생성/보정합니다.
- **리셋:** `.env`의 `RESET_DB=true`로 public schema를 drop & recreate 하는 리셋 플로우를 사용합니다.
- **Seeding:** 초기 데이터(Seeding)는 앱 시작 시 주입될 수 있습니다.
- **Alembic:** `backend/alembic/versions/*`가 존재하지만, 현재는 "스키마 최신 상태의 단일 근거"로 가정하지 않습니다.
    - 새로운 마이그레이션 생성/운영 마이그레이션 전략은 **요청이 있을 때만** 제안/작업합니다.

스키마/관계 요약은 [docs/datamodel_improv.md](./datamodel_improv.md)를 기준으로 합니다.

## 5. 프론트엔드 가이드라인 (TypeScript/React)

`frontend/.cursorrules`에 명시된 규칙을 따릅니다.

- **아키텍처**:
    - `src/pages/`: 라우팅되는 페이지 컴포넌트
    - `src/components/`: 재사용 가능한 컴포넌트 (UI 및 레이아웃)
    - `src/hooks/`: 재사용 가능한 커스텀 훅
    - `src/api/`: 서버 API 클라이언트 및 데이터 호출 로직
    - `src/types/`: 전역 타입 정의
    - `src/lib/`: 유틸리티 함수
- **핵심 원칙**:
    - **TypeScript Strict Mode**: 엄격한 타입 검사를 준수합니다.
    - **데이터 호출**: API 통신에는 `axios` 클라이언트와 `TanStack Query`를 사용합니다. (`useUsers` 같은 커스텀 훅으로 추상화)
    - **스타일링**: Tailwind CSS만 사용하며, 조건부 클래스는 `cn()` 유틸리티를 활용합니다.
    - **경로 별칭**: `src` 디렉토리를 가리키는 `@/` 별칭을 사용하여 `import` 경로를 깔끔하게 유지합니다.
- **네이밍 컨벤션**:
    - 컴포넌트: `PascalCase` (`UserCard.tsx`)
    - 훅: `use` 접두사를 붙인 `camelCase` (`useUsers.ts`)
    - 페이지: `PascalCase` + `Page` (`DashboardPage.tsx`)
