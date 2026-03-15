"""Add resource_plan_histories table

Revision ID: 7f1c0d4d9a2e
Revises: 4f4f8f9f2b52
Create Date: 2026-03-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7f1c0d4d9a2e"
down_revision: Union[str, None] = "4f4f8f9f2b52"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if "resource_plan_histories" not in tables:
        op.create_table(
            "resource_plan_histories",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("resource_plan_id", sa.Integer(), nullable=True),
            sa.Column("project_id", sa.String(length=36), nullable=False),
            sa.Column("year", sa.Integer(), nullable=False),
            sa.Column("month", sa.Integer(), nullable=False),
            sa.Column("position_id", sa.String(length=50), nullable=False),
            sa.Column("project_role_id", sa.String(length=50), nullable=True),
            sa.Column("user_id", sa.String(length=36), nullable=True),
            sa.Column("actor_user_id", sa.String(length=36), nullable=False),
            sa.Column("actor_user_name", sa.String(length=100), nullable=False),
            sa.Column("change_type", sa.String(length=20), nullable=False),
            sa.Column("before_snapshot", sa.Text(), nullable=True),
            sa.Column("after_snapshot", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["position_id"], ["job_positions.id"]),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.ForeignKeyConstraint(["project_role_id"], ["project_roles.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if "resource_plan_histories" in tables:
        op.drop_table("resource_plan_histories")
