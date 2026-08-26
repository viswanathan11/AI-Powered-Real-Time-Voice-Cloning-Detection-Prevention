import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status

from app.config import settings
from app.utils.logger import logger
from app.api.schemas import (
    AnalyzeChunkRequest,
    AnalyzeChunkResponse,
    ExtractEmbeddingRequest,
    ExtractEmbeddingResponse,
    EnrollProfileRequest,
    VoiceProfileResponse,
    VoiceProfileListResponse,
    VerifySpeakerRequest,
    VerifySpeakerResponse,
    DetectSyntheticRequest,
    DetectSyntheticResponse,
    StartSessionRequest,
    StartSessionResponse,
    HealthResponse
)
from app.services.analysis_service import analysis_service
from app.services.profile_store import profile_store
from app.models.model_manager import model_manager

router = APIRouter(tags=["Voice Analysis, Verification & Sessions"])


# ============================================================================
# Session & Voiceprint Endpoints (Frontend API)
# ============================================================================

@router.get(
    "/voiceprints",
    response_model=List[VoiceProfileResponse],
    summary="List all enrolled voiceprints",
    description="Returns a JSON list of all enrolled voiceprint profiles."
)
async def list_voiceprints() -> List[VoiceProfileResponse]:
    profiles = profile_store.list_profiles()
    return [VoiceProfileResponse(**p.to_dict(include_embedding=False)) for p in profiles]


@router.get(
    "/voiceprint/profiles",
    response_model=VoiceProfileListResponse,
    summary="List all enrolled voiceprints (Frontend contract)",
    description="Returns a paginated list of all enrolled voiceprint profiles."
)
async def list_voiceprints_paginated() -> VoiceProfileListResponse:
    profiles = profile_store.list_profiles()
    profile_responses = [VoiceProfileResponse(**p.to_dict(include_embedding=False)) for p in profiles]
    return VoiceProfileListResponse(
        profiles=profile_responses,
        total=len(profile_responses)
    )


@router.post(
    "/voiceprint/enroll",
    response_model=VoiceProfileResponse,
    summary="Enroll a genuine voiceprint profile (alias)"
)
async def enroll_voiceprint_alias(request: EnrollProfileRequest) -> VoiceProfileResponse:
    return await enroll_profile(request)


@router.post(
    "/session/start",
    response_model=StartSessionResponse,
    summary="Start a live audio streaming session",
    description="Initializes a new live audio monitoring session for a target voiceprint."
)
async def start_session(request: StartSessionRequest) -> StartSessionResponse:
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    target_profile_id = request.profileId or request.claimedIdentity
    now_iso = datetime.now(timezone.utc).isoformat()
    return StartSessionResponse(
        sessionId=session_id,
        status="STARTED",
        profileId=target_profile_id,
        websocketUrl=f"ws://localhost:8000/ws/session/{session_id}",
        startedAt=now_iso
    )




@router.post(
    "/analyze-chunk",
    response_model=AnalyzeChunkResponse,
    summary="Analyze live audio chunk for synthetic artifacts and speaker match",
    description="Processes an incoming 3-second 16kHz mono audio chunk, computes synthetic voice score, verifies speaker identity against enrolled profile, and outputs live composite risk score."
)
async def analyze_chunk(request: AnalyzeChunkRequest) -> AnalyzeChunkResponse:
    try:
        result = analysis_service.analyze_chunk(
            audio_b64=request.audio,
            compare_to_profile_id=request.compareToProfileId,
            profile_embedding=request.profileEmbedding
        )
        return AnalyzeChunkResponse(**result)
    except ValueError as ve:
        logger.error(f"Validation error in analyze_chunk: {ve}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Internal error analyzing audio chunk: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to analyze audio chunk: {str(e)}")


