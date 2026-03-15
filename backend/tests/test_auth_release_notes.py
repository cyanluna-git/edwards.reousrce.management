from app.core.security import get_current_user
from app.main import app
from app.models.user import User


def _create_user(db_session, position_id: str, department_id: str | None = None) -> User:
    user = User(
        id="user-release-notes",
        email="release-notes@example.com",
        hashed_password="hashed",
        name="Release Notes User",
        korean_name="릴리즈노트",
        position_id=position_id,
        department_id=department_id,
        role="USER",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_auth_me_includes_seen_release_note_version(
    client,
    db_session,
    sample_department,
    sample_position,
):
    user = _create_user(db_session, sample_position.id, sample_department.id)
    user.seen_release_note_version = "2026-03-worklogs-updates"
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = client.get("/api/auth/me")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.json()["seen_release_note_version"] == "2026-03-worklogs-updates"


def test_acknowledge_release_notes_persists_version(
    client,
    db_session,
    sample_position,
):
    user = _create_user(db_session, sample_position.id)

    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = client.post(
            "/api/auth/release-notes/ack",
            json={"version": "2026-03-worklogs-updates"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "seen_release_note_version": "2026-03-worklogs-updates",
    }

    db_session.refresh(user)
    assert user.seen_release_note_version == "2026-03-worklogs-updates"
