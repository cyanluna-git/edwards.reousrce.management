"""
Authentication Schemas - Pydantic models for auth endpoints
"""

from typing import Optional
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    """JWT Token response"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """JWT payload data"""

    user_id: Optional[str] = None
    role: Optional[str] = None


class UserLogin(BaseModel):
    """Login request body"""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """User info response"""

    id: str
    email: str
    name: str
    korean_name: Optional[str] = None
    role: str
    sub_team_id: Optional[str] = None
    position_id: str
    department_id: Optional[str] = None
    primary_business_unit_id: Optional[str] = None
    is_active: bool
    # Nested relationships
    department: Optional[dict] = None
    sub_team: Optional[dict] = None
    position: Optional[dict] = None
    primary_business_unit: Optional[dict] = None

    class Config:
        from_attributes = True


class PasswordChangeRequest(BaseModel):
    """Password change request"""

    current_password: str
    new_password: str


class PasswordChangeResponse(BaseModel):
    """Password change response"""

    message: str
    success: bool


class TokenRefreshRequest(BaseModel):
    """Token refresh request - uses refresh token"""

    refresh_token: str
