"""Drop project_types table

Revision ID: cff98cffb026
Revises: 90a10d1ca994
Create Date: 2026-02-10 12:59:26.911168

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cff98cffb026'
down_revision: Union[str, None] = '90a10d1ca994'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the project_types table as it's no longer used
    op.drop_table('project_types')


def downgrade() -> None:
    # Recreate the project_types table if needed for rollback
    op.create_table(
        'project_types',
        sa.Column('id', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.PrimaryKeyConstraint('id')
    )
