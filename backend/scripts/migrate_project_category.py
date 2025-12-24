import sys
import os
from sqlalchemy import text

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_session_local
from app.models.project import Project, Program


def migrate_project_category():
    SessionLocal = get_session_local()
    db = SessionLocal()

    try:
        print("Starting Project Category Migration...")

        # 1. Add Column if not exists
        # This is raw SQL for Postgres. Adjust if MSSQL (User mentioned MSSQL in previous conv summaries, but connection seems to be SQLAlchemy generic. 'run_local.sh' implies local... let's assume generic standard SQL or check engine)
        # Previous logs showed `select pg_catalog.version()`, so it IS PostgreSQL.
        try:
            db.execute(
                text(
                    "ALTER TABLE projects ADD COLUMN category VARCHAR(20) DEFAULT 'PROJECT'"
                )
            )
            db.commit()
            print("✅ Added 'category' column to projects table.")
        except Exception as e:
            db.rollback()
            if "duplicate column" in str(e) or "already exists" in str(e):
                print("ℹ️ 'category' column already exists.")
            else:
                print(f"⚠️ Error adding column (might already exist): {e}")

        # 2. Classify Projects
        projects = db.query(Project).all()
        updates = []

        print(f"Analyzing {len(projects)} projects...")

        for p in projects:
            is_functional = False

            # Heuristics
            # 1. Program Name
            if p.program:
                prog_name = (p.program.name or "").lower()
                if any(
                    x in prog_name
                    for x in ["general", "functional", "other", "unknown", "unassigned"]
                ):
                    is_functional = True

            # 2. Project Name
            proj_name = (p.name or "").lower()
            if any(
                x in proj_name
                for x in ["general", "sustaining", "admin", "non-project", "overhead"]
            ):
                is_functional = True

            # 3. Project Type (if applicable, e.g. "Geneal")
            if p.project_type_id and p.project_type_id.lower() in ["general", "other"]:
                is_functional = True

            new_cat = "FUNCTIONAL" if is_functional else "PROJECT"

            if p.category != new_cat:
                p.category = new_cat
                updates.append((p.code, p.name, new_cat))

        if updates:
            print(f"Found {len(updates)} projects to update to FUNCTIONAL/PROJECT.")
            for code, name, cat in updates:
                print(f"  {code} ({name}) -> {cat}")

            # confirm = input("Apply updates? (y/n): ")
            # if confirm.lower() == 'y':
            db.commit()
            print("✅ Updates applied.")
            # else:
            #     print("Skipped updates.")
        else:
            print("No updates needed.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    migrate_project_category()
