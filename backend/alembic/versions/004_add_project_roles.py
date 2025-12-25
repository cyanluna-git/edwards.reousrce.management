"""Add project_roles table and project_role_id to resource_plans

Revision ID: 004
Revises: 003_seed_admin_user
Create Date: 2025-12-25
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "004_add_project_roles"
down_revision = "003_seed_admin_user"
branch_labels = None
depends_on = None


def upgrade():
    # Create project_roles table
    op.create_table(
        "project_roles",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("std_hourly_rate", sa.Float, default=0.0),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # Add project_role_id to resource_plans (nullable for gradual migration)
    op.add_column(
        "resource_plans",
        sa.Column(
            "project_role_id",
            sa.String(50),
            sa.ForeignKey("project_roles.id"),
            nullable=True,
        ),
    )

    # Add level column to job_positions (FunctionalRole)
    op.add_column(
        "job_positions", sa.Column("level", sa.Integer, default=0, nullable=True)
    )

    # Seed initial project roles
    op.execute(
        """
        INSERT INTO project_roles (id, name, category, std_hourly_rate, is_active) VALUES
        ('PR_SW_ENG', 'Software Engineer', 'Engineering', 0, true),
        ('PR_HW_ENG', 'Hardware Engineer', 'Engineering', 0, true),
        ('PR_MECH_ENG', 'Mechanical Engineer', 'Engineering', 0, true),
        ('PR_CTRL_ENG', 'Controls Engineer', 'Engineering', 0, true),
        ('PR_SYS_ENG', 'Systems Engineer', 'Engineering', 0, true),
        ('PR_PROC_ENG', 'Process Engineer', 'Engineering', 0, true),
        ('PR_QA_ENG', 'Quality Engineer', 'Engineering', 0, true),
        ('PR_PM', 'Project Manager', 'Management', 0, true),
        ('PR_TECH_LEAD', 'Technical Lead', 'Management', 0, true),
        ('PR_SRC_ENG', 'Sourcing Engineer', 'Support', 0, true),
        ('PR_DES_ENG', 'Design Engineer', 'Engineering', 0, true),
        ('PR_SUST_ENG', 'Sustaining Engineer', 'Engineering', 0, true)
    """
    )


def downgrade():
    op.drop_column("job_positions", "level")
    op.drop_column("resource_plans", "project_role_id")
    op.drop_table("project_roles")
