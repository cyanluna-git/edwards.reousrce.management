# SSL 인증서 관리 - 빠른 참조 가이드

**작업 일시**: 2026-02-06  
**VM**: VTISAZUAPP218 (10.182.252.32)  
**Key Vault**: pcas-keyvault-218

---

## 🔑 중요 정보 (보안 유지 필수!)

```
VM 접속:
- IP: 10.182.252.32
- User: atlasAdmin
- Password: 7ab172XY6n9ccab8

Azure:
- Subscription: vt-hybrid-production-01
- Resource Group: AC-RGP-P-APP-10007135
- Key Vault: pcas-keyvault-218
- Location: West Europe

인증서:
- Name: ssl-cert-nginx
- 지문: 8598A289C4376855F56968A320781F021ECCB2BB
- 만료일: 2036-02-04
- PFX 비밀번호: AtlasCopcoPCAS2026
```

---

## 📋 자주 사용하는 명령어

### VM 접속
```bash
ssh atlasAdmin@10.182.252.32
# 비밀번호: 7ab172XY6n9ccab8
```

### 인증서 확인
```bash
# 만료일 확인
openssl x509 -in /etc/nginx/ssl/nginx-selfsigned.crt -noout -enddate

# 웹사이트 인증서 확인
curl -I https://eob.10.182.252.32.sslip.io/

# Nginx 상태
sudo systemctl status nginx
```

### Azure Key Vault
```bash
# Azure 로그인
az login

# 인증서 목록
az keyvault certificate list --vault-name pcas-keyvault-218 --output table

# 인증서 상세
az keyvault certificate show --vault-name pcas-keyvault-218 --name ssl-cert-nginx

# 인증서 다운로드
az keyvault certificate download \
  --vault-name pcas-keyvault-218 \
  --name ssl-cert-nginx \
  --file backup-cert.pem
```

---

## 🚨 긴급 복구 절차

### 인증서 파일이 삭제되었을 때

1. **Azure Portal 접속**: https://portal.azure.com
2. **Key Vault 이동**: pcas-keyvault-218
3. **인증서 다운로드**: ssl-cert-nginx → 다운로드 버튼
4. **VM에 복원**:

```bash
# PFX를 분리
openssl pkcs12 -in downloaded.pfx -clcerts -nokeys -out /tmp/cert.crt
openssl pkcs12 -in downloaded.pfx -nocerts -nodes -out /tmp/private.key

# 파일 복원
sudo cp /tmp/cert.crt /etc/nginx/ssl/nginx-selfsigned.crt
sudo cp /tmp/private.key /etc/nginx/ssl/nginx-selfsigned.key

# 권한 설정
sudo chmod 644 /etc/nginx/ssl/nginx-selfsigned.crt
sudo chmod 600 /etc/nginx/ssl/nginx-selfsigned.key

# Nginx 재시작
sudo systemctl restart nginx
```

### Nginx가 시작 안 될 때

```bash
# 상태 확인
sudo systemctl status nginx

# 설정 테스트
sudo nginx -t

# 에러 로그
sudo tail -50 /var/log/nginx/error.log

# 강제 재시작
sudo systemctl restart nginx
```

---

## 📅 정기 점검

### 주간 (매주 월요일)
```bash
# 웹사이트 작동 확인
curl -I https://eob.10.182.252.32.sslip.io/
```

### 월간 (매월 1일)
```bash
# 인증서 만료일 확인
openssl x509 -in /etc/nginx/ssl/nginx-selfsigned.crt -noout -enddate

# Key Vault 백업 확인
az keyvault certificate show --vault-name pcas-keyvault-218 --name ssl-cert-nginx
```

### 연간 (매년 1월)
```bash
# 시스템 업데이트
sudo apt-get update && sudo apt-get upgrade -y

# Nginx 재시작
sudo systemctl restart nginx
```

---

## 🔄 인증서 갱신 (2035년 12월)

### 옵션 1: Self-signed 재생성 (간단)

```bash
# 새 인증서 생성 (10년 유효)
sudo openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/nginx-selfsigned-new.key \
  -out /etc/nginx/ssl/nginx-selfsigned-new.crt \
  -subj "/C=KR/ST=Seoul/L=Seoul/O=Edwards/OU=Engineering/CN=*.10.182.252.32.sslip.io"

# 교체
sudo mv /etc/nginx/ssl/nginx-selfsigned.crt /etc/nginx/ssl/nginx-selfsigned.crt.bak
sudo mv /etc/nginx/ssl/nginx-selfsigned.key /etc/nginx/ssl/nginx-selfsigned.key.bak
sudo mv /etc/nginx/ssl/nginx-selfsigned-new.crt /etc/nginx/ssl/nginx-selfsigned.crt
sudo mv /etc/nginx/ssl/nginx-selfsigned-new.key /etc/nginx/ssl/nginx-selfsigned.key

# Nginx 재시작
sudo systemctl reload nginx
```

### 옵션 2: Let's Encrypt (실제 도메인 필요)

**전제조건**:
1. 실제 도메인 등록 (예: eob.atlascopco.com)
2. DNS A 레코드 설정
3. 포트 80, 443 오픈

**실행**:
```bash
sudo /path/to/scripts/setup_letsencrypt_azure.sh \
  eob.atlascopco.com \
  pcas-keyvault-218 \
  gerald.park@edwardsvacuum.com
```

---

## 📞 연락처

### 기술 지원
- VM Owner: Gerald Park (gerald.park@edwardsvacuum.com)
- IT 헬프데스크: [회사 헬프데스크 번호]
- Azure 관리자: [Azure 관리팀 연락처]

### 문서 위치
- 상세 가이드: `docs/SSL_CERTIFICATE_AZURE_KEYVAULT_WALKTHROUGH.md`
- Let's Encrypt 가이드: `docs/guides/LETSENCRYPT_AZURE_SETUP.md`
- 자동화 스크립트: `scripts/setup_letsencrypt_azure.sh`

---

## ✅ 체크리스트

### 매주
- [ ] 웹사이트 정상 작동 확인

### 매월
- [ ] 인증서 만료일 확인
- [ ] Key Vault 백업 확인
- [ ] Azure 비용 확인

### 매년
- [ ] 시스템 보안 업데이트
- [ ] 백업 복원 테스트
- [ ] Azure CLI 업데이트

### 2035년 12월
- [ ] 인증서 갱신 계획 수립
- [ ] 실제 도메인 획득 검토
- [ ] Let's Encrypt 전환 고려

---

**최종 업데이트**: 2026-02-06  
**버전**: 1.0.0
