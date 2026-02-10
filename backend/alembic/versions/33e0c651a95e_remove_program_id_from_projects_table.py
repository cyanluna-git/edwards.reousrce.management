"""Remove program_id from projects table

Revision ID: 33e0c651a95e
Revises: cff98cffb026
Create Date: 2026-02-10 13:23:17.405907

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '33e0c651a95e'
down_revision: Union[str, None] = 'cff98cffb026'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop foreign key constraint first
    op.drop_constraint('projects_program_id_fkey', 'projects', type_='foreignkey')

    # Drop the program_id column
    op.drop_column('projects', 'program_id')


def downgrade() -> None:
    # Re-add program_id column as nullable
    op.add_column('projects',
        sa.Column('program_id', sa.String(length=50), nullable=True)
    )

    # Re-add foreign key constraint
    op.create_foreign_key(
        'projects_program_id_fkey',
        'projects', 'programs',
        ['program_id'], ['id']
    )
