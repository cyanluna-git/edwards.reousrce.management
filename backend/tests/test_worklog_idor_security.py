from datetime import datetime
from types import SimpleNamespace

from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app


def _make_test_client(db_session: Session) -> TestClient:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def _set_current_user(user_id: str, role: str):
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id=user_id,
        role=role,
        is_active=True,
    )


def _clear_overrides(client: TestClient):
    client.close()
    app.dependency_overrides.clear()


def test_create_worklog_blocks_non_admin_cross_user(db_session: Session):
    client = _make_test_client(db_session)
    _set_current_user(user_id="user-self", role="USER")
    try:
        response = client.post(
            "/api/worklogs",
            json={
                "date": "2026-03-01",
                "user_id": "user-other",
                "hours": 1,
            },
        )
    finally:
        _clear_overrides(client)

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_copy_week_blocks_non_admin_cross_user(db_session: Session):
    client = _make_test_client(db_session)
    _set_current_user(user_id="user-self", role="USER")
    try:
        response = client.post(
            "/api/worklogs/copy-week",
            json={
                "user_id": "user-other",
                "target_week_start": "2026-03-02",
            },
        )
    finally:
        _clear_overrides(client)

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_create_worklog_allows_owner(db_session: Session, monkeypatch):
    from app.api.endpoints import worklogs as worklogs_endpoint

    def fake_create(self, worklog_in):
        return SimpleNamespace(
            id=1,
            date=worklog_in.date,
            user_id=worklog_in.user_id,
            project_id=None,
            product_line_id=None,
            work_type_category_id=None,
            hours=worklog_in.hours,
            description=worklog_in.description,
            is_sudden_work=False,
            is_business_trip=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            project=None,
        )

    monkeypatch.setattr(worklogs_endpoint.WorkLogService, "create", fake_create)

    client = _make_test_client(db_session)
    _set_current_user(user_id="user-self", role="USER")
    try:
        response = client.post(
            "/api/worklogs",
            json={
                "date": "2026-03-01",
                "user_id": "user-self",
                "hours": 1,
            },
        )
    finally:
        _clear_overrides(client)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["user_id"] == "user-self"


def test_create_worklog_allows_admin_cross_user(db_session: Session, monkeypatch):
    from app.api.endpoints import worklogs as worklogs_endpoint

    def fake_create(self, worklog_in):
        return SimpleNamespace(
            id=2,
            date=worklog_in.date,
            user_id=worklog_in.user_id,
            project_id=None,
            product_line_id=None,
            work_type_category_id=None,
            hours=worklog_in.hours,
            description=worklog_in.description,
            is_sudden_work=False,
            is_business_trip=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            project=None,
        )

    monkeypatch.setattr(worklogs_endpoint.WorkLogService, "create", fake_create)

    client = _make_test_client(db_session)
    _set_current_user(user_id="admin-user", role="ADMIN")
    try:
        response = client.post(
            "/api/worklogs",
            json={
                "date": "2026-03-01",
                "user_id": "user-other",
                "hours": 1,
            },
        )
    finally:
        _clear_overrides(client)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["user_id"] == "user-other"


def test_copy_week_allows_owner(db_session: Session, monkeypatch):
    from app.api.endpoints import worklogs as worklogs_endpoint

    def fake_copy_week(self, user_id, _target_week_start):
        return [
            SimpleNamespace(
                id=11,
                date=datetime(2026, 3, 2),
                user_id=user_id,
                project_id=None,
                product_line_id=None,
                work_type_category_id=None,
                hours=8,
                description=None,
                is_sudden_work=False,
                is_business_trip=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                project=None,
            )
        ]

    monkeypatch.setattr(worklogs_endpoint.WorkLogService, "copy_week", fake_copy_week)

    client = _make_test_client(db_session)
    _set_current_user(user_id="user-self", role="USER")
    try:
        response = client.post(
            "/api/worklogs/copy-week",
            json={
                "user_id": "user-self",
                "target_week_start": "2026-03-02",
            },
        )
    finally:
        _clear_overrides(client)

    assert response.status_code == status.HTTP_200_OK
    assert response.json()[0]["user_id"] == "user-self"


def test_copy_week_allows_admin_cross_user(db_session: Session, monkeypatch):
    from app.api.endpoints import worklogs as worklogs_endpoint

    def fake_copy_week(self, user_id, _target_week_start):
        return [
            SimpleNamespace(
                id=12,
                date=datetime(2026, 3, 2),
                user_id=user_id,
                project_id=None,
                product_line_id=None,
                work_type_category_id=None,
                hours=8,
                description=None,
                is_sudden_work=False,
                is_business_trip=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                project=None,
            )
        ]

    monkeypatch.setattr(worklogs_endpoint.WorkLogService, "copy_week", fake_copy_week)

    client = _make_test_client(db_session)
    _set_current_user(user_id="admin-user", role="ADMIN")
    try:
        response = client.post(
            "/api/worklogs/copy-week",
            json={
                "user_id": "user-other",
                "target_week_start": "2026-03-02",
            },
        )
    finally:
        _clear_overrides(client)

    assert response.status_code == status.HTTP_200_OK
    assert response.json()[0]["user_id"] == "user-other"
