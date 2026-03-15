"""
Service layer for portal access logging and statistics
"""

from datetime import datetime, timedelta
from typing import List
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.portal_access_log import PortalAccessLog
from app.models.user import User


class PortalService:
    def __init__(self, db: Session):
        self.db = db

    def log_access(self, user_id: str, service: str) -> PortalAccessLog:
        """Record a portal service access event."""
        log = PortalAccessLog(
            user_id=user_id,
            service=service,
            accessed_at=datetime.utcnow(),
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def get_stats(self) -> dict:
        """Get portal usage statistics for the last 30 days."""
        since = datetime.utcnow() - timedelta(days=30)

        # Service counts
        service_rows = (
            self.db.query(PortalAccessLog.service, func.count(PortalAccessLog.id))
            .filter(PortalAccessLog.accessed_at >= since)
            .group_by(PortalAccessLog.service)
            .all()
        )
        service_counts = {row[0]: row[1] for row in service_rows}

        # Top users (LIMIT 10)
        top_user_rows = (
            self.db.query(
                PortalAccessLog.user_id,
                User.name,
                func.count(PortalAccessLog.id).label("cnt"),
            )
            .join(User, User.id == PortalAccessLog.user_id)
            .filter(PortalAccessLog.accessed_at >= since)
            .group_by(PortalAccessLog.user_id, User.name)
            .order_by(func.count(PortalAccessLog.id).desc())
            .limit(10)
            .all()
        )
        top_users = [
            {"user_id": row[0], "name": row[1], "count": row[2]}
            for row in top_user_rows
        ]

        # Hourly activity
        hourly_rows = (
            self.db.query(
                func.extract("hour", PortalAccessLog.accessed_at).label("hr"),
                func.count(PortalAccessLog.id),
            )
            .filter(PortalAccessLog.accessed_at >= since)
            .group_by("hr")
            .order_by("hr")
            .all()
        )
        hourly_activity = [
            {"hour": int(row[0]), "count": row[1]}
            for row in hourly_rows
        ]

        return {
            "service_counts": service_counts,
            "top_users": top_users,
            "hourly_activity": hourly_activity,
        }

    def get_my_history(self, user_id: str, limit: int = 50) -> List[PortalAccessLog]:
        """Get access history for a specific user."""
        return (
            self.db.query(PortalAccessLog)
            .filter(PortalAccessLog.user_id == user_id)
            .order_by(PortalAccessLog.accessed_at.desc())
            .limit(limit)
            .all()
        )
