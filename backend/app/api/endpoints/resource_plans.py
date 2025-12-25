"""
Resource Plans endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.resource_plan import (
    ResourcePlan,
    ResourcePlanCreate,
    ResourcePlanUpdate,
    ResourcePlanAssign,
)
from app.services.resource_plan_service import ResourcePlanService

router = APIRouter()


# ============ TBD Endpoint (Must be before {plan_id} route) ============


@router.get("/tbd", response_model=List[ResourcePlan])
async def list_tbd_positions(
    project_id: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    List all TBD (unassigned) positions.
    These are resource plans where user_id is NULL.
    """
    service = ResourcePlanService(db)
    return service.get_tbd_positions(
        project_id=project_id,
        year=year,
        month=month,
    )


# ============ Summary Endpoints ============


@router.get("/summary/by-project")
async def get_summary_by_project(
    db: Session = Depends(get_db),
):
    """
    Get monthly HC summary grouped by project.
    Returns total planned hours for each project per month.
    """
    service = ResourcePlanService(db)
    return service.get_summary_by_project()


@router.get("/summary/by-position")
async def get_summary_by_position(
    db: Session = Depends(get_db),
):
    """
    Get monthly HC summary grouped by position/role.
    Returns total planned hours for each position per month.
    """
    service = ResourcePlanService(db)
    return service.get_summary_by_position()


# ============ Resource Plan CRUD Endpoints ============


@router.get("", response_model=List[ResourcePlan])
async def list_resource_plans(
    project_id: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    position_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    List resource plans with optional filters.
    """
    service = ResourcePlanService(db)
    return service.get_multi(
        project_id=project_id,
        year=year,
        month=month,
        position_id=position_id,
        user_id=user_id,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=ResourcePlan, status_code=status.HTTP_201_CREATED)
async def create_resource_plan(
    plan_in: ResourcePlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new resource plan.
    Set user_id=null for TBD (open position).
    """
    service = ResourcePlanService(db)
    try:
        return service.create(plan_in, created_by=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{plan_id}", response_model=ResourcePlan)
async def get_resource_plan(
    plan_id: int,
    db: Session = Depends(get_db),
):
    """
    Get a specific resource plan by ID.
    """
    service = ResourcePlanService(db)
    plan = service.get_by_id(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Resource plan not found"
        )
    return plan


@router.put("/{plan_id}", response_model=ResourcePlan)
async def update_resource_plan(
    plan_id: int,
    plan_in: ResourcePlanUpdate,
    db: Session = Depends(get_db),
):
    """
    Update a resource plan.
    """
    service = ResourcePlanService(db)
    plan = service.update(plan_id, plan_in)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Resource plan not found"
        )
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource_plan(
    plan_id: int,
    db: Session = Depends(get_db),
):
    """
    Delete a resource plan.
    """
    service = ResourcePlanService(db)
    success = service.delete(plan_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Resource plan not found"
        )
    return None


@router.post("/{plan_id}/assign", response_model=ResourcePlan)
async def assign_user_to_plan(
    plan_id: int,
    assign_in: ResourcePlanAssign,
    db: Session = Depends(get_db),
):
    """
    Assign a user to a TBD position.
    Only works if user_id is currently NULL.
    """
    service = ResourcePlanService(db)
    try:
        plan = service.assign_user(plan_id, assign_in.user_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Resource plan not found"
            )
        return plan
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============ Job Positions Endpoint ============


@router.get("/meta/positions")
async def list_job_positions(db: Session = Depends(get_db)):
    """
    List all active job positions for dropdown.
    """
    service = ResourcePlanService(db)
    positions = service.get_job_positions()
    return [
        {
            "id": p.id,
            "name": p.name,
        }
        for p in positions
    ]
