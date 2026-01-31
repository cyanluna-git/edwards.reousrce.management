"""
SQLAlchemy Model for Internal IO (Internal Order)

Internal IO is a financial tracking code used to track costs across multiple projects.
Multiple projects can share the same Internal IO for cost aggregation.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class InternalIO(Base):
    """Internal IO (Internal Order) - 내부 주문 번호

    Used for financial tracking and cost aggregation.
    Multiple projects can share the same IO number.
    """

    __tablename__ = "internal_ios"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    io_number = Column(String(50), unique=True, nullable=False, index=True)  # e.g., "406435", "PRJ-55"
    name = Column(String(200), nullable=True)  # Optional descriptive name
    description = Column(Text, nullable=True)

    # Status and metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="internal_io")

    def __repr__(self):
        return f"<InternalIO(io_number='{self.io_number}', name='{self.name}')>"
