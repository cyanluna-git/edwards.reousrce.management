import sys
import os
from sqlalchemy import text

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_session_local
from app.models.project import Project


def check_categories():
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        functional_projects = (
            db.query(Project).filter(Project.category == "FUNCTIONAL").all()
        )
        print(f"Total Functional Projects: {len(functional_projects)}")
        for p in functional_projects:
            print(f" - {p.code}: {p.name} ({p.category})")

        print("-" * 20)

        candidates = db.query(Project).filter(Project.name.like("%General%")).all()
        print(f"Projects with 'General' in name: {len(candidates)}")
        for p in candidates:
            print(f" - {p.code}: {p.name} ({p.category})")

    finally:
        db.close()


if __name__ == "__main__":
    check_categories()
