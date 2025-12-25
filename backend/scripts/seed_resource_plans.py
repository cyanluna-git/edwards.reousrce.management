"""
Seed Resource Plan data from Excel template
Run this script after initial_data.py to add resource allocations
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import get_engine, get_session_local
from app.models.user import User
from app.models.project import Project
from app.models.organization import JobPosition
from app.models.resource import ResourcePlan


def seed_resource_plans():
    """Seed resource plans based on Excel data"""
    SessionLocal = get_session_local()
    db = SessionLocal()

    try:
        print("Seeding Resource Plans...")

        # Get admin user for created_by field
        admin_user = db.query(User).filter(User.email == "admin@edwards.com").first()
        if not admin_user:
            print("Error: Admin user not found")
            return
        created_by_id = admin_user.id

        # Get all users by name for lookup
        users = {u.name: u.id for u in db.query(User).all()}
        # Also map by korean name
        for u in db.query(User).all():
            if u.korean_name:
                users[u.korean_name] = u.id

        # Get projects by code
        projects = {p.code: p.id for p in db.query(Project).all()}
        # Also by name partial match
        for p in db.query(Project).all():
            if "Havasu" in p.name:
                projects["Havasu"] = p.id
            if "Tumalo" in p.name and "Phase 1" not in p.name:
                projects["Tumalo Ph1"] = p.id

        # Get default position
        default_position = (
            db.query(JobPosition).filter(JobPosition.name == "Engineer").first()
        )
        pm_position = db.query(JobPosition).filter(JobPosition.name == "PM").first()
        sys_eng_position = (
            db.query(JobPosition).filter(JobPosition.name == "System engineer").first()
        )

        if not default_position:
            print("Error: Default position not found")
            return

        # Resource data from Excel (Name -> {project: {year-month: hours}})
        resource_data = [
            # Havasu Project
            {
                "project": "Havasu",
                "name": "Evan Lee",
                "allocations": [
                    (2025, 6, 1.0),
                    (2025, 7, 1.0),
                    (2025, 8, 0.5),
                    (2025, 9, 0.2),
                    (2025, 10, 0.2),
                    (2025, 11, 0.2),
                ],
            },
            {
                "project": "Havasu",
                "name": "Michael Kim",
                "allocations": [
                    (2025, 6, 1.0),
                    (2025, 7, 1.0),
                    (2025, 8, 1.0),
                    (2025, 9, 0.5),
                    (2025, 10, 0.5),
                    (2025, 11, 0.7),
                ],
            },
            {
                "project": "Havasu",
                "name": "Anders You",
                "allocations": [(2025, 6, 1.0), (2025, 7, 1.0), (2025, 8, 1.0)],
            },
            {
                "project": "Havasu",
                "name": "Chloe Jeong",
                "allocations": [
                    (2025, 6, 1.0),
                    (2025, 7, 1.0),
                    (2025, 8, 0.5),
                    (2025, 9, 0.5),
                    (2025, 10, 0.5),
                    (2025, 11, 1.0),
                ],
            },
            {
                "project": "Havasu",
                "name": "Judy Lee",
                "allocations": [
                    (2025, 6, 1.0),
                    (2025, 7, 1.0),
                    (2025, 8, 1.0),
                    (2025, 9, 0.5),
                    (2025, 10, 0.5),
                    (2025, 11, 0.7),
                ],
            },
            # Tumalo Ph1
            {
                "project": "Tumalo Ph1",
                "name": "Yuro Lee",
                "allocations": [
                    (2025, 6, 1.0),
                    (2025, 7, 1.0),
                    (2025, 8, 1.0),
                    (2025, 9, 1.0),
                    (2025, 10, 1.0),
                    (2025, 11, 1.0),
                ],
            },
            {
                "project": "Tumalo Ph1",
                "name": "Jacob Lee",
                "allocations": [
                    (2025, 6, 1.0),
                    (2025, 7, 1.0),
                    (2025, 8, 1.0),
                    (2025, 9, 0.6),
                    (2025, 10, 0.6),
                    (2025, 11, 0.6),
                ],
            },
            {
                "project": "Tumalo Ph1",
                "name": "Harry Kwak",
                "allocations": [
                    (2025, 6, 1.0),
                    (2025, 7, 1.0),
                    (2025, 8, 0.6),
                    (2025, 9, 0.6),
                    (2025, 10, 0.5),
                    (2025, 11, 0.5),
                ],
            },
            {
                "project": "Tumalo Ph1",
                "name": "Noah Yeom",
                "allocations": [
                    (2025, 6, 1.0),
                    (2025, 7, 1.0),
                    (2025, 8, 0.6),
                    (2025, 9, 0.6),
                    (2025, 10, 0.6),
                    (2025, 11, 0.6),
                ],
            },
            {
                "project": "Tumalo Ph1",
                "name": "Fred Lee",
                "allocations": [
                    (2025, 6, 1.0),
                    (2025, 7, 1.0),
                    (2025, 8, 0.6),
                    (2025, 9, 0.6),
                    (2025, 10, 0.6),
                    (2025, 11, 0.6),
                ],
            },
        ]

        count = 0
        for data in resource_data:
            project_id = projects.get(data["project"])
            user_id = users.get(data["name"])

            if not project_id:
                print(f"  Warning: Project '{data['project']}' not found, skipping...")
                continue
            if not user_id:
                print(f"  Warning: User '{data['name']}' not found, skipping...")
                continue

            position_id = default_position.id

            for year, month, hours in data["allocations"]:
                # Check if already exists
                existing = (
                    db.query(ResourcePlan)
                    .filter(
                        ResourcePlan.project_id == project_id,
                        ResourcePlan.user_id == user_id,
                        ResourcePlan.year == year,
                        ResourcePlan.month == month,
                    )
                    .first()
                )

                if not existing:
                    plan = ResourcePlan(
                        project_id=project_id,
                        position_id=position_id,
                        user_id=user_id,
                        year=year,
                        month=month,
                        planned_hours=hours,
                        created_by=created_by_id,
                    )
                    db.add(plan)
                    count += 1

        db.commit()
        print(f"Created {count} resource plan entries.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_resource_plans()
