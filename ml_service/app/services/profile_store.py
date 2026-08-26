import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import numpy as np

from app.utils.logger import logger


class VoiceProfile:
    """Voiceprint Profile data model storing averaged embedding without raw audio."""
    def __init__(
        self,
        profile_id: str,
        person_name: str,
        role: Optional[str],
        org_id: Optional[str],
        embedding: List[float],
        sample_count: int,
        enrolled_at: Optional[str] = None
    ):
        self.profile_id = profile_id
        self.person_name = person_name
        self.role = role
        self.org_id = org_id
        self.embedding = embedding
        self.sample_count = sample_count
        self.enrolled_at = enrolled_at or datetime.now(timezone.utc).isoformat()

    def to_dict(self, include_embedding: bool = True) -> Dict[str, Any]:
        data = {
            "profileId": self.profile_id,
            "personName": self.person_name,
            "role": self.role,
            "orgId": self.org_id,
            "sampleCount": self.sample_count,
            "enrolledAt": self.enrolled_at
        }
        if include_embedding:
            data["embedding"] = self.embedding
        return data


class ProfileStore:
    """
    In-memory / cache registry for enrolled speaker voice profiles.
    Allows testing standalone and provides fallback when database is not connected.
    """

    def __init__(self):
        self._profiles: Dict[str, VoiceProfile] = {}

    def create_profile(
        self,
        person_name: str,
        role: Optional[str],
        org_id: Optional[str],
        embedding: List[float],
        sample_count: int,
        profile_id: Optional[str] = None
    ) -> VoiceProfile:
        pid = profile_id or f"vp_{uuid.uuid4().hex[:12]}"
        profile = VoiceProfile(
            profile_id=pid,
            person_name=person_name,
            role=role,
            org_id=org_id,
            embedding=embedding,
            sample_count=sample_count
        )
        self._profiles[pid] = profile
        logger.info(f"Enrolled new voice profile '{pid}' for {person_name} ({role or 'Unknown role'}).")
        return profile

    def get_profile(self, profile_id: str) -> Optional[VoiceProfile]:
        return self._profiles.get(profile_id)

    def list_profiles(self) -> List[VoiceProfile]:
        return list(self._profiles.values())

    def delete_profile(self, profile_id: str) -> bool:
        if profile_id in self._profiles:
            del self._profiles[profile_id]
            logger.info(f"Deleted voice profile '{profile_id}'.")
            return True
        return False

    def clear(self):
        self._profiles.clear()


profile_store = ProfileStore()
