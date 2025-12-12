"""
Projects endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.project import Project, ProjectCreate, ProjectUpdate
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


@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_create: ProjectCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new project
    """
    service = ProjectService(db)
    try:
        new_project = service.create_project(project_in=project_create)
        return new_project
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


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

@router.put("/{project_id}", response_model=Project)
async def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db)
):
    """
    Update project
    """
    service = ProjectService(db)
    try:
        updated_project = service.update_project(project_id=project_id, project_in=project_update)
        if not updated_project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return updated_project
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, db: Session = Depends(get_db)):
    """
    Delete a project
    """
    service = ProjectService(db)
    deleted_project = service.delete_project(project_id=project_id)
    if not deleted_project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return {"message": "Project deleted successfully"}


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
