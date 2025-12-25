"""
Job Positions API endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.organization import JobPosition

router = APIRouter()


# Pydantic schemas
class JobPositionBase(BaseModel):
    name: str
    is_active: bool = True


class JobPositionCreate(JobPositionBase):
    pass


class JobPositionUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class JobPositionResponse(BaseModel):
    id: str
    name: str
    is_active: bool

    class Config:
        from_attributes = True


# ============ Endpoints ============


@router.get("", response_model=List[JobPositionResponse])
async def list_job_positions(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
):
    """List all job positions"""
    query = db.query(JobPosition)
    if not include_inactive:
        query = query.filter(JobPosition.is_active == True)
    return query.order_by(JobPosition.name).all()


@router.get("/{position_id}", response_model=JobPositionResponse)
async def get_job_position(
    position_id: str,
    db: Session = Depends(get_db),
):
    """Get a single job position by ID"""
    position = db.query(JobPosition).filter(JobPosition.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Job position not found")
    return position


@router.post(
    "", response_model=JobPositionResponse, status_code=status.HTTP_201_CREATED
)
async def create_job_position(
    data: JobPositionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new job position"""
    import uuid

    # Check for duplicate name
    existing = db.query(JobPosition).filter(JobPosition.name == data.name).first()
    if existing:
        raise HTTPException(
            status_code=400, detail="Job position with this name already exists"
        )

    position = JobPosition(
        id=str(uuid.uuid4()),
        name=data.name,
        is_active=data.is_active,
    )
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


@router.put("/{position_id}", response_model=JobPositionResponse)
async def update_job_position(
    position_id: str,
    data: JobPositionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a job position"""
    position = db.query(JobPosition).filter(JobPosition.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Job position not found")

    # Check for duplicate name if name is being changed
    if data.name and data.name != position.name:
        existing = db.query(JobPosition).filter(JobPosition.name == data.name).first()
        if existing:
            raise HTTPException(
                status_code=400, detail="Job position with this name already exists"
            )

    if data.name is not None:
        position.name = data.name
    if data.is_active is not None:
        position.is_active = data.is_active

    db.commit()
    db.refresh(position)
    return position


@router.delete("/{position_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_position(
    position_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete (soft-delete by setting inactive) a job position"""
    position = db.query(JobPosition).filter(JobPosition.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Job position not found")

    # Soft delete by setting inactive
    position.is_active = False
    db.commit()
    return None
