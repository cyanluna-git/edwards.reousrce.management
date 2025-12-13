from sqlalchemy.orm import Session
from app.core.database import Base, get_engine
from app.models.user import User
from app.models.organization import BusinessUnit, Department, SubTeam, JobPosition
from app.models.project import Project, ProjectType, Program
from app.schemas.user import UserCreate  # Assuming a schema for creating users
from app.services.user_service import UserService # Assuming a service for user creation
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
    dept_eng = Department(id=str(uuid.uuid4()), name="Engineering", code="ENG", business_unit_id=bu_is.id)
    dept_qa = Department(id=str(uuid.uuid4()), name="QA", code="QA", business_unit_id=bu_abt.id)
    db.add_all([dept_eng, dept_qa])
    db.commit()
    db.refresh(dept_eng)
    db.refresh(dept_qa)
    print("Departments created.")

    # 3. Job Positions
    jp_leader = JobPosition(id=str(uuid.uuid4()), name="Team Leader", department_id=dept_eng.id)
    jp_engineer = JobPosition(id=str(uuid.uuid4()), name="Engineer", department_id=dept_eng.id)
    jp_manager = JobPosition(id=str(uuid.uuid4()), name="Project Manager", department_id=dept_eng.id)
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
        is_superuser=True,
        role="ADMIN",
        job_position_id=jp_manager.id,
        department_id=dept_eng.id
    )
    user_service.create_user(admin_user_data)
    
    eng_user_data = UserCreate(
        email="john.doe@edwards.com",
        name="John Doe",
        password="password",
        is_active=True,
        is_superuser=False,
        role="USER",
        job_position_id=jp_engineer.id,
        department_id=dept_eng.id
    )
    user_service.create_user(eng_user_data)
    
    print("Users created.")

    # 4. Project Types
    pt_internal = ProjectType(id=str(uuid.uuid4()), name="Internal Development")
    pt_client = ProjectType(id=str(uuid.uuid4()), name="Client Project")
    db.add_all([pt_internal, pt_client])
    db.commit()
    db.refresh(pt_internal)
    db.refresh(pt_client)
    print("Project Types created.")

    # 5. Programs
    prog_sw = Program(id=str(uuid.uuid4()), name="Software Development")
    prog_hw = Program(id=str(uuid.uuid4()), name="Hardware Development")
    db.add_all([prog_sw, prog_hw])
    db.commit()
    db.refresh(prog_sw)
    db.refresh(prog_hw)
    print("Programs created.")

    # 6. Projects (sample)
    proj1 = Project(
        id=str(uuid.uuid4()),
        name="Project A - Internal Tool",
        description="Development of a new internal analytics tool.",
        start_date="2025-01-01",
        end_date="2025-06-30",
        program_id=prog_sw.id,
        project_type_id=pt_internal.id,
        owner_id=user_service.get_user_by_username("admin").id,
        status="active"
    )
    db.add(proj1)
    db.commit()
    print("Sample Projects created.")
    
    print("Dummy data initialization complete.")
