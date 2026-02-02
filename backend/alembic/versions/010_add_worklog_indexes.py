"""Add indexes for worklogs table

Revision ID: 010_add_worklog_indexes
Revises: 009_add_hierarchy_query_indexes
Create Date: 2026-02-02

Performance optimization: Add indexes for resource matrix queries
- Composite index for date range queries with user/project filters
- Indexes for user-based and project-based aggregations
- Date-only index for common queries
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010_add_worklog_indexes'
down_revision = '009_add_hierarchy_query_indexes'
branch_labels = None
depends_on = None


def upgrade():
    # Composite index for date range queries with user/project filters
    op.create_index(
        'ix_worklogs_date_user_project',
        'worklogs',
        ['date', 'user_id', 'project_id'],
        unique=False
    )
    
    # Index for user-based aggregations
    op.create_index(
        'ix_worklogs_user_date',
        'worklogs',
        ['user_id', 'date'],
        unique=False
    )
    
    # Index for project-based aggregations
    op.create_index(
        'ix_worklogs_project_date',
        'worklogs',
        ['project_id', 'date'],
        unique=False
    )
    
    # Index for date-only queries (common in resource matrix)
    op.create_index(
        'ix_worklogs_date',
        'worklogs',
        ['date'],
        unique=False
    )


def downgrade():
    op.drop_index('ix_worklogs_date', table_name='worklogs')
    op.drop_index('ix_worklogs_project_date', table_name='worklogs')
    op.drop_index('ix_worklogs_user_date', table_name='worklogs')
    op.drop_index('ix_worklogs_date_user_project', table_name='worklogs')
