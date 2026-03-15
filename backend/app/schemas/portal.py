"""
Pydantic schemas for Portal access logging and statistics
"""

from datetime import datetime
from typing import Dict, List, Literal
from pydantic import BaseModel


class AccessLogCreate(BaseModel):
    service: Literal["oqc", "jarvis", "testrig", "eob"]


class AccessLogResponse(BaseModel):
    id: int
    user_id: str
    service: str
    accessed_at: datetime

    class Config:
        from_attributes = True


class TopUserItem(BaseModel):
    user_id: str
    name: str
    count: int


class HourlyActivityItem(BaseModel):
    hour: int
    count: int


class PortalStatsResponse(BaseModel):
    service_counts: Dict[str, int]
    top_users: List[TopUserItem]
    hourly_activity: List[HourlyActivityItem]


class MyAccessHistoryResponse(BaseModel):
    items: List[AccessLogResponse]
