"""
WorkLogs endpoints
"""

import csv
import io
from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.utils import get_io_number
from app.schemas.worklog import (
    WorkLog,
    WorkLogCreate,
    WorkLogUpdate,
    DailySummary,
    CopyWeekRequest,
    WorkLogWithUser,
    FrequentSelections,
)
from app.services.worklog_service import WorkLogService

router = APIRouter()


@router.get("", response_model=List[WorkLog])
async def list_worklogs(
    user_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    work_type_category_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
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
        work_type_category_id=work_type_category_id,
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
            "product_line_id": wl.product_line_id,
            "work_type_category_id": wl.work_type_category_id,
            "hours": wl.hours,
            "description": wl.description,
            "is_sudden_work": wl.is_sudden_work,
            "is_business_trip": wl.is_business_trip,
            "created_at": wl.created_at,
            "updated_at": wl.updated_at,
            "project_code": get_io_number(wl.project) if wl.project else None,
            "project_name": wl.project.name if wl.project else None,
            "project": wl.project,
            "work_type_category": (
                {
                    "id": wl.work_type_category.id,
                    "name": wl.work_type_category.name,
                    "code": wl.work_type_category.code,
                    "level": wl.work_type_category.level,
                }
                if wl.work_type_category
                else None
            ),
        }
        result.append(worklog_dict)

    return result


