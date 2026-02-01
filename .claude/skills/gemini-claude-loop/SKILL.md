---
name: gemini-claude-loop
description: Gemini-Claude Engineering Loop 방법론을 적용하여 계획, 검토, 구현의 3단계 프로세스로 안전하고 품질 높은 코드를 작성합니다.
disable-model-invocation: false
---

# Gemini-Claude Engineering Loop Skill

**Gemini-Claude Engineering Loop**는 복잡한 기능 개발을 위한 3단계 반복 프로세스입니다. Gemini로 계획을 수립하고, Claude로 검토하며, 수정사항을 반영하여 구현합니다.

## 프로세스 개요

```
Phase 1: Planning with Gemini
    ↓
Phase 2: Validation with Claude
    ↓
Phase 3: Implementation with Fixes
    ↓
(반복)
```

## Phase 1: Planning with Gemini

### 목적
- 상세한 구현 계획 수립
- 아키텍처 설계
- 비즈니스 로직 정의
- 안전 기능 설계

### 산출물
- 구현 계획 문서
- 파일 구조 설계
- 분류 규칙 및 비즈니스 로직
- 에러 처리 전략

### 예시 (Project Financial Backfill)
```markdown
## 구현 계획
1. 두 파일 아키텍처 (service + script)
2. 분류 규칙 및 비즈니스 로직
3. 안전 기능 (dry-run, 리포트)
4. 에러 처리 전략
```

## Phase 2: Validation with Claude

### 목적
- 코드 리뷰 및 품질 검증
- 잠재적 문제점 식별
- 보안 취약점 검사
- 성능 이슈 발견

### 검토 항목
- **메모리 누수**: `.all()` 사용, 대량 데이터 로딩
- **트랜잭션 관리**: 단일 거대 트랜잭션 vs 배치 커밋
- **인덱스**: 누락된 인덱스 및 FK 제약조건
- **성능**: N+1 쿼리, 비효율적인 패턴 매칭
- **보안**: 파일 경로 처리, SQL injection

### 우선순위 분류
- **Priority 1 (P1)**: Critical - 반드시 수정 필요
- **Priority 2 (P2)**: Important - 수정 권장
- **Priority 3 (P3)**: Nice to have - 선택적 개선

### 예시 검토 결과
```
24개 이슈 발견:
- P1: Memory leak (`.all()` loading all records)
- P1: Transaction management (single massive transaction)
- P1: Missing indexes and FK constraints
- P2: File path security
- P2: Log rotation
```

## Phase 3: Implementation with Fixes

### 목적
- 모든 Priority 1, 2 이슈 해결
- Priority 3 이슈 선택적 적용
- 테스트 및 검증

### 적용 사례 (Project Financial Backfill)
- ✅ 배치 처리 (100개씩)
- ✅ 증분 커밋 (50개마다)
- ✅ Early-exit 패턴 매칭
- ✅ 로테이팅 로그 파일 (10MB max, 5개 백업)
- ✅ 절대 경로 사용
- ✅ Unicode 정규화 및 예외 처리

## 실제 적용 사례

### Project Financial Data Backfill (2026-01-21)

**Phase 1: Planning**
- Gemini가 상세 구현 계획 작성
- `ProjectClassifier` 서비스 설계
- 분류 규칙 정의

**Phase 2: Validation**
- Claude가 24개 이슈 발견
- 메모리 누수, 트랜잭션 관리 등 Critical 이슈 식별

**Phase 3: Implementation**
- 모든 P1, P2 이슈 해결
- 코드 품질 점수: 7.2/10 → 8.5/10

## 사용 가이드

### 1. 복잡한 기능 개발 시

```markdown
이 기능은 Gemini-Claude Loop로 개발하겠습니다.

**Phase 1: Planning**
- [ ] 아키텍처 설계
- [ ] 비즈니스 로직 정의
- [ ] 안전 기능 설계

**Phase 2: Validation**
- [ ] 코드 리뷰 요청
- [ ] 이슈 목록 작성
- [ ] 우선순위 분류

**Phase 3: Implementation**
- [ ] P1 이슈 해결
- [ ] P2 이슈 해결
- [ ] 테스트 및 검증
```

### 2. 코드 리뷰 요청 시

```markdown
다음 코드를 Gemini-Claude Loop 방식으로 검토해주세요:
- 메모리 사용량
- 트랜잭션 관리
- 성능 최적화
- 보안 취약점
```

## 핵심 원칙

1. **안전 우선**: Dry-run 기본, 명시적 확인 필요
2. **점진적 개선**: 배치 처리, 증분 커밋
3. **검증 필수**: 모든 Critical 이슈 해결 후 배포
4. **문서화**: 각 단계의 결정 사항 기록

## 관련 문서

- `docs/BACKFILL_IMPLEMENTATION_SUMMARY.md` - 실제 적용 사례
- `docs/gemini-notes.md` - Gemini 가이드
- `docs/gems-tech-lead-persona.md` - Tech Lead 페르소나

## 성공 지표

- ✅ **코드 품질 점수**: 8.0/10 이상
- ✅ **Critical 이슈**: 0개
- ✅ **테스트 커버리지**: 80% 이상
- ✅ **성능 목표**: 목표 달성
