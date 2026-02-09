"""
API Endpoints for Resource Allocation Matrix
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import ErrorCode, app_error
from app.schemas.resource_matrix import (
    ResourceAllocationMatrix,
    PivotMatrixResponse,
    WorklogDetailResponse,
)
from app.services.resource_matrix_service import get_resource_allocation_matrix

# ... (existing router definition)

# ... (other endpoints)


router = APIRouter(prefix="/resource-matrix", tags=["Resource Matrix"])


@router.get("/allocation", response_model=ResourceAllocationMatrix)
def get_allocation_matrix(
    start_month: str,
    end_month: str,
    department_id: Optional[str] = None,
    program_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Get Resource Allocation Matrix

    Returns a hierarchical view of resource allocations by program and project
    across the specified month range.

    Args:
        start_month: Start month in YYYY-MM format (e.g., "2026-01")
        end_month: End month in YYYY-MM format (e.g., "2026-12")
        department_id: Optional filter by department ID
        program_id: Optional filter by program ID

    Returns:
        ResourceAllocationMatrix with aggregated data

    Example:
        GET /api/resource-matrix/allocation?start_month=2026-01&end_month=2026-12
    """
    try:
        return get_resource_allocation_matrix(
            db=db,
            start_month=start_month,
            end_month=end_month,
            department_id=department_id,
            program_id=program_id,
        )
    except ValueError as e:
        raise app_error(status_code=400, code=ErrorCode.VALIDATION_FAILED, detail=str(e))
    except Exception as e:
        raise app_error(status_code=500, code=ErrorCode.SERVER_INTERNAL_ERROR, detail=f"Internal server error: {str(e)}")


@router.get("/pivot", response_model=PivotMatrixResponse)
def get_pivot_matrix(
    start_month: str,
    end_month: str,
    department_id: Optional[str] = None,
    program_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Get Resource Allocation Pivot Table (User x IO)
    """
    from app.services.resource_matrix_service import get_resource_pivot_matrix
    from app.schemas.resource_matrix import PivotMatrixResponse

    try:
        return get_resource_pivot_matrix(
            db=db,
            start_month=start_month,
            end_month=end_month,
            department_id=department_id,
            program_id=program_id,
        )
    except ValueError as e:
        raise app_error(status_code=400, code=ErrorCode.VALIDATION_FAILED, detail=str(e))
    except Exception as e:
        raise app_error(status_code=500, code=ErrorCode.SERVER_INTERNAL_ERROR, detail=f"Internal server error: {str(e)}")


@router.get("/details", response_model=List[WorklogDetailResponse])
def get_matrix_details(
    user_id: str,
    month: str,
    io_id: str,
    db: Session = Depends(get_db),
):
    """
    Get detailed worklogs for a cell in the pivot table.
    """
    from app.services.resource_matrix_service import get_resource_matrix_details

    try:
        return get_resource_matrix_details(
            db=db,
            user_id=user_id,
            month=month,
            io_id=io_id,
        )
    except Exception as e:
        raise app_error(status_code=500, code=ErrorCode.SERVER_INTERNAL_ERROR, detail=f"Internal server error: {str(e)}")
