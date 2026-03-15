"""Add seen_release_note_version to users

Revision ID: 4f4f8f9f2b52
Revises: 33e0c651a95e
Create Date: 2026-03-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4f4f8f9f2b52"
down_revision: Union[str, None] = "33e0c651a95e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("users")]

    if "seen_release_note_version" not in columns:
        op.add_column(
            "users",
            sa.Column("seen_release_note_version", sa.String(length=100), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("users")]

    if "seen_release_note_version" in columns:
        op.drop_column("users", "seen_release_note_version")
