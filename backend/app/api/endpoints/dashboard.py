"""
Dashboard API endpoints
"""

from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.dashboard_service import DashboardService
from app.services.summary_service import SummaryService
from app.schemas.dashboard import MyFTEResponse

router = APIRouter()


@router.get("/my-fte", response_model=MyFTEResponse)
async def get_my_fte(
    year: int = Query(..., description="Year (e.g., 2026)"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get user's FTE breakdown for a specific month.
    Compares planned FTE (from ResourcePlan) vs actual FTE (from WorkLog).

    Categories:
    - **Product/Functional**: Shows planned vs actual comparison
      - Planned: Projects with ResourcePlan entries
      - Unplanned: Projects with worklogs but no ResourcePlan
    - **Support**: Only shows actual FTE (ad-hoc nature, no planning expected)

    FTE calculation: hours / 160 (standard working hours per month)
    """
    service = DashboardService(db)
    return service.get_my_fte(str(current_user.id), year, month)


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
    start_date: Optional[date] = Query(
        None,
        description="시작 날짜 (YYYY-MM-DD). 제공되지 않으면 view_mode로 계산",
    ),
    end_date: Optional[date] = Query(
        None,
        description="종료 날짜 (YYYY-MM-DD). 제공되지 않으면 view_mode로 계산",
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
    - **start_date**: 시작 날짜 (선택적, 제공되지 않으면 view_mode로 계산)
    - **end_date**: 종료 날짜 (선택적, 제공되지 않으면 view_mode로 계산)
    """
    try:
        service = DashboardService(db)
        return service.get_team_dashboard(
            str(current_user.id), scope, view_mode, start_date, end_date
        )
    except Exception as e:
        import traceback
        print(f"[ERROR] get_team_dashboard failed: {str(e)}")
        print(traceback.format_exc())
        from app.core.errors import ErrorCode, app_error
        raise app_error(
            status_code=500,
            code=ErrorCode.SERVER_INTERNAL_ERROR,
            detail=f"Failed to get team dashboard: {str(e)}",
        )


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
        end_date = today
    else:  # weekly
        # Last week Monday to Sunday
        this_monday = today - timedelta(days=today.weekday())
        start_date = this_monday - timedelta(days=7)
        end_date = start_date + timedelta(days=6)  # Last Sunday

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
        # First day of current month
        start_date = today.replace(day=1)
        end_date = today
    else:  # weekly
        # Last week Monday to Sunday
        # today.weekday() is 0 for Monday.
        # This week's Monday is today - today.weekday()
        # Last week's Monday is today - today.weekday() - 7
        this_monday = today - timedelta(days=today.weekday())
        start_date = this_monday - timedelta(days=7)
        end_date = start_date + timedelta(days=6)  # Last Sunday

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
