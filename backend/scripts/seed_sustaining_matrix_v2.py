#!/usr/bin/env python3
"""
Seed Sustaining Matrix Projects v2

This script implements "The Matrix Reset" strategy for restructuring the
"Sustaining & Support" project system. It creates/updates standardized sustaining
projects based on the [Funding Entity] x [IO Category] matrix.

Strategy:
1. UPSERT standard "Sustaining" projects for VSS and SUN funding entities
   - CREATE if project doesn't exist
   - UPDATE if project exists but attributes differ (enforce consistency)
2. Each entity has 8 standard IO categories (buckets)
3. All projects are BILLABLE to the respective funding entity
4. Identify legacy candidates for future migration (read-only report)

Common Attributes for All Matrix Projects:
- project_type_id: "SUSTAINING"
- recharge_status: "BILLABLE"
- is_active: True

Usage:
    docker exec edwards-api python /app/scripts/seed_sustaining_matrix_v2.py
"""

import sys
import os
import uuid
from datetime import datetime

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import get_session_local
from app.models.project import Project, ProjectType, Program
from app.models.organization import BusinessUnit


def generate_uuid():
    return str(uuid.uuid4())


# =============================================================================
# MATRIX DATA DEFINITIONS
# =============================================================================

# Matrix A: VSS (Integrated Systems)
VSS_MATRIX = [
    {
        "code": "VSS011",
        "name": "VSS - L4 Safety (Product Incident)",
        "io_category": "FIELD_FAILURE",
        "note": "PI Cases",
    },
    {
        "code": "VSS012",
        "name": "VSS - L4 Non-Safety (General)",
        "io_category": "FIELD_FAILURE",
        "note": "Escalation",
    },
    {
        "code": "VSS013",
        "name": "VSS - Field Corrective Action",
        "io_category": "SUSTAINING",
        "note": "FQR, SC",
    },
    {
        "code": "VSS014",
        "name": "VSS - Operations / Factory Support",
        "io_category": "OPS_SUPPORT",
        "note": "Manufacturing",
    },
    {
        "code": "VSS015",
        "name": "VSS - Product Improvement",
        "io_category": "CIP",
        "note": "Non-Field",
    },
    {
        "code": "VSS016",
        "name": "VSS - Cost Reduction (PK)",
        "io_category": "CIP",
        "note": "Cost Down",
    },
    {
        "code": "VSS017",
        "name": "VSS - Regulatory & Compliance",
        "io_category": "OTHER",
        "note": "PSCL, Certi",
    },
    {
        "code": "VSS018",
        "name": "VSS - Sales / Service Support",
        "io_category": "OTHER",
        "note": "Spare parts, etc.",
    },
]

# Matrix B: SUN (Abatement)
SUN_MATRIX = [
    {
        "code": "SUN001",
        "name": "SUN - L4 Safety (Product Incident)",
        "io_category": "FIELD_FAILURE",
        "note": "",
    },
    {
        "code": "SUN002",
        "name": "SUN - L4 Non-Safety (General)",
        "io_category": "FIELD_FAILURE",
        "note": "",
    },
    {
        "code": "SUN003",
        "name": "SUN - Field Corrective Action",
        "io_category": "SUSTAINING",
        "note": "",
    },
    {
        "code": "SUN004",
        "name": "SUN - Operations / Factory Support",
        "io_category": "OPS_SUPPORT",
        "note": "",
    },
    {
        "code": "SUN005",
        "name": "SUN - Product Improvement",
        "io_category": "CIP",
        "note": "",
    },
    {
        "code": "SUN006",
        "name": "SUN - Cost Reduction (PK)",
        "io_category": "CIP",
        "note": "",
    },
    {
        "code": "SUN007",
        "name": "SUN - Regulatory & Compliance",
        "io_category": "OTHER",
        "note": "",
    },
    {
        "code": "SUN008",
        "name": "SUN - Sales / Service Support",
        "io_category": "OTHER",
        "note": "",
    },
]


def ensure_project_type(db) -> str:
    """Ensure SUSTAINING project type exists, return its ID"""
    existing = db.query(ProjectType).filter(ProjectType.id == "SUSTAINING").first()
    if existing:
        print("  ✓ ProjectType 'SUSTAINING' already exists")
        return "SUSTAINING"

    pt = ProjectType(
        id="SUSTAINING",
        name="Sustaining Engineering",
        description="Post-release product support, field failures, and maintenance",
        is_active=True
    )
    db.add(pt)
    db.commit()
    print("  ✅ Created ProjectType 'SUSTAINING'")
    return "SUSTAINING"


