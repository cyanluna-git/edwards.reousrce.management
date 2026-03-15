"""
SQLAlchemy Model for weekly reports.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class WeeklyReport(Base):
    """Unified weekly report aggregate for personal, team, and sub-team contexts."""

    __tablename__ = "weekly_reports"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    scope = Column(String(20), nullable=False)  # user | team
    team_scope_type = Column(String(20), nullable=True)  # department | sub_team | NULL
    scope_id = Column(String(50), nullable=False)
    target_key = Column(String(80), nullable=False, index=True)

    week_start = Column(Date, nullable=False)
    week_end = Column(Date, nullable=False)
    week_key = Column(String(10), nullable=False)

    status = Column(String(20), nullable=False, default="draft")
    title = Column(String(200), nullable=True)
    markdown_body = Column(Text, nullable=False, default="")
    source_metadata = Column(JSONB, nullable=True)

    owner_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    updated_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    published_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)

    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner_user = relationship("User", foreign_keys=[owner_user_id])
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    updated_by_user = relationship("User", foreign_keys=[updated_by_user_id])
    published_by_user = relationship("User", foreign_keys=[published_by_user_id])

    __table_args__ = (
        UniqueConstraint("target_key", "week_start", name="uq_weekly_reports_target_week"),
        Index(
            "ix_weekly_reports_scope_week",
            "scope",
            "team_scope_type",
            "scope_id",
            "week_start",
        ),
    )
