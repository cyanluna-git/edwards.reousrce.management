"""
API Endpoints for Internal IO management
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.internal_io import InternalIO
from app.schemas.project import InternalIO as InternalIOSchema
from app.schemas.project import InternalIOCreate, InternalIOUpdate


router = APIRouter()


@router.get("/", response_model=List[InternalIOSchema])
def get_internal_ios(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None, description="Search by IO number or name"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
):
    """Get all Internal IOs with optional filtering"""
    query = db.query(InternalIO)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (InternalIO.io_number.ilike(search_pattern)) |
            (InternalIO.name.ilike(search_pattern))
        )

    if is_active is not None:
        query = query.filter(InternalIO.is_active == is_active)

    return query.order_by(InternalIO.io_number).offset(skip).limit(limit).all()


@router.get("/{io_id}", response_model=InternalIOSchema)
def get_internal_io(io_id: str, db: Session = Depends(get_db)):
    """Get a specific Internal IO by ID"""
    io = db.query(InternalIO).filter(InternalIO.id == io_id).first()
    if not io:
        raise HTTPException(status_code=404, detail="Internal IO not found")
    return io


@router.get("/by-number/{io_number}", response_model=InternalIOSchema)
def get_internal_io_by_number(io_number: str, db: Session = Depends(get_db)):
    """Get a specific Internal IO by IO number"""
    io = db.query(InternalIO).filter(InternalIO.io_number == io_number).first()
    if not io:
        raise HTTPException(status_code=404, detail="Internal IO not found")
    return io


@router.post("/", response_model=InternalIOSchema)
def create_internal_io(io_data: InternalIOCreate, db: Session = Depends(get_db)):
    """Create a new Internal IO"""
    # Check if io_number already exists
    existing = db.query(InternalIO).filter(InternalIO.io_number == io_data.io_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="IO number already exists")

    io = InternalIO(**io_data.model_dump())
    db.add(io)
    db.commit()
    db.refresh(io)
    return io


@router.put("/{io_id}", response_model=InternalIOSchema)
def update_internal_io(
    io_id: str,
    io_data: InternalIOUpdate,
    db: Session = Depends(get_db),
):
    """Update an Internal IO"""
    io = db.query(InternalIO).filter(InternalIO.id == io_id).first()
    if not io:
        raise HTTPException(status_code=404, detail="Internal IO not found")

    # Check uniqueness if changing io_number
    if io_data.io_number and io_data.io_number != io.io_number:
        existing = db.query(InternalIO).filter(InternalIO.io_number == io_data.io_number).first()
        if existing:
            raise HTTPException(status_code=400, detail="IO number already exists")

    update_data = io_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(io, field, value)

    db.commit()
    db.refresh(io)
    return io


@router.delete("/{io_id}")
def delete_internal_io(io_id: str, db: Session = Depends(get_db)):
    """Delete an Internal IO (soft delete by setting is_active=False)"""
    io = db.query(InternalIO).filter(InternalIO.id == io_id).first()
    if not io:
        raise HTTPException(status_code=404, detail="Internal IO not found")

    # Check if any projects are using this IO
    from app.models.project import Project
    project_count = db.query(Project).filter(Project.internal_io_id == io_id).count()
    if project_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete IO: {project_count} project(s) are using this IO"
        )

    db.delete(io)
    db.commit()
    return {"message": "Internal IO deleted successfully"}


@router.post("/find-or-create", response_model=InternalIOSchema)
def find_or_create_internal_io(io_data: InternalIOCreate, db: Session = Depends(get_db)):
    """Find an existing Internal IO by number, or create a new one if not found"""
    existing = db.query(InternalIO).filter(InternalIO.io_number == io_data.io_number).first()
    if existing:
        return existing

    io = InternalIO(**io_data.model_dump())
    db.add(io)
    db.commit()
    db.refresh(io)
    return io
