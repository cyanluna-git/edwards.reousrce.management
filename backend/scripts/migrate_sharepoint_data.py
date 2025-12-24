"""
SharePoint Data Migration Script
Migrates data from CSV files exported from SharePoint to the project database.

Usage:
    cd backend
    python -m scripts.migrate_sharepoint_data

Data Files (in ref_table/):
    - db_projects.csv: 186 projects
    - db_users.csv: 140 users
    - db_worktype.csv: 20 work types
    - tb_worklog.csv: 104,471 worklogs
"""

import csv
import sys
import os
from pathlib import Path
from datetime import datetime
import uuid

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import Base, get_engine, get_session_local
from app.core.security import get_password_hash
from app.models.user import User
from app.models.organization import BusinessUnit, Department, SubTeam, JobPosition
from app.models.project import Project, ProjectType, Program, ProductLine
from app.models.resource import WorkLog

# Configuration
DEFAULT_PASSWORD = "password123"
REF_TABLE_PATH = Path(__file__).parent.parent.parent / "ref_table"

# ID Mapping dictionaries (CSV ID -> DB ID)
user_id_map = {}  # CSV User ID -> UUID
project_id_map = {}  # CSV Project ID -> UUID
worktype_map = {}  # CSV Worktype ID -> work_type string


def generate_uuid():
    return str(uuid.uuid4())


def read_csv(filename):
    """Read CSV file and return list of dictionaries"""
    filepath = REF_TABLE_PATH / filename
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return list(reader)


def clean_value(value):
    """Clean CSV value - strip whitespace and handle empty strings"""
    if value is None:
        return None
    value = str(value).strip()
    return value if value else None


def parse_bool(value):
    """Parse boolean from CSV (TRUE/FALSE/True/False/etc)"""
    if value is None:
        return False
    return str(value).strip().upper() == "TRUE"


def drop_all_data(db: Session):
    """Drop all existing data from tables"""
    print("\n" + "=" * 60)
    print("DROPPING ALL EXISTING DATA...")
    print("=" * 60)

    # Disable FK checks temporarily
    db.execute(text("SET CONSTRAINTS ALL DEFERRED"))

    # Delete in reverse order of dependencies
    tables = [
        "worklogs",
        "resource_plans",
        "project_milestones",
        "project_scenarios",
        "hiring_plans",
        "user_history",
        "projects",
        "users",
        "programs",
        "product_lines",
        "project_types",
        "sub_teams",
        "departments",
        "job_positions",
        "business_units",
    ]

    for table in tables:
        try:
            result = db.execute(text(f"DELETE FROM {table}"))
            print(f"  Deleted {result.rowcount} rows from {table}")
        except Exception as e:
            print(f"  Warning: Could not delete from {table}: {e}")

    db.commit()
    print("All data dropped.\n")


def migrate_business_units(db: Session):
    """Create Business Units from unique Area values in projects"""
    print("\n--- Migrating Business Units ---")

    bu_data = [
        {"id": "BU_IS", "name": "Integrated System", "code": "IS"},
        {"id": "BU_ABT", "name": "Abatement", "code": "ABT"},
        {"id": "BU_ACM", "name": "ACM", "code": "ACM"},
        {"id": "BU_SHARED", "name": "Shared", "code": "SHR"},
        {"id": "BU_OTHER", "name": "Others", "code": "OTH"},
    ]

    for data in bu_data:
        bu = BusinessUnit(**data)
        db.add(bu)

    db.commit()
    print(f"  Created {len(bu_data)} Business Units")
    return {d["code"]: d["id"] for d in bu_data}


