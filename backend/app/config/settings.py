import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    # Application Information
    APP_NAME: str = "VoiceShield-Backend"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

    # Server Host & Port
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))

    # ML Service Configuration
    ML_SERVICE_URL: str = os.getenv("ML_SERVICE_URL", "http://127.0.0.1:8001")
    ML_SERVICE_TIMEOUT_SEC: float = float(os.getenv("ML_SERVICE_TIMEOUT_SEC", "10.0"))


settings = Settings()
