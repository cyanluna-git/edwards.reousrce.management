"""
Pydantic Schemas for Resource Plan CRUD operations
"""

from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime


# ============ JobPosition Schema (for nested response) ============


class JobPositionBase(BaseModel):
    """Base schema for JobPosition"""

    id: str
    name: str
    department_id: str

    class Config:
        from_attributes = True


# ============ ResourcePlan Schemas ============


class ResourcePlanBase(BaseModel):
    """Base schema for ResourcePlan"""

    project_id: str
    year: int
    month: int  # 1-12
    position_id: str
    user_id: Optional[str] = None  # NULL = TBD (Open Position)
    planned_hours: float = 0.0


class ResourcePlanCreate(ResourcePlanBase):
    """Schema for creating a ResourcePlan"""

    pass


class ResourcePlanUpdate(BaseModel):
    """Schema for updating a ResourcePlan"""

    user_id: Optional[str] = None
    planned_hours: Optional[float] = None
    position_id: Optional[str] = None


class ResourcePlanAssign(BaseModel):
    """Schema for assigning a user to a TBD position"""

    user_id: str


# Avoid circular import by using forward references
class ResourcePlan(ResourcePlanBase):
    """Schema for returning a ResourcePlan from the API"""

    id: int
    created_by: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Nested objects (optional, loaded via joinedload)
    project_name: Optional[str] = None
    project_code: Optional[str] = None
    position_name: Optional[str] = None
    user_name: Optional[str] = None
    is_tbd: bool = False  # Computed: True if user_id is None

    class Config:
        from_attributes = True


class ResourcePlanSummary(BaseModel):
    """Summary for grouping resource plans"""

    project_id: str
    project_name: str
    project_code: str
    year: int
    month: int
    total_planned_hours: float
    tbd_count: int  # Number of TBD positions
    assigned_count: int  # Number of assigned positions
