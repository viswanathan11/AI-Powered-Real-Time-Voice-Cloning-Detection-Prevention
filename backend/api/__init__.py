from backend.api.routes_voiceprint import router as voiceprint_router
from backend.api.routes_session import router as session_router
from backend.api.routes_alerts import router as alerts_router
from backend.api.routes_websocket import router as websocket_router

__all__ = [
    "voiceprint_router",
    "session_router",
    "alerts_router",
    "websocket_router"
]