def ensure_programs(db) -> dict:
    """Ensure VSS and SUN sustaining programs exist, return mapping"""
    programs = {}

    # VSS Sustaining Program
    vss_prog = db.query(Program).filter(Program.id == "PRG_VSS_SUSTAINING").first()
    if vss_prog:
        print("  ✓ Program 'PRG_VSS_SUSTAINING' already exists")
        programs["VSS"] = "PRG_VSS_SUSTAINING"
    else:
        # Check if BU_IS exists, create if not
        bu_is = db.query(BusinessUnit).filter(BusinessUnit.id == "BU_IS").first()
        if not bu_is:
            bu_is = BusinessUnit(id="BU_IS", name="Integrated System", code="IS")
            db.add(bu_is)
            db.commit()
            print("  ✅ Created BusinessUnit 'BU_IS'")

        new_prog = Program(
            id="PRG_VSS_SUSTAINING",
            name="VSS Sustaining",
            business_unit_id="BU_IS",
            description="VSS Division sustaining and support projects",
            is_active=True
        )
        db.add(new_prog)
        db.commit()
        print("  ✅ Created Program 'PRG_VSS_SUSTAINING'")
        programs["VSS"] = "PRG_VSS_SUSTAINING"

    # SUN Sustaining Program
    sun_prog = db.query(Program).filter(Program.id == "PRG_SUN_SUSTAINING").first()
    if sun_prog:
        print("  ✓ Program 'PRG_SUN_SUSTAINING' already exists")
        programs["SUN"] = "PRG_SUN_SUSTAINING"
    else:
        # Check if BU_ABT exists, create if not
        bu_abt = db.query(BusinessUnit).filter(BusinessUnit.id == "BU_ABT").first()
        if not bu_abt:
            bu_abt = BusinessUnit(id="BU_ABT", name="Abatement", code="ABT")
            db.add(bu_abt)
            db.commit()
            print("  ✅ Created BusinessUnit 'BU_ABT'")

        new_prog = Program(
            id="PRG_SUN_SUSTAINING",
            name="SUN Sustaining",
            business_unit_id="BU_ABT",
            description="SUN Division sustaining and support projects",
            is_active=True
        )
        db.add(new_prog)
        db.commit()
        print("  ✅ Created Program 'PRG_SUN_SUSTAINING'")
        programs["SUN"] = "PRG_SUN_SUSTAINING"

    return programs


def upsert_matrix_projects(db, matrix_data: list, funding_entity_id: str, program_id: str, project_type_id: str) -> tuple:
    """
    Upsert matrix projects for a given funding entity.
    - If project doesn't exist: CREATE it
    - If project exists: UPDATE to enforce consistency with the standard

    Returns tuple of (created_count, updated_count).
    """
    created_count = 0
    updated_count = 0

    for item in matrix_data:
        # Check if project already exists by code
        existing = db.query(Project).filter(Project.code == item["code"]).first()

        if existing:
            # Check if update is needed (enforce consistency)
            changes = []

            if existing.name != item["name"]:
                changes.append(f"name: '{existing.name}' → '{item['name']}'")
                existing.name = item["name"]

            if existing.funding_entity_id != funding_entity_id:
                changes.append(f"funding: '{existing.funding_entity_id}' → '{funding_entity_id}'")
                existing.funding_entity_id = funding_entity_id

            if existing.io_category_code != item["io_category"]:
                changes.append(f"io_category: '{existing.io_category_code}' → '{item['io_category']}'")
                existing.io_category_code = item["io_category"]

            if existing.recharge_status != "BILLABLE":
                changes.append(f"recharge_status: '{existing.recharge_status}' → 'BILLABLE'")
                existing.recharge_status = "BILLABLE"

            if existing.project_type_id != project_type_id:
                changes.append(f"project_type: '{existing.project_type_id}' → '{project_type_id}'")
                existing.project_type_id = project_type_id

            if existing.program_id != program_id:
                changes.append(f"program: '{existing.program_id}' → '{program_id}'")
                existing.program_id = program_id

            if changes:
                updated_count += 1
                print(f"    🔄 Updated {item['code']}: {', '.join(changes)}")
            else:
                print(f"    ✓ {item['code']} already consistent: {existing.name}")
        else:
            # Create new project
            project = Project(
                id=generate_uuid(),
                code=item["code"],
                name=item["name"],
                program_id=program_id,
                project_type_id=project_type_id,
                status="InProgress",
                category="FUNCTIONAL",  # Sustaining projects are functional
                funding_entity_id=funding_entity_id,
                recharge_status="BILLABLE",
                io_category_code=item["io_category"],
                is_capitalizable=False,  # OPEX, not CAPEX
                description=f"Matrix IO: {item['note']}" if item["note"] else f"Standard {funding_entity_id.replace('ENTITY_', '')} sustaining bucket",
            )
            db.add(project)
            created_count += 1
            print(f"    ✅ Created {item['code']}: {item['name']}")

    db.commit()
    return created_count, updated_count


