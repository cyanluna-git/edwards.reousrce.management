"""
Seed script for Support Projects and RechargeIO ↔ BusinessUnit mappings
Based on Work Type classification document (docs/recharge-io-reference.md)
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_session_local
from app.models.project import Project, Program
from app.models.recharge_io import RechargeIO
from app.models.organization import BusinessUnit


# Support Projects - 비프로젝트 상시 업무
SUPPORT_PROJECTS = [
    {
        "name": "Pre-Gate Support",
        "category": "SUPPORT",
        "status": "InProgress",
        "description": "NPI PRJ 사전 검토 업무. DPM, PM 등의 Support 요청부터 PRJ NO 발행까지.",
    },
    {
        "name": "SUN Operations Support",
        "category": "SUPPORT",
        "status": "InProgress",
        "description": "ME/QC Project & Support. 제조/품질 업무 지원, Engineering 주관 외 프로젝트 (OQC, Python Project 등).",
    },
    {
        "name": "SUN Product Improvement",
        "category": "SUPPORT",
        "status": "InProgress",
        "description": "ETO Project, Legacy HVM CIP. Global EC 통한 양산 장비 CIP 대응.",
    },
    {
        "name": "VSS Product Improvement",
        "category": "SUPPORT",
        "status": "InProgress",
        "description": "Legacy Service Update. 서비스/고객 추가 요구사항 Update, SCO 기반 개선.",
    },
    {
        "name": "VSS Sales/Service Support",
        "category": "SUPPORT",
        "status": "InProgress",
        "description": "Sales/Service 업무 지원. 설계자료 전달, 문서 대응, 현장 이슈 문의 대응.",
    },
]


# RechargeIO ↔ BusinessUnit mappings
# io_number -> [bu_code, bu_code, ...]
RECHARGE_IO_BU_MAPPINGS = {
    # ABT/IS 공용
    "407278": ["ABT", "IS"],  # SUN Operations Support
    "407279": ["ABT", "IS"],  # SUN Product Improvement
    "407328": ["ABT", "IS"],  # VSS Product Improvement
    "407331": ["ABT", "IS"],  # VSS Sales/Service Support
    # ACM 전용
    "407327": ["ACM"],  # SUN Operations Support
    "407296": ["ACM"],  # SUN Product Improvement
    "407332": ["ACM"],  # VSS Support (공용)
}


def seed_support_projects(db):
    """Seed Support Projects"""
    print("\n=== Support Projects 생성 ===")

    # Get or create a default program for support projects
    support_program = db.query(Program).filter(Program.id == "PRG_SUPPORT").first()
    if not support_program:
        # Find any existing BU to assign
        bu = db.query(BusinessUnit).first()
        if bu:
            support_program = Program(
                id="PRG_SUPPORT",
                name="Support Activities",
                business_unit_id=bu.id,
                description="비프로젝트 상시 지원 업무",
                is_active=True,
            )
            db.add(support_program)
            db.flush()
            print(f"  [CREATE] Program: PRG_SUPPORT")

    created = 0
    skipped = 0

    for proj_data in SUPPORT_PROJECTS:
        existing = db.query(Project).filter(
            Project.name == proj_data["name"],
            Project.category == "SUPPORT"
        ).first()

        if existing:
            print(f"  [SKIP] {proj_data['name']} (already exists)")
            skipped += 1
            continue

        project = Project(
            name=proj_data["name"],
            category=proj_data["category"],
            status=proj_data["status"],
            description=proj_data["description"],
            # program_id and project_type_id removed - no longer used
        )
        db.add(project)
        print(f"  [CREATE] {proj_data['name']}")
        created += 1

    db.commit()
    print(f"  완료: {created}개 생성, {skipped}개 건너뜀")


def seed_recharge_io_bu_mappings(db):
    """Seed RechargeIO ↔ BusinessUnit mappings"""
    print("\n=== RechargeIO ↔ BusinessUnit 매핑 ===")

    # Get all BUs
    bus = {bu.code: bu for bu in db.query(BusinessUnit).all()}
    print(f"  Found {len(bus)} Business Units: {list(bus.keys())}")

    updated = 0
    skipped = 0

    for io_number, bu_codes in RECHARGE_IO_BU_MAPPINGS.items():
        recharge_io = db.query(RechargeIO).filter(RechargeIO.io_number == io_number).first()

        if not recharge_io:
            print(f"  [SKIP] IO {io_number} not found in database")
            skipped += 1
            continue

        # Clear existing mappings and add new ones
        current_bu_codes = [bu.code for bu in recharge_io.business_units]

        if set(current_bu_codes) == set(bu_codes):
            print(f"  [SKIP] {io_number} - already mapped to {bu_codes}")
            skipped += 1
            continue

        recharge_io.business_units.clear()
        for bu_code in bu_codes:
            if bu_code in bus:
                recharge_io.business_units.append(bus[bu_code])

        print(f"  [UPDATE] {io_number} -> {bu_codes}")
        updated += 1

    db.commit()
    print(f"  완료: {updated}개 업데이트, {skipped}개 건너뜀")


def main():
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        seed_support_projects(db)
        seed_recharge_io_bu_mappings(db)
        print("\n✅ 모든 시드 데이터 완료!")
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
