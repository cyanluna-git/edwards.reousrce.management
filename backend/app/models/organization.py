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


class Division(Base):
    """본부/사업부 (Level 0)"""

    __tablename__ = "divisions"

    id = Column(String(50), primary_key=True)  # e.g., "DIV_ENG"
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    departments = relationship("Department", back_populates="division")


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
    programs = relationship("Program", back_populates="business_unit")
    product_lines = relationship("ProductLine", back_populates="business_unit")


class Department(Base):
    """팀/부서"""

    __tablename__ = "departments"

    id = Column(String(50), primary_key=True)
    division_id = Column(
        String(50), ForeignKey("divisions.id"), nullable=True
    )  # Parent Division
    name = Column(String(100), nullable=False)  # NVARCHAR
    code = Column(String(50), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    division = relationship("Division", back_populates="departments")
    sub_teams = relationship("SubTeam", back_populates="department")
    owned_projects = relationship(
        "Project", back_populates="owner_department"
    )  # NEW: Functional Projects


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
    """
    조직 내 공식 직책/직급 (FunctionalRole) - 회사에서 부여한 Job Title
    예: Manager, Function Leader, Tech Lead, Senior Engineer, Junior Engineer
    기존 호환성을 위해 테이블명 job_positions 유지
    """

    __tablename__ = "job_positions"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    level = Column(Integer, default=0)  # 직급 레벨 (정렬/비교용)
    std_hourly_rate = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="position")
    resource_plans = relationship("ResourcePlan", back_populates="position")


class ProjectRole(Base):
    """
    프로젝트 수행 역할 - 프로젝트에서의 기술적 역할
    예: SW Engineer, HW Engineer, Mechanical Engineer, PM, Controls Engineer
    """

    __tablename__ = "project_roles"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=True)  # Engineering, Management, Support
    std_hourly_rate = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    resource_plans = relationship("ResourcePlan", back_populates="project_role")


# Alias for conceptual clarity
FunctionalRole = JobPosition
