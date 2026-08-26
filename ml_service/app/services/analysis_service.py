import time
from typing import Dict, List, Optional, Any, Tuple
import numpy as np

from app.config import settings
from app.utils.logger import logger
from app.services.audio_processor import audio_processor
from app.models.ecapa_verifier import ecapa_verifier
from app.models.wavlm_detector import wavlm_detector
from app.services.profile_store import profile_store, VoiceProfile


class AnalysisService:
    """
    Core Analysis Orchestration Service.
    Coordinates audio decoding, synthetic deepfake detection, speaker verification,
    and calculates composite impersonation risk score.
    """

    def __init__(self):
        self.audio_proc = audio_processor
        self.ecapa = ecapa_verifier
        self.wavlm = wavlm_detector
        self.profiles = profile_store

    def analyze_chunk(
        self,
        audio_b64: str,
        compare_to_profile_id: Optional[str] = None,
        profile_embedding: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        """
        Analyzes a live incoming audio chunk for synthetic artifacts and speaker match.

        Args:
            audio_b64: Base64-encoded WAV or raw PCM audio chunk.
            compare_to_profile_id: Optional ID of enrolled voice profile.
            profile_embedding: Optional direct 192-dim embedding of reference voice profile.

        Returns:
            Dict containing syntheticScore, speakerMatchScore, runningRisk, riskLevel, recommendation, etc.
        """
        start_time = time.perf_counter()

        # 1. Decode and preprocess audio
        waveform, sr, is_silent, rms_energy = self.audio_proc.decode_base64_audio(audio_b64)
        duration_sec = waveform.shape[-1] / sr

        # 2. Synthetic Voice Detection
        synthetic_score, synthetic_details = self.wavlm.detect_synthetic(
            waveform, sample_rate=sr, is_silent=is_silent
        )

        # 3. Speaker Verification (if reference profile or embedding provided)
        target_embedding: Optional[List[float]] = profile_embedding
        if target_embedding is None and compare_to_profile_id:
            profile = self.profiles.get_profile(compare_to_profile_id)
            if profile:
                target_embedding = profile.embedding
            else:
                logger.warning(f"Profile ID '{compare_to_profile_id}' not found in store.")

        speaker_match_score: Optional[float] = None
        cosine_sim: Optional[float] = None
        chunk_embedding: Optional[List[float]] = None

        if not is_silent:
            # Extract chunk embedding
            chunk_emb_np = self.ecapa.extract_embedding(waveform, sample_rate=sr)
            chunk_embedding = chunk_emb_np.tolist()

            if target_embedding is not None:
                cosine_sim = self.ecapa.compute_similarity(chunk_emb_np, target_embedding)
                speaker_match_score = round(self.ecapa.calibrate_match_score(cosine_sim), 4)

        # 4. Composite Risk Calculation
        # Plane.md formula: runningRisk = 0.5 * syntheticScore + 0.5 * (1 - speakerMatchScore)
        if is_silent:
            running_risk = 0.0
            risk_level = "LOW"
            recommendation = "ALLOW"
        elif speaker_match_score is not None:
            w_synth = settings.SYNTHETIC_WEIGHT
            w_mismatch = settings.SPEAKER_MISMATCH_WEIGHT
            speaker_mismatch = 1.0 - speaker_match_score
            running_risk = round(w_synth * synthetic_score + w_mismatch * speaker_mismatch, 4)
            running_risk = max(0.0, min(1.0, running_risk))
            risk_level, recommendation = self._compute_risk_level_and_recommendation(running_risk)
        else:
            # No reference speaker profile provided: risk is solely based on synthetic artifact score
            running_risk = synthetic_score
            risk_level, recommendation = self._compute_risk_level_and_recommendation(running_risk)

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return {
            "syntheticScore": synthetic_score,
            "speakerMatchScore": speaker_match_score if speaker_match_score is not None else 1.0,
            "runningRisk": running_risk,
            "riskLevel": risk_level,
            "recommendation": recommendation,
            "latencyMs": elapsed_ms,
            "audioDurationSec": round(duration_sec, 3),
            "isSilent": is_silent,
            "rmsEnergy": round(rms_energy, 5),
            "cosineSimilarity": round(cosine_sim, 4) if cosine_sim is not None else None,
            "details": {
                "synthetic": synthetic_details,
                "profileCompared": compare_to_profile_id or (True if profile_embedding else False)
            }
        }

    def enroll_voice_samples(
        self,
        person_name: str,
        role: Optional[str],
        org_id: Optional[str],
        audio_samples_b64: List[str],
        profile_id: Optional[str] = None
    ) -> VoiceProfile:
        """
        Enrolls a new voiceprint by extracting and averaging embeddings across multiple audio samples.
        """
        if not audio_samples_b64:
            raise ValueError("At least one audio sample is required for enrollment")

        embeddings = []
        for idx, sample_b64 in enumerate(audio_samples_b64):
            waveform, sr, is_silent, _ = self.audio_proc.decode_base64_audio(sample_b64)
            if is_silent:
                logger.warning(f"Enrollment sample {idx+1} is silent, skipping.")
                continue
            emb = self.ecapa.extract_embedding(waveform, sample_rate=sr)
            embeddings.append(emb)

        if not embeddings:
            raise ValueError("All provided audio samples were silent or invalid")

        averaged_embedding = self.ecapa.average_embeddings(embeddings)

        profile = self.profiles.create_profile(
            person_name=person_name,
            role=role,
            org_id=org_id,
            embedding=averaged_embedding.tolist(),
            sample_count=len(embeddings),
            profile_id=profile_id
        )
        return profile

    def extract_embedding_from_samples(self, audio_samples_b64: List[str]) -> Tuple[List[float], int]:
        """
        Extracts and averages speaker embedding vectors for one or more audio samples without creating a profile.
        """
        if not audio_samples_b64:
            raise ValueError("No audio samples provided")

        embeddings = []
        for sample_b64 in audio_samples_b64:
            waveform, sr, is_silent, _ = self.audio_proc.decode_base64_audio(sample_b64)
            if is_silent:
                continue
            emb = self.ecapa.extract_embedding(waveform, sample_rate=sr)
            embeddings.append(emb)

        if not embeddings:
            raise ValueError("All audio samples were silent or invalid")

        averaged = self.ecapa.average_embeddings(embeddings)
        return averaged.tolist(), len(embeddings)

    def verify_speaker_direct(
        self,
        audio_b64: str,
        reference_audio_b64: Optional[str] = None,
        reference_embedding: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        """Directly verifies speaker identity between test audio and reference audio/embedding."""
        waveform_test, sr_test, is_silent, _ = self.audio_proc.decode_base64_audio(audio_b64)
        if is_silent:
            return {
                "speakerMatchScore": 0.0,
                "cosineSimilarity": 0.0,
                "isMatch": False,
                "isSilent": True
            }

        emb_test = self.ecapa.extract_embedding(waveform_test, sample_rate=sr_test)

        if reference_embedding is None and reference_audio_b64:
            waveform_ref, sr_ref, _, _ = self.audio_proc.decode_base64_audio(reference_audio_b64)
            reference_embedding = self.ecapa.extract_embedding(waveform_ref, sample_rate=sr_ref).tolist()

        if reference_embedding is None:
            raise ValueError("Must provide either referenceAudio or referenceEmbedding")

        cosine_sim = self.ecapa.compute_similarity(emb_test, reference_embedding)
        match_score = self.ecapa.calibrate_match_score(cosine_sim)
        is_match = cosine_sim >= settings.SPEAKER_SIMILARITY_THRESHOLD

        return {
            "speakerMatchScore": round(match_score, 4),
            "cosineSimilarity": round(cosine_sim, 4),
            "isMatch": is_match,
            "threshold": settings.SPEAKER_SIMILARITY_THRESHOLD
        }

    def _compute_risk_level_and_recommendation(self, risk_score: float) -> Tuple[str, str]:
        """Calculates risk category and tactical mitigation recommendation."""
        if risk_score < settings.RISK_THRESHOLD_LOW:
            return "LOW", "ALLOW"
        elif risk_score < settings.RISK_THRESHOLD_MEDIUM:
            return "MEDIUM", "MONITOR"
        elif risk_score < settings.RISK_THRESHOLD_HIGH:
            return "HIGH", "VERIFY_CALLBACK"
        else:
            return "CRITICAL", "ESCALATE"


analysis_service = AnalysisService()
