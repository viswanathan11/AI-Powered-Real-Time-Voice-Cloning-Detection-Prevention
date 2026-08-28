import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.schemas.session import (
    StartSessionRequest,
    StartSessionResponse,
    SessionHistoryResponse,
    ActiveSessionListResponse,
    ActiveSessionSummary,
    EndSessionResponse,
    SessionChunkSummary
)
from backend.schemas.alert import AlertSummary
from backend.services.session_service import session_service
from backend.services.cache_service import cache_service

logger = logging.getLogger("VoiceShield-Backend")
router = APIRouter(prefix="/session", tags=["Call Sessions & Monitoring"])


@router.post(
    "/start",
    response_model=StartSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start Call Monitoring Session",
    description="Initializes a new live call monitoring session and returns the WebSocket streaming URL."
)
async def start_session(
    request: StartSessionRequest,
    http_req: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    POST /api/session/start
    Matches Plane.md Section 4 contract.
    """
    try:
        # Determine host base URL for WebSocket path
        host_header = http_req.headers.get("host")
        scheme = http_req.url.scheme
        base_url = f"{scheme}://{host_header}" if host_header else None

        ctx_dict = request.context.model_dump() if request.context else {}
        session, ws_url = await session_service.start_session(
            db=db,
            claimed_profile_id=request.claimedIdentity,
            context=ctx_dict,
            host_url=base_url
        )

        return StartSessionResponse(
            sessionId=session.id,
            websocketUrl=ws_url,
            claimedIdentity=session.claimed_profile_id,
            startedAt=session.started_at
        )
    except Exception as e:
        logger.error(f"Error starting session: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start monitoring session: {str(e)}"
        )


@router.get(
    "/active",
    response_model=ActiveSessionListResponse,
    summary="List Active Monitoring Sessions"
)
async def list_active_sessions(db: AsyncSession = Depends(get_db)):
    """Returns currently ongoing live monitoring sessions."""
    sessions = await session_service.list_active_sessions(db)
    return ActiveSessionListResponse(
        sessions=[
            ActiveSessionSummary(
                sessionId=s["sessionId"],
                claimedProfileId=s.get("claimedProfileId"),
                personName=s.get("personName"),
                callType=s.get("callType"),
                amount=s.get("amount"),
                callerNumber=s.get("callerNumber"),
                chunkCount=s.get("chunkCount", 0),
                currentRisk=s.get("currentRisk", 0.0),
                riskLevel=s.get("riskLevel", "LOW"),
                status=s.get("status", "ACTIVE"),
                startedAt=s["startedAt"]
            )
            for s in sessions
        ],
        total=len(sessions)
    )


@router.get(
    "/{session_id}/history",
    response_model=SessionHistoryResponse,
    summary="Get Session Timeline & Alert History",
    description="Returns sequential chunk scoring timeline, final risk score, and all triggered fraud alerts."
)
async def get_session_history(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    GET /api/session/{sessionId}/history
    Matches Plane.md Section 4 contract.
    """
    history = await session_service.get_session_history(db, session_id)
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found."
        )

    return SessionHistoryResponse(
        sessionId=history["sessionId"],
        claimedIdentity=history["claimedIdentity"],
        personName=history["personName"],
        callType=history["callType"],
        amount=history["amount"],
        callerNumber=history["callerNumber"],
        chunks=[
            SessionChunkSummary(
                chunkSeq=c["chunkSeq"],
                syntheticScore=c["syntheticScore"],
                speakerMatchScore=c["speakerMatchScore"],
                runningRisk=c["runningRisk"],
                createdAt=c["createdAt"]
            )
            for c in history["chunks"]
        ],
        finalRisk=history["finalRisk"],
        status=history["status"],
        alertsFired=[
            AlertSummary(
                chunkSeq=a["chunkSeq"],
                type=a["type"],
                reason=a.get("reason"),
                riskScore=a.get("riskScore"),
                createdAt=a["createdAt"]
            )
            for a in history["alertsFired"]
        ],
        startedAt=history["startedAt"],
        endedAt=history["endedAt"]
    )


@router.post(
    "/{session_id}/end",
    response_model=EndSessionResponse,
    summary="End Call Monitoring Session"
)
async def end_session(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Concludes monitoring for a call session and records final risk."""
    session = await session_service.end_session(db, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found."
        )

    final_r = session.final_risk or 0.0
    risk_level = "CRITICAL" if final_r >= 0.8 else "HIGH" if final_r >= 0.6 else "MEDIUM" if final_r >= 0.3 else "LOW"

    return EndSessionResponse(
        sessionId=session.id,
        status=session.status,
        finalRisk=final_r,
        riskLevel=risk_level,
        totalChunks=len(session.chunks),
        totalAlerts=len(session.alerts),
        endedAt=session.ended_at
    )
