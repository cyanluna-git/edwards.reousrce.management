from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.main import app
from app.models.user import User
from app.services.sso_service import SSOService


class _FakeSamlAuth:
    def process_response(self):
        return None

    def get_errors(self):
        return []

    def get_last_error_reason(self):
        return ""

    def is_authenticated(self):
        return True


def _make_test_client(db_session: Session) -> TestClient:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def test_sso_callback_redirect_uses_fragment_in_debug_mode(
    db_session: Session, sample_position, monkeypatch
):
    user = User(
        email="sso-user@edwards.com",
        hashed_password="placeholder",
        name="SSO User",
        position_id=sample_position.id,
        role="USER",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    monkeypatch.setattr("app.api.endpoints.auth.settings.SAML_ENABLED", True)
    monkeypatch.setattr("app.api.endpoints.auth.settings.DEBUG", True)
    monkeypatch.setattr(SSOService, "init_saml_auth", lambda *_args, **_kwargs: _FakeSamlAuth())
    monkeypatch.setattr(
        SSOService,
        "extract_user_attributes",
        lambda _auth: {"email": "sso-user@edwards.com", "name": "SSO User"},
    )

    client = _make_test_client(db_session)
    try:
        response = client.post(
            "/api/auth/sso/callback",
            data={"SAMLResponse": "dummy"},
            follow_redirects=False,
        )
    finally:
        client.close()
        app.dependency_overrides.clear()

    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith("http://localhost:3004/#token=")
    assert "&refresh=" in location
    assert "?token=" not in location


def test_sso_callback_redirect_uses_fragment_in_production_mode(
    db_session: Session, sample_position, monkeypatch
):
    user = User(
        email="sso-prod@edwards.com",
        hashed_password="placeholder",
        name="SSO Prod",
        position_id=sample_position.id,
        role="USER",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    monkeypatch.setattr("app.api.endpoints.auth.settings.SAML_ENABLED", True)
    monkeypatch.setattr("app.api.endpoints.auth.settings.DEBUG", False)
    monkeypatch.setattr(SSOService, "init_saml_auth", lambda *_args, **_kwargs: _FakeSamlAuth())
    monkeypatch.setattr(
        SSOService,
        "extract_user_attributes",
        lambda _auth: {"email": "sso-prod@edwards.com", "name": "SSO Prod"},
    )

    client = _make_test_client(db_session)
    try:
        response = client.post(
            "/api/auth/sso/callback",
            data={"SAMLResponse": "dummy"},
            follow_redirects=False,
        )
    finally:
        client.close()
        app.dependency_overrides.clear()

    assert response.status_code == 302
    location = response.headers["location"]
    assert "/#token=" in location
    assert "&refresh=" in location
    assert "?token=" not in location
