from sqlalchemy.orm import Session
from app.core.database import Base, get_engine
from app.models.user import User
from app.models.organization import BusinessUnit, Department, SubTeam, JobPosition
from app.models.project import Project, ProjectType, Program
from app.schemas.user import UserCreate  # Assuming a schema for creating users
from app.services.user_service import (
    UserService,
)  # Assuming a service for user creation
import uuid


def init_data(db: Session):
    """
    Initializes dummy data for the database.
    This function will drop existing tables and create new ones, then populate with sample data.
    """
    print("Initializing dummy data...")

    # Create dummy data

    # 1. Business Units
    bu_is = BusinessUnit(id=str(uuid.uuid4()), name="Information Systems", code="IS")
    bu_abt = BusinessUnit(id=str(uuid.uuid4()), name="Abatement", code="ABT")
    db.add_all([bu_is, bu_abt])
    db.commit()
    db.refresh(bu_is)
    db.refresh(bu_abt)
    print("Business Units created.")

    # 2. Departments
    dept_eng = Department(
        id=str(uuid.uuid4()), name="Engineering", code="ENG", business_unit_id=bu_is.id
    )
    dept_qa = Department(
        id=str(uuid.uuid4()), name="QA", code="QA", business_unit_id=bu_abt.id
    )
    db.add_all([dept_eng, dept_qa])
    db.commit()
    db.refresh(dept_eng)
    db.refresh(dept_qa)
    print("Departments created.")

    # 3. Job Positions
    jp_leader = JobPosition(
        id=str(uuid.uuid4()), name="Team Leader", department_id=dept_eng.id
    )
    jp_engineer = JobPosition(
        id=str(uuid.uuid4()), name="Engineer", department_id=dept_eng.id
    )
    jp_manager = JobPosition(
        id=str(uuid.uuid4()), name="Project Manager", department_id=dept_eng.id
    )
    db.add_all([jp_leader, jp_engineer, jp_manager])
    db.commit()
    db.refresh(jp_leader)
    db.refresh(jp_engineer)
    db.refresh(jp_manager)
    print("Job Positions created.")

    # 4. Users
    user_service = UserService(db)

    admin_user_data = UserCreate(
        email="admin@edwards.com",
        name="Admin User",
        password="password",
        is_active=True,
        role="ADMIN",
        position_id=jp_manager.id,
        department_id=dept_eng.id,
    )
    user_service.create_user(admin_user_data)

    eng_user_data = UserCreate(
        email="john.doe@edwards.com",
        name="John Doe",
        password="password",
        is_active=True,
        role="USER",
        position_id=jp_engineer.id,
        department_id=dept_eng.id,
    )
    user_service.create_user(eng_user_data)

    print("Users created.")

    # 4. Project Types (using short code IDs as per model spec)
    pt_internal = ProjectType(id="NPI", name="New Product Introduction")
    pt_client = ProjectType(id="ETO", name="Engineering To Order")
    pt_cip = ProjectType(id="CIP", name="Continuous Improvement")
    db.add_all([pt_internal, pt_client, pt_cip])
    db.commit()
    print("Project Types created.")

    # 5. Programs (using short code IDs and linking to business units)
    prog_sw = Program(
        id="PRG_SW", name="Software Development", business_unit_id=bu_is.id
    )
    prog_hw = Program(
        id="PRG_HW", name="Hardware Development", business_unit_id=bu_is.id
    )
    db.add_all([prog_sw, prog_hw])
    db.commit()
    print("Programs created.")

    # 6. Projects (sample)
    # Get admin user for pm_id
    admin_user = db.query(User).filter(User.email == "admin@edwards.com").first()

    proj1 = Project(
        id=str(uuid.uuid4()),
        code="IO-001",
        name="Project A - Internal Tool",
        description="Development of a new internal analytics tool.",
        start_date="2025-01-01",
        end_date="2025-06-30",
        program_id=prog_sw.id,
        project_type_id=pt_internal.id,
        pm_id=admin_user.id if admin_user else None,
        status="WIP",
    )
    db.add(proj1)
    db.commit()
    print("Sample Projects created.")

    print("Dummy data initialization complete.")
