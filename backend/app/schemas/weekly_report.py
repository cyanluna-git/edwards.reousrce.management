"""
Pydantic schemas for weekly reports.
"""

from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator


WeeklyReportScope = Literal["user", "team"]
WeeklyReportTeamScope = Literal["department", "sub_team"]
WeeklyReportStatus = Literal["draft", "published"]


class WeeklyReportUpsertRequest(BaseModel):
    scope: WeeklyReportScope
    team_scope_type: Optional[WeeklyReportTeamScope] = None
    scope_id: Optional[str] = None
    week_start: Optional[date] = None
    reference_date: Optional[date] = None
    status: WeeklyReportStatus = "draft"
    title: Optional[str] = None
    markdown_body: str = ""

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class WeeklyReportCurrentResponse(BaseModel):
    scope: WeeklyReportScope
    team_scope_type: Optional[WeeklyReportTeamScope] = None
    scope_id: str
    target_key: str
    week_start: date
    week_end: date
    week_key: str
    is_in_progress: bool
    report: Optional["WeeklyReportResponse"] = None


class WeeklyReportResponse(BaseModel):
    id: str
    scope: WeeklyReportScope
    team_scope_type: Optional[WeeklyReportTeamScope] = None
    scope_id: str
    target_key: str
    week_start: date
    week_end: date
    week_key: str
    is_in_progress: bool
    status: WeeklyReportStatus
    title: Optional[str] = None
    markdown_body: str
    source_metadata: Optional[dict] = None
    owner_user_id: Optional[str] = None
    created_by_user_id: str
    updated_by_user_id: str
    published_by_user_id: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WeeklyReportHistoryResponse(BaseModel):
    items: List[WeeklyReportResponse]


class WeeklyReportDeleteResponse(BaseModel):
    success: bool
    id: str


# ---- LLM Summary Schemas ----

class WeeklyReportLLMSummaryRequest(BaseModel):
    team_scope_type: str  # "department" | "sub_team"
    scope_id: str
    week_start: Optional[date] = None  # defaults to current week monday when None
    save_intermediate: bool = True


class SubTeamSummaryResult(BaseModel):
    sub_team_id: str
    sub_team_name: str
    summary_markdown: str
    member_count: int


class WeeklyReportLLMSummaryResponse(BaseModel):
    team_summary_markdown: str
    sub_team_summaries: Optional[List[SubTeamSummaryResult]] = None
    personal_report_count: int
    missing_members: List[str]
    scope_description: str

