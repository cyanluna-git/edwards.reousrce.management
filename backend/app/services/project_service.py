"""
Service layer for project-related business logic
"""
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
import uuid

from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate


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
        status: Optional[str] = None
    ) -> List[Project]:
        """Retrieve multiple projects with filters and pagination."""
        query = self.db.query(Project).options(
            joinedload(Project.program),
            joinedload(Project.project_type),
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

    def update_project(self, project_id: str, project_in: ProjectUpdate) -> Optional[Project]:
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

