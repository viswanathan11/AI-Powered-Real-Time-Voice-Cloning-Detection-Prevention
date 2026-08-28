import time
from typing import Dict, Any
import torch

from app.config import settings
from app.utils.logger import logger
from app.models.ecapa_verifier import ecapa_verifier
from app.models.wavlm_detector import wavlm_detector


class ModelManager:
    """
    Singleton Model Manager responsible for:
    - Preloading and warming up models on startup.
    - Health checks and diagnostic metadata.
    - Managing inference devices.
    """

    def __init__(self):
        self.ecapa = ecapa_verifier
        self.wavlm = wavlm_detector
        self.is_warmed_up = False

    def warmup(self):
        """Runs a dummy 3-second audio tensor through both models to warm up JIT and PyTorch cache."""
        if self.is_warmed_up:
            return

        logger.info("Warming up ML inference pipelines...")
        start_t = time.perf_counter()
        
        # 3-second dummy audio at 16kHz
        dummy_audio = torch.zeros((1, 48000), dtype=torch.float32)

        try:
            # Warmup ECAPA
            _ = self.ecapa.extract_embedding(dummy_audio)
            # Warmup WavLM
            _ = self.wavlm.detect_synthetic(dummy_audio, is_silent=False)
            
            elapsed = (time.perf_counter() - start_t) * 1000
            self.is_warmed_up = True
            logger.info(f"Model warm-up completed successfully in {elapsed:.2f}ms.")
        except Exception as e:
            logger.error(f"Error during model warm-up: {e}")

    def get_status(self) -> Dict[str, Any]:
        """Returns health status, active device, and model loaded state."""
        return {
            "status": "ready" if self.is_warmed_up else "initializing",
            "device": settings.DEVICE,
            "cuda_available": torch.cuda.is_available(),
            "models": {
                "ecapa_tdnn": {
                    "loaded": self.ecapa.model is not None,
                    "is_fallback": self.ecapa.is_fallback,
                    "embedding_dim": settings.SPEAKER_EMBEDDING_DIM
                },
                "wavlm_detector": {
                    "loaded": (self.wavlm.wavlm_model is not None) or self.wavlm.is_fallback,
                    "is_fallback": self.wavlm.is_fallback,
                    "threshold": settings.SYNTHETIC_SCORE_THRESHOLD
                }
            }
        }


model_manager = ModelManager()
