# Remote to Local DB Sync Guide (Manual)

본 문서는 자동화 스크립트 사용이 어려운 환경에서 원격 서버(VTISAZUAPP218)의 DB 데이터를 로컬 개발 환경으로 수동 동기화하는 방법을 설명합니다.

## Prerequisites
- 로컬 PC에서 원격 서버로의 SSH 접근 권한
- 로컬 Docker 환경 실행 중 (컨테이너명: `edwards-postgres`)

---

## Step 1: 원격 서버에서 백업 파일 생성
원격 서버에 SSH 접속(`atlasAdmin@10.182.252.32`) 후 아래 명령어를 실행합니다.

```bash
# 원격 DB 컨테이너에서 데이터를 덤프하여 임시 파일로 저장
sudo sh -c "docker exec edwards_project-db-1 pg_dump -U postgres -d edwards --clean --if-exists > /tmp/remote_sync_manual.sql && chmod 644 /tmp/remote_sync_manual.sql"
```
*   `--clean --if-exists`: 복원 시 기존 테이블을 삭제하고 다시 생성하는 옵션입니다.
*   `chmod 644`: 로컬에서 SCP로 가져올 수 있도록 읽기 권한을 부여합니다.

---

## Step 2: 로컬 PC로 백업 파일 다운로드
로컬 PC의 터미널(PowerShell 또는 WSL)에서 프로젝트 루트 폴더로 이동 후 실행합니다.

```powershell
# 프로젝트 폴더 위치: D:\00.Dev\7.myApplication\engineering.resource.management
# SCP를 이용해 서버의 임시 파일을 로컬 backups 폴더로 가져옵니다.
scp atlasAdmin@10.182.252.32:/tmp/remote_sync_manual.sql ./backups/remote_sync_manual.sql
```

---

## Step 3: 로컬 Docker DB에 복원
로컬 PC 터미널에서 다운로드된 파일을 로컬 컨테이너로 복사하고 복원을 수행합니다.

```powershell
# 1. 로컬 Docker 컨테이너 내부로 파일 전송
docker cp ./backups/remote_sync_manual.sql edwards-postgres:/tmp/restore.sql

# 2. 컨테이너 내부에서 psql을 이용해 복원 실행
docker exec edwards-postgres psql -U postgres -d edwards -f /tmp/restore.sql
```
*   복원 중 발생하는 `NOTICE`나 `DROP` 관련 메시지는 정상적인 과정입니다.

---

## Step 4: 원격 서버 임시 파일 정리 (권장)
작업이 완료되면 원격 서버의 보안 및 용량 관리를 위해 임시 파일을 삭제합니다.

```bash
# 원격 서버 SSH 터미널에서 실행
sudo rm /tmp/remote_sync_manual.sql
```
