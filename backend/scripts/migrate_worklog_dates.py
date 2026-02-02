#!/usr/bin/env python3
"""
Worklog Date Migration Script

This script adds 1 day to all worklog dates to fix UTC timezone offset issue.
SharePoint data is imported in UTC 0, causing dates to appear 1 day earlier.

Usage:
    python migrate_worklog_dates.py --dry-run  # Preview changes
    python migrate_worklog_dates.py --execute  # Apply changes
"""

import sys
import os
from datetime import datetime, timedelta
from sqlalchemy import text

# Add backend to path - handle running from project root or backend dir
backend_dir = os.path.join(os.path.dirname(__file__), "..")
if os.path.basename(os.getcwd()) == "edwards.reousrce.management":
    # Running from project root
    sys.path.insert(0, os.path.join(os.getcwd(), "backend"))
else:
    # Running from backend dir
    sys.path.insert(0, backend_dir)

from app.core.database import get_engine, get_session_local
from app.models.resource import WorkLog


def backup_database():
    """Create a PostgreSQL dump backup before migration"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = f"worklog_backup_{timestamp}.sql"

    print(f"📦 Creating database backup: {backup_file}")

    # Get database connection details from settings
    from app.core.config import settings

    db_url = settings.DATABASE_URL

    # Parse PostgreSQL connection string
    # postgresql://user:password@host:port/dbname
    if db_url.startswith("postgresql://"):
        import subprocess

        # Use pg_dump to create backup
        cmd = f"pg_dump {db_url} > backend/{backup_file}"
        try:
            subprocess.run(cmd, shell=True, check=True)
            print(f"✅ Backup created successfully: backend/{backup_file}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Backup failed: {e}")
            return False
    else:
        print("⚠️  Not a PostgreSQL database, skipping backup")
        return True


def preview_changes():
    """Preview what dates will be changed"""
    print("\n🔍 Previewing changes (dry-run mode)...\n")

    session = get_session_local()()
    try:
        worklogs = session.query(WorkLog).order_by(WorkLog.date).all()

        if not worklogs:
            print("No worklogs found in database.")
            return

        print(f"Found {len(worklogs)} worklog entries\n")
        print("Sample changes (first 10 and last 10):")
        print("-" * 80)
        print(
            f"{'ID':<8} {'Current Date':<15} {'New Date':<15} {'User':<20} {'Hours':<8}"
        )
        print("-" * 80)

        sample_logs = worklogs[:10] + worklogs[-10:] if len(worklogs) > 20 else worklogs

        for log in sample_logs:
            old_date = log.date
            new_date = old_date + timedelta(days=1)
            user_name = log.user.name if log.user else "Unknown"
            print(
                f"{log.id:<8} {str(old_date):<15} {str(new_date):<15} {user_name:<20} {log.hours:<8.1f}"
            )

        if len(worklogs) > 20:
            print(f"... ({len(worklogs) - 20} more entries) ...")

        print("-" * 80)
        print(f"\n📊 Date range:")
        print(f"   Current: {worklogs[0].date} to {worklogs[-1].date}")
        print(
            f"   After:   {worklogs[0].date + timedelta(days=1)} to {worklogs[-1].date + timedelta(days=1)}"
        )

    finally:
        session.close()


def execute_migration():
    """Execute the actual date migration"""
    print("\n⚙️  Executing migration...\n")

    session = get_session_local()()
    try:
        # Use raw SQL for efficient bulk update
        result = session.execute(
            text("UPDATE worklogs SET date = date + INTERVAL '1 day'")
        )
        session.commit()

        updated_count = result.rowcount
        print(f"✅ Successfully updated {updated_count} worklog entries")

        # Verify changes
        print("\n🔍 Verifying changes...")
        sample = session.query(WorkLog).order_by(WorkLog.date).limit(5).all()
        print("\nFirst 5 entries after migration:")
        print("-" * 60)
        for log in sample:
            user_name = log.user.name if log.user else "Unknown"
            print(f"  {log.date} | {user_name} | {log.hours}h")
        print("-" * 60)

        return True

    except Exception as e:
        session.rollback()
        print(f"❌ Migration failed: {e}")
        return False
    finally:
        session.close()


def main():
    """Main execution function"""
    print("=" * 80)
    print("Worklog Date Migration Script (+1 Day)")
    print("=" * 80)

    if len(sys.argv) < 2:
        print("\nUsage:")
        print("  python migrate_worklog_dates.py --dry-run   # Preview changes")
        print("  python migrate_worklog_dates.py --execute   # Apply changes")
        sys.exit(1)

    mode = sys.argv[1]

    if mode == "--dry-run":
        preview_changes()
        print("\n💡 Run with --execute to apply these changes")

    elif mode == "--execute":
        print("\n⚠️  WARNING: This will modify all worklog dates in the database!")
        print("Make sure you have reviewed the changes with --dry-run first.\n")

        confirm = input("Type 'YES' to proceed: ")
        if confirm != "YES":
            print("❌ Migration cancelled")
            sys.exit(0)

        # Create backup
        if not backup_database():
            print("❌ Cannot proceed without backup")
            sys.exit(1)

        # Execute migration
        if execute_migration():
            print("\n✅ Migration completed successfully!")
            print("   Please verify the data in your application.")
        else:
            print("\n❌ Migration failed. Database has been rolled back.")
            sys.exit(1)

    else:
        print(f"❌ Unknown mode: {mode}")
        print("Use --dry-run or --execute")
        sys.exit(1)


if __name__ == "__main__":
    main()
