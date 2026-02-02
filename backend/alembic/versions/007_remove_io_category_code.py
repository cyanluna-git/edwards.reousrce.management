"""Remove io_category_code column from projects table

Standard IO Framework is being replaced with separate Internal IO and Recharge IO
management strategies. The io_category_code field is no longer needed.

Revision ID: 007
Revises: 006
Create Date: 2026-02-01
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '007_remove_io_category_code'
down_revision = '006_add_recharge_io_to_projects'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Remove io_category_code column from projects table"""
    # Drop the io_category_code column
    op.drop_column('projects', 'io_category_code')


def downgrade() -> None:
    """Restore io_category_code column to projects table"""
    op.add_column(
        'projects',
        sa.Column('io_category_code', sa.String(100), nullable=True)
    )
