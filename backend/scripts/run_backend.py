import sys
import os
from pathlib import Path
import uvicorn

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.config import settings

if __name__ == "__main__":
    print("=" * 70)
    print(f" Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f" Server URL: http://{settings.HOST}:{settings.PORT}")
    print(f" API Documentation: http://localhost:{settings.PORT}/docs")
    print(f" WebSocket Endpoint: ws://localhost:{settings.PORT}/ws/session/{{sessionId}}")
    print("=" * 70)

    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
