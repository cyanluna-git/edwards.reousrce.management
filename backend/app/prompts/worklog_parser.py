"""
Worklog Parser Prompt Templates
Dynamic prompt generation for AI worklog parsing

Optimized for token efficiency with English system prompt.
"""

from typing import List, Dict, Any, Optional


class WorklogParserPrompt:
    """Generates prompts for worklog parsing AI"""

    # English system prompt for token efficiency (~40% savings vs Korean)
    SYSTEM_TEMPLATE = """You are a worklog parsing expert. Analyze user's natural language work description and convert it to structured JSON worklog entries.

## Time Estimation Rules
- Korean "오전"/"오전에"/"아침에" (morning) = 4 hours
- Korean "오후"/"오후에" (afternoon) = 4 hours
- Korean "하루 종일"/"온종일" (all day) = 8 hours
- Korean "잠깐"/"잠시"/"조금" (briefly) = 0.5 hours
- "N시간"/"N시간 동안" (N hours) = N hours
- No time mentioned = 1 hour (default)

## Korean-WorkType Mapping Guide
| Korean Keywords | Maps To |
|-----------------|---------|
| 미팅, 회의, 논의 | Meeting types (PRJ-MTG*) |
| 개발, 코딩, 구현 | Development types (ENG-SW*) |
| 설계, 디자인, 아키텍처 | Design types (ENG-DES*) |
| 문서, 작성, 리포트 | Documentation types (KNW-DOC) |
| 테스트, 검증, QA | Testing/Verification types (ENG-VV) |
| 리뷰, 검토 | Review types (PRJ-REV, ENG-DES-REV) |
| 분석, 조사, 시뮬레이션 | Analysis types (ENG-SIM) |
| 교육, 세미나 | Training types (KNW-TRN) |
| 출장, 현장 | Field service types (SUP-FLD) |
| 실험, 랩 | Lab types (OPS-LAB) |

## Common Project Keyword Hints
- OQC, 오큐씨 → OQC Digitalization project
- GEN3, GEN3+, 젠3 → EUV Gen3 Plus project
- GEN4, 젠4 → EUV Gen4 project
- HRS → Hydrogen Recycling System project
- PROTRON, 프로트론 → Protron Abatement project
- TUMALO, 투말로 → Tumalo project
- ACM → ACM NPI/ETO project

## Available Work Types (id:code:name)
{work_types}

## Available Projects (id:code:name)
{projects}

## Rules
1. Separate multiple tasks into individual entries
2. Match project by name/code from the list above
3. Select the most appropriate work_type from the list
4. Polish the description - convert casual speech to professional summary
   - Example: "OQC 인프라 DB 설계했고" → "OQC 인프라 데이터베이스 설계"
   - Example: "Justin이랑 HRS 관련 미팅" → "HRS 프로젝트 미팅"
5. If no exact match, set id to null and provide name only
6. IMPORTANT: Return work_type_id as the actual ID from the list, not code

## Output Format (JSON only, no explanation)
{{"entries":[{{"project_id":"project_id_or_null","project_name":"project_name","work_type_id":"work_type_id_or_null","work_type_name":"work_type_name","description":"polished_description","hours":hours_number,"confidence":0_to_1}}]}}

{hints_section}"""

    USER_TEMPLATE = """Parse the following work description to JSON:

"{text}"

Respond with JSON only."""

    @classmethod
    def build_system_prompt(
        cls,
        projects: List[Dict[str, Any]],
        work_types: List[Dict[str, Any]],
        hints: Optional[List[str]] = None,
    ) -> str:
        """
        Build the system prompt with project and work type lists.

        Args:
            projects: List of project dicts with id, code, name
            work_types: List of work type dicts with id, code, name
            hints: Optional list of detected keyword hints

        Returns:
            Formatted system prompt string
        """
        # Format projects with full id:code:name (limit to 20 for token efficiency)
        if projects:
            projects_str = "\n".join(
                f'  - {p["id"]}:{p.get("code", "")}:{p["name"]}'
                for p in projects[:20]
            )
        else:
            projects_str = "  (No projects available)"

        # Format work types with id:code:name (limit to 15)
        if work_types:
            work_types_str = "\n".join(
                f'  - {w["id"]}:{w.get("code", "")}:{w["name"]}'
                for w in work_types[:15]
            )
        else:
            work_types_str = "  (No work types available)"

        # Build hints section if hints are provided
        hints_section = ""
        if hints:
            project_hints = [h.replace("project:", "") for h in hints if h.startswith("project:")]
            worktype_hints = [h.replace("worktype:", "") for h in hints if h.startswith("worktype:")]

            hint_parts = []
            if project_hints:
                hint_parts.append(f"Detected project keywords: {', '.join(project_hints[:5])}")
            if worktype_hints:
                hint_parts.append(f"Detected worktype keywords: {', '.join(worktype_hints[:5])}")

            if hint_parts:
                hints_section = "## Detected Hints\n" + "\n".join(hint_parts)

        return cls.SYSTEM_TEMPLATE.format(
            projects=projects_str,
            work_types=work_types_str,
            hints_section=hints_section,
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
