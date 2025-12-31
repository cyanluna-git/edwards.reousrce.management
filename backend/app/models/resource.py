"""
SQLAlchemy Models for Resource Planning and WorkLogs
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    ForeignKey,
    DateTime,
    Date,
    Text,
    Float,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class ResourcePlan(Base):
    """리소스 계획 - 월단위"""

    __tablename__ = "resource_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)  # 1-12
    position_id = Column(String(50), ForeignKey("job_positions.id"), nullable=False)
    project_role_id = Column(
        String(50), ForeignKey("project_roles.id"), nullable=True
    )  # NEW: 프로젝트 역할
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)  # NULL = TBD
    planned_hours = Column(Float, default=0.0)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="resource_plans")
    position = relationship("JobPosition", back_populates="resource_plans")
    project_role = relationship("ProjectRole", back_populates="resource_plans")
    user = relationship("User", back_populates="resource_plans", foreign_keys=[user_id])
    creator = relationship(
        "User", back_populates="created_resource_plans", foreign_keys=[created_by]
    )


class WorkLog(Base):
    """실적 기록"""

    __tablename__ = "worklogs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    # 프로젝트 연결 (nullable - 비프로젝트 업무 or 제품군 일반 지원 가능)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=True)

    # 제품군 직접 연결 (NEW) - 프로젝트 없이 제품군 지원 업무
    product_line_id = Column(String(50), ForeignKey("product_lines.id"), nullable=True)

    work_type = Column(String(50), nullable=False)  # Legacy - keep for compatibility
    work_type_category_id = Column(
        Integer, ForeignKey("work_type_categories.id"), nullable=True
    )  # New hierarchical category
    hours = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    meeting_type = Column(
        String(50), nullable=True
    )  # Decision Making, Information Sharing, etc.
    is_sudden_work = Column(Boolean, default=False)
    is_business_trip = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="worklogs")
    project = relationship("Project", back_populates="worklogs")
    product_line = relationship("ProductLine", back_populates="worklogs")  # NEW
    work_type_category = relationship("WorkTypeCategory")
