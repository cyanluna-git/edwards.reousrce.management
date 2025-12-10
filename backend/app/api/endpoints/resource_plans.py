"""
Resource Plans endpoints
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter()


@router.get("")
async def list_resource_plans(
    project_id: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    List resource plans with optional filters
    """
    # TODO: Implement resource plan listing
    return {"message": "List resource plans endpoint - to be implemented"}


@router.post("")
async def create_resource_plan(db: Session = Depends(get_db)):
    """
    Create a new resource plan
    user_id=NULL means TBD (open position)
    """
    # TODO: Implement resource plan creation
    return {"message": "Create resource plan endpoint - to be implemented"}


@router.get("/tbd")
async def list_tbd_positions(
    department_id: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    List all TBD (unassigned) positions
    """
    # TODO: Implement TBD positions listing
    return {"message": "List TBD positions endpoint - to be implemented"}


@router.get("/{plan_id}")
async def get_resource_plan(plan_id: int, db: Session = Depends(get_db)):
    """
    Get resource plan by ID
    """
    # TODO: Implement resource plan retrieval
    return {"message": f"Get resource plan {plan_id} - to be implemented"}


@router.put("/{plan_id}")
async def update_resource_plan(plan_id: int, db: Session = Depends(get_db)):
    """
    Update resource plan
    """
    # TODO: Implement resource plan update
    return {"message": f"Update resource plan {plan_id} - to be implemented"}


@router.delete("/{plan_id}")
async def delete_resource_plan(plan_id: int, db: Session = Depends(get_db)):
    """
    Delete resource plan
    """
    # TODO: Implement resource plan deletion
    return {"message": f"Delete resource plan {plan_id} - to be implemented"}


@router.post("/{plan_id}/assign")
async def assign_user_to_plan(
    plan_id: int, user_id: str, db: Session = Depends(get_db)
):
    """
    Assign a user to a TBD position
    """
    # TODO: Implement user assignment
    return {"message": f"Assign user to plan {plan_id} - to be implemented"}
