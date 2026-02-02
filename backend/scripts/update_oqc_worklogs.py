#!/usr/bin/env python3
"""
Update OQC worklogs from General/Non-Project to OQC Digitalization project

This script finds worklogs in General/Non-Project that have "oqc" in their description
and updates them to the OQC Digitalization project.

Usage:
    python scripts/update_oqc_worklogs.py          # Dry run (preview only)
    python scripts/update_oqc_worklogs.py --execute  # Actually update
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


def find_general_project(session) -> str | None:
    """Find General/Non-Project ID"""
    result = session.execute(text("""
        SELECT id, name
        FROM projects
        WHERE LOWER(name) LIKE '%general%non-project%'
           OR LOWER(name) LIKE '%general/non-project%'
        LIMIT 1
    """))
    row = result.fetchone()
    if row:
        return row[0]
    return None


def find_oqc_digitalization_project(session) -> str | None:
    """Find OQC Digitalization project ID"""
    # Try to find by name first
    result = session.execute(text("""
        SELECT id, name
        FROM projects
        WHERE LOWER(name) LIKE '%oqc%digitalization%'
           OR LOWER(name) LIKE '%oqc digitalization%'
        LIMIT 1
    """))
    row = result.fetchone()
    if row:
        return row[0]
    
    # If not found by name, try to find by IO number (888888-160)
    result = session.execute(text("""
        SELECT p.id, p.name
        FROM projects p
        LEFT JOIN internal_ios io ON p.internal_io_id = io.id
        LEFT JOIN recharge_ios rio ON p.recharge_io_id = rio.id
        WHERE io.io_number LIKE '%888888-160%'
           OR rio.io_number LIKE '%888888-160%'
        LIMIT 1
    """))
    row = result.fetchone()
    if row:
        return row[0]
    
    return None


def find_oqc_worklogs(session, general_project_id: str) -> list:
    """Find worklogs in General/Non-Project with 'oqc' in description"""
    result = session.execute(text("""
        SELECT 
            w.id,
            w.date,
            w.description,
            u.name as user_name,
            w.hours,
            w.project_id
        FROM worklogs w
        JOIN users u ON w.user_id = u.id
        WHERE w.project_id = :general_project_id
          AND LOWER(w.description) LIKE '%oqc%'
        ORDER BY w.date DESC, u.name
    """), {"general_project_id": general_project_id})
    
    return result.fetchall()


def update_worklogs(session, worklog_ids: list, target_project_id: str, dry_run: bool = True):
    """Update worklog project_ids"""
    if not worklog_ids:
        print("No worklogs to update.")
        return
    
    if dry_run:
        print(f"\n[DRY RUN] Would update {len(worklog_ids)} worklogs")
        return
    
    print(f"\nUpdating {len(worklog_ids)} worklogs...")
    
    # Batch update
    batch_size = 100
    for i in range(0, len(worklog_ids), batch_size):
        batch = worklog_ids[i:i+batch_size]
        placeholders = ','.join([':id' + str(j) for j in range(len(batch))])
        params = {f'id{j}': wl_id for j, wl_id in enumerate(batch)}
        params['target_project_id'] = target_project_id
        
        session.execute(text(f"""
            UPDATE worklogs
            SET project_id = :target_project_id
            WHERE id IN ({placeholders})
        """), params)
        
        session.commit()
        print(f"  Updated batch {i//batch_size + 1}/{(len(worklog_ids) + batch_size - 1)//batch_size}")
    
    print("✅ Updates completed!")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Update OQC worklogs to OQC Digitalization project")
    parser.add_argument("--execute", action="store_true", help="Actually execute updates (default is dry run)")
    args = parser.parse_args()
    
    dry_run = not args.execute
    
    # Database connection
    db_url = settings.DATABASE_URL
    if not db_url:
        print("❌ ERROR: DATABASE_URL not set in environment")
        sys.exit(1)
    
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Find projects
        print("🔍 Finding projects...")
        general_project_id = find_general_project(session)
        if not general_project_id:
            print("❌ ERROR: General/Non-Project not found")
            sys.exit(1)
        
        result = session.execute(text("SELECT name FROM projects WHERE id = :id"), {"id": general_project_id})
        general_project_name = result.scalar()
        print(f"  ✅ General/Non-Project: {general_project_id[:8]}... ({general_project_name})")
        
        oqc_project_id = find_oqc_digitalization_project(session)
        if not oqc_project_id:
            print("❌ ERROR: OQC Digitalization project not found")
            print("   Please check if the project exists in the database")
            sys.exit(1)
        
        result = session.execute(text("SELECT name FROM projects WHERE id = :id"), {"id": oqc_project_id})
        oqc_project_name = result.scalar()
        print(f"  ✅ OQC Digitalization: {oqc_project_id[:8]}... ({oqc_project_name})")
        
        # Find worklogs
        print("\n🔍 Finding worklogs with 'oqc' in description...")
        worklogs = find_oqc_worklogs(session, general_project_id)
        
        if not worklogs:
            print("  ℹ️  No worklogs found matching criteria")
            return
        
        print(f"  ✅ Found {len(worklogs)} worklogs")
        
        # Show preview
        print("\n📋 Preview (first 10 worklogs):")
        print("=" * 100)
        for i, wl in enumerate(worklogs[:10], 1):
            print(f"{i}. Date: {wl[1]}, User: {wl[3]}, Hours: {wl[4]}")
            print(f"   Description: {wl[2][:80]}...")
            print()
        
        if len(worklogs) > 10:
            print(f"   ... and {len(worklogs) - 10} more worklogs")
        
        # Show statistics
        print("\n📊 Statistics:")
        total_hours = sum(wl[4] or 0 for wl in worklogs)
        unique_users = len(set(wl[3] for wl in worklogs))
        date_range = (min(wl[1] for wl in worklogs), max(wl[1] for wl in worklogs))
        
        print(f"  Total worklogs: {len(worklogs)}")
        print(f"  Total hours: {total_hours:.2f}")
        print(f"  Unique users: {unique_users}")
        print(f"  Date range: {date_range[0]} to {date_range[1]}")
        
        # Update worklogs
        worklog_ids = [wl[0] for wl in worklogs]
        update_worklogs(session, worklog_ids, oqc_project_id, dry_run=dry_run)
        
        if dry_run:
            print("\n💡 Run with --execute to actually update the worklogs")
        else:
            print("\n✅ All worklogs updated successfully!")
            
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
