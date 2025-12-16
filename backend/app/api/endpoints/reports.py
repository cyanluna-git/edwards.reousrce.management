"""
Reports and Analytics endpoints
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.report_service import ReportService

router = APIRouter()


@router.get("/capacity-summary")
async def get_capacity_summary(
    year: Optional[int] = Query(
        None, description="Year to get summary for (default: current year)"
    ),
    db: Session = Depends(get_db),
):
    """
    Get capacity summary report with monthly FTE totals,
    breakdown by position and by project.
    """
    service = ReportService(db)
    return service.get_capacity_summary(year)


@router.get("/worklog-summary")
async def get_worklog_summary(
    year: Optional[int] = Query(
        None, description="Year to get summary for (default: current year)"
    ),
    db: Session = Depends(get_db),
):
    """
    Get worklog summary report with monthly hours totals,
    breakdown by work type and by project.
    """
    service = ReportService(db)
    return service.get_worklog_summary(year)


@router.get("/capacity")
async def get_capacity_report(
    department_id: Optional[int] = Query(None),
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    Get team capacity report
    Calculates working days minus holidays and leave
    """
    # TODO: Implement capacity calculation with holidays
    return {"message": "Capacity report endpoint - to be implemented"}


@router.get("/department/{department_id}")
async def get_department_report(
    department_id: int,
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    Get department resource summary
    Planned vs Actual hours
    """
    # TODO: Implement department report
    return {"message": f"Department {department_id} report - to be implemented"}


@router.get("/project/{project_id}")
async def get_project_report(project_id: str, db: Session = Depends(get_db)):
    """
    Get project resource breakdown by department
    """
    # TODO: Implement project report
    return {"message": f"Project {project_id} report - to be implemented"}


@router.get("/user/{user_id}")
async def get_user_report(
    user_id: str,
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    Get user worklog summary
    """
    # TODO: Implement user report
    return {"message": f"User {user_id} report - to be implemented"}


@router.get("/holidays")
async def get_holidays(year: int = Query(...), db: Session = Depends(get_db)):
    """
    Get holidays for a year
    """
    # TODO: Implement holidays listing
    return {"message": f"Holidays for {year} - to be implemented"}


@router.get("/working-days")
async def get_working_days(
    year: int = Query(...), month: int = Query(...), db: Session = Depends(get_db)
):
    """
    Calculate working days for a month (excluding weekends and holidays)
    """
    # TODO: Implement working days calculation
    return {"message": f"Working days for {year}/{month} - to be implemented"}