def migrate_departments(db: Session):
    """Create Departments based on user Team values"""
    print("\n--- Migrating Departments ---")

    dept_data = [
        {
            "id": "DEPT_ACM_TECH",
            "name": "ACM Tech",
            "code": "ACM_TECH",
            "business_unit_id": "BU_ACM",
        },
        {
            "id": "DEPT_CENTRAL",
            "name": "Central Engineering",
            "code": "CENTRAL",
            "business_unit_id": "BU_SHARED",
        },
        {
            "id": "DEPT_CONTROL",
            "name": "Control Engineering",
            "code": "CONTROL",
            "business_unit_id": "BU_SHARED",
        },
        {
            "id": "DEPT_ETO",
            "name": "ETO",
            "code": "ETO",
            "business_unit_id": "BU_SHARED",
        },
        {
            "id": "DEPT_NPI_ABT",
            "name": "NPI, Abatement",
            "code": "NPI_ABT",
            "business_unit_id": "BU_ABT",
        },
        {
            "id": "DEPT_NPI_IS",
            "name": "NPI, IntegratedSystem",
            "code": "NPI_IS",
            "business_unit_id": "BU_IS",
        },
        {
            "id": "DEPT_GECIA",
            "name": "GECIA",
            "code": "GECIA",
            "business_unit_id": "BU_IS",
        },
    ]

    for data in dept_data:
        dept = Department(**data)
        db.add(dept)

    db.commit()
    print(f"  Created {len(dept_data)} Departments")

    # Return mapping for user import
    return {
        "Control Engineering": "DEPT_CONTROL",
        "NPI, IntegratedSystem": "DEPT_NPI_IS",
        "NPI, Abatement": "DEPT_NPI_ABT",
        "ETO": "DEPT_ETO",
        "ACM Tech": "DEPT_ACM_TECH",
        "Central Engineering": "DEPT_CENTRAL",
        "GECIA": "DEPT_GECIA",
    }


def migrate_sub_teams(db: Session):
    """Create Sub-Teams"""
    print("\n--- Migrating Sub-Teams ---")

    sub_teams_data = [
        {"id": "ST_DES", "name": "DES", "code": "DES", "department_id": "DEPT_CENTRAL"},
        {
            "id": "ST_LAB",
            "name": "Lab Management",
            "code": "LAB",
            "department_id": "DEPT_CENTRAL",
        },
        {
            "id": "ST_ANALYSIS",
            "name": "Analysis Tech.",
            "code": "ANALYSIS",
            "department_id": "DEPT_CENTRAL",
        },
        {"id": "ST_RA", "name": "RA", "code": "RA", "department_id": "DEPT_CENTRAL"},
        {
            "id": "ST_CTRL_SW_IS",
            "name": "Software (IS)",
            "code": "CTRL_SW_IS",
            "department_id": "DEPT_CONTROL",
        },
        {
            "id": "ST_CTRL_ELEC_IS",
            "name": "Electrical (IS)",
            "code": "CTRL_ELEC_IS",
            "department_id": "DEPT_CONTROL",
        },
        {
            "id": "ST_CTRL_SW_ABT",
            "name": "Software (ABT)",
            "code": "CTRL_SW_ABT",
            "department_id": "DEPT_CONTROL",
        },
        {
            "id": "ST_CTRL_ELEC_ABT",
            "name": "Electrical (ABT)",
            "code": "CTRL_ELEC_ABT",
            "department_id": "DEPT_CONTROL",
        },
        {
            "id": "ST_ETO_ELEC",
            "name": "ETO Elec",
            "code": "ETO_ELEC",
            "department_id": "DEPT_ETO",
        },
        {
            "id": "ST_SYS_ENG",
            "name": "Systems Engineering",
            "code": "SYS_ENG",
            "department_id": "DEPT_NPI_IS",
        },
        {
            "id": "ST_MECH_ENG",
            "name": "Mechanical Engineering",
            "code": "MECH_ENG",
            "department_id": "DEPT_NPI_IS",
        },
        {
            "id": "ST_NPI1",
            "name": "NPI 1 Team",
            "code": "NPI1",
            "department_id": "DEPT_NPI_ABT",
        },
    ]

    for data in sub_teams_data:
        st = SubTeam(**data)
        db.add(st)

    db.commit()
    print(f"  Created {len(sub_teams_data)} Sub-Teams")

    # Return mapping by name
    return {d["name"]: d["id"] for d in sub_teams_data}


def migrate_job_positions(db: Session):
    """Create Job Positions"""
    print("\n--- Migrating Job Positions ---")

    positions = [
        "Electrical engineer",
        "Mechanical engineer",
        "PM",
        "Service engineer",
        "Software engineer",
        "SW test engineer",
        "System engineer",
        "Tech Lead",
        "Technician",
        "Engineer",
    ]

    position_map = {}
    for name in positions:
        jp_id = f"JP_{name.upper().replace(' ', '_')}"
        jp = JobPosition(id=jp_id, name=name, is_active=True)
        db.add(jp)
        position_map[name] = jp_id

    db.commit()
    print(f"  Created {len(positions)} Job Positions")
    return position_map


