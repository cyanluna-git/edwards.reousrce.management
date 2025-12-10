"""
Authentication endpoints
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, verify_password, get_password_hash
from app.core.config import settings

router = APIRouter()


@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    """
    Login endpoint - returns JWT access token
    """
    # TODO: Implement actual user authentication from database
    # For now, return a mock token for development
    access_token = create_access_token(
        data={"sub": "test_user", "role": "ADMIN"},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh")
async def refresh_token():
    """
    Refresh access token
    """
    # TODO: Implement token refresh logic
    return {"message": "Token refresh endpoint - to be implemented"}


@router.get("/me")
async def get_current_user_info():
    """
    Get current authenticated user info
    """
    # TODO: Implement with actual user from token
    return {"message": "Current user endpoint - to be implemented"}
