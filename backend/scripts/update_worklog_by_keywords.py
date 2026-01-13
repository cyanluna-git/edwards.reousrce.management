"""
Update worklog project mappings based on title/description keywords.

This script maps worklogs currently in General/Non-Project to appropriate projects
based on keyword matching in the description field.
"""

import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:password@localhost:5434/edwards"
)

# Keyword to project mapping rules
# Format: (keyword_pattern, project_code, priority)
# Higher priority = checked first (for overlapping keywords)
KEYWORD_MAPPINGS = [
    # Specific project keywords (high priority)
    ("OQC", "888888-160", 100),  # 2510 OQC Digitalization Infrastructure
    ("TUMALO", "406437", 90),  # 2025 EUV Gen4 Phase 1 Tumalo
    ("HAVASU", "406399", 90),  # 2025 Havasu
    ("RUBY", "406397", 90),  # 2025 Ruby - SIC integration
    ("PFAS", "406704", 90),  # 2025 PFAS TF
    ("SAP INTEGRATION", "406546", 85),  # SAP Integration
    ("SAP ", "406546", 80),  # SAP related

    # TFT (medium-high priority)
    ("TFT", "PRJ-40", 75),  # TFT
    ("COST REDUCTION TFT", "PRJ-102", 76),  # EUV Cost Reduction TFT

    # TOP Projects
    ("TOP400", "407183", 70),  # 2510 TOP400 SLED
    ("TOP150", "406435-69", 70),  # 2510 LPLN TOP150 DUAL HVM

    # Unify/Plasma
    ("UNIFY PLASMA", "407053", 65),  # 2506 Unify Plasma Single
    ("UNIFY", "407053", 64),
    ("PLASMA SINGLE", "407053", 63),
    ("SDC PLASMA", "407052", 62),  # 2506 SDC Plasma Single Etch

    # Gen3/Gen4 EUV
    ("GEN4 PHASE 2", "407039", 60),  # 2025 EUV Gen4 Phase 2 Tumalo
    ("GEN4 PHASE 1", "406437", 59),  # 2025 EUV Gen4 Phase 1 Tumalo
    ("GEN4", "406437", 55),  # Default Gen4 to Phase 1
    ("GEN3 PLUS MICRON", "406886-120", 58),  # 2025 EUV Gen3 Plus Micron ID
    ("GEN3+ MICRON", "406886-120", 58),
    ("GEN3 RAPIDUS", "406886", 57),  # Gen3+ Rapidus
    ("GEN3+", "406886", 56),  # Default Gen3+ to Rapidus
    ("GEN3", "406886", 54),

    # H2D/HRS
    ("H2D-HP", "406365", 52),  # 2025 High Performance H2D (1000slm)
    ("H2D HP", "406365", 52),
    ("HIGH PERFORMANCE H2D", "406365", 53),
    ("HRS TRANSITION", "407057-166", 51),  # 2512 HRS Transition
    ("HRS", "406403", 50),  # 2025 Hydrogen Recycling System_KR
    ("H2D 500", "405742", 49),  # H2D 500
    ("H2D", "406365", 48),  # Default H2D

    # Proteus/Protron (Abatement)
    ("PROTRON FIELD CIP", "407266", 47),  # 2512 Protron Field CIP
    ("PROTRON SINGLE ETCH", "406371", 46),  # 2025 PROTRON Single Etch
    ("PROTRON SINGLE ROW", "406420", 45),  # 2025 Protron | Single ROW
    ("PROTRON DUAL ROW", "406363-59", 44),  # 2025 Protron | Dual CVD | PROTRON _ Dual ROW
    ("PROTRON DUAL", "406363", 43),  # Protron | Dual CVD | Abingdon PLC
    ("PROTRON", "406420", 42),  # Default Protron to Single ROW
    ("PROTEUS PYTHON", "PRJ-76", 41),  # Proteus Python Simautor
    ("PROTEUS LEGACY", "406428-18", 40),  # Proteus Legacy Support
    ("PROTEUS", "406428", 39),  # Default Proteus to Proteus HV

    # ACM
    ("ACM NPI", "PRJ-112", 38),  # ACM NPI
    ("ACM ETO", "PRJ-113", 37),  # ACM ETO
    ("ACM CR", "PRJ-119", 36),  # ACM CR (Cost Reduction)
    ("ACM COST REDUCTION", "PRJ-119", 36),
    ("ACM AUDIT", "PRJ-117", 35),  # ACM Audit
    ("ACM ENGINEERING", "PRJ-116", 34),  # ACM Engineering Support
    ("ACM PRE-GATE", "407056", 33),  # ACM Pre-Gate1 Support
    ("DTLR", "PRJ-112", 32),  # ACM related
    ("ARS", "PRJ-112", 31),  # ACM related
    ("ACM", "PRJ-112", 30),  # Default ACM to ACM NPI

    # Abatement
    ("ABATEMENT ETO", "406428-37", 29),  # Abatement ETO Support
    ("ABATEMENT TSG", "PRJ-38", 28),  # Abatement TSG Support
    ("ARECA", "406428", 27),  # Abatement/Proteus related
    ("FOREST", "406428", 26),  # Abatement related
    ("ABATEMENT", "406428-37", 25),  # Default Abatement

    # EUV General
    ("EUV TSG", "PRJ-36", 24),  # EUV TSG Support
    ("EUV ETO", "404721", 23),  # EUV ETO Support
    ("EUV GENERAL", "406442", 22),  # EUV General
    ("EUV COST REDUCTION", "PRJ-102", 21),  # EUV Cost Reduction TFT

    # Sustaining categories (lower priority - catch-all)
    ("FIELD FAILURE", "888888", 15),  # Sustaining _ Field failure corrective action
    ("FACTORY SUPPORT", "888888-152", 14),  # Sustaining _ Ops/Factory support
    ("PRODUCT IMPROVEMENT", "888888-153", 13),  # Sustaining _ Product improvement
    ("PK COST REDUCTION", "888888-154", 12),  # Sustaining _ PK cost reduction
    ("REGULATORY", "888888-155", 11),  # Sustaining _ Product regulatory & compliance
    ("COMPLIANCE", "888888-155", 11),
    ("SERVICE SUPPORT", "888888-156", 10),  # Sustaining _ Service/sales support
    ("SALES SUPPORT", "888888-156", 10),
    ("SUSTAINING", "888888", 9),  # Default Sustaining
]


