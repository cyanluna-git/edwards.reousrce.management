from types import SimpleNamespace

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app


UNAUTHENTICATED_CASES = [
    ("GET", "/api/worklogs", None),
    (
        "POST",
        "/api/worklogs",
        {
            "date": "2026-03-01",
            "user_id": "user-1",
            "hours": 1,
        },
    ),
    ("GET", "/api/worklogs/1", None),
    ("PUT", "/api/worklogs/1", {"description": "updated"}),
    ("DELETE", "/api/worklogs/1", None),
    (
        "POST",
        "/api/worklogs/copy-week",
        {"user_id": "user-1", "target_week_start": "2026-03-02"},
    ),
    ("GET", "/api/worklogs/summary/daily?user_id=user-1&date=2026-03-01", None),
    ("GET", "/api/users", None),
    (
        "POST",
        "/api/users",
        {
            "email": "new.user@edwards.com",
            "password": "password123",
            "name": "New User",
            "position_id": "POS_TEST",
        },
    ),
    ("PUT", "/api/users/user-1", {"name": "Updated User"}),
    ("DELETE", "/api/users/user-1", None),
    ("GET", "/api/internal-ios/", None),
    ("GET", "/api/internal-ios/io-1", None),
    ("GET", "/api/internal-ios/by-number/IO-1", None),
    ("POST", "/api/internal-ios/", {"io_number": "INT-1", "name": "Internal IO"}),
    ("PUT", "/api/internal-ios/io-1", {"name": "Internal IO Updated"}),
    ("DELETE", "/api/internal-ios/io-1", None),
    ("POST", "/api/internal-ios/find-or-create", {"io_number": "INT-1", "name": "Internal IO"}),
    ("GET", "/api/recharge-ios/", None),
    ("GET", "/api/recharge-ios/io-1", None),
    ("GET", "/api/recharge-ios/by-number/RIO-1", None),
    ("POST", "/api/recharge-ios/", {"io_number": "RIO-1", "name": "Recharge IO"}),
    ("PUT", "/api/recharge-ios/io-1", {"name": "Recharge IO Updated"}),
    ("DELETE", "/api/recharge-ios/io-1", None),
    (
        "POST",
        "/api/recharge-ios/find-or-create",
        {"io_number": "RIO-1", "name": "Recharge IO"},
    ),
    ("GET", "/api/recharge-ios/by-business-unit/BU-1", None),
    ("GET", "/api/reports/capacity-summary", None),
    ("GET", "/api/reports/worklog-summary", None),
    ("GET", "/api/reports/worklog-summary/by-project", None),
    ("GET", "/api/reports/worklog-summary/by-role", None),
    ("GET", "/api/reports/capacity?year=2026&month=3", None),
    ("GET", "/api/reports/department/1?year=2026&month=3", None),
    ("GET", "/api/reports/project/project-1", None),
    ("GET", "/api/reports/user/user-1?year=2026&month=3", None),
    ("GET", "/api/reports/holidays?year=2026", None),
    ("GET", "/api/reports/working-days?year=2026&month=3", None),
    ("POST", "/api/divisions", {"name": "Division", "code": "DIV"}),
    ("PUT", "/api/divisions/DIV_TEST", {"name": "Division Updated"}),
    ("DELETE", "/api/divisions/DIV_TEST", None),
    (
        "POST",
        "/api/work-types/",
        {"code": "CAT001", "name": "Category", "level": 1},
    ),
    ("PUT", "/api/work-types/1", {"name": "Category Updated"}),
    ("POST", "/api/hiring-plans/plan-1/fill?user_id=user-1", None),
]


ADMIN_ONLY_CASES = [
    (
        "POST",
        "/api/users",
        {
            "email": "new.user@edwards.com",
            "password": "password123",
            "name": "New User",
            "position_id": "POS_TEST",
        },
    ),
    ("PUT", "/api/users/user-1", {"name": "Updated User"}),
    ("DELETE", "/api/users/user-1", None),
    ("POST", "/api/divisions", {"name": "Division", "code": "DIV"}),
    ("PUT", "/api/divisions/DIV_TEST", {"name": "Division Updated"}),
    ("DELETE", "/api/divisions/DIV_TEST", None),
    (
        "POST",
        "/api/work-types/",
        {"code": "CAT001", "name": "Category", "level": 1},
    ),
    ("PUT", "/api/work-types/1", {"name": "Category Updated"}),
    ("POST", "/api/hiring-plans/plan-1/fill?user_id=user-1", None),
]


@pytest.fixture(scope="function")
def auth_guard_client(db_session: Session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    try:
        yield client
    finally:
        client.close()
        app.dependency_overrides.clear()


@pytest.mark.parametrize(("method", "path", "payload"), UNAUTHENTICATED_CASES)
def test_scoped_endpoints_require_authentication(auth_guard_client, method, path, payload):
    response = auth_guard_client.request(method, path, json=payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.parametrize(("method", "path", "payload"), ADMIN_ONLY_CASES)
def test_admin_only_endpoints_reject_non_admin(auth_guard_client, method, path, payload):
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id="user-1", role="USER", is_active=True
    )
    try:
        response = auth_guard_client.request(method, path, json=payload)
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == status.HTTP_403_FORBIDDEN
