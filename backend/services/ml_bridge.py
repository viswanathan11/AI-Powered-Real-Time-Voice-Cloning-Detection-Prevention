import sys
import time
import base64
import logging
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional, Union
import httpx

from backend.config import settings

logger = logging.getLogger("VoiceShield-Backend")

# Ensure ml_service directory is on sys.path for direct in-process inference
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ML_SERVICE_DIR = ROOT_DIR / "ml_service"
if str(ML_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(ML_SERVICE_DIR))


class MLBridge:
    """
    Unified Bridge to the Python ML Inference Engine.
    Supports:
    1. In-Process direct execution (fastest, zero network overhead, ~15ms).
    2. HTTP REST client fallback to independent microservice instances.
    """

    def __init__(self):
        self.mode = settings.ML_BRIDGE_MODE
        self._analysis_service = None
        self._audio_processor = None
        self._http_client: Optional[httpx.AsyncClient] = None
        self._init_in_process_service()

    def _init_in_process_service(self):
        """Initializes direct Python in-process ML services."""
        try:
            from app.services.analysis_service import analysis_service
            from app.services.audio_processor import audio_processor
            from app.models.model_manager import model_manager

            self._analysis_service = analysis_service
            self._audio_processor = audio_processor
            # Warm up models
            model_manager.warmup()
            logger.info("ML Bridge: In-process ML models loaded and warmed up successfully.")
        except Exception as e:
            logger.warning(f"ML Bridge: Could not initialize direct in-process ML service ({e}).")

    async def get_http_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=10.0)
        return self._http_client

    async def close(self):
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()

    def extract_embedding_from_samples(
        self,
        audio_samples_b64: List[str]
    ) -> Tuple[List[float], int]:
        """
        Extracts 192-dimensional ECAPA-TDNN speaker embedding averaged across audio samples.
        CRITICAL: Raw audio is processed and immediately released from memory.
        """
        if self._analysis_service is not None:
            return self._analysis_service.extract_embedding_from_samples(audio_samples_b64)

        # Fallback to sync HTTP if in-process not available
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{settings.ML_SERVICE_URL}/extract-embedding",
                json={"audioSamples": audio_samples_b64}
            )
            resp.raise_for_status()
            data = resp.json()
            return data["embedding"], data["sampleCount"]

    def analyze_audio_chunk(
        self,
        audio_input: Union[bytes, str],
        profile_embedding: Optional[List[float]] = None,
        compare_to_profile_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processes a live 3-second audio chunk through the ML models (WavLM & ECAPA-TDNN).

        Args:
            audio_input: Raw audio bytes or base64-encoded string.
            profile_embedding: 192-d reference embedding of claimed identity.
            compare_to_profile_id: Optional profile ID.

        Returns:
            Dict with syntheticScore, speakerMatchScore, latencyMs, isSilent, etc.
        """
        start_t = time.perf_counter()

        # Convert to base64 if raw bytes
        if isinstance(audio_input, bytes):
            audio_b64 = base64.b64encode(audio_input).decode("utf-8")
        else:
            audio_b64 = audio_input

        # 1. In-process direct execution
        if self._analysis_service is not None:
            try:
                res = self._analysis_service.analyze_chunk(
                    audio_b64=audio_b64,
                    compare_to_profile_id=compare_to_profile_id,
                    profile_embedding=profile_embedding
                )
                return res
            except Exception as e:
                logger.error(f"In-process ML inference error: {e}")
                # Re-raise or fallback
                raise

        # 2. HTTP microservice fallback
        try:
            with httpx.Client(timeout=5.0) as client:
                payload: Dict[str, Any] = {"audio": audio_b64}
                if compare_to_profile_id:
                    payload["compareToProfileId"] = compare_to_profile_id

                resp = client.post(
                    f"{settings.ML_SERVICE_URL}/analyze-chunk",
                    json=payload
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.error(f"HTTP ML inference failed: {e}")
            elapsed = round((time.perf_counter() - start_t) * 1000, 2)
            # Safe default response in catastrophic ML failure
            return {
                "syntheticScore": 0.50,
                "speakerMatchScore": 0.50,
                "runningRisk": 0.50,
                "riskLevel": "MEDIUM",
                "recommendation": "MONITOR",
                "latencyMs": elapsed,
                "isSilent": False,
                "details": {"error": str(e)}
            }


ml_bridge = MLBridge()
