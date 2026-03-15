"""
Portal access logging and statistics endpoints
"""

import logging
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.schemas.portal import (
    AccessLogCreate,
    AccessLogResponse,
    MyAccessHistoryResponse,
    PortalStatsResponse,
)
from app.services.portal_service import PortalService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/access-log", response_model=AccessLogResponse, status_code=status.HTTP_201_CREATED)
async def post_access_log(
    body: AccessLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a portal service access event for the current user."""
    service = PortalService(db)
    log = service.log_access(user_id=current_user.id, service=body.service)
    return log


@router.get("/stats", response_model=PortalStatsResponse)
async def get_stats(
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """Get portal usage statistics (last 30 days). Admin only."""
    service = PortalService(db)
    return service.get_stats()


@router.get("/stats/me", response_model=MyAccessHistoryResponse)
async def get_stats_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's access history (last 50 entries)."""
    service = PortalService(db)
    items = service.get_my_history(user_id=current_user.id, limit=50)
    return MyAccessHistoryResponse(items=items)
