#!/usr/bin/env python3
"""
Verify worklog indexes migration

This script verifies that the worklog indexes were created successfully.

Usage:
    python scripts/verify_worklog_indexes.py
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from app.core.config import get_settings

settings = get_settings()


def verify_indexes():
    """Verify that all expected indexes exist"""
    db_url = settings.DATABASE_URL
    if not db_url:
        print("❌ ERROR: DATABASE_URL not set in environment")
        return False

    print("🔍 Verifying worklog indexes...")
    print(f"📊 Database: {db_url.split('@')[1] if '@' in db_url else 'hidden'}\n")

    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            # Check current migration revision
            result = conn.execute(text("""
                SELECT version_num 
                FROM alembic_version 
                ORDER BY version_num DESC 
                LIMIT 1;
            """))
            current_rev = result.scalar()
            print(f"📋 Current migration revision: {current_rev}")

            # Check indexes
            result = conn.execute(text("""
                SELECT 
                    indexname,
                    indexdef
                FROM pg_indexes 
                WHERE tablename = 'worklogs' 
                AND indexname LIKE 'ix_worklogs%'
                ORDER BY indexname;
            """))
            indexes = {row[0]: row[1] for row in result}

            expected_indexes = [
                'ix_worklogs_date',
                'ix_worklogs_date_user_project',
                'ix_worklogs_project_date',
                'ix_worklogs_user_date'
            ]

            print(f"\n📋 Found {len(indexes)} worklog indexes:\n")
            
            all_present = True
            for idx_name in expected_indexes:
                if idx_name in indexes:
                    print(f"  ✅ {idx_name}")
                    # Show index definition (truncated)
                    idx_def = indexes[idx_name]
                    if len(idx_def) > 80:
                        idx_def = idx_def[:77] + "..."
                    print(f"     {idx_def}")
                else:
                    print(f"  ❌ {idx_name} - MISSING!")
                    all_present = False

            # Check for unexpected indexes
            unexpected = set(indexes.keys()) - set(expected_indexes)
            if unexpected:
                print(f"\n  ℹ️  Additional indexes found: {', '.join(unexpected)}")

            # Check index usage statistics
            print(f"\n📊 Index usage statistics:\n")
            result = conn.execute(text("""
                SELECT 
                    indexrelname as index_name,
                    idx_scan as scans,
                    idx_tup_read as tuples_read,
                    idx_tup_fetch as tuples_fetched
                FROM pg_stat_user_indexes
                WHERE relname = 'worklogs'
                AND indexrelname LIKE 'ix_worklogs%'
                ORDER BY idx_scan DESC;
            """))
            
            stats = list(result)
            if stats:
                for row in stats:
                    idx_name, scans, tuples_read, tuples_fetched = row
                    print(f"  {idx_name}:")
                    print(f"    Scans: {scans:,}")
                    print(f"    Tuples read: {tuples_read:,}")
                    print(f"    Tuples fetched: {tuples_fetched:,}")
            else:
                print("  ℹ️  No usage statistics yet (indexes may not have been used)")

            # Check migration revision
            if current_rev == "010_add_worklog_indexes":
                print(f"\n✅ Migration revision matches: {current_rev}")
            else:
                print(f"\n⚠️  Migration revision: {current_rev} (expected: 010_add_worklog_indexes)")

            print("\n" + "="*60)
            if all_present:
                print("✅ SUCCESS: All expected indexes are present!")
                print("✅ Migration verification complete!")
                return True
            else:
                print("❌ FAILED: Some indexes are missing!")
                print("   Please check the migration logs and try again.")
                return False

    except Exception as e:
        print(f"❌ Error verifying indexes: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = verify_indexes()
    sys.exit(0 if success else 1)
