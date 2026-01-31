"""
SQLAlchemy Model for Recharge IO

Recharge IO is used for cost recharging purposes.
Multiple projects can share the same Recharge IO for billing aggregation.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class RechargeIO(Base):
    """Recharge IO - 비용 청구용 IO

    Used for cost recharging and billing purposes.
    Multiple projects can share the same Recharge IO.
    """

    __tablename__ = "recharge_ios"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    io_number = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)

    # Status and metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="recharge_io")

    def __repr__(self):
        return f"<RechargeIO(io_number='{self.io_number}', name='{self.name}')>"
