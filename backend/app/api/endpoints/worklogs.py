"""
WorkLogs endpoints
"""

from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.worklog import (
    WorkLog,
    WorkLogCreate,
    WorkLogUpdate,
    DailySummary,
    CopyWeekRequest,
    WorkLogWithUser,
)
from app.services.worklog_service import WorkLogService

router = APIRouter()


@router.get("", response_model=List[WorkLog])
async def list_worklogs(
    user_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    work_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    List worklogs with optional filters
    """
    service = WorkLogService(db)
    worklogs = service.get_multi(
        user_id=user_id,
        project_id=project_id,
        start_date=start_date,
        end_date=end_date,
        work_type=work_type,
        skip=skip,
        limit=limit,
    )

    # Convert to response model with project info
    result = []
    for wl in worklogs:
        worklog_dict = {
            "id": wl.id,
            "date": wl.date.date() if hasattr(wl.date, "date") else wl.date,
            "user_id": wl.user_id,
            "project_id": wl.project_id,
            "work_type": wl.work_type,
            "hours": wl.hours,
            "description": wl.description,
            "meeting_type": wl.meeting_type,
            "is_sudden_work": wl.is_sudden_work,
            "is_business_trip": wl.is_business_trip,
            "created_at": wl.created_at,
            "updated_at": wl.updated_at,
            "project_code": wl.project.code if wl.project else None,
            "project_name": wl.project.name if wl.project else None,
        }
        result.append(worklog_dict)

    return result


@router.get("/table", response_model=List[WorkLogWithUser])
async def list_worklogs_table(
    user_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    work_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),  # Returns User object, not dict
):
    """
    List worklogs for table view with user info.
    - Admin: Can view all worklogs
    - User: Can only view their own worklogs
    """
    service = WorkLogService(db)

    # Role-based filtering: non-admin users can only see their own worklogs
    if current_user.role != "ADMIN":
        user_id = current_user.id  # Force to current user's ID

    worklogs = service.get_multi_with_user(
        user_id=user_id,
        project_id=project_id,
        department_id=department_id,
        start_date=start_date,
        end_date=end_date,
        work_type=work_type,
        skip=skip,
        limit=limit,
    )

    result = []
    for wl in worklogs:
        worklog_dict = {
            "id": wl.id,
            "date": wl.date.date() if hasattr(wl.date, "date") else wl.date,
            "user_id": wl.user_id,
            "project_id": wl.project_id,
            "work_type": wl.work_type,
            "hours": wl.hours,
            "description": wl.description,
            "meeting_type": wl.meeting_type,
            "is_sudden_work": wl.is_sudden_work,
            "is_business_trip": wl.is_business_trip,
            "created_at": wl.created_at,
            "updated_at": wl.updated_at,
            "project_code": wl.project.code if wl.project else None,
            "project_name": wl.project.name if wl.project else None,
            "user_name": wl.user.name if wl.user else None,
            "user_korean_name": wl.user.korean_name if wl.user else None,
            "department_name": (
                wl.user.department.name if wl.user and wl.user.department else None
            ),
        }
        result.append(worklog_dict)

    return result


@router.post("", response_model=WorkLog, status_code=status.HTTP_201_CREATED)
async def create_worklog(worklog_in: WorkLogCreate, db: Session = Depends(get_db)):
    """
    Create a new worklog entry
    Validation: Total hours per day must not exceed 24
    """
    service = WorkLogService(db)
    try:
        new_worklog = service.create(worklog_in)
        return {
            "id": new_worklog.id,
            "date": (
                new_worklog.date.date()
                if hasattr(new_worklog.date, "date")
                else new_worklog.date
            ),
            "user_id": new_worklog.user_id,
            "project_id": new_worklog.project_id,
            "work_type": new_worklog.work_type,
            "hours": new_worklog.hours,
            "description": new_worklog.description,
            "meeting_type": new_worklog.meeting_type,
            "is_sudden_work": new_worklog.is_sudden_work,
            "is_business_trip": new_worklog.is_business_trip,
            "created_at": new_worklog.created_at,
            "updated_at": new_worklog.updated_at,
            "project_code": new_worklog.project.code if new_worklog.project else None,
            "project_name": new_worklog.project.name if new_worklog.project else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/summary/daily", response_model=DailySummary)
async def get_daily_summary(
    user_id: str = Query(...),
    target_date: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
):
    """
    Get daily worklog summary for a user
    Returns total hours and breakdown by project
    """
    service = WorkLogService(db)
    return service.get_daily_summary(user_id, target_date)


@router.get("/{worklog_id}", response_model=WorkLog)
async def get_worklog(worklog_id: int, db: Session = Depends(get_db)):
    """
    Get worklog by ID
    """
    service = WorkLogService(db)
    worklog = service.get_by_id(worklog_id)
    if not worklog:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="WorkLog not found"
        )
    return {
        "id": worklog.id,
        "date": worklog.date.date() if hasattr(worklog.date, "date") else worklog.date,
        "user_id": worklog.user_id,
        "project_id": worklog.project_id,
        "work_type": worklog.work_type,
        "hours": worklog.hours,
        "description": worklog.description,
        "meeting_type": worklog.meeting_type,
        "is_sudden_work": worklog.is_sudden_work,
        "is_business_trip": worklog.is_business_trip,
        "created_at": worklog.created_at,
        "updated_at": worklog.updated_at,
        "project_code": worklog.project.code if worklog.project else None,
        "project_name": worklog.project.name if worklog.project else None,
    }


@router.put("/{worklog_id}", response_model=WorkLog)
async def update_worklog(
    worklog_id: int, worklog_in: WorkLogUpdate, db: Session = Depends(get_db)
):
    """
    Update worklog
    """
    service = WorkLogService(db)
    try:
        updated_worklog = service.update(worklog_id, worklog_in)
        if not updated_worklog:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="WorkLog not found"
            )
        return {
            "id": updated_worklog.id,
            "date": (
                updated_worklog.date.date()
                if hasattr(updated_worklog.date, "date")
                else updated_worklog.date
            ),
            "user_id": updated_worklog.user_id,
            "project_id": updated_worklog.project_id,
            "work_type": updated_worklog.work_type,
            "hours": updated_worklog.hours,
            "description": updated_worklog.description,
            "meeting_type": updated_worklog.meeting_type,
            "is_sudden_work": updated_worklog.is_sudden_work,
            "is_business_trip": updated_worklog.is_business_trip,
            "created_at": updated_worklog.created_at,
            "updated_at": updated_worklog.updated_at,
            "project_code": (
                updated_worklog.project.code if updated_worklog.project else None
            ),
            "project_name": (
                updated_worklog.project.name if updated_worklog.project else None
            ),
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{worklog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_worklog(worklog_id: int, db: Session = Depends(get_db)):
    """
    Delete worklog
    """
    service = WorkLogService(db)
    deleted = service.delete(worklog_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="WorkLog not found"
        )
    return None


@router.post("/copy-week", response_model=List[WorkLog])
async def copy_last_week_worklogs(
    request: CopyWeekRequest, db: Session = Depends(get_db)
):
    """
    Copy all worklogs from last week to current week
    """
    service = WorkLogService(db)
    new_worklogs = service.copy_week(request.user_id, request.target_week_start)

    result = []
    for wl in new_worklogs:
        result.append(
            {
                "id": wl.id,
                "date": wl.date.date() if hasattr(wl.date, "date") else wl.date,
                "user_id": wl.user_id,
                "project_id": wl.project_id,
                "work_type": wl.work_type,
                "hours": wl.hours,
                "description": wl.description,
                "meeting_type": wl.meeting_type,
                "is_sudden_work": wl.is_sudden_work,
                "is_business_trip": wl.is_business_trip,
                "created_at": wl.created_at,
                "updated_at": wl.updated_at,
                "project_code": wl.project.code if wl.project else None,
                "project_name": wl.project.name if wl.project else None,
            }
        )

    return result
