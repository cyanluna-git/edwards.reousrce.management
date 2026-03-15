"""
WorkLog Pydantic Schemas
"""

from datetime import date as DateType, datetime as DateTimeType
from typing import Optional, List
from pydantic import BaseModel, Field

from app.schemas.work_type import WorkTypeCategoryFlat
from app.schemas.project import Project


class WorkLogBase(BaseModel):
    """Base schema for WorkLog"""

    date: DateType
    project_id: Optional[str] = None  # Made optional for non-project work
    product_line_id: Optional[str] = None  # Direct product line support work
    work_type_category_id: Optional[int] = None  # Optional - can be NULL for imported data
    hours: float = Field(..., gt=0, le=24)
    description: Optional[str] = None
    is_sudden_work: bool = False
    is_business_trip: bool = False


class WorkLogCreate(WorkLogBase):
    """Schema for creating a worklog"""

    user_id: str


class WorkLogUpdate(BaseModel):
    """Schema for updating a worklog - all fields optional"""

    date: Optional[DateType] = None
    project_id: Optional[str] = None
    product_line_id: Optional[str] = None
    work_type_category_id: Optional[int] = None
    hours: Optional[float] = Field(None, gt=0, le=24)
    description: Optional[str] = None
    is_sudden_work: Optional[bool] = None
    is_business_trip: Optional[bool] = None


class ProjectSummary(BaseModel):
    """Project summary within daily summary"""

    project_id: str
    project_code: str
    project_name: str
    hours: float


class WorkLog(WorkLogBase):
    """Response schema for WorkLog with relationships"""

    id: int
    user_id: str
    created_at: DateTimeType
    updated_at: DateTimeType

    # Nested project info (optional)
    project_code: Optional[str] = None
    project_name: Optional[str] = None
    project: Optional["Project"] = None

    # Product line info (NEW)
    product_line_name: Optional[str] = None
    product_line_code: Optional[str] = None

    # Work Type Category
    work_type_category: Optional["WorkTypeCategoryFlat"] = None

    class Config:
        from_attributes = True


class DailySummary(BaseModel):
    """Response schema for daily summary"""

    date: DateType
    user_id: str
    total_hours: float
    remaining_hours: float  # 24 - total_hours
    projects: List[ProjectSummary]


class CopyWeekRequest(BaseModel):
    """Request schema for copy-week endpoint"""

    user_id: str
    target_week_start: DateType  # Monday of target week


class FrequentItem(BaseModel):
    """Frequently used item (work type or project)"""

    id: str
    label: str
    count: int


class FrequentSelections(BaseModel):
    """Response schema for user's frequently used work types and projects"""

    work_types: List[FrequentItem]
    projects: List[FrequentItem]


class WorkLogWithUser(WorkLog):
    """WorkLog with user information for table display"""

    user_name: Optional[str] = None
    user_korean_name: Optional[str] = None
    department_name: Optional[str] = None


class MonthlyCompletionEntry(BaseModel):
    """Monthly worklog completion rate for a single user."""

    user_id: str
    user_name: str
    user_korean_name: Optional[str] = None
    department_name: Optional[str] = None
    sub_team_name: Optional[str] = None
    completed_days: int
    business_days: int
    completion_rate: float


class MonthlyCompletionResponse(BaseModel):
    """Monthly worklog completion summary."""

    month: str
    business_days: int
    entries: List[MonthlyCompletionEntry]
