from app.core.database import get_session_local
from app.models.project import Project
from sqlalchemy import or_

def find_projects():
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        # Search criteria based on user input
        search_terms = [
            "EUV Gen4 Phase 1 Tumalo",
            "406437",
            "General/Non-Project",
            "TFT",
            "PRJ-40"
        ]
        
        print(f"Searching for projects matching: {search_terms}")
        
        projects = db.query(Project).filter(
            or_(
                Project.name.in_(search_terms),
                Project.id.in_(search_terms),
                Project.description.like("%EUV Gen4 Phase 1 Tumalo%")
            )
        ).all()
        
        print(f"Found {len(projects)} projects:")
        for p in projects:
            print(f"ID: {p.id}, Name: {p.name}, Code/InternalID: {p.internal_io_id}, Category: {p.category}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    find_projects()
