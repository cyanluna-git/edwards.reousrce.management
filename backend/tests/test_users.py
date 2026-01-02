"""
Tests for User model and its relationship with organization hierarchy.
"""

import pytest
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.organization import SubTeam


class TestUserOrganization:
    """Test user's relationship with organization structure."""

    def test_user_belongs_to_subteam(
        self, db_session: Session, sample_sub_team, sample_position
    ):
        """Test that user is correctly linked to sub-team."""
        user = User(
            id="USER_001",
            email="test@example.com",
            hashed_password="hashed_password",
            name="Test User",
            sub_team_id=sample_sub_team.id,
            position_id=sample_position.id,
            is_active=True,
        )

        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        assert user.sub_team_id == sample_sub_team.id
        assert user.sub_team == sample_sub_team

    def test_get_department_from_user_via_subteam(
        self, db_session: Session, sample_sub_team, sample_department, sample_position
    ):
        """Test that we can get department from user via sub-team relationship."""
        user = User(
            id="USER_002",
            email="test2@example.com",
            hashed_password="hashed_password",
            name="Test User 2",
            sub_team_id=sample_sub_team.id,
            position_id=sample_position.id,
            is_active=True,
        )

        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        # Get department via sub_team relationship (intended approach after cleanup)
        dept_via_subteam = user.sub_team.department

        assert dept_via_subteam.id == sample_department.id
        assert dept_via_subteam.name == "Test Department"

    def test_get_division_from_user_via_subteam(
        self,
        db_session: Session,
        sample_sub_team,
        sample_department,
        sample_division,
        sample_position,
    ):
        """Test that we can traverse from user to division via sub-team."""
        user = User(
            id="USER_003",
            email="test3@example.com",
            hashed_password="hashed_password",
            name="Test User 3",
            sub_team_id=sample_sub_team.id,
            position_id=sample_position.id,
            is_active=True,
        )

        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        # Navigate: User -> SubTeam -> Department -> Division
        division = user.sub_team.department.division

        assert division.id == sample_division.id
        assert division.name == "Test Division"


class TestUserModel:
    """Test User model basic operations."""

    def test_create_user(
        self, db_session: Session, sample_sub_team, sample_department, sample_position
    ):
        """Test creating a new user."""
        user = User(
            id="USER_NEW",
            email="newuser@example.com",
            hashed_password="hashed_password",
            name="New User",
            korean_name="새사용자",
            sub_team_id=sample_sub_team.id,
            position_id=sample_position.id,
            role="USER",
            is_active=True,
        )

        db_session.add(user)
        db_session.commit()

        # Query back
        saved = db_session.query(User).filter_by(id="USER_NEW").first()
        assert saved is not None
        assert saved.email == "newuser@example.com"
        assert saved.korean_name == "새사용자"

    def test_user_defaults(
        self, db_session: Session, sample_sub_team, sample_department, sample_position
    ):
        """Test that user has correct default values."""
        user = User(
            id="USER_DEFAULT",
            email="default@example.com",
            hashed_password="hashed_password",
            name="Default User",
            sub_team_id=sample_sub_team.id,
            position_id=sample_position.id,
        )

        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        assert user.is_active is True
        assert user.role == "USER"
        assert user.created_at is not None
