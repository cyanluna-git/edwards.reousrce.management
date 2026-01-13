"""
Update worklog work_type_category_id based on CSV Worktype.Id mapping
and description-based inference.
"""

import csv
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:password@localhost:5434/edwards"
)

# CSV Worktype.Id -> DB work_type_category code mapping
CSV_WORKTYPE_MAPPING = {
    "1": "ENG-DES",      # Design/설계
    "2": "OPS-LAB",      # Test/실험
    "3": "ENG-SW",       # Tool/SW 관련
    "4": "KNW-DOC",      # Documentation/문서작성
    "5": "PRJ-REV",      # Review/검토
    "6": "PRJ-MTG",      # Meeting/미팅
    "7": "ADM-GEN",      # ETC/기타
    "8": "PRJ-MGT",      # Management/관리
    "9": "OPS-LAB",      # Field/Shopfloor
    "10": "KNW-TRN",     # Event/행사 (Townhall, Seminar)
    "11": "SUP-TKT",     # Support/지원
    "12": "KNW-STD",     # Self Study/자기학습
    "13": "ADM-EML",     # Email/Communication
    "14": "SUP-CST",     # Customer Support/고객지원
    "15": "KNW-TRN",     # Training/교육
    "17": "ADM-GEN",     # ETC 행정
    "18": "QMS-CMP",     # Compliance/규정
    "19": "ENG-SIM",     # Analysis/분석
    "20": "OPS-LAB",     # Lab 관리
}

