from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.models.resource import WorkLog
from app.models.user import User
from app.schemas.worklog import WorkLogUpdate
from app.services.worklog_service import WorkLogService


def _create_user(db_session: Session, position_id: str) -> User:
    user = User(
        id="user-worklog-update",
        email="worklog-update@example.com",
        hashed_password="hashed",
        name="Worklog User",
        position_id=position_id,
        role="USER",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_update_worklog_rejects_date_only_move_that_exceeds_daily_limit(
    db_session: Session,
    sample_position,
):
    user = _create_user(db_session, sample_position.id)
    db_session.add_all([
        WorkLog(
            id=1,
            date=date(2026, 3, 10),
            user_id=user.id,
            work_type_category_id=1,
            hours=8,
            description="source",
        ),
        WorkLog(
            id=2,
            date=date(2026, 3, 11),
            user_id=user.id,
            work_type_category_id=1,
            hours=20,
            description="target",
        ),
    ])
    db_session.commit()

    service = WorkLogService(db_session)

    with pytest.raises(ValueError, match="Total hours cannot exceed 24"):
        service.update(1, WorkLogUpdate(date=date(2026, 3, 11)))


def test_update_worklog_allows_date_only_move_within_daily_limit(
    db_session: Session,
    sample_position,
):
    user = _create_user(db_session, sample_position.id)
    db_session.add_all([
        WorkLog(
            id=11,
            date=date(2026, 3, 10),
            user_id=user.id,
            work_type_category_id=1,
            hours=4,
            description="source",
        ),
        WorkLog(
            id=12,
            date=date(2026, 3, 11),
            user_id=user.id,
            work_type_category_id=1,
            hours=8,
            description="target",
        ),
    ])
    db_session.commit()

    service = WorkLogService(db_session)
    updated = service.update(11, WorkLogUpdate(date=date(2026, 3, 11)))

    assert updated is not None
    assert updated.date == date(2026, 3, 11)
