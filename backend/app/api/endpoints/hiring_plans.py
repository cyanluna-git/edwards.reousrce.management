"""
Hiring Plans endpoints - Future resource capacity planning
"""

from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.core.database import get_db
from app.models.hiring_plan import HiringPlan
from app.models.organization import Department, SubTeam
from app.models.user import User

router = APIRouter()


# ============================================================
# Schemas
# ============================================================


class HiringPlanBase(BaseModel):
    department_id: str
    position_id: Optional[str] = None
    target_date: date
    headcount: int = 1
    status: str = "PLANNED"  # PLANNED, APPROVED, IN_PROGRESS, FILLED, CANCELLED
    remarks: Optional[str] = None


class HiringPlanCreate(HiringPlanBase):
    pass


class HiringPlanUpdate(BaseModel):
    department_id: Optional[str] = None
    position_id: Optional[str] = None
    target_date: Optional[date] = None
    headcount: Optional[int] = None
    status: Optional[str] = None
    remarks: Optional[str] = None
    hired_user_id: Optional[str] = None


class HiringPlanResponse(HiringPlanBase):
    id: str
    hired_user_id: Optional[str] = None

    class Config:
        from_attributes = True


class HiringPlanWithDetails(HiringPlanResponse):
    department_name: Optional[str] = None
    position_name: Optional[str] = None
    hired_user_name: Optional[str] = None


# ============================================================
# CRUD Endpoints
# ============================================================


@router.get("", response_model=List[HiringPlanResponse])
async def list_hiring_plans(
    department_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """List hiring plans with optional filters"""
    query = db.query(HiringPlan)

    if department_id:
        query = query.filter(HiringPlan.department_id == department_id)
    if status:
        query = query.filter(HiringPlan.status == status)
    if from_date:
        query = query.filter(HiringPlan.target_date >= from_date)
    if to_date:
        query = query.filter(HiringPlan.target_date <= to_date)

    return query.order_by(HiringPlan.target_date).all()


@router.post("", response_model=HiringPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_hiring_plan(
    plan_in: HiringPlanCreate,
    db: Session = Depends(get_db),
):
    """Create a new hiring plan"""
    import uuid

    # Verify department exists
    dept = db.query(Department).filter(Department.id == plan_in.department_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail="Department not found")

    plan = HiringPlan(
        id=str(uuid.uuid4()),
        department_id=plan_in.department_id,
        position_id=plan_in.position_id,
        target_date=plan_in.target_date,
        headcount=plan_in.headcount,
        status=plan_in.status,
        remarks=plan_in.remarks,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/{plan_id}", response_model=HiringPlanResponse)
async def get_hiring_plan(
    plan_id: str,
    db: Session = Depends(get_db),
):
    """Get a specific hiring plan"""
    plan = db.query(HiringPlan).filter(HiringPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Hiring plan not found")
    return plan


@router.put("/{plan_id}", response_model=HiringPlanResponse)
async def update_hiring_plan(
    plan_id: str,
    plan_in: HiringPlanUpdate,
    db: Session = Depends(get_db),
):
    """Update a hiring plan"""
    plan = db.query(HiringPlan).filter(HiringPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Hiring plan not found")

    if plan_in.department_id is not None:
        plan.department_id = plan_in.department_id
    if plan_in.position_id is not None:
        plan.position_id = plan_in.position_id
    if plan_in.target_date is not None:
        plan.target_date = plan_in.target_date
    if plan_in.headcount is not None:
        plan.headcount = plan_in.headcount
    if plan_in.status is not None:
        plan.status = plan_in.status
    if plan_in.remarks is not None:
        plan.remarks = plan_in.remarks
    if plan_in.hired_user_id is not None:
        plan.hired_user_id = plan_in.hired_user_id

    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/{plan_id}")
async def delete_hiring_plan(
    plan_id: str,
    db: Session = Depends(get_db),
):
    """Delete a hiring plan"""
    plan = db.query(HiringPlan).filter(HiringPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Hiring plan not found")

    db.delete(plan)
    db.commit()
    return {"message": "Hiring plan deleted"}


# ============================================================
# Forecast Endpoint
# ============================================================


@router.get("/forecast/headcount")
async def get_headcount_forecast(
    target_date: date = Query(..., description="Target date for forecast"),
    department_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Get forecasted headcount for a specific date.
    Combines current active users + planned hires (PLANNED, APPROVED, IN_PROGRESS) by target_date.
    """
    # Current active users
    user_query = db.query(func.count(User.id)).filter(User.is_active == True)
    if department_id:
        user_query = user_query.join(SubTeam, User.sub_team_id == SubTeam.id).filter(
            SubTeam.department_id == department_id
        )
    current_headcount = user_query.scalar() or 0

    # Planned hires up to target_date (exclude CANCELLED and already FILLED that are linked to users)
    plan_query = db.query(func.sum(HiringPlan.headcount)).filter(
        HiringPlan.target_date <= target_date,
        HiringPlan.status.in_(["PLANNED", "APPROVED", "IN_PROGRESS"]),
    )
    if department_id:
        plan_query = plan_query.filter(HiringPlan.department_id == department_id)
    planned_hires = plan_query.scalar() or 0

    return {
        "target_date": target_date.isoformat(),
        "department_id": department_id,
        "current_headcount": current_headcount,
        "planned_hires": planned_hires,
        "forecasted_headcount": current_headcount + planned_hires,
    }


@router.post("/{plan_id}/fill")
async def fill_hiring_plan(
    plan_id: str,
    user_id: str = Query(..., description="ID of the hired user"),
    db: Session = Depends(get_db),
):
    """
    Mark a hiring plan as FILLED and link to the hired user.
    This should be called after creating the new User.
    """
    plan = db.query(HiringPlan).filter(HiringPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Hiring plan not found")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    plan.status = "FILLED"
    plan.hired_user_id = user_id
    db.commit()
    db.refresh(plan)

    return {
        "message": "Hiring plan marked as filled",
        "plan_id": plan_id,
        "hired_user_id": user_id,
        "hired_user_name": user.name,
    }
