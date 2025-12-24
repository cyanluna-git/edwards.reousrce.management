import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func
from app.core.database import get_session_local
from app.models.resource import WorkLog


def inspect_meeting_types():
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        results = (
            db.query(WorkLog.meeting_type, func.count(WorkLog.id))
            .group_by(WorkLog.meeting_type)
            .all()
        )
        print("Distinct Meeting Types:")
        for mt, count in results:
            print(f"  '{mt}': {count}")
    finally:
        db.close()


if __name__ == "__main__":
    inspect_meeting_types()
