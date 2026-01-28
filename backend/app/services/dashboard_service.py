"""
Dashboard Service for personal dashboard data
"""

from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_

from app.models.user import User
from app.models.organization import Department, SubTeam
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

    def get_team_dashboard(
        self, user_id: str, scope: str = "department", view_mode: str = "weekly"
    ) -> dict:
        """
        Get team dashboard data based on user's organization.

        Args:
            user_id: Current user ID
            scope: "sub_team" | "department" | "business_unit" | "all"
            view_mode: "weekly" | "monthly" | "quarterly" | "yearly"

        Returns:
            Team dashboard data including:
            - team_info: Team name, member count, org hierarchy
            - team_worklogs: Aggregated WorkLog for the team
            - member_contributions: Per-member breakdown
            - org_context: Comparison with upper organization
        """
        user = (
            self.db.query(User)
            .options(
                joinedload(User.sub_team)
                .joinedload(SubTeam.department)
                .joinedload(Department.division),
            )
            .filter(User.id == user_id)
            .first()
        )
        if not user:
            return {}

        # Get department through sub_team
        user_department = user.sub_team.department if user.sub_team else None
        user_department_id = user_department.id if user_department else None

        # Date range calculation
        today = datetime.now().date()
        if view_mode == "weekly":
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
        elif view_mode == "monthly":
            start_date = today.replace(day=1)
            next_month = today.replace(day=28) + timedelta(days=4)
            end_date = next_month.replace(day=1) - timedelta(days=1)
        elif view_mode == "quarterly":
            quarter = (today.month - 1) // 3
            start_date = today.replace(month=quarter * 3 + 1, day=1)
            if quarter == 3:
                end_date = today.replace(month=12, day=31)
            else:
                end_date = today.replace(
                    month=(quarter + 1) * 3 + 1, day=1
                ) - timedelta(days=1)
        else:  # yearly
            start_date = today.replace(month=1, day=1)
            end_date = today.replace(month=12, day=31)

        # Determine team members based on scope
        team_query = self.db.query(User).filter(User.is_active == True)

        if scope == "sub_team" and user.sub_team_id:
            team_query = team_query.filter(User.sub_team_id == user.sub_team_id)
            team_name = user.sub_team.name if user.sub_team else "Unknown"
            team_code = user.sub_team.code if user.sub_team else ""
        elif scope == "department" and user_department_id:
            # Get all sub_teams in the same department
            sub_team_ids = [
                st.id
                for st in self.db.query(SubTeam)
                .filter(SubTeam.department_id == user_department_id)
                .all()
            ]
            team_query = team_query.filter(User.sub_team_id.in_(sub_team_ids))
            team_name = user_department.name if user_department else "Unknown"
            team_code = user_department.code if user_department else ""
        elif scope == "business_unit" and user_department:
            # Get all departments in the same division, then all sub_teams
            dept_ids = [
                d.id
                for d in self.db.query(Department)
                .filter(Department.division_id == user_department.division_id)
                .all()
            ]
            sub_team_ids = [
                st.id
                for st in self.db.query(SubTeam)
                .filter(SubTeam.department_id.in_(dept_ids))
                .all()
            ]
            team_query = team_query.filter(User.sub_team_id.in_(sub_team_ids))
            division = user_department.division if user_department else None
            team_name = division.name if division else "Unknown"
            team_code = division.code if division else ""
        else:  # all - entire engineering
            team_name = "PCAS Engineering"
            team_code = "ENG"

        team_members = team_query.all()
        team_member_ids = [m.id for m in team_members]

        # Get team worklogs
        team_worklogs = (
            self.db.query(
                WorkLog.user_id,
                WorkLog.project_id,
                func.sum(WorkLog.hours).label("total_hours"),
            )
            .filter(
                and_(
                    WorkLog.user_id.in_(team_member_ids),
                    WorkLog.date >= start_date,
                    WorkLog.date <= end_date,
                )
            )
            .group_by(WorkLog.user_id, WorkLog.project_id)
            .all()
        )

        # Aggregate by project
        project_hours: dict = {}
        member_hours: dict = {}
        for wl in team_worklogs:
            project_hours[wl.project_id] = (
                project_hours.get(wl.project_id, 0) + wl.total_hours
            )
            member_hours[wl.user_id] = member_hours.get(wl.user_id, 0) + wl.total_hours

        total_team_hours = sum(project_hours.values())

        # Get project details
        project_ids = list(project_hours.keys())
        projects_map = {}
        if project_ids:
            projects = self.db.query(Project).filter(Project.id.in_(project_ids)).all()
            projects_map = {
                p.id: {"code": p.code, "name": p.name, "category": p.category}
                for p in projects
            }

        # Build project summary (top 5 + others)
        sorted_projects = sorted(
            project_hours.items(), key=lambda x: x[1], reverse=True
        )
        project_summary = []
        for pid, hours in sorted_projects[:5]:
            proj = projects_map.get(pid, {})
            project_summary.append(
                {
                    "project_id": pid,
                    "project_code": proj.get("code", ""),
                    "project_name": proj.get("name", ""),
                    "hours": float(hours),
                }
            )
        if len(sorted_projects) > 5:
            other_hours = sum(h for _, h in sorted_projects[5:])
            project_summary.append(
                {
                    "project_id": "others",
                    "project_code": "기타",
                    "project_name": f"{len(sorted_projects) - 5}개 프로젝트",
                    "hours": float(other_hours),
                }
            )

        # Project vs Functional ratio
        project_func_ratio = {"Project": 0.0, "Functional": 0.0}
        for pid, hours in project_hours.items():
            cat = projects_map.get(pid, {}).get("category", "PROJECT")
            if cat == "FUNCTIONAL":
                project_func_ratio["Functional"] += hours
            else:
                project_func_ratio["Project"] += hours

        # Member contributions
        member_contributions = []
        for member in team_members:
            hours = member_hours.get(member.id, 0)
            member_contributions.append(
                {
                    "user_id": member.id,
                    "name": member.name,
                    "korean_name": member.korean_name,
                    "hours": float(hours),
                    "percentage": (
                        round((hours / total_team_hours) * 100, 1)
                        if total_team_hours > 0
                        else 0
                    ),
                }
            )
        member_contributions.sort(key=lambda x: x["hours"], reverse=True)

        # Sub-organization contributions (for department/business_unit scopes)
        sub_org_contributions = []
        if scope == "department" and user_department_id:
            # Show sub_team breakdown for department scope
            sub_teams = (
                self.db.query(SubTeam)
                .filter(SubTeam.department_id == user_department_id)
                .all()
            )
            for st in sub_teams:
                st_member_ids = [m.id for m in team_members if m.sub_team_id == st.id]
                st_hours = sum(member_hours.get(mid, 0) for mid in st_member_ids)
                sub_org_contributions.append(
                    {
                        "org_id": st.id,
                        "org_name": st.name,
                        "org_code": st.code,
                        "member_count": len(st_member_ids),
                        "hours": float(st_hours),
                        "percentage": (
                            round((st_hours / total_team_hours) * 100, 1)
                            if total_team_hours > 0
                            else 0
                        ),
                    }
                )
            sub_org_contributions.sort(key=lambda x: x["hours"], reverse=True)
        elif scope == "business_unit" and user_department:
            # Show department breakdown for business_unit scope
            departments = (
                self.db.query(Department)
                .filter(Department.division_id == user_department.division_id)
                .all()
            )
            for dept in departments:
                # Get sub_teams for this department
                dept_sub_team_ids = [
                    st.id
                    for st in self.db.query(SubTeam)
                    .filter(SubTeam.department_id == dept.id)
                    .all()
                ]
                dept_member_ids = [
                    m.id for m in team_members if m.sub_team_id in dept_sub_team_ids
                ]
                dept_hours = sum(member_hours.get(mid, 0) for mid in dept_member_ids)
                sub_org_contributions.append(
                    {
                        "org_id": dept.id,
                        "org_name": dept.name,
                        "org_code": dept.code,
                        "member_count": len(dept_member_ids),
                        "hours": float(dept_hours),
                        "percentage": (
                            round((dept_hours / total_team_hours) * 100, 1)
                            if total_team_hours > 0
                            else 0
                        ),
                    }
                )
            sub_org_contributions.sort(key=lambda x: x["hours"], reverse=True)

        # Team resource allocation (current month)
        current_month = today.month
        current_year = today.year
        team_resource_plans = (
            self.db.query(ResourcePlan)
            .filter(
                and_(
                    ResourcePlan.user_id.in_(team_member_ids),
                    ResourcePlan.year == current_year,
                    ResourcePlan.month == current_month,
                )
            )
            .all()
        )
        total_planned_fte = sum(p.planned_hours for p in team_resource_plans)
        active_projects = len(set(p.project_id for p in team_resource_plans))

        # Organization hierarchy path
        org_path = []
        if user_department:
            if user_department.division:
                org_path.append(user_department.division.name)
            org_path.append(user_department.name)
        if user.sub_team:
            org_path.append(user.sub_team.name)

        # Upper organization comparison (entire Engineering)
        all_users = self.db.query(User).filter(User.is_active == True).all()
        all_user_ids = [u.id for u in all_users]
        org_total_hours = (
            self.db.query(func.sum(WorkLog.hours))
            .filter(
                and_(
                    WorkLog.user_id.in_(all_user_ids),
                    WorkLog.date >= start_date,
                    WorkLog.date <= end_date,
                )
            )
            .scalar()
            or 0
        )

        return {
            "team_info": {
                "name": team_name,
                "code": team_code,
                "scope": scope,
                "member_count": len(team_members),
                "org_path": org_path,
            },
            "date_range": {
                "start": str(start_date),
                "end": str(end_date),
                "view_mode": view_mode,
            },
            "team_worklogs": {
                "total_hours": float(total_team_hours),
                "by_project": project_summary,
                "project_vs_functional": project_func_ratio,
            },
            "member_contributions": member_contributions,
            "sub_org_contributions": sub_org_contributions,
            "resource_allocation": {
                "current_month": f"{current_year}-{current_month:02d}",
                "total_planned_fte": total_planned_fte,
                "active_projects": active_projects,
            },
            "org_context": {
                "org_total_hours": float(org_total_hours),
                "team_percentage": (
                    round((total_team_hours / org_total_hours) * 100, 1)
                    if org_total_hours > 0
                    else 0
                ),
            },
        }
