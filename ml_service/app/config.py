import os
from pathlib import Path
from pydantic import BaseModel


class Settings(BaseModel):
    # Service Information
    APP_NAME: str = "VoiceShield-ML-Service"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/ml"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

    # Host & Port
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Audio specifications
    SAMPLE_RATE: int = 16000
    NUM_CHANNELS: int = 1
    TARGET_CHUNK_DURATION_SEC: float = 3.0
    MIN_AUDIO_DURATION_SEC: float = 0.3
    SILENCE_RMS_THRESHOLD: float = 0.005

    # Device configuration
    DEVICE: str = os.getenv("DEVICE", "cuda" if os.getenv("USE_CUDA", "false").lower() == "true" else "cpu")
    
    # Model Configurations
    USE_PRETRAINED_DOWNLOAD: bool = os.getenv("USE_PRETRAINED_DOWNLOAD", "true").lower() in ("true", "1", "yes")

    # Speaker Verification (ECAPA-TDNN)
    ECAPA_MODEL_SOURCE: str = os.getenv("ECAPA_MODEL_SOURCE", "speechbrain/spkrec-ecapa-voxceleb")
    ECAPA_SAVEDIR: Path = Path(os.getenv("ECAPA_SAVEDIR", "ml_service/models_cache/ecapa"))
    SPEAKER_EMBEDDING_DIM: int = 192
    SPEAKER_SIMILARITY_THRESHOLD: float = 0.50

    # Synthetic Voice Detection (WavLM / Acoustic Artifact Detector)
    WAVLM_MODEL_ID: str = os.getenv("WAVLM_MODEL_ID", "microsoft/wavlm-base-plus")
    WAVLM_SAVEDIR: Path = Path(os.getenv("WAVLM_SAVEDIR", "ml_service/models_cache/wavlm"))
    SYNTHETIC_SCORE_THRESHOLD: float = 0.65

    # Risk Engine Default Weights (Plane.md section 4)
    SYNTHETIC_WEIGHT: float = float(os.getenv("SYNTHETIC_WEIGHT", "0.5"))
    SPEAKER_MISMATCH_WEIGHT: float = float(os.getenv("SPEAKER_MISMATCH_WEIGHT", "0.5"))

    # Risk Thresholds
    RISK_THRESHOLD_LOW: float = 0.35
    RISK_THRESHOLD_MEDIUM: float = 0.65
    RISK_THRESHOLD_HIGH: float = 0.85

    # CORS
    CORS_ORIGINS: list[str] = ["*"]


settings = Settings()
