"""
Pytest configuration and fixtures for Edwards backend tests.
"""

import pytest
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.database import Base
from app.main import app


# Test database URL (in-memory SQLite for fast tests)
TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def engine():
    """Create test database engine for each test."""
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Create all tables
    Base.metadata.create_all(bind=engine)
    yield engine
    # Drop all tables after tests
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(engine) -> Generator[Session, None, None]:
    """Create a new database session for a test."""
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Create a test client with overridden database dependency."""
    from app.core.database import get_db

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def sample_division(db_session: Session):
    """Create a sample division for testing."""
    from app.models.organization import Division

    division = Division(
        id="DIV_TEST", name="Test Division", code="TEST", is_active=True
    )
    db_session.add(division)
    db_session.commit()
    db_session.refresh(division)
    return division


@pytest.fixture
def sample_department(db_session: Session, sample_division):
    """Create a sample department linked to division."""
    from app.models.organization import Department

    department = Department(
        id="DEPT_TEST",
        name="Test Department",
        code="TEST_DEPT",
        division_id=sample_division.id,
        is_active=True,
    )
    db_session.add(department)
    db_session.commit()
    db_session.refresh(department)
    return department


@pytest.fixture
def sample_sub_team(db_session: Session, sample_department):
    """Create a sample sub-team linked to department."""
    from app.models.organization import SubTeam

    sub_team = SubTeam(
        id="TEAM_TEST",
        name="Test Team",
        code="TEST_TEAM",
        department_id=sample_department.id,
        is_active=True,
    )
    db_session.add(sub_team)
    db_session.commit()
    db_session.refresh(sub_team)
    return sub_team


@pytest.fixture
def sample_position(db_session: Session):
    """Create a sample job position for testing."""
    from app.models.organization import JobPosition

    position = JobPosition(id="POS_TEST", name="Test Engineer", level=5, is_active=True)
    db_session.add(position)
    db_session.commit()
    db_session.refresh(position)
    return position
