#!/usr/bin/env python3
"""
Inspect database schema for projects and IO numbers

This script examines the database to find:
1. All InternalIO entries
2. All RechargeIO entries
3. Projects with OQC in name
4. General/Non-Project project
5. Project-IO relationships
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


def inspect_internal_ios(session):
    """Inspect all InternalIO entries"""
    print("\n" + "=" * 80)
    print("📋 INTERNAL IOs")
    print("=" * 80)
    
    result = session.execute(text("""
        SELECT id, io_number, name, is_active, business_unit_id
        FROM internal_ios
        ORDER BY io_number
    """))
    
    ios = result.fetchall()
    print(f"Total InternalIOs: {len(ios)}\n")
    
    for io in ios:
        io_id, io_number, name, is_active, bu_id = io
        status = "✅ Active" if is_active else "❌ Inactive"
        print(f"  {io_number:20} | {name or '(no name)':40} | {status}")
        print(f"    ID: {io_id[:8]}... | BU: {bu_id or 'N/A'}")
    
    # Check for OQC-related IOs
    print("\n🔍 OQC-related InternalIOs:")
    result = session.execute(text("""
        SELECT id, io_number, name, is_active
        FROM internal_ios
        WHERE LOWER(io_number) LIKE '%oqc%'
           OR LOWER(name) LIKE '%oqc%'
        ORDER BY io_number
    """))
    
    oqc_ios = result.fetchall()
    if oqc_ios:
        for io in oqc_ios:
            io_id, io_number, name, is_active = io
            status = "✅ Active" if is_active else "❌ Inactive"
            print(f"  {io_number:20} | {name or '(no name)':40} | {status}")
    else:
        print("  (None found)")


def inspect_recharge_ios(session):
    """Inspect all RechargeIO entries"""
    print("\n" + "=" * 80)
    print("📋 RECHARGE IOs")
    print("=" * 80)
    
    result = session.execute(text("""
        SELECT id, io_number, name, is_active
        FROM recharge_ios
        ORDER BY io_number
    """))
    
    ios = result.fetchall()
    print(f"Total RechargeIOs: {len(ios)}\n")
    
    for io in ios:
        io_id, io_number, name, is_active = io
        status = "✅ Active" if is_active else "❌ Inactive"
        print(f"  {io_number:20} | {name or '(no name)':40} | {status}")
    
    # Check for OQC-related IOs
    print("\n🔍 OQC-related RechargeIOs:")
    result = session.execute(text("""
        SELECT id, io_number, name, is_active
        FROM recharge_ios
        WHERE LOWER(io_number) LIKE '%oqc%'
           OR LOWER(name) LIKE '%oqc%'
        ORDER BY io_number
    """))
    
    oqc_ios = result.fetchall()
    if oqc_ios:
        for io in oqc_ios:
            io_id, io_number, name, is_active = io
            status = "✅ Active" if is_active else "❌ Inactive"
            print(f"  {io_number:20} | {name or '(no name)':40} | {status}")
    else:
        print("  (None found)")


def inspect_oqc_projects(session):
    """Inspect projects with OQC in name"""
    print("\n" + "=" * 80)
    print("📋 OQC PROJECTS")
    print("=" * 80)
    
    result = session.execute(text("""
        SELECT 
            p.id,
            p.name,
            p.status,
            io.io_number as internal_io,
            rio.io_number as recharge_io,
            p.internal_io_id,
            p.recharge_io_id
        FROM projects p
        LEFT JOIN internal_ios io ON p.internal_io_id = io.id
        LEFT JOIN recharge_ios rio ON p.recharge_io_id = rio.id
        WHERE LOWER(p.name) LIKE '%oqc%'
        ORDER BY p.name
    """))
    
    projects = result.fetchall()
    print(f"Total OQC projects: {len(projects)}\n")
    
    for proj in projects:
        proj_id, name, status, internal_io, recharge_io, internal_io_id, recharge_io_id = proj
        print(f"  Project: {name}")
        print(f"    ID: {proj_id[:8]}...")
        print(f"    Status: {status}")
        if internal_io:
            print(f"    Internal IO: {internal_io} (ID: {internal_io_id[:8]}...)")
        if recharge_io:
            print(f"    Recharge IO: {recharge_io} (ID: {recharge_io_id[:8]}...)")
        if not internal_io and not recharge_io:
            print(f"    (No IO assigned)")
        print()


def inspect_general_project(session):
    """Inspect General/Non-Project"""
    print("\n" + "=" * 80)
    print("📋 GENERAL/NON-PROJECT")
    print("=" * 80)
    
    result = session.execute(text("""
        SELECT 
            p.id,
            p.name,
            p.status,
            io.io_number as internal_io,
            rio.io_number as recharge_io
        FROM projects p
        LEFT JOIN internal_ios io ON p.internal_io_id = io.id
        LEFT JOIN recharge_ios rio ON p.recharge_io_id = rio.id
        WHERE LOWER(p.name) LIKE '%general%non-project%'
           OR LOWER(p.name) LIKE '%general/non-project%'
        ORDER BY p.name
    """))
    
    projects = result.fetchall()
    print(f"Total General/Non-Project projects: {len(projects)}\n")
    
    for proj in projects:
        proj_id, name, status, internal_io, recharge_io = proj
        print(f"  Project: {name}")
        print(f"    ID: {proj_id}")
        print(f"    Status: {status}")
        if internal_io:
            print(f"    Internal IO: {internal_io}")
        if recharge_io:
            print(f"    Recharge IO: {recharge_io}")
        print()


def inspect_888888_ios(session):
    """Inspect IO numbers containing 888888"""
    print("\n" + "=" * 80)
    print("📋 IO NUMBERS WITH '888888'")
    print("=" * 80)
    
    # InternalIOs
    result = session.execute(text("""
        SELECT id, io_number, name, is_active
        FROM internal_ios
        WHERE io_number LIKE '%888888%'
        ORDER BY io_number
    """))
    
    internal_ios = result.fetchall()
    print(f"InternalIOs with '888888': {len(internal_ios)}")
    for io in internal_ios:
        io_id, io_number, name, is_active = io
        status = "✅ Active" if is_active else "❌ Inactive"
        print(f"  {io_number:20} | {name or '(no name)':40} | {status}")
    
    # RechargeIOs
    result = session.execute(text("""
        SELECT id, io_number, name, is_active
        FROM recharge_ios
        WHERE io_number LIKE '%888888%'
        ORDER BY io_number
    """))
    
    recharge_ios = result.fetchall()
    print(f"\nRechargeIOs with '888888': {len(recharge_ios)}")
    for io in recharge_ios:
        io_id, io_number, name, is_active = io
        status = "✅ Active" if is_active else "❌ Inactive"
        print(f"  {io_number:20} | {name or '(no name)':40} | {status}")


def inspect_project_io_relationships(session):
    """Inspect project-IO relationships for OQC projects"""
    print("\n" + "=" * 80)
    print("📋 PROJECT-IO RELATIONSHIPS (OQC Projects)")
    print("=" * 80)
    
    result = session.execute(text("""
        SELECT 
            p.id as project_id,
            p.name as project_name,
            p.internal_io_id,
            p.recharge_io_id,
            io.id as internal_io_table_id,
            io.io_number as internal_io_number,
            io.name as internal_io_name,
            rio.id as recharge_io_table_id,
            rio.io_number as recharge_io_number,
            rio.name as recharge_io_name
        FROM projects p
        LEFT JOIN internal_ios io ON p.internal_io_id = io.id
        LEFT JOIN recharge_ios rio ON p.recharge_io_id = rio.id
        WHERE LOWER(p.name) LIKE '%oqc%'
        ORDER BY p.name
    """))
    
    relationships = result.fetchall()
    
    for rel in relationships:
        proj_id, proj_name, internal_io_id, recharge_io_id, io_table_id, io_number, io_name, rio_table_id, rio_number, rio_name = rel
        print(f"\n  Project: {proj_name}")
        print(f"    Project ID: {proj_id}")
        
        if internal_io_id:
            print(f"    Internal IO ID (FK): {internal_io_id}")
            if io_table_id:
                print(f"      → Matched InternalIO: {io_number} ({io_name or 'no name'})")
            else:
                print(f"      → ❌ No matching InternalIO found!")
        
        if recharge_io_id:
            print(f"    Recharge IO ID (FK): {recharge_io_id}")
            if rio_table_id:
                print(f"      → Matched RechargeIO: {rio_number} ({rio_name or 'no name'})")
            else:
                print(f"      → ❌ No matching RechargeIO found!")
        
        if not internal_io_id and not recharge_io_id:
            print(f"    (No IO relationships)")


def main():
    db_url = settings.DATABASE_URL
    if not db_url:
        print("❌ ERROR: DATABASE_URL not set in environment")
        sys.exit(1)
    
    print("🔍 Database Schema Inspection")
    print("=" * 80)
    print(f"Database: {db_url.split('@')[1] if '@' in db_url else 'hidden'}")
    
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        inspect_internal_ios(session)
        inspect_recharge_ios(session)
        inspect_888888_ios(session)
        inspect_oqc_projects(session)
        inspect_general_project(session)
        inspect_project_io_relationships(session)
        
        print("\n" + "=" * 80)
        print("✅ Inspection complete")
        print("=" * 80)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
