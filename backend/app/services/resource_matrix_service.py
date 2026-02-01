"""
Service for Resource Allocation Matrix
"""

from datetime import datetime
from typing import Optional, Dict, List
from collections import defaultdict
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func

from app.models.resource import ResourcePlan, WorkLog
from app.models.project import Program, Project, ProjectRechargeMapping
from app.models.user import User
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
    (Still used for Planning View if needed, or legacy compatibility)
    """
    # ... (Keep existing implementation for safety/compatibility for now)
    # Generate month list
    months = generate_month_range(start_month, end_month)

    # Parse year and month ranges
    start_dt = datetime.strptime(start_month, "%Y-%m")
    end_dt = datetime.strptime(end_month, "%Y-%m")

    # Query all resource plans
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

    if program_id:
        query = query.join(ResourcePlan.project).filter(
            Project.program_id == program_id
        )

    resource_plans = query.all()

    matrix_data = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))

    for plan in resource_plans:
        month_key = f"{plan.year}-{plan.month:02d}"
        if month_key not in months:
            continue

        program_id_key = plan.project.program_id
        project_id_key = plan.project_id
        fte = round(plan.planned_hours / 160, 2)

        detail = ResourceAllocationDetail(
            user_id=plan.user_id,
            name=plan.user.name if plan.user else "TBD",
            role=plan.project_role.name if plan.project_role else "-",
            position=plan.position.name if plan.position else "-",
            fte=fte,
        )

        matrix_data[program_id_key][project_id_key][month_key].append(detail)

    programs: List[ProgramGroup] = []
    grand_total_by_month: Dict[str, float] = {month: 0.0 for month in months}

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
                program_total_by_month[month] += total_fte
                grand_total_by_month[month] += total_fte

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
    Based on ACTUAL WorkLogs (Normalized FTE)

    Formula:
        FTE = (User's Hours on Project X) / (User's Total Project Hours)
        * Note: 'Team Work' (Project IS NULL) is excluded from the denominator.
    """
    from app.schemas.resource_matrix import (
        PivotMatrixResponse,
        PivotColumn,
        PivotRow,
    )

    # 1. Parse Date Range
    start_dt = datetime.strptime(start_month, "%Y-%m")
    # For WorkLogs, we need strict date range.
    # start_month "2026-02" -> start_date 2026-02-01, end_date 2026-02-28
    import calendar

    end_dt_obj = datetime.strptime(end_month, "%Y-%m")
    last_day = calendar.monthrange(end_dt_obj.year, end_dt_obj.month)[1]

    query_start_date = start_dt.date()
    query_end_date = end_dt_obj.replace(day=last_day).date()

    # 2. Query WorkLogs
    # Join Project to get IO info, Join User for details
    query = (
        db.query(WorkLog)
        .options(
            joinedload(WorkLog.project).joinedload(Project.internal_io),
            joinedload(WorkLog.project).joinedload(Project.recharge_io),
            joinedload(WorkLog.project)
            .joinedload(Project.recharge_mappings)
            .joinedload(ProjectRechargeMapping.recharge_io),
            joinedload(WorkLog.user).joinedload(User.position),
            joinedload(WorkLog.user).joinedload(User.department),
            joinedload(WorkLog.user).joinedload(User.sub_team),
            joinedload(WorkLog.user).joinedload(
                User.primary_business_unit
            ),  # Load user BU
        )
        .filter(
            and_(
                WorkLog.date >= query_start_date,
                WorkLog.date <= query_end_date,
                WorkLog.project_id.isnot(None),  # Exclude Team Work (Overhead)
            )
        )
    )

    if program_id:
        query = query.join(WorkLog.project).filter(Project.program_id == program_id)

    if department_id:
        query = query.join(WorkLog.user).filter(User.department_id == department_id)

    worklogs = query.all()

    # 3. Calculate Total Project Hours per User (Denominator)
    user_total_project_hours: Dict[str, float] = defaultdict(float)
    for log in worklogs:
        # Safety for None hours
        h = log.hours or 0.0
        if log.user_id:
            user_total_project_hours[str(log.user_id)] += h

    # 4. Aggregation Structures
    cols_map: Dict[str, PivotColumn] = {}
    rows_map: Dict[str, PivotRow] = {}
    data_map: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    UNASSIGNED_IO_ID = "unassigned"

    def get_effective_io(project: Project, user: User):
        """
        Determine effective IO based on hierarchy:
        1. Dynamic Mapping (Project + User's BU -> RechargeIO)
        2. Project's Internal IO
        3. Project's Recharge IO
        """
        if not project:
            return None

        # 1. Dynamic Mapping Check
        if (
            user
            and user.primary_business_unit_id
            and hasattr(project, "recharge_mappings")
            and project.recharge_mappings
        ):
            for mapping in project.recharge_mappings:
                if mapping.business_unit_id == user.primary_business_unit_id:
                    rio = mapping.recharge_io
                    if rio and rio.is_active:
                        return (
                            str(rio.id),
                            str(rio.io_number or "N/A"),
                            str(rio.name or ""),
                            "RECHARGE",
                        )

        # 2. Existing Logic
        if project.internal_io:
            if not project.internal_io.is_active:
                return None
            return (
                str(project.internal_io.id),
                str(project.internal_io.io_number or "N/A"),
                str(project.internal_io.name or ""),
                "INTERNAL",
            )
        elif project.recharge_io:
            if not project.recharge_io.is_active:
                return None
            return (
                str(project.recharge_io.id),
                str(project.recharge_io.io_number or "N/A"),
                str(project.recharge_io.name or ""),
                "RECHARGE",
            )
        else:
            return (UNASSIGNED_IO_ID, "No IO", "Unassigned Project", "NONE")

    for log in worklogs:
        if not log.user_id:
            continue

        user_id = str(log.user_id)

        # Skip if user has 0 total hours (divide by zero protection)
        total_hours = user_total_project_hours[user_id]
        if total_hours == 0:
            continue

        # Determine IO
        io_result = get_effective_io(log.project, log.user)
        if not io_result:
            continue  # Skip inactive IOs or invalid projects

        io_id, io_label, io_name, io_type = io_result
        io_id = str(io_id)

        # Ensure Column Exists
        if io_id not in cols_map:
            cols_map[io_id] = PivotColumn(
                id=io_id,
                label=str(io_label),
                name=str(io_name) if io_name else None,
                type=str(io_type),
            )
        # Ensure Row Exists
        if user_id not in rows_map:
            user_name = str(log.user.name) if log.user else "Unknown"
            pos_name = (
                str(log.user.position.name) if log.user and log.user.position else None
            )
            dept_name = (
                str(log.user.department.name)
                if log.user and log.user.department
                else None
            )
            sub_team_name = (
                str(log.user.sub_team.name) if log.user and log.user.sub_team else None
            )

            rows_map[user_id] = PivotRow(
                user_id=user_id,
                user_name=user_name,
                position_name=pos_name,
                department_name=dept_name,
                sub_team_name=sub_team_name,
                allocations={},
            )

        # Calculate Normalized FTE contribution for this log entry
        # Contribution = (Log Hours / Total User Project Hours)
        # We can sum these contributions.
        # Example: Log A (2h). Total (10h). Contrib = 0.2.
        hours = log.hours or 0.0
        fte_contribution = hours / total_hours

        # Accumulate
        data_map[user_id][io_id] += fte_contribution
        cols_map[io_id].total_fte += fte_contribution
        rows_map[user_id].total_fte += fte_contribution

    # 5. Construct Response
    sorted_cols = sorted(cols_map.values(), key=lambda c: c.label)
    sorted_rows = sorted(rows_map.values(), key=lambda r: r.user_name)

    # Fill allocations and apply rounding
    for row in sorted_rows:
        u_id = row.user_id or "TBD"  # Should always be user_id here
        for col in sorted_cols:
            val = data_map[u_id].get(col.id, 0.0)
            if val > 0:
                row.allocations[col.id] = float(f"{val:.2f}")  # Round for display

        # Force row total to be exactly 1.0 if it's close (floating point mitigation)
        # But wait, if we filtered out some IOs (inactive), row total might be < 1.0.
        # That is correct behavior (hours on inactive IOs are lost from the view).
        row.total_fte = float(f"{row.total_fte:.2f}")

    for col in sorted_cols:
        col.total_fte = float(f"{col.total_fte:.2f}")

    grand_total = sum(c.total_fte for c in sorted_cols)

    return PivotMatrixResponse(
        start_month=start_month,
        end_month=end_month,
        columns=sorted_cols,
        rows=sorted_rows,
        grand_total=float(f"{grand_total:.2f}"),
    )