@router.post(
    "/extract-embedding",
    response_model=ExtractEmbeddingResponse,
    summary="Extract ECAPA-TDNN speaker embedding vector(s)",
    description="Extracts and averages 192-dimensional ECAPA-TDNN speaker vectors from one or multiple base64 WAV samples."
)
async def extract_embedding(request: ExtractEmbeddingRequest) -> ExtractEmbeddingResponse:
    samples = []
    if request.audioSamples:
        samples.extend(request.audioSamples)
    if request.audio:
        samples.append(request.audio)

    if not samples:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either 'audio' or 'audioSamples'"
        )

    try:
        embedding, sample_count = analysis_service.extract_embedding_from_samples(samples)
        return ExtractEmbeddingResponse(
            embedding=embedding,
            dimension=len(embedding),
            sampleCount=sample_count
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error extracting embedding: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/enroll-profile",
    response_model=VoiceProfileResponse,
    summary="Enroll a genuine voiceprint profile",
    description="Extracts and averages embeddings across genuine voice samples, stores profile in memory, and returns reference metadata without persisting raw audio."
)
async def enroll_profile(request: EnrollProfileRequest) -> VoiceProfileResponse:
    try:
        profile = analysis_service.enroll_voice_samples(
            person_name=request.personName,
            role=request.role,
            org_id=request.orgId,
            audio_samples_b64=request.audioSamples,
            profile_id=request.profileId
        )
        return VoiceProfileResponse(**profile.to_dict(include_embedding=True))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error enrolling profile: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/profiles",
    response_model=List[VoiceProfileResponse],
    summary="List all enrolled voice profiles"
)
async def list_profiles() -> List[VoiceProfileResponse]:
    profiles = profile_store.list_profiles()
    return [VoiceProfileResponse(**p.to_dict(include_embedding=False)) for p in profiles]


@router.get(
    "/profiles/{profile_id}",
    response_model=VoiceProfileResponse,
    summary="Retrieve voice profile by ID"
)
async def get_profile(profile_id: str) -> VoiceProfileResponse:
    profile = profile_store.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Voice profile '{profile_id}' not found")
    return VoiceProfileResponse(**profile.to_dict(include_embedding=True))


@router.delete(
    "/profiles/{profile_id}",
    summary="Delete voice profile by ID"
)
async def delete_profile(profile_id: str):
    deleted = profile_store.delete_profile(profile_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Voice profile '{profile_id}' not found")
    return {"message": f"Profile '{profile_id}' deleted successfully", "profileId": profile_id}


@router.post(
    "/verify-speaker",
    response_model=VerifySpeakerResponse,
    summary="Direct speaker verification comparison"
)
async def verify_speaker(request: VerifySpeakerRequest) -> VerifySpeakerResponse:
    try:
        result = analysis_service.verify_speaker_direct(
            audio_b64=request.audio,
            reference_audio_b64=request.referenceAudio,
            reference_embedding=request.referenceEmbedding
        )
        return VerifySpeakerResponse(**result)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error verifying speaker: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/detect-synthetic",
    response_model=DetectSyntheticResponse,
    summary="Direct synthetic / deepfake artifact detection"
)
async def detect_synthetic(request: DetectSyntheticRequest) -> DetectSyntheticResponse:
    try:
        waveform, sr, is_silent, _ = analysis_service.audio_proc.decode_base64_audio(request.audio)
        score, details = analysis_service.wavlm.detect_synthetic(waveform, sample_rate=sr, is_silent=is_silent)
        return DetectSyntheticResponse(
            syntheticScore=score,
            isSynthetic=score >= settings.SYNTHETIC_SCORE_THRESHOLD,
            details=details
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error detecting synthetic voice: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="ML Service Health & Model Readiness"
)
async def health_check() -> HealthResponse:
    status_info = model_manager.get_status()
    return HealthResponse(
        status=status_info["status"],
        appName=settings.APP_NAME,
        appVersion=settings.APP_VERSION,
        device=settings.DEVICE,
        modelsLoaded=status_info["models"]
    )
