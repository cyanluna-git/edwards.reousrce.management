"""
Project Roles API endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.organization import ProjectRole

router = APIRouter()


# Pydantic schemas
class ProjectRoleBase(BaseModel):
    name: str
    category: Optional[str] = None
    is_active: bool = True


class ProjectRoleCreate(ProjectRoleBase):
    id: Optional[str] = None  # Auto-generate if not provided


class ProjectRoleUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectRoleResponse(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    is_active: bool
    # Aggregation info
    user_count: int = 0
    project_count: int = 0

    class Config:
        from_attributes = True


# ============ Endpoints ============


@router.get("")
async def list_project_roles(
    include_inactive: bool = False,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all project roles with aggregation info"""
    from sqlalchemy import func, distinct
    from app.models.resource import ResourcePlan

    query = db.query(ProjectRole)
    if not include_inactive:
        query = query.filter(ProjectRole.is_active == True)
    if category:
        query = query.filter(ProjectRole.category == category)

    roles = query.order_by(ProjectRole.category, ProjectRole.name).all()

    # Get aggregation for each role
    result = []
    for role in roles:
        # Count distinct users and projects
        agg = (
            db.query(
                func.count(distinct(ResourcePlan.user_id)).label("user_count"),
                func.count(distinct(ResourcePlan.project_id)).label("project_count"),
            )
            .filter(ResourcePlan.project_role_id == role.id)
            .first()
        )

        result.append(
            {
                "id": role.id,
                "name": role.name,
                "category": role.category,
                "is_active": role.is_active,
                "user_count": agg.user_count if agg else 0,
                "project_count": agg.project_count if agg else 0,
            }
        )

    return result


@router.get("/{role_id}", response_model=ProjectRoleResponse)
async def get_project_role(
    role_id: str,
    db: Session = Depends(get_db),
):
    """Get a single project role by ID"""
    role = db.query(ProjectRole).filter(ProjectRole.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Project role not found")
    return role


@router.post(
    "", response_model=ProjectRoleResponse, status_code=status.HTTP_201_CREATED
)
async def create_project_role(
    data: ProjectRoleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project role"""
    import uuid

    # Check for duplicate name
    existing = db.query(ProjectRole).filter(ProjectRole.name == data.name).first()
    if existing:
        raise HTTPException(
            status_code=400, detail="Project role with this name already exists"
        )

    role_id = data.id if data.id else f"PR_{data.name.upper().replace(' ', '_')[:20]}"

    role = ProjectRole(
        id=role_id,
        name=data.name,
        category=data.category,
        is_active=data.is_active,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.put("/{role_id}")
async def update_project_role(
    role_id: str,
    data: ProjectRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a project role"""
    from sqlalchemy import func, distinct
    from app.models.resource import ResourcePlan

    role = db.query(ProjectRole).filter(ProjectRole.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Project role not found")

    if data.name is not None:
        # Check for duplicate name if name is being changed (only among active roles)
        if data.name != role.name:
            existing = (
                db.query(ProjectRole)
                .filter(ProjectRole.name == data.name, ProjectRole.is_active == True)
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=400, detail="Project role with this name already exists"
                )
        role.name = data.name
    if data.category is not None:
        role.category = data.category
    if data.is_active is not None:
        role.is_active = data.is_active

    db.commit()
    db.refresh(role)

    # Get aggregation info
    agg = (
        db.query(
            func.count(distinct(ResourcePlan.user_id)).label("user_count"),
            func.count(distinct(ResourcePlan.project_id)).label("project_count"),
        )
        .filter(ResourcePlan.project_role_id == role.id)
        .first()
    )

    return {
        "id": role.id,
        "name": role.name,
        "category": role.category,
        "is_active": role.is_active,
        "user_count": agg.user_count if agg else 0,
        "project_count": agg.project_count if agg else 0,
    }


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_role(
    role_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete (soft-delete by setting inactive) a project role"""
    role = db.query(ProjectRole).filter(ProjectRole.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Project role not found")

    # Soft delete by setting inactive
    role.is_active = False
    db.commit()
    return None
