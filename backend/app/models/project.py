"""
SQLAlchemy Models for Program, Project, and Milestones
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


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


class Project(Base):
    """프로젝트"""

    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    program_id = Column(String(50), ForeignKey("programs.id"), nullable=False)
    project_type_id = Column(String(20), ForeignKey("project_types.id"), nullable=False)
    code = Column(String(50), unique=True, nullable=False)  # IO Code
    name = Column(String(300), nullable=False)  # NVARCHAR
    status = Column(
        String(20), default="WIP"
    )  # WIP, Hold, Completed, Cancelled, Forecast
    complexity = Column(String(20), nullable=True)  # Simple, Derivative, Complex
    pm_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    customer = Column(String(100), nullable=True)
    product = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    program = relationship("Program", back_populates="projects")
    project_type = relationship("ProjectType", back_populates="projects")
    pm = relationship("User", back_populates="managed_projects")
    milestones = relationship("ProjectMilestone", back_populates="project")
    worklogs = relationship("WorkLog", back_populates="project")
    resource_plans = relationship("ResourcePlan", back_populates="project")


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
