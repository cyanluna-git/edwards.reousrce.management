"""
SQLAlchemy Models for Program, Project, and Milestones
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    ForeignKey,
    DateTime,
    Text,
    Table,
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.scenario import ProjectScenario  # Explicitly import ProjectScenario


def generate_uuid():
    return str(uuid.uuid4())


class Program(Base):
    """프로그램 - 프로젝트 그룹"""

    __tablename__ = "programs"

    id = Column(String(50), primary_key=True)  # e.g., "PRG_EUV_NPI"
    name = Column(String(200), nullable=False)  # NVARCHAR
    business_unit_id = Column(
        String(50), ForeignKey("business_units.id"), nullable=False
    )
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    business_unit = relationship("BusinessUnit", back_populates="programs")
    projects = relationship("Project", back_populates="program")


class ProjectType(Base):
    """프로젝트 유형"""

    __tablename__ = "project_types"

    id = Column(String(20), primary_key=True)  # e.g., "NPI", "ETO", "CIP"
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    # Relationships
    projects = relationship("Project", back_populates="project_type")


class ProductLine(Base):
    """제품군 - 제품 라인/패밀리 분류"""

    __tablename__ = "product_lines"

    id = Column(String(50), primary_key=True)  # e.g., "PL_GEN3", "PL_GEN4"
    name = Column(String(100), nullable=False)  # e.g., "Gen3", "Gen4", "Ruby"
    code = Column(String(50), unique=True, nullable=False)

    # 사업영역 연결 (NEW)
    business_unit_id = Column(
        String(50), ForeignKey("business_units.id"), nullable=True
    )

    # 제품군 카테고리: PRODUCT, PLATFORM, LEGACY
    line_category = Column(String(20), default="PRODUCT")

    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    business_unit = relationship("BusinessUnit", back_populates="product_lines")
    projects = relationship("Project", back_populates="product_line")
    worklogs = relationship("WorkLog", back_populates="product_line")


# 프로젝트 ↔ 제품군 다대다 관계 (Cross-Family 프로젝트 지원)
project_product_lines = Table(
    "project_product_lines",
    Base.metadata,
    Column("project_id", String(36), ForeignKey("projects.id"), primary_key=True),
    Column(
        "product_line_id", String(50), ForeignKey("product_lines.id"), primary_key=True
    ),
)


class Project(Base):
    """프로젝트"""

    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    program_id = Column(String(50), ForeignKey("programs.id"), nullable=False)
    project_type_id = Column(String(20), ForeignKey("project_types.id"), nullable=False)
    code = Column(String(50), unique=True, nullable=False)  # IO Code
    name = Column(String(300), nullable=False)  # NVARCHAR
    status = Column(
        String(20), default="Prospective"
    )  # Prospective, Planned, InProgress, OnHold, Cancelled, Completed
    category = Column(String(20), default="PRODUCT")  # PRODUCT, FUNCTIONAL
    scale = Column(String(20), nullable=True)  # CIP, A&D, Simple, Complex, Platform

    # Primary product line (for backward compatibility)
    product_line_id = Column(String(50), ForeignKey("product_lines.id"), nullable=True)

    # Functional Project 전용: 소속 팀 (NEW)
    owner_department_id = Column(
        String(50), ForeignKey("departments.id"), nullable=True
    )

    pm_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    start_month = Column(String(7), nullable=True)  # YYYY-MM format (e.g., "2025-01")
    end_month = Column(String(7), nullable=True)  # YYYY-MM format (e.g., "2025-12")
    customer = Column(String(100), nullable=True)
    product = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)

    # Financial Routing (v2.0 - Recharge & Planning System)
    funding_entity_id = Column(String(50), nullable=True)  # FK to dim_funding_entity
    recharge_status = Column(String(20), nullable=True)  # BILLABLE, NON_BILLABLE, INTERNAL
    io_category_code = Column(String(100), nullable=True)  # Maps to IO Framework Programme
    is_capitalizable = Column(Boolean, default=False)  # CAPEX vs OPEX
    gl_account_code = Column(String(50), nullable=True)  # General Ledger account

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    program = relationship("Program", back_populates="projects")
    project_type = relationship("ProjectType", back_populates="projects")
    product_line = relationship("ProductLine", back_populates="projects")

    # 다대다 관계: 여러 제품군에 걸치는 프로젝트 지원 (NEW)
    product_lines = relationship(
        "ProductLine", secondary=project_product_lines, backref="multi_projects"
    )

    # Functional Project 소속 팀 (NEW)
    owner_department = relationship("Department", back_populates="owned_projects")

    pm = relationship("User", back_populates="managed_projects")
    milestones = relationship("ProjectMilestone", back_populates="project")
    worklogs = relationship("WorkLog", back_populates="project")
    resource_plans = relationship("ResourcePlan", back_populates="project")
    scenarios = relationship(
        "ProjectScenario", back_populates="project", cascade="all, delete-orphan"
    )


class ProjectMilestone(Base):
    """프로젝트 마일스톤"""

    __tablename__ = "project_milestones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    name = Column(String(100), nullable=False)  # e.g., "Gate 3", "Shipment"
    type = Column(String(20), nullable=False)  # STD_GATE, CUSTOM
    target_date = Column(DateTime, nullable=False)
    actual_date = Column(DateTime, nullable=True)
    status = Column(String(20), default="Pending")  # Pending, Completed, Delayed
    is_key_gate = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="milestones")
