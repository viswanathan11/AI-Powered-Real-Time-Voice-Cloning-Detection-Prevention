from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# --- Chunk Analysis Schemas ---
class AnalyzeChunkRequest(BaseModel):
    audio: str = Field(
        ...,
        description="Base64-encoded 16kHz mono WAV or PCM audio chunk"
    )
    compareToProfileId: Optional[str] = Field(
        None,
        description="Optional ID of enrolled voiceprint profile to compare speaker against"
    )
    profileEmbedding: Optional[List[float]] = Field(
        None,
        description="Optional pre-extracted 192-dim reference speaker embedding"
    )
    sessionId: Optional[str] = Field(
        None,
        description="Optional session identifier for correlation"
    )
    chunkSeq: Optional[int] = Field(
        None,
        description="Optional sequence number of the chunk in the streaming session"
    )


class AnalyzeChunkResponse(BaseModel):
    syntheticScore: float = Field(
        ...,
        description="Score between 0.0 (genuine human) and 1.0 (AI cloned/synthetic voice)"
    )
    speakerMatchScore: float = Field(
        ...,
        description="Score between 0.0 (different speaker) and 1.0 (matching enrolled speaker)"
    )
    runningRisk: float = Field(
        ...,
        description="Composite risk score computed from syntheticScore and speaker mismatch"
    )
    riskLevel: str = Field(
        ...,
        description="Risk level classification: LOW, MEDIUM, HIGH, CRITICAL"
    )
    recommendation: str = Field(
        ...,
        description="Actionable mitigation advice: ALLOW, MONITOR, VERIFY_CALLBACK, ESCALATE"
    )
    latencyMs: float = Field(
        ...,
        description="Total ML inference processing time in milliseconds"
    )
    audioDurationSec: float = Field(
        ...,
        description="Duration of the processed audio chunk in seconds"
    )
    isSilent: bool = Field(
        ...,
        description="True if audio chunk contains silence or low background noise"
    )
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Diagnostic breakdown of acoustic features and model scores"
    )


# --- Embedding Extraction Schemas ---
class ExtractEmbeddingRequest(BaseModel):
    audio: Optional[str] = Field(
        None,
        description="Single base64-encoded WAV audio sample"
    )
    audioSamples: Optional[List[str]] = Field(
        None,
        description="List of base64-encoded WAV audio samples to average into a single embedding"
    )


class ExtractEmbeddingResponse(BaseModel):
    embedding: List[float] = Field(
        ...,
        description="Normalized 192-dimensional ECAPA-TDNN speaker vector"
    )
    dimension: int = Field(
        default=192,
        description="Dimension size of the embedding vector"
    )
    sampleCount: int = Field(
        default=1,
        description="Number of audio clips averaged to generate this embedding"
    )


# --- Profile Enrollment Schemas ---
class EnrollProfileRequest(BaseModel):
    personName: str = Field(
        ...,
        description="Name of the person being enrolled (e.g. Ramesh Kumar)"
    )
    role: Optional[str] = Field(
        None,
        description="Executive / Institutional role (e.g. CFO, CEO, Director)"
    )
    orgId: Optional[str] = Field(
        None,
        description="Organization or tenant identifier"
    )
    audioSamples: List[str] = Field(
        ...,
        description="Array of 3-5 base64-encoded genuine voice clips for enrollment"
    )
    profileId: Optional[str] = Field(
        None,
        description="Optional custom profile identifier (e.g. vp_9a3f...)"
    )


class VoiceProfileResponse(BaseModel):
    profileId: str = Field(..., description="Unique profile identifier")
    personName: str = Field(..., description="Person's full name")
    role: Optional[str] = Field(None, description="Role / title")
    orgId: Optional[str] = Field(None, description="Organization ID")
    sampleCount: int = Field(..., description="Number of enrolled audio samples")
    embedding: Optional[List[float]] = Field(None, description="192-dim reference speaker vector")
    enrolledAt: str = Field(..., description="ISO 8601 UTC timestamp of enrollment")


# --- Direct Verification & Synthetic Detection Schemas ---
class VerifySpeakerRequest(BaseModel):
    audio: str = Field(..., description="Base64-encoded test audio chunk")
    referenceAudio: Optional[str] = Field(None, description="Base64-encoded reference audio clip")
    referenceEmbedding: Optional[List[float]] = Field(None, description="192-dim reference vector")


class VerifySpeakerResponse(BaseModel):
    speakerMatchScore: float = Field(..., description="Calibrated match probability [0.0, 1.0]")
    cosineSimilarity: float = Field(..., description="Raw cosine similarity [-1.0, 1.0]")
    isMatch: bool = Field(..., description="Whether similarity exceeds threshold")
    threshold: float = Field(..., description="Decision threshold applied")
    isSilent: Optional[bool] = False


class DetectSyntheticRequest(BaseModel):
    audio: str = Field(..., description="Base64-encoded audio chunk")


class DetectSyntheticResponse(BaseModel):
    syntheticScore: float = Field(..., description="Synthetic probability [0.0, 1.0]")
    isSynthetic: bool = Field(..., description="True if syntheticScore >= threshold")
    details: Dict[str, Any] = Field(..., description="Vocoder and transformer artifact details")


# --- System Health Schema ---
class HealthResponse(BaseModel):
    status: str
    appName: str
    appVersion: str
    device: str
    modelsLoaded: Dict[str, Any]
