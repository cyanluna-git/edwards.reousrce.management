"""
SQLAlchemy Model for Portal Access Logs
"""

from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class PortalAccessLog(Base):
    """포털 서비스 접속 로그"""

    __tablename__ = "portal_access_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    service = Column(String(20), nullable=False, index=True)
    accessed_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
