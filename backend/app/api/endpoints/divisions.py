"""
Divisions endpoints - Top Level Organization
Division > Department > SubTeam
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.models.organization import Division, Department

router = APIRouter()


# ============================================================
# Schemas
# ============================================================


class DivisionBase(BaseModel):
    name: str
    code: str
    is_active: bool = True


class DivisionCreate(DivisionBase):
    pass


class DivisionUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_active: Optional[bool] = None


class DivisionResponse(DivisionBase):
    id: str

    class Config:
        from_attributes = True


# ============================================================
# Endpoints
# ============================================================


@router.get("", response_model=List[DivisionResponse])
async def list_divisions(
    is_active: Optional[bool] = Query(
        True, description="Filter by active status. Default: only active."
    ),
    db: Session = Depends(get_db),
):
    """List all divisions (default: active only)"""
    query = db.query(Division)
    if is_active is not None:
        query = query.filter(Division.is_active == is_active)
    return query.order_by(Division.name).all()


@router.post("", response_model=DivisionResponse, status_code=status.HTTP_201_CREATED)
async def create_division(
    div_in: DivisionCreate,
    db: Session = Depends(get_db),
):
    """Create a new division"""
    # Check for duplicate code
    existing = db.query(Division).filter(Division.code == div_in.code).first()
    if existing:
        raise HTTPException(
            status_code=400, detail=f"Division with code '{div_in.code}' already exists"
        )

    division = Division(
        id=f"DIV_{div_in.code.upper()}",
        name=div_in.name,
        code=div_in.code,
        is_active=div_in.is_active,
    )
    db.add(division)
    db.commit()
    db.refresh(division)
    return division


@router.put("/{division_id}", response_model=DivisionResponse)
async def update_division(
    division_id: str,
    div_in: DivisionUpdate,
    db: Session = Depends(get_db),
):
    """Update a division"""
    division = db.query(Division).filter(Division.id == division_id).first()
    if not division:
        raise HTTPException(status_code=404, detail="Division not found")

    if div_in.name is not None:
        division.name = div_in.name
    if div_in.code is not None:
        # Check uniqueness if code is changing
        if div_in.code != division.code:
            existing = db.query(Division).filter(Division.code == div_in.code).first()
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Division with code '{div_in.code}' already exists",
                )
        division.code = div_in.code
    if div_in.is_active is not None:
        division.is_active = div_in.is_active

    db.commit()
    db.refresh(division)
    return division


@router.delete("/{division_id}")
async def delete_division(
    division_id: str,
    db: Session = Depends(get_db),
):
    """Delete a division (soft delete)"""
    division = db.query(Division).filter(Division.id == division_id).first()
    if not division:
        raise HTTPException(status_code=404, detail="Division not found")

    # Check for dependent departments
    dept_count = (
        db.query(Department)
        .filter(Department.division_id == division_id, Department.is_active == True)
        .count()
    )
    if dept_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {dept_count} active departments belong to this division",
        )

    division.is_active = False
    db.commit()
    return {"message": "Division deactivated"}
