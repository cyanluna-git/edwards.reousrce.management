# 스크립트가 있는 디렉토리로 위치 변경
Set-Location $PSScriptRoot

# 가상환경이 있으면 활성화
if (Test-Path "venv") {
    Write-Host "Activating virtual environment..."
    if (Test-Path "venv\Scripts\Activate.ps1") {
        # Dot-sourcing을 사용하여 현재 스코프에 환경 변수 적용
        . ".\venv\Scripts\Activate.ps1"
    }
    else {
        Write-Warning "venv directory exists but Activate.ps1 not found."
    }
}

# .env 파일 존재 확인 및 환경 변수 로드
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env..."
    Get-Content ".env" | Where-Object { $_ -notmatch "^\s*#" -and $_ -match "=" } | ForEach-Object {
        $line = $_.Trim()
        if ($line) {
            $parts = $line -split "=", 2
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            # 따옴표 제거
            if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
                $value = $matches[1]
            }
            [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}
else {
    Write-Warning ".env file not found. Using default settings."
}

# 포트 설정 (환경 변수 PORT가 있으면 사용, 없으면 8000)
if (-not $env:PORT) {
    $env:PORT = "8002"
}
$port = $env:PORT

# 해당 포트가 사용 중인지 확인 (Listening 상태인 것만)
$tcpConnection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
if ($tcpConnection) {
    $pid_val = $tcpConnection.OwningProcess
    Write-Error "Error: Port $port is already in use by process ID $pid_val."
    Write-Host "You can stop it or run with a different port: `$env:PORT=8001; .\run_local.ps1"
    exit 1
}

Write-Host "Starting Edwards Backend on http://localhost:$port..."
# uvicorn 실행
uvicorn app.main:app --reload --port $port
