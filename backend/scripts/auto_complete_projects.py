import sys
import os
from datetime import datetime, timedelta
from sqlalchemy import func

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_session_local
from app.models.project import Project
from app.models.resource import WorkLog


def auto_complete_projects():
    SessionLocal = get_session_local()
    db = SessionLocal()

    try:
        print("Starting Auto-Complete Projects Script...")

        # Cutoff date: 3 months ago relative to today
        cutoff_date = datetime.now() - timedelta(days=90)
        print(f"Cutoff Date: {cutoff_date.date()}")

        # Get Candidate Projects (Status not Completed/Closed)
        projects = (
            db.query(Project)
            .filter(Project.status.notin_(["Completed", "Cancelled"]))
            .all()
        )
        print(f"Checking {len(projects)} active projects...")

        updated_count = 0

        for project in projects:
            # Find latest worklog date
            last_log_date = (
                db.query(func.max(WorkLog.date))
                .filter(WorkLog.project_id == project.id)
                .scalar()
            )

            should_close = False

            if last_log_date is None:
                # No worklogs ever. Check created_at to protect new projects.
                # If created_at is older than cutoff, then it's a stale empty project.
                # If created_at is none, treat as old.
                if project.created_at:
                    if project.created_at < cutoff_date:
                        should_close = True
                        print(
                            f"[No WorkLogs] Project {project.code} ({project.name}) created at {project.created_at.date()} -> Completed"
                        )
                else:
                    should_close = True
                    print(
                        f"[No WorkLogs] Project {project.code} ({project.name}) no created date -> Completed"
                    )

            elif last_log_date < cutoff_date.date():
                should_close = True
                print(
                    f"[Inactive] Project {project.code} ({project.name}) last active {last_log_date} -> Completed"
                )

            if should_close:
                project.status = "Completed"
                updated_count += 1

        if updated_count > 0:
            db.commit()
            print(f"✅ Successfully updated {updated_count} projects to 'Completed'.")
        else:
            print("No projects matched the criteria.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    auto_complete_projects()
