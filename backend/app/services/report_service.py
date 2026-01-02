"""
Report Service for analytics and capacity reports
"""

from datetime import datetime, date
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract

from app.models.resource import ResourcePlan, WorkLog
from app.models.project import Project
from app.models.organization import JobPosition


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def get_capacity_summary(self, year: Optional[int] = None) -> dict:
        """Get monthly capacity summary (total FTE by month)"""
        if not year:
            year = datetime.now().year

        # Monthly FTE aggregation
        monthly_data = (
            self.db.query(
                ResourcePlan.year,
                ResourcePlan.month,
                func.sum(ResourcePlan.planned_hours).label("total_fte"),
                func.count(ResourcePlan.id).label("plan_count"),
            )
            .filter(ResourcePlan.year == year)
            .group_by(ResourcePlan.year, ResourcePlan.month)
            .order_by(ResourcePlan.month)
            .all()
        )

        # By position aggregation
        by_position = (
            self.db.query(
                JobPosition.name,
                func.sum(ResourcePlan.planned_hours).label("total_fte"),
            )
            .join(JobPosition, ResourcePlan.position_id == JobPosition.id)
            .filter(ResourcePlan.year == year)
            .group_by(JobPosition.name)
            .order_by(func.sum(ResourcePlan.planned_hours).desc())
            .all()
        )

        # By project aggregation
        by_project = (
            self.db.query(
                Project.code,
                Project.name,
                func.sum(ResourcePlan.planned_hours).label("total_fte"),
            )
            .join(Project, ResourcePlan.project_id == Project.id)
            .filter(ResourcePlan.year == year)
            .group_by(Project.code, Project.name)
            .order_by(func.sum(ResourcePlan.planned_hours).desc())
            .limit(10)
            .all()
        )

        return {
            "year": year,
            "monthly": [
                {
                    "month": m.month,
                    "total_fte": float(m.total_fte) if m.total_fte else 0,
                    "plan_count": m.plan_count,
                }
                for m in monthly_data
            ],
            "by_position": [
                {"name": p.name, "total_fte": float(p.total_fte) if p.total_fte else 0}
                for p in by_position
            ],
            "by_project": [
                {
                    "code": p.code,
                    "name": p.name,
                    "total_fte": float(p.total_fte) if p.total_fte else 0,
                }
                for p in by_project
            ],
        }

    def get_worklog_summary(self, year: Optional[int] = None) -> dict:
        """Get monthly worklog summary"""
        if not year:
            year = datetime.now().year

        # Monthly hours aggregation
        monthly_data = (
            self.db.query(
                extract("month", WorkLog.date).label("month"),
                func.sum(WorkLog.hours).label("total_hours"),
                func.count(WorkLog.id).label("log_count"),
            )
            .filter(extract("year", WorkLog.date) == year)
            .group_by(extract("month", WorkLog.date))
            .order_by(extract("month", WorkLog.date))
            .all()
        )

        # By work type category
        from app.models.work_type import WorkTypeCategory

        by_type = (
            self.db.query(
                WorkTypeCategory.name.label("category_name"),
                func.sum(WorkLog.hours).label("total_hours"),
            )
            .join(
                WorkTypeCategory, WorkLog.work_type_category_id == WorkTypeCategory.id
            )
            .filter(extract("year", WorkLog.date) == year)
            .group_by(WorkTypeCategory.name)
            .order_by(func.sum(WorkLog.hours).desc())
            .all()
        )

        # By project (top 10)
        by_project = (
            self.db.query(
                Project.code,
                Project.name,
                func.sum(WorkLog.hours).label("total_hours"),
            )
            .join(Project, WorkLog.project_id == Project.id)
            .filter(extract("year", WorkLog.date) == year)
            .group_by(Project.code, Project.name)
            .order_by(func.sum(WorkLog.hours).desc())
            .limit(10)
            .all()
        )

        return {
            "year": year,
            "monthly": [
                {
                    "month": int(m.month),
                    "total_hours": float(m.total_hours) if m.total_hours else 0,
                    "log_count": m.log_count,
                }
                for m in monthly_data
            ],
            "by_type": [
                {
                    "type": t.category_name,
                    "total_hours": float(t.total_hours) if t.total_hours else 0,
                }
                for t in by_type
            ],
            "by_project": [
                {
                    "code": p.code,
                    "name": p.name,
                    "total_hours": float(p.total_hours) if p.total_hours else 0,
                }
                for p in by_project
            ],
        }

    def get_worklog_summary_by_project(self) -> list:
        """
        Get monthly worklog summary grouped by project.
        Returns FTE (hours / 160) for comparison with resource plans.
        """
        # Query worklogs grouped by project, year, month
        results = (
            self.db.query(
                WorkLog.project_id,
                Project.code.label("project_code"),
                Project.name.label("project_name"),
                extract("year", WorkLog.date).label("year"),
                extract("month", WorkLog.date).label("month"),
                func.sum(WorkLog.hours).label("total_hours"),
            )
            .join(Project, WorkLog.project_id == Project.id)
            .group_by(
                WorkLog.project_id,
                Project.code,
                Project.name,
                extract("year", WorkLog.date),
                extract("month", WorkLog.date),
            )
            .order_by(
                extract("year", WorkLog.date).desc(),
                extract("month", WorkLog.date).desc(),
            )
            .all()
        )

        return [
            {
                "project_id": r.project_id,
                "project_code": r.project_code,
                "project_name": r.project_name,
                "year": int(r.year),
                "month": int(r.month),
                "total_hours": float(r.total_hours) if r.total_hours else 0,
                "total_fte": (
                    round(float(r.total_hours) / 160, 2) if r.total_hours else 0
                ),
            }
            for r in results
        ]

    def get_worklog_summary_by_role(self) -> list:
        """
        Get monthly worklog summary grouped by user's position (role).
        Returns FTE (hours / 160) for comparison with resource plans by role.
        Uses user's position_id to determine role.
        """
        from app.models.user import User

        # Query worklogs grouped by user's position, year, month
        results = (
            self.db.query(
                User.position_id,
                JobPosition.name.label("position_name"),
                extract("year", WorkLog.date).label("year"),
                extract("month", WorkLog.date).label("month"),
                func.sum(WorkLog.hours).label("total_hours"),
            )
            .join(User, WorkLog.user_id == User.id)
            .join(JobPosition, User.position_id == JobPosition.id)
            .filter(User.position_id.isnot(None))
            .group_by(
                User.position_id,
                JobPosition.name,
                extract("year", WorkLog.date),
                extract("month", WorkLog.date),
            )
            .order_by(
                extract("year", WorkLog.date).desc(),
                extract("month", WorkLog.date).desc(),
            )
            .all()
        )

        return [
            {
                "position_id": r.position_id,
                "position_name": r.position_name,
                "year": int(r.year),
                "month": int(r.month),
                "total_hours": float(r.total_hours) if r.total_hours else 0,
                "total_fte": (
                    round(float(r.total_hours) / 160, 2) if r.total_hours else 0
                ),
            }
            for r in results
        ]
