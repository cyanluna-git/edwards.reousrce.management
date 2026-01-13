"""
Update worklog project mappings from CSV data.

This script maps worklogs to their correct projects using:
1. CSV Project.Id -> IO code (from db_projects.csv)
2. IO code -> Project UUID (from database)
3. Match worklogs by (date, user_id, hours, description)
"""

import csv
import os
import sys
from datetime import datetime
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Database connection
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/edwards"
)


def load_project_id_to_io_mapping(csv_path: str) -> dict:
    """Load CSV Project ID -> IO code mapping from db_projects.csv"""
    mapping = {}
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            csv_id = row.get("ID", "").strip()
            io_code = row.get("IO", "").strip()
            project_name = row.get("Project", "").strip()

            if csv_id and io_code:
                mapping[csv_id] = {
                    "io": io_code,
                    "name": project_name
                }
            elif csv_id:
                # No IO code, just store the name for reference
                mapping[csv_id] = {
                    "io": None,
                    "name": project_name
                }

    print(f"Loaded {len(mapping)} project mappings from CSV")
    return mapping


def load_user_mapping(csv_path: str) -> dict:
    """Load Person.id -> email mapping from db_users.csv"""
    mapping = {}
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            person_id = row.get("Person.id", "").strip()
            email = row.get("email", "").strip().lower()

            if person_id and email:
                mapping[person_id] = email

    print(f"Loaded {len(mapping)} user mappings from CSV")
    return mapping


def get_io_to_project_uuid_mapping(session) -> dict:
    """Get IO code -> Project UUID mapping from database"""
    result = session.execute(text("SELECT id, code, name FROM projects"))
    mapping = {}

    for row in result:
        project_id, code, name = row
        # Try to extract IO code from various code formats
        # Some codes are like "406372", others like "406428-94", "PRJ-14"
        base_code = code.split("-")[0] if "-" in code else code

        # Store by base IO code
        if base_code.isdigit():
            if base_code not in mapping:
                mapping[base_code] = []
            mapping[base_code].append({
                "id": project_id,
                "code": code,
                "name": name
            })

        # Also store by full code
        mapping[code] = [{
            "id": project_id,
            "code": code,
            "name": name
        }]

    print(f"Loaded {len(mapping)} IO code mappings from database")
    return mapping


def get_email_to_user_uuid_mapping(session) -> dict:
    """Get email -> User UUID mapping from database"""
    result = session.execute(text("SELECT id, email FROM users WHERE email IS NOT NULL"))
    mapping = {}

    for row in result:
        user_id, email = row
        if email:
            mapping[email.lower()] = user_id

    print(f"Loaded {len(mapping)} email mappings from database")
    return mapping


def load_worklog_csv(csv_path: str) -> list:
    """Load worklogs from CSV"""
    worklogs = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            worklogs.append({
                "date": row.get("Date", "").split(" ")[0],  # Extract date part only
                "hours": float(row.get("Hours", "0") or "0"),
                "title": row.get("Title", "").strip(),
                "project_id": row.get("Project.Id", "").strip(),
                "createdby_id": row.get("Createdby.Id", "").strip(),
                "is_project": row.get("IsProject?", "") == "Project",
            })

    print(f"Loaded {len(worklogs)} worklogs from CSV")
    return worklogs


def analyze_project_distribution(worklogs: list, project_mapping: dict):
    """Analyze project distribution in CSV worklogs"""
    distribution = defaultdict(int)
    unmapped = defaultdict(int)

    for wl in worklogs:
        proj_id = wl["project_id"]
        distribution[proj_id] += 1

        if proj_id and proj_id not in project_mapping:
            unmapped[proj_id] += 1

    print("\n=== Project Distribution in CSV ===")
    sorted_dist = sorted(distribution.items(), key=lambda x: -x[1])[:20]
    for proj_id, count in sorted_dist:
        proj_info = project_mapping.get(proj_id, {"name": "UNKNOWN", "io": None})
        print(f"  Project.Id {proj_id}: {count} worklogs -> IO: {proj_info.get('io')} ({proj_info.get('name')[:40]})")

    if unmapped:
        print(f"\nUnmapped project IDs: {list(unmapped.keys())}")

    return distribution


