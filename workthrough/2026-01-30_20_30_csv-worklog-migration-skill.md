# CSV Worklog Migration AI Skill 구현

## 개요
CSV 백업 데이터에서 Worklog를 PostgreSQL로 증분 마이그레이션하는 AI Skill을 구현했습니다. 날짜 기반 필터링(-1d, -7d, -20d)과 의미론적 User/Project/WorkType 매핑을 지원하며, 과거 워크스루에서 발견된 실패 케이스(GEN3 vs GEN3+, LEGACY 프로젝트 등)를 방지하는 로직을 포함합니다.

## 주요 변경사항

### 개발한 것

**Claude Code Skill (Agent Skills 표준 준수)**
- `.claude/skills/migrate-worklogs/SKILL.md` - 스킬 정의 (frontmatter + 지침)
- `.claude/skills/migrate-worklogs/mapping-rules.md` - 상세 매핑 규칙 문서

**Resolver 서비스 (4-5단계 매칭)**
- `backend/app/services/user_resolver.py` - User 해석 (4단계: email → 이름 Fuzzy → 한글 → LLM)
- `backend/app/services/project_resolver.py` - Project 해석 (5단계: CSV ID → IO code → 키워드 → 설명 → 기본값)
- `backend/app/services/worktype_resolver.py` - WorkType 해석 (4단계: Legacy 매핑 → Title → 키워드 → AI)

**오케스트레이터 및 CLI**
- `backend/app/services/csv_migration_service.py` - 전체 마이그레이션 조율
- `backend/scripts/ai_migrate_worklogs.py` - CLI 스크립트

### 개선한 것 (과거 실패 방지)
- **GEN3 vs GEN3+ 구분**: Priority 기반 키워드 매칭 (GEN3+ > GEN3)
- **LEGACY 프로젝트 제외**: 888888 시리즈 명시적 처리
- **z [Closed] 제외**: 닫힌 프로젝트 필터링
- **Confidence Score**: 매핑 신뢰도 기반 자동/수동 분류

## 핵심 코드

```python
# project_resolver.py - GEN3 vs GEN3+ 구분
for keyword, code, priority in self.sorted_keywords:
    if keyword in desc_upper:
        # GEN3 vs GEN3+ 특별 처리
        if keyword == "GEN3" and "GEN3+" in desc_upper:
            continue  # GEN3+ 있으면 GEN3 스킵
```

```yaml
# SKILL.md - Agent Skills 표준 frontmatter
---
name: migrate-worklogs
description: CSV에서 worklog를 DB로 증분 마이그레이션
argument-hint: [-1d|-7d|-20d] [--dry-run|--execute]
disable-model-invocation: true
allowed-tools: Bash(python *), Read, Grep, Glob
---
```

## 결과

```
CSV Worklog Migration Report
Date Range: 2026-01-23 ~ 2026-01-30
Total in CSV: 107,241
Filtered (in date range): 392
Project stage1_resolved: 4
Project stage5_resolved: 388 (fallback)
```

- ✅ CSV 파싱 및 날짜 필터링 동작
- ✅ Project 매핑 (CSV → IO code) 동작
- ✅ dry-run 리포트 생성
- ⚠️ User 매핑은 DB 연결 필요

## 사용법

```bash
# 최근 7일 분석 (dry-run)
/migrate-worklogs -7d --dry-run

# 실제 적용
/migrate-worklogs -1d --execute
```

## 다음 단계

1. **DB 연결 테스트**: PostgreSQL 실행 후 전체 워크플로우 검증
2. **LLM 추론 구현**: Stage 4 (user/worktype)에 Gemini/Groq 연동
3. **Admin UI**: 저신뢰도 항목 리뷰 화면 추가
4. **자동화**: GitHub Actions에서 주기적 동기화
