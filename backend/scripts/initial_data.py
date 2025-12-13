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
    pt_npi = ProjectType(id="NPI", name="New Product Introduction")
    pt_eto = ProjectType(id="ETO", name="Engineering To Order")
    pt_cip = ProjectType(id="CIP", name="Continuous Improvement")
    pt_support = ProjectType(id="SUP", name="Support / General")
    db.add_all([pt_npi, pt_eto, pt_cip, pt_support])
    db.commit()
    print("Project Types created.")

    # 5. Programs (from PCAS Project List)
    prog_euv_npi = Program(id="EUV_NPI", name="EUV NPI", business_unit_id=bu_is.id)
    prog_is_npi = Program(id="IS_NPI", name="IS NPI", business_unit_id=bu_is.id)
    prog_abt_npi = Program(
        id="ABT_NPI", name="Abatement NPI", business_unit_id=bu_abt.id
    )
    prog_abt_eto = Program(
        id="ABT_ETO", name="Abatement ETO", business_unit_id=bu_abt.id
    )
    prog_euv_eto = Program(id="EUV_ETO", name="EUV ETO", business_unit_id=bu_is.id)
    prog_acm_npi = Program(id="ACM_NPI", name="ACM NPI", business_unit_id=bu_abt.id)
    prog_acm_eto = Program(id="ACM_ETO", name="ACM ETO", business_unit_id=bu_abt.id)
    prog_general = Program(
        id="GEN_FUNC", name="General/Functional", business_unit_id=bu_is.id
    )
    db.add_all(
        [
            prog_euv_npi,
            prog_is_npi,
            prog_abt_npi,
            prog_abt_eto,
            prog_euv_eto,
            prog_acm_npi,
            prog_acm_eto,
            prog_general,
        ]
    )
    db.commit()
    print("Programs created.")

    # 6. Projects (from PCAS Project List CSV)
    admin_user = db.query(User).filter(User.email == "admin@edwards.com").first()
    pm_id = admin_user.id if admin_user else None

    projects_data = [
        # EUV NPI Projects
        {
            "code": "406372",
            "name": "Gen3+, HRSD, H2D-HP x 2, HVM",
            "program_id": "EUV_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": "TSMC HVM",
            "product": "IEB3J0624010",
            "complexity": "Simple NPI",
        },
        {
            "code": "406422",
            "name": "Gen3+ SMM2",
            "program_id": "EUV_NPI",
            "project_type_id": "NPI",
            "status": "Completed",
            "customer": "ASML",
            "product": "SMM2",
            "complexity": "Simple NPI",
        },
        {
            "code": "406376",
            "name": "Gen4, Kanarra",
            "program_id": "EUV_NPI",
            "project_type_id": "NPI",
            "status": "Hold",
            "customer": None,
            "product": "Kanarra",
            "complexity": "Complex NPI",
        },
        {
            "code": "406886",
            "name": "2025 EUV Gen3 Plus Micron ID",
            "program_id": "EUV_NPI",
            "project_type_id": "NPI",
            "status": "Forecast",
            "customer": "North America (Boise)",
            "product": "EUV Gen3 Plus",
            "complexity": None,
        },
        {
            "code": "406372-2",
            "name": "2025 EUV Zenith Plus",
            "program_id": "EUV_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": None,
            "product": None,
            "complexity": None,
        },
        # IS NPI Projects
        {
            "code": "406397",
            "name": "2025 Ruby - SIC integration",
            "program_id": "IS_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": None,
            "product": "Ruby",
            "complexity": "Simple NPI",
        },
        {
            "code": "406399",
            "name": "2025 Havasu",
            "program_id": "IS_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": "TEL",
            "product": "Havasu",
            "complexity": "Complex NPI",
        },
        {
            "code": "406437",
            "name": "2025 EUV Gen4 Phase 1 Tumalo",
            "program_id": "IS_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": None,
            "product": "Vizeon",
            "complexity": "Complex NPI",
        },
        {
            "code": "407039",
            "name": "2025 EUV Gen4 Phase 2 Tumalo",
            "program_id": "IS_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": None,
            "product": "Vizeon",
            "complexity": None,
        },
        {
            "code": "406403",
            "name": "2025 Hydrogen Recycling System_KR",
            "program_id": "IS_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": None,
            "product": "NKB918000",
            "complexity": "Simple NPI",
        },
        {
            "code": "406365",
            "name": "2025 High Performance H2D (1000slm)",
            "program_id": "IS_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": None,
            "product": "H2D-HP",
            "complexity": "Derivative NPI",
        },
        {
            "code": "406372-3",
            "name": "NKB963, EXP3, Nova x 4",
            "program_id": "IS_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": "Samsung",
            "product": "NKB963000",
            "complexity": "Derivative NPI",
        },
        {
            "code": "406886-2",
            "name": "Gen3+ Rapidus",
            "program_id": "IS_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": None,
            "product": None,
            "complexity": "Derivative NPI",
        },
        {
            "code": "406886-3",
            "name": "Gen3+ Micron",
            "program_id": "IS_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": None,
            "product": None,
            "complexity": "Derivative NPI",
        },
        # Abatement NPI Projects
        {
            "code": "406420",
            "name": "2025 Protron | Single ROW",
            "program_id": "ABT_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": None,
            "product": None,
            "complexity": None,
        },
        {
            "code": "406435",
            "name": "2510 LPLN TOP150 DUAL HVM",
            "program_id": "ABT_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": None,
            "product": None,
            "complexity": None,
        },
        {
            "code": "407052",
            "name": "2506 SDC Plasma Single Etch",
            "program_id": "ABT_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": "SDC",
            "product": None,
            "complexity": "Derivative NPI",
        },
        {
            "code": "407053",
            "name": "2506 Unify Plasma Single",
            "program_id": "ABT_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": None,
            "product": None,
            "complexity": "Complex NPI",
        },
        {
            "code": "407112",
            "name": "2507 H2 Injection Kit",
            "program_id": "ABT_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": None,
            "product": None,
            "complexity": None,
        },
        {
            "code": "407110",
            "name": "2508 HERMES",
            "program_id": "ABT_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": "Intel",
            "product": "EUV",
            "complexity": None,
        },
        # EUV ETO Projects
        {
            "code": "404721",
            "name": "EUV TSMC Gen3 H2D-R(TS marked)",
            "program_id": "EUV_ETO",
            "project_type_id": "ETO",
            "status": "WIP",
            "customer": "TSMC",
            "product": "IE0000210",
            "complexity": None,
        },
        {
            "code": "404721-2",
            "name": "EUV ASML 5H upgrade",
            "program_id": "EUV_ETO",
            "project_type_id": "ETO",
            "status": "WIP",
            "customer": "ASML",
            "product": "NKB624000",
            "complexity": None,
        },
        {
            "code": "404721-3",
            "name": "EUV TSMC Gen2 Nova to H2D",
            "program_id": "EUV_ETO",
            "project_type_id": "ETO",
            "status": "WIP",
            "customer": "TSMC",
            "product": "NKB898000",
            "complexity": None,
        },
        {
            "code": "404721-4",
            "name": "ASML 5J01 upgrade PJT",
            "program_id": "EUV_ETO",
            "project_type_id": "ETO",
            "status": "WIP",
            "customer": "ASML",
            "product": "TBD",
            "complexity": None,
        },
        # ACM Projects
        {
            "code": "406362",
            "name": "2025 NRTL (DTLR / ARS)",
            "program_id": "ACM_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": "SEC",
            "product": "DTLR & ARS",
            "complexity": None,
        },
        {
            "code": "406374",
            "name": "2025 Ar Degasser",
            "program_id": "ACM_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": "SEC",
            "product": "DTLR",
            "complexity": None,
        },
        {
            "code": "406646",
            "name": "2025 BCD",
            "program_id": "ACM_NPI",
            "project_type_id": "NPI",
            "status": "WIP",
            "customer": "SEC",
            "product": "BCD & VMB",
            "complexity": None,
        },
    ]

    for p in projects_data:
        proj = Project(
            id=str(uuid.uuid4()),
            code=p["code"],
            name=p["name"],
            program_id=p["program_id"],
            project_type_id=p["project_type_id"],
            status=p["status"],
            customer=p.get("customer"),
            product=p.get("product"),
            complexity=p.get("complexity"),
            pm_id=pm_id,
        )
        db.add(proj)

    db.commit()
    print(f"Created {len(projects_data)} projects from PCAS data.")

    print("Dummy data initialization complete.")
