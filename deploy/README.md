# 🚀 Edwards Project 배포 가이드

## 📋 폴더 구조

```
deploy/
├── README.md                          ← 이 파일 (시작)
├── DEPLOY_GUIDE.md                    ← 📖 전체 배포 가이드 (필독!)
├── VM_DEPLOYMENT_MANUAL.md            ← 수동 배포 단계별 가이드
├── DEPLOYMENT_CHECKLIST.md            ← ✅ 배포 검증 체크리스트
├── deploy_to_vm.ps1                   ← 🔧 PowerShell 자동 배포 (권장)
├── deploy_to_vm_expect.py             ← 🔧 Linux/Mac 자동 배포
└── deploy_to_vm.py                    ← 🔧 기본 배포 스크립트
```

## 🎯 빠른 시작 (5분)

### Windows 사용자 (가장 쉬움)

```powershell
# 1. PowerShell 관리자 모드로 실행
# 2. 프로젝트 디렉토리로 이동
cd D:\00.Dev\7.myApplication\engineering.resource.management

# 3. 실행 정책 설정
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# 4. 배포 실행
.\deploy\deploy_to_vm.ps1

# 완료! 5-10분 소요
```

### Linux/Mac/WSL 사용자

```bash
# 수동 배포 (더 세밀한 제어 가능)
# deploy/VM_DEPLOYMENT_MANUAL.md 를 단계별로 따라하세요

# 또는 자동 배포 (expect 설치 필요)
python3 deploy/deploy_to_vm_expect.py
```

## 📖 문서 별 가이드

| 문서 | 설명 | 대상자 |
|------|------|--------|
| **DEPLOY_GUIDE.md** | 🌟 전체 배포 안내 (가장 먼저 읽기) | 모두 |
| **VM_DEPLOYMENT_MANUAL.md** | 상세한 수동 배포 단계 | Linux/Mac 사용자 |
| **DEPLOYMENT_CHECKLIST.md** | 배포 후 검증 절차 | 모두 |

## 🔧 배포 스크립트 선택

| 스크립트 | OS | 방식 | 난이도 | 소요시간 |
|---------|----|----|--------|---------|
| **deploy_to_vm.ps1** | Windows | 자동 | ⭐☆☆☆☆ | 5-10분 |
| **deploy_to_vm_expect.py** | Linux/Mac | 자동 | ⭐⭐☆☆☆ | 5-10분 |
| **VM_DEPLOYMENT_MANUAL.md** | 모두 | 수동 | ⭐⭐☆☆☆ | 10-15분 |

## 📦 배포 대상

- **서버**: VTISAZUAPP218
- **IP**: 10.182.252.32
- **사용자**: atlasAdmin
- **경로**: /data/eob/edwards_project

## 🔗 배포 후 접근

- **프론트엔드**: http://eob.10.182.252.32.sslip.io
- **백엔드 API**: http://10.182.252.32:8004/api/docs

## ⚡ 배포 후 필수 작업

```bash
# 1. 데이터베이스 복원 (매우 중요!)
scp edwards_backup.sql atlasAdmin@10.182.252.32:/tmp/
ssh atlasAdmin@10.182.252.32
cd /data/eob/edwards_project
docker-compose exec -T db psql -U postgres -d edwards < /tmp/edwards_backup.sql

# 2. 환경 변수 확인
cat .env

# 3. 서비스 상태 확인
docker-compose ps
```

## 📞 문제 발생 시

1. **DEPLOYMENT_CHECKLIST.md** 의 "배포 후 검증" 섹션 확인
2. **VM_DEPLOYMENT_MANUAL.md** 의 "트러블슈팅" 섹션 확인
3. 로그 확인: `docker-compose logs -f`

## 💡 팁

### PowerShell 스크립트 도움말 보기

```powershell
.\deploy\deploy_to_vm.ps1 -Help
```

### 특정 배포 경로 지정

```powershell
.\deploy\deploy_to_vm.ps1 -VMPath /opt/edwards
```

### Docker 이미지 로드 스킵

```powershell
.\deploy\deploy_to_vm.ps1 -SkipImageLoad
```

## 📝 배포 프로세스 요약

```
1. 파일 전송 (SCP)
   ↓
2. 기존 컨테이너 중지
   ↓
3. 파일 추출 (tar)
   ↓
4. Docker 이미지 로드
   ↓
5. docker-compose up -d
   ↓
6. 서비스 상태 확인
   ↓
7. ✅ 배포 완료!
```

## 🎯 다음 단계

1. **DEPLOY_GUIDE.md** 읽기 (5분)
2. **배포 스크립트 실행** (5-10분)
3. **DEPLOYMENT_CHECKLIST.md로 검증** (5분)

**총 소요 시간**: 약 15-25분

---

**준비 완료! 배포를 시작하세요.** 🚀

마지막 업데이트: 2026-01-15
