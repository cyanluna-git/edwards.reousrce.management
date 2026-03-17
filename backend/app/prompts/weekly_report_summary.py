"""
Prompt templates for weekly report LLM summarization.

Supports two summarization levels:
- personal -> group (aggregate individual reports into sub-team/department summary)
- group -> team (aggregate sub-team summaries into department summary)
"""

from typing import Optional


def build_personal_to_group_prompt(
    reports: list[dict],
    group_name: str,
    existing_body: str = "",
) -> tuple[str, str]:
    """
    Build prompts to summarize personal weekly reports into a group/team report.

    Args:
        reports: List of {"user_name": str, "content": str} dicts.
                 Each content is already truncated to 2000 chars.
        group_name: Name of the group/team being summarized (e.g., department or sub-team name).
        existing_body: Existing team report body to use as reference (optional).

    Returns:
        Tuple of (system_prompt, user_prompt).
    """
    system_prompt = """당신은 팀 관리자를 위한 주간 보고서 초안 작성 전문가입니다.

개인 주간 보고서들을 취합하여 팀 단위의 구조화된 주간 보고서 초안을 작성합니다.

## 작성 규칙
- 반드시 한국어로 작성하십시오.
- 아래 JSON 형식으로만 응답하십시오.
- 개인 보고서의 내용을 팀 관점에서 종합하여 작성하십시오.
- 각 섹션은 bullet point 목록으로 작성하십시오.
- 구체적인 내용(프로젝트명, 이슈 등)을 포함하십시오.
- 존재하는 기존 보고서가 있다면 그것을 참고하여 내용을 보완하십시오.
- JSON 형식:
{
  "summary_markdown": "## 주요 활동\\n- ...\\n\\n## 이슈/리스크\\n- ...\\n\\n## 다음 주 계획\\n- ..."
}"""

    member_section_lines = []
    for report in reports:
        user_name = report.get("user_name", "Unknown")
        content = report.get("content", "(내용 없음)")
        member_section_lines.append(f"### {user_name}\n{content}")

    member_section = "\n\n".join(member_section_lines)

    reference_section = ""
    if existing_body and existing_body.strip():
        reference_section = f"\n\n## 기존 팀 보고서 (참고용)\n{existing_body.strip()}"

    user_prompt = f"""다음은 [{group_name}] 팀원들의 이번 주 개인 보고서입니다.
이 내용을 종합하여 팀 주간 보고서 초안을 작성해 주세요.{reference_section}

## 개인 보고서 목록 ({len(reports)}명)

{member_section}

위 개인 보고서들을 종합하여 팀 관점의 주간 보고서 초안을 JSON 형식으로 작성해 주세요."""

    return system_prompt, user_prompt


def build_group_to_team_prompt(
    sub_team_summaries: list[dict],
    team_name: str,
    existing_body: str = "",
) -> tuple[str, str]:
    """
    Build prompts to aggregate sub-team summaries into a department-level report.

    Args:
        sub_team_summaries: List of {"sub_team_name": str, "summary": str} dicts.
        team_name: Name of the department/team being summarized.
        existing_body: Existing department report body to use as reference (optional).

    Returns:
        Tuple of (system_prompt, user_prompt).
    """
    system_prompt = """당신은 부서 관리자를 위한 주간 보고서 초안 작성 전문가입니다.

각 소그룹/파트의 주간 요약을 취합하여 부서 단위의 구조화된 주간 보고서 초안을 작성합니다.

## 작성 규칙
- 반드시 한국어로 작성하십시오.
- 아래 JSON 형식으로만 응답하십시오.
- 각 소그룹의 핵심 내용을 부서 관점에서 종합하여 작성하십시오.
- 각 섹션은 bullet point 목록으로 작성하십시오.
- 중요한 이슈나 리스크는 빠짐없이 포함하십시오.
- 존재하는 기존 보고서가 있다면 그것을 참고하여 내용을 보완하십시오.
- JSON 형식:
{
  "summary_markdown": "## 주요 활동\\n- ...\\n\\n## 이슈/리스크\\n- ...\\n\\n## 다음 주 계획\\n- ..."
}"""

    group_section_lines = []
    for group in sub_team_summaries:
        group_name = group.get("sub_team_name", "Unknown")
        summary = group.get("summary", "(요약 없음)")
        group_section_lines.append(f"### {group_name}\n{summary}")

    group_section = "\n\n".join(group_section_lines)

    reference_section = ""
    if existing_body and existing_body.strip():
        reference_section = f"\n\n## 기존 부서 보고서 (참고용)\n{existing_body.strip()}"

    user_prompt = f"""다음은 [{team_name}] 부서 내 각 소그룹/파트의 이번 주 요약입니다.
이 내용을 종합하여 부서 주간 보고서 초안을 작성해 주세요.{reference_section}

## 소그룹별 요약 ({len(sub_team_summaries)}개 그룹)

{group_section}

위 소그룹 요약들을 종합하여 부서 관점의 주간 보고서 초안을 JSON 형식으로 작성해 주세요."""

    return system_prompt, user_prompt
