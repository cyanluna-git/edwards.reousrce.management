"""
API Endpoints for Resource Allocation Matrix
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.resource_matrix import ResourceAllocationMatrix
from app.services.resource_matrix_service import get_resource_allocation_matrix

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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
