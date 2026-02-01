#!/usr/bin/env python3
"""
Create a guest user account with read-only permissions

This script creates a guest user account (guest@edwardsvacuum.com) with GUEST role
that has read-only access to the system.

Usage:
    python scripts/create_guest_user.py
    python scripts/create_guest_user.py --password "custom_password"
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
from getpass import getpass

settings = get_settings()


def find_default_department(session) -> str | None:
    """Find a default department ID"""
    result = session.execute(text("""
        SELECT id, name
        FROM departments
        WHERE is_active = TRUE
        ORDER BY name
        LIMIT 1
    """))
    row = result.fetchone()
    if row:
        return row[0]
    return None


def find_default_position(session) -> str | None:
    """Find a default job position ID"""
    result = session.execute(text("""
        SELECT id, name
        FROM job_positions
        WHERE is_active = TRUE
        ORDER BY name
        LIMIT 1
    """))
    row = result.fetchone()
    if row:
        return row[0]
    return None


def create_guest_user(session, password: str):
    """Create guest user account"""
    email = "guest@edwardsvacuum.com"
    
    # Check if user already exists
    result = session.execute(text("""
        SELECT id, email, role, is_active
        FROM users
        WHERE email = :email
    """), {"email": email})
    
    existing_user = result.fetchone()
    
    if existing_user:
        user_id, existing_email, existing_role, is_active = existing_user
        print(f"⚠️  User already exists: {email}")
        print(f"   ID: {user_id}")
        print(f"   Role: {existing_role}")
        print(f"   Active: {is_active}")
        
        # Update to GUEST role if not already
        if existing_role != "GUEST":
            response = input(f"\n   Update role to GUEST? (yes/no): ").lower()
            if response == "yes":
                session.execute(text("""
                    UPDATE users
                    SET role = 'GUEST',
                        is_active = TRUE,
                        updated_at = NOW()
                    WHERE id = :user_id
                """), {"user_id": user_id})
                session.commit()
                print(f"   ✅ Role updated to GUEST")
            else:
                print("   ℹ️  No changes made")
        else:
            print("   ℹ️  User already has GUEST role")
        
        return
    
    # Get default department and position
    department_id = find_default_department(session)
    if not department_id:
        print("❌ ERROR: No active department found. Please create a department first.")
        sys.exit(1)
    
    position_id = find_default_position(session)
    if not position_id:
        print("❌ ERROR: No active job position found. Please create a job position first.")
        sys.exit(1)
    
    # Hash password
    hashed_password = get_password_hash(password)
    
    # Create user
    result = session.execute(text("""
        INSERT INTO users (
            email,
            hashed_password,
            name,
            korean_name,
            department_id,
            position_id,
            role,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            :email,
            :hashed_password,
            :name,
            :korean_name,
            :department_id,
            :position_id,
            :role,
            :is_active,
            NOW(),
            NOW()
        )
        RETURNING id
    """), {
        "email": email,
        "hashed_password": hashed_password,
        "name": "Guest User",
        "korean_name": "게스트 사용자",
        "department_id": department_id,
        "position_id": position_id,
        "role": "GUEST",
        "is_active": True,
    })
    
    user_id = result.scalar()
    session.commit()
    
    print(f"✅ Guest user created successfully!")
    print(f"   Email: {email}")
    print(f"   User ID: {user_id}")
    print(f"   Role: GUEST (Read-only)")
    print(f"   Password: {'*' * len(password)}")
    print(f"\n💡 Note: This account has read-only access and cannot create, update, or delete data.")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Create guest user account with read-only permissions")
    parser.add_argument("--password", type=str, default="edwards!@", help="Password for guest account (default: edwards!@)")
    args = parser.parse_args()
    
    # Get password
    password = args.password
    
    if len(password) < 6:
        print("❌ ERROR: Password must be at least 6 characters long")
        sys.exit(1)
    
    # Database connection
    db_url = settings.DATABASE_URL
    if not db_url:
        print("❌ ERROR: DATABASE_URL not set in environment")
        sys.exit(1)
    
    print("🔍 Creating guest user account...")
    print(f"   Email: guest@edwardsvacuum.com")
    print(f"   Role: GUEST (Read-only)")
    print()
    
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        create_guest_user(session, password)
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
