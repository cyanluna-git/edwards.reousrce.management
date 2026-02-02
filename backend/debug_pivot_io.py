import sys
import os
from datetime import datetime, timedelta

# Append backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker, joinedload

from app.core.database import Base
from app.models.project import Project, ProjectRechargeMapping
from app.models.resource import WorkLog
from app.models.internal_io import InternalIO
from app.models.recharge_io import RechargeIO
from app.models.user import User

# Load env from parent dir if needed, or current
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("WARNING: DATABASE_URL not found, using default")
    DATABASE_URL = "postgresql://postgres:password@localhost:5434/edwards"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

print("Scanning WorkLogs for 'No IO' Projects (Last 90 Days)...")

ninety_days_ago = datetime.utcnow().date() - timedelta(days=90)

# Get distinct projects from recent worklogs
recent_project_ids = [
    r[0]
    for r in db.query(WorkLog.project_id)
    .filter(WorkLog.date >= ninety_days_ago)
    .filter(WorkLog.project_id.isnot(None))
    .distinct()
    .all()
]

print(f"Found {len(recent_project_ids)} distinct projects in recent logs.")

# Find which of these have NO IO
results = []
hidden_results = []
mapped_results = []

for pid in recent_project_ids:
    project = (
        db.query(Project)
        .options(
            joinedload(Project.internal_io),
            joinedload(Project.recharge_io),
            joinedload(Project.recharge_mappings),
        )
        .get(pid)
    )

    if not project:
        continue

    # Check Logic
    internal = project.internal_io
    recharge = project.recharge_io
    mappings = project.recharge_mappings

    hours = (
        db.query(func.sum(WorkLog.hours))
        .filter(WorkLog.project_id == pid, WorkLog.date >= ninety_days_ago)
        .scalar()
        or 0
    )
    if hours == 0:
        continue

    # "No IO" Case
    if not internal and not recharge:
        if mappings:
            mapped_results.append(
                (project.name, hours, f"Dynamic Mapping ({len(mappings)} BUs)")
            )
        else:
            results.append((project.name, hours, "Missing Both Internal/Recharge"))

    # "Hidden" Case (Inactive Recharge/Internal)
    elif internal and not internal.is_active:
        hidden_results.append(
            (project.name, hours, f"Internal IO '{internal.name}' Inactive")
        )
    elif recharge and not recharge.is_active:
        hidden_results.append(
            (project.name, hours, f"Recharge IO '{recharge.name}' Inactive")
        )

# Sort and Print
results.sort(key=lambda x: x[1], reverse=True)
hidden_results.sort(key=lambda x: x[1], reverse=True)
mapped_results.sort(key=lambda x: x[1], reverse=True)

print("\n=== [Dynamic Mapping] Projects (Will be resolved by User BU) ===")
print(f"{'Project Name':<50} | {'Hours':<10} | {'Status'}")
print("-" * 80)
for name, hours, status in mapped_results:
    print(f"{name[:48]:<50} | {hours:<10.2f} | {status}")

print("\n=== [No IO] Projects (Still Unassigned) ===")
print(f"{'Project Name':<50} | {'Hours':<10} | {'Status'}")
print("-" * 80)
for name, hours, status in results:
    print(f"{name[:48]:<50} | {hours:<10.2f} | {status}")

print("\n=== [Hidden] Projects (Inactive IOs - Not in Pivot) ===")
print(f"{'Project Name':<50} | {'Hours':<10} | {'Reason'}")
print("-" * 80)
for name, hours, reason in hidden_results:
    print(f"{name[:48]:<50} | {hours:<10.2f} | {reason}")
