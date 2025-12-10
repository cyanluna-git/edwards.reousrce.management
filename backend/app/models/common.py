"""
SQLAlchemy Models for Common Codes and Holidays
"""

from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text
from app.core.database import Base


class CommonCode(Base):
    """공통 코드"""

    __tablename__ = "common_codes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_code = Column(String(50), nullable=False)  # e.g., "WORK_TYPE", "MEETING_TYPE"
    code_id = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)  # NVARCHAR
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Holiday(Base):
    """공휴일"""

    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(DateTime, nullable=False)
    name = Column(String(100), nullable=False)  # NVARCHAR
    type = Column(String(20), nullable=False)  # LEGAL, COMPANY
    year = Column(Integer, nullable=False)  # For quick filtering
    created_at = Column(DateTime, default=datetime.utcnow)
