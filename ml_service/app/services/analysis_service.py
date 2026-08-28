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
        Analyzes a live incoming audio chunk for synthetic artifacts, audio quality, and speaker match.

        Args:
            audio_b64: Base64-encoded WAV or raw PCM audio chunk.
            compare_to_profile_id: Optional ID of enrolled voice profile.
            profile_embedding: Optional direct 192-dim embedding of reference voice profile.

        Returns:
            Dict containing syntheticScore, speakerMatchScore, speakerDecision, audioQuality,
            evidenceConfidence, classification, runningRisk, riskLevel, recommendation, etc.
        """
        start_time = time.perf_counter()

        # 1. Decode and preprocess audio
        waveform, sr, is_silent, rms_energy = self.audio_proc.decode_base64_audio(audio_b64)
        duration_sec = float(waveform.shape[-1] / sr)

        # 2. Assess physical audio quality
        quality_info = self.audio_proc.assess_audio_quality(waveform, sample_rate=sr)
        audio_quality = quality_info["quality"]
        is_usable = quality_info["isUsable"] and not is_silent
        evidence_confidence = float(quality_info["confidenceMultiplier"])

        # 3. Target Profile Embedding Resolution
        target_embedding: Optional[List[float]] = profile_embedding
        if target_embedding is None and compare_to_profile_id:
            profile = self.profiles.get_profile(compare_to_profile_id)
            if profile:
                target_embedding = profile.embedding
            else:
                logger.warning(f"Profile ID '{compare_to_profile_id}' not found in store.")

        # 4. Process evidence based on speech quality
        if not is_usable:
            # Insufficient speech or silence: do NOT fabricate fake evidence
            synthetic_score = 0.0
            synthetic_details = {
                "synthetic_score": 0.0,
                "is_synthetic": False,
                "note": "Insufficient usable speech or silence in chunk",
                "audio_quality": audio_quality
            }
            speaker_match_score = 1.0 if target_embedding is None else 0.50
            speaker_decision = "UNCERTAIN"
            cosine_sim = None
            classification = "UNCERTAIN"
            running_risk = 0.0
            risk_level = "LOW"
            recommendation = "ALLOW" if is_silent else "MONITOR"
            verdict = "AWAITING_SPEECH" if is_silent else "INSUFFICIENT_EVIDENCE"
            verdict_label = "Silence / Speech Pause" if is_silent else "Uncertain: Insufficient Usable Speech"
        else:
            # Usable audio: execute dual ML inference
            synthetic_score, synthetic_details = self.wavlm.detect_synthetic(
                waveform, sample_rate=sr, is_silent=False
            )

            chunk_emb_np = self.ecapa.extract_embedding(waveform, sample_rate=sr)
            if target_embedding is not None:
                cosine_sim = float(self.ecapa.compute_similarity(chunk_emb_np, target_embedding))
                speaker_match_score = round(float(self.ecapa.calibrate_match_score(cosine_sim)), 4)
                speaker_decision = self.ecapa.classify_speaker_decision(cosine_sim, audio_quality)
            else:
                speaker_match_score = 1.0
                speaker_decision = "MATCH"
                cosine_sim = None

            # 5. Composite Risk & 3-Way Triage Evaluation (+ Uncertainty)
            if target_embedding is not None:
                if synthetic_score >= settings.SYNTHETIC_SCORE_THRESHOLD or synthetic_score >= 0.60:
                    running_risk = max(0.85, round(synthetic_score, 4))
                    risk_level = "CRITICAL"
                    recommendation = "ESCALATE"
                    classification = "AI_CLONE_SUSPECTED"
                    verdict = "CRITICAL_AI_CLONE"
                    verdict_label = "Critical: AI Voice Clone Attack"
                elif speaker_decision == "MISMATCH" or speaker_match_score < 0.50:
                    running_risk = round(max(0.70, 0.85 * (1.0 - speaker_match_score)), 4)
                    risk_level = "HIGH"
                    recommendation = "VERIFY_CALLBACK"
                    classification = "HUMAN_IMPERSONATOR"
                    verdict = "IMPOSTER_MISMATCH"
                    verdict_label = "Warning: Voiceprint Mismatch (Imposter)"
                elif speaker_decision == "MATCH" and synthetic_score < 0.35:
                    running_risk = round(max(0.05, 0.20 * synthetic_score + 0.15 * (1.0 - speaker_match_score)), 4)
                    risk_level = "LOW"
                    recommendation = "ALLOW"
                    classification = "GENUINE"
                    verdict = "AUTHENTIC_EXECUTIVE"
                    verdict_label = "Authentic Executive Verified"
                else:
                    # Borderline similarity or degraded audio quality
                    running_risk = 0.45
                    risk_level = "MEDIUM"
                    recommendation = "MONITOR"
                    classification = "UNCERTAIN"
                    verdict = "BORDERLINE_EVIDENCE"
                    verdict_label = "Uncertain: Borderline Voice Evidence"
            else:
                # General unenrolled caller
                running_risk = synthetic_score
                risk_level, recommendation = self._compute_risk_level_and_recommendation(running_risk)
                if synthetic_score >= 0.60:
                    classification = "AI_CLONE_SUSPECTED"
                    verdict = "CRITICAL_AI_CLONE"
                    verdict_label = "Critical: AI Voice Synthesis Detected"
                else:
                    classification = "GENUINE"
                    verdict = "GENERAL_HUMAN"
                    verdict_label = "Natural Human Voice (Unenrolled Caller)"

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return {
            "syntheticScore": synthetic_score,
            "speakerMatchScore": speaker_match_score,
            "speakerDecision": speaker_decision,
            "audioQuality": audio_quality,
            "evidenceConfidence": evidence_confidence,
            "classification": classification,
            "runningRisk": running_risk,
            "riskLevel": risk_level,
            "recommendation": recommendation,
            "verdict": verdict,
            "verdictLabel": verdict_label,
            "latencyMs": elapsed_ms,
            "audioDurationSec": round(duration_sec, 3),
            "isSilent": is_silent,
            "rmsEnergy": round(rms_energy, 5),
            "cosineSimilarity": round(cosine_sim, 4) if cosine_sim is not None else None,
            "qualityDetails": quality_info,
            "details": {
                "synthetic": synthetic_details,
                "profileCompared": compare_to_profile_id or (True if profile_embedding else False)
            }
        }

    def aggregate_session_chunks(self, chunk_evaluations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Performs robust temporal multi-chunk aggregation over a streaming call session.
        Filters out low-quality/silent chunks and uses trimmed statistics to prevent false alarms.
        """
        if not chunk_evaluations:
            return {
                "totalChunks": 0,
                "validChunks": 0,
                "lowQualityChunks": 0,
                "rejectedChunks": 0,
                "aggregatedSpeakerScore": 1.0,
                "aggregatedSyntheticScore": 0.0,
                "overallRisk": 0.0,
                "overallClassification": "UNCERTAIN",
                "overallRecommendation": "MONITOR",
                "evidenceConfidence": 0.0
            }

        total_chunks = len(chunk_evaluations)
        valid_chunks = [c for c in chunk_evaluations if c.get("audioQuality") == "GOOD" and not c.get("isSilent")]
        poor_chunks = [c for c in chunk_evaluations if c.get("audioQuality") == "POOR_QUALITY" and not c.get("isSilent")]
        rejected_chunks = [c for c in chunk_evaluations if c.get("audioQuality") == "INSUFFICIENT_SPEECH" or c.get("isSilent")]

        usable_evals = valid_chunks if valid_chunks else poor_chunks

        if not usable_evals:
            return {
                "totalChunks": total_chunks,
                "validChunks": 0,
                "lowQualityChunks": len(poor_chunks),
                "rejectedChunks": len(rejected_chunks),
                "aggregatedSpeakerScore": 1.0,
                "aggregatedSyntheticScore": 0.0,
                "overallRisk": 0.0,
                "overallClassification": "UNCERTAIN",
                "overallRecommendation": "ALLOW" if all(c.get("isSilent") for c in chunk_evaluations) else "MONITOR",
                "evidenceConfidence": 0.0
            }

        speaker_scores = [c["speakerMatchScore"] for c in usable_evals if "speakerMatchScore" in c]
        synth_scores = [c["syntheticScore"] for c in usable_evals if "syntheticScore" in c]

        # Robust aggregation: median for speaker matching, 75th percentile for synthetic anomaly
        agg_speaker = float(np.median(speaker_scores)) if speaker_scores else 1.0
        agg_synth = float(np.percentile(synth_scores, 75)) if synth_scores else 0.0

        # Confidence scales with number of valid chunks (saturated at 3+ valid chunks)
        confidence = min(1.0, (len(valid_chunks) + 0.5 * len(poor_chunks)) / 3.0)

        # Overall triage classification
        if agg_synth >= 0.60 and len(synth_scores) >= 2:
            overall_class = "AI_CLONE_SUSPECTED"
            overall_rec = "ESCALATE"
            overall_risk = max(0.85, agg_synth)
        elif agg_speaker < 0.50 and len(speaker_scores) >= 2:
            overall_class = "HUMAN_IMPERSONATOR"
            overall_rec = "VERIFY_CALLBACK"
            overall_risk = round(max(0.70, 0.85 * (1.0 - agg_speaker)), 4)
        elif agg_speaker >= 0.50 and agg_synth < 0.35:
            overall_class = "GENUINE"
            overall_rec = "ALLOW"
            overall_risk = round(max(0.05, 0.20 * agg_synth + 0.15 * (1.0 - agg_speaker)), 4)
        else:
            overall_class = "UNCERTAIN"
            overall_rec = "MONITOR"
            overall_risk = 0.45

        return {
            "totalChunks": total_chunks,
            "validChunks": len(valid_chunks),
            "lowQualityChunks": len(poor_chunks),
            "rejectedChunks": len(rejected_chunks),
            "aggregatedSpeakerScore": round(agg_speaker, 4),
            "aggregatedSyntheticScore": round(agg_synth, 4),
            "overallRisk": round(overall_risk, 4),
            "overallClassification": overall_class,
            "overallRecommendation": overall_rec,
            "evidenceConfidence": round(confidence, 3)
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
        Validates speech quality for each clip and excludes unusable/silent audio.
        """
        if not audio_samples_b64:
            raise ValueError("At least one audio sample is required for enrollment")

        embeddings = []
        for idx, sample_b64 in enumerate(audio_samples_b64):
            waveform, sr, is_silent, _ = self.audio_proc.decode_base64_audio(sample_b64)
            q_info = self.audio_proc.assess_audio_quality(waveform, sample_rate=sr)
            if is_silent or not q_info["isUsable"]:
                logger.warning(f"Enrollment sample {idx+1} has insufficient speech / is silent (quality: {q_info['quality']}), skipping.")
                continue
            emb = self.ecapa.extract_embedding(waveform, sample_rate=sr)
            embeddings.append(emb)

        if not embeddings:
            raise ValueError("All provided audio samples had insufficient usable speech or were silent")

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
            q_info = self.audio_proc.assess_audio_quality(waveform, sample_rate=sr)
            if is_silent or not q_info["isUsable"]:
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
        q_info = self.audio_proc.assess_audio_quality(waveform_test, sample_rate=sr_test)

        if is_silent or not q_info["isUsable"]:
            return {
                "speakerMatchScore": 0.0,
                "cosineSimilarity": 0.0,
                "speakerDecision": "UNCERTAIN",
                "audioQuality": q_info["quality"],
                "isMatch": False,
                "isSilent": True,
                "threshold": settings.SPEAKER_SIMILARITY_THRESHOLD
            }

        emb_test = self.ecapa.extract_embedding(waveform_test, sample_rate=sr_test)

        if reference_embedding is None and reference_audio_b64:
            waveform_ref, sr_ref, _, _ = self.audio_proc.decode_base64_audio(reference_audio_b64)
            reference_embedding = self.ecapa.extract_embedding(waveform_ref, sample_rate=sr_ref).tolist()

        if reference_embedding is None:
            raise ValueError("Must provide either referenceAudio or referenceEmbedding")

        cosine_sim = float(self.ecapa.compute_similarity(emb_test, reference_embedding))
        match_score = float(self.ecapa.calibrate_match_score(cosine_sim))
        speaker_decision = self.ecapa.classify_speaker_decision(cosine_sim, q_info["quality"])
        is_match = cosine_sim >= settings.SPEAKER_SIMILARITY_THRESHOLD

        return {
            "speakerMatchScore": round(match_score, 4),
            "cosineSimilarity": round(cosine_sim, 4),
            "speakerDecision": speaker_decision,
            "audioQuality": q_info["quality"],
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
