"""Add internal_ios table and migrate project.code

Revision ID: 005
Revises: 004_add_project_roles
Create Date: 2026-01-31

Changes:
1. Create internal_ios table for IO number management
2. Add internal_io_id FK to projects table with index
3. Migrate existing project.code values to internal_ios
4. Drop unique constraint and code column from projects
5. Add partial index on active internal_ios
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = "005_add_internal_io_table"
down_revision = "004_add_project_roles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Create internal_ios table
    op.create_table(
        "internal_ios",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("io_number", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 2. Add internal_io_id column to projects (nullable initially)
    op.add_column(
        "projects",
        sa.Column("internal_io_id", sa.String(36), sa.ForeignKey("internal_ios.id"), nullable=True)
    )

    # 2a. Add index on internal_io_id FK for JOIN performance
    op.create_index("ix_projects_internal_io_id", "projects", ["internal_io_id"])

    # 2b. Add partial index on active internal_ios for common queries
    op.execute(
        "CREATE INDEX ix_internal_ios_active ON internal_ios(io_number) WHERE is_active = true"
    )

    # 3. Migrate existing code values to internal_ios table
    # Get all unique project codes
    result = conn.execute(text("SELECT DISTINCT code FROM projects WHERE code IS NOT NULL"))
    codes = [row[0] for row in result]

    # Insert unique codes into internal_ios
    for code in codes:
        import uuid
        io_id = str(uuid.uuid4())
        conn.execute(
            text("""
                INSERT INTO internal_ios (id, io_number, is_active, created_at, updated_at)
                VALUES (:id, :io_number, true, NOW(), NOW())
            """),
            {"id": io_id, "io_number": code}
        )
        # Update projects with matching code to reference the new internal_io
        conn.execute(
            text("""
                UPDATE projects SET internal_io_id = :io_id WHERE code = :code
            """),
            {"io_id": io_id, "code": code}
        )

    # 4. Drop unique constraint on code column (if exists)
    # Note: constraint name may vary by database
    try:
        op.drop_constraint("projects_code_key", "projects", type_="unique")
    except Exception:
        pass  # Constraint might not exist or have different name

    try:
        op.drop_index("ix_projects_code", table_name="projects")
    except Exception:
        pass

    # 5. Drop the code column from projects
    op.drop_column("projects", "code")


def downgrade() -> None:
    conn = op.get_bind()

    # 1. Re-add code column to projects
    op.add_column(
        "projects",
        sa.Column("code", sa.String(50), nullable=True)
    )

    # 2. Restore code values from internal_ios
    conn.execute(
        text("""
            UPDATE projects p
            SET code = (SELECT io_number FROM internal_ios WHERE id = p.internal_io_id)
            WHERE p.internal_io_id IS NOT NULL
        """)
    )

    # 3. Make code unique and not null (may fail if duplicates were introduced)
    op.alter_column("projects", "code", nullable=False)
    op.create_unique_constraint("projects_code_key", "projects", ["code"])

    # 4. Drop indexes and internal_io_id from projects
    op.drop_index("ix_projects_internal_io_id", table_name="projects")
    op.execute("DROP INDEX IF EXISTS ix_internal_ios_active")
    op.drop_constraint(None, "projects", type_="foreignkey")  # Drop FK
    op.drop_column("projects", "internal_io_id")

    # 5. Drop internal_ios table
    op.drop_table("internal_ios")
