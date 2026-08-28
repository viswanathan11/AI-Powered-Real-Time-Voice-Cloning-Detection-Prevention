import os
from pathlib import Path
from typing import List
from pydantic import BaseModel


class Settings(BaseModel):
    # App information
    APP_NAME: str = "VoiceShield-Backend"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

    # Host & Port
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Database Configuration (PostgreSQL with SQLite fallback)
    # Default to SQLite for zero-setup local dev/testing; override with postgresql+asyncpg://... for PostgreSQL
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./voiceshield.db"
    )
    # Sync database URL for synchronous scripts / migrations if needed
    SYNC_DATABASE_URL: str = os.getenv(
        "SYNC_DATABASE_URL",
        "sqlite:///./voiceshield.db"
    )

    # Redis Configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_ENABLED: bool = os.getenv("REDIS_ENABLED", "false").lower() in ("true", "1", "yes")
    SESSION_CACHE_TTL_SEC: int = int(os.getenv("SESSION_CACHE_TTL_SEC", "86400"))  # 24 hours

    # ML Service Bridge Configuration
    # Modes: "in_process" (fastest, zero network overhead) or "http" (microservice)
    ML_BRIDGE_MODE: str = os.getenv("ML_BRIDGE_MODE", "in_process").lower()
    ML_SERVICE_URL: str = os.getenv("ML_SERVICE_URL", "http://localhost:8000/ml")

    # Audio Stream Parameters (Plane.md)
    SAMPLE_RATE: int = 16000
    NUM_CHANNELS: int = 1
    TARGET_CHUNK_DURATION_SEC: float = 3.0
    CHUNK_SEQ_HEADER_BYTES: int = 4  # 4-byte chunk sequence number header in binary WebSocket frames

    # Risk Engine Default Weights (Plane.md section 4)
    SYNTHETIC_SCORE_THRESHOLD: float = float(os.getenv("SYNTHETIC_SCORE_THRESHOLD", "0.60"))
    SYNTHETIC_WEIGHT: float = float(os.getenv("SYNTHETIC_WEIGHT", "0.5"))
    SPEAKER_MISMATCH_WEIGHT: float = float(os.getenv("SPEAKER_MISMATCH_WEIGHT", "0.5"))

    # Risk Level Thresholds
    RISK_THRESHOLD_LOW: float = float(os.getenv("RISK_THRESHOLD_LOW", "0.30"))
    RISK_THRESHOLD_MEDIUM: float = float(os.getenv("RISK_THRESHOLD_MEDIUM", "0.60"))
    RISK_THRESHOLD_HIGH: float = float(os.getenv("RISK_THRESHOLD_HIGH", "0.80"))

    # Contextual Risk Parameters
    HIGH_VALUE_TRANSACTION_THRESHOLD: float = float(os.getenv("HIGH_VALUE_TRANSACTION_THRESHOLD", "500000.0"))
    HIGH_RISK_CALL_TYPES: List[str] = [
        "fund_transfer_approval",
        "wire_transfer",
        "credential_reset",
        "admin_override",
        "executive_instruction"
    ]

    # Exponential Moving Average (EMA) alpha factor for risk score smoothing across chunks (0.0 to 1.0)
    # Higher alpha = more responsive to latest chunk; Lower alpha = smoother rolling average
    RISK_EMA_ALPHA: float = float(os.getenv("RISK_EMA_ALPHA", "0.70"))

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*"
    ]


settings = Settings()
