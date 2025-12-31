"""
WorkLog Pydantic Schemas
"""

from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.schemas.work_type import WorkTypeCategoryFlat
from app.schemas.project import Project


class WorkLogBase(BaseModel):
    """Base schema for WorkLog"""

    date: date
    project_id: Optional[str] = None  # Made optional for non-project work
    product_line_id: Optional[str] = None  # NEW: Direct product line support work
    work_type: str
    work_type_category_id: Optional[int] = None
    hours: float = Field(..., gt=0, le=24)
    description: Optional[str] = None
    meeting_type: Optional[str] = None
    is_sudden_work: bool = False
    is_business_trip: bool = False


class WorkLogCreate(WorkLogBase):
    """Schema for creating a worklog"""

    user_id: str


class WorkLogUpdate(BaseModel):
    """Schema for updating a worklog - all fields optional"""

    date: Optional[date] = None
    project_id: Optional[str] = None
    product_line_id: Optional[str] = None  # NEW
    work_type: Optional[str] = None
    work_type_category_id: Optional[int] = None
    hours: Optional[float] = Field(None, gt=0, le=24)
    description: Optional[str] = None
    meeting_type: Optional[str] = None
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
    created_at: datetime
    updated_at: datetime

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

    date: date
    user_id: str
    total_hours: float
    remaining_hours: float  # 24 - total_hours
    projects: List[ProjectSummary]


class CopyWeekRequest(BaseModel):
    """Request schema for copy-week endpoint"""

    user_id: str
    target_week_start: date  # Monday of target week


class WorkLogWithUser(WorkLog):
    """WorkLog with user information for table display"""

    user_name: Optional[str] = None
    user_korean_name: Optional[str] = None
    department_name: Optional[str] = None
