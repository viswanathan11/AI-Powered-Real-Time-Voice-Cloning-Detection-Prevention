import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.schemas.voiceprint import (
    EnrollVoiceprintRequest,
    VoiceProfileResponse,
    VoiceProfileListResponse
)
from backend.services.voiceprint_service import voiceprint_service

logger = logging.getLogger("VoiceShield-Backend")
router = APIRouter(prefix="/voiceprint", tags=["Voiceprint & Enrollment"])


@router.post(
    "/enroll",
    response_model=VoiceProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enroll Genuine Voice Profile",
    description=(
        "Enrolls a high-privilege executive's voiceprint from 1 to 5 audio clips. "
        "Extracts and averages a 192-dimensional ECAPA-TDNN embedding vector. "
        "PRIVACY COMPLIANCE: Raw audio files are permanently discarded immediately after feature extraction."
    )
)
async def enroll_voiceprint(
    request: EnrollVoiceprintRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    POST /api/voiceprint/enroll
    Extracts 192-d speaker embedding, saves embedding to database, discards raw audio.
    """
    try:
        profile = await voiceprint_service.enroll_voiceprint(db, request)
        return VoiceProfileResponse(
            profileId=profile.id,
            personName=profile.person_name,
            role=profile.role,
            orgId=profile.org_id,
            sampleCount=profile.sample_count,
            enrolledAt=profile.enrolled_at
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        logger.error(f"Error enrolling voice profile: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Enrollment failed: {str(e)}"
        )


@router.get(
    "/profiles",
    response_model=VoiceProfileListResponse,
    summary="List Enrolled Voice Profiles"
)
async def list_voice_profiles(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    orgId: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Retrieves paginated list of registered executive voice profiles."""
    profiles, total = await voiceprint_service.list_profiles(db, skip=skip, limit=limit, org_id=orgId)
    return VoiceProfileListResponse(
        profiles=[
            VoiceProfileResponse(
                profileId=p.id,
                personName=p.person_name,
                role=p.role,
                orgId=p.org_id,
                sampleCount=p.sample_count,
                enrolledAt=p.enrolled_at
            )
            for p in profiles
        ],
        total=total
    )


@router.get(
    "/{profile_id}",
    response_model=VoiceProfileResponse,
    summary="Get Voice Profile Details"
)
async def get_voice_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieves metadata of a specific enrolled profile."""
    profile = await voiceprint_service.get_profile_by_id(db, profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Voice profile '{profile_id}' not found."
        )

    return VoiceProfileResponse(
        profileId=profile.id,
        personName=profile.person_name,
        role=profile.role,
        orgId=profile.org_id,
        sampleCount=profile.sample_count,
        enrolledAt=profile.enrolled_at
    )


@router.delete(
    "/{profile_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Voice Profile"
)
async def delete_voice_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Removes an enrolled voice profile."""
    deleted = await voiceprint_service.delete_profile(db, profile_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Voice profile '{profile_id}' not found."
        )

    return {"status": "success", "message": f"Voice profile '{profile_id}' deleted."}
