import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.services.resource_matrix_service import get_resource_pivot_matrix
from app.core.database import Base

DATABASE_URL = "postgresql://postgres:password@localhost:5434/edwards"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

print("Attempting to call get_resource_pivot_matrix...")
try:
    result = get_resource_pivot_matrix(
        db=db, start_month="2026-01", end_month="2026-02"
    )
    print("Success! Result Grand Total:", result.grand_total)
    print("Sample Rows:")
    for row in result.rows[:5]:
        print(
            f"User: {row.user_name}, Dept: {row.department_name}, SubTeam: {row.sub_team_name}"
        )
except Exception as e:
    import traceback

    traceback.print_exc()
