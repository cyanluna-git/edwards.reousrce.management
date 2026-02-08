"""
Tests for SSO self-registration flow.

Covers:
- Registration token creation/decoding (unit)
- POST /api/auth/sso/register endpoint (integration)
- Error cases: expired token, duplicate user, invalid dept/position, wrong token type
"""

import pytest
from datetime import timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import (
    create_registration_token,
    decode_registration_token,
    create_access_token,
    decode_token,
)


# ============================================================
# Unit Tests: Registration Token
# ============================================================


class TestRegistrationToken:
    """Unit tests for create/decode registration token."""

    def test_create_and_decode(self):
        """Basic round-trip: create token, decode it, verify payload."""
        data = {"email": "newuser@edwards.com", "name": "New User"}
        token = create_registration_token(data)

        payload = decode_registration_token(token)
        assert payload is not None
        assert payload["email"] == "newuser@edwards.com"
        assert payload["name"] == "New User"
        assert payload["type"] == "registration"

    def test_type_is_registration(self):
        """Token type must be 'registration'."""
        token = create_registration_token({"email": "a@b.com"})
        raw = decode_token(token)
        assert raw["type"] == "registration"

    def test_expired_token_returns_none(self):
        """Expired token should decode to None."""
        token = create_registration_token(
            {"email": "a@b.com"},
            expires_delta=timedelta(seconds=-1),
        )
        assert decode_registration_token(token) is None

    def test_access_token_rejected(self):
        """An access token must NOT pass decode_registration_token."""
        access = create_access_token({"sub": "user-123", "role": "USER"})
        assert decode_registration_token(access) is None

    def test_garbage_token_returns_none(self):
        """Random string must not decode."""
        assert decode_registration_token("not.a.valid.token") is None

    def test_custom_expiry(self):
        """Custom expiry should work."""
        token = create_registration_token(
            {"email": "a@b.com"},
            expires_delta=timedelta(hours=1),
        )
        payload = decode_registration_token(token)
        assert payload is not None


# ============================================================
# Integration Tests: POST /api/auth/sso/register
# ============================================================


