"""
Authentication endpoints
"""

import logging
import traceback
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
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
from app.services.sso_service import SSOService
from app.schemas.auth import Token, TokenRefreshRequest, UserResponse, PasswordChangeRequest, PasswordChangeResponse
from app.models.user import User
from sqlalchemy.orm import joinedload

router = APIRouter()
logger = logging.getLogger(__name__)


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
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Login failed: %s", e)
        detail = "Internal server error during login."
        if settings.DEBUG:
            detail += f" Debug: {type(e).__name__}: {e}"
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)


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
    db.add(current_user)
    db.flush()
    db.commit()

    # Verify the change persisted
    db.refresh(current_user)
    if not verify_password(password_data.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed to persist. Please try again.",
        )

    return PasswordChangeResponse(
        message="Password changed successfully",
        success=True,
    )


@router.get("/sso/login")
async def sso_login(request: Request):
    """
    Initiate SAML SSO login process.
    Redirects user to the Identity Provider (Entra ID).
    """
    if not settings.SAML_ENABLED:
        raise HTTPException(status_code=400, detail="SSO is not enabled")
    
    request_data = {
        'https': 'on' if request.url.scheme == 'https' else 'off',
        'http_host': request.url.netloc,
        'script_name': request.url.path,
        'server_port': request.url.port or (443 if request.url.scheme == 'https' else 80),
        'get_data': dict(request.query_params),
        'post_data': {},
        'query_string': request.url.query
    }
    
    auth = SSOService.init_saml_auth(request_data)
    return RedirectResponse(auth.login())


@router.post("/sso/callback")
async def sso_callback(request: Request, db: Session = Depends(get_db)):
    """
    SAML Assertion Consumer Service (ACS) endpoint.
    Handles the POST response from Entra ID after user authentication.
    """
    if not settings.SAML_ENABLED:
        raise HTTPException(status_code=400, detail="SSO is not enabled")
        
    form_data = await request.form()
    request_data = {
        'https': 'on' if request.url.scheme == 'https' else 'off',
        'http_host': request.url.netloc,
        'script_name': request.url.path,
        'server_port': request.url.port or (443 if request.url.scheme == 'https' else 80),
        'get_data': dict(request.query_params),
        'post_data': dict(form_data),
        'query_string': request.url.query
    }
    
    auth = SSOService.init_saml_auth(request_data)
    auth.process_response()
    
    errors = auth.get_errors()
    if errors:
        logger.error(f"SAML Error: {errors}")
        logger.error(f"Last Error Reason: {auth.get_last_error_reason()}")
        raise HTTPException(status_code=401, detail=f"SAML Authentication failed: {errors}")
    
    if not auth.is_authenticated():
        raise HTTPException(status_code=401, detail="SAML User not authenticated")
    
    # Extract user info
    user_info = SSOService.extract_user_attributes(auth)
    email = user_info.get("email")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email not found in SAML assertion")
    
    # Match user in DB
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Optional: Auto-create user if not exists? 
        # For now, we only allow existing users
        logger.warning(f"SSO Login attempt for non-existent user: {email}")
        raise HTTPException(status_code=403, detail="Your account is not registered in this system.")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive.")

    # Create tokens
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(data={"sub": user.id, "role": user.role})
    
    # Redirect to frontend with tokens in URL (or set cookie)
    # Adjust the frontend URL as needed
    frontend_url = f"https://{request.url.netloc}/?token={access_token}&refresh={refresh_token}"
    return RedirectResponse(url=frontend_url)
