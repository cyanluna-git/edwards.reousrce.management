"""
Pydantic Schemas for Project Scenarios and Scenario Milestones
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ============ ScenarioMilestone Schemas ============


class ScenarioMilestoneBase(BaseModel):
    """Base schema for scenario milestone"""

    name: str
    type: str = "CUSTOM"  # STD_GATE or CUSTOM
    target_date: datetime
    actual_date: Optional[datetime] = None
    status: str = "Pending"  # Pending, Completed, Delayed
    is_key_gate: bool = False
    notes: Optional[str] = None
    sort_order: int = 0


class ScenarioMilestoneCreate(ScenarioMilestoneBase):
    """Schema for creating a scenario milestone"""

    base_milestone_id: Optional[int] = None


class ScenarioMilestoneUpdate(BaseModel):
    """Schema for updating a scenario milestone"""

    name: Optional[str] = None
    type: Optional[str] = None
    target_date: Optional[datetime] = None
    actual_date: Optional[datetime] = None
    status: Optional[str] = None
    is_key_gate: Optional[bool] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


class ScenarioMilestone(ScenarioMilestoneBase):
    """Response schema for scenario milestone"""

    id: int
    scenario_id: int
    base_milestone_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ ProjectScenario Schemas ============


class ProjectScenarioBase(BaseModel):
    """Base schema for project scenario"""

    name: str
    description: Optional[str] = None
    is_active: bool = False
    is_baseline: bool = False


class ProjectScenarioCreate(ProjectScenarioBase):
    """Schema for creating a scenario"""

    milestones: Optional[List[ScenarioMilestoneCreate]] = None


class ProjectScenarioUpdate(BaseModel):
    """Schema for updating a scenario"""

    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_baseline: Optional[bool] = None


class ProjectScenario(ProjectScenarioBase):
    """Response schema for project scenario"""

    id: int
    project_id: str
    created_at: datetime
    updated_at: datetime
    milestones: List[ScenarioMilestone] = []

    class Config:
        from_attributes = True


# ============ Comparison Schemas ============


class MilestoneComparison(BaseModel):
    """Schema for comparing milestones between scenarios"""

    milestone_name: str
    scenario_1_date: Optional[datetime] = None
    scenario_2_date: Optional[datetime] = None
    delta_days: Optional[int] = None  # Negative = earlier, Positive = later


class ScenarioComparisonResult(BaseModel):
    """Schema for scenario comparison result"""

    scenario_1_id: int
    scenario_1_name: str
    scenario_2_id: int
    scenario_2_name: str
    milestone_comparisons: List[MilestoneComparison]
    total_delta_days: int  # Overall project timeline change


class CopyScenarioRequest(BaseModel):
    """Request schema for copying a scenario"""

    new_name: str
    date_offset_days: int = 0  # Shift all dates by N days
