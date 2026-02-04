"""
Authentication endpoints
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    verify_password,
    get_password_hash,
    require_write_permission,
)
from app.core.config import settings
from app.services.auth_service import authenticate_user
from app.schemas.auth import Token, TokenRefreshRequest, UserResponse, PasswordChangeRequest, PasswordChangeResponse
from app.models.user import User
from sqlalchemy.orm import joinedload

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    """
    Login endpoint - authenticate user and return JWT access token.

    Uses OAuth2 password flow:
    - username: user's email address
    - password: user's password

    Returns JWT access token on successful authentication.
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": user.id, "role": user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(data={"sub": user.id, "role": user.role})
    return Token(access_token=access_token, refresh_token=refresh_token, token_type="bearer")


@router.post("/refresh", response_model=Token)
async def refresh_token(body: TokenRefreshRequest, db: Session = Depends(get_db)):
    """
    Refresh access token using a valid refresh token.

    Accepts a refresh token in the request body.
    Returns new access and refresh tokens.
    """
    payload = decode_token(body.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    new_access_token = create_access_token(
        data={"sub": user.id, "role": user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    new_refresh_token = create_refresh_token(data={"sub": user.id, "role": user.role})
    return Token(access_token=new_access_token, refresh_token=new_refresh_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get current authenticated user info with full profile details.

    Requires a valid Bearer token in Authorization header.
    Returns the authenticated user's profile information including department, sub_team, position, and business unit.
    """
    # Reload user with relationships
    user = (
        db.query(User)
        .options(
            joinedload(User.department),
            joinedload(User.sub_team),
            joinedload(User.position),
            joinedload(User.primary_business_unit),
        )
        .filter(User.id == current_user.id)
        .first()
    )

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        korean_name=user.korean_name,
        role=user.role,
        sub_team_id=user.sub_team_id,
        position_id=user.position_id,
        department_id=user.department_id,
        primary_business_unit_id=user.primary_business_unit_id,
        is_active=user.is_active,
        department={
            "id": user.department.id,
            "name": user.department.name,
            "code": user.department.code,
        }
        if user.department
        else None,
        sub_team={
            "id": user.sub_team.id,
            "name": user.sub_team.name,
            "code": user.sub_team.code,
        }
        if user.sub_team
        else None,
        position={
            "id": user.position.id,
            "name": user.position.name,
            "level": user.position.level,
        }
        if user.position
        else None,
        primary_business_unit={
            "id": user.primary_business_unit.id,
            "name": user.primary_business_unit.name,
            "code": user.primary_business_unit.code,
        }
        if user.primary_business_unit
        else None,
    )


@router.post("/change-password", response_model=PasswordChangeResponse)
async def change_password(
    password_data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Change user's password.

    Requires:
    - Valid Bearer token in Authorization header
    - Current password (for verification)
    - New password (minimum 6 characters)

    Returns success message on successful password change.
    """
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Validate new password
    if len(password_data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long",
        )

    # Update password
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()

    return PasswordChangeResponse(
        message="Password changed successfully",
        success=True,
    )
