"""
Dashboard Service for personal dashboard data
"""

from datetime import datetime, timedelta, date
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_

from app.models.user import User
from app.models.organization import Department, SubTeam, Division
from app.models.project import Project, ProjectMilestone
from app.models.resource import ResourcePlan, WorkLog
from app.utils import get_io_number
from app.schemas.dashboard import (
    MyFTEResponse,
    MyFTESummary,
    MyFTEProductFunctional,
    MyFTEProjectItem,
)


WORKING_HOURS_PER_MONTH = 160  # Standard FTE = 160 hours/month


class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def get_my_fte(self, user_id: str, year: int, month: int) -> MyFTEResponse:
        """
        Get user's FTE breakdown for a specific month.

        FTE Calculation (same as Resource Matrix):
            FTE = (Project Hours) / (Total Project Hours excluding Team Work)

        This ensures each user's total FTE across all projects sums to 1.0
        """
        from calendar import monthrange

        # Calculate month date range
        _, last_day = monthrange(year, month)
        month_start = date(year, month, 1)
        month_end = date(year, month, last_day)

        # 1. Get ResourcePlans for this user/month (planned FTE - normalized)
        resource_plans = (
            self.db.query(ResourcePlan)
            .options(joinedload(ResourcePlan.project))
            .filter(
                and_(
                    ResourcePlan.user_id == user_id,
                    ResourcePlan.year == year,
                    ResourcePlan.month == month,
                )
            )
            .all()
        )

        # Build planned hours map: project_id -> planned_hours
        planned_map: dict[str, float] = {}
        planned_projects: dict[str, Project] = {}
        for rp in resource_plans:
            pid = rp.project_id
            planned_map[pid] = planned_map.get(pid, 0) + (rp.planned_hours or 0)
            if rp.project:
                planned_projects[pid] = rp.project

        # Total planned hours for normalization
        total_planned_hours = sum(planned_map.values())

        # 2. Get WorkLogs for this user/month (actual hours)
        # Exclude Team work (project_id IS NULL)
        worklogs = (
            self.db.query(
                WorkLog.project_id,
                func.sum(WorkLog.hours).label("total_hours"),
            )
            .filter(
                and_(
                    WorkLog.user_id == user_id,
                    WorkLog.date >= month_start,
                    WorkLog.date <= month_end,
                    WorkLog.project_id.isnot(None),  # Exclude Team work (no project)
                )
            )
            .group_by(WorkLog.project_id)
            .all()
        )

        # Build actual hours map: project_id -> actual_hours
        actual_map: dict[str, float] = {}
        for wl in worklogs:
            actual_map[wl.project_id] = float(wl.total_hours or 0)

        # Total actual project hours for normalization (denominator)
        total_actual_hours = sum(actual_map.values())

        # 3. Get project details for projects in actual_map but not in planned_map
        unplanned_project_ids = [
            pid for pid in actual_map.keys() if pid not in planned_projects
        ]
        if unplanned_project_ids:
            unplanned_projects = (
                self.db.query(Project)
                .filter(Project.id.in_(unplanned_project_ids))
                .all()
            )
            for proj in unplanned_projects:
                planned_projects[proj.id] = proj

        # 4. Categorize and build response items
        product_functional_planned: list[MyFTEProjectItem] = []
        product_functional_unplanned: list[MyFTEProjectItem] = []
        support_items: list[MyFTEProjectItem] = []

        # All project IDs (union of planned and actual)
        all_project_ids = set(planned_map.keys()) | set(actual_map.keys())

        for pid in all_project_ids:
            project = planned_projects.get(pid)
            if not project:
                continue

            planned_hours = planned_map.get(pid, 0)
            actual_hours = actual_map.get(pid, 0)

            # Calculate normalized FTE (same as Resource Matrix)
            # planned_fte = project planned hours / total planned hours
            # actual_fte = project actual hours / total actual hours
            planned_fte = None
            if total_planned_hours > 0 and planned_hours > 0:
                planned_fte = planned_hours / total_planned_hours

            actual_fte = 0.0
            if total_actual_hours > 0:
                actual_fte = actual_hours / total_actual_hours

            # Skip projects where both planned and actual FTE round to 0.00
            rounded_planned = round(planned_fte, 2) if planned_fte else 0
            rounded_actual = round(actual_fte, 2)
            if rounded_planned == 0 and rounded_actual == 0:
                continue

            # Calculate utilization (only if planned > 0)
            # Utilization = actual_fte / planned_fte * 100
            utilization = None
            if planned_fte and planned_fte > 0:
                utilization = round((actual_fte / planned_fte) * 100, 1)

            category = (project.category or "PRODUCT").upper()
            item = MyFTEProjectItem(
                project_id=pid,
                project_code=get_io_number(project),
                project_name=project.name or "",
                category=category,
                planned_fte=round(planned_fte, 2) if planned_fte else None,
                actual_fte=round(actual_fte, 2),
                utilization_percent=utilization,
            )

            if category == "SUPPORT":
                support_items.append(item)
            elif planned_hours > 0:
                product_functional_planned.append(item)
            else:
                product_functional_unplanned.append(item)

        # Sort by actual_fte descending
        product_functional_planned.sort(key=lambda x: x.actual_fte, reverse=True)
        product_functional_unplanned.sort(key=lambda x: x.actual_fte, reverse=True)
        support_items.sort(key=lambda x: x.actual_fte, reverse=True)

        # 5. Calculate summary
        # Total FTE should be 1.0 (100% of project time)
        summary = MyFTESummary(
            planned_fte=1.0 if total_planned_hours > 0 else 0.0,
            actual_fte=1.0 if total_actual_hours > 0 else 0.0,
            utilization_percent=None,  # N/A for normalized FTE
        )

        return MyFTEResponse(
            year=year,
            month=month,
            working_hours_per_month=WORKING_HOURS_PER_MONTH,
            summary=summary,
            product_functional=MyFTEProductFunctional(
                planned=product_functional_planned,
                unplanned=product_functional_unplanned,
            ),
            support=support_items,
        )

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
                self.db.query(Project)
                .options(joinedload(Project.internal_io))
                .filter(Project.id.in_(worklog_project_ids))
                .all()
            )
            projects_map = {p.id: {"code": get_io_number(p), "name": p.name} for p in projects}

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
                        "code": get_io_number(project),
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
        self, user_id: str, scope: str = "department", view_mode: str = "weekly",
        start_date: Optional[date] = None, end_date: Optional[date] = None,
        org_id: Optional[str] = None,
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
        user_department = None
        user_department_id = None
        if user.sub_team:
            user_department = user.sub_team.department
            if user_department:
                user_department_id = user_department.id

        # Date range calculation
        # Always define today for later use
        today = datetime.now().date()
        
        # If start_date and end_date are provided, use them; otherwise calculate from view_mode
        if start_date is None or end_date is None:
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

        if scope == "sub_team":
            target_sub_team_id = org_id if org_id else user.sub_team_id
            if target_sub_team_id:
                sub_team = self.db.query(SubTeam).filter(SubTeam.id == target_sub_team_id).first()
                team_query = team_query.filter(User.sub_team_id == target_sub_team_id)
                team_name = sub_team.name if sub_team else "Unknown"
                team_code = sub_team.code if sub_team else ""
            else:
                team_name = "Unknown"
                team_code = ""
        elif scope == "department":
            target_dept_id = org_id if org_id else user_department_id
            if target_dept_id:
                target_dept = self.db.query(Department).filter(Department.id == target_dept_id).first()
                sub_team_ids = [
                    st.id
                    for st in self.db.query(SubTeam)
                    .filter(SubTeam.department_id == target_dept_id)
                    .all()
                ]
                team_query = team_query.filter(User.sub_team_id.in_(sub_team_ids))
                team_name = target_dept.name if target_dept else "Unknown"
                team_code = target_dept.code if target_dept else ""
            else:
                team_name = "Unknown"
                team_code = ""
        elif scope == "business_unit":
            target_division_id = org_id if org_id else (user_department.division_id if user_department else None)
            if target_division_id:
                target_division = self.db.query(Division).filter(Division.id == target_division_id).first()
                dept_ids = [
                    d.id
                    for d in self.db.query(Department)
                    .filter(Department.division_id == target_division_id)
                    .all()
                ]
                sub_team_ids = [
                    st.id
                    for st in self.db.query(SubTeam)
                    .filter(SubTeam.department_id.in_(dept_ids))
                    .all()
                ]
                team_query = team_query.filter(User.sub_team_id.in_(sub_team_ids))
                team_name = target_division.name if target_division else "Unknown"
                team_code = target_division.code if target_division else ""
            else:
                team_name = "Unknown"
                team_code = ""
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
            projects = (
                self.db.query(Project)
                .options(joinedload(Project.internal_io))
                .filter(Project.id.in_(project_ids))
                .all()
            )
            projects_map = {
                p.id: {"code": get_io_number(p), "name": p.name, "category": p.category}
                for p in projects
            }

        # Build project summary (all projects with category info)
        sorted_projects = sorted(
            project_hours.items(), key=lambda x: x[1], reverse=True
        )
        project_summary = []
        for pid, hours in sorted_projects:
            if pid is None:
                # Team-internal work (no project)
                project_summary.append(
                    {
                        "project_id": None,
                        "project_code": "TEAM",
                        "project_name": "팀 업무",
                        "category": "TEAM",  # Special category for team-internal work
                        "hours": float(hours),
                    }
                )
            else:
                proj = projects_map.get(pid, {})
                project_summary.append(
                    {
                        "project_id": pid,
                        "project_code": proj.get("code", ""),
                        "project_name": proj.get("name", ""),
                        "category": proj.get("category", "PRODUCT"),  # Include category
                        "hours": float(hours),
                    }
                )

        # Category-based hours distribution (Product, Functional, Support, TeamInternal)
        category_hours = {
            "Product": 0.0,
            "Functional": 0.0,
            "Support": 0.0,
            "TeamInternal": 0.0,  # project_id가 NULL인 경우
        }
        for pid, hours in project_hours.items():
            if pid is None:
                category_hours["TeamInternal"] += hours
            else:
                cat = projects_map.get(pid, {}).get("category", "PRODUCT")
                if cat == "FUNCTIONAL":
                    category_hours["Functional"] += hours
                elif cat == "SUPPORT":
                    category_hours["Support"] += hours
                else:  # PRODUCT 또는 기타
                    category_hours["Product"] += hours

        # Legacy compatibility: project_vs_functional (Project = Product, Functional = Functional + Support + TeamInternal)
        project_func_ratio = {
            "Project": category_hours["Product"],
            "Functional": category_hours["Functional"] + category_hours["Support"] + category_hours["TeamInternal"],
        }

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
                "project_vs_functional": project_func_ratio,  # Legacy
                "by_category": category_hours,  # New: Product, Functional, Support, TeamInternal
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
