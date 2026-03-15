# Deployment Guide

Edwards Engineering Management System 서버 배포 가이드입니다.

## 현재 기본 배포 대상

- 서버 IP: `10.182.252.32`
- 사용자: `atlasAdmin`
- 원격 경로: `/data/eob/edwards_project`
- 도메인: `https://eob.10.182.252.32.sslip.io`

## 권장 배포 방식

기본 배포 스크립트는 [full_deploy.sh](/home/edwards/Dev/edwards.operation.board/scripts/deploy/full_deploy.sh) 입니다.

```bash
bash ./scripts/deploy/full_deploy.sh
```

수행 순서:

1. `.env`에서 `.env.remote` 생성
2. 배포용 아카이브 빌드
3. 최신 아카이브 선택
4. 원격 디렉터리 준비 및 DB 백업
5. 아카이브 업로드
6. 원격 압축 해제 및 이미지 로드
7. `docker-compose up -d`
8. 컨테이너 상태와 로컬 헬스체크 확인

## 주요 옵션

```bash
# 기존 아카이브로 빠르게 재배포
bash ./scripts/deploy/full_deploy.sh --skip-build

# 특정 아카이브 지정
bash ./scripts/deploy/full_deploy.sh \
  --skip-build \
  --archive build_output/edwards_project_20260313_075912.tar.gz

# DB 백업 없이 배포
bash ./scripts/deploy/full_deploy.sh --skip-backup

# .env.remote 생성 생략
bash ./scripts/deploy/full_deploy.sh --skip-env-sync

# 다른 서버/경로로 배포
bash ./scripts/deploy/full_deploy.sh \
  --server-ip 192.168.1.100 \
  --username deploy \
  --domain app.example.com \
  --remote-path /opt/edwards_project
```

지원 옵션:

- `--server-ip <IP>`
- `--username <USER>`
- `--domain <DOMAIN>`
- `--remote-path <DIR>`
- `--archive <PATH>`
- `--skip-backup`
- `--skip-build`
- `--skip-env-sync`

## 환경 변수

서버용 환경 파일은 [env.py](/home/edwards/Dev/edwards.operation.board/scripts/deploy/env.py) 로 생성합니다.

```bash
# 서버 프로파일로 .env.remote 생성
python3 scripts/deploy/env.py --profile server

# 도메인 반영
python3 scripts/deploy/env.py --profile server --domain app.example.com

# 생성 후 서버로 직접 업로드
python3 scripts/deploy/env.py \
  --profile server \
  --domain app.example.com \
  --scp atlasAdmin@10.182.252.32:/data/eob/edwards_project/.env.remote
```

서버 프로파일 주요 변환:

- `DEBUG=false`
- `LOG_LEVEL=info`
- `SAML_*_URL`을 배포 도메인 기준으로 교체
- `CORS_ORIGINS`에 배포 도메인 반영
- `DATABASE_URL`, `VITE_DEV_PROXY_TARGET` 제거

## 빌드 아카이브 생성

배포 패키지는 [build.py](/home/edwards/Dev/edwards.operation.board/scripts/deploy/build.py) 가 생성합니다.

```bash
python3 scripts/deploy/build.py
```

출력:

- `build_output/edwards_project_YYYYMMDD_HHMMSS.tar.gz`

포함 항목:

- `backend`, `frontend`
- `docker-compose.yml`
- `.env.example`, `.env.remote`, `.env.remote.example`
- Docker 이미지 tarball
- `DEPLOY_ON_VM.md`, `load_images.sh`

제외 항목:

- `.git`, `.codex`, `.claude`, `kanban-board`
- `screenshots`, `playwright-report`, `test-results`
- `tests`, `e2e`, `logs`, `reports`, `coverage`
- `node_modules`, `.venv`, `.next`, `dist`, `build_output`

## 수동 배포

```bash
# 1. 서버용 env 생성
python3 scripts/deploy/env.py --profile server --domain eob.10.182.252.32.sslip.io

# 2. 아카이브 생성
python3 scripts/deploy/build.py

# 3. 업로드
scp build_output/edwards_project_*.tar.gz atlasAdmin@10.182.252.32:/tmp/

# 4. 서버에서 배포
ssh atlasAdmin@10.182.252.32
cd /data/eob/edwards_project
docker stop edwards-api edwards-web || true
docker rm edwards-api edwards-web || true
tar -xzf /tmp/edwards_project_*.tar.gz --strip-components=1
rm /tmp/edwards_project_*.tar.gz
cd docker_images && chmod +x load_images.sh && ./load_images.sh && cd ..
docker-compose up -d
```

## 배포 확인

```bash
# 컨테이너 상태
ssh atlasAdmin@10.182.252.32 "cd /data/eob/edwards_project && docker-compose ps"

# 백엔드 헬스체크
ssh atlasAdmin@10.182.252.32 "curl -s http://localhost:8004/health"

# 프론트 응답 확인
ssh atlasAdmin@10.182.252.32 "curl -I http://localhost:3004"

# 외부 도메인 확인
curl -k -I https://eob.10.182.252.32.sslip.io
```

정상 기준:

- `edwards-api`, `edwards-web`, `edwards-postgres`가 `Up`
- `http://localhost:8004/health`가 `{"status":"healthy"}`
- 외부 도메인이 `200 OK` 또는 HTTP에서 HTTPS로 `301`

## 데이터베이스

현재 DB 컨테이너:

- `edwards-postgres`
- 이미지: `postgres:15`
- 외부 포트: `5434`

배포 스크립트는 배포 전 원격 서버에서 다음 위치로 SQL 백업을 남깁니다.

- `/data/eob/edwards_project/backups/edwards_backup_YYYYMMDD_HHMMSS.sql`

수동 백업:

```bash
ssh atlasAdmin@10.182.252.32 \
  "cd /data/eob/edwards_project && docker exec edwards-postgres pg_dump -U postgres -d edwards > backups/manual_backup.sql"
```

## 트러블슈팅

원격 경로 권한 문제:

```bash
ssh atlasAdmin@10.182.252.32 "ls -ld /data/eob /data/eob/edwards_project"
```

컨테이너 로그 확인:

```bash
ssh atlasAdmin@10.182.252.32 "docker logs --tail 100 edwards-api"
ssh atlasAdmin@10.182.252.32 "docker logs --tail 100 edwards-web"
```

디스크 공간 확인:

```bash
ssh atlasAdmin@10.182.252.32 "df -h"
```

기존 아카이브로 재배포:

```bash
bash ./scripts/deploy/full_deploy.sh --skip-build --archive build_output/edwards_project_YYYYMMDD_HHMMSS.tar.gz
```
