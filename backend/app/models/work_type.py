"""
SQLAlchemy Model for Work Type Categories
Hierarchical structure: L1 (대분류) -> L2 (소분류) -> L3 (상세분류)
"""

from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class WorkTypeCategory(Base):
    """업무 유형 카테고리 (계층적)"""

    __tablename__ = "work_type_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(
        String(20), unique=True, nullable=False
    )  # e.g., "ENG", "ENG-SW", "ENG-SW-COD"
    name = Column(String(100), nullable=False)  # Display name
    name_ko = Column(String(100), nullable=True)  # Korean name
    description = Column(Text, nullable=True)
    level = Column(Integer, nullable=False)  # 1, 2, or 3
    parent_id = Column(Integer, ForeignKey("work_type_categories.id"), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    # Job roles that can use this category (comma-separated or null for all)
    # e.g., "SW_ENGINEER,SYSTEM_ENGINEER" or null for universal
    applicable_roles = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Self-referential relationship
    parent = relationship("WorkTypeCategory", remote_side=[id], backref="children")


# Legacy work_type mapping table for migration
class WorkTypeLegacyMapping(Base):
    """기존 work_type 문자열 -> 새 카테고리 매핑"""

    __tablename__ = "work_type_legacy_mappings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    legacy_work_type = Column(
        String(100), unique=True, nullable=False
    )  # e.g., "Meeting"
    category_id = Column(Integer, ForeignKey("work_type_categories.id"), nullable=False)

    category = relationship("WorkTypeCategory")
