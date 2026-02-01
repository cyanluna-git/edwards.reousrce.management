"""Add BU routing system for automatic IO selection

- Add primary_business_unit_id to users table
- Create recharge_io_business_units M:N table
- Add business_unit_id to internal_ios table
- Update project category to support SUPPORT type

Revision ID: 008_add_bu_routing
Revises: 007_remove_io_category_code
Create Date: 2026-02-01
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision: str = "008_add_bu_routing"
down_revision: Union[str, None] = "007_remove_io_category_code"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add primary_business_unit_id to users table
    op.add_column(
        "users",
        sa.Column(
            "primary_business_unit_id",
            sa.String(50),
            sa.ForeignKey("business_units.id"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_users_primary_business_unit_id",
        "users",
        ["primary_business_unit_id"],
    )

    # 2. Create recharge_io_business_units M:N table
    op.create_table(
        "recharge_io_business_units",
        sa.Column(
            "recharge_io_id",
            sa.String(36),
            sa.ForeignKey("recharge_ios.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "business_unit_id",
            sa.String(50),
            sa.ForeignKey("business_units.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("created_at", sa.DateTime(), default=datetime.utcnow),
    )

    # 3. Add business_unit_id to internal_ios table
    op.add_column(
        "internal_ios",
        sa.Column(
            "business_unit_id",
            sa.String(50),
            sa.ForeignKey("business_units.id"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_internal_ios_business_unit_id",
        "internal_ios",
        ["business_unit_id"],
    )


def downgrade() -> None:
    # Remove business_unit_id from internal_ios
    op.drop_index("ix_internal_ios_business_unit_id", table_name="internal_ios")
    op.drop_column("internal_ios", "business_unit_id")

    # Drop recharge_io_business_units table
    op.drop_table("recharge_io_business_units")

    # Remove primary_business_unit_id from users
    op.drop_index("ix_users_primary_business_unit_id", table_name="users")
    op.drop_column("users", "primary_business_unit_id")
