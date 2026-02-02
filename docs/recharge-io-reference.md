# Recharge IO Reference Guide

## 개요

이 문서는 Work Type별 Recharge IO 매핑 정보를 정리한 참조 문서입니다.
Recharge IO는 비용 청구(Cost Recharging) 목적으로 사용되며, 여러 프로젝트가 동일한 Recharge IO를 공유할 수 있습니다.

---

## Work Type 분류 (원본)

| Work Type | 설명 | PRJ IO No. | Internal Order | Recharge PRJ No. | Remark |
|-----------|------|------------|----------------|------------------|--------|
| 00 Pre Gate | NPI PRJ 사전 검토 건 | (ABT)407111 / (IS)407057 / (ACM)407056 | - | - | NPI 사전검토 단계 |
| 01 NPI/TD/TFT | NPI PRJ, Core tech PRJ, TFT 활동 등 | 각 PRJ IO 사용 | - | - | R&D IO 생성 업무 |
| 02 ME/QC Project & Support | 제조, 품질 업무 지원 | - | (有) | (ABT,IS)407278 / (ACM)407327 | SUN - Operations / Factory Support |
| 03 ETO Project | ETO Project | - | - | (ABT,IS)407279 / (ACM)407296 | SUN - Product Improvement |
| 04 Legacy HVM CIP | Global EC 통한 양산 장비 CIP 대응 | - | - | (ABT,IS)407279 / (ACM)407296 | SUN - Product Improvement |
| 05 Legacy Service Update | 서비스/고객 추가 요구사항 Update | - | - | (ABT,IS)407328 / (ACM)407332 | VSS - Product Improvement |
| 06 Sales/Service Support | Sales/Service 업무 지원 | - | - | (ABT,IS)407331 / (ACM)407332 | VSS - Sales / Service Support |

### Work Type별 시작/완료 조건

| Work Type | 시작 조건 | 완료 조건 |
|-----------|----------|----------|
| 00 Pre Gate | DPM, PM 등의 Support 요청 | PRJ NO 발행 |
| 01 NPI/TD/TFT | PRJ in 접수 & PRJ No 발행 | Gate6 |
| 02 ME/QC Project & Support | PRJ 시작 \| Support 요청 | PRJ 종료 미팅 \| Support 완료 |
| 03 ETO Project | Project in 접수 & Kick off 미팅 | TRR 완료 |
| 04 Legacy HVM CIP | CIP 접수 미팅 \| 개발 | Release \| 현장 검증 완료 |
| 05 Legacy Service Update | SCR/DEMO 접수 미팅 \| 개발 | Release \| 현장 검증 완료 |
| 06 Sales/Service Support | 요청 접수/미팅/메일 | 정보 제공 \| 설계자료 공유 |

---

## Recharge IO 기준 분류

### 1. Recharge IO 없음 (PRJ IO 직접 사용)

| Work Type | 설명 | PRJ IO No. | 비고 |
|-----------|------|------------|------|
| 00 Pre Gate | NPI PRJ 사전 검토 건 | (ABT)407111 / (IS)407057 / (ACM)407056 | PRJ No 발행 전 단계 |
| 01 NPI/TD/TFT | NPI PRJ, Core tech PRJ, TFT 활동 | 각 PRJ IO 사용 | Gate6까지 |

### 2. SUN - Operations / Factory Support

**ABT/IS**: 407278 | **ACM**: 407327

| Work Type | 설명 | Internal Order |
|-----------|------|----------------|
| 02 ME/QC Project & Support | 제조, 품질 업무 지원, Engineering 주관 외 프로젝트 | (有) |

### 3. SUN - Product Improvement

**ABT/IS**: 407279 | **ACM**: 407296

| Work Type | 설명 | 상세 기록 |
|-----------|------|----------|
| 03 ETO Project | ETO Project (개별 PRJ IO 미발행) | ETO PRJ Name |
| 04 Legacy HVM CIP | Global EC 통한 양산 장비 CIP 대응 | Global EC name |

### 4. VSS - Product Improvement

**ABT/IS**: 407328 | **ACM**: 407332

