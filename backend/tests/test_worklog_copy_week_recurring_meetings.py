from datetime import date

from sqlalchemy.orm import Session

from app.models.resource import WorkLog
from app.services.worklog_service import WorkLogService


def _add_worklog(
    db_session: Session,
    *,
    worklog_id: int,
    day: date,
    user_id: str,
    hours: float,
    description: str,
) -> None:
    db_session.add(
        WorkLog(
            id=worklog_id,
            date=day,
            user_id=user_id,
            work_type_category_id=1,
            hours=hours,
            description=description,
        )
    )


def test_copy_week_copies_only_weekly_and_ptm_worklogs(db_session: Session):
    user_id = "user-copy-week"
    _add_worklog(
        db_session,
        worklog_id=1,
        day=date(2026, 3, 2),
        user_id=user_id,
        hours=1,
        description="SW Weekly Meeting",
    )
    _add_worklog(
        db_session,
        worklog_id=2,
        day=date(2026, 3, 3),
        user_id=user_id,
        hours=1.5,
        description="Internal PTM",
    )
    _add_worklog(
        db_session,
        worklog_id=3,
        day=date(2026, 3, 4),
        user_id=user_id,
        hours=2,
        description="PCM Meeting",
    )
    _add_worklog(
        db_session,
        worklog_id=4,
        day=date(2026, 3, 5),
        user_id=user_id,
        hours=3,
        description="Customer issue investigation",
    )
    _add_worklog(
        db_session,
        worklog_id=5,
        day=date(2026, 3, 6),
        user_id=user_id,
        hours=1,
        description="Team meeting",
    )
    db_session.commit()

    service = WorkLogService(db_session)

    copied = service.copy_week(user_id, date(2026, 3, 9))

    assert [item.description for item in copied] == [
        "SW Weekly Meeting",
        "Internal PTM",
    ]
    assert [item.date for item in copied] == [
        date(2026, 3, 9),
        date(2026, 3, 10),
    ]


def test_copy_week_skips_recurring_meeting_that_would_exceed_daily_limit(
    db_session: Session,
):
    user_id = "user-copy-week-limit"
    _add_worklog(
        db_session,
        worklog_id=11,
        day=date(2026, 3, 2),
        user_id=user_id,
        hours=2,
        description="Platform Weekly",
    )
    _add_worklog(
        db_session,
        worklog_id=12,
        day=date(2026, 3, 3),
        user_id=user_id,
        hours=1,
        description="Project PTM",
    )
    _add_worklog(
        db_session,
        worklog_id=13,
        day=date(2026, 3, 9),
        user_id=user_id,
        hours=23,
        description="Existing target work",
    )
    db_session.commit()

    service = WorkLogService(db_session)

    copied = service.copy_week(user_id, date(2026, 3, 9))

    assert [item.description for item in copied] == ["Project PTM"]
    assert copied[0].date == date(2026, 3, 10)