def migrate_programs(db: Session):
    """Create Programs from unique Program values in projects CSV"""
    print("\n--- Migrating Programs ---")

    projects_data = read_csv("db_projects.csv")

    # Extract unique programs
    programs = {}
    for row in projects_data:
        program_name = clean_value(row.get("Program"))
        if program_name and program_name not in programs:
            area = clean_value(row.get("Area", ""))
            # Map area to business unit
            if "IntegratedSystem" in area:
                bu_id = "BU_IS"
            elif "Abatement" in area:
                bu_id = "BU_ABT"
            elif "ACM" in area:
                bu_id = "BU_ACM"
            else:
                bu_id = "BU_OTHER"

            programs[program_name] = bu_id

    program_map = {}
    for name, bu_id in programs.items():
        prog_id = f"PRG_{name.upper().replace(' ', '_').replace('/', '_').replace(',', '')[:30]}"
        prog = Program(id=prog_id, name=name, business_unit_id=bu_id, is_active=True)
        db.add(prog)
        program_map[name] = prog_id

    # Add default UNKNOWN program for projects without a program
    unknown_prog = Program(
        id="PRG_UNKNOWN",
        name="Unknown / Unassigned",
        business_unit_id="BU_OTHER",
        is_active=True,
    )
    db.add(unknown_prog)
    program_map[""] = "PRG_UNKNOWN"
    program_map[None] = "PRG_UNKNOWN"

    db.commit()
    print(f"  Created {len(program_map) - 2} Programs + 1 Unknown")
    return program_map


def migrate_project_types(db: Session):
    """Create Project Types from Complexity values"""
    print("\n--- Migrating Project Types ---")

    type_data = [
        {"id": "NPI", "name": "NPI Project", "description": "New Product Introduction"},
        {"id": "ETO", "name": "ETO Project", "description": "Engineer To Order"},
        {"id": "SUPPORT", "name": "Support", "description": "Support activities"},
        {"id": "LEGACY", "name": "Legacy", "description": "Legacy product support"},
        {
            "id": "INTERNAL",
            "name": "Internal Project",
            "description": "Internal projects",
        },
        {
            "id": "SUSTAINING",
            "name": "Sustaining",
            "description": "Sustaining activities",
        },
        {"id": "TEAM_TASK", "name": "Team Task", "description": "Team tasks"},
        {"id": "AND", "name": "A&D", "description": "Applied & Development"},
        {"id": "OTHER", "name": "Other", "description": "Other project types"},
    ]

    for data in type_data:
        pt = ProjectType(**data)
        db.add(pt)

    db.commit()
    print(f"  Created {len(type_data)} Project Types")

    # Return mapping from Complexity to project_type_id
    return {
        "NPI Project": "NPI",
        "ETO Project": "ETO",
        "Support": "SUPPORT",
        "Legacy": "LEGACY",
        "Internal Project": "INTERNAL",
        "Sustaining": "SUSTAINING",
        "Team Task": "TEAM_TASK",
        "A&D": "AND",
        "": "OTHER",
    }


