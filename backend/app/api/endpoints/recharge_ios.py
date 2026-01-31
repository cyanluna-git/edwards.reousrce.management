"""
API Endpoints for Recharge IO management
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.recharge_io import RechargeIO
from app.schemas.project import RechargeIO as RechargeIOSchema
from app.schemas.project import RechargeIOCreate, RechargeIOUpdate


router = APIRouter()


@router.get("/", response_model=List[RechargeIOSchema])
def get_recharge_ios(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None, description="Search by IO number or name"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
):
    """Get all Recharge IOs with optional filtering"""
    query = db.query(RechargeIO)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (RechargeIO.io_number.ilike(search_pattern)) |
            (RechargeIO.name.ilike(search_pattern))
        )

    if is_active is not None:
        query = query.filter(RechargeIO.is_active == is_active)

    return query.order_by(RechargeIO.io_number).offset(skip).limit(limit).all()


@router.get("/{io_id}", response_model=RechargeIOSchema)
def get_recharge_io(io_id: str, db: Session = Depends(get_db)):
    """Get a specific Recharge IO by ID"""
    io = db.query(RechargeIO).filter(RechargeIO.id == io_id).first()
    if not io:
        raise HTTPException(status_code=404, detail="Recharge IO not found")
    return io


@router.get("/by-number/{io_number}", response_model=RechargeIOSchema)
def get_recharge_io_by_number(io_number: str, db: Session = Depends(get_db)):
    """Get a specific Recharge IO by IO number"""
    io = db.query(RechargeIO).filter(RechargeIO.io_number == io_number).first()
    if not io:
        raise HTTPException(status_code=404, detail="Recharge IO not found")
    return io


@router.post("/", response_model=RechargeIOSchema)
def create_recharge_io(io_data: RechargeIOCreate, db: Session = Depends(get_db)):
    """Create a new Recharge IO"""
    # Check if io_number already exists
    existing = db.query(RechargeIO).filter(RechargeIO.io_number == io_data.io_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="IO number already exists")

    io = RechargeIO(**io_data.model_dump())
    db.add(io)
    db.commit()
    db.refresh(io)
    return io


@router.put("/{io_id}", response_model=RechargeIOSchema)
def update_recharge_io(
    io_id: str,
    io_data: RechargeIOUpdate,
    db: Session = Depends(get_db),
):
    """Update a Recharge IO"""
    io = db.query(RechargeIO).filter(RechargeIO.id == io_id).first()
    if not io:
        raise HTTPException(status_code=404, detail="Recharge IO not found")

    # Check uniqueness if changing io_number
    if io_data.io_number and io_data.io_number != io.io_number:
        existing = db.query(RechargeIO).filter(RechargeIO.io_number == io_data.io_number).first()
        if existing:
            raise HTTPException(status_code=400, detail="IO number already exists")

    update_data = io_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(io, field, value)

    db.commit()
    db.refresh(io)
    return io


@router.delete("/{io_id}")
def delete_recharge_io(io_id: str, db: Session = Depends(get_db)):
    """Delete a Recharge IO (soft delete by setting is_active=False)"""
    io = db.query(RechargeIO).filter(RechargeIO.id == io_id).first()
    if not io:
        raise HTTPException(status_code=404, detail="Recharge IO not found")

    # Check if any projects are using this IO
    from app.models.project import Project
    project_count = db.query(Project).filter(Project.recharge_io_id == io_id).count()
    if project_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete IO: {project_count} project(s) are using this IO"
        )

    db.delete(io)
    db.commit()
    return {"message": "Recharge IO deleted successfully"}


@router.post("/find-or-create", response_model=RechargeIOSchema)
def find_or_create_recharge_io(io_data: RechargeIOCreate, db: Session = Depends(get_db)):
    """Find an existing Recharge IO by number, or create a new one if not found"""
    existing = db.query(RechargeIO).filter(RechargeIO.io_number == io_data.io_number).first()
    if existing:
        return existing

    io = RechargeIO(**io_data.model_dump())
    db.add(io)
    db.commit()
    db.refresh(io)
    return io
