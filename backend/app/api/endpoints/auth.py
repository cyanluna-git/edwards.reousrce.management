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
    create_registration_token,
    decode_registration_token,
    decode_token,
    get_current_user,
    verify_password,
    get_password_hash,
    require_write_permission,
)
from app.core.config import settings
from app.services.auth_service import authenticate_user
from app.services.sso_service import SSOService
from app.schemas.auth import Token, TokenRefreshRequest, UserResponse, PasswordChangeRequest, PasswordChangeResponse, SSORegistrationRequest
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
    
    # Determine if we are using HTTPS
    # In production (not DEBUG), we should generally assume HTTPS if being accessed via the proxy
    is_https = request.url.scheme == 'https' or (not settings.DEBUG and not "localhost" in request.url.netloc)
    
    request_data = {
        'https': 'on' if is_https else 'off',
        'http_host': request.url.netloc,
        'script_name': request.url.path,
        'server_port': request.url.port or (443 if is_https else 80),
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
    # Consistent HTTPS detection
    is_https = request.url.scheme == 'https' or (not settings.DEBUG and not "localhost" in request.url.netloc)
    
    request_data = {
        'https': 'on' if is_https else 'off',
        'http_host': request.url.netloc,
        'script_name': request.url.path,
        'server_port': request.url.port or (443 if is_https else 80),
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
    
    # Match user in DB (Case-insensitive)
    from sqlalchemy import func
    from urllib.parse import quote
    user = db.query(User).filter(func.lower(User.email) == func.lower(email)).first()

    # Build frontend base URL for error redirects
    if settings.DEBUG:
        frontend_base = "http://localhost:3004"
    else:
        scheme = "https" if request.url.scheme == "https" or not settings.DEBUG else "http"
        frontend_base = f"{scheme}://{request.url.netloc}"

    if not user:
        logger.info(f"SSO: Unregistered user {email}, redirecting to registration")
        reg_token = create_registration_token({
            "email": email,
            "name": user_info.get("name", ""),
        })
        return RedirectResponse(
            url=f"{frontend_base}/register?token={reg_token}",
            status_code=status.HTTP_302_FOUND,
        )

    if not user.is_active:
        logger.warning(f"SSO Login attempt for inactive user: {email}")
        return RedirectResponse(
            url=f"{frontend_base}/login?error=inactive&email={quote(email)}",
            status_code=status.HTTP_302_FOUND,
        )

    # Create tokens
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(data={"sub": user.id, "role": user.role})
    
    # Redirect to frontend with tokens in URL fragment
    # Fragment is not sent to server logs or Referer headers.
    # In production, the frontend is served on the same domain as the API
    # In local development, the frontend usually runs on port 3004
    if settings.DEBUG:
        # Use localhost:3004 for local frontend development
        frontend_url = (
            f"http://localhost:3004/#token={access_token}&refresh={refresh_token}"
        )
    else:
        # In production, use the current host and protocol
        scheme = "https" if request.url.scheme == "https" or not settings.DEBUG else "http"
        frontend_url = (
            f"{scheme}://{request.url.netloc}/#token={access_token}&refresh={refresh_token}"
        )
    
    logger.info(f"SSO Login successful for {email}, redirecting to frontend")
    return RedirectResponse(url=frontend_url, status_code=status.HTTP_302_FOUND)


@router.post("/sso/register", response_model=Token)
async def sso_register(body: SSORegistrationRequest, db: Session = Depends(get_db)):
    """
    SSO self-registration endpoint.
    Creates a new user from a valid registration token (issued during SSO callback for unregistered users).
    """
    import secrets
    from sqlalchemy import func
    from app.services.user_service import UserService
    from app.schemas.user import UserCreate
    from app.models.organization import Department, JobPosition

    # 1. Decode and validate registration token
    payload = decode_registration_token(body.registration_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired registration token. Please sign in with SSO again.",
        )

    email = payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid registration token: missing email",
        )

    # 2. Check for duplicate user
    existing_user = db.query(User).filter(func.lower(User.email) == func.lower(email)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # 3. Validate department_id and position_id
    department = db.query(Department).filter(Department.id == body.department_id).first()
    if not department:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid department selected.",
        )

    position = db.query(JobPosition).filter(JobPosition.id == body.position_id).first()
    if not position:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid position selected.",
        )

    # 4. Create user via UserService (handles UserHistory automatically)
    user_service = UserService(db)
    user_create = UserCreate(
        email=email,
        name=body.name,
        korean_name=body.korean_name,
        department_id=body.department_id,
        position_id=body.position_id,
        password=secrets.token_urlsafe(32),
        role="USER",
    )
    new_user = user_service.create_user(user_create)

    # 5. Issue tokens
    access_token = create_access_token(
        data={"sub": new_user.id, "role": new_user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(data={"sub": new_user.id, "role": new_user.role})

    logger.info(f"SSO self-registration successful for {email}")
    return Token(access_token=access_token, refresh_token=refresh_token, token_type="bearer")
