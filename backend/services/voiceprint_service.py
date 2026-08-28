import logging
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from backend.models.db_models import VoiceProfile, generate_profile_id
from backend.services.ml_bridge import ml_bridge
from backend.schemas.voiceprint import EnrollVoiceprintRequest, VoiceProfileResponse

logger = logging.getLogger("VoiceShield-Backend")


class VoiceprintService:
    """
    Manages executive voiceprint enrollment, mathematical vector storage,
    and privacy compliance.
    CRITICAL PRIVACY GUARANTEE: Raw audio files are NEVER stored to disk or database.
    Only the 192-dimensional ECAPA-TDNN vector is retained.
    """

    @staticmethod
    async def enroll_voiceprint(
        db: AsyncSession,
        request: EnrollVoiceprintRequest
    ) -> VoiceProfile:
        """
        Enrolls a new genuine voice profile:
        1. Calls ML Bridge to extract and average 192-d ECAPA-TDNN embeddings from audio clips.
        2. Immediately drops raw audio from memory.
        3. Persists profile metadata and numerical embedding into the voice_profiles table.
        """
        if not request.audioSamples:
            raise ValueError("At least one audio sample clip is required for voiceprint enrollment.")

        logger.info(f"Extracting 192-d embedding across {len(request.audioSamples)} audio clips for '{request.personName}'...")
        
        # ML Extraction
        embedding, sample_count = ml_bridge.extract_embedding_from_samples(request.audioSamples)
        
        if not embedding or len(embedding) == 0:
            raise ValueError("Failed to extract valid speaker embedding from audio samples (silent or invalid format).")

        # Create DB record
        profile = VoiceProfile(
            id=generate_profile_id(),
            person_name=request.personName.strip(),
            role=request.role.strip() if request.role else None,
            org_id=request.orgId.strip() if request.orgId else None,
            embedding=embedding,
            sample_count=sample_count
        )

        db.add(profile)
        await db.commit()
        await db.refresh(profile)

        logger.info(f"Successfully enrolled voice profile '{profile.id}' for '{profile.person_name}' ({profile.role}).")
        return profile

    @staticmethod
    async def get_profile_by_id(db: AsyncSession, profile_id: str) -> Optional[VoiceProfile]:
        """Retrieves a single voice profile by its unique ID."""
        stmt = select(VoiceProfile).where(VoiceProfile.id == profile_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def list_profiles(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
        org_id: Optional[str] = None
    ) -> Tuple[List[VoiceProfile], int]:
        """Lists registered voice profiles with pagination."""
        query = select(VoiceProfile)
        count_query = select(func.count(VoiceProfile.id))

        if org_id:
            query = query.where(VoiceProfile.org_id == org_id)
            count_query = count_query.where(VoiceProfile.org_id == org_id)

        query = query.order_by(VoiceProfile.enrolled_at.desc()).offset(skip).limit(limit)

        results = await db.execute(query)
        total_res = await db.execute(count_query)

        profiles = list(results.scalars().all())
        total = total_res.scalar_one() or 0

        return profiles, total

    @staticmethod
    async def delete_profile(db: AsyncSession, profile_id: str) -> bool:
        """Deletes an enrolled voice profile."""
        profile = await VoiceprintService.get_profile_by_id(db, profile_id)
        if not profile:
            return False

        await db.delete(profile)
        await db.commit()
        logger.info(f"Deleted voice profile '{profile_id}'.")
        return True


voiceprint_service = VoiceprintService()
