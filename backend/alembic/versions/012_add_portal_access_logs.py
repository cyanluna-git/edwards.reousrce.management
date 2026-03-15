"""Add portal_access_logs table

Revision ID: 012_portal_access_logs
Revises: 7f1c0d4d9a2e
Create Date: 2026-03-15
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "012_portal_access_logs"
down_revision: Union[str, None] = "7f1c0d4d9a2e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if "portal_access_logs" not in tables:
        op.create_table(
            "portal_access_logs",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("service", sa.String(length=20), nullable=False),
            sa.Column("accessed_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_portal_access_logs_user_id", "portal_access_logs", ["user_id"])
        op.create_index("ix_portal_access_logs_accessed_at", "portal_access_logs", ["accessed_at"])
        op.create_index("ix_portal_access_logs_service", "portal_access_logs", ["service"])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if "portal_access_logs" in tables:
        op.drop_index("ix_portal_access_logs_service", table_name="portal_access_logs")
        op.drop_index("ix_portal_access_logs_accessed_at", table_name="portal_access_logs")
        op.drop_index("ix_portal_access_logs_user_id", table_name="portal_access_logs")
        op.drop_table("portal_access_logs")