def get_project_uuid_by_code(session) -> dict:
    """Get project code -> UUID mapping"""
    result = session.execute(text("SELECT id, code, name FROM projects"))
    mapping = {}
    for row in result:
        project_id, code, name = row
        mapping[code] = {"id": project_id, "name": name}
    return mapping


def get_general_project_worklogs(session, general_project_id: str) -> list:
    """Get all worklogs in General/Non-Project"""
    result = session.execute(text("""
        SELECT id, description FROM worklogs
        WHERE project_id = :project_id
    """), {"project_id": general_project_id})

    worklogs = []
    for row in result:
        worklogs.append({"id": row[0], "description": row[1] or ""})
    return worklogs


def match_keyword(description: str, keyword_mappings: list) -> tuple:
    """Match description against keyword rules, return (project_code, keyword) or (None, None)"""
    desc_upper = description.upper()

    # Sort by priority (highest first)
    sorted_mappings = sorted(keyword_mappings, key=lambda x: -x[2])

    for keyword, project_code, priority in sorted_mappings:
        if keyword in desc_upper:
            return project_code, keyword

    return None, None


def analyze_matches(worklogs: list, keyword_mappings: list, project_mapping: dict):
    """Analyze keyword matches without updating"""
    matches = defaultdict(list)
    no_match = []

    for wl in worklogs:
        project_code, keyword = match_keyword(wl["description"], keyword_mappings)
        if project_code:
            proj_info = project_mapping.get(project_code, {"name": "UNKNOWN"})
            matches[project_code].append({
                "id": wl["id"],
                "description": wl["description"][:60],
                "keyword": keyword,
                "project_name": proj_info["name"]
            })
        else:
            no_match.append(wl)

    return matches, no_match


