from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.utils.logger import logger
from app.api.routes import router as ml_router
from app.models.model_manager import model_manager


from pathlib import Path
import json

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager to warm up ML inference pipelines and seed default demo voiceprint on startup."""
    logger.info(f"Initializing {settings.APP_NAME} v{settings.APP_VERSION}...")
    logger.info(f"Execution Device: {settings.DEVICE}")
    model_manager.warmup()

    # Auto-seed default CFO profile if store is empty
    from app.services.profile_store import profile_store
    from app.services.analysis_service import analysis_service
    if not profile_store.list_profiles():
        try:
            samples_json = Path(__file__).resolve().parent.parent / "samples" / "sample_payloads.json"
            if samples_json.exists():
                with open(samples_json, "r") as f:
                    payloads = json.load(f)
                cfo_clips = [
                    payloads["cfo_enrollment_1.wav"],
                    payloads["cfo_enrollment_2.wav"],
                    payloads["cfo_enrollment_3.wav"]
                ]
                analysis_service.enroll_voice_samples(
                    person_name="Ramesh Kumar",
                    role="CFO",
                    org_id="org_enterprise_01",
                    audio_samples_b64=cfo_clips,
                    profile_id="vp_cfo_ramesh"
                )
                logger.info("Auto-seeded default executive voiceprint: Ramesh Kumar (CFO).")
        except Exception as e:
            logger.warning(f"Could not auto-seed default profile: {e}")

    logger.info("VoiceShield ML Service is ready to process audio chunks.")
    yield
    logger.info("Shutting down VoiceShield ML Service.")



app = FastAPI(
    title="VoiceShield ML Service",
    description="Real-Time Voice Cloning Detection & Speaker Verification Service for Enterprise Fraud Prevention (SIH26104)",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include router with /api (frontend API) and /ml (backend/ML prefix)
app.include_router(ml_router, prefix="/api")
if settings.API_PREFIX != "/api":
    app.include_router(ml_router, prefix=settings.API_PREFIX)



@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "description": "AI-Powered Real-Time Voice Cloning Detection & Prevention ML Engine",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "analyzeChunk": f"{settings.API_PREFIX}/analyze-chunk",
            "extractEmbedding": f"{settings.API_PREFIX}/extract-embedding",
            "enrollProfile": f"{settings.API_PREFIX}/enroll-profile",
            "verifySpeaker": f"{settings.API_PREFIX}/verify-speaker",
            "detectSynthetic": f"{settings.API_PREFIX}/detect-synthetic"
        }
    }


@app.get("/health", tags=["Health"])
async def root_health():
    status_info = model_manager.get_status()
    return JSONResponse(content={
        "status": status_info["status"],
        "appName": settings.APP_NAME,
        "appVersion": settings.APP_VERSION,
        "device": settings.DEVICE,
        "models": status_info["models"]
    })
