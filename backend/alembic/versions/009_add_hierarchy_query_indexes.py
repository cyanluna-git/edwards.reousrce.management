"""Add indexes for project hierarchy queries

Revision ID: 009_add_hierarchy_query_indexes
Revises: 008_add_bu_routing
Create Date: 2026-02-01

Optimizes get_project_hierarchy() queries:
- Composite index on (category, status) for filtered queries
- FK indexes for JOIN operations
- Partial index for active projects only
"""

from alembic import op


# revision identifiers, used by Alembic
revision = "009_add_hierarchy_query_indexes"
down_revision = "008_add_bu_routing"
branch_labels = None
depends_on = None


def upgrade():
    # ============ Composite Indexes for category + status filtering ============
    # Most hierarchy queries filter by category AND status
    op.create_index(
        "ix_projects_category_status",
        "projects",
        ["category", "status"],
        unique=False,
    )

    # For product projects: category + status + product_line_id
    op.create_index(
        "ix_projects_category_status_product_line",
        "projects",
        ["category", "status", "product_line_id"],
        unique=False,
    )

    # For functional projects: category + status + owner_department_id
    op.create_index(
        "ix_projects_category_status_owner_dept",
        "projects",
        ["category", "status", "owner_department_id"],
        unique=False,
    )

    # ============ FK Indexes for JOIN performance ============
    # product_line_id - used in JOIN with product_lines table
    op.create_index(
        "ix_projects_product_line_id",
        "projects",
        ["product_line_id"],
        unique=False,
    )

    # owner_department_id - used in JOIN with departments table
    op.create_index(
        "ix_projects_owner_department_id",
        "projects",
        ["owner_department_id"],
        unique=False,
    )

    # product_lines.business_unit_id - used in JOIN with business_units
    op.create_index(
        "ix_product_lines_business_unit_id",
        "product_lines",
        ["business_unit_id"],
        unique=False,
    )

    # ============ Partial Index for Active Projects ============
    # Most queries only need active projects - smaller, faster index
    op.execute(
        """
        CREATE INDEX ix_projects_active_category_pl
        ON projects (category, product_line_id)
        WHERE status IN ('InProgress', 'Prospective', 'Planned')
        """
    )


def downgrade():
    # Drop partial index
    op.execute("DROP INDEX IF EXISTS ix_projects_active_category_pl")

    # Drop FK indexes
    op.drop_index("ix_product_lines_business_unit_id", table_name="product_lines")
    op.drop_index("ix_projects_owner_department_id", table_name="projects")
    op.drop_index("ix_projects_product_line_id", table_name="projects")

    # Drop composite indexes
    op.drop_index("ix_projects_category_status_owner_dept", table_name="projects")
    op.drop_index("ix_projects_category_status_product_line", table_name="projects")
    op.drop_index("ix_projects_category_status", table_name="projects")
