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
from app.models.internal_io import InternalIO
from app.models.recharge_io import RechargeIO
from app.models.project import (
    Program,
    ProductLine,
    Project,
    ProjectMilestone,
    project_product_lines,  # Junction table for M:N
)
from app.models.resource import ResourcePlan, ResourcePlanHistory, WorkLog
from app.models.common import CommonCode, Holiday
from app.models.scenario import ProjectScenario, ScenarioMilestone, ScenarioResourcePlan
from app.models.hiring_plan import HiringPlan
from app.models.work_type import WorkTypeCategory, WorkTypeLegacyMapping
from app.models.ai_summary import AISummary
from app.models.portal_access_log import PortalAccessLog
from app.models.weekly_report import WeeklyReport


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
    # Internal IO
    "InternalIO",
    # Recharge IO
    "RechargeIO",
    # Project
    "Program",
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
    "ResourcePlanHistory",
    "WorkLog",
    # Common
    "CommonCode",
    "Holiday",
    # Hiring
    "HiringPlan",
    # Work Type
    "WorkTypeCategory",
    "WorkTypeLegacyMapping",
    # AI Summary
    "AISummary",
    # Portal
    "PortalAccessLog",
    # Weekly Reports
    "WeeklyReport",
]