# Description-based keyword mapping for additional inference
# Format: (keyword, category_code, priority)
DESCRIPTION_WORKTYPE_MAPPINGS = [
    # Engineering - Design
    ("DESIGN REVIEW", "ENG-DES-REV", 100),
    ("DR MEETING", "ENG-DES-REV", 99),
    ("PDR", "ENG-DES-REV", 98),
    ("CDR", "ENG-DES-REV", 98),
    ("설계 리뷰", "ENG-DES-REV", 97),
    ("CONCEPT DESIGN", "ENG-DES-CON", 96),
    ("FEASIBILITY", "ENG-DES-CON", 95),
    ("선행", "ENG-DES-CON", 94),
    ("DETAILED DESIGN", "ENG-DES-DTL", 93),
    ("상세 설계", "ENG-DES-DTL", 92),
    ("SCHEMATIC", "ENG-DES", 85),
    ("CIRCUIT DESIGN", "ENG-DES", 84),
    ("회로 설계", "ENG-DES", 83),
    ("DRAWING", "ENG-DES", 82),
    ("도면", "ENG-DES", 81),
    ("P&ID", "ENG-DES", 80),
    ("CAD", "ENG-DES", 79),
    ("3D MODEL", "ENG-DES", 78),

    # Engineering - Software
    ("CODING", "ENG-SW-COD", 90),
    ("코딩", "ENG-SW-COD", 89),
    ("IMPLEMENTATION", "ENG-SW-COD", 88),
    ("구현", "ENG-SW-COD", 87),
    ("DEBUGGING", "ENG-SW-DBG", 86),
    ("디버깅", "ENG-SW-DBG", 85),
    ("UNIT TEST", "ENG-SW-TST", 84),
    ("단위 테스트", "ENG-SW-TST", 83),
    ("SOFTWARE DEVELOPMENT", "ENG-SW", 75),
    ("SW DEVELOPMENT", "ENG-SW", 74),
    ("PYTHON", "ENG-SW", 70),
    ("PLC PROGRAM", "ENG-SW", 69),
    ("HMI", "ENG-SW", 68),
    ("MODBUS", "ENG-SW", 67),

    # Engineering - Simulation
    ("SIMULATION", "ENG-SIM", 80),
    ("시뮬레이션", "ENG-SIM", 79),
    ("FEA", "ENG-SIM", 78),
    ("CFD", "ENG-SIM", 77),
    ("ANALYSIS", "ENG-SIM", 70),
    ("분석", "ENG-SIM", 69),
    ("FTIR", "ENG-SIM", 68),

    # Engineering - Verification
    ("VERIFICATION", "ENG-VV", 75),
    ("VALIDATION", "ENG-VV", 74),
    ("검증", "ENG-VV", 73),
    ("FAT", "ENG-VV", 72),
    ("SAT", "ENG-VV", 71),

    # Engineering - Hardware
    ("WIRING", "ENG-HW", 70),
    ("배선", "ENG-HW", 69),
    ("HARNESS", "ENG-HW", 68),
    ("PCB", "ENG-HW", 67),
    ("ELECTRICAL", "ENG-HW", 65),

    # Project - Meetings (more specific)
    ("WEEKLY MEETING", "PRJ-MTG-UPD", 85),
    ("DAILY MEETING", "PRJ-MTG-UPD", 84),
    ("STATUS MEETING", "PRJ-MTG-UPD", 83),
    ("정기 미팅", "PRJ-MTG-UPD", 82),
    ("KICKOFF", "PRJ-MTG-DEC", 81),
    ("킥오프", "PRJ-MTG-DEC", 80),
    ("DECISION", "PRJ-MTG-DEC", 79),
    ("의사결정", "PRJ-MTG-DEC", 78),
    ("CUSTOMER MEETING", "PRJ-MTG-EXT", 77),
    ("고객 미팅", "PRJ-MTG-EXT", 76),
    ("VENDOR MEETING", "PRJ-MTG-EXT", 75),
    ("INTERNAL MEETING", "PRJ-MTG-INT", 74),
    ("내부 미팅", "PRJ-MTG-INT", 73),
    ("TEAM MEETING", "PRJ-MTG-INT", 72),
    ("팀 미팅", "PRJ-MTG-INT", 71),
    ("PROBLEM SOLVING", "PRJ-MTG-PRB", 70),
    ("TROUBLESHOOTING MEETING", "PRJ-MTG-PRB", 69),
    ("이슈 미팅", "PRJ-MTG-PRB", 68),
    ("INFORMATION SHARING", "PRJ-MTG-INF", 67),
    ("정보 공유", "PRJ-MTG-INF", 66),
    ("REPORTING", "PRJ-MTG-REP", 65),
    ("보고", "PRJ-MTG-REP", 64),
    ("FEEDBACK", "PRJ-MTG-FDB", 63),
    ("피드백", "PRJ-MTG-FDB", 62),
    ("[MEETING]", "PRJ-MTG", 50),
    ("미팅", "PRJ-MTG", 49),
    ("MEETING", "PRJ-MTG", 48),
    ("회의", "PRJ-MTG", 47),

    # Project - Review
    ("REVIEW", "PRJ-REV", 60),
    ("검토", "PRJ-REV", 59),
    ("APPROVAL", "PRJ-REV", 58),
    ("승인", "PRJ-REV", 57),

    # Project - Planning
    ("PLANNING", "PRJ-PLN", 55),
    ("계획", "PRJ-PLN", 54),
    ("SCHEDULING", "PRJ-PLN", 53),
    ("일정", "PRJ-PLN", 52),

    # Operations - Lab
    ("LAB TEST", "OPS-LAB", 70),
    ("랩 테스트", "OPS-LAB", 69),
    ("TEST BENCH", "OPS-LAB", 68),
    ("EXPERIMENT", "OPS-LAB", 67),
    ("실험", "OPS-LAB", 66),
    ("LAB SETUP", "OPS-LAB", 65),
    ("FIELD/SHOPFLOOR", "OPS-LAB", 60),

    # Operations - Factory
    ("FACTORY SUPPORT", "OPS-FAC", 70),
    ("공장 지원", "OPS-FAC", 69),
    ("LINE SUPPORT", "OPS-FAC-SUP", 68),
    ("라인 지원", "OPS-FAC-SUP", 67),

    # Operations - Equipment
    ("CALIBRATION", "OPS-EQP-CAL", 75),
    ("캘리브레이션", "OPS-EQP-CAL", 74),
    ("MAINTENANCE", "OPS-EQP-PM", 70),
    ("정비", "OPS-EQP-PM", 69),
    ("PREVENTIVE", "OPS-EQP-PM", 68),
    ("예방정비", "OPS-EQP-PM", 67),
    ("CORRECTIVE", "OPS-EQP-CM", 66),
    ("수리", "OPS-EQP-CM", 65),
    ("TROUBLESHOOTING", "OPS-EQP-TRB", 64),
    ("트러블슈팅", "OPS-EQP-TRB", 63),

    # Operations - Installation
    ("INSTALLATION", "OPS-INS", 60),
    ("설치", "OPS-INS", 59),
    ("COMMISSIONING", "OPS-INS", 58),
    ("시운전", "OPS-INS", 57),

    # Quality
    ("QUALITY ASSURANCE", "QMS-QA", 70),
    ("QA", "QMS-QA", 65),
    ("QUALITY CONTROL", "QMS-QC", 70),
    ("QC", "QMS-QC", 65),
    ("INSPECTION", "QMS-QC", 60),
    ("검사", "QMS-QC", 59),
    ("AUDIT", "QMS-CMP", 70),
    ("감사", "QMS-CMP", 69),
    ("COMPLIANCE", "QMS-CMP", 68),
    ("규정", "QMS-CMP", 67),
    ("CERTIFICATION", "QMS-CMP", 66),
    ("인증", "QMS-CMP", 65),
    ("NRTL", "QMS-CMP", 64),
    ("SAFETY", "QMS-SAF", 60),
    ("안전", "QMS-SAF", 59),
    ("EHS", "QMS-SAF", 58),

    # Knowledge - Documentation
    ("DOCUMENTATION", "KNW-DOC", 65),
    ("문서 작성", "KNW-DOC", 64),
    ("DOCUMENT", "KNW-DOC", 60),
    ("MANUAL", "KNW-DOC", 59),
    ("매뉴얼", "KNW-DOC", 58),
    ("CONFLUENCE", "KNW-DOC", 57),
    ("SPEC 작성", "KNW-DOC", 56),
    ("사양서", "KNW-DOC", 55),

    # Knowledge - Training
    ("TRAINING", "KNW-TRN", 70),
    ("교육", "KNW-TRN", 69),
    ("[TRAINING]", "KNW-TRN", 68),
    ("SEMINAR", "KNW-TRN", 65),
    ("세미나", "KNW-TRN", 64),
    ("TOWNHALL", "KNW-TRN", 63),
    ("ENGINEERING SEMINAR", "KNW-TRN", 62),
    ("민방위", "KNW-TRN", 55),
    ("소방", "KNW-TRN", 54),

    # Knowledge - Self Study
    ("SELF STUDY", "KNW-STD", 70),
    ("자기학습", "KNW-STD", 69),
    ("SELF-STUDY", "KNW-STD", 68),
    ("전화 영어", "KNW-STD", 65),
    ("영어 공부", "KNW-STD", 64),
    ("LEARNING", "KNW-STD", 60),

    # Knowledge - Research
    ("RESEARCH", "KNW-RND", 65),
    ("연구", "KNW-RND", 64),
    ("INVESTIGATION", "KNW-RND", 63),
    ("조사", "KNW-RND", 62),

    # Support - Customer
    ("CUSTOMER SUPPORT", "SUP-CST", 70),
    ("고객 지원", "SUP-CST", 69),
    ("CUSTOMER REQUEST", "SUP-CST", 68),
    ("고객 요청", "SUP-CST", 67),

    # Support - Field
    ("FIELD SERVICE", "SUP-FLD", 70),
    ("필드 서비스", "SUP-FLD", 69),
    ("ON-SITE", "SUP-FLD", 65),
    ("현장", "SUP-FLD", 64),
    ("출장", "SUP-FLD", 60),

    # Support - Issue
    ("ISSUE", "SUP-TKT", 55),
    ("이슈", "SUP-TKT", 54),
    ("TICKET", "SUP-TKT", 53),

    # Administration - Email
    ("MAIL CHECK", "ADM-EML", 70),
    ("메일 확인", "ADM-EML", 69),
    ("EMAIL", "ADM-EML", 65),
    ("이메일", "ADM-EML", 64),

    # Administration - General
    ("[ETC]", "ADM-GEN", 50),
    ("기타", "ADM-GEN", 45),

    # Administration - Procurement
    ("PROCUREMENT", "ADM-PRC", 65),
    ("구매", "ADM-PRC", 64),
    ("PURCHASING", "ADM-PRC", 63),
    ("발주", "ADM-PRC", 62),

    # Absence
    ("휴가", "ABS-LVE", 90),
    ("LEAVE", "ABS-LVE", 89),
    ("VACATION", "ABS-LVE", 88),
    ("연차", "ABS-LVE", 87),
    ("병가", "ABS-SIC", 85),
    ("SICK", "ABS-SIC", 84),
]


