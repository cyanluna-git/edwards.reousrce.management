"""Initial schema creation

Revision ID: 001_initial_schema
Revises:
Create Date: 2024-12-10

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === Organization Structure ===

    # BusinessUnits
    op.create_table(
        "business_units",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("name", sa.NVARCHAR(100), nullable=False),
        sa.Column("code", sa.String(20), unique=True, nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # Departments
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "business_unit_id",
            sa.String(50),
            sa.ForeignKey("business_units.id"),
            nullable=False,
        ),
        sa.Column("name", sa.NVARCHAR(100), nullable=False),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # SubTeams
    op.create_table(
        "sub_teams",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "department_id",
            sa.Integer(),
            sa.ForeignKey("departments.id"),
            nullable=False,
        ),
        sa.Column("name", sa.NVARCHAR(100), nullable=False),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # JobPositions
    op.create_table(
        "job_positions",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("name", sa.NVARCHAR(100), nullable=False),
        sa.Column(
            "department_id",
            sa.Integer(),
            sa.ForeignKey("departments.id"),
            nullable=False,
        ),
        sa.Column(
            "sub_team_id", sa.Integer(), sa.ForeignKey("sub_teams.id"), nullable=True
        ),
        sa.Column("std_hourly_rate", sa.Float(), default=0.0),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # === Users ===

    # Users
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("name", sa.NVARCHAR(100), nullable=False),
        sa.Column("korean_name", sa.NVARCHAR(100), nullable=True),
        sa.Column(
            "department_id",
            sa.Integer(),
            sa.ForeignKey("departments.id"),
            nullable=False,
        ),
        sa.Column(
            "sub_team_id", sa.Integer(), sa.ForeignKey("sub_teams.id"), nullable=True
        ),
        sa.Column(
            "position_id",
            sa.String(50),
            sa.ForeignKey("job_positions.id"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), default="USER"),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("hire_date", sa.DateTime(), nullable=True),
        sa.Column("termination_date", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # UserHistory
    op.create_table(
        "user_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "department_id",
            sa.Integer(),
            sa.ForeignKey("departments.id"),
            nullable=False,
        ),
        sa.Column(
            "sub_team_id", sa.Integer(), sa.ForeignKey("sub_teams.id"), nullable=True
        ),
        sa.Column(
            "position_id",
            sa.String(50),
            sa.ForeignKey("job_positions.id"),
            nullable=False,
        ),
        sa.Column("start_date", sa.DateTime(), nullable=False),
        sa.Column("end_date", sa.DateTime(), nullable=True),
        sa.Column("change_type", sa.String(20), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # === Programs & Projects ===

    # Programs
    op.create_table(
        "programs",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("name", sa.NVARCHAR(200), nullable=False),
        sa.Column(
            "business_unit_id",
            sa.String(50),
            sa.ForeignKey("business_units.id"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # ProjectTypes
    op.create_table(
        "project_types",
        sa.Column("id", sa.String(20), primary_key=True),
        sa.Column("name", sa.NVARCHAR(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), default=True),
    )

    # Projects
    op.create_table(
        "projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "program_id", sa.String(50), sa.ForeignKey("programs.id"), nullable=False
        ),
        sa.Column(
            "project_type_id",
            sa.String(20),
            sa.ForeignKey("project_types.id"),
            nullable=False,
        ),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("name", sa.NVARCHAR(300), nullable=False),
        sa.Column("status", sa.String(20), default="WIP"),
        sa.Column("complexity", sa.String(20), nullable=True),
        sa.Column("pm_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("start_date", sa.DateTime(), nullable=True),
        sa.Column("end_date", sa.DateTime(), nullable=True),
        sa.Column("customer", sa.NVARCHAR(100), nullable=True),
        sa.Column("product", sa.NVARCHAR(200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # ProjectMilestones
    op.create_table(
        "project_milestones",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False
        ),
        sa.Column("name", sa.NVARCHAR(100), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("target_date", sa.DateTime(), nullable=False),
        sa.Column("actual_date", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(20), default="Pending"),
        sa.Column("is_key_gate", sa.Boolean(), default=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # === Resource Planning & WorkLogs ===

    # ResourcePlans
    op.create_table(
        "resource_plans",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False
        ),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column(
            "position_id",
            sa.String(50),
            sa.ForeignKey("job_positions.id"),
            nullable=False,
        ),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("planned_hours", sa.Float(), default=0.0),
        sa.Column(
            "created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # WorkLogs
    op.create_table(
        "worklogs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("date", sa.DateTime(), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False
        ),
        sa.Column("work_type", sa.String(50), nullable=False),
        sa.Column("hours", sa.Float(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("meeting_type", sa.String(50), nullable=True),
        sa.Column("is_sudden_work", sa.Boolean(), default=False),
        sa.Column("is_business_trip", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # === Master Data ===

    # CommonCodes
    op.create_table(
        "common_codes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("group_code", sa.String(50), nullable=False),
        sa.Column("code_id", sa.String(50), nullable=False),
        sa.Column("name", sa.NVARCHAR(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), default=0),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_unique_constraint(
        "uq_common_codes_group_code", "common_codes", ["group_code", "code_id"]
    )

    # Holidays
    op.create_table(
        "holidays",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("date", sa.DateTime(), nullable=False),
        sa.Column("name", sa.NVARCHAR(100), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # === Indexes for performance ===
    op.create_index("ix_worklogs_date", "worklogs", ["date"])
    op.create_index("ix_worklogs_user_id", "worklogs", ["user_id"])
    op.create_index("ix_worklogs_project_id", "worklogs", ["project_id"])
    op.create_index(
        "ix_resource_plans_project_year_month",
        "resource_plans",
        ["project_id", "year", "month"],
    )
    op.create_index("ix_holidays_year", "holidays", ["year"])


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_holidays_year", "holidays")
    op.drop_index("ix_resource_plans_project_year_month", "resource_plans")
    op.drop_index("ix_worklogs_project_id", "worklogs")
    op.drop_index("ix_worklogs_user_id", "worklogs")
    op.drop_index("ix_worklogs_date", "worklogs")

    # Drop tables in reverse order
    op.drop_table("holidays")
    op.drop_table("common_codes")
    op.drop_table("worklogs")
    op.drop_table("resource_plans")
    op.drop_table("project_milestones")
    op.drop_table("projects")
    op.drop_table("project_types")
    op.drop_table("programs")
    op.drop_table("user_history")
    op.drop_table("users")
    op.drop_table("job_positions")
    op.drop_table("sub_teams")
    op.drop_table("departments")
    op.drop_table("business_units")
