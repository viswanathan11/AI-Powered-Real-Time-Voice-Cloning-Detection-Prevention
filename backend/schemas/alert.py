from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class AlertSummary(BaseModel):
    """Compact summary of an alert triggered during a session."""
    chunkSeq: int
    type: str = Field(..., description="Alert type e.g., VERIFY_CALLBACK, ESCALATE")
    riskScore: Optional[float] = None
    reason: Optional[str] = None
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertResponse(BaseModel):
    """Full detail of an alert."""
    id: str
    sessionId: str
    chunkSeq: int
    alertType: str
    riskScore: Optional[float] = None
    reason: Optional[str] = None
    createdAt: datetime

    class Config:
        from_attributes = True


class AlertListResponse(BaseModel):
    """List of alerts across sessions."""
    alerts: List[AlertResponse]
    total: int
