from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from backend.schemas.alert import AlertSummary


class SessionContext(BaseModel):
    """Contextual transaction/call metadata provided when starting a monitoring session."""
    callType: Optional[str] = Field(default="fund_transfer_approval", description="Call type/intent e.g. fund_transfer_approval, wire_transfer")
    amount: Optional[float] = Field(default=None, description="Transaction amount in INR/currency if applicable")
    callerNumber: Optional[str] = Field(default=None, description="Reported caller phone number or VoIP handle")


class StartSessionRequest(BaseModel):
    """
    Payload for POST /api/session/start
    Matches Plane.md Section 4 contract.
    """
    claimedIdentity: Optional[str] = Field(
        default=None,
        description="Enrolled voice profile ID (e.g., vp_9a3f...) of the person the caller claims to be"
    )
    context: Optional[SessionContext] = Field(
        default_factory=SessionContext,
        description="Call metadata including transaction amount and call type"
    )


class StartSessionResponse(BaseModel):
    """
    Response for POST /api/session/start
    Returns session ID and corresponding WebSocket URL for streaming live audio.
    """
    sessionId: str
    websocketUrl: str
    claimedIdentity: Optional[str] = None
    startedAt: datetime


class SessionChunkSummary(BaseModel):
    """Historical chunk data point for session timeline."""
    chunkSeq: int
    syntheticScore: float
    speakerMatchScore: float
    runningRisk: float
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True


class SessionHistoryResponse(BaseModel):
    """
    Response for GET /api/session/{sessionId}/history
    Matches Plane.md Section 4 contract.
    """
    sessionId: str
    claimedIdentity: Optional[str] = None
    personName: Optional[str] = None
    callType: Optional[str] = None
    amount: Optional[float] = None
    callerNumber: Optional[str] = None
    chunks: List[SessionChunkSummary]
    finalRisk: Optional[float] = None
    status: str = "ACTIVE"
    alertsFired: List[AlertSummary] = []
    startedAt: datetime
    endedAt: Optional[datetime] = None


class ActiveSessionSummary(BaseModel):
    """Live summary of an active monitoring session."""
    sessionId: str
    claimedProfileId: Optional[str] = None
    personName: Optional[str] = None
    callType: Optional[str] = None
    amount: Optional[float] = None
    callerNumber: Optional[str] = None
    chunkCount: int = 0
    currentRisk: float = 0.0
    riskLevel: str = "LOW"
    status: str = "ACTIVE"
    startedAt: datetime


class ActiveSessionListResponse(BaseModel):
    """List of active call monitoring sessions."""
    sessions: List[ActiveSessionSummary]
    total: int


class EndSessionResponse(BaseModel):
    """Response when a session is finalized."""
    sessionId: str
    status: str
    finalRisk: float
    riskLevel: str
    totalChunks: int
    totalAlerts: int
    endedAt: datetime
