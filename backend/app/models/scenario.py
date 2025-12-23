"""
SQLAlchemy Models for Project Scenarios and Scenario Milestones
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    ForeignKey,
    DateTime,
    Text,
    Float,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class ProjectScenario(Base):
    """프로젝트 시나리오 - 여러 일정 시나리오 관리"""

    __tablename__ = "project_scenarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    name = Column(String(100), nullable=False)  # e.g., "Baseline", "Option A"
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=False)  # 현재 활성 시나리오
    is_baseline = Column(Boolean, default=False)  # 기준 시나리오 여부
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="scenarios")
    milestones = relationship(
        "ScenarioMilestone", back_populates="scenario", cascade="all, delete-orphan"
    )
    resource_plans = relationship(
        "ScenarioResourcePlan", back_populates="scenario", cascade="all, delete-orphan"
    )


class ScenarioMilestone(Base):
    """시나리오별 마일스톤 - 시나리오마다 다른 일정 관리"""

    __tablename__ = "scenario_milestones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(Integer, ForeignKey("project_scenarios.id"), nullable=False)
    # Reference to base milestone template (optional)
    base_milestone_id = Column(
        Integer, ForeignKey("project_milestones.id"), nullable=True
    )
    name = Column(String(100), nullable=False)  # e.g., "Gate 3", "Shipment"
    type = Column(String(20), nullable=False)  # STD_GATE, CUSTOM
    target_date = Column(DateTime, nullable=False)
    actual_date = Column(DateTime, nullable=True)
    status = Column(String(20), default="Pending")  # Pending, Completed, Delayed
    is_key_gate = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)  # 정렬 순서
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    scenario = relationship("ProjectScenario", back_populates="milestones")
    base_milestone = relationship("ProjectMilestone")


class ScenarioResourcePlan(Base):
    """시나리오별 리소스 계획 - 시나리오마다 다른 리소스 계획 관리"""

    __tablename__ = "scenario_resource_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(Integer, ForeignKey("project_scenarios.id"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)  # 1-12
    position_id = Column(String(50), ForeignKey("job_positions.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)  # NULL = TBD
    planned_hours = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    scenario = relationship("ProjectScenario", back_populates="resource_plans")
    position = relationship("JobPosition")
    user = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by])
