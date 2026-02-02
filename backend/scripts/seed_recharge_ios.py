"""
Seed script for Recharge IOs
Based on Work Type classification document (docs/recharge-io-reference.md)
"""

import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.recharge_io import RechargeIO


RECHARGE_IOS = [
    # ABT/IS IOs
    {
        "io_number": "407278",
        "name": "[ABT/IS] SUN Operations Support",
        "description": """사용 목적:
• ME/QC Project & Support
• 제조/품질 업무 지원
• Engineering 주관 외 프로젝트 (OQC, Python Project 등)""",
    },
    {
        "io_number": "407279",
        "name": "[ABT/IS] SUN Product Improvement",
        "description": """사용 목적:
• ETO Project
• Legacy HVM CIP
• Global EC 통한 양산 장비 CIP 대응""",
    },
    {
        "io_number": "407328",
        "name": "[ABT/IS] VSS Product Improvement",
        "description": """사용 목적:
• Legacy Service Update
• 서비스/고객 추가 요구사항 Update
• SCO 기반 개선""",
    },
    {
        "io_number": "407331",
        "name": "[ABT/IS] VSS Sales/Service Support",
        "description": """사용 목적:
• Sales/Service Support
• 설계자료 전달
• 문서 대응
• 현장 이슈 문의 대응""",
    },
    # ACM IOs
    {
        "io_number": "407327",
        "name": "[ACM] SUN Operations Support",
        "description": """사용 목적:
• ME/QC Project & Support
• 제조/품질 업무 지원
• Engineering 주관 외 프로젝트 (OQC, Python Project 등)""",
    },
    {
        "io_number": "407296",
        "name": "[ACM] SUN Product Improvement",
        "description": """사용 목적:
• ETO Project
• Legacy HVM CIP
• Global EC 통한 양산 장비 CIP 대응""",
    },
    {
        "io_number": "407332",
        "name": "[ACM] VSS Support (공용)",
        "description": """사용 목적:
• Legacy Service Update
• Sales/Service Support
• 서비스/고객 요구사항 Update
• 설계자료/문서/현장 이슈 대응

※ VSS Product Improvement + Sales/Service Support 공용""",
    },
]


def seed_recharge_ios():
    """Seed Recharge IOs into the database"""
    db = SessionLocal()

    try:
        created = 0
        skipped = 0

        for io_data in RECHARGE_IOS:
            # Check if already exists
            existing = db.query(RechargeIO).filter(
                RechargeIO.io_number == io_data["io_number"]
            ).first()

            if existing:
                print(f"  [SKIP] {io_data['io_number']} - {io_data['name']} (already exists)")
                skipped += 1
                continue

            # Create new Recharge IO
            recharge_io = RechargeIO(
                io_number=io_data["io_number"],
                name=io_data["name"],
                description=io_data["description"],
                is_active=True,
            )
            db.add(recharge_io)
            print(f"  [CREATE] {io_data['io_number']} - {io_data['name']}")
            created += 1

        db.commit()
        print(f"\n완료: {created}개 생성, {skipped}개 건너뜀")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding Recharge IOs...")
    print("-" * 50)
    seed_recharge_ios()
