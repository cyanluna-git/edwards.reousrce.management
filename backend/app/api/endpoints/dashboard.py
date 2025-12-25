"""
Dashboard API endpoints
"""

from fastapi import APIRouter, Depends, Query
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


@router.get("/team-summary")
async def get_team_dashboard(
    scope: str = Query(
        "department",
        description="조회 범위: sub_team, department, business_unit, all",
    ),
    view_mode: str = Query(
        "weekly",
        description="기간 모드: weekly, monthly, quarterly, yearly",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get team/organization dashboard summary.

    - **scope**: 조회 범위
        - sub_team: 사용자가 속한 소그룹만
        - department: 사용자가 속한 부서 전체 (기본값)
        - business_unit: 사용자가 속한 사업부 전체
        - all: 전체 Engineering
    - **view_mode**: 기간 선택
        - weekly: 이번 주
        - monthly: 이번 달
        - quarterly: 이번 분기
        - yearly: 올해
    """
    service = DashboardService(db)
    return service.get_team_dashboard(current_user.id, scope, view_mode)
