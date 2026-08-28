import logging
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload

from backend.models.db_models import (
    Session,
    SessionChunk,
    Alert,
    VoiceProfile,
    generate_session_id,
    generate_chunk_id,
    generate_alert_id,
    utc_now
)
from backend.services.cache_service import cache_service
from backend.config import settings

logger = logging.getLogger("VoiceShield-Backend")


class SessionService:
    """
    Orchestrates Call Session Lifecycle, Real-Time Chunk Logging, and Security Alerts.
    """

    @staticmethod
    async def start_session(
        db: AsyncSession,
        claimed_profile_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        host_url: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Tuple[Session, str]:
        """
        Initializes a new monitoring session:
        1. Validates claimed profile identity if provided.
        2. Creates a record in the sessions table.
        3. Initializes Redis/In-Memory live session cache.
        4. Generates corresponding WebSocket URL.
        """
        session_id = session_id or generate_session_id()

        # Validate claimed profile if provided
        person_name = None
        if claimed_profile_id:
            p_stmt = select(VoiceProfile).where(VoiceProfile.id == claimed_profile_id)
            p_res = await db.execute(p_stmt)
            profile = p_res.scalars().first()
            if profile:
                person_name = profile.person_name
            else:
                logger.warning(f"Claimed profile ID '{claimed_profile_id}' does not exist in DB.")

        ctx = context or {}
        session = Session(
            id=session_id,
            claimed_profile_id=claimed_profile_id,
            call_type=ctx.get("callType", "fund_transfer_approval"),
            amount=float(ctx["amount"]) if ctx.get("amount") is not None else None,
            caller_number=ctx.get("callerNumber"),
            started_at=utc_now(),
            status="ACTIVE",
            final_risk=0.0
        )

        db.add(session)
        await db.commit()
        await db.refresh(session)

        # Initialize cache state for low-latency live access
        base_ws_host = host_url.replace("http://", "ws://").replace("https://", "wss://") if host_url else f"ws://localhost:{settings.PORT}"
        ws_url = f"{base_ws_host}/ws/session/{session_id}"

        cache_state = {
            "sessionId": session_id,
            "claimedProfileId": claimed_profile_id,
            "personName": person_name,
            "callType": session.call_type,
            "amount": session.amount,
            "callerNumber": session.caller_number,
            "chunkCount": 0,
            "currentRisk": 0.0,
            "riskLevel": "LOW",
            "recommendation": "ALLOW",
            "status": "ACTIVE",
            "websocketUrl": ws_url,
            "startedAt": session.started_at.isoformat()
        }
        await cache_service.set_session_state(session_id, cache_state)

        logger.info(f"Started monitoring session '{session_id}' (Claimed: {claimed_profile_id or 'None'}).")
        return session, ws_url

    @staticmethod
    async def get_session_by_id(db: AsyncSession, session_id: str) -> Optional[Session]:
        """Retrieves session with relationships loaded."""
        stmt = (
            select(Session)
            .where(Session.id == session_id)
            .options(
                selectinload(Session.claimed_profile),
                selectinload(Session.chunks),
                selectinload(Session.alerts)
            )
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def record_chunk(
        db: AsyncSession,
        session_id: str,
        chunk_seq: int,
        synthetic_score: float,
        speaker_match_score: float,
        running_risk: float
    ) -> SessionChunk:
        """Persists sequential 3-second audio chunk scoring result."""
        chunk = SessionChunk(
            id=generate_chunk_id(),
            session_id=session_id,
            chunk_seq=chunk_seq,
            synthetic_score=round(synthetic_score, 4),
            speaker_match_score=round(speaker_match_score, 4),
            running_risk=round(running_risk, 4),
            created_at=utc_now()
        )
        db.add(chunk)

        # Update final_risk on parent session
        upd_stmt = update(Session).where(Session.id == session_id).values(final_risk=round(running_risk, 4))
        await db.execute(upd_stmt)
        await db.commit()

        return chunk

    @staticmethod
    async def record_alert(
        db: AsyncSession,
        session_id: str,
        chunk_seq: int,
        alert_type: str,
        risk_score: Optional[float] = None,
        reason: Optional[str] = None
    ) -> Alert:
        """Logs a fraud prevention security alert to the alerts table."""
        alert = Alert(
            id=generate_alert_id(),
            session_id=session_id,
            chunk_seq=chunk_seq,
            alert_type=alert_type,
            risk_score=round(risk_score, 4) if risk_score is not None else None,
            reason=reason,
            created_at=utc_now()
        )
        db.add(alert)
        await db.commit()
        await db.refresh(alert)
        logger.warning(f"ALERT FIRED [Session {session_id} | Chunk {chunk_seq}]: {alert_type} (Risk: {risk_score}) - {reason}")
        return alert

    @staticmethod
    async def get_session_history(db: AsyncSession, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves complete chronological timeline of a session matching Plane.md Section 4:
        GET /api/session/{sessionId}/history
        """
        session = await SessionService.get_session_by_id(db, session_id)
        if not session:
            return None

        chunks_data = [
            {
                "chunkSeq": chk.chunk_seq,
                "syntheticScore": chk.synthetic_score,
                "speakerMatchScore": chk.speaker_match_score,
                "runningRisk": chk.running_risk,
                "createdAt": chk.created_at
            }
            for chk in session.chunks
        ]

        alerts_data = [
            {
                "chunkSeq": alt.chunk_seq,
                "type": alt.alert_type,
                "reason": alt.reason,
                "riskScore": alt.risk_score,
                "createdAt": alt.created_at
            }
            for alt in session.alerts
        ]

        person_name = session.claimed_profile.person_name if session.claimed_profile else None

        return {
            "sessionId": session.id,
            "claimedIdentity": session.claimed_profile_id,
            "personName": person_name,
            "callType": session.call_type,
            "amount": session.amount,
            "callerNumber": session.caller_number,
            "chunks": chunks_data,
            "finalRisk": session.final_risk,
            "status": session.status,
            "alertsFired": alerts_data,
            "startedAt": session.started_at,
            "endedAt": session.ended_at
        }

    @staticmethod
    async def end_session(db: AsyncSession, session_id: str, final_risk: Optional[float] = None) -> Optional[Session]:
        """Finalizes an active call session."""
        session = await SessionService.get_session_by_id(db, session_id)
        if not session:
            return None

        session.status = "COMPLETED"
        session.ended_at = utc_now()
        if final_risk is not None:
            session.final_risk = round(final_risk, 4)

        await db.commit()
        await db.refresh(session)

        # Update cache
        state = await cache_service.get_session_state(session_id)
        if state:
            state["status"] = "COMPLETED"
            state["endedAt"] = session.ended_at.isoformat()
            await cache_service.set_session_state(session_id, state)

        logger.info(f"Concluded session '{session_id}' with final risk {session.final_risk}.")
        return session

    @staticmethod
    async def list_active_sessions(db: AsyncSession) -> List[Dict[str, Any]]:
        """Lists active sessions from live cache and database."""
        cached = await cache_service.get_all_active_sessions()
        if cached:
            # Filter active
            return [s for s in cached if s.get("status") == "ACTIVE"]

        # Fallback to DB
        stmt = (
            select(Session)
            .where(Session.status == "ACTIVE")
            .options(selectinload(Session.claimed_profile), selectinload(Session.chunks))
            .order_by(Session.started_at.desc())
        )
        res = await db.execute(stmt)
        sessions = res.scalars().all()

        results = []
        for s in sessions:
            results.append({
                "sessionId": s.id,
                "claimedProfileId": s.claimed_profile_id,
                "personName": s.claimed_profile.person_name if s.claimed_profile else None,
                "callType": s.call_type,
                "amount": s.amount,
                "callerNumber": s.caller_number,
                "chunkCount": len(s.chunks),
                "currentRisk": s.final_risk or 0.0,
                "riskLevel": "HIGH" if (s.final_risk or 0.0) >= 0.6 else "LOW",
                "status": s.status,
                "startedAt": s.started_at
            })
        return results

    @staticmethod
    async def list_alerts(
        db: AsyncSession,
        session_id: Optional[str] = None,
        limit: int = 50
    ) -> Tuple[List[Alert], int]:
        """Lists security alerts with optional session filter."""
        query = select(Alert)
        count_query = select(func.count(Alert.id))

        if session_id:
            query = query.where(Alert.session_id == session_id)
            count_query = count_query.where(Alert.session_id == session_id)

        query = query.order_by(Alert.created_at.desc()).limit(limit)

        results = await db.execute(query)
        total_res = await db.execute(count_query)

        alerts = list(results.scalars().all())
        total = total_res.scalar_one() or 0
        return alerts, total


session_service = SessionService()
