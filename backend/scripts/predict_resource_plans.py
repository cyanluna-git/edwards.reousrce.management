"""
Resource Plan Prediction Script

Analyzes worklog trends and generates predicted resource plans for 2026.
Based on existing worklog data, predicts future resource allocation with declining trend.

Usage:
    cd backend
    python -m scripts.predict_resource_plans
"""

import sys
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import func, and_
from sqlalchemy.orm import Session
from app.core.database import get_session_local
from app.models.resource import WorkLog, ResourcePlan
from app.models.project import Project
from app.models.user import User


def get_worklog_trends(db: Session):
    """
    Analyze worklog data to find project-user combinations with significant activity.
    Returns aggregated monthly hours per project-user.
    """
    print("\n--- Analyzing Worklog Trends ---")

    # Get worklogs from 2024 and 2025
    results = (
        db.query(
            WorkLog.project_id,
            WorkLog.user_id,
            func.extract("year", WorkLog.date).label("year"),
            func.extract("month", WorkLog.date).label("month"),
            func.sum(WorkLog.hours).label("total_hours"),
        )
        .filter(WorkLog.date >= "2024-01-01")
        .group_by(
            WorkLog.project_id,
            WorkLog.user_id,
            func.extract("year", WorkLog.date),
            func.extract("month", WorkLog.date),
        )
        .all()
    )

    # Organize data: {(project_id, user_id): [(year, month, hours), ...]}
    trends = defaultdict(list)
    for row in results:
        key = (row.project_id, row.user_id)
        trends[key].append(
            {
                "year": int(row.year),
                "month": int(row.month),
                "hours": float(row.total_hours),
            }
        )

    print(f"  Found {len(trends)} unique project-user combinations")
    return trends


def calculate_average_fte(monthly_data: list) -> float:
    """
    Calculate average FTE from monthly data.
    Assumes 160 working hours per month = 1.0 FTE
    """
    if not monthly_data:
        return 0.0

    total_hours = sum(d["hours"] for d in monthly_data)
    num_months = len(monthly_data)
    avg_monthly_hours = total_hours / num_months

    # Convert to FTE (max 1.0)
    fte = min(avg_monthly_hours / 160.0, 1.0)
    return fte  # Return raw value, quantize later


def quantize_fte(fte: float) -> float:
    """
    Quantize FTE value to discrete levels: 0.1, 0.25, 0.5, 0.75, 1.0
    Values below 0.1 threshold are discarded (return 0)
    """
    if fte < 0.05:
        return 0.0

    # Allowed discrete values
    allowed_values = [0.1, 0.25, 0.5, 0.75, 1.0]

    # Find the closest allowed value
    closest = min(allowed_values, key=lambda x: abs(x - fte))
    return closest


def get_active_projects(db: Session):
    """Get active projects (not completed/cancelled)"""
    excluded_statuses = ["Completed", "Cancelled"]
    projects = (
        db.query(Project)
        .filter(~Project.status.in_(excluded_statuses))
        .filter(~Project.name.contains("[Closed]"))
        .filter(~Project.name.contains("[Cancel]"))
        .all()
    )
    return {p.id: p for p in projects}


def get_user_positions(db: Session):
    """Get user position mapping"""
    users = db.query(User).filter(User.is_active == True).all()
    return {u.id: u.position_id for u in users}


def get_admin_user_id(db: Session):
    """Get admin user ID for created_by field"""
    admin = db.query(User).filter(User.role == "ADMIN").first()
    if admin:
        return admin.id
    # Fallback: get any active user
    user = db.query(User).filter(User.is_active == True).first()
    return user.id if user else None


def generate_predictions(
    db: Session,
    trends: dict,
    active_projects: dict,
    user_positions: dict,
    admin_id: str,
):
    """
    Generate resource plan predictions for 2026.
    Uses a declining trend model based on historical activity.
    """
    print("\n--- Generating 2026 Resource Plan Predictions ---")

    # Months to predict: January 2026 - December 2026
    prediction_months = [(2026, m) for m in range(1, 13)]

    # Decay factors for declining trend (6 months declining pattern)
    # Starts at 100%, declines to 20% by month 6, then stays minimal
    decay_factors = {
        1: 1.0,  # Jan - full allocation
        2: 0.9,  # Feb
        3: 0.75,  # Mar
        4: 0.6,  # Apr
        5: 0.45,  # May
        6: 0.3,  # Jun
        7: 0.2,  # Jul
        8: 0.15,  # Aug
        9: 0.1,  # Sep
        10: 0.05,  # Oct
        11: 0.0,  # Nov - project completed
        12: 0.0,  # Dec
    }

    plans_to_create = []
    skipped = 0
    included = 0

    for (project_id, user_id), monthly_data in trends.items():
        # Skip if project is not active
        if project_id not in active_projects:
            skipped += 1
            continue

        # Skip if user is not active or position unknown
        if user_id not in user_positions:
            skipped += 1
            continue

        # Calculate average FTE from historical data
        avg_fte = calculate_average_fte(monthly_data)

        # Skip if too low activity (less than 0.05 FTE on average)
        if avg_fte < 0.05:
            skipped += 1
            continue

        position_id = user_positions[user_id]

        # Determine start month based on historical trend
        # If project has recent activity (2025), start from January
        # If not, might have different pattern
        historical_months = sorted(
            [(d["year"], d["month"]) for d in monthly_data], reverse=True
        )
        latest_year, latest_month = (
            historical_months[0] if historical_months else (2024, 1)
        )

        # Only generate predictions for projects active in 2025
        if latest_year < 2025:
            skipped += 1
            continue

        # Generate predictions with declining trend
        for year, month in prediction_months:
            decay = decay_factors.get(month, 0.0)
            raw_fte = avg_fte * decay
            predicted_fte = quantize_fte(raw_fte)  # Quantize to discrete values

            # Only create if FTE > 0 (quantize returns 0 for very low values)
            if predicted_fte > 0:
                plans_to_create.append(
                    {
                        "project_id": project_id,
                        "user_id": user_id,
                        "position_id": position_id,
                        "year": year,
                        "month": month,
                        "planned_hours": predicted_fte,  # Quantized FTE: 0.1, 0.25, 0.5, 0.75, 1.0
                        "created_by": admin_id,
                    }
                )
                included += 1

    print(f"  Skipped: {skipped} project-user combinations (inactive/low activity)")
    print(f"  Predictions to create: {len(plans_to_create)} resource plan entries")

    return plans_to_create


