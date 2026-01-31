"""Add recharge_ios table and recharge_io_id to projects

Revision ID: 006
Revises: 005_add_internal_io_table
Create Date: 2026-01-31

Changes:
1. Create recharge_ios table (separate from internal_ios)
2. Add recharge_io_id FK column to projects table
3. Add index on recharge_io_id for JOIN performance
4. Add partial index on active recharge_ios
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "006_add_recharge_io_to_projects"
down_revision = "005_add_internal_io_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create recharge_ios table
    op.create_table(
        "recharge_ios",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("io_number", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 2. Add partial index on active recharge_ios for common queries
    op.execute(
        "CREATE INDEX ix_recharge_ios_active ON recharge_ios(io_number) WHERE is_active = true"
    )

    # 3. Drop old FK constraint and column if exists (from previous incorrect migration)
    try:
        op.drop_index("ix_projects_recharge_io_id", table_name="projects")
    except Exception:
        pass

    try:
        op.drop_column("projects", "recharge_io_id")
    except Exception:
        pass

    # 4. Add recharge_io_id column to projects (referencing recharge_ios table)
    op.add_column(
        "projects",
        sa.Column("recharge_io_id", sa.String(36), sa.ForeignKey("recharge_ios.id"), nullable=True)
    )

    # 5. Add index on recharge_io_id FK for JOIN performance
    op.create_index("ix_projects_recharge_io_id", "projects", ["recharge_io_id"])


def downgrade() -> None:
    # 1. Drop index and column from projects
    op.drop_index("ix_projects_recharge_io_id", table_name="projects")
    op.drop_column("projects", "recharge_io_id")

    # 2. Drop partial index
    op.execute("DROP INDEX IF EXISTS ix_recharge_ios_active")

    # 3. Drop recharge_ios table
    op.drop_table("recharge_ios")
