"""
Worklog Parser Prompt Templates
Dynamic prompt generation for AI worklog parsing
"""

from typing import List, Dict, Any


class WorklogParserPrompt:
    """Generates prompts for worklog parsing AI"""

    SYSTEM_TEMPLATE = """당신은 업무 기록 파싱 전문가입니다. 사용자의 자연어 업무 설명을 분석하여 JSON 형식의 워크로그 항목으로 변환합니다.

## 시간 산정 규칙
- "오전", "오전에", "아침에" = 4시간
- "오후", "오후에" = 4시간
- "하루 종일", "온종일" = 8시간
- "잠깐", "잠시", "조금" = 0.5시간
- "N시간", "N시간 동안" = N시간
- 시간 언급 없음 = 1시간

## 한국어-업무유형 매핑
- 미팅, 회의, 논의 → Meeting 관련 유형
- 개발, 코딩, 구현 → Development 관련 유형
- 설계, 디자인, 아키텍처 → Design 관련 유형
- 문서, 작성, 리포트 → Documentation 관련 유형
- 테스트, 검증, QA → Testing/Verification 관련 유형
- 리뷰, 검토 → Review 관련 유형
- 분석, 조사 → Analysis 관련 유형

## 사용 가능한 업무 유형 (work_type_id:이름)
{work_types}

## 사용 가능한 프로젝트 (project_id:이름)
{projects}

## 규칙
1. 여러 업무는 각각 별도의 entry로 분리
2. 프로젝트명/코드가 언급되면 위 목록에서 매칭
3. 업무 유형은 위 목록에서 가장 적절한 것 선택
4. description은 원본 한국어 유지
5. 매칭 불가시 id는 null, name만 기재

## 출력 형식 (JSON만, 다른 설명 없이)
{{"entries":[{{"project_id":"프로젝트ID 또는 null","project_name":"프로젝트명","work_type_id":업무유형ID,"work_type_name":"업무유형명","description":"원본 업무 설명","hours":시간,"confidence":신뢰도0~1}}]}}"""

    USER_TEMPLATE = """다음 업무 내용을 분석하여 JSON으로 변환하세요:

"{text}"

JSON 형식으로만 응답하세요."""

    @classmethod
    def build_system_prompt(
        cls,
        projects: List[Dict[str, Any]],
        work_types: List[Dict[str, Any]],
    ) -> str:
        """
        Build the system prompt with project and work type lists.

        Args:
            projects: List of project dicts with id, code, name
            work_types: List of work type dicts with id, code, name

        Returns:
            Formatted system prompt string
        """
        # Format projects (limit to 15 for token efficiency)
        if projects:
            projects_str = "\n".join(
                f'  - {p["id"][:8]}:{p["name"]}'
                for p in projects[:15]
            )
        else:
            projects_str = "  (프로젝트 없음)"

        # Format work types (limit to 12)
        if work_types:
            work_types_str = "\n".join(
                f'  - {w["id"]}:{w["name"]}'
                for w in work_types[:12]
            )
        else:
            work_types_str = "  (업무유형 없음)"

        return cls.SYSTEM_TEMPLATE.format(
            projects=projects_str,
            work_types=work_types_str,
        )

    @classmethod
    def build_user_prompt(cls, text: str, target_date: str) -> str:
        """
        Build the user prompt with the input text.

        Args:
            text: User's natural language input
            target_date: Target date in YYYY-MM-DD format

        Returns:
            Formatted user prompt string
        """
        return cls.USER_TEMPLATE.format(text=text)
