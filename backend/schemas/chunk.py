from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class ChunkAnalysisResult(BaseModel):
    """
    Standard output contract for scored 3-second audio chunks returned over WebSocket.
    Matches Plane.md Section 4 streaming specification.
    """
    sessionId: str = Field(..., description="Active session ID")
    chunkSeq: int = Field(..., description="Sequential chunk index")
    syntheticScore: float = Field(..., ge=0.0, le=1.0, description="WavLM / Vocoder synthetic artifact anomaly score")
    speakerMatchScore: float = Field(..., ge=0.0, le=1.0, description="ECAPA-TDNN speaker verification match probability")
    runningRisk: float = Field(..., ge=0.0, le=1.0, description="Composite impersonation fraud risk score")
    riskLevel: str = Field(..., description="Risk category: LOW, MEDIUM, HIGH, CRITICAL")
    recommendation: str = Field(..., description="Actionable recommendation: ALLOW, MONITOR, VERIFY_CALLBACK, ESCALATE")
    latencyMs: Optional[float] = Field(default=None, description="Inference processing latency in milliseconds")
    isSilent: bool = Field(default=False, description="True if chunk is silent / below noise threshold")
    alertTriggered: bool = Field(default=False, description="True if this chunk triggered a security alert")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Detailed diagnostic metrics from acoustic models")


class WebSocketChunkInput(BaseModel):
    """
    Schema for optional JSON-formatted chunk over WebSocket (alternative to binary frame).
    """
    chunkSeq: Optional[int] = Field(default=None, description="Chunk sequence number (auto-incremented if omitted)")
    audio: str = Field(..., description="Base64-encoded WAV or raw PCM audio chunk")
