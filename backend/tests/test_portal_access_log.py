"""
Tests for portal access logging and statistics endpoints.
"""

from app.core.security import get_current_user
from app.main import app


def _create_user(db_session, user_id: str, email: str, position_id: str, role: str = "USER"):
    from app.models.user import User

    user = User(
        id=user_id,
        email=email,
        hashed_password="hashed",
        name=email.split("@", 1)[0],
        position_id=position_id,
        role=role,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_post_access_log_success(client, db_session, sample_position):
    """POST /api/portal/access-log — 201, DB row inserted."""
    user = _create_user(db_session, "portal-u1", "portal1@example.com", sample_position.id)
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        resp = client.post("/api/portal/access-log", json={"service": "oqc"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["user_id"] == user.id
        assert data["service"] == "oqc"
        assert "accessed_at" in data
        assert "id" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_post_access_log_invalid_service(client, db_session, sample_position):
    """POST /api/portal/access-log with invalid service — 422."""
    user = _create_user(db_session, "portal-u2", "portal2@example.com", sample_position.id)
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        resp = client.post("/api/portal/access-log", json={"service": "invalid_svc"})
        assert resp.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_post_access_log_unauthenticated(client):
    """POST /api/portal/access-log without auth — 401."""
    app.dependency_overrides.pop(get_current_user, None)
    resp = client.post("/api/portal/access-log", json={"service": "oqc"})
    assert resp.status_code == 401


def test_get_stats_admin(client, db_session, sample_position):
    """GET /api/portal/stats as ADMIN — 200, keys exist."""
    admin = _create_user(db_session, "portal-admin1", "admin1@example.com", sample_position.id, role="ADMIN")
    app.dependency_overrides[get_current_user] = lambda: admin
    try:
        # Insert a log first
        client.post("/api/portal/access-log", json={"service": "jarvis"})

        resp = client.get("/api/portal/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "service_counts" in data
        assert "top_users" in data
        assert "hourly_activity" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_get_stats_non_admin(client, db_session, sample_position):
    """GET /api/portal/stats as USER — 403."""
    user = _create_user(db_session, "portal-u3", "portal3@example.com", sample_position.id, role="USER")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        resp = client.get("/api/portal/stats")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_get_stats_me(client, db_session, sample_position):
    """GET /api/portal/stats/me — 200, own history only."""
    user_a = _create_user(db_session, "portal-u4a", "portal4a@example.com", sample_position.id)
    user_b = _create_user(db_session, "portal-u4b", "portal4b@example.com", sample_position.id)

    # Log as user_a
    app.dependency_overrides[get_current_user] = lambda: user_a
    client.post("/api/portal/access-log", json={"service": "oqc"})
    client.post("/api/portal/access-log", json={"service": "eob"})

    # Log as user_b
    app.dependency_overrides[get_current_user] = lambda: user_b
    client.post("/api/portal/access-log", json={"service": "jarvis"})

    # Check user_a history
    app.dependency_overrides[get_current_user] = lambda: user_a
    try:
        resp = client.get("/api/portal/stats/me")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2
        assert all(item["user_id"] == user_a.id for item in data["items"])
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_get_stats_me_limit_50(client, db_session, sample_position):
    """GET /api/portal/stats/me — 51 rows inserted, returns only 50."""
    user = _create_user(db_session, "portal-u5", "portal5@example.com", sample_position.id)
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        # Insert 51 logs
        for _ in range(51):
            client.post("/api/portal/access-log", json={"service": "testrig"})

        resp = client.get("/api/portal/stats/me")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 50
    finally:
        app.dependency_overrides.pop(get_current_user, None)