def load_user_mapping(csv_path: str) -> dict:
    """Load Person.id -> email mapping"""
    mapping = {}
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            person_id = row.get("Person.id", "").strip()
            email = row.get("email", "").strip().lower()
            if person_id and email:
                mapping[person_id] = email
    return mapping


def load_worklog_csv(csv_path: str) -> list:
    """Load worklogs with worktype info from CSV"""
    worklogs = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            worklogs.append({
                "date": row.get("Date", "").split(" ")[0],
                "hours": float(row.get("Hours", "0") or "0"),
                "title": row.get("Title", "").strip(),
                "worktype_id": row.get("Worktype.Id", "").strip(),
                "createdby_id": row.get("Createdby.Id", "").strip(),
            })
    return worklogs


def get_category_mapping(session) -> dict:
    """Get category code -> id mapping from database"""
    result = session.execute(text("SELECT id, code, name FROM work_type_categories"))
    mapping = {}
    for row in result:
        cat_id, code, name = row
        mapping[code] = {"id": cat_id, "name": name}
    return mapping


def get_email_to_user_mapping(session) -> dict:
    """Get email -> user_id mapping"""
    result = session.execute(text("SELECT id, email FROM users WHERE email IS NOT NULL"))
    mapping = {}
    for row in result:
        user_id, email = row
        if email:
            mapping[email.lower()] = user_id
    return mapping


