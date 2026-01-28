"""
Service layer for project-related business logic
"""

from typing import List, Optional, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
import uuid
from datetime import datetime, timedelta
from sqlalchemy import func, desc, tuple_

from app.models.project import (
    Project,
    ProjectMilestone,
    Program as ProgramModel,
    ProjectType as ProjectTypeModel,
    ProductLine as ProductLineModel,
)
from app.models.resource import WorkLog, ResourcePlan
from app.models.user import User
from app.models.organization import BusinessUnit as BusinessUnitModel
from app.schemas.project import (
    MilestoneCreate,
    MilestoneUpdate,
    ProductLineCreate,
    ProductLineUpdate,
    ProjectCreate,
    ProjectUpdate,
)


class ProjectService:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, project_id: str) -> Optional[Project]:
        """Get a project by its ID."""
        return (
            self.db.query(Project)
            .options(
                joinedload(Project.program).joinedload(ProgramModel.business_unit),
                joinedload(Project.project_type),
                joinedload(Project.product_line).joinedload(ProductLineModel.business_unit),
                joinedload(Project.pm),
            )
            .filter(Project.id == project_id)
            .first()
        )

    def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        program_id: Optional[str] = None,
        project_type_id: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: Optional[str] = None,
    ) -> List[Project]:
        """Retrieve multiple projects with filters and pagination."""
        # Subquery for calculating recent activity (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)

        # Determine the activity score
        activity_subquery = (
            self.db.query(
                WorkLog.project_id, func.sum(WorkLog.hours).label("activity_score")
            )
            .filter(WorkLog.date >= thirty_days_ago.date())
            .group_by(WorkLog.project_id)
            .subquery()
        )

        query = (
            self.db.query(
                Project,
                func.coalesce(activity_subquery.c.activity_score, 0).label(
                    "recent_activity_score"
                ),
            )
            .outerjoin(activity_subquery, Project.id == activity_subquery.c.project_id)
            .options(
                joinedload(Project.program).joinedload(ProgramModel.business_unit),
                joinedload(Project.project_type),
                joinedload(Project.product_line).joinedload(ProductLineModel.business_unit),
                joinedload(Project.pm),
            )
        )

        if program_id:
            query = query.filter(Project.program_id == program_id)
        if project_type_id:
            query = query.filter(Project.project_type_id == project_type_id)
        if status:
            query = query.filter(Project.status == status)

        if sort_by == "activity":
            query = query.order_by(desc("recent_activity_score"))
        else:
            query = query.order_by(Project.code)

        results = query.offset(skip).limit(limit).all()

        # Transform results to populate the Pydantic model field
        projects = []
        for project, score in results:
            project.recent_activity_score = score
            projects.append(project)

        return projects

    def create_project(self, project_in: ProjectCreate) -> Project:
        """Create a new project."""
        project_data = project_in.model_dump()

        # Auto-generate code if not provided
        if not project_data.get("code"):
            # Get the max existing PRJ-XXX code and increment
            max_code_result = (
                self.db.query(Project.code)
                .filter(Project.code.like("PRJ-%"))
                .order_by(Project.code.desc())
                .first()
            )
            if max_code_result and max_code_result[0]:
                try:
                    # Extract number from PRJ-XXX format
                    last_num = int(max_code_result[0].replace("PRJ-", ""))
                    project_data["code"] = f"PRJ-{last_num + 1}"
                except ValueError:
                    project_data["code"] = f"PRJ-{uuid.uuid4().hex[:8].upper()}"
            else:
                project_data["code"] = "PRJ-1"

        db_project = Project(id=str(uuid.uuid4()), **project_data)
        self.db.add(db_project)
        self.db.commit()
        self.db.refresh(db_project)
        return db_project

    def update_project(
        self, project_id: str, project_in: ProjectUpdate
    ) -> Optional[Project]:
        """Update an existing project."""
        db_project = self.db.query(Project).filter(Project.id == project_id).first()
        if not db_project:
            return None

        update_data = project_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_project, key, value)

        self.db.add(db_project)
        try:
            self.db.commit()
            self.db.refresh(db_project)
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Duplicate project code or other integrity violation.")

        return db_project

    def delete_project(self, project_id: str) -> Optional[Project]:
        """Delete a project by its ID."""
        db_project = self.db.query(Project).filter(Project.id == project_id).first()
        if not db_project:
            return None

        self.db.delete(db_project)
        self.db.commit()
        return db_project

    # ============ Milestone Methods ============

    def get_milestones(self, project_id: str) -> List["ProjectMilestone"]:
        """Get all milestones for a project, sorted by target_date."""
        return (
            self.db.query(ProjectMilestone)
            .filter(ProjectMilestone.project_id == project_id)
            .order_by(ProjectMilestone.target_date)
            .all()
        )

    def get_milestone_by_id(self, milestone_id: int) -> Optional["ProjectMilestone"]:
        """Get a milestone by its ID."""
        return (
            self.db.query(ProjectMilestone)
            .filter(ProjectMilestone.id == milestone_id)
            .first()
        )

    def create_milestone(
        self, project_id: str, milestone_in: "MilestoneCreate"
    ) -> "ProjectMilestone":
        """Create a new milestone for a project."""
        # Verify project exists
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project with id {project_id} not found")

        db_milestone = ProjectMilestone(
            project_id=project_id, **milestone_in.model_dump()
        )
        self.db.add(db_milestone)
        self.db.commit()
        self.db.refresh(db_milestone)
        return db_milestone

    def update_milestone(
        self, milestone_id: int, milestone_in: "MilestoneUpdate"
    ) -> Optional["ProjectMilestone"]:
        """Update an existing milestone."""
        db_milestone = (
            self.db.query(ProjectMilestone)
            .filter(ProjectMilestone.id == milestone_id)
            .first()
        )
        if not db_milestone:
            return None

        update_data = milestone_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_milestone, key, value)

        self.db.add(db_milestone)
        self.db.commit()
        self.db.refresh(db_milestone)
        return db_milestone

    def delete_milestone(self, milestone_id: int) -> bool:
        """Delete a milestone by its ID."""
        db_milestone = (
            self.db.query(ProjectMilestone)
            .filter(ProjectMilestone.id == milestone_id)
            .first()
        )
        if not db_milestone:
            return False

        self.db.delete(db_milestone)
        self.db.commit()
        return True

    # ============ Programs & ProjectTypes Methods ============

    def get_programs(self) -> List[ProgramModel]:
        """Get all active programs."""
        return (
            self.db.query(ProgramModel)
            .filter(ProgramModel.is_active == True)
            .order_by(ProgramModel.name)
            .all()
        )

    def get_project_types(self) -> List[ProjectTypeModel]:
        """Get all active project types."""
        return (
            self.db.query(ProjectTypeModel)
            .filter(ProjectTypeModel.is_active == True)
            .order_by(ProjectTypeModel.name)
            .all()
        )

    def get_product_lines(self) -> List[ProductLineModel]:
        """Get all active product lines."""
        return (
            self.db.query(ProductLineModel)
            .filter(ProductLineModel.is_active == True)
            .order_by(ProductLineModel.name)
            .all()
        )

    # ============ Product Line Methods ============

    def create_product_line(
        self, product_line_in: ProductLineCreate
    ) -> ProductLineModel:
        """Create a new product line."""
        pl_data = product_line_in.model_dump()
        # Auto-generate code if not provided or empty
        if not pl_data.get("code") or pl_data["code"].strip() == "":
            pl_data["code"] = f"PL_{str(uuid.uuid4())[:8].upper()}"
        db_pl = ProductLineModel(id=str(uuid.uuid4()), **pl_data)
        self.db.add(db_pl)
        self.db.commit()
        self.db.refresh(db_pl)
        return db_pl

    def update_product_line(
        self, product_line_id: str, product_line_in: ProductLineUpdate
    ) -> Optional[ProductLineModel]:
        """Update an existing product line."""
        db_pl = (
            self.db.query(ProductLineModel)
            .filter(ProductLineModel.id == product_line_id)
            .first()
        )
        if not db_pl:
            return None

        update_data = product_line_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_pl, key, value)

        self.db.add(db_pl)
        self.db.commit()
        self.db.refresh(db_pl)
        return db_pl

    def delete_product_line(self, product_line_id: str) -> bool:
        """Delete a product line."""
        db_pl = (
            self.db.query(ProductLineModel)
            .filter(ProductLineModel.id == product_line_id)
            .first()
        )
        if not db_pl:
            return False

        self.db.delete(db_pl)
        self.db.commit()
        return True

    # ============ Worklog Statistics Methods ============

    def get_worklog_stats(self, project_id: str) -> List[dict]:
        """Get daily worklog statistics for a project."""
        results = (
            self.db.query(
                WorkLog.date,
                func.sum(WorkLog.hours).label("total_hours"),
                func.count(WorkLog.id).label("count"),
            )
            .filter(WorkLog.project_id == project_id)
            .group_by(WorkLog.date)
            .order_by(WorkLog.date)
            .all()
        )

        return [
            {
                "date": str(row.date),
                "total_hours": float(row.total_hours) if row.total_hours else 0,
                "count": int(row.count),
            }
            for row in results
        ]

    # ============ Hierarchy Methods for WorkLog Entry ============

    def get_project_hierarchy(self, user_department_id: Optional[str] = None) -> dict:
        """
        Get project hierarchy for WorkLog entry.
        Returns a structure with:
        - product_projects: Business Unit -> Product Line -> Projects
        - functional_projects: Department -> Projects (filtered by user's department)
        """
        from app.models.organization import Department as DepartmentModel

        # Build Product Projects tree
        business_units = (
            self.db.query(BusinessUnitModel)
            .filter(BusinessUnitModel.is_active == True)
            .order_by(BusinessUnitModel.name)
            .all()
        )

        product_projects = []
        for bu in business_units:
            # Get product lines for this BU
            product_lines = (
                self.db.query(ProductLineModel)
                .filter(
                    ProductLineModel.business_unit_id == bu.id,
                    ProductLineModel.is_active == True,
                )
                .order_by(ProductLineModel.name)
                .all()
            )

            bu_children = []
            for pl in product_lines:
                # Get projects for this product line
                projects = (
                    self.db.query(Project)
                    .filter(
                        Project.product_line_id == pl.id, Project.category == "PRODUCT"
                    )
                    .order_by(Project.code)
                    .all()
                )

                # Always include Product Line, even if no projects (so it can be managed in UI)
                pl_children = [
                    {
                        "id": p.id,
                        "code": p.code,
                        "name": p.name,
                        "status": p.status,
                        "type": "project",
                    }
                    for p in projects
                ]
                bu_children.append(
                    {
                        "id": pl.id,
                        "code": pl.code,
                        "name": pl.name,
                        "line_category": pl.line_category,
                        "description": pl.description,
                        "type": "product_line",
                        "children": pl_children,
                    }
                )

            # Always append BU, even if empty, so it can be managed in the ProjectHierarchyEditor
            product_projects.append(
                {
                    "id": bu.id,
                    "code": bu.code,
                    "name": bu.name,
                    "type": "business_unit",
                    "children": bu_children,
                }
            )

        # Build Functional Projects tree (filtered by department if provided)
        # Exclude SUSTAINING projects (VSS/SUN Matrix IO buckets) as they have their own tab
        functional_query = self.db.query(Project).filter(
            Project.category == "FUNCTIONAL",
            Project.project_type_id != "SUSTAINING",
            ~Project.code.like("VSS%"),
            ~Project.code.like("SUN%"),
        )

        if user_department_id:
            functional_query = functional_query.filter(
                Project.owner_department_id == user_department_id
            )

        functional_projects_db = functional_query.order_by(Project.code).all()

        # Group by department
        dept_map: dict[str, Any] = {}
        ungrouped_functional: list[dict] = []
        for p in functional_projects_db:
            if p.owner_department_id:
                if p.owner_department_id not in dept_map:
                    dept = (
                        self.db.query(DepartmentModel)
                        .filter(DepartmentModel.id == p.owner_department_id)
                        .first()
                    )
                    dept_map[p.owner_department_id] = {
                        "id": dept.id if dept else p.owner_department_id,
                        "name": dept.name if dept else "Unknown",
                        "type": "department",
                        "children": [],
                    }
                dept_map[p.owner_department_id]["children"].append(
                    {
                        "id": p.id,
                        "code": p.code,
                        "name": p.name,
                        "status": p.status,
                        "type": "project",
                    }
                )
            else:
                # Collect functional projects without owner_department_id
                ungrouped_functional.append(
                    {
                        "id": p.id,
                        "code": p.code,
                        "name": p.name,
                        "status": p.status,
                        "type": "project",
                    }
                )

        functional_projects = list(dept_map.values())

        # Add ungrouped functional projects as a special group
        if ungrouped_functional:
            functional_projects.append({
                "id": "ungrouped_functional",
                "name": "Unassigned (No Department)",
                "type": "department",
                "children": ungrouped_functional,
            })

        # Get ungrouped PRODUCT projects (no product_line_id assigned)
        ungrouped_product_projects = (
            self.db.query(Project)
            .filter(
                Project.category == "PRODUCT",
                Project.product_line_id == None,
            )
            .order_by(Project.code)
            .all()
        )

        ungrouped_projects = [
            {
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "status": p.status,
                "type": "project",
            }
            for p in ungrouped_product_projects
        ]

        return {
            "product_projects": product_projects,
            "functional_projects": functional_projects,
            "ungrouped_projects": ungrouped_projects,
        }

    def get_product_line_hierarchy(self) -> List[dict]:
        """
        Get product line hierarchy for direct product support selection.
        Returns: Business Unit -> Product Lines tree
        """
        business_units = (
            self.db.query(BusinessUnitModel)
            .filter(BusinessUnitModel.is_active == True)
            .order_by(BusinessUnitModel.name)
            .all()
        )

        hierarchy = []
        for bu in business_units:
            product_lines = (
                self.db.query(ProductLineModel)
                .filter(
                    ProductLineModel.business_unit_id == bu.id,
                    ProductLineModel.is_active == True,
                )
                .order_by(ProductLineModel.name)
                .all()
            )

            if product_lines:
                hierarchy.append(
                    {
                        "id": bu.id,
                        "code": bu.code,
                        "name": bu.name,
                        "type": "business_unit",
                        "children": [
                            {
                                "id": pl.id,
                                "code": pl.code,
                                "name": pl.name,
                                "line_category": pl.line_category,
                                "type": "product_line",
                            }
                            for pl in product_lines
                        ],
                    }
                )

        return hierarchy

    # ============ Project Dashboard Methods ============

    def get_project_dashboard(self, project_id: str) -> dict:
        """
        Get comprehensive dashboard data for a single project.
        Includes: basic info, milestone stats, resource allocation, worklog trends.
        """
        # Get project with relationships
        project = (
            self.db.query(Project)
            .options(
                joinedload(Project.milestones),
                joinedload(Project.pm),
                joinedload(Project.product_line).joinedload(ProductLineModel.business_unit),
            )
            .filter(Project.id == project_id)
            .first()
        )

        if not project:
            return None

        today = datetime.now().date()
        current_year = today.year
        current_month = today.month

        # ─── Milestone Statistics ───
        milestones = project.milestones or []
        milestone_stats = {
            "total": len(milestones),
            "completed": sum(1 for m in milestones if m.status == "Completed"),
            "delayed": sum(1 for m in milestones if m.status == "Delayed"),
            "pending": sum(1 for m in milestones if m.status == "Pending"),
            "completion_rate": 0,
            "upcoming": [],
            "overdue": [],
        }

        if milestone_stats["total"] > 0:
            milestone_stats["completion_rate"] = round(
                (milestone_stats["completed"] / milestone_stats["total"]) * 100, 1
            )

        # Upcoming milestones (next 30 days)
        for m in milestones:
            if m.status == "Pending" and m.target_date:
                days_until = (m.target_date.date() - today).days
                if 0 <= days_until <= 30:
                    milestone_stats["upcoming"].append({
                        "id": m.id,
                        "name": m.name,
                        "target_date": str(m.target_date.date()),
                        "days_until": days_until,
                        "is_key_gate": m.is_key_gate,
                    })
                elif days_until < 0:
                    milestone_stats["overdue"].append({
                        "id": m.id,
                        "name": m.name,
                        "target_date": str(m.target_date.date()),
                        "days_overdue": abs(days_until),
                        "is_key_gate": m.is_key_gate,
                    })

        milestone_stats["upcoming"].sort(key=lambda x: x["days_until"])
        milestone_stats["overdue"].sort(key=lambda x: x["days_overdue"], reverse=True)

        # ─── Resource Allocation (current & next 3 months) ───
        months_to_check = []
        for i in range(4):  # Current + next 3 months
            m = current_month + i
            y = current_year
            if m > 12:
                m -= 12
                y += 1
            months_to_check.append((y, m))

        resource_plans = (
            self.db.query(
                ResourcePlan.year,
                ResourcePlan.month,
                ResourcePlan.user_id,
                func.sum(ResourcePlan.planned_hours).label("total_hours"),
            )
            .filter(
                ResourcePlan.project_id == project_id,
                tuple_(ResourcePlan.year, ResourcePlan.month).in_(months_to_check),
            )
            .group_by(ResourcePlan.year, ResourcePlan.month, ResourcePlan.user_id)
            .all()
        )

        # Aggregate by month
        monthly_resources = {}
        for rp in resource_plans:
            key = f"{rp.year}-{rp.month:02d}"
            if key not in monthly_resources:
                monthly_resources[key] = {
                    "month": key,
                    "total_hours": 0,
                    "assigned_count": 0,
                    "tbd_count": 0,
                }
            monthly_resources[key]["total_hours"] += float(rp.total_hours or 0)
            if rp.user_id:
                monthly_resources[key]["assigned_count"] += 1
            else:
                monthly_resources[key]["tbd_count"] += 1

        resource_summary = [
            monthly_resources.get(f"{y}-{m:02d}", {
                "month": f"{y}-{m:02d}",
                "total_hours": 0,
                "assigned_count": 0,
                "tbd_count": 0,
            })
            for y, m in months_to_check
        ]

        # ─── Worklog Trends (last 4 weeks) ───
        four_weeks_ago = today - timedelta(days=28)
        weekly_worklogs = (
            self.db.query(
                func.date_trunc("week", WorkLog.date).label("week_start"),
                func.sum(WorkLog.hours).label("total_hours"),
                func.count(func.distinct(WorkLog.user_id)).label("unique_users"),
            )
            .filter(
                WorkLog.project_id == project_id,
                WorkLog.date >= four_weeks_ago,
            )
            .group_by(func.date_trunc("week", WorkLog.date))
            .order_by(func.date_trunc("week", WorkLog.date))
            .all()
        )

        worklog_trends = [
            {
                "week_start": str(wl.week_start.date()) if wl.week_start else None,
                "total_hours": float(wl.total_hours) if wl.total_hours else 0,
                "unique_users": int(wl.unique_users),
            }
            for wl in weekly_worklogs
        ]

        # ─── Team Members (users who logged work in last 90 days) ───
        ninety_days_ago = today - timedelta(days=90)
        active_members = (
            self.db.query(
                User.id,
                User.name,
                User.korean_name,
                func.sum(WorkLog.hours).label("total_hours"),
            )
            .join(WorkLog, WorkLog.user_id == User.id)
            .filter(
                WorkLog.project_id == project_id,
                WorkLog.date >= ninety_days_ago,
            )
            .group_by(User.id, User.name, User.korean_name)
            .order_by(func.sum(WorkLog.hours).desc())
            .limit(10)
            .all()
        )

        team_members = [
            {
                "user_id": m.id,
                "name": m.name,
                "korean_name": m.korean_name,
                "total_hours": float(m.total_hours) if m.total_hours else 0,
            }
            for m in active_members
        ]

        # ─── Build Response ───
        return {
            "project": {
                "id": project.id,
                "code": project.code,
                "name": project.name,
                "status": project.status,
                "category": project.category,
                "scale": project.scale,
                "customer": project.customer,
                "product": project.product,
                "start_month": project.start_month,
                "end_month": project.end_month,
                "pm": {
                    "id": project.pm.id,
                    "name": project.pm.name,
                    "korean_name": project.pm.korean_name,
                } if project.pm else None,
                "business_unit": project.product_line.business_unit.name if project.product_line and project.product_line.business_unit else None,
                "product_line": project.product_line.name if project.product_line else None,
            },
            "milestone_stats": milestone_stats,
            "resource_summary": resource_summary,
            "worklog_trends": worklog_trends,
            "team_members": team_members,
        }
