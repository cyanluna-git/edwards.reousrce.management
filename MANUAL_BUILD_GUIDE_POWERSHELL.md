# Manual Build & Compress Guide (PowerShell Version)

이 문서는 윈도우 **PowerShell** 환경에서 프로젝트를 수동으로 빌드하고 압축하는 단계를 안내합니다.
D 드라이브와 같은 윈도우 파일 시스템에서는 WSL보다 PowerShell을 사용하는 것이 훨씬 빠르고 권한 에러가 없습니다.

---

## 1. 준비 작업 (Clean & Copy)

먼저 빌드용 디렉토리를 초기화하고 소스 코드를 복사합니다.

```powershell
# 프로젝트 루트로 이동
Set-Location "D:\00.Dev\7.myApplication\engineering.resource.management"

# 기존 빌드 폴더 삭제 및 재생성
if (Test-Path "build_output") { Remove-Item -Recurse -Force "build_output" }
New-Item -ItemType Directory -Path "build_output\edwards_project"

# 프로젝트 파일 복사 (node_modules, .venv 등 제외)
# Robocopy는 윈도우에서 가장 빠른 복사 도구입니다.
robocopy . build_output\edwards_project /E /XD .git .github .venv node_modules dist build_output .next __pycache__ /XF .DS_Store
```

## 2. 백엔드 빌드 (Backend Build)

백엔드 실행을 위한 파이썬 가상환경을 세팅합니다.

```powershell
Set-Location "D:\00.Dev\7.myApplication\engineering.resource.management\build_output\edwards_project\backend"

# 가상환경 생성
py -3.12 -m venv .venv

# 가상환경 실행 및 의존성 설치
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# 가상환경 비활성화
deactivate
cd ..
```

## 3. 프론트엔드 빌드 (Frontend Build)

프론트엔드 정적 파일(`dist/`)을 생성합니다.

```powershell
Set-Location "frontend"

# 의존성 설치
pnpm install

# 빌드 (dist 폴더 생성됨)
pnpm build

Set-Location ".." # edwards_project 폴더로 복귀
```

**Tip:** 만약 빌드 중 `TS6133` (unused variable/import) 에러가 발생하면, 해당 파일에서 사용하지 않는 변수나 import를 삭제해야 빌드가 완료됩니다. (현재 주요 발생 지점은 `PositionsTab.tsx`이며 이미 수정되었습니다.)

## 4. Docker 이미지 빌드 (Build Images)

도커 이미지를 로컬에서 빌드합니다. (Docker Desktop이 실행 중이어야 합니다.)

```powershell
# build_output\edwards_project 위치에서 실행
docker-compose build
```

## 5. Docker 이미지 추출 (Export Images)

빌드된 이미지를 파일로 저장합니다.

```powershell
# 이미지 저장용 폴더 생성
New-Item -ItemType Directory -Path "docker_images" -Force

Write-Host "Exporting Backend Image..."
docker save edwards_project-backend:latest -o docker_images/edwards-backend.tar

Write-Host "Exporting Frontend Image..."
docker save edwards_project-frontend:latest -o docker_images/edwards-frontend.tar

Write-Host "Exporting Postgres Image..."
docker save postgres:15 -o docker_images/postgres-15.tar
```

**주의:** 만약 `gzip` 명령어를 찾을 수 있다면 `| gzip > ...tar.gz` 방식을 써도 되지만, 윈도우에서는 위와 같이 `-o ...tar` 옵션을 쓰는 것이 가장 확실합니다.

## 6. 배포 스크립트 생성 (Deployment Scripts)

수동 빌드 시 필요한 배포 헬퍼 스크립트를 생성합니다.

**`docker_images\load_images.ps1` 생성:**

```powershell
$content = @"
# Load Docker images on Windows
`$ScriptDir = Split-Path -Parent `$MyInvocation.MyCommand.Path
Set-Location `$ScriptDir
Write-Host "Loading Docker images..."
# .tar.gz 또는 .tar 파일 모두 지원
if (Test-Path "postgres-15.*") { docker load -i (Get-Item "postgres-15.*").FullName }
if (Test-Path "edwards-backend.*") { docker load -i (Get-Item "edwards-backend.*").FullName }
if (Test-Path "edwards-frontend.*") { docker load -i (Get-Item "edwards-frontend.*").FullName }
Write-Host "Done!"
"@
$content | Out-File -FilePath "docker_images\load_images.ps1" -Encoding utf8
```

## 7. 최종 압축 (Compress)

모든 준비가 완료된 폴더를 하나의 파일로 압축합니다. 윈도우 기본 기능을 사용합니다.

```powershell
Set-Location ".." # build_output 폴더로 이동

# 현재 날짜명으로 압축
$timestamp = Get-Date -Format "yyyyMMdd"
$archiveName = "edwards_project_powershell_$timestamp.zip"

# 폴더 압축
Compress-Archive -Path "edwards_project" -DestinationPath $archiveName
```

## 8. 완료

`build_output` 폴더 안에 생성된 `.zip` 파일을 확인하세요. 이 파일을 서버로 전송하시면 됩니다.
