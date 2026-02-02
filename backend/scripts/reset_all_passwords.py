#!/usr/bin/env python3
"""
Reset all user passwords to a default password

This script updates all user accounts' passwords to a specified default password.
Use with caution - this will change ALL user passwords in the system.

Usage:
    python scripts/reset_all_passwords.py                    # Dry run (preview only)
    python scripts/reset_all_passwords.py --execute          # Actually update
    python scripts/reset_all_passwords.py --password "custom" # Use custom password
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import get_settings
from app.core.security import get_password_hash

settings = get_settings()

# Default password
DEFAULT_PASSWORD = "edwards!@"


def get_all_users(session):
    """Get all active and inactive users"""
    result = session.execute(text("""
        SELECT 
            id,
            email,
            name,
            role,
            is_active,
            created_at
        FROM users
        ORDER BY email
    """))
    return result.fetchall()


def reset_passwords(session, password: str, dry_run: bool = True):
    """Reset all user passwords"""
    users = get_all_users(session)
    
    if not users:
        print("ℹ️  No users found in database")
        return
    
    print(f"📋 Found {len(users)} user(s) in database\n")
    
    # Show preview
    print("Users to be updated:")
    print("=" * 80)
    active_count = 0
    inactive_count = 0
    
    for user in users:
        user_id, email, name, role, is_active, created_at = user
        status = "✅ Active" if is_active else "❌ Inactive"
        print(f"  {email:40} | {name:20} | {role:10} | {status}")
        if is_active:
            active_count += 1
        else:
            inactive_count += 1
    
    print("=" * 80)
    print(f"\n📊 Summary:")
    print(f"  Total users: {len(users)}")
    print(f"  Active users: {active_count}")
    print(f"  Inactive users: {inactive_count}")
    print(f"  New password: {'*' * len(password)}")
    
    if dry_run:
        print(f"\n[DRY RUN] No changes made. Run with --execute to actually update passwords.")
        return
    
    # Confirm
    print(f"\n⚠️  WARNING: This will change ALL user passwords!")
    print(f"   New password: {password}")
    print(f"   Total users affected: {len(users)}")
    confirm = input("\n   Are you sure you want to proceed? (type 'yes' to confirm): ")
    
    if confirm.lower() != "yes":
        print("❌ Cancelled. No passwords were changed.")
        return
    
    # Hash password
    hashed_password = get_password_hash(password)
    
    # Update all users
    print(f"\n🔄 Updating passwords...")
    result = session.execute(text("""
        UPDATE users
        SET hashed_password = :hashed_password,
            updated_at = NOW()
        WHERE id IN (
            SELECT id FROM users
        )
    """), {"hashed_password": hashed_password})
    
    session.commit()
    
    affected_rows = result.rowcount
    print(f"✅ Successfully updated {affected_rows} user password(s)")
    print(f"\n💡 All users can now login with:")
    print(f"   Password: {password}")
    print(f"\n⚠️  IMPORTANT: Users should change their passwords after first login!")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Reset all user passwords to a default password",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (preview only)
  python scripts/reset_all_passwords.py
  
  # Actually update with default password
  python scripts/reset_all_passwords.py --execute
  
  # Use custom password
  python scripts/reset_all_passwords.py --password "custom123" --execute
        """
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually execute password updates (default is dry run)"
    )
    parser.add_argument(
        "--password",
        type=str,
        default=DEFAULT_PASSWORD,
        help=f"Password to set for all users (default: {DEFAULT_PASSWORD})"
    )
    
    args = parser.parse_args()
    
    password = args.password
    dry_run = not args.execute
    
    if len(password) < 6:
        print("❌ ERROR: Password must be at least 6 characters long")
        sys.exit(1)
    
    # Database connection
    db_url = settings.DATABASE_URL
    if not db_url:
        print("❌ ERROR: DATABASE_URL not set in environment")
        sys.exit(1)
    
    print("🔐 Reset All User Passwords")
    print("=" * 80)
    print(f"Mode: {'DRY RUN (preview only)' if dry_run else 'EXECUTE (will update passwords)'}")
    print(f"Password: {password}")
    print()
    
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        reset_passwords(session, password, dry_run=dry_run)
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
