"""
Seed data for Work Type Categories
Run this script to populate L1 and L2 categories
"""

from sqlalchemy.orm import Session
from app.models.work_type import WorkTypeCategory, WorkTypeLegacyMapping


# L1 대분류 (8개)
L1_CATEGORIES = [
    {
        "code": "ENG",
        "name": "Engineering",
        "name_ko": "엔지니어링",
        "description": "설계, 개발, 테스트 등 기술 업무",
        "sort_order": 1,
    },
    {
        "code": "PRJ",
        "name": "Project Execution",
        "name_ko": "프로젝트 실행",
        "description": "프로젝트 관리, 협업, 미팅",
        "sort_order": 2,
    },
    {
        "code": "OPS",
        "name": "Operations",
        "name_ko": "운영",
        "description": "현장/Shopfloor, 생산 지원",
        "sort_order": 3,
    },
    {
        "code": "QMS",
        "name": "Quality & Compliance",
        "name_ko": "품질/규정준수",
        "description": "품질, 인증, 안전",
        "sort_order": 4,
    },
    {
        "code": "KNW",
        "name": "Knowledge Work",
        "name_ko": "지식업무",
        "description": "문서화, 학습, 연구",
        "sort_order": 5,
    },
    {
        "code": "SUP",
        "name": "Support & Service",
        "name_ko": "지원/서비스",
        "description": "고객지원, 필드서비스",
        "sort_order": 6,
    },
    {
        "code": "ADM",
        "name": "Administration",
        "name_ko": "행정",
        "description": "행정, 이메일, 기타",
        "sort_order": 7,
    },
    {
        "code": "ABS",
        "name": "Absence",
        "name_ko": "부재",
        "description": "휴가, 휴직, 교육훈련",
        "sort_order": 8,
    },
]

# L2 소분류 (parent_code → list of L2s)
L2_CATEGORIES = {
    "ENG": [
        {
            "code": "ENG-DES",
            "name": "Design & Development",
            "name_ko": "설계/개발",
            "sort_order": 1,
        },
        {
            "code": "ENG-SIM",
            "name": "Simulation & Analysis",
            "name_ko": "시뮬레이션/분석",
            "sort_order": 2,
        },
        {
            "code": "ENG-SW",
            "name": "Software Development",
            "name_ko": "소프트웨어 개발",
            "sort_order": 3,
            "applicable_roles": "SW_ENGINEER,SYSTEM_ENGINEER",
        },
        {
            "code": "ENG-HW",
            "name": "Hardware & Electronics",
            "name_ko": "하드웨어/전자",
            "sort_order": 4,
            "applicable_roles": "EE_ENGINEER",
        },
        {
            "code": "ENG-VV",
            "name": "Verification & Validation",
            "name_ko": "검증/확인",
            "sort_order": 5,
        },
        {
            "code": "ENG-PRO",
            "name": "Prototyping & Build",
            "name_ko": "프로토타입/제작",
            "sort_order": 6,
        },
    ],
    "PRJ": [
        {
            "code": "PRJ-MTG",
            "name": "Meeting & Collaboration",
            "name_ko": "미팅/협업",
            "sort_order": 1,
        },
        {
            "code": "PRJ-PLN",
            "name": "Planning & Scheduling",
            "name_ko": "계획/일정관리",
            "sort_order": 2,
            "applicable_roles": "PM,LEAD",
        },
        {
            "code": "PRJ-REV",
            "name": "Review & Approval",
            "name_ko": "검토/승인",
            "sort_order": 3,
        },
        {
            "code": "PRJ-MGT",
            "name": "Team Management",
            "name_ko": "팀 관리",
            "sort_order": 4,
            "applicable_roles": "MANAGER,LEAD",
        },
        {"code": "PRJ-REP", "name": "Reporting", "name_ko": "보고", "sort_order": 5},
    ],
    "OPS": [
        {
            "code": "OPS-LAB",
            "name": "Lab & Test Setup",
            "name_ko": "Lab/테스트 셋업",
            "sort_order": 1,
        },
        {
            "code": "OPS-FAC",
            "name": "Factory Support",
            "name_ko": "공장 지원",
            "sort_order": 2,
        },
        {
            "code": "OPS-EQP",
            "name": "Equipment Maintenance",
            "name_ko": "장비 유지보수",
            "sort_order": 3,
        },
        {
            "code": "OPS-INS",
            "name": "Installation & Commissioning",
            "name_ko": "설치/시운전",
            "sort_order": 4,
        },
    ],
    "QMS": [
        {
            "code": "QMS-QA",
            "name": "Quality Assurance",
            "name_ko": "품질보증",
            "sort_order": 1,
        },
        {
            "code": "QMS-QC",
            "name": "Quality Control",
            "name_ko": "품질관리",
            "sort_order": 2,
        },
        {
            "code": "QMS-SAF",
            "name": "Safety & EHS",
            "name_ko": "안전/환경보건",
            "sort_order": 3,
        },
        {
            "code": "QMS-CMP",
            "name": "Compliance & Certification",
            "name_ko": "규정준수/인증",
            "sort_order": 4,
        },
    ],
    "KNW": [
        {
            "code": "KNW-DOC",
            "name": "Documentation",
            "name_ko": "문서작성",
            "sort_order": 1,
        },
        {"code": "KNW-TRN", "name": "Training", "name_ko": "교육", "sort_order": 2},
        {
            "code": "KNW-STD",
            "name": "Self-Study",
            "name_ko": "자기학습",
            "sort_order": 3,
        },
        {
            "code": "KNW-RND",
            "name": "Research & Investigation",
            "name_ko": "연구/조사",
            "sort_order": 4,
        },
    ],
    "SUP": [
        {
            "code": "SUP-CST",
            "name": "Customer Support",
            "name_ko": "고객지원",
            "sort_order": 1,
        },
        {
            "code": "SUP-FLD",
            "name": "Field Service",
            "name_ko": "필드서비스",
            "sort_order": 2,
        },
        {
            "code": "SUP-TKT",
            "name": "Ticket/Issue Resolution",
            "name_ko": "이슈처리",
            "sort_order": 3,
        },
    ],
    "ADM": [
        {
            "code": "ADM-EML",
            "name": "Email & Communication",
            "name_ko": "이메일/커뮤니케이션",
            "sort_order": 1,
        },
        {
            "code": "ADM-GEN",
            "name": "General Admin",
            "name_ko": "일반행정",
            "sort_order": 2,
        },
        {"code": "ADM-PRC", "name": "Procurement", "name_ko": "구매", "sort_order": 3},
    ],
    "ABS": [
        {"code": "ABS-LVE", "name": "Leave", "name_ko": "휴가", "sort_order": 1},
        {"code": "ABS-SIC", "name": "Sick Leave", "name_ko": "병가", "sort_order": 2},
        {
            "code": "ABS-TRN",
            "name": "Training Leave",
            "name_ko": "교육휴가",
            "sort_order": 3,
        },
        {
            "code": "ABS-ETC",
            "name": "Other Absence",
            "name_ko": "기타부재",
            "sort_order": 4,
        },
    ],
}

