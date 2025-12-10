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
)
from app.core.config import settings
from app.services.auth_service import authenticate_user
from app.schemas.auth import Token, UserResponse
from app.models.user import User

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
    return Token(access_token=access_token, token_type="bearer")


@router.post("/refresh", response_model=Token)
async def refresh_token(current_user: User = Depends(get_current_user)):
    """
    Refresh access token using the current valid token.

    Requires a valid Bearer token in Authorization header.
    Returns a new access token with extended expiry.
    """
    # Create new access token for the authenticated user
    access_token = create_access_token(
        data={"sub": current_user.id, "role": current_user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user info.

    Requires a valid Bearer token in Authorization header.
    Returns the authenticated user's profile information.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        korean_name=current_user.korean_name,
        role=current_user.role,
        department_id=current_user.department_id,
        sub_team_id=current_user.sub_team_id,
        position_id=current_user.position_id,
        is_active=current_user.is_active,
    )
