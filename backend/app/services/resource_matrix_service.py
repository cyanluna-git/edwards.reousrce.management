"""
Service for Resource Allocation Matrix
"""

from datetime import datetime
from typing import Optional, Dict, List
from collections import defaultdict
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from app.models.resource import ResourcePlan
from app.models.project import Program, Project
from app.models.user import User  # Added User import
from app.models.internal_io import InternalIO
from app.utils import get_io_number
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

    # Query all resource plans in the date range with eager loading to prevent N+1
    query = (
        db.query(ResourcePlan)
        .options(
            joinedload(ResourcePlan.project).joinedload(Project.internal_io),
            joinedload(ResourcePlan.user),
            joinedload(ResourcePlan.project_role),
            joinedload(ResourcePlan.position),
        )
        .filter(
            and_(
                ResourcePlan.year >= start_dt.year,
                ResourcePlan.year <= end_dt.year,
            )
        )
    )

    # Apply filters
    if program_id:
        query = query.join(ResourcePlan.project).filter(
            Project.program_id == program_id
        )

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

    # Query all programs (or filtered), including internal_io for projects
    programs_query = (
        db.query(Program)
        .options(joinedload(Program.projects).joinedload(Project.internal_io))
        .filter(Program.is_active == True)
    )
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
                        project_code=get_io_number(project),
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


def get_resource_pivot_matrix(
    db: Session,
    start_month: str,
    end_month: str,
    department_id: Optional[str] = None,
    program_id: Optional[str] = None,
) -> "PivotMatrixResponse":
    """
    Generate Resource Allocation Pivot Table (User x IO)
    """
    from app.schemas.resource_matrix import (
        PivotMatrixResponse,
        PivotColumn,
        PivotRow,
    )

    # 1. Parse Date Range
    start_dt = datetime.strptime(start_month, "%Y-%m")
    end_dt = datetime.strptime(end_month, "%Y-%m")

    # 2. Query Resource Plans (Eager Loading)
    query = (
        db.query(ResourcePlan)
        .options(
            joinedload(ResourcePlan.project).joinedload(Project.internal_io),
            joinedload(ResourcePlan.project).joinedload(Project.recharge_io),
            joinedload(ResourcePlan.user).joinedload(User.position),
            joinedload(ResourcePlan.user).joinedload(User.department),
        )
        .filter(
            and_(
                ResourcePlan.year >= start_dt.year,
                ResourcePlan.year <= end_dt.year,
            )
        )
    )

    # Filter logic (same as matrix)
    # Check if month is within range (simple year check above is optimization, detailed check below)

    # Apply Filters
    if program_id:
        query = query.join(ResourcePlan.project).filter(
            Project.program_id == program_id
        )

    resource_plans = query.all()

    # 3. Aggregation Structures
    # Columns: IOs { io_id: PivotColumn }
    # Rows: Users { user_id: PivotRow }
    # Data: { user_id: { io_id: fte } }

    cols_map: Dict[str, PivotColumn] = {}
    rows_map: Dict[str, PivotRow] = {}
    data_map: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    # Special IO ID for Unassigned
    UNASSIGNED_IO_ID = "unassigned"

    # Helper to determine effective IO
    def get_effective_io(project: Project):
        if not project:
            return (UNASSIGNED_IO_ID, "No Project", "Unknown", "NONE")

        if project.internal_io:
            return (
                str(project.internal_io.id),
                str(project.internal_io.io_number or "N/A"),
                str(project.internal_io.name or ""),
                "INTERNAL",
            )
        elif project.recharge_io:
            return (
                str(project.recharge_io.id),
                str(project.recharge_io.io_number or "N/A"),
                str(project.recharge_io.name or ""),
                "RECHARGE",
            )
        else:
            return (UNASSIGNED_IO_ID, "No IO", "Unassigned Project", "NONE")

    months = generate_month_range(start_month, end_month)

    for plan in resource_plans:
        try:
            month_key = f"{plan.year}-{plan.month:02d}"
            if month_key not in months:
                continue

            # Defensive check
            if not plan.project:
                print(f"Warning: ResourcePlan {plan.id} has no project. Skipping.")
                continue

            # Determine IO (Column)
            io_id, io_label, io_name, io_type = get_effective_io(plan.project)
            io_id = str(io_id)  # Ensure string

            if io_id not in cols_map:
                cols_map[io_id] = PivotColumn(
                    id=io_id,
                    label=str(io_label),
                    name=str(io_name) if io_name else None,
                    type=str(io_type),
                )

            # Determine User (Row)
            user_id = str(plan.user_id) if plan.user_id else "TBD"
            user_name = str(plan.user.name) if plan.user else "TBD"

            # Additional User Info
            pos_name = (
                str(plan.user.position.name)
                if plan.user and plan.user.position
                else None
            )
            dept_name = (
                str(plan.user.department.name)
                if plan.user and plan.user.department
                else None
            )

            if user_id not in rows_map:
                rows_map[user_id] = PivotRow(
                    user_id=user_id if user_id != "TBD" else None,
                    user_name=user_name,
                    position_name=pos_name,
                    department_name=dept_name,
                    allocations={},
                )

            # Calculate FTE
            p_hours = plan.planned_hours if plan.planned_hours is not None else 0.0
            fte = float(p_hours) / 160.0

            # Accumulate
            data_map[user_id][io_id] += fte
            cols_map[io_id].total_fte += fte
            rows_map[user_id].total_fte += fte
        except Exception as e:
            print(f"Error processing ResourcePlan {plan.id}: {str(e)}")
            continue

    # 4. Construct Response
    sorted_cols = sorted(cols_map.values(), key=lambda c: c.label)  # Sort by IO Number

    # Fill row allocations
    sorted_rows = sorted(rows_map.values(), key=lambda r: r.user_name)
    for row in sorted_rows:
        u_id = row.user_id or "TBD"
        for col in sorted_cols:
            val = data_map[u_id].get(col.id, 0.0)
            if val > 0:
                row.allocations[col.id] = round(val, 2)

        # Round row total
        row.total_fte = round(row.total_fte, 2)

    # Round column totals
    for col in sorted_cols:
        col.total_fte = round(col.total_fte, 2)

    grand_total = sum(c.total_fte for c in sorted_cols)

    return PivotMatrixResponse(
        start_month=start_month,
        end_month=end_month,
        columns=sorted_cols,
        rows=sorted_rows,
        grand_total=round(grand_total, 2),
    )