# Legacy work_type → L2 mapping
LEGACY_MAPPINGS = {
    "Meeting": "PRJ-MTG",
    "Design": "ENG-DES",
    "Documentation": "KNW-DOC",
    "Leave": "ABS-LVE",
    "Verification & Validation": "ENG-VV",
    "Review": "PRJ-REV",
    "Training": "KNW-TRN",
    "SW Develop": "ENG-SW",
    "Field/Shopfloor Work": "OPS-LAB",
    "Management": "PRJ-MGT",
    "Self-Study": "KNW-STD",
    "Email": "ADM-EML",
    "Customer Support": "SUP-CST",
    "Research": "KNW-RND",
    "QA/QC": "QMS-QA",
    "Administrative work": "ADM-GEN",
    "Safety": "QMS-SAF",
    "Workshop": "KNW-TRN",
    "Compliances": "QMS-CMP",
    "Other": "ADM-GEN",
}


def seed_work_type_categories(db: Session):
    """Seed work type categories and legacy mappings"""

    # Check if already seeded
    existing = db.query(WorkTypeCategory).first()
    if existing:
        print("Work type categories already exist. Skipping seed.")
        return

    print("Seeding work type categories...")

    # Create L1 categories
    l1_map = {}
    for l1_data in L1_CATEGORIES:
        l1 = WorkTypeCategory(
            code=l1_data["code"],
            name=l1_data["name"],
            name_ko=l1_data["name_ko"],
            description=l1_data["description"],
            level=1,
            sort_order=l1_data["sort_order"],
        )
        db.add(l1)
        db.flush()  # Get ID
        l1_map[l1_data["code"]] = l1.id
        print(f"  Created L1: {l1.code} - {l1.name}")

    # Create L2 categories
    l2_map = {}
    for l1_code, l2_list in L2_CATEGORIES.items():
        parent_id = l1_map.get(l1_code)
        for l2_data in l2_list:
            l2 = WorkTypeCategory(
                code=l2_data["code"],
                name=l2_data["name"],
                name_ko=l2_data["name_ko"],
                level=2,
                parent_id=parent_id,
                sort_order=l2_data["sort_order"],
                applicable_roles=l2_data.get("applicable_roles"),
            )
            db.add(l2)
            db.flush()
            l2_map[l2_data["code"]] = l2.id
            print(f"    Created L2: {l2.code} - {l2.name}")

    # Create legacy mappings
    for legacy_type, l2_code in LEGACY_MAPPINGS.items():
        category_id = l2_map.get(l2_code)
        if category_id:
            mapping = WorkTypeLegacyMapping(
                legacy_work_type=legacy_type,
                category_id=category_id,
            )
            db.add(mapping)
            print(f"  Mapped: '{legacy_type}' → {l2_code}")

    db.commit()
    print(
        f"✅ Seeded {len(l1_map)} L1 categories, {len(l2_map)} L2 categories, {len(LEGACY_MAPPINGS)} legacy mappings"
    )


if __name__ == "__main__":
    from app.core.database import get_engine
    from sqlalchemy.orm import sessionmaker

    engine = get_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        seed_work_type_categories(db)
    finally:
        db.close()
