from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.schemas.alert import AlertListResponse, AlertResponse
from backend.services.session_service import session_service

router = APIRouter(prefix="/alerts", tags=["Fraud Alerts"])


@router.get(
    "",
    response_model=AlertListResponse,
    summary="List Security Alerts Across All Sessions"
)
async def list_all_alerts(
    sessionId: Optional[str] = Query(None, description="Optional session ID filter"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves all logged fraud alerts (VERIFY_CALLBACK, ESCALATE)."""
    alerts, total = await session_service.list_alerts(db, session_id=sessionId, limit=limit)
    return AlertListResponse(
        alerts=[
            AlertResponse(
                id=a.id,
                sessionId=a.session_id,
                chunkSeq=a.chunk_seq,
                alertType=a.alert_type,
                riskScore=a.risk_score,
                reason=a.reason,
                createdAt=a.created_at
            )
            for a in alerts
        ],
        total=total
    )


@router.get(
    "/{session_id}",
    response_model=AlertListResponse,
    summary="List Alerts for Specific Session"
)
async def list_session_alerts(
    session_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves fraud alerts for a specific session."""
    alerts, total = await session_service.list_alerts(db, session_id=session_id, limit=limit)
    return AlertListResponse(
        alerts=[
            AlertResponse(
                id=a.id,
                sessionId=a.session_id,
                chunkSeq=a.chunk_seq,
                alertType=a.alert_type,
                riskScore=a.risk_score,
                reason=a.reason,
                createdAt=a.created_at
            )
            for a in alerts
        ],
        total=total
    )
