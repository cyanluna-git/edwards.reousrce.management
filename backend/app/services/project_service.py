"""
Service layer for project-related business logic
"""
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload

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
