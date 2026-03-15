from datetime import date
from types import SimpleNamespace

from app.core.security import get_current_user


def test_export_worklogs_csv_returns_utf16le_with_bom(client, monkeypatch):
    from app.api.endpoints import worklogs as worklogs_endpoint
    from app.main import app

    def fake_get_multi_with_user(self, **_kwargs):
        return [
            SimpleNamespace(
                date=date(2026, 3, 13),
                user=SimpleNamespace(
                    name="Hong Gil Dong",
                    korean_name="홍길동",
                    sub_team=SimpleNamespace(
                        department=SimpleNamespace(name="개발팀"),
                    ),
                ),
                project=SimpleNamespace(name="한글 프로젝트"),
                work_type_category=SimpleNamespace(name="분석"),
                hours=8,
                description="CSV 한글 확인",
            )
        ]

    monkeypatch.setattr(worklogs_endpoint.WorkLogService, "get_multi_with_user", fake_get_multi_with_user)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id="user-self",
        role="USER",
        is_active=True,
    )

    try:
        response = client.get("/api/worklogs/export/csv")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv; charset=utf-16le")
    assert response.headers["content-disposition"].startswith("attachment; filename=")
    assert response.content.startswith(b"\xff\xfe")

    decoded = response.content[2:].decode("utf-16le")
    assert "홍길동" in decoded
    assert "개발팀" in decoded
    assert "한글 프로젝트" in decoded
    assert "CSV 한글 확인" in decoded
