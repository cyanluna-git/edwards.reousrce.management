"""
Dashboard schemas for My FTE feature
"""

from pydantic import BaseModel
from typing import Optional


class MyFTEProjectItem(BaseModel):
    """Individual project FTE data"""
    project_id: str
    project_code: Optional[str] = None
    project_name: Optional[str] = None
    category: str  # PRODUCT, FUNCTIONAL, SUPPORT
    planned_fte: Optional[float] = None
    actual_fte: float
    utilization_percent: Optional[float] = None

    class Config:
        from_attributes = True


class MyFTESummary(BaseModel):
    """Total FTE summary"""
    planned_fte: float
    actual_fte: float
    utilization_percent: Optional[float] = None


class MyFTEProductFunctional(BaseModel):
    """Product/Functional projects grouped by planning status"""
    planned: list[MyFTEProjectItem]
    unplanned: list[MyFTEProjectItem]


class MyFTEResponse(BaseModel):
    """Complete My FTE response"""
    year: int
    month: int
    working_hours_per_month: int
    summary: MyFTESummary
    product_functional: MyFTEProductFunctional
    support: list[MyFTEProjectItem]
