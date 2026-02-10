"""
Pydantic Schemas for Project CRUD operations
"""

from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from app.schemas.user import User


# Schema for BusinessUnit (사업영역)
class BusinessUnit(BaseModel):
    id: str
    name: str
    code: str

    class Config:
        from_attributes = True


# Schema for Department (부서)
class Department(BaseModel):
    id: str
    name: str
    code: str

    class Config:
        from_attributes = True


# Schema for Program
class Program(BaseModel):
    id: str
    name: str
    business_unit_id: Optional[str] = None
    business_unit: Optional[BusinessUnit] = None

    class Config:
        from_attributes = True


# Schema for ProductLine
class ProductLine(BaseModel):
    id: str
    name: str
    code: str
    business_unit_id: Optional[str] = None
    business_unit: Optional[BusinessUnit] = None  # nested relationship
    line_category: Optional[str] = "PRODUCT"  # PRODUCT, PLATFORM, LEGACY
    description: Optional[str] = None

    class Config:
        from_attributes = True


class ProductLineCreate(BaseModel):
    name: str
    code: str
    business_unit_id: Optional[str] = None
    line_category: Optional[str] = "PRODUCT"
    description: Optional[str] = None


class ProductLineUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    business_unit_id: Optional[str] = None
    line_category: Optional[str] = None
    description: Optional[str] = None


# Schema for InternalIO
class InternalIOBase(BaseModel):
    io_number: str
    name: Optional[str] = None
    description: Optional[str] = None
    business_unit_id: Optional[str] = None  # BU별 분리된 IO 지원


class InternalIOCreate(InternalIOBase):
    pass


class InternalIOUpdate(BaseModel):
    io_number: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    business_unit_id: Optional[str] = None
    is_active: Optional[bool] = None


class InternalIO(InternalIOBase):
    id: str
    is_active: bool = True
    business_unit: Optional[BusinessUnit] = None  # Nested BU info

    class Config:
        from_attributes = True


# Schema for RechargeIO
class RechargeIOBase(BaseModel):
    io_number: str
    name: Optional[str] = None
    description: Optional[str] = None


class RechargeIOCreate(RechargeIOBase):
    business_unit_ids: Optional[List[str]] = None  # BU IDs for M:N relationship


class RechargeIOUpdate(BaseModel):
    io_number: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    business_unit_ids: Optional[List[str]] = None  # Update BU mappings


class RechargeIO(RechargeIOBase):
    id: str
    is_active: bool = True
    business_units: List[BusinessUnit] = []  # M:N relationship

    class Config:
        from_attributes = True


# Base schema for Project
class ProjectBase(BaseModel):
    internal_io_id: Optional[str] = None  # FK to internal_ios table
    recharge_io_id: Optional[str] = None  # FK to recharge_ios table
    name: str
    status: str = (
        "Prospective"  # Prospective, Planned, InProgress, OnHold, Cancelled, Completed
    )
    category: Optional[str] = "PRODUCT"  # PRODUCT, FUNCTIONAL, SUPPORT
    scale: Optional[str] = None  # CIP, A&D, Simple, Complex, Platform
    product_line_id: Optional[str] = None  # Family grouping
    owner_department_id: Optional[str] = None  # NEW: Required for FUNCTIONAL projects
    pm_id: Optional[str] = None
    start_month: Optional[str] = None  # YYYY-MM format
    end_month: Optional[str] = None  # YYYY-MM format
    customer: Optional[str] = None
    product: Optional[str] = None
    description: Optional[str] = None


# Schema for creating a Project
class ProjectCreate(ProjectBase):
    pass


# Schema for updating a Project
class ProjectUpdate(BaseModel):
    internal_io_id: Optional[str] = None
    recharge_io_id: Optional[str] = None
    name: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    scale: Optional[str] = None
    product_line_id: Optional[str] = None
    owner_department_id: Optional[str] = None  # NEW
    pm_id: Optional[str] = None
    start_month: Optional[str] = None
    end_month: Optional[str] = None
    customer: Optional[str] = None
    product: Optional[str] = None
    description: Optional[str] = None


# Schema for returning a Project from the API
class Project(ProjectBase):
    id: str
    product_line: Optional[ProductLine] = None
    owner_department: Optional[Department] = None  # Nested department for FUNCTIONAL projects
    internal_io: Optional[InternalIO] = None  # Nested IO info
    recharge_io: Optional[RechargeIO] = None  # Nested recharge IO info
    pm: Optional[User] = None
    recent_activity_score: Optional[float] = 0.0

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


class WorklogStats(BaseModel):
    """Schema for daily worklog statistics"""

    date: str
    total_hours: float
    count: int
