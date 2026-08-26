from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.utils.logger import logger
from app.api.routes import router as ml_router
from app.models.model_manager import model_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager to warm up ML inference pipelines on startup."""
    logger.info(f"Initializing {settings.APP_NAME} v{settings.APP_VERSION}...")
    logger.info(f"Execution Device: {settings.DEVICE}")
    model_manager.warmup()
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

# Include ML router
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
