from datetime import date

from app.core.security import get_current_user
from app.main import app


def _create_user(
    db_session,
    *,
    user_id: str,
    email: str,
    position_id: str,
    role: str = "USER",
    department_id: str | None = None,
    sub_team_id: str | None = None,
):
    from app.models.user import User

    user = User(
        id=user_id,
        email=email,
        hashed_password="hashed",
        name=email.split("@", 1)[0],
        position_id=position_id,
        role=role,
        department_id=department_id,
        sub_team_id=sub_team_id,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _set_user(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _clear_user():
    app.dependency_overrides.pop(get_current_user, None)


def test_personal_weekly_report_current_and_upsert(client, db_session, sample_position):
    user = _create_user(
        db_session,
        user_id="weekly-u1",
        email="weekly-u1@example.com",
        position_id=sample_position.id,
    )
    _set_user(user)
    try:
        resp = client.get("/api/weekly-reports/current?scope=user&reference_date=2026-03-11")
        assert resp.status_code == 200
        current = resp.json()
        assert current["report"] is None
        assert current["week_start"] == "2026-03-09"
        assert current["week_end"] == "2026-03-15"
        assert current["target_key"] == f"user:{user.id}"

        create_resp = client.put(
            "/api/weekly-reports",
            json={
                "scope": "user",
                "reference_date": "2026-03-11",
                "markdown_body": "## Weekly\n- shipped",
                "title": "My Weekly Report",
            },
        )
        assert create_resp.status_code == 200
        created = create_resp.json()
        assert created["scope"] == "user"
        assert created["scope_id"] == user.id
        assert created["owner_user_id"] == user.id
        assert created["status"] == "draft"
        assert created["week_start"] == "2026-03-09"

        second_resp = client.put(
            "/api/weekly-reports",
            json={
                "scope": "user",
                "week_start": "2026-03-09",
                "markdown_body": "## Updated\n- shipped more",
                "status": "published",
            },
        )
        assert second_resp.status_code == 200
        updated = second_resp.json()
        assert updated["id"] == created["id"]
        assert updated["markdown_body"] == "## Updated\n- shipped more"
        assert updated["status"] == "published"
        assert updated["published_by_user_id"] == user.id

        current_after = client.get("/api/weekly-reports/current?scope=user&reference_date=2026-03-11")
        assert current_after.status_code == 200
        assert current_after.json()["report"]["id"] == created["id"]
    finally:
        _clear_user()


def test_department_weekly_report_member_allowed_and_outsider_forbidden(
    client, db_session, sample_position, sample_department
):
    from app.models.organization import Department

    other_department = Department(
        id="DEPT_OTHER",
        name="Other Department",
        code="OTHER_DEPT",
        division_id=sample_department.division_id,
        is_active=True,
    )
    db_session.add(other_department)
    db_session.commit()

    member = _create_user(
        db_session,
        user_id="weekly-dept-member",
        email="dept-member@example.com",
        position_id=sample_position.id,
        department_id=sample_department.id,
    )
    outsider = _create_user(
        db_session,
        user_id="weekly-dept-outsider",
        email="dept-outsider@example.com",
        position_id=sample_position.id,
        department_id=other_department.id,
    )

    _set_user(member)
    try:
        create_resp = client.put(
            "/api/weekly-reports",
            json={
                "scope": "team",
                "team_scope_type": "department",
                "scope_id": sample_department.id,
                "week_start": "2026-03-09",
                "markdown_body": "dept report",
            },
        )
        assert create_resp.status_code == 200
        assert create_resp.json()["target_key"] == f"department:{sample_department.id}"
    finally:
        _clear_user()

    _set_user(outsider)
    try:
        forbidden = client.get(
            f"/api/weekly-reports/current?scope=team&team_scope_type=department&scope_id={sample_department.id}&reference_date=2026-03-11"
        )
        assert forbidden.status_code == 403
    finally:
        _clear_user()


def test_sub_team_weekly_report_member_allowed_and_outsider_forbidden(
    client, db_session, sample_position, sample_department, sample_sub_team
):
    from app.models.organization import SubTeam

    other_sub_team = SubTeam(
        id="TEAM_OTHER",
        name="Other Team",
        code="OTHER_TEAM",
        department_id=sample_department.id,
        is_active=True,
    )
    db_session.add(other_sub_team)
    db_session.commit()

    member = _create_user(
        db_session,
        user_id="weekly-sub-member",
        email="sub-member@example.com",
        position_id=sample_position.id,
        department_id=sample_department.id,
        sub_team_id=sample_sub_team.id,
    )
    outsider = _create_user(
        db_session,
        user_id="weekly-sub-outsider",
        email="sub-outsider@example.com",
        position_id=sample_position.id,
        department_id=sample_department.id,
        sub_team_id=other_sub_team.id,
    )

    _set_user(member)
    try:
        create_resp = client.put(
            "/api/weekly-reports",
            json={
                "scope": "team",
                "team_scope_type": "sub_team",
                "scope_id": sample_sub_team.id,
                "reference_date": "2026-03-13",
                "markdown_body": "subteam report",
            },
        )
        assert create_resp.status_code == 200
        assert create_resp.json()["target_key"] == f"sub_team:{sample_sub_team.id}"
    finally:
        _clear_user()

    _set_user(outsider)
    try:
        forbidden = client.put(
            "/api/weekly-reports",
            json={
                "scope": "team",
                "team_scope_type": "sub_team",
                "scope_id": sample_sub_team.id,
                "week_start": "2026-03-09",
                "markdown_body": "bad write",
            },
        )
        assert forbidden.status_code == 403
    finally:
        _clear_user()


def test_department_weekly_report_supports_delegate_updates_within_same_team(
    client, db_session, sample_position, sample_department
):
    owner = _create_user(
        db_session,
        user_id="weekly-delegate-owner",
        email="delegate-owner@example.com",
        position_id=sample_position.id,
        department_id=sample_department.id,
    )
    delegate = _create_user(
        db_session,
        user_id="weekly-delegate-writer",
        email="delegate-writer@example.com",
        position_id=sample_position.id,
        department_id=sample_department.id,
    )

    _set_user(owner)
    try:
        create_resp = client.put(
            "/api/weekly-reports",
            json={
                "scope": "team",
                "team_scope_type": "department",
                "scope_id": sample_department.id,
                "week_start": "2026-03-09",
                "title": "Software Weekly Report",
                "markdown_body": "initial owner draft",
            },
        )
        assert create_resp.status_code == 200
        created = create_resp.json()
        assert created["created_by_user_id"] == owner.id
        assert created["updated_by_user_id"] == owner.id
    finally:
        _clear_user()

    _set_user(delegate)
    try:
        update_resp = client.put(
            "/api/weekly-reports",
            json={
                "scope": "team",
                "team_scope_type": "department",
                "scope_id": sample_department.id,
                "week_start": "2026-03-09",
                "title": "Software Weekly Report",
                "markdown_body": "delegate updated draft",
            },
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["id"] == created["id"]
        assert updated["created_by_user_id"] == owner.id
        assert updated["updated_by_user_id"] == delegate.id
        assert updated["markdown_body"] == "delegate updated draft"

        current_resp = client.get(
            f"/api/weekly-reports/current?scope=team&team_scope_type=department&scope_id={sample_department.id}&reference_date=2026-03-11"
        )
        assert current_resp.status_code == 200
        current = current_resp.json()["report"]
        assert current["id"] == created["id"]
        assert current["updated_by_user_id"] == delegate.id
    finally:
        _clear_user()


def test_read_only_role_cannot_write_weekly_reports(
    client, db_session, sample_position, sample_department
):
    viewer = _create_user(
        db_session,
        user_id="weekly-viewer",
        email="viewer@example.com",
        position_id=sample_position.id,
        role="VIEWER",
        department_id=sample_department.id,
    )
    _set_user(viewer)
    try:
        resp = client.put(
            "/api/weekly-reports",
            json={
                "scope": "team",
                "team_scope_type": "department",
                "scope_id": sample_department.id,
                "reference_date": "2026-03-11",
                "markdown_body": "viewer write",
            },
        )
        assert resp.status_code == 403
    finally:
        _clear_user()


def test_history_is_descending_and_delete_removes_report(
    client, db_session, sample_position
):
    user = _create_user(
        db_session,
        user_id="weekly-history-user",
        email="history@example.com",
        position_id=sample_position.id,
    )
    _set_user(user)
    try:
        for week_start, body in [
            ("2026-03-02", "week10"),
            ("2026-03-09", "week11"),
        ]:
            resp = client.put(
                "/api/weekly-reports",
                json={
                    "scope": "user",
                    "week_start": week_start,
                    "markdown_body": body,
                },
            )
            assert resp.status_code == 200

        history_resp = client.get("/api/weekly-reports/history?scope=user&limit=10")
        assert history_resp.status_code == 200
        items = history_resp.json()["items"]
        assert [item["week_start"] for item in items] == ["2026-03-09", "2026-03-02"]

        delete_resp = client.delete(f"/api/weekly-reports/{items[0]['id']}")
        assert delete_resp.status_code == 200

        history_after = client.get("/api/weekly-reports/history?scope=user&limit=10")
        assert history_after.status_code == 200
        remaining = history_after.json()["items"]
        assert [item["week_start"] for item in remaining] == ["2026-03-02"]
    finally:
        _clear_user()


def test_week_start_must_be_monday(client, db_session, sample_position):
    user = _create_user(
        db_session,
        user_id="weekly-monday-user",
        email="monday@example.com",
        position_id=sample_position.id,
    )
    _set_user(user)
    try:
        resp = client.put(
            "/api/weekly-reports",
            json={
                "scope": "user",
                "week_start": "2026-03-10",
                "markdown_body": "bad date",
            },
        )
        assert resp.status_code == 422
    finally:
        _clear_user()
