from fastapi import FastAPI
from app.websocket.session_ws import router as ws_router

app = FastAPI(
    title="Voice Cloning Detection Backend",
    description="Real-time voice cloning detection and prevention API.",
    version="0.1.0",
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(ws_router)


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health() -> dict:
    """Returns the service health status."""
    return {"status": "ok"}
