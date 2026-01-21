"""
Pydantic Schemas for Resource Allocation Matrix
"""

from typing import Optional, Dict, List
from pydantic import BaseModel


class ResourceAllocationDetail(BaseModel):
    """Individual resource allocation detail"""

    user_id: Optional[str] = None  # None for TBD
    name: str  # "Gerald" or "TBD"
    role: str  # Project Role name
    position: str  # Job Position name
    fte: float  # FTE (Full-Time Equivalent)


class MonthlyAllocation(BaseModel):
    """Monthly allocation for a project"""

    month: str  # "2026-01"
    total_fte: float
    details: List[ResourceAllocationDetail]


class ProjectAllocationRow(BaseModel):
    """Project row in the matrix"""

    project_id: str
    project_code: str  # IO Ref
    project_name: str
    category: str  # PRODUCT | FUNCTIONAL
    allocations: Dict[str, MonthlyAllocation]  # {"2026-01": {...}, ...}


class ProgramGroup(BaseModel):
    """Program group containing projects"""

    program_id: str
    program_name: str
    projects: List[ProjectAllocationRow]
    total_by_month: Dict[str, float]  # Program level monthly total FTE


class ResourceAllocationMatrix(BaseModel):
    """Complete resource allocation matrix"""

    start_month: str
    end_month: str
    months: List[str]  # ["2026-01", "2026-02", ...]
    programs: List[ProgramGroup]
    grand_total_by_month: Dict[str, float]  # Overall total by month
