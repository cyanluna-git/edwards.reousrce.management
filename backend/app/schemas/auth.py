"""
Authentication Schemas - Pydantic models for auth endpoints
"""

from typing import Optional
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    """JWT Token response"""

    access_token: str
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
    department_id: str
    sub_team_id: Optional[str] = None
    position_id: str
    is_active: bool

    class Config:
        from_attributes = True


class TokenRefreshRequest(BaseModel):
    """Token refresh request - uses current token from header"""

    pass
