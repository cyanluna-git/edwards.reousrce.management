"""
SQLAlchemy Models - Export all models
"""

from app.models.organization import (
    BusinessUnit,
    Department,
    SubTeam,
    JobPosition,
    ProjectRole,
)
from app.models.user import User, UserHistory
from app.models.project import (
    Program,
    ProjectType,
    ProductLine,
    Project,
    ProjectMilestone,
    project_product_lines,  # Junction table for M:N
)
from app.models.resource import ResourcePlan, WorkLog
from app.models.common import CommonCode, Holiday
from app.models.scenario import ProjectScenario, ScenarioMilestone, ScenarioResourcePlan
from app.models.hiring_plan import HiringPlan
from app.models.work_type import WorkTypeCategory, WorkTypeLegacyMapping


__all__ = [
    # Organization
    "BusinessUnit",
    "Department",
    "SubTeam",
    "JobPosition",
    "ProjectRole",  # NEW
    # User
    "User",
    "UserHistory",
    # Project
    "Program",
    "ProjectType",
    "ProductLine",
    "Project",
    "ProjectMilestone",
    "project_product_lines",  # NEW: M:N junction table
    # Scenario
    "ProjectScenario",
    "ScenarioMilestone",
    "ScenarioResourcePlan",
    # Resource
    "ResourcePlan",
    "WorkLog",
    # Common
    "CommonCode",
    "Holiday",
    # Hiring
    "HiringPlan",
    # Work Type
    "WorkTypeCategory",
    "WorkTypeLegacyMapping",
]