def update_worklogs(session, worklogs: list, keyword_mappings: list,
                   project_mapping: dict, dry_run: bool = True):
    """Update worklog project_id based on keyword matches"""

    matches, no_match = analyze_matches(worklogs, keyword_mappings, project_mapping)

    # Summary
    print(f"\n=== Keyword Matching Results ===")
    print(f"Total worklogs in General/Non-Project: {len(worklogs)}")
    print(f"Matched by keywords: {sum(len(v) for v in matches.values())}")
    print(f"No match (remaining): {len(no_match)}")

    print(f"\n=== Matches by Project ===")
    sorted_matches = sorted(matches.items(), key=lambda x: -len(x[1]))
    for project_code, items in sorted_matches[:25]:
        proj_info = project_mapping.get(project_code, {"name": "UNKNOWN"})
        print(f"  {project_code} ({proj_info['name'][:40]}): {len(items)} worklogs")
        # Show sample matches
        for item in items[:2]:
            print(f"    - [{item['keyword']}] {item['description']}")

    if len(sorted_matches) > 25:
        print(f"  ... and {len(sorted_matches) - 25} more projects")

    # Prepare updates
    updates = []
    for project_code, items in matches.items():
        proj_info = project_mapping.get(project_code)
        if not proj_info:
            print(f"  WARNING: Project code {project_code} not found in database!")
            continue

        for item in items:
            updates.append({
                "worklog_id": item["id"],
                "new_project_id": proj_info["id"],
                "project_code": project_code
            })

    if not dry_run and updates:
        print(f"\n=== Executing {len(updates)} updates ===")
        batch_size = 1000
        for i in range(0, len(updates), batch_size):
            batch = updates[i:i+batch_size]
            for u in batch:
                session.execute(text("""
                    UPDATE worklogs SET project_id = :new_project_id
                    WHERE id = :worklog_id
                """), {"new_project_id": u["new_project_id"], "worklog_id": u["worklog_id"]})

            session.commit()
            print(f"  Updated batch {i//batch_size + 1}/{(len(updates) + batch_size - 1)//batch_size}")

        print("Updates completed!")
    elif dry_run:
        print(f"\n[DRY RUN] No changes made. Run with --execute to apply {len(updates)} updates.")

    return updates, no_match


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Update worklog projects by keyword matching")
    parser.add_argument("--execute", action="store_true", help="Actually execute updates")
    parser.add_argument("--show-unmatched", action="store_true", help="Show sample unmatched descriptions")
    args = parser.parse_args()

    print("Connecting to database...")
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Get project mapping
        project_mapping = get_project_uuid_by_code(session)
        print(f"Loaded {len(project_mapping)} projects from database")

        # Get General/Non-Project ID
        general_result = session.execute(text(
            "SELECT id FROM projects WHERE code = 'PRJ-14' LIMIT 1"
        ))
        general_project_id = general_result.scalar()
        print(f"General/Non-Project ID: {general_project_id}")

        # Get worklogs in General/Non-Project
        worklogs = get_general_project_worklogs(session, general_project_id)
        print(f"Found {len(worklogs)} worklogs in General/Non-Project")

        # Update worklogs
        updates, no_match = update_worklogs(
            session, worklogs, KEYWORD_MAPPINGS,
            project_mapping, dry_run=not args.execute
        )

        if args.show_unmatched:
            print(f"\n=== Sample Unmatched Descriptions ===")
            # Group by common patterns
            from collections import Counter
            words = []
            for wl in no_match[:1000]:
                desc = wl["description"].upper()
                for word in desc.split():
                    if len(word) > 3 and word.isalpha():
                        words.append(word)

            common = Counter(words).most_common(30)
            print("Common words in unmatched descriptions:")
            for word, count in common:
                print(f"  {word}: {count}")

            print("\nSample unmatched descriptions:")
            for wl in no_match[:20]:
                print(f"  - {wl['description'][:80]}")

    finally:
        session.close()


if __name__ == "__main__":
    main()