def match_description_to_category(description: str, keyword_mappings: list) -> tuple:
    """Match description to category using keywords"""
    desc_upper = description.upper()
    sorted_mappings = sorted(keyword_mappings, key=lambda x: -x[2])

    for keyword, category_code, priority in sorted_mappings:
        if keyword in desc_upper:
            return category_code, keyword

    return None, None


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Update worklog work types")
    parser.add_argument("--execute", action="store_true", help="Execute updates")
    parser.add_argument("--csv-only", action="store_true", help="Only do CSV Worktype.Id mapping")
    parser.add_argument("--inference-only", action="store_true", help="Only do description inference")
    args = parser.parse_args()

    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ref_path = os.path.join(base_path, "ref_table")

    worklog_csv = os.path.join(ref_path, "tb_worklog.csv")
    user_csv = os.path.join(ref_path, "db_users.csv")

    print("Loading CSV data...")
    csv_worklogs = load_worklog_csv(worklog_csv)
    user_mapping = load_user_mapping(user_csv)
    print(f"Loaded {len(csv_worklogs)} worklogs from CSV")

    print("\nConnecting to database...")
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        category_mapping = get_category_mapping(session)
        email_to_user = get_email_to_user_mapping(session)
        print(f"Loaded {len(category_mapping)} work type categories")

        # Build DB worklog lookup
        print("\nBuilding worklog lookup from database...")
        result = session.execute(text("""
            SELECT id, date, user_id, hours, description, work_type_category_id
            FROM worklogs
        """))

        db_worklogs = {}
        for row in result:
            wl_id, date, user_id, hours, description, cat_id = row
            key = (str(date), user_id, float(hours), (description or "").strip())
            if key not in db_worklogs:
                db_worklogs[key] = []
            db_worklogs[key].append({
                "id": wl_id,
                "description": description or "",
                "work_type_category_id": cat_id
            })

        print(f"Built lookup with {len(db_worklogs)} unique keys")

        # Phase 1: CSV Worktype.Id mapping
        if not args.inference_only:
            print("\n=== Phase 1: CSV Worktype.Id Mapping ===")
            csv_updates = []
            csv_matched = 0
            csv_no_match = 0
            csv_no_mapping = 0
            distribution = defaultdict(int)

            for csv_wl in csv_worklogs:
                wt_id = csv_wl["worktype_id"]

                if not wt_id or wt_id not in CSV_WORKTYPE_MAPPING:
                    csv_no_mapping += 1
                    continue

                category_code = CSV_WORKTYPE_MAPPING[wt_id]
                if category_code not in category_mapping:
                    csv_no_mapping += 1
                    continue

                category_id = category_mapping[category_code]["id"]

                # Find user
                person_id = csv_wl["createdby_id"]
                user_email = user_mapping.get(person_id)
                if not user_email:
                    csv_no_match += 1
                    continue

                user_id = email_to_user.get(user_email.lower())
                if not user_id:
                    csv_no_match += 1
                    continue

                # Build lookup key
                key = (csv_wl["date"], user_id, csv_wl["hours"], csv_wl["title"])
                db_matches = db_worklogs.get(key, [])

                if not db_matches:
                    csv_no_match += 1
                    continue

                for db_wl in db_matches:
                    csv_matched += 1
                    distribution[category_code] += 1
                    csv_updates.append({
                        "worklog_id": db_wl["id"],
                        "category_id": category_id,
                        "category_code": category_code
                    })

            print(f"Matched: {csv_matched}")
            print(f"No DB match: {csv_no_match}")
            print(f"No worktype mapping: {csv_no_mapping}")

            print(f"\nDistribution by category:")
            for code, count in sorted(distribution.items(), key=lambda x: -x[1])[:15]:
                cat_name = category_mapping.get(code, {}).get("name", "Unknown")
                print(f"  {code} ({cat_name}): {count}")

            if not args.execute:
                print(f"\n[DRY RUN] Would update {len(csv_updates)} worklogs from CSV mapping")
            else:
                print(f"\n=== Executing {len(csv_updates)} CSV-based updates ===")
                batch_size = 1000
                for i in range(0, len(csv_updates), batch_size):
                    batch = csv_updates[i:i+batch_size]
                    for u in batch:
                        session.execute(text("""
                            UPDATE worklogs SET work_type_category_id = :cat_id
                            WHERE id = :wl_id
                        """), {"cat_id": u["category_id"], "wl_id": u["worklog_id"]})
                    session.commit()
                    print(f"  Batch {i//batch_size + 1}/{(len(csv_updates) + batch_size - 1)//batch_size}")
                print("CSV-based updates completed!")

        # Phase 2: Description-based inference for remaining NULL worklogs
        if not args.csv_only:
            print("\n=== Phase 2: Description-based Inference ===")

            # Get worklogs still without category
            result = session.execute(text("""
                SELECT id, description FROM worklogs
                WHERE work_type_category_id IS NULL
            """))

            null_worklogs = []
            for row in result:
                null_worklogs.append({"id": row[0], "description": row[1] or ""})

            print(f"Found {len(null_worklogs)} worklogs without work_type_category")

            inference_updates = []
            inference_distribution = defaultdict(int)
            no_inference = 0

            for wl in null_worklogs:
                category_code, keyword = match_description_to_category(
                    wl["description"], DESCRIPTION_WORKTYPE_MAPPINGS
                )

                if category_code and category_code in category_mapping:
                    category_id = category_mapping[category_code]["id"]
                    inference_updates.append({
                        "worklog_id": wl["id"],
                        "category_id": category_id,
                        "category_code": category_code,
                        "keyword": keyword,
                        "description": wl["description"][:50]
                    })
                    inference_distribution[category_code] += 1
                else:
                    no_inference += 1

            print(f"Matched by inference: {len(inference_updates)}")
            print(f"No match: {no_inference}")

            print(f"\nInference distribution by category:")
            for code, count in sorted(inference_distribution.items(), key=lambda x: -x[1])[:15]:
                cat_name = category_mapping.get(code, {}).get("name", "Unknown")
                print(f"  {code} ({cat_name}): {count}")
                # Show samples
                samples = [u for u in inference_updates if u["category_code"] == code][:2]
                for s in samples:
                    print(f"    [{s['keyword']}] {s['description']}")

            if not args.execute:
                print(f"\n[DRY RUN] Would update {len(inference_updates)} worklogs from inference")
            else:
                print(f"\n=== Executing {len(inference_updates)} inference-based updates ===")
                batch_size = 1000
                for i in range(0, len(inference_updates), batch_size):
                    batch = inference_updates[i:i+batch_size]
                    for u in batch:
                        session.execute(text("""
                            UPDATE worklogs SET work_type_category_id = :cat_id
                            WHERE id = :wl_id
                        """), {"cat_id": u["category_id"], "wl_id": u["worklog_id"]})
                    session.commit()
                    print(f"  Batch {i//batch_size + 1}/{(len(inference_updates) + batch_size - 1)//batch_size}")
                print("Inference-based updates completed!")

        # Final summary
        result = session.execute(text("""
            SELECT
                COALESCE(wtc.code, 'NULL') as code,
                COALESCE(wtc.name, 'No Category') as name,
                COUNT(*) as cnt
            FROM worklogs w
            LEFT JOIN work_type_categories wtc ON w.work_type_category_id = wtc.id
            GROUP BY wtc.code, wtc.name
            ORDER BY cnt DESC
            LIMIT 20
        """))

        print("\n=== Final Work Type Distribution ===")
        for row in result:
            print(f"  {row[0]} ({row[1]}): {row[2]}")

    finally:
        session.close()


if __name__ == "__main__":
    main()
