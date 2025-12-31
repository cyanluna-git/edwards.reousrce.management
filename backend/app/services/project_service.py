"""
Service layer for project-related business logic
"""

from typing import List, Optional, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
import uuid
from datetime import datetime, timedelta
from sqlalchemy import func, desc

from app.models.project import (
    Project,
    ProjectMilestone,
    Program as ProgramModel,
    ProjectType as ProjectTypeModel,
    ProductLine as ProductLineModel,
)
from app.models.resource import WorkLog
from app.models.organization import BusinessUnit as BusinessUnitModel
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    MilestoneCreate,
    MilestoneUpdate,
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
                joinedload(Project.product_line),
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
                joinedload(Project.product_line),
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
        db_project = Project(id=str(uuid.uuid4()), **project_in.model_dump())
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

                if projects:
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
                            "type": "product_line",
                            "children": pl_children,
                        }
                    )

            if bu_children:
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
        functional_query = self.db.query(Project).filter(
            Project.category == "FUNCTIONAL"
        )

        if user_department_id:
            functional_query = functional_query.filter(
                Project.owner_department_id == user_department_id
            )

        functional_projects_db = functional_query.order_by(Project.code).all()

        # Group by department
        dept_map: dict[str, Any] = {}
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

        functional_projects = list(dept_map.values())

        return {
            "product_projects": product_projects,
            "functional_projects": functional_projects,
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
