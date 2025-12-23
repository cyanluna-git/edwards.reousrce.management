"""
SQLAlchemy Models for Organization Structure
BusinessUnit > Department > SubTeam > JobPosition
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    ForeignKey,
    Float,
    DateTime,
    Text,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class BusinessUnit(Base):
    """사업부/사업영역"""

    __tablename__ = "business_units"

    id = Column(String(50), primary_key=True)  # e.g., "BU_IS", "BU_ABT"
    name = Column(String(100), nullable=False)  # NVARCHAR
    code = Column(String(20), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    departments = relationship("Department", back_populates="business_unit")
    programs = relationship("Program", back_populates="business_unit")


class Department(Base):
    """팀/부서"""

    __tablename__ = "departments"

    id = Column(String(50), primary_key=True)
    business_unit_id = Column(
        String(50), ForeignKey("business_units.id"), nullable=False
    )
    name = Column(String(100), nullable=False)  # NVARCHAR
    code = Column(String(50), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    business_unit = relationship("BusinessUnit", back_populates="departments")
    sub_teams = relationship("SubTeam", back_populates="department")
    users = relationship("User", back_populates="department")


class SubTeam(Base):
    """소그룹/파트"""

    __tablename__ = "sub_teams"

    id = Column(String(50), primary_key=True)
    department_id = Column(String(50), ForeignKey("departments.id"), nullable=False)
    name = Column(String(100), nullable=False)  # NVARCHAR
    code = Column(String(50), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    department = relationship("Department", back_populates="sub_teams")
    users = relationship("User", back_populates="sub_team")


class JobPosition(Base):
    """직급/직무 - 전사 공통 (부서 독립적)"""

    __tablename__ = "job_positions"

    id = Column(String(50), primary_key=True)  # e.g., "JP_ENGINEER"
    name = Column(String(100), nullable=False)  # NVARCHAR
    std_hourly_rate = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="position")
    resource_plans = relationship("ResourcePlan", back_populates="position")
