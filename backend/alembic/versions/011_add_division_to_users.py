"""Add division_id to users and user_history

Revision ID: 011_add_division_to_users
Revises: 010_add_worklog_indexes
Create Date: 2026-02-06

Adds division_id column to users and user_history tables for Division selection feature.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "011_add_division_to_users"
down_revision: Union[str, None] = "010_add_worklog_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Ensure divisions table exists (required for FK)
    if "divisions" not in inspector.get_table_names():
        op.create_table(
            "divisions",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("code", sa.String(20), unique=True, nullable=False),
            sa.Column("is_active", sa.Boolean(), default=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        )

    # Add division_id to users if not exists
    columns = [c["name"] for c in inspector.get_columns("users")]
    if "division_id" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "division_id",
                sa.String(50),
                sa.ForeignKey("divisions.id"),
                nullable=True,
            ),
        )

    # Add division_id to user_history if not exists
    columns = [c["name"] for c in inspector.get_columns("user_history")]
    if "division_id" not in columns:
        op.add_column(
            "user_history",
            sa.Column(
                "division_id",
                sa.String(50),
                sa.ForeignKey("divisions.id"),
                nullable=True,
            ),
        )


def downgrade() -> None:
    op.drop_column("user_history", "division_id")
    op.drop_column("users", "division_id")
