"""
Users endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.user import User, UserCreate, UserUpdate
from app.schemas.user_history import UserHistory
from app.services.user_service import UserService

router = APIRouter()


@router.get("", response_model=List[User])
async def list_users(
    department_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    List users with optional filters.
    - **department_id**: Filter by department.
    - **is_active**: Filter by active status (default: True).
    """
    service = UserService(db)
    users = service.get_multi(
        skip=skip, limit=limit, department_id=department_id, is_active=is_active
    )
    return users


@router.post("", response_model=User, status_code=status.HTTP_201_CREATED)
async def create_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Create a new user.
    """
    service = UserService(db)
    existing_user = service.get_by_email(email=user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )
    user = service.create_user(user_in=user_in)
    return user


@router.get("/{user_id}", response_model=User)
async def get_user(user_id: str, db: Session = Depends(get_db)):
    """
    Get a specific user by their ID.
    """
    service = UserService(db)
    user = service.get_by_id(user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return user


@router.put("/{user_id}", response_model=User)
async def update_user(user_id: str, user_in: UserUpdate, db: Session = Depends(get_db)):
    """
    Update a user's information.
    """
    service = UserService(db)
    user = service.get_by_id(user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    updated_user = service.update(user=user, user_in=user_in)
    return updated_user


@router.delete("/{user_id}", response_model=User)
async def delete_user(user_id: str, db: Session = Depends(get_db)):
    """
    Soft delete a user by setting them as inactive.
    """
    service = UserService(db)
    user = service.delete(user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return user


@router.get("/{user_id}/history", response_model=List[UserHistory])
async def get_user_history(user_id: str, db: Session = Depends(get_db)):
    """
    Get change history for a specific user.
    """
    service = UserService(db)
    # Check if user exists first
    user = service.get_by_id(user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    
    history = service.get_history_by_user_id(user_id=user_id)
    return history


@router.get("/{user_id}/worklogs")
async def get_user_worklogs(user_id: str, db: Session = Depends(get_db)):
    """
    Get worklogs for a specific user.
    """
    # TODO: Implement user worklogs retrieval via a WorklogService
    return {"message": f"Get worklogs for user {user_id} - to be implemented"}