from datetime import date
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.organization import Department, JobPosition, SubTeam
from app.models.project import Project
from app.models.resource import WorkLog
from app.models.user import User
from app.models.work_type import WorkTypeCategory
from app.services.summary_service import SummaryService


def _make_test_client(db_session: Session) -> TestClient:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def _set_current_user(**overrides):
    base = {
        "id": "user-1",
        "role": "USER",
        "sub_team_id": "TEAM_A",
        "department_id": "DEPT_A",
        "primary_business_unit_id": "BU_MAIN",
        "division_id": "DIV_MAIN",
    }
    base.update(overrides)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(**base)


def _clear(client: TestClient):
    client.close()
    app.dependency_overrides.clear()


def _seed_summary_entities(db_session: Session):
    position = JobPosition(id="POS_1", name="Engineer", level=1, is_active=True)
    department = Department(id="DEPT_A", name="Dept A", code="DEPT_A", is_active=True)
    sub_team = SubTeam(
        id="TEAM_A",
        department_id="DEPT_A",
        name="Team A",
        code="TEAM_A",
        is_active=True,
    )
    user = User(
        id="user-1",
        email="user1@example.com",
        hashed_password="hashed",
        name="User One",
        korean_name="유저원",
        department_id="DEPT_A",
        sub_team_id="TEAM_A",
        position_id="POS_1",
        is_active=True,
    )
    project = Project(
        id="project-1",
        name="Project Alpha",
        category="PRODUCT",
        status="InProgress",
    )
    work_type = WorkTypeCategory(
        id=1,
        code="ENG",
        name="Engineering",
        level=1,
        is_active=True,
        project_required=True,
    )

    db_session.add_all([position, department, sub_team, user, project, work_type])
    db_session.commit()

    worklog = WorkLog(
        date=date(2026, 2, 10),
        user_id="user-1",
        project_id="project-1",
        work_type_category_id=1,
        hours=8.0,
        description="Implemented subsystem integration and reviewed issues.",
    )
    db_session.add(worklog)
    db_session.commit()


class FakeDate(date):
    @classmethod
    def today(cls):
        return cls(2026, 3, 15)


class FakeSummaryClient:
    def __init__(self):
        self.calls = 0

    async def generate_json(self, prompt: str, system_prompt: str | None = None, user_email: str | None = None):
        self.calls += 1
        if "coverage_gaps" in (system_prompt or ""):
            return {
                "analysis": ["Project Alpha consumed most team hours this period."],
                "workload_observations": ["User One carried the largest visible share of logged work."],
                "risk_signals": ["Most logged effort was concentrated in a single project."],
                "coverage_gaps": ["Only one member logged detailed records in this sample."],
                "record_quality_notes": ["Descriptions are too sparse to infer milestone completion."],
            }

        return {
            "focus_areas": ["Project Alpha was the main focus area."],
            "workload_observations": ["Utilization stayed near a full single-person week."],
            "risk_signals": ["Work was concentrated in one project."],
            "record_quality_notes": ["The detail is not rich enough to confirm milestone status."],
        }

    async def health_check(self):
        return {"available": True, "model": "fake"}


def test_user_ai_summary_endpoint_uses_last_completed_month_range(db_session: Session, monkeypatch):
    from app.api.endpoints import dashboard as dashboard_endpoint

    captured = {}

    async def fake_generate_user_summary(self, user_id, start_date, end_date, force_regenerate):
        captured["user_id"] = user_id
        captured["start_date"] = start_date
        captured["end_date"] = end_date
        return {"ok": True}

    monkeypatch.setattr(dashboard_endpoint, "date", FakeDate)
    monkeypatch.setattr(
        dashboard_endpoint.SummaryService,
        "generate_user_summary",
        fake_generate_user_summary,
    )

    client = _make_test_client(db_session)
    _set_current_user()
    try:
        response = client.get("/api/dashboard/ai-summary/user?period=monthly")
    finally:
        _clear(client)

    assert response.status_code == 200
    assert captured["user_id"] == "user-1"
    assert captured["start_date"] == date(2026, 2, 1)
    assert captured["end_date"] == date(2026, 2, 28)


