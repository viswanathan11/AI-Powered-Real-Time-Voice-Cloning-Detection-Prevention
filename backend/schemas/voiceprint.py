from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class EnrollVoiceprintRequest(BaseModel):
    """
    Request payload to enroll an executive/authorized individual's voice profile.
    Accepts 1 to 5 base64-encoded WAV/PCM audio samples.
    """
    personName: str = Field(..., min_length=1, description="Full name of the executive")
    role: Optional[str] = Field(default="CFO", description="Role/Designation e.g., CEO, CFO, VP")
    orgId: Optional[str] = Field(default="org_default", description="Organization or Enterprise ID")
    audioSamples: List[str] = Field(..., min_length=1, description="List of base64-encoded 16kHz audio clips (3-5 clips recommended)")


class VoiceProfileResponse(BaseModel):
    """
    Public response schema for enrolled voice profile.
    Privacy Guarantee: Never exposes raw audio or internal high-dimensional vector to public clients.
    """
    profileId: str = Field(..., description="Unique voice profile identifier (e.g., vp_9a3f...)")
    personName: str
    role: Optional[str] = None
    orgId: Optional[str] = None
    sampleCount: int = Field(..., description="Number of audio samples used to calculate reference embedding")
    enrolledAt: datetime

    class Config:
        from_attributes = True


class VoiceProfileDetail(VoiceProfileResponse):
    """Internal/Admin profile detail schema."""
    embeddingDimension: int = Field(default=192, description="Dimension of ECAPA-TDNN embedding")


class VoiceProfileListResponse(BaseModel):
    """List of enrolled voice profiles."""
    profiles: List[VoiceProfileResponse]
    total: int