@router.get("/table", response_model=List[WorkLogWithUser])
async def list_worklogs_table(
    user_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    sub_team_id: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    work_type_category_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List worklogs for table view with user info.
    All authenticated users can view all worklogs.
    """
    service = WorkLogService(db)

    worklogs = service.get_multi_with_user(
        user_id=user_id,
        project_id=project_id,
        department_id=department_id,
        sub_team_id=sub_team_id,
        start_date=start_date,
        end_date=end_date,
        work_type_category_id=work_type_category_id,
        skip=skip,
        limit=limit,
    )

    result = []
    for wl in worklogs:
        # Get department name via sub_team relationship
        department_name = None
        if wl.user and wl.user.sub_team and wl.user.sub_team.department:
            department_name = wl.user.sub_team.department.name

        worklog_dict = {
            "id": wl.id,
            "date": wl.date.date() if hasattr(wl.date, "date") else wl.date,
            "user_id": wl.user_id,
            "project_id": wl.project_id,
            "product_line_id": wl.product_line_id,
            "work_type_category_id": wl.work_type_category_id,
            "hours": wl.hours,
            "description": wl.description,
            "is_sudden_work": wl.is_sudden_work,
            "is_business_trip": wl.is_business_trip,
            "created_at": wl.created_at,
            "updated_at": wl.updated_at,
            "project_code": get_io_number(wl.project) if wl.project else None,
            "project_name": wl.project.name if wl.project else None,
            "user_name": wl.user.name if wl.user else None,
            "user_korean_name": wl.user.korean_name if wl.user else None,
            "department_name": department_name,
            "project": wl.project,
            "work_type_category": wl.work_type_category,
        }
        result.append(worklog_dict)

    return result


@router.get("/export/csv")
async def export_worklogs_csv(
    user_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    sub_team_id: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    work_type_category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Export worklogs as CSV with the same filters as the table view.
    All authenticated users can export worklogs.
    """
    service = WorkLogService(db)

    worklogs = service.get_multi_with_user(
        user_id=user_id,
        project_id=project_id,
        department_id=department_id,
        sub_team_id=sub_team_id,
        start_date=start_date,
        end_date=end_date,
        work_type_category_id=work_type_category_id,
        skip=0,
        limit=10000,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["date", "user", "team", "project", "work_type", "hours", "description"])

    for wl in worklogs:
        wl_date = wl.date.date() if hasattr(wl.date, "date") else wl.date
        user_name = ""
        team_name = ""
        if wl.user:
            user_name = wl.user.korean_name or wl.user.name or ""
            if wl.user.sub_team and wl.user.sub_team.department:
                team_name = wl.user.sub_team.department.name or ""
        project_name = wl.project.name if wl.project else ""
        work_type_name = wl.work_type_category.name if wl.work_type_category else ""
        description = wl.description or ""

        writer.writerow([
            str(wl_date),
            user_name,
            team_name,
            project_name,
            work_type_name,
            wl.hours,
            description,
        ])

    output.seek(0)
    today_str = date.today().strftime("%Y%m%d")
    filename = f"worklogs_{today_str}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("", response_model=WorkLog, status_code=status.HTTP_201_CREATED)
async def create_worklog(
    worklog_in: WorkLogCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Create a new worklog entry
    Validation: Total hours per day must not exceed 24
    """
    if current_user.role != "ADMIN" and worklog_in.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create worklogs for other users",
        )

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
            "product_line_id": new_worklog.product_line_id,
            "work_type_category_id": new_worklog.work_type_category_id,
            "hours": new_worklog.hours,
            "description": new_worklog.description,
            "is_sudden_work": new_worklog.is_sudden_work,
            "is_business_trip": new_worklog.is_business_trip,
            "created_at": new_worklog.created_at,
            "updated_at": new_worklog.updated_at,
            "project_code": get_io_number(new_worklog.project) if new_worklog.project else None,
            "project_name": new_worklog.project.name if new_worklog.project else None,
            "project": new_worklog.project,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/frequent", response_model=FrequentSelections)
async def get_frequent_selections(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    limit: int = Query(5, ge=1, le=10),
    days: int = Query(90, ge=7, le=365),
):
    """
    Get user's most frequently used work types and projects
    based on worklog history within the specified number of days.
    """
    service = WorkLogService(db)
    return service.get_frequent_selections(
        user_id=current_user.id, limit=limit, days=days
    )


@router.get("/summary/daily", response_model=DailySummary)
async def get_daily_summary(
    user_id: str = Query(...),
    target_date: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get daily worklog summary for a user
    Returns total hours and breakdown by project
    """
    service = WorkLogService(db)
    return service.get_daily_summary(user_id, target_date)


@router.get("/{worklog_id}", response_model=WorkLog)
async def get_worklog(
    worklog_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
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
        "product_line_id": worklog.product_line_id,
        "work_type_category_id": worklog.work_type_category_id,
        "hours": worklog.hours,
        "description": worklog.description,
        "is_sudden_work": worklog.is_sudden_work,
        "is_business_trip": worklog.is_business_trip,
        "created_at": worklog.created_at,
        "updated_at": worklog.updated_at,
        "project_code": get_io_number(worklog.project) if worklog.project else None,
        "project_name": worklog.project.name if worklog.project else None,
        "project": worklog.project,
    }


@router.put("/{worklog_id}", response_model=WorkLog)
async def update_worklog(
    worklog_id: int,
    worklog_in: WorkLogUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
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
            "product_line_id": updated_worklog.product_line_id,
            "work_type_category_id": updated_worklog.work_type_category_id,
            "hours": updated_worklog.hours,
            "description": updated_worklog.description,
            "is_sudden_work": updated_worklog.is_sudden_work,
            "is_business_trip": updated_worklog.is_business_trip,
            "created_at": updated_worklog.created_at,
            "updated_at": updated_worklog.updated_at,
            "project_code": (
                get_io_number(updated_worklog.project) if updated_worklog.project else None
            ),
            "project_name": (
                updated_worklog.project.name if updated_worklog.project else None
            ),
            "project": updated_worklog.project,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{worklog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_worklog(
    worklog_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
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
    request: CopyWeekRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Copy all worklogs from last week to current week
    """
    if current_user.role != "ADMIN" and request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to copy worklogs for other users",
        )

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
                "product_line_id": wl.product_line_id,
                "work_type_category_id": wl.work_type_category_id,
                "hours": wl.hours,
                "description": wl.description,
                "is_sudden_work": wl.is_sudden_work,
                "is_business_trip": wl.is_business_trip,
                "created_at": wl.created_at,
                "updated_at": wl.updated_at,
                "project_code": get_io_number(wl.project) if wl.project else None,
                "project_name": wl.project.name if wl.project else None,
                "project": wl.project,
            }
        )

    return result
