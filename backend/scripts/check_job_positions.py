#!/usr/bin/env python3
"""
Check and fix job position names

This script checks job positions in the database and can fix names ending with "0"
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import get_settings

settings = get_settings()


def check_job_positions(session):
    """Check all job positions"""
    print("📋 Job Positions in Database")
    print("=" * 80)
    
    result = session.execute(text("""
        SELECT id, name, level, is_active
        FROM job_positions
        ORDER BY name
    """))
    
    positions = result.fetchall()
    print(f"Total positions: {len(positions)}\n")
    
    issues = []
    for pos in positions:
        pos_id, name, level, is_active = pos
        status = "✅ Active" if is_active else "❌ Inactive"
        print(f"  {name:30} | Level: {level or 'N/A':5} | {status}")
        
        # Check for names ending with "0"
        if name.endswith("0") and name != "0":
            issues.append((pos_id, name, name[:-1]))
    
    if issues:
        print(f"\n⚠️  Found {len(issues)} position(s) with trailing '0':")
        for pos_id, old_name, new_name in issues:
            print(f"  - '{old_name}' → '{new_name}'")
    else:
        print("\n✅ No issues found")
    
    return issues


def fix_job_positions(session, issues, dry_run=True):
    """Fix job position names"""
    if not issues:
        print("\n✅ No positions to fix")
        return
    
    if dry_run:
        print(f"\n[DRY RUN] Would fix {len(issues)} position(s)")
        return
    
    print(f"\n🔄 Fixing {len(issues)} position(s)...")
    
    for pos_id, old_name, new_name in issues:
        session.execute(text("""
            UPDATE job_positions
            SET name = :new_name,
                updated_at = NOW()
            WHERE id = :pos_id
        """), {"new_name": new_name, "pos_id": pos_id})
        print(f"  ✅ '{old_name}' → '{new_name}'")
    
    session.commit()
    print(f"\n✅ Successfully fixed {len(issues)} position(s)")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Check and fix job position names")
    parser.add_argument("--execute", action="store_true", help="Actually fix names (default is dry run)")
    args = parser.parse_args()
    
    db_url = settings.DATABASE_URL
    if not db_url:
        print("❌ ERROR: DATABASE_URL not set in environment")
        sys.exit(1)
    
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        issues = check_job_positions(session)
        fix_job_positions(session, issues, dry_run=not args.execute)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        session.rollback()
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
