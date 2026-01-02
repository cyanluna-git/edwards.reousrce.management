"""
Tests for Organization hierarchy: Division > Department > SubTeam
Validates that the organization structure works correctly.
"""

import pytest
from sqlalchemy.orm import Session

from app.models.organization import Division, Department, SubTeam


class TestOrganizationHierarchy:
    """Test organization hierarchy relationships."""

    def test_division_can_have_multiple_departments(
        self, db_session: Session, sample_division
    ):
        """Test that a division can have multiple departments."""
        # Create multiple departments under the same division
        dept1 = Department(
            id="DEPT_A",
            code="DEPT_A",
            name="Department A",
            division_id=sample_division.id,
            is_active=True,
        )
        dept2 = Department(
            id="DEPT_B",
            code="DEPT_B",
            name="Department B",
            division_id=sample_division.id,
            is_active=True,
        )

        db_session.add_all([dept1, dept2])
        db_session.commit()

        # Refresh to get relationships
        db_session.refresh(sample_division)

        assert len(sample_division.departments) == 2
        assert dept1 in sample_division.departments
        assert dept2 in sample_division.departments

    def test_department_belongs_to_division(
        self, db_session: Session, sample_department, sample_division
    ):
        """Test that department is correctly linked to division."""
        assert sample_department.division_id == sample_division.id
        assert sample_department.division == sample_division

    def test_department_can_have_multiple_subteams(
        self, db_session: Session, sample_department
    ):
        """Test that a department can have multiple sub-teams."""
        team1 = SubTeam(
            id="TEAM_A",
            code="TEAM_A",
            name="Team A",
            department_id=sample_department.id,
            is_active=True,
        )
        team2 = SubTeam(
            id="TEAM_B",
            code="TEAM_B",
            name="Team B",
            department_id=sample_department.id,
            is_active=True,
        )

        db_session.add_all([team1, team2])
        db_session.commit()
        db_session.refresh(sample_department)

        assert len(sample_department.sub_teams) == 2

    def test_subteam_belongs_to_department(
        self, db_session: Session, sample_sub_team, sample_department
    ):
        """Test that sub-team is correctly linked to department."""
        assert sample_sub_team.department_id == sample_department.id
        assert sample_sub_team.department == sample_department

    def test_get_division_from_subteam(
        self, db_session: Session, sample_sub_team, sample_department, sample_division
    ):
        """Test that we can traverse from sub-team to division."""
        # Navigate: SubTeam -> Department -> Division
        parent_dept = sample_sub_team.department
        parent_division = parent_dept.division

        assert parent_division.id == sample_division.id
        assert parent_division.name == "Test Division"


class TestDivisionModel:
    """Test Division model basic operations."""

    def test_create_division(self, db_session: Session):
        """Test creating a new division."""
        division = Division(
            id="DIV_NEW", code="NEW", name="New Division", is_active=True
        )

        db_session.add(division)
        db_session.commit()

        # Query back
        saved = db_session.query(Division).filter_by(id="DIV_NEW").first()
        assert saved is not None
        assert saved.name == "New Division"
        assert saved.is_active is True

    def test_division_defaults(self, db_session: Session):
        """Test that division has correct default values."""
        division = Division(id="DIV_DEFAULT", code="DEFAULT", name="Default Division")

        db_session.add(division)
        db_session.commit()
        db_session.refresh(division)

        assert division.is_active is True
        assert division.created_at is not None