def migrate_users(db: Session, dept_map, position_map, sub_team_map):
    """Migrate users from db_users.csv"""
    print("\n--- Migrating Users ---")

    users_data = read_csv("db_users.csv")
    hashed_password = get_password_hash(DEFAULT_PASSWORD)
    default_position = "JP_ENGINEER"

    # Mapping for department lookup based on Team column
    team_to_dept = {
        "Control Engineering": "DEPT_CONTROL",
        "NPI, IntegratedSystem": "DEPT_NPI_IS",
        "NPI, Abatement": "DEPT_NPI_ABT",
        "ETO": "DEPT_ETO",
        "ACM Tech": "DEPT_ACM_TECH",
        "Central Engineering": "DEPT_CENTRAL",
        "GECIA": "DEPT_GECIA",
    }

    # Sub-team mapping based on Department column in CSV
    dept_subteam = {
        ("Software", "IntegratedSystem"): "ST_CTRL_SW_IS",
        ("Software", "Abatement"): "ST_CTRL_SW_ABT",
        ("Electrical", "IntegratedSystem"): "ST_CTRL_ELEC_IS",
        ("Electrical", "Abatement"): "ST_CTRL_ELEC_ABT",
        ("ETO Elec", None): "ST_ETO_ELEC",
        ("Systems", "IntegratedSystem"): "ST_SYS_ENG",
        ("Mechanical", "IntegratedSystem"): "ST_MECH_ENG",
        ("NPI 1 Team", "Abatement"): "ST_NPI1",
        ("DES", None): "ST_DES",
        ("Lab Management", None): "ST_LAB",
        ("Analysis Tech.", None): "ST_ANALYSIS",
        ("RA", None): "ST_RA",
    }

    count = 0
    skipped = 0
    seen_emails = set()  # Track duplicate emails

    for row in users_data:
        # IMPORTANT: Use Person.id (not ID) - this matches WorkLog's Createdby.Id
        csv_id = clean_value(row.get("Person.id"))
        email = clean_value(row.get("email", ""))
        if not email:
            email = clean_value(row.get("Person.email", ""))

        if not email:
            print(f"  Skipping user without email: {row.get('KoreanName', 'unknown')}")
            skipped += 1
            continue

        email = email.lower()

        # Skip duplicate emails
        if email in seen_emails:
            print(f"  Skipping duplicate email: {email}")
            skipped += 1
            # Still map the CSV ID to the existing user UUID
            for prev_csv_id, prev_uuid in user_id_map.items():
                # Find the user with this email in our map
                pass
            continue

        seen_emails.add(email)
        name = (
            clean_value(row.get("English Name"))
            or clean_value(row.get("Person.EnglishName"))
            or ""
        )
        korean_name = clean_value(row.get("KoreanName")) or ""

        # Determine department from Team column
        team = clean_value(row.get("Team", ""))
        department_id = team_to_dept.get(team, "DEPT_CONTROL")  # Default

        # Determine sub-team based on Department column and Business Area
        dept_col = clean_value(row.get("Department", ""))
        business_area = clean_value(row.get("Buniness Area", ""))

        sub_team_id = None
        for (d, ba), st_id in dept_subteam.items():
            if dept_col == d and (ba is None or ba == business_area):
                sub_team_id = st_id
                break

        # Parse active status
        is_active = parse_bool(row.get("Enable?"))

        # Create UUID for user
        user_uuid = generate_uuid()
        user_id_map[csv_id] = user_uuid

        user = User(
            id=user_uuid,
            email=email,
            hashed_password=hashed_password,
            name=name,
            korean_name=korean_name,
            department_id=department_id,
            sub_team_id=sub_team_id,
            position_id=default_position,
            role="USER",
            is_active=is_active,
        )
        db.add(user)
        count += 1

    # Create admin user
    admin_uuid = generate_uuid()
    admin = User(
        id=admin_uuid,
        email="admin@edwards.com",
        hashed_password=hashed_password,
        name="System Admin",
        korean_name="시스템관리자",
        department_id="DEPT_CENTRAL",
        position_id="JP_PM",
        role="ADMIN",
        is_active=True,
    )
    db.add(admin)

    db.commit()
    print(f"  Created {count} Users + 1 Admin (skipped {skipped} duplicates)")


def map_status(csv_status):
    """Map CSV status to DB status"""
    status_map = {
        "WIP": "InProgress",
        "Completed": "Completed",
        "Hold": "OnHold",
        "Forecast": "Prospective",
        "Cancelled": "Cancelled",
        "": "Prospective",
    }
    return status_map.get(csv_status, "Prospective")


def migrate_projects(db: Session, program_map, type_map):
    """Migrate projects from db_projects.csv"""
    print("\n--- Migrating Projects ---")

    projects_data = read_csv("db_projects.csv")

    count = 0
    seen_codes = set()  # Track duplicate codes

    for row in projects_data:
        csv_id = clean_value(row.get("ID"))
        name = clean_value(row.get("Project", ""))
        if not name:
            continue

        io_code = clean_value(row.get("IO", ""))
        program_name = clean_value(row.get("Program", ""))
        complexity = clean_value(row.get("Complexity", ""))
        status = clean_value(row.get("Status", ""))
        customer = clean_value(row.get("Customer", ""))
        product = clean_value(row.get("Product", ""))
        description = clean_value(row.get("Description", ""))

        # Map to foreign keys - use PRG_UNKNOWN as default for empty/missing programs
        program_id = program_map.get(program_name, "PRG_UNKNOWN")

        project_type_id = type_map.get(complexity, "OTHER")

        # Generate unique code - use IO + CSV ID if IO is duplicate
        base_code = io_code if io_code else f"PRJ-{csv_id}"
        code = base_code
        if code in seen_codes:
            code = f"{base_code}-{csv_id}"
        seen_codes.add(code)

        # Create UUID
        proj_uuid = generate_uuid()
        project_id_map[csv_id] = proj_uuid

        project = Project(
            id=proj_uuid,
            program_id=program_id,
            project_type_id=project_type_id,
            code=code,
            name=name[:300],  # Truncate if necessary
            status=map_status(status),
            customer=customer,
            product=product,
            description=description,
        )
        db.add(project)
        count += 1

    db.commit()
    print(f"  Created {count} Projects")


