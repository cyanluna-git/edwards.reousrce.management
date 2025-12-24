"""
API endpoints for Work Type Categories
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.work_type import (
    WorkTypeCategory,
    WorkTypeCategoryCreate,
    WorkTypeCategoryUpdate,
    WorkTypeCategoryTree,
    WorkTypeCategoryFlat,
)
from app.services.work_type_service import WorkTypeCategoryService

router = APIRouter()


@router.get("/", response_model=List[WorkTypeCategory])
async def list_work_type_categories(
    level: Optional[int] = Query(
        None, ge=1, le=3, description="Filter by level (1, 2, or 3)"
    ),
    parent_id: Optional[int] = Query(None, description="Filter by parent category ID"),
    is_active: bool = Query(True, description="Filter by active status"),
    db: Session = Depends(get_db),
):
    """
    List work type categories with optional filters
    """
    service = WorkTypeCategoryService(db)

    if parent_id is not None:
        return service.get_children(parent_id, is_active)
    elif level is not None:
        return service.get_by_level(level, is_active)
    else:
        return service.get_all(is_active)


@router.get("/tree", response_model=List[WorkTypeCategoryTree])
async def get_work_type_category_tree(
    db: Session = Depends(get_db),
):
    """
    Get full category tree (hierarchical structure)
    L1 categories with nested L2 and L3 children
    """
    service = WorkTypeCategoryService(db)
    return service.get_tree()


@router.get("/by-role", response_model=List[WorkTypeCategory])
async def get_categories_by_role(
    role: str = Query(..., description="User role (e.g., SW_ENGINEER, PM)"),
    level: Optional[int] = Query(None, ge=1, le=3, description="Filter by level"),
    db: Session = Depends(get_db),
):
    """
    Get categories applicable to a specific job role
    Returns categories where applicable_roles is null (universal) or contains the role
    """
    service = WorkTypeCategoryService(db)
    return service.get_by_role(role, level)


@router.get("/{category_id}", response_model=WorkTypeCategory)
async def get_work_type_category(
    category_id: int,
    db: Session = Depends(get_db),
):
    """
    Get a specific category by ID
    """
    service = WorkTypeCategoryService(db)
    category = service.get_by_id(category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )
    return category


@router.post("/", response_model=WorkTypeCategory, status_code=status.HTTP_201_CREATED)
async def create_work_type_category(
    category_in: WorkTypeCategoryCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new work type category
    """
    service = WorkTypeCategoryService(db)

    # Check if code already exists
    existing = service.get_by_code(category_in.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category with code '{category_in.code}' already exists",
        )

    return service.create(category_in)


@router.put("/{category_id}", response_model=WorkTypeCategory)
async def update_work_type_category(
    category_id: int,
    category_in: WorkTypeCategoryUpdate,
    db: Session = Depends(get_db),
):
    """
    Update a work type category
    """
    service = WorkTypeCategoryService(db)
    category = service.update(category_id, category_in)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )
    return category


@router.get("/legacy-mappings/", response_model=List[dict])
async def get_legacy_mappings(
    db: Session = Depends(get_db),
):
    """
    Get all legacy work_type string to new category mappings
    """
    service = WorkTypeCategoryService(db)
    mappings = service.get_all_legacy_mappings()
    return [
        {
            "legacy_work_type": m.legacy_work_type,
            "category_id": m.category_id,
            "category_code": m.category.code if m.category else None,
            "category_name": m.category.name if m.category else None,
        }
        for m in mappings
    ]
