"""
Dashboard API endpoints
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.dashboard_service import DashboardService

router = APIRouter()


@router.get("/my-summary")
async def get_my_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get personal dashboard summary for the current user.
    Includes:
    - Weekly worklog summary
    - Current month resource allocation
    - Active projects with milestones
    """
    service = DashboardService(db)
    return service.get_my_dashboard(current_user.id)
