"""
Departments endpoints
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter()


@router.get("")
async def list_departments(
    business_unit_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    db: Session = Depends(get_db),
):
    """
    List all departments
    """
    # TODO: Implement department listing
    return {"message": "List departments endpoint - to be implemented"}


@router.get("/{department_id}")
async def get_department(department_id: int, db: Session = Depends(get_db)):
    """
    Get department by ID
    """
    # TODO: Implement department retrieval
    return {"message": f"Get department {department_id} - to be implemented"}


@router.get("/{department_id}/members")
async def get_department_members(
    department_id: int,
    is_active: Optional[bool] = Query(True),
    db: Session = Depends(get_db),
):
    """
    Get all members of a department
    """
    # TODO: Implement department members listing
    return {"message": f"Get members of department {department_id} - to be implemented"}


@router.get("/{department_id}/sub-teams")
async def get_department_sub_teams(department_id: int, db: Session = Depends(get_db)):
    """
    Get sub-teams of a department
    """
    # TODO: Implement sub-teams listing
    return {
        "message": f"Get sub-teams of department {department_id} - to be implemented"
    }


@router.get("/business-units")
async def list_business_units(db: Session = Depends(get_db)):
    """
    List all business units
    """
    # TODO: Implement business units listing
    return {"message": "List business units endpoint - to be implemented"}
