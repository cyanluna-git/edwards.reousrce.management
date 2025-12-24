"""
Pydantic Schemas for Work Type Categories
"""

from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime


# Base schema
class WorkTypeCategoryBase(BaseModel):
    code: str
    name: str
    name_ko: Optional[str] = None
    description: Optional[str] = None
    level: int  # 1, 2, or 3
    parent_id: Optional[int] = None
    sort_order: int = 0
    applicable_roles: Optional[str] = None


class WorkTypeCategoryCreate(WorkTypeCategoryBase):
    pass


class WorkTypeCategoryUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    name_ko: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    applicable_roles: Optional[str] = None


class WorkTypeCategory(WorkTypeCategoryBase):
    id: int
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkTypeCategoryWithChildren(WorkTypeCategory):
    """Category with nested children for tree view"""

    children: List["WorkTypeCategoryWithChildren"] = []


# For hierarchical tree response
class WorkTypeCategoryTree(BaseModel):
    id: int
    code: str
    name: str
    name_ko: Optional[str] = None
    level: int
    children: List["WorkTypeCategoryTree"] = []

    class Config:
        from_attributes = True


# For dropdown selection (flat with parent info)
class WorkTypeCategoryFlat(BaseModel):
    id: int
    code: str
    name: str
    name_ko: Optional[str] = None
    level: int
    parent_id: Optional[int] = None
    parent_code: Optional[str] = None
    parent_name: Optional[str] = None

    class Config:
        from_attributes = True


# Legacy mapping
class WorkTypeLegacyMappingBase(BaseModel):
    legacy_work_type: str
    category_id: int


class WorkTypeLegacyMapping(WorkTypeLegacyMappingBase):
    id: int

    class Config:
        from_attributes = True
