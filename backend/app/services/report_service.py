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

        # By work type
        by_type = (
            self.db.query(
                WorkLog.work_type,
                func.sum(WorkLog.hours).label("total_hours"),
            )
            .filter(extract("year", WorkLog.date) == year)
            .group_by(WorkLog.work_type)
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
                    "type": t.work_type,
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
