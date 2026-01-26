"""
AI WorkLog Parsing Schemas
Schemas for AI-assisted worklog entry parsing
"""

from typing import Optional
from pydantic import BaseModel, Field


class AIWorklogParseRequest(BaseModel):
    """Request schema for AI worklog parsing"""

    text: str = Field(..., description="Natural language work description")
    user_id: str = Field(..., description="User ID for the worklogs")
    target_date: str = Field(..., description="Target date in YYYY-MM-DD format")


class AIWorklogEntry(BaseModel):
    """Single parsed worklog entry from AI"""

    project_id: Optional[str] = Field(None, description="Matched project ID")
    project_name: Optional[str] = Field(None, description="Matched project name")
    work_type_category_id: Optional[int] = Field(None, description="Matched work type category ID")
    work_type_name: Optional[str] = Field(None, description="Matched work type name")
    description: str = Field(..., description="Work description extracted from input")
    hours: float = Field(..., gt=0, le=24, description="Estimated work hours")
    confidence: float = Field(
        default=0.5,
        ge=0,
        le=1,
        description="AI confidence score for the mapping (0~1)"
    )


class AIWorklogParseResponse(BaseModel):
    """Response schema for AI worklog parsing"""

    entries: list[AIWorklogEntry] = Field(default_factory=list, description="Parsed worklog entries")
    total_hours: float = Field(default=0.0, description="Total hours across all entries")
    warnings: list[str] = Field(default_factory=list, description="Warnings or notes about the parsing")


class AIHealthResponse(BaseModel):
    """Response schema for AI health check"""

    status: str = Field(..., description="AI service status: 'healthy' or 'unhealthy'")
    model: str = Field(..., description="Currently configured AI model")
    message: Optional[str] = Field(None, description="Additional status message")
