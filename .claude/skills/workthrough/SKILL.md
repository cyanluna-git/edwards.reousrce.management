---
name: workthrough
description: 프로젝트의 workthrough 문서들을 참조하여 과거 개발 작업 기록과 패턴을 이해하고 적용합니다.
disable-model-invocation: false
---

# Workthrough Skill

프로젝트의 `workthrough/` 디렉토리에 저장된 개발 작업 기록을 참조하여 일관성 있는 개발 패턴을 유지하고, 과거 경험을 활용합니다.

## 목적

- 과거 개발 작업 기록 참조
- 일관된 개발 패턴 유지
- 비슷한 작업의 재사용 가능한 솔루션 찾기
- 실패 케이스와 해결 방법 학습

## 사용 시나리오

1. **새 기능 개발 전**: 비슷한 과거 작업 검색
2. **버그 수정**: 유사한 문제 해결 사례 찾기
3. **아키텍처 결정**: 과거 설계 결정 참고
4. **최적화 작업**: 성능 개선 사례 참조

## 주요 Workthrough 문서

### 최적화 관련
- `2026-01-28_11_00_route-level-code-splitting.md` - Route-level code splitting 적용
- `2026-01-28_14_30_vercel-react-best-practices.md` - Vercel React Best Practices 적용
- `2026-01-31_19_30_vercel-best-practices-optimization.md` - 인라인 테이블 최적화

### 마이그레이션 관련
- `2026-01-30_20_30_csv-worklog-migration-skill.md` - CSV worklog 마이그레이션
- `2026-01-30_22_45_db-backup-skill-and-env-consolidation.md` - DB 백업 스킬

### 기능 개발 관련
- `2026-01-26_16_00_ai-worklog-auto-input.md` - AI worklog 자동 입력
- `2026-01-31_17_00_project-inline-editing-table.md` - 프로젝트 인라인 편집 테이블
- `2026-02-01_recharge-io-feature.md` - Recharge IO 기능

### AI/LLM 관련
- `2026-02-06-llm-abstraction-and-prompt-optimization.md` - LLM abstraction layer (PCAS), prompt English conversion, team task null project rule

## 사용 방법

1. **관련 workthrough 검색**: 작업과 관련된 workthrough 문서 찾기
2. **패턴 확인**: 유사한 작업의 구현 패턴 확인
3. **코드 참조**: 과거 구현 코드 참조
4. **개선점 적용**: 과거 경험을 바탕으로 개선점 적용

## 주의사항

- Workthrough는 **과거 작업 기록**이므로 현재 코드베이스와 다를 수 있음
- 최신 코드를 먼저 확인하고, workthrough는 참고용으로만 사용
- 비슷한 작업이라도 현재 요구사항이 다를 수 있으므로 맹목적 복사 금지

## 관련 디렉토리

- `workthrough/` - 모든 workthrough 문서
- `docs/` - 프로젝트 문서
- `CLAUDE.md` - 프로젝트 개요 및 가이드
