"""
Service for Resource Allocation Matrix
"""

from datetime import datetime
from typing import Optional, Dict, List
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.resource import ResourcePlan
from app.models.project import Program, Project
from app.schemas.resource_matrix import (
    ResourceAllocationDetail,
    MonthlyAllocation,
    ProjectAllocationRow,
    ProgramGroup,
    ResourceAllocationMatrix,
)


def generate_month_range(start_month: str, end_month: str) -> List[str]:
    """
    Generate list of months between start and end (inclusive)

    Args:
        start_month: "2026-01"
        end_month: "2026-12"

    Returns:
        ["2026-01", "2026-02", ..., "2026-12"]
    """
    start = datetime.strptime(start_month, "%Y-%m")
    end = datetime.strptime(end_month, "%Y-%m")

    months = []
    current = start
    while current <= end:
        months.append(current.strftime("%Y-%m"))
        # Move to next month
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)

    return months


def get_resource_allocation_matrix(
    db: Session,
    start_month: str,
    end_month: str,
    department_id: Optional[str] = None,
    program_id: Optional[str] = None,
) -> ResourceAllocationMatrix:
    """
    Generate Resource Allocation Matrix

    Args:
        db: Database session
        start_month: Start month in "YYYY-MM" format
        end_month: End month in "YYYY-MM" format
        department_id: Optional filter by department
        program_id: Optional filter by program

    Returns:
        ResourceAllocationMatrix with aggregated data
    """
    # Generate month list
    months = generate_month_range(start_month, end_month)

    # Parse year and month ranges
    start_dt = datetime.strptime(start_month, "%Y-%m")
    end_dt = datetime.strptime(end_month, "%Y-%m")

    # Query all resource plans in the date range
    query = db.query(ResourcePlan).filter(
        and_(
            ResourcePlan.year >= start_dt.year,
            ResourcePlan.year <= end_dt.year,
        )
    )

    # Apply filters
    if program_id:
        query = query.join(ResourcePlan.project).filter(Project.program_id == program_id)

    resource_plans = query.all()

    # Filter by exact month range and build aggregation structure
    # Structure: {program_id: {project_id: {month: [details]}}}
    matrix_data = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))

    for plan in resource_plans:
        month_key = f"{plan.year}-{plan.month:02d}"

        # Skip if outside month range
        if month_key not in months:
            continue

        program_id_key = plan.project.program_id
        project_id_key = plan.project_id

        # Calculate FTE (160 hours = 1 FTE)
        fte = round(plan.planned_hours / 160, 2)

        # Build detail object
        detail = ResourceAllocationDetail(
            user_id=plan.user_id,
            name=plan.user.name if plan.user else "TBD",
            role=plan.project_role.name if plan.project_role else "-",
            position=plan.position.name if plan.position else "-",
            fte=fte,
        )

        matrix_data[program_id_key][project_id_key][month_key].append(detail)

    # Build response structure
    programs: List[ProgramGroup] = []
    grand_total_by_month: Dict[str, float] = {month: 0.0 for month in months}

    # Query all programs (or filtered)
    programs_query = db.query(Program).filter(Program.is_active == True)
    if program_id:
        programs_query = programs_query.filter(Program.id == program_id)

    for program in programs_query.all():
        projects: List[ProjectAllocationRow] = []
        program_total_by_month: Dict[str, float] = {month: 0.0 for month in months}

        for project in program.projects:
            if not project:
                continue

            allocations: Dict[str, MonthlyAllocation] = {}

            for month in months:
                details = matrix_data[program.id][project.id].get(month, [])
                total_fte = sum(d.fte for d in details)

                allocations[month] = MonthlyAllocation(
                    month=month,
                    total_fte=round(total_fte, 2),
                    details=details,
                )

                # Accumulate program totals
                program_total_by_month[month] += total_fte
                grand_total_by_month[month] += total_fte

            # Only include projects with at least one allocation
            if any(a.total_fte > 0 for a in allocations.values()):
                projects.append(
                    ProjectAllocationRow(
                        project_id=project.id,
                        project_code=project.code,
                        project_name=project.name,
                        category=project.category,
                        allocations=allocations,
                    )
                )

        # Only include programs with projects
        if projects:
            programs.append(
                ProgramGroup(
                    program_id=program.id,
                    program_name=program.name,
                    projects=projects,
                    total_by_month={
                        month: round(total, 2)
                        for month, total in program_total_by_month.items()
                    },
                )
            )

    # Round grand totals
    grand_total_by_month = {
        month: round(total, 2) for month, total in grand_total_by_month.items()
    }

    return ResourceAllocationMatrix(
        start_month=start_month,
        end_month=end_month,
        months=months,
        programs=programs,
        grand_total_by_month=grand_total_by_month,
    )
