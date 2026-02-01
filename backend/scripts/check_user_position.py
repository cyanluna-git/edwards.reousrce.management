#!/usr/bin/env python3
"""
Check specific user's position information

This script checks a user's position details to see what's actually stored.
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


def check_user_position(session, email: str):
    """Check user's position information"""
    print(f"🔍 Checking position for user: {email}")
    print("=" * 80)
    
    result = session.execute(text("""
        SELECT 
            u.id,
            u.email,
            u.name,
            u.korean_name,
            p.id as position_id,
            p.name as position_name,
            p.level as position_level
        FROM users u
        JOIN job_positions p ON u.position_id = p.id
        WHERE u.email = :email
    """), {"email": email})
    
    user = result.fetchone()
    
    if not user:
        print(f"❌ User not found: {email}")
        return
    
    user_id, user_email, user_name, korean_name, pos_id, pos_name, pos_level = user
    
    print(f"User: {user_name} ({korean_name or 'N/A'})")
    print(f"Email: {user_email}")
    print(f"\nPosition Details:")
    print(f"  Position ID: {pos_id}")
    print(f"  Position Name: '{pos_name}'")
    print(f"  Position Level: {pos_level}")
    print(f"\nPosition Name Length: {len(pos_name)}")
    print(f"Position Name Bytes: {pos_name.encode('utf-8')}")
    
    # Check if name ends with "0"
    if pos_name.endswith("0"):
        print(f"\n⚠️  Position name ends with '0'")
        print(f"   Would be displayed as: '{pos_name}'")
    else:
        print(f"\n✅ Position name does not end with '0'")
        print(f"   Will be displayed as: '{pos_name}'")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Check user's position information")
    parser.add_argument("--email", type=str, default="gerald.park@edwardsvacuum.com", help="User email to check")
    args = parser.parse_args()
    
    db_url = settings.DATABASE_URL
    if not db_url:
        print("❌ ERROR: DATABASE_URL not set in environment")
        sys.exit(1)
    
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        check_user_position(session, args.email)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
