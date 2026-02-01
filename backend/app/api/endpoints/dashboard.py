"""
Dashboard API endpoints
"""

from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.dashboard_service import DashboardService
from app.services.summary_service import SummaryService

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


@router.get("/ai-summary/user")
async def get_user_ai_summary(
    period: str = Query("weekly", description="기간: weekly, monthly"),
    force_regenerate: bool = Query(False, description="캐시 무시하고 재생성"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    AI-powered weekly summary for current user.
    Uses Gemini to analyze worklogs and generate bullet-point summary.
    Caches summaries for past weeks to save tokens.
    """
    # Calculate date range
    today = date.today()
    if period == "monthly":
        start_date = today.replace(day=1)
    else:  # weekly
        start_date = today - timedelta(days=today.weekday())
    end_date = today

    service = SummaryService(db)
    return await service.generate_user_summary(
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        force_regenerate=force_regenerate,
    )


@router.get("/ai-summary/team")
async def get_team_ai_summary(
    scope: str = Query(
        "department", description="조회 범위: sub_team, department, business_unit, all"
    ),
    period: str = Query("weekly", description="기간: weekly, monthly"),
    force_regenerate: bool = Query(False, description="캐시 무시하고 재생성"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    AI-powered weekly summary for team.
    Uses Gemini to analyze worklogs and generate:
    - Project-wise summary
    - Member-wise summary
    - Key issues/risks
    Caches summaries for past weeks to save tokens.
    """
    # Calculate date range
    today = date.today()
    if period == "monthly":
        start_date = today.replace(day=1)
    else:  # weekly
        start_date = today - timedelta(days=today.weekday())
    end_date = today

    # Get team ID based on scope
    if scope == "sub_team":
        team_id = current_user.sub_team_id
    elif scope == "department":
        team_id = current_user.department_id
    elif scope == "business_unit":
        team_id = current_user.business_unit_id
    else:
        team_id = None  # all

    service = SummaryService(db)
    return await service.generate_team_summary(
        team_id=team_id,
        team_type=scope,
        start_date=start_date,
        end_date=end_date,
        force_regenerate=force_regenerate,
    )


@router.get("/ai-summary/user/history")
async def get_user_ai_summary_history(
    limit: int = Query(5, description="조회 개수"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get history of AI-generated user summaries.
    """
    service = SummaryService(db)
    return service.get_summary_history(
        scope="user",
        scope_id=current_user.id,
        limit=limit,
    )


@router.get("/ai-summary/team/history")
async def get_team_ai_summary_history(
    scope: str = Query(
        "department", description="조회 범위: sub_team, department, business_unit, all"
    ),
    limit: int = Query(5, description="조회 개수"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get history of AI-generated team summaries.
    """
    # Get team ID based on scope
    if scope == "sub_team":
        team_id = current_user.sub_team_id
    elif scope == "department":
        team_id = current_user.department_id
    elif scope == "business_unit":
        team_id = current_user.business_unit_id
    else:
        team_id = "all"

    service = SummaryService(db)
    return service.get_summary_history(
        scope="team",
        scope_id=team_id or "all",
        limit=limit,
        team_type=scope,
    )