def update_worklogs(session, worklogs: list, project_mapping: dict,
                    io_to_project: dict, user_mapping: dict, email_to_user: dict,
                    dry_run: bool = True):
    """Update worklog project_id based on CSV mappings"""

    # Build lookup for DB worklogs
    print("\nBuilding worklog lookup from database...")
    result = session.execute(text("""
        SELECT id, date, user_id, hours, description, project_id
        FROM worklogs
    """))

    db_worklogs = {}
    for row in result:
        wl_id, date, user_id, hours, description, project_id = row
        # Create lookup key
        key = (str(date), user_id, float(hours), (description or "").strip())
        if key not in db_worklogs:
            db_worklogs[key] = []
        db_worklogs[key].append({
            "id": wl_id,
            "project_id": project_id
        })

    print(f"Built lookup with {len(db_worklogs)} unique keys")

    # Get General/Non-Project UUID for comparison
    general_result = session.execute(text(
        "SELECT id FROM projects WHERE code = 'PRJ-14' OR name LIKE '%General/Non-Project%' LIMIT 1"
    ))
    general_project_id = general_result.scalar()
    print(f"General/Non-Project ID: {general_project_id}")

    # Process CSV worklogs and find matches
    updates = []
    matched = 0
    not_found = 0
    no_mapping = 0
    same_project = 0

    for csv_wl in worklogs:
        csv_proj_id = csv_wl["project_id"]

        # Skip if no project mapping or it's the general project (14)
        if csv_proj_id == "14":
            same_project += 1
            continue

        if csv_proj_id not in project_mapping:
            no_mapping += 1
            continue

        proj_info = project_mapping[csv_proj_id]
        io_code = proj_info.get("io")

        if not io_code:
            no_mapping += 1
            continue

        # Find target project UUID by IO code
        target_projects = io_to_project.get(io_code, [])
        if not target_projects:
            no_mapping += 1
            continue

        # Use first matching project (usually there's only one per IO)
        target_project_id = target_projects[0]["id"]

        # Find user UUID
        person_id = csv_wl["createdby_id"]
        user_email = user_mapping.get(person_id)
        if not user_email:
            not_found += 1
            continue

        user_id = email_to_user.get(user_email.lower())
        if not user_id:
            not_found += 1
            continue

        # Build lookup key
        key = (csv_wl["date"], user_id, csv_wl["hours"], csv_wl["title"])

        # Find matching DB worklog
        db_matches = db_worklogs.get(key, [])

        if not db_matches:
            not_found += 1
            continue

        # Update all matches (usually just one)
        for db_wl in db_matches:
            if db_wl["project_id"] == target_project_id:
                same_project += 1
                continue

            matched += 1
            updates.append({
                "worklog_id": db_wl["id"],
                "old_project_id": db_wl["project_id"],
                "new_project_id": target_project_id,
                "io_code": io_code
            })

    print(f"\n=== Matching Results ===")
    print(f"Matched worklogs to update: {matched}")
    print(f"Already correct project: {same_project}")
    print(f"No DB match found: {not_found}")
    print(f"No project mapping: {no_mapping}")

    # Group updates by target project for summary
    by_project = defaultdict(int)
    for u in updates:
        by_project[u["io_code"]] += 1

    print(f"\n=== Updates by Project (IO Code) ===")
    for io_code, count in sorted(by_project.items(), key=lambda x: -x[1])[:20]:
        print(f"  IO {io_code}: {count} worklogs")

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
        print("\n[DRY RUN] No changes made. Run with --execute to apply changes.")

    return updates


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Update worklog project mappings")
    parser.add_argument("--execute", action="store_true", help="Actually execute updates (default is dry run)")
    parser.add_argument("--analyze-only", action="store_true", help="Only analyze, don't update")
    args = parser.parse_args()

    # File paths
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ref_path = os.path.join(base_path, "ref_table")

    project_csv = os.path.join(ref_path, "db_projects.csv")
    user_csv = os.path.join(ref_path, "db_users.csv")
    worklog_csv = os.path.join(ref_path, "tb_worklog.csv")

    # Load CSV mappings
    print("Loading CSV mappings...")
    project_mapping = load_project_id_to_io_mapping(project_csv)
    user_mapping = load_user_mapping(user_csv)
    worklogs = load_worklog_csv(worklog_csv)

    # Analyze distribution
    analyze_project_distribution(worklogs, project_mapping)

    if args.analyze_only:
        print("\n[ANALYZE ONLY] Stopping here.")
        return

    # Connect to database
    print("\nConnecting to database...")
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Load database mappings
        io_to_project = get_io_to_project_uuid_mapping(session)
        email_to_user = get_email_to_user_uuid_mapping(session)

        # Update worklogs
        updates = update_worklogs(
            session, worklogs, project_mapping,
            io_to_project, user_mapping, email_to_user,
            dry_run=not args.execute
        )

    finally:
        session.close()


if __name__ == "__main__":
    main()
