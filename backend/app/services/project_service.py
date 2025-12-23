"""
Service layer for project-related business logic
"""

from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
import uuid

from app.models.project import (
    Project,
    ProjectMilestone,
    Program as ProgramModel,
    ProjectType as ProjectTypeModel,
    ProductLine as ProductLineModel,
)
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
                joinedload(Project.program),
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
    ) -> List[Project]:
        """Retrieve multiple projects with filters and pagination."""
        query = self.db.query(Project).options(
            joinedload(Project.program),
            joinedload(Project.project_type),
            joinedload(Project.product_line),
            joinedload(Project.pm),
        )

        if program_id:
            query = query.filter(Project.program_id == program_id)
        if project_type_id:
            query = query.filter(Project.project_type_id == project_type_id)
        if status:
            query = query.filter(Project.status == status)

        return query.order_by(Project.code).offset(skip).limit(limit).all()

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

    def get_programs(self) -> List["Program"]:
        """Get all active programs."""
        return (
            self.db.query(ProgramModel)
            .filter(ProgramModel.is_active == True)
            .order_by(ProgramModel.name)
            .all()
        )

    def get_project_types(self) -> List["ProjectType"]:
        """Get all active project types."""
        return (
            self.db.query(ProjectTypeModel)
            .filter(ProjectTypeModel.is_active == True)
            .order_by(ProjectTypeModel.name)
            .all()
        )

    def get_product_lines(self) -> List["ProductLine"]:
        """Get all active product lines."""
        return (
            self.db.query(ProductLineModel)
            .filter(ProductLineModel.is_active == True)
            .order_by(ProductLineModel.name)
            .all()
        )
