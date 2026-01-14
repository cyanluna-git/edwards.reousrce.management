"""
SQLAlchemy Models for User and User History
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    """사용자"""

    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)  # English name
    korean_name = Column(String(100), nullable=True)  # Korean name
    department_id = Column(String(50), ForeignKey("departments.id"), nullable=False)
    sub_team_id = Column(String(50), ForeignKey("sub_teams.id"), nullable=True)
    position_id = Column(String(50), ForeignKey("job_positions.id"), nullable=False)
    role = Column(String(20), default="USER")  # ADMIN, PM, FM, USER
    is_active = Column(Boolean, default=True)
    hire_date = Column(DateTime, nullable=True)
    termination_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    department = relationship("Department", foreign_keys=[department_id])
    sub_team = relationship("SubTeam", back_populates="users")
    position = relationship("JobPosition", back_populates="users")
    history = relationship("UserHistory", back_populates="user")
    worklogs = relationship("WorkLog", back_populates="user")
    managed_projects = relationship("Project", back_populates="pm")
    resource_plans = relationship(
        "ResourcePlan", back_populates="user", foreign_keys="ResourcePlan.user_id"
    )
    created_resource_plans = relationship(
        "ResourcePlan", back_populates="creator", foreign_keys="ResourcePlan.created_by"
    )


class UserHistory(Base):
    """사용자 이력 - 부서 이동, 직급 변경 등 추적"""

    __tablename__ = "user_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    department_id = Column(String(50), ForeignKey("departments.id"), nullable=False)
    sub_team_id = Column(String(50), ForeignKey("sub_teams.id"), nullable=True)
    position_id = Column(String(50), ForeignKey("job_positions.id"), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)  # NULL = 현재
    change_type = Column(
        String(20), nullable=False
    )  # HIRE, TRANSFER_IN, TRANSFER_OUT, PROMOTION, RESIGN
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="history")
