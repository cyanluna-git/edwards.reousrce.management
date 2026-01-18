# Deploy Configuration

서버 배포 관련 설정 파일 디렉토리

## 📁 Files

- `.env.vm` - 서버 접속 정보 (Git에 커밋되지 않음)
- `.env.vm.example` - 서버 접속 정보 예시

## 🔐 서버 정보

`.env.vm` 파일에 다음 정보가 저장됩니다:

```bash
VM_IP=10.182.252.32
VM_USER=atlasAdmin
VM_PASSWORD=********
```

## 🚀 배포 방법

배포 스크립트는 **루트의 `scripts/` 폴더**에 있습니다:

```powershell
# 전체 배포 (빌드 + 백업 + 배포)
.\scripts\deploy_to_vm.ps1

# 빌드 스킵
.\scripts\deploy_to_vm.ps1 -SkipBuild

# 백업 스킵 (빠른 배포)
.\scripts\deploy_to_vm.ps1 -SkipBackup
```

## 📚 자세한 내용

- **빠른 시작:** `../QUICKSTART.md`
- **배포 가이드:** `../docs/DEPLOYMENT.md`
- **README:** `../README.md`

## 📝 Note

- `.env.vm`은 보안상 Git에 커밋되지 않습니다
- 필요시 `.env.vm.example`을 복사하여 `.env.vm` 생성
