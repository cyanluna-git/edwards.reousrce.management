"""
Pydantic Schemas for User CRUD operations
"""

from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserBase(BaseModel):
    """Base schema for user attributes"""

    email: EmailStr
    name: str
    korean_name: Optional[str] = None
    department_id: str
    sub_team_id: Optional[str] = None
    position_id: str
    role: str = "USER"
    is_active: bool = True
    hire_date: Optional[datetime] = None


class UserCreate(UserBase):
    """Schema for creating a new user"""

    password: str


class UserUpdate(BaseModel):
    """Schema for updating an existing user. All fields are optional."""

    email: Optional[EmailStr] = None
    name: Optional[str] = None
    korean_name: Optional[str] = None
    department_id: Optional[str] = None
    sub_team_id: Optional[str] = None
    position_id: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    hire_date: Optional[datetime] = None
    termination_date: Optional[datetime] = None


class User(UserBase):
    """Schema for returning a user from the API"""

    id: str

    class Config:
        from_attributes = True

