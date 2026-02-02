"""
AI Summary Cache Model
Stores generated AI summaries to avoid repeated LLM calls
"""

from datetime import datetime, date
from sqlalchemy import Column, String, Date, DateTime, Text, Index
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class AISummary(Base):
    """Cache table for AI-generated summaries"""

    __tablename__ = "ai_summary"

    id = Column(String(36), primary_key=True)
    scope = Column(String(20), nullable=False)  # 'user' or 'team'
    scope_id = Column(String(36), nullable=False)  # user_id or team_id
    team_type = Column(
        String(20), nullable=True
    )  # NULL, 'sub_team', 'department', 'business_unit'
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    summary_data = Column(JSONB, nullable=False)  # Generated summary JSON
    generated_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Composite index for efficient cache lookup
    __table_args__ = (
        Index(
            "ix_ai_summary_lookup", "scope", "scope_id", "period_start", "period_end"
        ),
    )
