"""
Weekly report CRUD endpoints.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_write_permission
from app.models.user import User
from app.schemas.weekly_report import (
    WeeklyReportCurrentResponse,
    WeeklyReportDeleteResponse,
    WeeklyReportHistoryResponse,
    WeeklyReportLLMSummaryRequest,
    WeeklyReportLLMSummaryResponse,
    WeeklyReportResponse,
    WeeklyReportTeamScope,
    WeeklyReportUpsertRequest,
)
from app.services.weekly_report_service import WeeklyReportService
from app.services.weekly_report_summary_service import WeeklyReportSummaryService

router = APIRouter()


@router.get("/current", response_model=WeeklyReportCurrentResponse)
async def get_current_weekly_report(
    scope: str = Query("user", description="조회 범위: user or team"),
    team_scope_type: Optional[WeeklyReportTeamScope] = Query(
        None, description="팀 범위: department or sub_team"
    ),
    scope_id: Optional[str] = Query(None, description="대상 식별자"),
    reference_date: Optional[date] = Query(None, description="주차 계산 기준 날짜"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = WeeklyReportService(db)
    return service.get_current(
        current_user=current_user,
        scope=scope,
        team_scope_type=team_scope_type,
        scope_id=scope_id,
        reference_date=reference_date,
    )


@router.get("/history", response_model=WeeklyReportHistoryResponse)
async def get_weekly_report_history(
    scope: str = Query("user", description="조회 범위: user or team"),
    team_scope_type: Optional[WeeklyReportTeamScope] = Query(
        None, description="팀 범위: department or sub_team"
    ),
    scope_id: Optional[str] = Query(None, description="대상 식별자"),
    limit: int = Query(10, ge=1, le=52, description="조회 개수"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = WeeklyReportService(db)
    return {
        "items": service.get_history(
            current_user=current_user,
            scope=scope,
            team_scope_type=team_scope_type,
            scope_id=scope_id,
            limit=limit,
        )
    }


@router.put("", response_model=WeeklyReportResponse)
async def upsert_weekly_report(
    body: WeeklyReportUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = WeeklyReportService(db)
    return service.upsert(
        current_user=current_user,
        scope=body.scope,
        team_scope_type=body.team_scope_type,
        scope_id=body.scope_id,
        week_start=body.week_start,
        reference_date=body.reference_date,
        status_value=body.status,
        title=body.title,
        markdown_body=body.markdown_body,
    )


@router.post("/llm-summary", response_model=WeeklyReportLLMSummaryResponse)
async def generate_llm_summary(
    request: WeeklyReportLLMSummaryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: str = Depends(require_write_permission()),
):
    """Generate an LLM-powered summary from personal weekly reports for a team scope."""
    service = WeeklyReportSummaryService(db)
    return await service.summarize_for_team(
        team_scope_type=request.team_scope_type,
        scope_id=request.scope_id,
        week_start=request.week_start,
        current_user=current_user,
        save_intermediate=request.save_intermediate,
    )


@router.delete("/{report_id}", response_model=WeeklyReportDeleteResponse, status_code=status.HTTP_200_OK)
async def delete_weekly_report(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = WeeklyReportService(db)
    service.delete(current_user=current_user, report_id=report_id)
    return {"success": True, "id": report_id}
