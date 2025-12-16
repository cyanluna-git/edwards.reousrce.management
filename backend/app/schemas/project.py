"""
Pydantic Schemas for Project CRUD operations
"""

from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from app.schemas.user import User


# Schema for Program
class Program(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


# Schema for ProjectType
class ProjectType(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


# Base schema for Project
class ProjectBase(BaseModel):
    program_id: str
    project_type_id: str
    code: str
    name: str
    status: str = "WIP"
    complexity: Optional[str] = None
    pm_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    customer: Optional[str] = None
    product: Optional[str] = None
    description: Optional[str] = None


# Schema for creating a Project
class ProjectCreate(ProjectBase):
    pass


# Schema for updating a Project
class ProjectUpdate(BaseModel):
    program_id: Optional[str] = None
    project_type_id: Optional[str] = None
    code: Optional[str] = None
    name: Optional[str] = None
    status: Optional[str] = None
    complexity: Optional[str] = None
    pm_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    customer: Optional[str] = None
    product: Optional[str] = None
    description: Optional[str] = None


# Schema for returning a Project from the API
class Project(ProjectBase):
    id: str
    program: Optional[Program] = None
    project_type: Optional[ProjectType] = None
    pm: Optional[User] = None

    class Config:
        from_attributes = True


# ============ Milestone Schemas ============


class MilestoneBase(BaseModel):
    """Base schema for Milestone"""

    name: str
    type: str = "CUSTOM"  # STD_GATE or CUSTOM
    target_date: datetime
    actual_date: Optional[datetime] = None
    status: str = "Pending"  # Pending, Completed, Delayed
    is_key_gate: bool = False
    description: Optional[str] = None


class MilestoneCreate(MilestoneBase):
    """Schema for creating a Milestone"""

    pass


class MilestoneUpdate(BaseModel):
    """Schema for updating a Milestone"""

    name: Optional[str] = None
    type: Optional[str] = None
    target_date: Optional[datetime] = None
    actual_date: Optional[datetime] = None
    status: Optional[str] = None
    is_key_gate: Optional[bool] = None
    description: Optional[str] = None


class Milestone(MilestoneBase):
    """Schema for returning a Milestone from the API"""

    id: int
    project_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
