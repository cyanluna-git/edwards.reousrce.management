# Edwards Project VM 배포 자동화 스크립트 (PowerShell)
# 사용법: .\deploy_to_vm.ps1

param(
    [string]$VMPath = "/data/eob",
    [switch]$SkipImageLoad,
    [switch]$Help
)

# 색상 정의
$Colors = @{
    Green  = "`e[32m"
    Yellow = "`e[33m"
    Red    = "`e[31m"
    Cyan   = "`e[36m"
    Reset  = "`e[0m"
}

function Write-Header {
    param([string]$Title)
    Write-Host "`n$($Colors.Cyan)$('=' * 70)`e[0m"
    Write-Host "$($Colors.Cyan)$($Title.PadLeft([Math]::Floor(70/2) + $Title.Length/2))`e[0m"
    Write-Host "$($Colors.Cyan)$('=' * 70)`e[0m`n"
}

function Write-Info {
    param([string]$Message)
    Write-Host "$($Colors.Green)[INFO]$($Colors.Reset) $Message"
}

function Write-Warn {
    param([string]$Message)
    Write-Host "$($Colors.Yellow)[WARN]$($Colors.Reset) $Message"
}

function Write-Error {
    param([string]$Message)
    Write-Host "$($Colors.Red)[ERROR]$($Colors.Reset) $Message"
}

function Write-Success {
    param([string]$Message)
    Write-Host "$($Colors.Green)[✓]$($Colors.Reset) $Message"
}

function Show-Help {
    @"
Edwards Project VM 배포 스크립트

사용법:
    .\deploy_to_vm.ps1 [옵션]

옵션:
    -VMPath <경로>        VM에서의 배포 경로 (기본값: /data/eob)
    -SkipImageLoad        Docker 이미지 로드 스킵
    -Help                 이 도움말 표시

예제:
    .\deploy_to_vm.ps1
    .\deploy_to_vm.ps1 -VMPath /opt/edwards
    .\deploy_to_vm.ps1 -SkipImageLoad

필수 조건:
    1. .env.vm 파일이 같은 디렉토리에 있어야 함
    2. SSH 클라이언트가 설치되어 있어야 함 (Windows 10+ 기본 포함)
    3. build_output 디렉토리에 압축 파일이 있어야 함
"@
}

function Load-EnvFile {
    if (-not (Test-Path ".env.vm")) {
        Write-Error ".env.vm 파일을 찾을 수 없습니다."
        exit 1
    }

    $env = @{}
    Get-Content ".env.vm" | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.+)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $env[$key] = $value
        }
    }
    return $env
}

function Find-LatestArchive {
    $archives = Get-ChildItem "build_output\edwards_project_*.tar.gz" -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1

    if (-not $archives) {
        Write-Error "build_output 디렉토리에서 압축 파일을 찾을 수 없습니다."
        exit 1
    }

    return $archives
}

function Test-SSHConnection {
    param(
        [string]$User,
        [string]$IP
    )

    Write-Info "SSH 연결 테스트..."
    $result = ssh -o BatchMode=yes -o ConnectTimeout=5 "$User@$IP" "echo ok" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "SSH 연결 성공"
        return $true
    } else {
        Write-Warn "SSH 연결 실패 - 비밀번호를 사용하여 진행합니다"
        return $false
    }
}

function Deploy {
    param(
        [string]$VMUser,
        [string]$VMIP,
        [string]$VMPassword,
        [string]$ArchivePath,
        [string]$ArchiveName,
        [string]$VMDeployPath,
        [bool]$SkipImageLoad
    )

    Write-Header "Edwards Project VM 배포"

    $archiveSize = (Get-Item $ArchivePath).Length / 1MB
    Write-Info "압축 파일: $ArchiveName"
    Write-Info "크기: $([Math]::Round($archiveSize, 1))MB"
    Write-Info "VM: ${VMUser}@${VMIP}"
    Write-Info "배포 경로: $VMDeployPath`n"

    # 1. SCP 전송
    Write-Host "`n$($Colors.Cyan)[1/4] 파일을 VM에 전송 중...$($Colors.Reset)"
    
    try {
        $startTime = Get-Date
        Write-Info "SCP 전송 시작..."
        
        # SCP 전송 (비밀번호는 SSH_ASKPASS나 ssh-add로 처리)
        # Windows에서는 ssh가 설정되어 있다면 자동으로 prompt 표시
        scp -r "$ArchivePath" "${VMUser}@${VMIP}:/tmp/" 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "SCP 전송 실패"
            exit 1
        }
        
        $elapsed = ((Get-Date) - $startTime).TotalSeconds
        $speed = if ($elapsed -gt 0) { $archiveSize / $elapsed } else { 0 }
        
        Write-Success "전송 완료 ($([Math]::Round($speed, 1))MB/s, $([Math]::Round($elapsed, 1))초)"
    }
    catch {
        Write-Error "전송 중 오류 발생: $_"
        exit 1
    }

    # 2. 기존 컨테이너 중지
    Write-Host "`n$($Colors.Cyan)[2/4] 기존 컨테이너 중지...$($Colors.Reset)"
    
    $command = @"