def test_team_ai_summary_endpoint_uses_last_completed_week_and_passes_dashboard_context(
    db_session: Session, monkeypatch
):
    from app.api.endpoints import dashboard as dashboard_endpoint

    captured = {}

    async def fake_generate_team_summary(
        self, team_id, team_type, start_date, end_date, force_regenerate, dashboard_context=None
    ):
        captured["team_id"] = team_id
        captured["team_type"] = team_type
        captured["start_date"] = start_date
        captured["end_date"] = end_date
        captured["dashboard_context"] = dashboard_context
        return {"ok": True}

    monkeypatch.setattr(dashboard_endpoint, "date", FakeDate)
    monkeypatch.setattr(
        dashboard_endpoint.DashboardService,
        "get_team_dashboard",
        lambda self, user_id, scope, view_mode, start_date, end_date, org_id=None: {
            "team_info": {"name": "Dept A", "member_count": 3}
        },
    )
    monkeypatch.setattr(
        dashboard_endpoint.SummaryService,
        "generate_team_summary",
        fake_generate_team_summary,
    )

    client = _make_test_client(db_session)
    _set_current_user()
    try:
        response = client.get("/api/dashboard/ai-summary/team?scope=department&period=weekly")
    finally:
        _clear(client)

    assert response.status_code == 200
    assert captured["team_id"] == "DEPT_A"
    assert captured["team_type"] == "department"
    assert captured["start_date"] == date(2026, 3, 2)
    assert captured["end_date"] == date(2026, 3, 8)
    assert captured["dashboard_context"] == {"team_info": {"name": "Dept A", "member_count": 3}}


def test_generate_user_summary_reuses_cache_and_returns_sectioned_fields(db_session: Session):
    _seed_summary_entities(db_session)
    fake_client = FakeSummaryClient()
    service = SummaryService(db_session, client=fake_client)

    first = _run_async(
        service.generate_user_summary(
            user_id="user-1",
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
        )
    )
    second = _run_async(
        service.generate_user_summary(
            user_id="user-1",
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
        )
    )
    regenerated = _run_async(
        service.generate_user_summary(
            user_id="user-1",
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
            force_regenerate=True,
        )
    )

    assert fake_client.calls == 2
    assert first["from_cache"] is False
    assert first["focus_areas"] == ["Project Alpha was the main focus area."]
    assert first["workload_observations"] == ["Utilization stayed near a full single-person week."]
    assert first["risk_signals"] == ["Work was concentrated in one project."]
    assert first["record_quality_notes"] == ["The detail is not rich enough to confirm milestone status."]
    assert first["summary"]
    assert second["from_cache"] is True
    assert second["focus_areas"] == first["focus_areas"]
    assert regenerated["from_cache"] is False


def test_generate_team_summary_returns_legacy_and_new_fields(db_session: Session):
    _seed_summary_entities(db_session)
    fake_client = FakeSummaryClient()
    service = SummaryService(db_session, client=fake_client)

    result = _run_async(
        service.generate_team_summary(
            team_id="DEPT_A",
            team_type="department",
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
            dashboard_context={
                "team_info": {"name": "Dept A", "member_count": 1},
                "member_contributions": [
                    {"name": "User One", "korean_name": "유저원", "hours": 8.0, "percentage": 100.0}
                ],
                "sub_org_contributions": [],
                "org_context": {"team_percentage": 12.5},
            },
        )
    )

    assert result["analysis"] == ["Project Alpha consumed most team hours this period."]
    assert result["workload_observations"] == [
        "User One carried the largest visible share of logged work."
    ]
    assert result["risk_signals"] == ["Most logged effort was concentrated in a single project."]
    assert result["coverage_gaps"] == ["Only one member logged detailed records in this sample."]
    assert result["record_quality_notes"] == [
        "Descriptions are too sparse to infer milestone completion."
    ]
    assert result["project_summary"] == result["analysis"]
    assert result["member_summary"] == result["workload_observations"]
    assert result["issues"]


def _run_async(coro):
    import asyncio

    return asyncio.run(coro)