def find_legacy_candidates(db):
    """
    Find projects that are potential legacy candidates for migration/closure.

    Criteria:
    - is_active is True (we only care about active projects)
    - Code does NOT start with "VSS" AND does NOT start with "SUN" (exclude new matrix buckets)
    - project_type_id is "SUSTAINING" OR name contains "Support"/"General"/"Admin"

    This identifies old unstructured support projects that should eventually be migrated.
    """
    print("\n" + "=" * 80)
    print("LEGACY CANDIDATE ANALYSIS (Read-Only)")
    print("=" * 80)
    print()

    # Raw SQL for flexible pattern matching with refined criteria
    result = db.execute(text("""
        SELECT
            p.code,
            p.name,
            p.funding_entity_id,
            p.status,
            p.recharge_status,
            pt.name as project_type,
            p.project_type_id
        FROM projects p
        LEFT JOIN project_types pt ON p.project_type_id = pt.id
        WHERE p.code NOT LIKE 'VSS%'
          AND p.code NOT LIKE 'SUN%'
          AND (
              p.project_type_id = 'SUSTAINING'
              OR LOWER(p.name) LIKE '%support%'
              OR LOWER(p.name) LIKE '%general%'
              OR LOWER(p.name) LIKE '%admin%'
          )
        ORDER BY p.project_type_id DESC, p.code
    """))

    rows = result.fetchall()

    if not rows:
        print("No legacy candidates found matching criteria.")
        print()
        print("Criteria: Active projects where:")
        print("  - Code does NOT start with 'VSS' or 'SUN'")
        print("  - project_type_id = 'SUSTAINING' OR name contains 'Support'/'General'/'Admin'")
        return

    print(f"Found {len(rows)} legacy candidate(s):")
    print()
    print("Criteria: Code ≠ VSS*/SUN* AND (type=SUSTAINING OR name matches Support/General/Admin)")
    print()
    print(f"{'Code':<20} {'Name':<40} {'Type':<12} {'Funding':<15} {'Status':<12}")
    print("-" * 99)

    for row in rows:
        code = row[0] or "N/A"
        name = (row[1] or "N/A")[:38]
        funding = row[2] or "UNASSIGNED"
        status = row[3] or "N/A"
        proj_type = row[6] or "N/A"  # project_type_id

        print(f"{code:<20} {name:<40} {proj_type:<12} {funding:<15} {status:<12}")

    print()
    print("⚠️  These projects are candidates for review. NO CHANGES MADE.")
    print("    Next steps:")
    print("    1. Review each project to determine the correct target matrix bucket")
    print("    2. Migrate worklogs from legacy → matrix projects")
    print("    3. Deactivate legacy projects after migration is complete")


def main():
    print("=" * 80)
    print("SUSTAINING MATRIX SEEDING v2")
    print("The Matrix Reset - Creating Standard IO Buckets")
    print("=" * 80)
    print()

    SessionLocal = get_session_local()
    db = SessionLocal()

    try:
        # Step 1: Ensure prerequisites
        print("Step 1: Ensuring prerequisites...")
        print("-" * 40)
        project_type_id = ensure_project_type(db)
        programs = ensure_programs(db)
        print()

        # Step 2: Upsert VSS Matrix Projects
        print("Step 2: Upserting VSS Matrix Projects...")
        print("-" * 40)
        vss_created, vss_updated = upsert_matrix_projects(
            db,
            VSS_MATRIX,
            funding_entity_id="ENTITY_VSS",
            program_id=programs["VSS"],
            project_type_id=project_type_id
        )
        print()

        # Step 3: Upsert SUN Matrix Projects
        print("Step 3: Upserting SUN Matrix Projects...")
        print("-" * 40)
        sun_created, sun_updated = upsert_matrix_projects(
            db,
            SUN_MATRIX,
            funding_entity_id="ENTITY_SUN",
            program_id=programs["SUN"],
            project_type_id=project_type_id
        )
        print()

        # Summary
        total_created = vss_created + sun_created
        total_updated = vss_updated + sun_updated
        print("=" * 80)
        print("UPSERT SUMMARY")
        print("=" * 80)
        print(f"✅ Created {total_created} new matrix projects.")
        print(f"   - VSS: {vss_created} created")
        print(f"   - SUN: {sun_created} created")
        print()
        print(f"🔄 Updated {total_updated} existing projects to enforce consistency.")
        print(f"   - VSS: {vss_updated} updated")
        print(f"   - SUN: {sun_updated} updated")
        print("=" * 80)

        # Step 4: Legacy Candidate Analysis
        find_legacy_candidates(db)

        print()
        print("Done! The target state buckets are ready for worklog migration.")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
