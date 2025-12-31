"""
Projects endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.project import (
    Project,
    ProjectCreate,
    ProjectUpdate,
    Milestone,
    MilestoneCreate,
    MilestoneUpdate,
    Program,
    ProjectType,
    ProductLine,
    WorklogStats,
)
from app.services.project_service import ProjectService

router = APIRouter()


# ============ Meta Endpoints (Must be before {project_id} routes) ============


@router.get("/meta/programs", response_model=List[Program])
async def list_programs(db: Session = Depends(get_db)):
    """
    List all active programs
    """
    service = ProjectService(db)
    return service.get_programs()


@router.get("/meta/types", response_model=List[ProjectType])
async def list_project_types(db: Session = Depends(get_db)):
    """
    List all active project types
    """
    service = ProjectService(db)
    return service.get_project_types()


@router.get("/meta/product-lines", response_model=List[ProductLine])
async def list_product_lines(db: Session = Depends(get_db)):
    """
    List all active product lines (제품군)
    """
    service = ProjectService(db)
    return service.get_product_lines()


@router.get("/hierarchy")
async def get_project_hierarchy(
    user_department_id: Optional[str] = Query(
        None, description="Filter functional projects by department"
    ),
    db: Session = Depends(get_db),
):
    """
    Get project hierarchy for WorkLog entry.
    Returns:
    - product_projects: Business Unit -> Product Line -> Projects tree
    - functional_projects: Department -> Projects tree (filtered by user's department)
    """
    service = ProjectService(db)
    return service.get_project_hierarchy(user_department_id=user_department_id)


@router.get("/product-lines/hierarchy")
async def get_product_line_hierarchy(db: Session = Depends(get_db)):
    """
    Get product line hierarchy for direct product support selection.
    Returns: Business Unit -> Product Lines tree
    """
    service = ProjectService(db)
    return service.get_product_line_hierarchy()


# ============ Project CRUD Endpoints ============


@router.get("", response_model=List[Project])
async def list_projects(
    program_id: Optional[str] = Query(None),
    project_type_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None, description="Sort options: 'activity'"),
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
        sort_by=sort_by,
    )
    return projects


@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(project_create: ProjectCreate, db: Session = Depends(get_db)):
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
    project_id: str, project_update: ProjectUpdate, db: Session = Depends(get_db)
):
    """
    Update project
    """
    service = ProjectService(db)
    try:
        updated_project = service.update_project(
            project_id=project_id, project_in=project_update
        )
        if not updated_project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
            )
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return None


@router.get("/{project_id}/stats", response_model=List[WorklogStats])
async def get_project_worklog_stats(project_id: str, db: Session = Depends(get_db)):
    """
    Get daily worklog statistics for a project
    """
    service = ProjectService(db)

    # Check if project exists
    project = service.get_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    return service.get_worklog_stats(project_id)


# ============ Milestone Endpoints ============


@router.get("/{project_id}/milestones", response_model=List[Milestone])
async def get_project_milestones(project_id: str, db: Session = Depends(get_db)):
    """
    Get all milestones for a project, sorted by target_date
    """
    service = ProjectService(db)

    # Check if project exists
    project = service.get_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    return service.get_milestones(project_id)


@router.post(
    "/{project_id}/milestones",
    response_model=Milestone,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_milestone(
    project_id: str, milestone_in: MilestoneCreate, db: Session = Depends(get_db)
):
    """
    Create a milestone for a project
    """
    service = ProjectService(db)
    try:
        new_milestone = service.create_milestone(project_id, milestone_in)
        return new_milestone
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{project_id}/milestones/{milestone_id}", response_model=Milestone)
async def update_project_milestone(
    project_id: str,
    milestone_id: int,
    milestone_in: MilestoneUpdate,
    db: Session = Depends(get_db),
):
    """
    Update a project milestone
    """
    service = ProjectService(db)

    # Check if milestone exists and belongs to project
    existing = service.get_milestone_by_id(milestone_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
    if existing.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Milestone does not belong to this project",
        )

    updated_milestone = service.update_milestone(milestone_id, milestone_in)
    return updated_milestone


@router.delete(
    "/{project_id}/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_project_milestone(
    project_id: str, milestone_id: int, db: Session = Depends(get_db)
):
    """
    Delete a project milestone
    """
    service = ProjectService(db)

    # Check if milestone exists and belongs to project
    existing = service.get_milestone_by_id(milestone_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
    if existing.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Milestone does not belong to this project",
        )

    service.delete_milestone(milestone_id)
    return None