| Work Type | 설명 | 상세 기록 |
|-----------|------|----------|
| 05 Legacy Service Update | 서비스/고객 추가 요구사항 Update | SCO name |

### 5. VSS - Sales / Service Support

**ABT/IS**: 407331 | **ACM**: 407332

| Work Type | 설명 | 상세 기록 |
|-----------|------|----------|
| 06 Sales/Service Support | Sales/Service 업무 지원 (설계자료, 문서, 현장 이슈) | - |

> **참고**: ACM 407332는 VSS Product Improvement와 VSS Sales/Service Support에서 공유됨

---

## Recharge IO 등록 테이블

### ABT/IS 법인 (공통)

| io_number | name | description |
|-----------|------|-------------|
| 407278 | SUN - Operations / Factory Support | ME/QC Project & Support. 제조/품질 업무 지원, Engineering 주관 외 프로젝트 |
| 407279 | SUN - Product Improvement | ETO Project, Legacy HVM CIP. Global EC 통한 양산 장비 CIP 대응 |
| 407328 | VSS - Product Improvement | Legacy Service Update. 서비스/고객 추가 요구사항 Update (SCO) |
| 407331 | VSS - Sales / Service Support | Sales/Service 업무 지원. 설계자료 전달, 문서 대응, 현장 이슈 문의 |

### ACM 법인

| io_number | name | description |
|-----------|------|-------------|
| 407327 | SUN - Operations / Factory Support | ME/QC Project & Support. 제조/품질 업무 지원, Engineering 주관 외 프로젝트 |
| 407296 | SUN - Product Improvement | ETO Project, Legacy HVM CIP. Global EC 통한 양산 장비 CIP 대응 |
| 407332 | VSS - Product Improvement / Sales Support | Legacy Service Update + Sales/Service Support 공용 |

---

## 시스템 등록용 통합 테이블

| # | io_number | name | description | 사용 목적 |
|---|-----------|------|-------------|----------|
| 1 | 407278 | [ABT/IS] SUN Operations Support | ME/QC 제조/품질 업무 지원 | • ME/QC Project & Support<br>• 제조/품질 업무 지원<br>• Engineering 주관 외 프로젝트 |
| 2 | 407279 | [ABT/IS] SUN Product Improvement | ETO, Legacy HVM CIP 대응 | • ETO Project<br>• Legacy HVM CIP<br>• Global EC 양산 장비 CIP 대응 |
| 3 | 407328 | [ABT/IS] VSS Product Improvement | Legacy Service Update (SCO) | • Legacy Service Update<br>• 서비스/고객 추가 요구사항 Update<br>• SCO 기반 개선 |
| 4 | 407331 | [ABT/IS] VSS Sales/Service Support | 설계자료, 문서, 현장 이슈 대응 | • Sales/Service Support<br>• 설계자료 전달<br>• 문서 대응<br>• 현장 이슈 문의 대응 |
| 5 | 407327 | [ACM] SUN Operations Support | ME/QC 제조/품질 업무 지원 | • ME/QC Project & Support<br>• 제조/품질 업무 지원<br>• Engineering 주관 외 프로젝트 |
| 6 | 407296 | [ACM] SUN Product Improvement | ETO, Legacy HVM CIP 대응 | • ETO Project<br>• Legacy HVM CIP<br>• Global EC 양산 장비 CIP 대응 |
| 7 | 407332 | [ACM] VSS Support (공용) | Product Improvement + Sales/Service | • Legacy Service Update<br>• Sales/Service Support<br>• 서비스/고객 요구사항 Update<br>• 설계자료/문서/현장 이슈 대응 |

---

## 고유 Recharge IO 요약

| Recharge IO (ABT/IS) | Recharge IO (ACM) | 용도 | Work Types |
|---------------------|-------------------|------|------------|
| - | - | PRJ IO 직접 사용 | 00, 01 |
| 407278 | 407327 | SUN Operations/Factory | 02 |
| 407279 | 407296 | SUN Product Improvement | 03, 04 |
| 407328 | 407332 | VSS Product Improvement | 05 |
| 407331 | 407332 | VSS Sales/Service | 06 |

---

## 변경 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-02-01 | 최초 작성 | - |
