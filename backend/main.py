import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.config import settings
from backend.database import init_db
from backend.services.cache_service import cache_service
from backend.services.ml_bridge import ml_bridge
from backend.api import (
    voiceprint_router,
    session_router,
    alerts_router,
    websocket_router
)

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("VoiceShield-Backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown lifecycle:
    1. Initializes database schema (voice_profiles, sessions, session_chunks, alerts).
    2. Initializes Redis cache / in-memory fallback.
    3. Warms up ML inference pipelines.
    """
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}...")
    logger.info(f"Database URL: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")
    
    # 1. Database initialization
    try:
        await init_db()
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}", exc_info=True)

    # 2. Cache initialization
    try:
        await cache_service.initialize()
    except Exception as e:
        logger.warning(f"Cache initialization warning: {e}")

    # 3. Auto-seed default executive voiceprint (Ramesh Kumar - CFO) if no profiles exist
    try:
        import json
        from backend.database import AsyncSessionLocal
        from backend.services.voiceprint_service import VoiceprintService
        from backend.schemas.voiceprint import EnrollVoiceprintRequest

        async with AsyncSessionLocal() as db:
            profiles, total = await VoiceprintService.list_profiles(db, limit=1)
            if total == 0:
                payloads_path = ROOT_DIR / "frontend" / "public" / "sample_payloads.json"
                if not payloads_path.exists():
                    payloads_path = ROOT_DIR / "ml_service" / "samples" / "sample_payloads.json"
                if payloads_path.exists():
                    with open(payloads_path, "r", encoding="utf-8") as f:
                        payloads = json.load(f)
                    cfo_clips = [
                        payloads["cfo_enrollment_1.wav"],
                        payloads["cfo_enrollment_2.wav"],
                        payloads["cfo_enrollment_3.wav"]
                    ]
                    enroll_req = EnrollVoiceprintRequest(
                        personName="Ramesh Kumar",
                        role="CFO",
                        orgId="org_enterprise_01",
                        audioSamples=cfo_clips
                    )
                    await VoiceprintService.enroll_voiceprint(db, enroll_req)
                    logger.info("Auto-seeded default executive voiceprint: Ramesh Kumar (CFO).")
    except Exception as e:
        logger.warning(f"Default voiceprint auto-seed warning: {e}")

    logger.info("VoiceShield Unified Backend is fully ready to handle calls and WebSocket streams.")
    yield

    # Shutdown
    logger.info(f"Shutting down {settings.APP_NAME}...")
    await cache_service.close()
    await ml_bridge.close()
    logger.info("Shutdown complete.")


app = FastAPI(
    title="VoiceShield AI - Real-Time Voice Cloning Detection Backend",
    description=(
        "Enterprise-grade backend API and real-time WebSocket streaming service for "
        "detecting AI-generated voice clones and verifying executive identities (SIH26104)."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Configure CORS for React frontend (Vite & Create-React-App)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST & WebSocket API Routers
app.include_router(voiceprint_router, prefix=settings.API_PREFIX)
app.include_router(session_router, prefix=settings.API_PREFIX)
app.include_router(alerts_router, prefix=settings.API_PREFIX)
app.include_router(websocket_router)


@app.get("/", tags=["System"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "description": "AI-Powered Real-Time Voice Cloning Detection & Prevention Backend",
        "documentation": "/docs",
        "apiEndpoints": {
            "enrollVoiceprint": f"{settings.API_PREFIX}/voiceprint/enroll",
            "listVoiceprints": f"{settings.API_PREFIX}/voiceprint/profiles",
            "startSession": f"{settings.API_PREFIX}/session/start",
            "activeSessions": f"{settings.API_PREFIX}/session/active",
            "sessionHistory": f"{settings.API_PREFIX}/session/{{sessionId}}/history",
            "alerts": f"{settings.API_PREFIX}/alerts",
            "webSocketStream": "/ws/session/{sessionId}"
        }
    }


@app.get("/health", tags=["System"])
@app.get(f"{settings.API_PREFIX}/health", tags=["System"])
async def health_check():
    """System health check endpoint."""
    return JSONResponse(content={
        "status": "healthy",
        "appName": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database": "connected",
        "cache": "redis" if cache_service.use_redis else "in_memory",
        "mlBridgeMode": settings.ML_BRIDGE_MODE
    })
