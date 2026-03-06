from types import SimpleNamespace

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


def _set_current_user():
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id="user-1",
        role="USER",
        sub_team_id="TEAM_A",
        department_id="DEPT_A",
        primary_business_unit_id="BU_MAIN",
    )


def _clear(client: TestClient):
    client.close()
    app.dependency_overrides.clear()


def test_team_ai_summary_uses_primary_business_unit_id(db_session: Session, monkeypatch):
    from app.api.endpoints import dashboard as dashboard_endpoint

    captured = {}

    async def fake_generate_team_summary(
        self, team_id, team_type, start_date, end_date, force_regenerate
    ):
        captured["team_id"] = team_id
        captured["team_type"] = team_type
        return {"ok": True}

    monkeypatch.setattr(
        dashboard_endpoint.SummaryService, "generate_team_summary", fake_generate_team_summary
    )

    client = _make_test_client(db_session)
    _set_current_user()
    try:
        response = client.get("/api/dashboard/ai-summary/team?scope=business_unit")
    finally:
        _clear(client)

    assert response.status_code == 200
    assert captured["team_id"] == "BU_MAIN"
    assert captured["team_type"] == "business_unit"


def test_team_ai_summary_history_uses_primary_business_unit_id(
    db_session: Session, monkeypatch
):
    from app.api.endpoints import dashboard as dashboard_endpoint

    captured = {}

    def fake_get_summary_history(self, scope, scope_id, limit, team_type=None):
        captured["scope"] = scope
        captured["scope_id"] = scope_id
        captured["team_type"] = team_type
        return []

    monkeypatch.setattr(
        dashboard_endpoint.SummaryService, "get_summary_history", fake_get_summary_history
    )

    client = _make_test_client(db_session)
    _set_current_user()
    try:
        response = client.get("/api/dashboard/ai-summary/team/history?scope=business_unit")
    finally:
        _clear(client)

    assert response.status_code == 200
    assert captured["scope"] == "team"
    assert captured["scope_id"] == "BU_MAIN"
    assert captured["team_type"] == "business_unit"
