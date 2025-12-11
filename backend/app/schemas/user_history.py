"""
Pydantic Schemas for User History
"""
from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class UserHistoryBase(BaseModel):
    user_id: str
    department_id: int
    sub_team_id: Optional[int] = None
    position_id: str
    start_date: datetime
    end_date: Optional[datetime] = None
    change_type: str
    remarks: Optional[str] = None


class UserHistoryCreate(UserHistoryBase):
    pass


class UserHistory(UserHistoryBase):
    id: int

    class Config:
        from_attributes = True