class TestSSORegisterEndpoint:
    """Integration tests for the /auth/sso/register endpoint."""

    def _make_reg_token(self, email: str = "newuser@edwards.com", name: str = "New User"):
        return create_registration_token({"email": email, "name": name})

    def test_successful_registration(
        self, client: TestClient, db_session: Session, sample_department, sample_position
    ):
        """Happy path: valid token + valid form data → 200 with tokens."""
        token = self._make_reg_token()

        response = client.post(
            "/api/auth/sso/register",
            json={
                "registration_token": token,
                "name": "New User",
                "korean_name": "신규유저",
                "department_id": sample_department.id,
                "position_id": sample_position.id,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_user_created_in_db(
        self, client: TestClient, db_session: Session, sample_department, sample_position
    ):
        """After registration, user exists in DB with correct fields."""
        from app.models.user import User

        email = "dbcheck@edwards.com"
        token = self._make_reg_token(email=email, name="DB Check")

        client.post(
            "/api/auth/sso/register",
            json={
                "registration_token": token,
                "name": "DB Check",
                "korean_name": "디비체크",
                "department_id": sample_department.id,
                "position_id": sample_position.id,
            },
        )

        user = db_session.query(User).filter(User.email == email).first()
        assert user is not None
        assert user.name == "DB Check"
        assert user.korean_name == "디비체크"
        assert user.department_id == sample_department.id
        assert user.position_id == sample_position.id
        assert user.role == "USER"
        assert user.is_active is True

    def test_user_history_created(
        self, client: TestClient, db_session: Session, sample_department, sample_position
    ):
        """UserHistory with change_type=HIRE should be auto-created."""
        from app.models.user import User, UserHistory

        email = "history@edwards.com"
        token = self._make_reg_token(email=email)

        client.post(
            "/api/auth/sso/register",
            json={
                "registration_token": token,
                "name": "History User",
                "korean_name": "히스토리",
                "department_id": sample_department.id,
                "position_id": sample_position.id,
            },
        )

        user = db_session.query(User).filter(User.email == email).first()
        history = (
            db_session.query(UserHistory)
            .filter(UserHistory.user_id == user.id)
            .all()
        )
        assert len(history) == 1
        assert history[0].change_type == "HIRE"

    def test_issued_token_is_usable(
        self, client: TestClient, db_session: Session, sample_department, sample_position
    ):
        """Returned access token should work for /auth/me."""
        token = self._make_reg_token(email="tokencheck@edwards.com")

        reg_response = client.post(
            "/api/auth/sso/register",
            json={
                "registration_token": token,
                "name": "Token Check",
                "korean_name": "토큰체크",
                "department_id": sample_department.id,
                "position_id": sample_position.id,
            },
        )
        access_token = reg_response.json()["access_token"]

        me_response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert me_response.status_code == 200
        assert me_response.json()["email"] == "tokencheck@edwards.com"

    # ---- Error Cases ----

    def test_expired_token_401(
        self, client: TestClient, db_session: Session, sample_department, sample_position
    ):
        """Expired registration token → 401."""
        token = create_registration_token(
            {"email": "expired@edwards.com", "name": "Expired"},
            expires_delta=timedelta(seconds=-1),
        )

        response = client.post(
            "/api/auth/sso/register",
            json={
                "registration_token": token,
                "name": "Expired",
                "korean_name": "만료",
                "department_id": sample_department.id,
                "position_id": sample_position.id,
            },
        )

        assert response.status_code == 401
        assert "expired" in response.json()["detail"].lower() or "invalid" in response.json()["detail"].lower()

    def test_duplicate_email_409(
        self, client: TestClient, db_session: Session, sample_department, sample_position
    ):
        """Registering same email twice → 409 Conflict."""
        email = "duplicate@edwards.com"

        # First registration
        token1 = self._make_reg_token(email=email)
        resp1 = client.post(
            "/api/auth/sso/register",
            json={
                "registration_token": token1,
                "name": "First",
                "korean_name": "첫번째",
                "department_id": sample_department.id,
                "position_id": sample_position.id,
            },
        )
        assert resp1.status_code == 200

        # Second registration with same email
        token2 = self._make_reg_token(email=email)
        resp2 = client.post(
            "/api/auth/sso/register",
            json={
                "registration_token": token2,
                "name": "Second",
                "korean_name": "두번째",
                "department_id": sample_department.id,
                "position_id": sample_position.id,
            },
        )
        assert resp2.status_code == 409

    def test_invalid_department_400(
        self, client: TestClient, db_session: Session, sample_position
    ):
        """Invalid department_id → 400."""
        token = self._make_reg_token()

        response = client.post(
            "/api/auth/sso/register",
            json={
                "registration_token": token,
                "name": "Bad Dept",
                "korean_name": "잘못된부서",
                "department_id": "NONEXISTENT_DEPT",
                "position_id": sample_position.id,
            },
        )

        assert response.status_code == 400
        assert "department" in response.json()["detail"].lower()

    def test_invalid_position_400(
        self, client: TestClient, db_session: Session, sample_department
    ):
        """Invalid position_id → 400."""
        token = self._make_reg_token()

        response = client.post(
            "/api/auth/sso/register",
            json={
                "registration_token": token,
                "name": "Bad Pos",
                "korean_name": "잘못된직급",
                "department_id": sample_department.id,
                "position_id": "NONEXISTENT_POS",
            },
        )

        assert response.status_code == 400
        assert "position" in response.json()["detail"].lower()

    def test_access_token_as_reg_token_401(
        self, client: TestClient, db_session: Session, sample_department, sample_position
    ):
        """Using a normal access token as registration token → 401."""
        access_token = create_access_token({"sub": "user-123", "role": "USER"})

        response = client.post(
            "/api/auth/sso/register",
            json={
                "registration_token": access_token,
                "name": "Hacker",
                "korean_name": "해커",
                "department_id": sample_department.id,
                "position_id": sample_position.id,
            },
        )

        assert response.status_code == 401

    def test_missing_required_fields_422(self, client: TestClient, db_session: Session):
        """Missing required fields → 422 validation error."""
        token = self._make_reg_token()

        response = client.post(
            "/api/auth/sso/register",
            json={
                "registration_token": token,
                "name": "Incomplete",
                # missing korean_name, department_id, position_id
            },
        )

        assert response.status_code == 422

    def test_name_from_form_used_not_token(
        self, client: TestClient, db_session: Session, sample_department, sample_position
    ):
        """User-submitted name (from form) should be used, not the token's name."""
        from app.models.user import User

        token = self._make_reg_token(email="namtest@edwards.com", name="Token Name")

        client.post(
            "/api/auth/sso/register",
            json={
                "registration_token": token,
                "name": "Form Name",
                "korean_name": "폼이름",
                "department_id": sample_department.id,
                "position_id": sample_position.id,
            },
        )

        user = db_session.query(User).filter(User.email == "namtest@edwards.com").first()
        assert user.name == "Form Name"

    def test_email_from_token_used_not_modifiable(
        self, client: TestClient, db_session: Session, sample_department, sample_position
    ):
        """Email should come from the token, not from form submission."""
        from app.models.user import User

        token = self._make_reg_token(email="real@edwards.com")

        # Schema doesn't even have an email field, so backend always uses token email
        client.post(
            "/api/auth/sso/register",
            json={
                "registration_token": token,
                "name": "Real User",
                "korean_name": "진짜유저",
                "department_id": sample_department.id,
                "position_id": sample_position.id,
            },
        )

        user = db_session.query(User).filter(User.email == "real@edwards.com").first()
        assert user is not None
        assert user.email == "real@edwards.com"
