import os
import sys
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

import uvicorn
from app.config import settings
from app.utils.logger import logger


def run():
    logger.info(f"Starting VoiceShield ML Service on {settings.HOST}:{settings.PORT}...")
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=1,
        log_level="info"
    )


if __name__ == "__main__":
    run()
