"""
Dashboard Service for personal dashboard data
"""

from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_

from app.models.user import User
from app.models.project import Project, ProjectMilestone
from app.models.resource import ResourcePlan, WorkLog


class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def get_my_dashboard(self, user_id: str) -> dict:
        """Get personal dashboard data for the current user"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {}

        # Get date ranges
        today = datetime.now().date()
        week_start = today - timedelta(days=today.weekday())  # Monday
        week_end = week_start + timedelta(days=6)  # Sunday
        current_month = today.month
        current_year = today.year

        # 1. Weekly WorkLog Summary
        weekly_worklogs = (
            self.db.query(
                WorkLog.project_id,
                func.sum(WorkLog.hours).label("total_hours"),
            )
            .filter(
                and_(
                    WorkLog.user_id == user_id,
                    WorkLog.date >= week_start,
                    WorkLog.date <= week_end,
                )
            )
            .group_by(WorkLog.project_id)
            .all()
        )

        # Get project names for worklogs
        worklog_project_ids = [w.project_id for w in weekly_worklogs]
        projects_map = {}
        if worklog_project_ids:
            projects = (
                self.db.query(Project).filter(Project.id.in_(worklog_project_ids)).all()
            )
            projects_map = {p.id: {"code": p.code, "name": p.name} for p in projects}

        weekly_summary = {
            "week_start": str(week_start),
            "week_end": str(week_end),
            "total_hours": sum(w.total_hours or 0 for w in weekly_worklogs),
            "by_project": [
                {
                    "project_id": w.project_id,
                    "project_code": projects_map.get(w.project_id, {}).get("code"),
                    "project_name": projects_map.get(w.project_id, {}).get("name"),
                    "hours": float(w.total_hours) if w.total_hours else 0,
                }
                for w in weekly_worklogs
            ],
        }

        # 2. Resource Allocation (current month)
        resource_plans = (
            self.db.query(ResourcePlan)
            .options(joinedload(ResourcePlan.project))
            .filter(
                and_(
                    ResourcePlan.user_id == user_id,
                    ResourcePlan.year == current_year,
                    ResourcePlan.month == current_month,
                )
            )
            .all()
        )

        current_month_fte = sum(p.planned_hours for p in resource_plans)
        active_projects_count = len(set(p.project_id for p in resource_plans))

        # 3. My Projects with Milestones
        my_project_ids = list(set(p.project_id for p in resource_plans))

        # Also add projects from worklogs
        for w in weekly_worklogs:
            if w.project_id not in my_project_ids:
                my_project_ids.append(w.project_id)

        my_projects = []
        if my_project_ids:
            projects_with_milestones = (
                self.db.query(Project)
                .options(joinedload(Project.milestones))
                .filter(Project.id.in_(my_project_ids))
                .all()
            )

            for project in projects_with_milestones:
                # Get key milestones (G5, G6)
                key_milestones = [
                    {
                        "name": m.name,
                        "target_date": str(m.target_date) if m.target_date else None,
                        "status": m.status,
                    }
                    for m in project.milestones
                    if m.is_key_gate
                ]

                my_projects.append(
                    {
                        "id": project.id,
                        "code": project.code,
                        "name": project.name,
                        "status": project.status,
                        "milestones": key_milestones,
                    }
                )

        return {
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
            },
            "weekly_worklog": weekly_summary,
            "resource_allocation": {
                "current_month": f"{current_year}-{current_month:02d}",
                "total_fte": current_month_fte,
                "active_projects": active_projects_count,
            },
            "my_projects": my_projects,
        }