def migrate_worktypes(db: Session):
    """Read work types and create mapping"""
    print("\n--- Processing Work Types ---")

    worktypes_data = read_csv("db_worktype.csv")

    for row in worktypes_data:
        wt_id = clean_value(row.get("Id"))
        title = clean_value(row.get("Title", ""))
        worktype_map[wt_id] = title

    print(f"  Loaded {len(worktype_map)} Work Types")


def migrate_worklogs(db: Session):
    """Migrate worklogs from tb_worklog.csv"""
    print("\n--- Migrating WorkLogs ---")
    print("  This may take several minutes for 100k+ records...")

    filepath = REF_TABLE_PATH / "tb_worklog.csv"

    batch_size = 1000
    count = 0
    skipped = 0
    batch = []

    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        for row in reader:
            # Get foreign key references
            csv_user_id = clean_value(row.get("Createdby.Id"))
            csv_project_id = clean_value(row.get("Project.Id"))
            csv_worktype_id = clean_value(row.get("Worktype.Id"))

            # Map to UUIDs
            user_id = user_id_map.get(csv_user_id)
            project_id = project_id_map.get(csv_project_id)

            if not user_id or not project_id:
                skipped += 1
                continue

            # Parse date
            date_str = clean_value(row.get("Date", ""))
            try:
                date = datetime.strptime(date_str.split(" ")[0], "%Y-%m-%d").date()
            except:
                skipped += 1
                continue

            # Parse hours
            try:
                hours = float(row.get("Hours", 0))
            except:
                hours = 0.0

            work_type = worktype_map.get(csv_worktype_id, "Other")
            description = clean_value(row.get("Title", ""))
            is_sudden = parse_bool(row.get("SuddenWork?"))
            is_trip = parse_bool(row.get("BusinessTrip"))

            worklog = WorkLog(
                date=date,
                user_id=user_id,
                project_id=project_id,
                work_type=work_type,
                hours=hours,
                description=description,
                is_sudden_work=is_sudden,
                is_business_trip=is_trip,
            )
            batch.append(worklog)
            count += 1

            # Commit in batches
            if len(batch) >= batch_size:
                db.add_all(batch)
                db.commit()
                batch = []
                print(f"    Processed {count} worklogs...")

    # Commit remaining
    if batch:
        db.add_all(batch)
        db.commit()

    print(f"  Created {count} WorkLogs (skipped {skipped})")


def main():
    """Main migration function"""
    print("=" * 60)
    print("SharePoint Data Migration")
    print("=" * 60)
    print(f"Source: {REF_TABLE_PATH}")
    print(f"Default Password: {DEFAULT_PASSWORD}")
    print()

    # Check if CSV files exist
    required_files = [
        "db_projects.csv",
        "db_users.csv",
        "db_worktype.csv",
        "tb_worklog.csv",
    ]
    for f in required_files:
        if not (REF_TABLE_PATH / f).exists():
            print(f"ERROR: Required file not found: {REF_TABLE_PATH / f}")
            return

    print("All required CSV files found.")
    print()

    # Create database session
    SessionLocal = get_session_local()
    db = SessionLocal()

    try:
        # 1. Drop existing data
        drop_all_data(db)

        # 2. Migrate master data (in order of FK dependencies)
        bu_map = migrate_business_units(db)
        dept_map = migrate_departments(db)
        sub_team_map = migrate_sub_teams(db)
        position_map = migrate_job_positions(db)
        program_map = migrate_programs(db)
        type_map = migrate_project_types(db)

        # 3. Migrate users
        migrate_users(db, dept_map, position_map, sub_team_map)

        # 4. Migrate projects
        migrate_projects(db, program_map, type_map)

        # 5. Process work types
        migrate_worktypes(db)

        # 6. Migrate worklogs
        migrate_worklogs(db)

        print("\n" + "=" * 60)
        print("MIGRATION COMPLETE!")
        print("=" * 60)
        print(f"Users: {len(user_id_map)}")
        print(f"Projects: {len(project_id_map)}")
        print("WorkLogs: See count above")
        print()
        print(f"Default login: admin@edwards.com / {DEFAULT_PASSWORD}")
        print("=" * 60)

    except Exception as e:
        print(f"\nERROR: {e}")
        db.rollback()
        import traceback

        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
