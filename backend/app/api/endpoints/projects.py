"""
Projects endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.project import Project
from app.services.project_service import ProjectService

router = APIRouter()


@router.get("", response_model=List[Project])
async def list_projects(
    program_id: Optional[str] = Query(None),
    project_type_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    List projects with optional filters
    """
    service = ProjectService(db)
    projects = service.get_multi(
        skip=skip,
        limit=limit,
        program_id=program_id,
        project_type_id=project_type_id,
        status=status,
    )
    return projects


@router.post("")
async def create_project(db: Session = Depends(get_db)):
    """
    Create a new project
    """
    # TODO: Implement project creation
    return {"message": "Create project endpoint - to be implemented"}


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, db: Session = Depends(get_db)):
    """
    Get project by ID
    """
    service = ProjectService(db)
    project = service.get_by_id(project_id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return project

@router.put("/{project_id}")
async def update_project(project_id: str, db: Session = Depends(get_db)):
    """
    Update project
    """
    # TODO: Implement project update
    return {"message": f"Update project {project_id} - to be implemented"}


@router.get("/{project_id}/milestones")
async def get_project_milestones(project_id: str, db: Session = Depends(get_db)):
    """
    Get milestones for a project
    """
    # TODO: Implement milestone listing
    return {"message": f"Get milestones for project {project_id} - to be implemented"}


@router.post("/{project_id}/milestones")
async def create_project_milestone(project_id: str, db: Session = Depends(get_db)):
    """
    Create a milestone for a project
    """
    # TODO: Implement milestone creation
    return {"message": f"Create milestone for project {project_id} - to be implemented"}


@router.put("/{project_id}/milestones/{milestone_id}")
async def update_project_milestone(
    project_id: str, milestone_id: int, db: Session = Depends(get_db)
):
    """
    Update a project milestone
    """
    # TODO: Implement milestone update
    return {"message": f"Update milestone {milestone_id} - to be implemented"}


@router.get("/programs")
async def list_programs(db: Session = Depends(get_db)):
    """
    List all programs
    """
    # TODO: Implement program listing
    return {"message": "List programs endpoint - to be implemented"}


@router.get("/types")
async def list_project_types(db: Session = Depends(get_db)):
    """
    List all project types
    """
    # TODO: Implement project type listing
    return {"message": "List project types endpoint - to be implemented"}