def clear_existing_2026_plans(db: Session):
    """Remove existing 2026 resource plans to avoid duplicates"""
    count = db.query(ResourcePlan).filter(ResourcePlan.year == 2026).delete()
    db.commit()
    print(f"  Removed {count} existing 2026 resource plans")


def insert_predictions(db: Session, plans: list):
    """Insert predicted resource plans into database"""
    print("\n--- Inserting Predictions ---")

    batch_size = 100
    inserted = 0

    for i in range(0, len(plans), batch_size):
        batch = plans[i : i + batch_size]
        for plan_data in batch:
            plan = ResourcePlan(**plan_data)
            db.add(plan)
        db.commit()
        inserted += len(batch)
        print(f"  Inserted {inserted}/{len(plans)} plans...")

    print(f"  Total inserted: {inserted} resource plan entries")


def print_summary(db: Session):
    """Print summary of generated data"""
    print("\n--- Summary ---")

    # Count by project
    project_counts = (
        db.query(
            ResourcePlan.project_id,
            Project.code,
            Project.name,
            func.count(ResourcePlan.id).label("plan_count"),
        )
        .join(Project)
        .filter(ResourcePlan.year == 2026)
        .group_by(ResourcePlan.project_id, Project.code, Project.name)
        .order_by(func.count(ResourcePlan.id).desc())
        .limit(10)
        .all()
    )

    print("\n  Top 10 Projects by Resource Plans:")
    for row in project_counts:
        print(f"    {row.code}: {row.plan_count} entries - {row.name[:40]}")

    # Count by month
    monthly_counts = (
        db.query(
            ResourcePlan.month,
            func.count(ResourcePlan.id).label("plan_count"),
            func.sum(ResourcePlan.planned_hours).label("total_fte"),
        )
        .filter(ResourcePlan.year == 2026)
        .group_by(ResourcePlan.month)
        .order_by(ResourcePlan.month)
        .all()
    )

    print("\n  Monthly Distribution (2026):")
    for row in monthly_counts:
        print(
            f"    Month {row.month:2}: {row.plan_count:4} entries, Total FTE: {row.total_fte:.1f}"
        )


def main():
    """Main function"""
    print("=" * 60)
    print("Resource Plan Prediction from Worklog Trends")
    print("=" * 60)
    print(f"Generated at: {datetime.now().isoformat()}")

    # Create database session
    SessionLocal = get_session_local()
    db = SessionLocal()

    try:
        # Step 1: Analyze worklog trends
        trends = get_worklog_trends(db)

        if not trends:
            print("\nNo worklog data found. Cannot generate predictions.")
            return

        # Step 2: Get active projects and user positions
        active_projects = get_active_projects(db)
        print(f"  Active projects: {len(active_projects)}")

        user_positions = get_user_positions(db)
        print(f"  Active users with positions: {len(user_positions)}")

        admin_id = get_admin_user_id(db)
        if not admin_id:
            print("\nERROR: No user found for created_by field")
            return
        print(f"  Admin user ID: {admin_id}")

        # Step 3: Clear existing 2026 plans
        clear_existing_2026_plans(db)

        # Step 4: Generate predictions
        predictions = generate_predictions(
            db, trends, active_projects, user_positions, admin_id
        )

        if not predictions:
            print("\nNo predictions generated. Check data quality.")
            return

        # Step 5: Insert predictions
        insert_predictions(db, predictions)

        # Step 6: Print summary
        print_summary(db)

        print("\n" + "=" * 60)
        print("PREDICTION COMPLETE!")
        print("=" * 60)
        print("2026 resource plans have been generated based on worklog trends.")
        print("The data follows a declining trend pattern over 6-10 months.")
        print("=" * 60)

    except Exception as e:
        print(f"\nERROR: {e}")
        db.rollback()
        import traceback

        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
