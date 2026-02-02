import sys
import os

# Append backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.project import Project, ProjectRechargeMapping
from app.models.organization import BusinessUnit
from app.models.recharge_io import RechargeIO
from app.models.user import User

# Load env
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "postgresql://postgres:password@localhost:5434/edwards"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()


def run_seed():
    print("Initializing Project Recharge Mappings...")

    # 1. Create Table if not exists
    # Importing ProjectRechargeMapping registers it with Base
    Base.metadata.create_all(bind=engine)
    print("Table 'project_recharge_mappings' verified/created.")

    # 2. Define Mappings (Generic Name -> BU Code -> IO Number)
    # Generic Project Name matches what is in 'projects' table (from debug output)
    # BU Codes: BU_ABATE, BU_IS, BU_ACM

    MAPPINGS = {
        "SUN Operations Support": {
            "BU_ABATE": "407278",
            "BU_IS": "407278",
            "BU_ACM": "407327",
        },
        "SUN Product Improvement": {
            "BU_ABATE": "407279",
            "BU_IS": "407279",
            "BU_ACM": "407296",
        },
        "VSS Product Improvement": {
            "BU_ABATE": "407328",
            "BU_IS": "407328",
            "BU_ACM": "407332",
        },
        "VSS Sales/Service Support": {
            "BU_ABATE": "407331",
            "BU_IS": "407331",
            "BU_ACM": "407332",
        },
        "Pre-Gate Support": {
            "BU_ABATE": "407111",
            "BU_IS": "407057",
            "BU_ACM": "407056",
        },
    }

    # 3. Apply Mappings
    for project_name, bu_map in MAPPINGS.items():
        # Find Generic Project
        project = db.query(Project).filter(Project.name == project_name).first()
        if not project:
            print(f"[WARN] Generic Project '{project_name}' not found. Skipping.")
            continue

        print(f"Processing '{project_name}' ({project.id})...")

        for bu_code, io_number in bu_map.items():
            # Find Business Unit
            # Assuming 'BU_ABATE', 'BU_IS', 'BU_ACM' are IDs.
            # Wait, earlier command output: [('BU_ABATE', 'Abatement'), ('BU_IS', '...'), ('BU_ACM', '...')]
            # So IDs are BU_ABATE, BU_IS, BU_ACM.

            bu = db.query(BusinessUnit).filter(BusinessUnit.id == bu_code).first()
            if not bu:
                print(f"  [ERR] Business Unit '{bu_code}' not found.")
                continue

            # Find Recharge IO
            recharge_io = (
                db.query(RechargeIO).filter(RechargeIO.io_number == io_number).first()
            )
            if not recharge_io:
                print(f"  [ERR] Recharge IO Number '{io_number}' not found.")
                continue

            # Create/Update Mapping
            mapping = (
                db.query(ProjectRechargeMapping)
                .filter(
                    ProjectRechargeMapping.project_id == project.id,
                    ProjectRechargeMapping.business_unit_id == bu.id,
                )
                .first()
            )

            if not mapping:
                mapping = ProjectRechargeMapping(
                    project_id=project.id,
                    business_unit_id=bu.id,
                    recharge_io_id=recharge_io.id,
                )
                db.add(mapping)
                print(
                    f"  [+] Added mapping: {bu_code} -> {io_number} ({recharge_io.name})"
                )
            else:
                if mapping.recharge_io_id != recharge_io.id:
                    mapping.recharge_io_id = recharge_io.id
                    print(
                        f"  [*] Updated mapping: {bu_code} -> {io_number} ({recharge_io.name})"
                    )
                else:
                    print(f"  [.] Existing mapping verified: {bu_code} -> {io_number}")

    db.commit()
    print("Seed Complete.")


if __name__ == "__main__":
    run_seed()
