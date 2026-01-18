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
docker save edwards_project-backend:latest | gzip > docker_images/edwards-backend.tar.gz

Write-Host "Exporting Frontend Image..."
docker save edwards_project-frontend:latest | gzip > docker_images/edwards-frontend.tar.gz

Write-Host "Exporting Postgres Image..."
docker save postgres:15 | gzip > docker_images/postgres-15.tar.gz
```

**주의:** 만약 `gzip` 명령어를 찾을 수 없다면, `gzip` 없이 `.tar`로 저장하셔도 됩니다.
`docker save edwards_project-backend:latest -o docker_images/edwards-backend.tar`

## 6. 배포 스크립트 생성 (Deployment Scripts)

수동 빌드 시 필요한 배포 헬퍼 스크립트를 생성합니다.

**`docker_images\load_images.ps1` 생성:**

```powershell
$content = @"
# Load Docker images on Windows
`$ScriptDir = Split-Path -Parent `$MyInvocation.MyCommand.Path
Set-Location `$ScriptDir
Write-Host "Loading Docker images..."
if (Test-Path "postgres-15.tar.gz") { docker load -i postgres-15.tar.gz }
if (Test-Path "edwards-backend.tar.gz") { docker load -i edwards-backend.tar.gz }
if (Test-Path "edwards-frontend.tar.gz") { docker load -i edwards-frontend.tar.gz }
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
