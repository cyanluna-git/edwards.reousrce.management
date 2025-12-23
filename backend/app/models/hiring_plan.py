"""
SQLAlchemy Model for Hiring Plan
Used for future resource capacity forecasting
"""

import uuid
from datetime import datetime, date
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    ForeignKey,
    DateTime,
    Date,
    Text,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class HiringPlan(Base):
    """채용 계획 - 미래 리소스 예측"""

    __tablename__ = "hiring_plans"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    department_id = Column(String(50), ForeignKey("departments.id"), nullable=False)
    position_id = Column(String(50), ForeignKey("job_positions.id"), nullable=True)
    target_date = Column(Date, nullable=False)  # 예상 입사일
    headcount = Column(Integer, default=1, nullable=False)  # 채용 예정 인원
    status = Column(String(20), default="PLANNED", nullable=False)
    # Status: PLANNED, APPROVED, IN_PROGRESS, FILLED, CANCELLED
    remarks = Column(Text, nullable=True)
    hired_user_id = Column(
        String(36), ForeignKey("users.id"), nullable=True
    )  # 실제 채용된 사용자
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    department = relationship("Department")
    position = relationship("JobPosition")
    hired_user = relationship("User")
