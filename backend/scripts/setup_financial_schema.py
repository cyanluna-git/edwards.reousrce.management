"""
Setup Financial Schema for Recharge & Planning System

Creates dimension tables and indexes needed for the financial backfill system.
"""

import sys
import os
from sqlalchemy import text

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_session_local

def check_table_exists(db, table_name):
    """Check if a table exists"""
    result = db.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :table_name)"
    ), {"table_name": table_name})
    return result.scalar()

def main():
    print("=" * 80)
    print("FINANCIAL SCHEMA SETUP")
    print("=" * 80)
    print()

    SessionLocal = get_session_local()
    db = SessionLocal()

    try:
        # Check existing tables
        print("Checking existing tables...")
        tables_to_check = ['dim_funding_entity', 'dim_io_category', 'projects']

        for table in tables_to_check:
            exists = check_table_exists(db, table)
            status = "✅ EXISTS" if exists else "❌ MISSING"
            print(f"  {table}: {status}")

        print()

        # Create dim_funding_entity table
        print("Creating dim_funding_entity table...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS dim_funding_entity (
                id VARCHAR(50) PRIMARY KEY,
                entity_code VARCHAR(20) UNIQUE NOT NULL,
                entity_name VARCHAR(100) NOT NULL,
                legal_entity VARCHAR(100),
                country_code VARCHAR(3),
                currency_code VARCHAR(3),
                cost_center_prefix VARCHAR(10),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.commit()
        print("✅ dim_funding_entity table created")

        # Insert funding entities
        print("Inserting funding entities...")
        db.execute(text("""
            INSERT INTO dim_funding_entity (id, entity_code, entity_name, legal_entity, country_code, currency_code, cost_center_prefix)
            VALUES
            ('ENTITY_VSS', 'VSS', 'VSS Division', 'VSS Legal Entity Inc.', 'USA', 'USD', 'VSS'),
            ('ENTITY_SUN', 'SUN', 'SUN Division', 'SUN Legal Entity Inc.', 'USA', 'USD', 'SUN'),
            ('ENTITY_LOCAL_KR', 'LOCAL_KR', 'Local Korea', 'Edwards Korea Ltd.', 'KOR', 'KRW', 'KR'),
            ('ENTITY_SHARED', 'SHARED', 'Shared Services', 'Edwards Global Shared Services', 'USA', 'USD', 'SHARED')
            ON CONFLICT (id) DO NOTHING
        """))
        db.commit()
        print("✅ Funding entities inserted")

        # Create dim_io_category table
        print("Creating dim_io_category table...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS dim_io_category (
                id VARCHAR(50) PRIMARY KEY,
                category_code VARCHAR(50) UNIQUE NOT NULL,
                category_name VARCHAR(200) NOT NULL,
                parent_category_id VARCHAR(50),
                is_billable BOOLEAN DEFAULT FALSE,
                default_funding_entity_id VARCHAR(50),
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.commit()
        print("✅ dim_io_category table created")

        # Insert IO categories
        print("Inserting IO categories...")
        db.execute(text("""
            INSERT INTO dim_io_category (id, category_code, category_name, is_billable, default_funding_entity_id, description)
            VALUES
            ('IO_CAT_NPI', 'NPI', 'New Product Introduction', FALSE, 'ENTITY_LOCAL_KR', 'Core product development - local Korea CAPEX'),
            ('IO_CAT_FIELD_FAILURE', 'FIELD_FAILURE', 'Field Failure Escalation', TRUE, 'ENTITY_VSS', 'Customer escalations and field failures - billable to VSS'),
            ('IO_CAT_OPS_SUPPORT', 'OPS_SUPPORT', 'Operations Support', TRUE, 'ENTITY_VSS', 'Factory and operations support - billable to VSS'),
            ('IO_CAT_SUSTAINING', 'SUSTAINING', 'Sustaining Engineering', TRUE, 'ENTITY_VSS', 'Post-release bug fixes and maintenance - billable to VSS'),
            ('IO_CAT_CIP', 'CIP', 'Continuous Improvement Project', TRUE, NULL, 'Process improvements - billable to requesting division'),
            ('IO_CAT_OTHER', 'OTHER', 'Other/Miscellaneous', FALSE, 'ENTITY_LOCAL_KR', 'General overhead and miscellaneous activities')
            ON CONFLICT (id) DO NOTHING
        """))
        db.commit()
        print("✅ IO categories inserted")

        # Add financial columns to projects table
        print("Adding financial columns to projects table...")
        try:
            db.execute(text("""
                ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS funding_entity_id VARCHAR(50),
                ADD COLUMN IF NOT EXISTS recharge_status VARCHAR(20),
                ADD COLUMN IF NOT EXISTS io_category_code VARCHAR(100),
                ADD COLUMN IF NOT EXISTS is_capitalizable BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS gl_account_code VARCHAR(50)
            """))
            db.commit()
            print("✅ Financial columns added to projects table")
        except Exception as e:
            print(f"⚠️  Some columns may already exist: {e}")
            db.rollback()

        # Add indexes to projects table
        print("Adding indexes to projects table...")
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_projects_funding_entity_id ON projects(funding_entity_id)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_projects_recharge_status ON projects(recharge_status)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_projects_io_category_code ON projects(io_category_code)
        """))
        db.commit()
        print("✅ Indexes created")

        # Verify
        print()
        print("Verifying setup...")
        result = db.execute(text("SELECT COUNT(*) FROM dim_funding_entity"))
        funding_count = result.scalar()
        result = db.execute(text("SELECT COUNT(*) FROM dim_io_category"))
        category_count = result.scalar()

        print(f"  Funding entities: {funding_count}")
        print(f"  IO categories: {category_count}")

        print()
        print("=" * 80)
        print("✅ SCHEMA SETUP COMPLETE")
        print("=" * 80)
        print()
        print("You can now run the backfill script:")
        print("  .venv/bin/python backend/scripts/backfill_project_finance_v2.py")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