cd $VMDeployPath/edwards_project
echo '기존 컨테이너 중지 중...'
docker-compose down 2>/dev/null || true
"@

    ssh "${VMUser}@${VMIP}" $command 2>&1 | Out-Null
    Write-Success "컨테이너 중지 완료"

    # 3. 파일 추출 및 이미지 로드
    Write-Host "`n$($Colors.Cyan)[3/4] 파일 추출 및 이미지 로드...$($Colors.Reset)"
    
    $extractCommand = if ($SkipImageLoad) {
        @"
cd $VMDeployPath
echo '파일 추출 중...'
tar -xzf /tmp/$ArchiveName
echo '✓ 파일 추출 완료'
"@
    } else {
        @"
cd $VMDeployPath
echo '파일 추출 중...'
tar -xzf /tmp/$ArchiveName
echo '✓ 파일 추출 완료'

cd edwards_project/docker_images
echo 'Docker 이미지 로드 중...'
chmod +x load_images.sh
./load_images.sh
echo '✓ 이미지 로드 완료'
"@
    }

    ssh "${VMUser}@${VMIP}" $extractCommand 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "파일 추출 또는 이미지 로드 실패"
        exit 1
    }

    Write-Success "파일 추출 및 이미지 로드 완료"

    # 4. 서비스 시작
    Write-Host "`n$($Colors.Cyan)[4/4] 서비스 시작...$($Colors.Reset)"
    
    $startCommand = @"
cd $VMDeployPath/edwards_project
echo '서비스 시작 중...'
docker-compose up -d

echo ''
echo '상태 확인:'
docker-compose ps
"@

    ssh "${VMUser}@${VMIP}" $startCommand 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Error "서비스 시작 실패"
        exit 1
    }

    Write-Success "서비스 시작 완료"

    # 배포 완료 요약
    Write-Header "배포 완료"

    @"
$($Colors.Green)📦 배포 정보:$($Colors.Reset)
   압축 파일: $ArchiveName
   크기: $([Math]::Round($archiveSize, 1))MB
   VM: ${VMUser}@${VMIP}
   배포 경로: $VMDeployPath/edwards_project

$($Colors.Green)🔗 접근 URL:$($Colors.Reset)
   Frontend: http://eob.10.182.252.32.sslip.io
   Backend API: http://eob.10.182.252.32.sslip.io/api/docs
   Direct Frontend: http://${VMIP}:3004
   Direct Backend: http://${VMIP}:8004

$($Colors.Yellow)⚠️ 다음 단계:$($Colors.Reset)
   1. 데이터베이스 복원 (백업이 있는 경우):
      ssh ${VMUser}@${VMIP}
      cd $VMDeployPath/edwards_project
      docker-compose exec -T db psql -U postgres -d edwards < /tmp/backup.sql

   2. 서비스 상태 확인:
      docker-compose ps
      docker-compose logs -f

   3. .env 파일 필요시 수정:
      nano .env

$($Colors.Reset)자세한 가이드는 VM_DEPLOYMENT_MANUAL.md를 참조하세요.
"@
}

# Main
if ($Help) {
    Show-Help
    exit 0
}

try {
    Write-Header "Edwards Project VM 배포 스크립트"

    # 환경 설정 로드
    $env = Load-EnvFile
    $VMUser = $env.VM_USER
    $VMIP = $env.VM_IP
    $VMPassword = $env.VM_PASSWORD

    if (-not ($VMUser -and $VMIP -and $VMPassword)) {
        Write-Error ".env.vm에 VM_USER, VM_IP, VM_PASSWORD가 필요합니다."
        exit 1
    }

    # 최신 아카이브 찾기
    $archive = Find-LatestArchive
    $archivePath = $archive.FullName
    $archiveName = $archive.Name

    Write-Info "준비 완료"
    Write-Info "아카이브: $archiveName"

    # SSH 연결 테스트
    $hasSSHKey = Test-SSHConnection -User $VMUser -IP $VMIP

    # 배포 실행
    Deploy `
        -VMUser $VMUser `
        -VMIP $VMIP `
        -VMPassword $VMPassword `
        -ArchivePath $archivePath `
        -ArchiveName $archiveName `
        -VMDeployPath $VMPath `
        -SkipImageLoad $SkipImageLoad

    Write-Host "`n$($Colors.Green)🎉 배포가 완료되었습니다!$($Colors.Reset)`n"
}
catch {
    Write-Error "배포 중 오류 발생: $_"
    exit 1
}
