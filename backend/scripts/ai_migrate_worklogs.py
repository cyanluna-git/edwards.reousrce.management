#!/usr/bin/env python3
"""
AI-Assisted CSV Worklog Migration Script

Usage:
    python -m scripts.ai_migrate_worklogs -7d --dry-run
    python -m scripts.ai_migrate_worklogs -1d --execute
    python -m scripts.ai_migrate_worklogs --from 2024-04-01 --to 2024-04-30
"""

import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.services.csv_migration_service import CSVMigrationService


def parse_days(arg: str) -> int:
    """Parse days argument like '-1d', '-7d', '-20d'."""
    if arg.endswith("d"):
        try:
            return int(arg[:-1])
        except ValueError:
            pass
    try:
        return int(arg)
    except ValueError:
        raise argparse.ArgumentTypeError(f"Invalid days format: {arg}")


def parse_date(arg: str) -> datetime:
    """Parse date argument."""
    for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"]:
        try:
            return datetime.strptime(arg, fmt)
        except ValueError:
            continue
    raise argparse.ArgumentTypeError(f"Invalid date format: {arg}")


def get_db_session():
    """Create database session."""
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def load_db_data(db):
    """Load users, projects, and work types from database."""
    from app.models.user import User
    from app.models.project import Project
    from app.models.work_type import WorkTypeCategory

    # Load users
    users = []
    for u in db.query(User).filter(User.is_active == True).all():
        users.append({
            "id": str(u.id),
            "email": u.email,
            "name": u.name,
            "korean_name": getattr(u, "korean_name", None),
        })

    # Load projects (filter out cancelled/completed if needed)
    projects = []
    for p in db.query(Project).filter(Project.status.notin_(["Cancelled"])).all():
        projects.append({
            "id": str(p.id),
            "code": p.code,
            "name": p.name,
            "status": p.status,
        })

    # Load work types
    work_types = []
    for wt in db.query(WorkTypeCategory).all():
        work_types.append({
            "id": str(wt.id),
            "code": wt.code,
            "name": wt.name,
            "name_ko": getattr(wt, "name_ko", None),
        })

    return users, projects, work_types


def load_existing_worklogs(db, start_date: datetime, end_date: datetime):
    """Load existing worklogs for duplicate detection."""
    from app.models.resource import WorkLog

    worklogs = []
    query = db.query(WorkLog).filter(
        WorkLog.date >= start_date.date(),
        WorkLog.date <= end_date.date(),
    )

    for w in query.all():
        worklogs.append({
            "user_id": str(w.user_id) if w.user_id else None,
            "project_id": str(w.project_id) if w.project_id else None,
            "date": w.date,
            "hours": w.hours,
        })

    return worklogs


def main():
    parser = argparse.ArgumentParser(
        description="AI-Assisted CSV Worklog Migration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python -m scripts.ai_migrate_worklogs -7d --dry-run
    python -m scripts.ai_migrate_worklogs -1d --execute
    python -m scripts.ai_migrate_worklogs --from 2024-04-01 --to 2024-04-30 --dry-run
        """,
    )

    # Date range arguments
    parser.add_argument(
        "days",
        nargs="?",
        default="-7d",
        help="Days to look back (e.g., -1d, -7d, -20d). Default: -7d",
    )
    parser.add_argument(
        "--from",
        dest="from_date",
        type=parse_date,
        help="Start date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--to",
        dest="to_date",
        type=parse_date,
        help="End date (YYYY-MM-DD)",
    )

    # Execution mode
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Analyze only, don't insert (default)",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually insert to database",
    )

    # Paths (from .env or defaults)
    parser.add_argument(
        "--backup-path",
        default=settings.CSV_BACKUP_PATH,
        help=f"Path to backup folder containing CSV files (default: {settings.CSV_BACKUP_PATH})",
    )
    parser.add_argument(
        "--report-path",
        default=settings.MIGRATION_REPORT_PATH,
        help=f"Path to save migration reports (default: {settings.MIGRATION_REPORT_PATH})",
    )

    # Verbosity
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Verbose output",
    )

    args = parser.parse_args()

    # Determine date range
    if args.from_date and args.to_date:
        start_date = args.from_date
        end_date = args.to_date
        days = None
    else:
        days = parse_days(args.days)
        end_date = datetime.now()
        start_date = end_date + timedelta(days=days)

    # Determine execution mode
    dry_run = not args.execute

    print("=" * 60)
    print("CSV Worklog Migration")
    print("=" * 60)
    print(f"Date range: {start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')}")
    print(f"Mode: {'DRY-RUN (no changes)' if dry_run else 'EXECUTE (will insert)'}")
    print(f"Backup path: {args.backup_path}")
    print()

    # Check backup path exists
    backup_path = Path(args.backup_path)
    if not backup_path.exists():
        print(f"ERROR: Backup path not found: {backup_path}")
        sys.exit(1)

    # Initialize service
    try:
        db = get_db_session()
        service = CSVMigrationService(db if not dry_run else None)
    except Exception as e:
        print(f"ERROR: Failed to connect to database: {e}")
        print("Continuing in CSV-only mode...")
        service = CSVMigrationService(None)

    # Load CSV data
    print("Loading CSV data...")
    service.load_csv_data(str(backup_path))
    print(f"  - Users: {len(service.csv_users)}")
    print(f"  - Projects: {len(service.csv_projects)}")
    print(f"  - Work Types: {len(service.csv_worktypes)}")
    print(f"  - Worklogs: {len(service.csv_worklogs)}")
    print()

    # Load DB data
    try:
        print("Loading DB data...")
        users, projects, work_types = load_db_data(db)
        service.load_db_data(users, projects, work_types)
        print(f"  - Users: {len(users)}")
        print(f"  - Projects: {len(projects)}")
        print(f"  - Work Types: {len(work_types)}")

        # Load existing worklogs for duplicate detection
        existing_worklogs = load_existing_worklogs(db, start_date, end_date)
        service.load_existing_worklogs(existing_worklogs)
        print(f"  - Existing worklogs (for duplicate check): {len(existing_worklogs)}")
        print()
    except Exception as e:
        print(f"WARNING: Failed to load DB data: {e}")
        print("Proceeding with CSV-only analysis...")
        print()

    # Analyze
    print("Analyzing worklogs...")
    if days:
        report = service.analyze(days=days)
    else:
        report = service.analyze(start_date=start_date, end_date=end_date)

    # Print summary
    print()
    print(service.generate_summary())

    # Generate CSV report
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = Path(args.report_path) / f"migration_report_{timestamp}.csv"
    report_file.parent.mkdir(parents=True, exist_ok=True)

    csv_path = service.generate_csv_report(str(report_file))
    print(f"\nCSV report saved: {csv_path}")

    # Execute if requested
    if args.execute and not dry_run:
        print()
        confirm = input("Proceed with migration? (yes/no): ")
        if confirm.lower() != "yes":
            print("Migration cancelled.")
            sys.exit(0)

        print()
        print("Executing migration...")
        report = service.execute(
            start_date=start_date,
            end_date=end_date,
            dry_run=False,
        )

        print()
        print("--- Execution Complete ---")
        print(f"Inserted: {report.inserted_records:,}")
        print(f"Skipped: {report.skipped_records:,}")

        if report.errors:
            print()
            print("--- Errors ---")
            for error in report.errors[:10]:
                print(f"  {error}")

    print()
    print("Done.")


if __name__ == "__main__":
    main()
