from datetime import date

from app.core.security import get_current_user


def _create_user(
    db_session,
    *,
    user_id: str,
    email: str,
    position_id: str,
    department_id: str | None = None,
    sub_team_id: str | None = None,
    role: str = "USER",
):
    from app.models.user import User

    user = User(
        id=user_id,
        email=email,
        hashed_password="hashed",
        name=email.split("@", 1)[0],
        korean_name=f"{user_id}-ko",
        position_id=position_id,
        department_id=department_id,
        sub_team_id=sub_team_id,
        role=role,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _business_days(year: int, month: int) -> int:
    current = date(year, month, 1)
    count = 0
    while current.month == month:
        if current.weekday() < 5:
            count += 1
        current = current.fromordinal(current.toordinal() + 1)
    return count


def test_monthly_completion_counts_weekdays_and_zero_log_users(
    client, db_session, sample_department, sample_sub_team, sample_position
):
    from app.main import app
    from app.models.organization import Department
    from app.models.resource import WorkLog

    other_department = Department(
        id="DEPT_OTHER",
        name="Other Department",
        code="OTHER",
        division_id=sample_department.division_id,
        is_active=True,
    )
    db_session.add(other_department)
    db_session.commit()

    viewer = _create_user(
        db_session,
        user_id="viewer-user",
        email="viewer@example.com",
        position_id=sample_position.id,
        department_id=sample_department.id,
        role="ADMIN",
    )
    user_one = _create_user(
        db_session,
        user_id="user-one",
        email="one@example.com",
        position_id=sample_position.id,
        department_id=sample_department.id,
        sub_team_id=sample_sub_team.id,
    )
    user_two = _create_user(
        db_session,
        user_id="user-two",
        email="two@example.com",
        position_id=sample_position.id,
        department_id=sample_department.id,
        sub_team_id=sample_sub_team.id,
    )
    _create_user(
        db_session,
        user_id="user-three",
        email="three@example.com",
        position_id=sample_position.id,
        department_id=other_department.id,
    )

    db_session.add_all(
        [
                WorkLog(
                    date=date(2026, 3, 2),
                    user_id=user_one.id,
                    work_type_category_id=1,
                    hours=1.0,
                ),
                WorkLog(
                    date=date(2026, 3, 2),
                    user_id=user_one.id,
                    work_type_category_id=1,
                    hours=2.0,
                ),
                WorkLog(
                    date=date(2026, 3, 3),
                    user_id=user_one.id,
                    work_type_category_id=1,
                    hours=1.5,
                ),
                WorkLog(
                    date=date(2026, 3, 7),
                    user_id=user_one.id,
                    work_type_category_id=1,
                    hours=1.0,
                ),
        ]
    )
    db_session.commit()

    app.dependency_overrides[get_current_user] = lambda: viewer
    try:
        response = client.get(
            "/api/worklogs/completion/monthly",
            params={
                "month": "2026-03",
                "department_id": sample_department.id,
            },
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    payload = response.json()
    assert payload["month"] == "2026-03"
    assert payload["business_days"] == _business_days(2026, 3)

    entries = {entry["user_id"]: entry for entry in payload["entries"]}
    assert set(entries) == {user_one.id, user_two.id, viewer.id}
    assert entries[user_one.id]["completed_days"] == 2
    assert entries[user_one.id]["completion_rate"] == round(
        2 / payload["business_days"] * 100, 1
    )
    assert entries[user_two.id]["completed_days"] == 0
    assert entries[user_two.id]["completion_rate"] == 0.0


def test_monthly_completion_rejects_invalid_month(
    client, db_session, sample_department, sample_position
):
    from app.main import app

    viewer = _create_user(
        db_session,
        user_id="viewer-invalid-month",
        email="invalid@example.com",
        position_id=sample_position.id,
        department_id=sample_department.id,
        role="ADMIN",
    )

    app.dependency_overrides[get_current_user] = lambda: viewer
    try:
        response = client.get(
            "/api/worklogs/completion/monthly",
            params={"month": "2026/03"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 400
    assert response.json()["detail"] == "month must be in YYYY-MM format"
